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
  Chip,
  Menu,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  listRegiones,
  createRegion,
  updateRegion,
  deleteRegion,
  restoreRegion,
  Region,
} from '../../services/catalogos';

type ViewMode = 'active' | 'deleted' | 'all';

// si no exportaste RegionsPaged desde el service, usa este local:
type RegionsPaged = {
  items: Region[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export default function RegionesIndex() {
  const [items, setItems] = useState<Region[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // paginación
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // vista
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [menuVisible, setMenuVisible] = useState(false);

  // modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formCodigo, setFormCodigo] = useState('');

  // debounce búsqueda
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleLoad = (fn: () => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, 300);
  };

  // carga inicial / cambios de vista o búsqueda (página 1)
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const show =
        viewMode === 'deleted' ? { show: 'deleted' as const }
        : viewMode === 'all' ? { show: 'all' as const }
        : undefined;

      const resp = await listRegiones({ ...show, page: 1, limit, q }) as RegionsPaged;
      setItems(resp.items || []);
      setHasMore(!!resp.hasMore);
      setPage(1);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar regiones');
    } finally {
      setLoading(false);
    }
  }, [viewMode, limit, q]);

  // cargar más (append)
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    try {
      setLoadingMore(true);
      const show =
        viewMode === 'deleted' ? { show: 'deleted' as const }
        : viewMode === 'all' ? { show: 'all' as const }
        : undefined;

      const nextPage = page + 1;
      const resp = await listRegiones({ ...show, page: nextPage, limit, q }) as RegionsPaged;
      setItems(prev => [...prev, ...(resp.items || [])]);
      setHasMore(!!resp.hasMore);
      setPage(nextPage);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar más regiones');
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

  // ejecutar load cuando cambie viewMode o q (debounce para q)
  useEffect(() => {
    scheduleLoad(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, q]);

  // --- crear / editar ---
  const openCreate = () => {
    setEditing(null);
    setFormNombre('');
    setFormCodigo('');
    setModalVisible(true);
  };

  const openEdit = (r: Region) => {
    if ((r as any).eliminadoEn) return; // si manejas eliminadoEn en region
    setEditing(r);
    setFormNombre(r?.nombre || '');
    setFormCodigo(r?.codigo || '');
    setModalVisible(true);
  };

  const saveFromModal = async () => {
    const nombre = formNombre.trim();
    const codigo = formCodigo.trim();

    if (!nombre) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }

    try {
      setLoading(true);
      if (editing) {
        await updateRegion(editing.id, { nombre, codigo: codigo || undefined });
      } else {
        await createRegion({ nombre, codigo: codigo || undefined });
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  // --- eliminar / restaurar ---
  const askDelete = (r: Region) => {
    Alert.alert('Eliminar', `¿Eliminar la región "${r.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(r.id) },
    ]);
  };

  const doDelete = async (id: string) => {
    try {
      setLoading(true);
      await deleteRegion(id);
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
      await restoreRegion(id);
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
          viewMode === 'deleted' ? 'Regiones eliminadas'
          : viewMode === 'all' ? 'Regiones (Todas)'
          : 'Regiones (Admin)'
        } />
        {/* menú vista */}
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="filter-variant" onPress={() => setMenuVisible(true)} />}
        >
          <Menu.Item
            onPress={() => { setViewMode('active'); setMenuVisible(false); }}
            title="Activas"
            leadingIcon={viewMode === 'active' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => { setViewMode('deleted'); setMenuVisible(false); }}
            title="Eliminadas"
            leadingIcon={viewMode === 'deleted' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => { setViewMode('all'); setMenuVisible(false); }}
            title="Todas"
            leadingIcon={viewMode === 'all' ? 'check' : undefined}
          />
        </Menu>

        {/* crear solo cuando no estás en eliminadas */}
        {viewMode !== 'deleted' && (
          <Appbar.Action icon="plus" onPress={openCreate} />
        )}
      </Appbar.Header>

      <View style={styles.searchBox}>
        <TextInput
          mode="outlined"
          placeholder="Buscar región (nombre o código)"
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando regiones…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<View style={styles.center}><Text>No hay regiones</Text></View>}
          renderItem={({ item }) => {
            const isDeleted = Boolean((item as any).eliminadoEn); // si incluyes eliminadoEn en Region
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => (!isDeleted) && openEdit(item)}>
                <View style={[styles.row, isDeleted && { opacity: 0.85 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {item.nombre}{isDeleted ? ' (Eliminada)' : ''}
                    </Text>
                    <View style={styles.rowMeta}>
                      <Text style={styles.metaText}>ID: {item.id}</Text>
                      {item.codigo ? (
                        <Chip icon={() => <Ionicons name="pricetag-outline" size={14} />}>
                          {item.codigo}
                        </Chip>
                      ) : (
                        <Chip>sin código</Chip>
                      )}
                      {isDeleted && (item as any).eliminadoEn && (
                        <Text style={styles.metaText}>
                          Eliminada: {new Date((item as any).eliminadoEn!).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>

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

      {/* modal crear/editar */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? 'Editar región' : 'Nueva región'}</Text>

          <TextInput
            label="Nombre"
            mode="outlined"
            value={formNombre}
            onChangeText={setFormNombre}
            style={styles.input}
          />
          <HelperText type="info" visible>Ejemplos: Huehuetenango, Todos Santos…</HelperText>

          <TextInput
            label="Código (opcional)"
            mode="outlined"
            placeholder="HUE-01"
            value={formCodigo}
            onChangeText={setFormCodigo}
            style={styles.input}
            right={<TextInput.Icon icon="pricetag" />}
          />

          <View style={styles.actions}>
            <Button onPress={() => setModalVisible(false)} disabled={loading}>Cancelar</Button>
            <Button mode="contained" onPress={saveFromModal} loading={loading} disabled={loading}>
              {editing ? 'Actualizar' : 'Crear'}
            </Button>
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
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12 },
  rowTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { color: '#666', marginRight: 6, fontSize: 12 },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#ECEFF1' },
  modalCard: { marginHorizontal: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8, textAlign: 'left' },
  input: { marginBottom: 8, backgroundColor: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
