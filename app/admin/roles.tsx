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
  HelperText,
  Menu,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  Role,
  restoreRole,
  // Si exportaste el tipo desde el service, descomenta:
  // RolesPaged
} from '../../services/catalogos';

type ViewMode = 'active' | 'deleted' | 'all';

// Si NO exportaste RolesPaged desde el service, deja este tipo local:
type RolesPaged = {
  items: Role[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export default function RolesIndex() {
  const [items, setItems] = useState<Role[]>([]);
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
  const [editing, setEditing] = useState<Role | null>(null);
  const [formNombre, setFormNombre] = useState('');

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

      const resp = await listRoles({ ...show, page: 1, limit, q }) as RolesPaged;
      setItems(resp.items || []);
      setHasMore(!!resp.hasMore);
      setPage(1);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar roles');
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
      const resp = await listRoles({ ...show, page: nextPage, limit, q }) as RolesPaged;
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

  // Ejecutar load cuando cambie viewMode o q (debounce para q)
  useEffect(() => {
    scheduleLoad(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, q]);

  // --- Crear / Editar ---
  const openCreate = () => {
    setEditing(null);
    setFormNombre('');
    setModalVisible(true);
  };

  const openEdit = (r: Role) => {
    if (r.eliminadoEn) return; // no editar si está eliminado
    setEditing(r);
    setFormNombre(r.nombre || '');
    setModalVisible(true);
  };

  const saveFromModal = async () => {
    const nombre = formNombre.trim();
    if (!nombre) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }
    try {
      setLoading(true);
      if (editing) {
        await updateRole(editing.id, { nombre });
      } else {
        await createRole({ nombre });
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  // --- Eliminar / Restaurar ---
  const askDelete = (r: Role) => {
    if (r.eliminadoEn) return;
    Alert.alert('Eliminar', `¿Eliminar el rol "${r.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(r.id) },
    ]);
  };

  const doDelete = async (id: string) => {
    try {
      setLoading(true);
      await deleteRole(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo eliminar');
    } finally {
      setLoading(false);
    }
  };

  const doRestore = async (id: string) => {
    try {
      setLoading(true);
      await restoreRole(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo restaurar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={
          viewMode === 'deleted' ? 'Roles eliminados'
          : viewMode === 'all' ? 'Roles (Todos)'
          : 'Roles (Admin)'
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
          placeholder="Buscar rol"
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator /><Text>Cargando roles…</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<View style={styles.center}><Text>No hay roles</Text></View>}
          renderItem={({ item }) => {
            const isDeleted = !!item.eliminadoEn;
            return (
              <TouchableOpacity onPress={() => (!isDeleted) && openEdit(item)}>
                <View style={[styles.row, isDeleted && { opacity: 0.85 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {item.nombre}{isDeleted ? ' (Eliminado)' : ''}
                    </Text>
                    {isDeleted && item.eliminadoEn && (
                      <Text style={styles.metaText}>
                        Eliminado: {new Date(item.eliminadoEn).toLocaleString()}
                      </Text>
                    )}
                  </View>

                  {/* Acciones contextuales */}
                  {isDeleted ? (
                    <TouchableOpacity onPress={() => doRestore(item.id)} style={styles.iconBtn}>
                      <Ionicons name="refresh-circle-outline" size={26} color="#2E7D32" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => askDelete(item)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={20} color="#B00020" />
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

      {/* Modal crear/editar */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? 'Editar rol' : 'Nuevo rol'}</Text>
          <TextInput label="Nombre" mode="outlined" value={formNombre} onChangeText={setFormNombre} style={styles.input} />
          <HelperText type="info" visible>Ejemplo: administrador, usuario, observador…</HelperText>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#FAFAFA' },
  rowTitle: { fontWeight: 'bold', fontSize: 16 },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#ECEFF1' },
  metaText: { color: '#666', marginTop: 4, fontSize: 12 },
  modalCard: { margin: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8 },
  input: { marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
