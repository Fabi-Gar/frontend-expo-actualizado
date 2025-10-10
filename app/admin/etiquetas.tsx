import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  listEtiquetas,
  createEtiqueta,
  updateEtiqueta,
  deleteEtiqueta,
  restoreEtiqueta,
  Etiqueta,
} from '../../services/catalogos';

type ViewMode = 'active' | 'deleted' | 'all';

export default function EtiquetasIndex() {
  const [items, setItems] = useState<Etiqueta[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // vista
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [menuVisible, setMenuVisible] = useState(false);

  // modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Etiqueta | null>(null);
  const [formNombre, setFormNombre] = useState('');

  // debounce (para la búsqueda local, por consistencia con Roles)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (fn: () => void, ms = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, ms);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const show =
        viewMode === 'deleted' ? { show: 'deleted' as const }
        : viewMode === 'all' ? { show: 'all' as const }
        : undefined;

      const data = await listEtiquetas(show);
      setItems(data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudieron cargar etiquetas');
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    schedule(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // búsqueda local
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(x => (x.nombre || '').toLowerCase().includes(s));
  }, [items, q]);

  // modal helpers
  const openCreate = () => {
    setEditing(null);
    setFormNombre('');
    setModalVisible(true);
  };

  const openEdit = (r: Etiqueta) => {
    if (r.eliminadoEn) return; // no editar si está eliminada
    setEditing(r);
    setFormNombre(r.nombre || '');
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const saveFromModal = async () => {
    const nombre = formNombre.trim();
    if (!nombre) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }
    try {
      setLoading(true);
      if (editing) {
        await updateEtiqueta(editing.id, { nombre });
      } else {
        await createEtiqueta({ nombre });
      }
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  // eliminar / restaurar
  const askDelete = (r: Etiqueta) => {
    if (r.eliminadoEn) return; // ya eliminada
    Alert.alert('Eliminar', `¿Eliminar la etiqueta "${r.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(r.id) },
    ]);
  };

  const doDelete = async (id: string) => {
    try {
      setLoading(true);
      await deleteEtiqueta(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudo eliminar');
    } finally {
      setLoading(false);
    }
  };

  const doRestore = async (id: string) => {
    try {
      setLoading(true);
      await restoreEtiqueta(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudo restaurar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={
          viewMode === 'deleted' ? 'Etiquetas eliminadas'
          : viewMode === 'all' ? 'Etiquetas (Todas)'
          : 'Etiquetas (Admin)'
        } />
        {/* menú: activos / eliminados / todos */}
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
          placeholder="Buscar etiqueta"
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando etiquetas…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<View style={styles.center}><Text>No hay etiquetas</Text></View>}
          renderItem={({ item }) => {
            const isDeleted = !!item.eliminadoEn;
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => (!isDeleted) && openEdit(item)}>
                <View style={[styles.row, isDeleted && { opacity: 0.85 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {item.nombre}{isDeleted ? ' (Eliminada)' : ''}
                    </Text>
                    <Text style={styles.metaText}>ID: {item.id}</Text>
                    {isDeleted && item.eliminadoEn && (
                      <Text style={styles.metaText}>
                        Eliminada: {new Date(item.eliminadoEn).toLocaleString()}
                      </Text>
                    )}
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}

      {/* modal crear/editar */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={closeModal} contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? 'Editar etiqueta' : 'Nueva etiqueta'}</Text>

          <TextInput
            label="Nombre"
            mode="outlined"
            value={formNombre}
            onChangeText={setFormNombre}
            style={styles.input}
          />
          <HelperText type="info" visible>
            Ejemplo: Incendio forestal, Controlado, Sospechoso…
          </HelperText>

          <View style={styles.actions}>
            <Button mode="text" onPress={closeModal} disabled={loading}>Cancelar</Button>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
  },
  rowTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  metaText: { color: '#666', marginTop: 2, fontSize: 12 },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#ECEFF1' },
  modalCard: { marginHorizontal: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8, textAlign: 'left' },
  input: { marginBottom: 8, backgroundColor: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
