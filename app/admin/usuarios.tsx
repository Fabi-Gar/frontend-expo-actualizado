// app/admin/usuarios.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import {
  Appbar, TextInput, Text, ActivityIndicator, Portal, Modal, Button, Switch, Menu,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { listRoles, Rol as Role } from '../../services/catalogos';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  UserAccount,
} from '../../services/usuarios';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type UsersPaged = {
  items: UserAccount[];
  page: number;
  pageSize: number;
  total: number;
};

export default function UsuariosIndex() {
  const [items, setItems] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Paginación (backend tiene page/pageSize)
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // (Opcional) menú de acciones futuras
  const [menuVisible, setMenuVisible] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formApellido, setFormApellido] = useState('');
  const [formCorreo, setFormCorreo] = useState('');
  const [formTelefono, setFormTelefono] = useState<string>('');
  const [formPassword, setFormPassword] = useState('');
  const [formRolId, setFormRolId] = useState<string | null>(null);
  const [formInstitucionId, setFormInstitucionId] = useState<string | null>(null);
  const [formIsAdmin, setFormIsAdmin] = useState<boolean>(false);

  // Debounce búsqueda (300ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (fn: () => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, 300);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await listUsers({ page: 1, pageSize });
      setItems(resp.items || []);
      setHasMore((resp.page * resp.pageSize) < (resp.total ?? 0));
      setPage(1);

      const rs = await listRoles(1, 100);
      setRoles(rs.items || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'No se pudieron cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    try {
      setLoadingMore(true);
      const next = page + 1;
      const resp = await listUsers({ page: next, pageSize });
      setItems(prev => [...prev, ...(resp.items || [])]);
      setHasMore((resp.page * resp.pageSize) < (resp.total ?? 0));
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, page, pageSize]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => { schedule(load); }, [load]);

  // Búsqueda en cliente (filtro por nombre/correo/rol)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(u => {
      const bag = [
        u.nombre || '',
        u.apellido || '',
        u.correo || '',
        u.rol?.nombre || '',
        u.institucion?.nombre || '',
      ].join(' ').toLowerCase();
      return bag.includes(s);
    });
  }, [items, q]);

  // --- Crear / Editar ---
  const openCreate = () => {
    setEditing(null);
    setFormNombre('');
    setFormApellido('');
    setFormCorreo('');
    setFormTelefono('');
    setFormPassword('');
    setFormRolId(null);
    setFormInstitucionId(null);
    setFormIsAdmin(false);
    setModalVisible(true);
  };

  const openEdit = (u: UserAccount) => {
    setEditing(u);
    setFormNombre(u.nombre || '');
    setFormApellido(u.apellido || '');
    setFormCorreo(u.correo || '');
    setFormTelefono(u.telefono || '');
    setFormPassword('');
    setFormRolId(u.rol?.id || null);
    setFormInstitucionId(u.institucion?.id || null);
    setFormIsAdmin(!!u.isAdmin);
    setModalVisible(true);
  };

  const saveFromModal = async () => {
    const nombre = formNombre.trim();
    const apellido = formApellido.trim();
    const correo = formCorreo.trim();
    const telefono = formTelefono?.trim() || undefined;
    const password = formPassword.trim();

    if (!nombre || !apellido || !correo) {
      Alert.alert('Validación', 'Nombre, apellido y correo son obligatorios');
      return;
    }

    try {
      setLoading(true);

      if (editing) {
        await updateUser(editing.id, {
          nombre,
          apellido,
          email: correo,
          telefono: telefono ?? null,
          newPassword: password || undefined,
          rolId: formRolId || undefined,
          institucionId: formInstitucionId === null ? null : formInstitucionId || undefined,
          isAdmin: formIsAdmin,
        });
      } else {
        if (!password) {
          Alert.alert('Validación', 'La contraseña es obligatoria para crear');
          setLoading(false);
          return;
        }
        if (!formRolId) {
          Alert.alert('Validación', 'Debes seleccionar un rol');
          setLoading(false);
          return;
        }
        await createUser({
          nombre,
          apellido,
          email: correo,
          password,
          rolId: formRolId,
          telefono: telefono ?? null,
          institucionId: formInstitucionId ?? null,
          isAdmin: formIsAdmin,
        });
      }

      setModalVisible(false);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || 'No se pudo guardar';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // --- Eliminar (soft) ---
  const askDelete = (u: UserAccount) => {
    Alert.alert('Eliminar', `¿Eliminar el usuario "${u.nombre} ${u.apellido}"?`, [
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

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Usuarios (Admin)" />

        {/* Menú reservado por si luego agregas filtros server-side */}
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="filter-variant" onPress={() => setMenuVisible(true)} />}
        >
          <Menu.Item
            onPress={() => { setMenuVisible(false); }}
            title="Sin filtros"
            leadingIcon="check"
          />
        </Menu>

        <Appbar.Action icon="plus" onPress={openCreate} />
      </Appbar.Header>

      <View style={styles.searchBox}>
        <TextInput
          mode="outlined"
          placeholder="Buscar por nombre, correo, rol o institución"
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator /><Text>Cargando…</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openEdit(item)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.nombre} {item.apellido}</Text>
                  <Text>{item.correo}</Text>
                  <Text style={styles.metaText}>
                    {item.rol?.nombre ?? 'Sin rol'}{item.isAdmin ? ' · Admin' : ''}{item.institucion?.nombre ? ` · ${item.institucion.nombre}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => askDelete(item)}>
                  <Ionicons name="trash-outline" size={20} color="#B00020" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
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
          ListEmptyComponent={<View style={styles.center}><Text>No hay usuarios</Text></View>}
        />
      )}

      {/* Modal crear/editar */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? 'Editar usuario' : 'Nuevo usuario'}</Text>

          <TextInput label="Nombre" value={formNombre} onChangeText={setFormNombre} style={styles.input} />
          <TextInput label="Apellido" value={formApellido} onChangeText={setFormApellido} style={styles.input} />
          <TextInput label="Correo" value={formCorreo} onChangeText={setFormCorreo} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <TextInput label="Teléfono (opcional)" value={formTelefono} onChangeText={setFormTelefono} keyboardType="phone-pad" style={styles.input} />

          <TextInput
            label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            value={formPassword}
            onChangeText={setFormPassword}
            secureTextEntry
            style={styles.input}
            placeholder={editing ? 'Dejar vacío para no cambiar' : undefined}
          />

          <Text style={{ marginTop: 8, marginBottom: 4 }}>Rol:</Text>
          {/* Sin rol no está soportado en create (backend requiere rol_uuid). Para editar, puedes dejarlo igual */}
          {roles.map(r => (
            <TouchableOpacity key={r.id} style={styles.rolOption} onPress={() => setFormRolId(r.id)}>
              <Ionicons
                name={formRolId === r.id ? 'radio-button-on' : 'radio-button-off'}
                size={20}
              />
              <Text style={{ marginLeft: 6 }}>{r.nombre}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.switchRow}>
            <Text>Es administrador</Text>
            <Switch value={formIsAdmin} onValueChange={setFormIsAdmin} />
          </View>

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
  modalCard: { margin: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8 },
  input: { marginBottom: 8 },
  rolOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
});
