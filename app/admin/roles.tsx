// app/admin/roles/index.tsx
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
  Modal,
  Button,
  HelperText,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  listRoles,
  createRol,
  updateRol,
  deleteRol,
  type Rol,          // <- el tipo correcto en tu service
  type Paginated,
} from '@/services/catalogos';

type RolesPaged = Paginated<Rol>;

export default function RolesIndex() {
  const [items, setItems] = useState<Rol[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const hasMore = page * pageSize < total;
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal crear/editar
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Rol | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');

  // Debounce búsqueda
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (fn: () => void, ms = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, ms);
  };

  const loadPage = useCallback(
    async (nextPage: number, replace = false) => {
      try {
        if (nextPage === 1) setLoading(true);
        const resp = (await listRoles(nextPage, pageSize)) as RolesPaged;

        // filtro de búsqueda local por nombre/descripcion
        const base = resp.items ?? [];
        const s = q.trim().toLowerCase();
        const filtered = s
          ? base.filter(
              (r) =>
                (r.nombre || '').toLowerCase().includes(s) ||
                (r.descripcion || '').toLowerCase().includes(s)
            )
          : base;

        setTotal(resp.total ?? filtered.length);
        if (replace) {
          setItems(filtered);
        } else {
          setItems((prev) => (nextPage === 1 ? filtered : [...prev, ...filtered]));
        }
        setPage(nextPage);
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar los roles');
      } finally {
        if (nextPage === 1) setLoading(false);
      }
    },
    [pageSize, q]
  );

  // Carga inicial + cuando cambia la búsqueda (debounce)
  useEffect(() => {
    schedule(() => loadPage(1, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPage(1, true);
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    try {
      setLoadingMore(true);
      await loadPage(page + 1, false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, loadPage, page]);

  // Crear / Editar
  const openCreate = () => {
    setEditing(null);
    setFormNombre('');
    setFormDescripcion('');
    setModalVisible(true);
  };
  const openEdit = (r: Rol) => {
    setEditing(r);
    setFormNombre(r.nombre || '');
    setFormDescripcion(r.descripcion || '');
    setModalVisible(true);
  };
  const saveFromModal = async () => {
    const nombre = formNombre.trim();
    const descripcion = formDescripcion.trim() || null;
    if (!nombre) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }
    try {
      setLoading(true);
      if (editing) {
        await updateRol(editing.id, { nombre, descripcion });
      } else {
        await createRol({ nombre, descripcion });
      }
      setModalVisible(false);
      await loadPage(1, true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar
  const askDelete = (r: Rol) => {
    Alert.alert('Eliminar', `¿Eliminar el rol "${r.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(r.id) },
    ]);
  };
  const doDelete = async (id: string) => {
    try {
      setLoading(true);
      await deleteRol(id);
      await loadPage(1, true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo eliminar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Roles" />
        <Appbar.Action icon="plus" onPress={openCreate} />
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
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando roles…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No hay roles</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openEdit(item)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.nombre}</Text>
                  {!!item.descripcion && (
                    <Text style={styles.metaText}>{item.descripcion}</Text>
                  )}
                  {!!item.creadoEn && (
                    <Text style={styles.metaText}>
                      Creado: {new Date(item.creadoEn).toLocaleString()}
                    </Text>
                  )}
                </View>

                <TouchableOpacity onPress={() => askDelete(item)} style={styles.iconBtn}>
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
        />
      )}

      {/* Modal crear/editar */}
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        contentContainerStyle={styles.modalCard}
      >
        <Text style={styles.modalTitle}>{editing ? 'Editar rol' : 'Nuevo rol'}</Text>
        <TextInput
          label="Nombre"
          mode="outlined"
          value={formNombre}
          onChangeText={setFormNombre}
          style={styles.input}
        />
        <TextInput
          label="Descripción"
          mode="outlined"
          value={formDescripcion}
          onChangeText={setFormDescripcion}
          style={styles.input}
          multiline
        />
        <HelperText type="info" visible>
          Ejemplo: ADMIN, ANALISTA, OPERADOR…
        </HelperText>
        <View style={styles.actions}>
          <Button onPress={() => setModalVisible(false)}>Cancelar</Button>
          <Button mode="contained" onPress={saveFromModal}>
            {editing ? 'Actualizar' : 'Crear'}
          </Button>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  searchBox: { padding: 16, paddingBottom: 0 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 24 },
  sep: { height: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },
  rowTitle: { fontWeight: 'bold', fontSize: 16 },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#ECEFF1' },
  metaText: { color: '#666', marginTop: 4, fontSize: 12 },
  modalCard: { margin: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8 },
  input: { marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
