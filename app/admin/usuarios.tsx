import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Appbar,
  TextInput,
  Text,
  ActivityIndicator,
  Portal,
  Modal,
  Button,
  Switch,
  Menu,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  restoreUser,
  UserAccount,
  listRoles,
  Role,
 
} from '../../services/catalogos';

type ViewMode = 'active' | 'deleted' | 'all';

type UsersPaged = {
  items: UserAccount[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export default function UsuariosIndex() {
  const [items, setItems] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Vista (Activos/Eliminados/Todos)
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [menuVisible, setMenuVisible] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formCorreo, setFormCorreo] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRolId, setFormRolId] = useState<string | null>(null); // UUID o null
  const [formActivo, setFormActivo] = useState<boolean>(true);

  // Debounce búsqueda (300ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleLoad = (fn: () => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, 300);
  };

  // Carga inicial / cambios de vista o búsqueda (página 1)
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const show =
        viewMode === 'deleted' ? { show: 'deleted' as const }
        : viewMode === 'all' ? { show: 'all' as const }
        : undefined;

      const resp = await listUsers({ ...show, page: 1, limit, q }) as UsersPaged;
      setItems(resp.items || []);
      setHasMore(!!resp.hasMore);
      setPage(1);

      const rs = await listRoles({ page: 1, limit: 100 }); 
      setRoles(rs.items || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [viewMode, limit, q]);

  // Cargar más (append)
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    try {
      setLoadingMore(true);
      const show =
        viewMode === 'deleted' ? { show: 'deleted' as const }
        : viewMode === 'all' ? { show: 'all' as const }
        : undefined;

      const nextPage = page + 1;
      const resp = await listUsers({ ...show, page: nextPage, limit, q }) as UsersPaged;
      setItems(prev => [...prev, ...(resp.items || [])]);
      setHasMore(!!resp.hasMore);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, viewMode, page, limit, q]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    scheduleLoad(load);
  }, [viewMode, q, load]);

  // --- Crear / Editar ---
  const openCreate = () => {
    setEditing(null);
    setFormNombre('');
    setFormCorreo('');
    setFormPassword(''); 
    setFormRolId(null);
    setFormActivo(true);
    setModalVisible(true);
  };

  const openEdit = (u: UserAccount) => {
    if (u.eliminadoEn) return; 
    setEditing(u);
    setFormNombre(u.nombre || '');
    setFormCorreo(u.correo || '');
    setFormPassword(''); 
    setFormRolId(u.rol?.id || null);
    setFormActivo(u.activo ?? true);
    setModalVisible(true);
  };

  const saveFromModal = async () => {
    if (!formNombre.trim() || !formCorreo.trim()) {
      Alert.alert('Validación', 'Nombre y correo son obligatorios');
      return;
    }

    try {
      setLoading(true);

      if (editing) {
        const payload: any = {
          nombre: formNombre.trim(),
          correo: formCorreo.trim(),
          rolId: formRolId,        
          activo: formActivo,
        };
        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }
        await updateUser(editing.id, payload);
      } else {
        if (!formPassword.trim()) {
          Alert.alert('Validación', 'La contraseña es obligatoria para crear');
          setLoading(false);
          return;
        }
        await createUser({
          nombre: formNombre.trim(),
          correo: formCorreo.trim(),
          password: formPassword.trim(),
          rolId: formRolId || undefined, 
        });
      }

      setModalVisible(false);
      await load();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        'No se pudo guardar';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // --- Eliminar / Restaurar / Activar ---
  const askDelete = (u: UserAccount) => {
    if (u.eliminadoEn) return;
    Alert.alert('Eliminar', `¿Eliminar el usuario "${u.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(u.id) },
    ]);
  };

  const doDelete = async (id: string) => {
    try {
      setLoading(true);
      await deleteUser(id);
      await load();
    } finally {
      setLoading(false);
    }
  };

  const doRestore = async (id: string) => {
    try {
      setLoading(true);
      await restoreUser(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo restaurar');
    } finally {
      setLoading(false);
    }
  };

  const doActivate = async (id: string) => {
    try {
      setLoading(true);
      await updateUser(id, { activo: true }); // activar inactivo
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo activar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={
          viewMode === 'deleted' ? 'Usuarios eliminados'
          : viewMode === 'all' ? 'Usuarios (Todos)'
          : 'Usuarios (Admin)'
        } />

        {/* Menú de vista */}
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="filter-variant" onPress={() => setMenuVisible(true)} />}
        >
          <Menu.Item
            onPress={() => { setViewMode('active'); setMenuVisible(false); }}
            title="Activos"
            leadingIcon={viewMode === 'active' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => { setViewMode('deleted'); setMenuVisible(false); }}
            title="Eliminados"
            leadingIcon={viewMode === 'deleted' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => { setViewMode('all'); setMenuVisible(false); }}
            title="Todos"
            leadingIcon={viewMode === 'all' ? 'check' : undefined}
          />
        </Menu>

        {(viewMode !== 'deleted') && (
          <Appbar.Action icon="plus" onPress={openCreate} />
        )}
      </Appbar.Header>

      <View style={styles.searchBox}>
        <TextInput
          mode="outlined"
          placeholder="Buscar usuario"
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const isDeleted = !!item.eliminadoEn;
            return (
              <TouchableOpacity onPress={() => (!isDeleted) && openEdit(item)}>
                <View style={[styles.row, isDeleted && { opacity: 0.85 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {item.nombre}{isDeleted ? ' (Eliminado)' : ''}
                    </Text>
                    <Text>{item.correo}</Text>
                    <Text style={styles.metaText}>
                      {item.rol?.nombre ?? 'Sin rol'} · {item.activo ? 'Activo' : 'Inactivo'}
                    </Text>
                    {isDeleted && item.eliminadoEn && (
                      <Text style={styles.deletedAt}>
                        Eliminado: {new Date(item.eliminadoEn).toLocaleString()}
                      </Text>
                    )}
                  </View>

                  {/* Acciones contextuales */}
                  {isDeleted ? (
                    <TouchableOpacity onPress={() => doRestore(item.id)}>
                      <Ionicons name="refresh-circle-outline" size={26} color="#2E7D32" />
                    </TouchableOpacity>
                  ) : item.activo ? (
                    <TouchableOpacity onPress={() => askDelete(item)}>
                      <Ionicons name="trash-outline" size={20} color="#B00020" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => doActivate(item.id)}>
                      <Ionicons name="checkmark-circle-outline" size={24} color="#1976D2" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}

      {/* Modal */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? 'Editar usuario' : 'Nuevo usuario'}</Text>

          <TextInput
            label="Nombre"
            value={formNombre}
            onChangeText={setFormNombre}
            style={styles.input}
          />

          <TextInput
            label="Correo"
            value={formCorreo}
            onChangeText={setFormCorreo}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <TextInput
            label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            value={formPassword}
            onChangeText={setFormPassword}
            secureTextEntry
            style={styles.input}
            placeholder={editing ? 'Dejar vacío para no cambiar' : undefined}
          />

          <View style={styles.switchRow}>
            <Text>Activo</Text>
            <Switch value={formActivo} onValueChange={setFormActivo} />
          </View>

          <Text style={{ marginTop: 8, marginBottom: 4 }}>Rol:</Text>

          {/* Opción sin rol */}
          <TouchableOpacity style={styles.rolOption} onPress={() => setFormRolId(null)}>
            <Ionicons
              name={formRolId === null ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color="#4CAF50"
            />
            <Text style={{ marginLeft: 6 }}>Sin rol</Text>
          </TouchableOpacity>

          {roles.map(r => (
            <TouchableOpacity key={r.id} style={styles.rolOption} onPress={() => setFormRolId(r.id)}>
              <Ionicons
                name={formRolId === r.id ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color="#4CAF50"
              />
              <Text style={{ marginLeft: 6 }}>{r.nombre}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.actions}>
            <Button onPress={() => setModalVisible(false)}>Cancelar</Button>
            <Button mode="contained" onPress={saveFromModal}>{editing ? 'Actualizar' : 'Crear'}</Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  searchBox: { padding: 16, paddingBottom: 0 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 24 },
  sep: { height: 10 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#FAFAFA' },
  rowTitle: { fontWeight: 'bold', fontSize: 16 },
  metaText: { color: '#666' },
  deletedAt: { color: '#9E9E9E', marginTop: 4, fontSize: 12 },
  modalCard: { margin: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8 },
  input: { marginBottom: 8 },
  rolOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
});
