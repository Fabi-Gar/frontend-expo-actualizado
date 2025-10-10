// app/admin/estados/index.tsx
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
  Chip,
  Portal,
  Modal,
  Button,
  HelperText,
  Menu,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  listEstados,
  createEstado,
  updateEstado,
  deleteEstado,
  restoreEstado,
  Estado,
} from '../../services/catalogos';

type ViewMode = 'active' | 'deleted' | 'all';

export default function EstadosIndex() {
  const [items, setItems] = useState<Estado[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // vista
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [menuVisible, setMenuVisible] = useState(false);

  // modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Estado | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formColor, setFormColor] = useState(''); // opcional

  // debounce (para mantener consistencia con Roles/Regiones)
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

      const data = await listEstados(show);
      setItems(data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudieron cargar estados');
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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(x => (x.nombre || '').toLowerCase().includes(s));
  }, [items, q]);

  // ---- Modal helpers
  const openCreate = () => {
    setEditing(null);
    setFormNombre('');
    setFormColor('');
    setModalVisible(true);
  };
  const openEdit = (e: Estado) => {
    if ((e as any).eliminadoEn) return; // no editar si está eliminado
    setEditing(e);
    setFormNombre(e.nombre || '');
    setFormColor((e as any).color || '');
    setModalVisible(true);
  };
  const closeModal = () => setModalVisible(false);

  const validarHex = (v: string) => {
    if (!v) return true;
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v.trim());
  };

  const saveFromModal = async () => {
    const nombre = formNombre.trim();
    const color = formColor.trim();

    if (!nombre) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }
    if (color && !validarHex(color)) {
      Alert.alert('Validación', 'El color debe ser HEX. Ej: #E53935 o #2E7D32');
      return;
    }

    try {
      setLoading(true);
      if (editing) {
        await updateEstado(editing.id, { nombre, color: color || undefined });
      } else {
        await createEstado({ nombre, color: color || undefined });
      }
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const askDelete = (e: Estado) => {
    if ((e as any).eliminadoEn) return; // ya eliminado
    Alert.alert('Eliminar', `¿Eliminar el estado "${e.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(e.id) },
    ]);
  };
  const doDelete = async (id: string) => {
    try {
      setLoading(true);
      await deleteEstado(id);
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
      await restoreEstado(id);
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
          viewMode === 'deleted' ? 'Estados eliminados'
          : viewMode === 'all' ? 'Estados (Todos)'
          : 'Estados (Admin)'
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

        {/* Crear solo si no estás viendo eliminados */}
        {viewMode !== 'deleted' && (
          <Appbar.Action icon="plus" onPress={openCreate} />
        )}
      </Appbar.Header>

      <View style={styles.searchBox}>
        <TextInput
          mode="outlined"
          placeholder="Buscar estado"
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando estados…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<View style={styles.center}><Text>No hay estados</Text></View>}
          renderItem={({ item }) => {
            const isDeleted = Boolean((item as any).eliminadoEn);
            const color = (item as any).color as string | undefined;
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => (!isDeleted) && openEdit(item)}>
                <View style={[styles.row, isDeleted && { opacity: 0.85 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {item.nombre}{isDeleted ? ' (Eliminado)' : ''}
                    </Text>
                    <View style={styles.rowMeta}>
                      <Text style={styles.metaText}>ID: {item.id}</Text>
                      {color ? (
                        <Chip icon={() => <Ionicons name="color-palette" size={14} />}>
                          {color}
                        </Chip>
                      ) : (
                        <Chip>sin color</Chip>
                      )}
                      {isDeleted && (item as any).eliminadoEn && (
                        <Text style={styles.metaText}>
                          Eliminado: {new Date((item as any).eliminadoEn!).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isDeleted ? (
                    <TouchableOpacity style={styles.iconBtn} onPress={() => doRestore(item.id)}>
                      <Ionicons name="refresh-circle-outline" size={26} color="#2E7D32" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.iconBtn} onPress={() => askDelete(item)}>
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

      {/* Modal crear/editar */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={closeModal} contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? 'Editar estado' : 'Nuevo estado'}</Text>

          <TextInput
            label="Nombre"
            mode="outlined"
            value={formNombre}
            onChangeText={setFormNombre}
            style={styles.input}
          />
          <HelperText type="info" visible>Ejemplos: Activo, Reportado, Apagado</HelperText>

          <TextInput
            label="Color (HEX opcional)"
            mode="outlined"
            placeholder="#E53935"
            value={formColor}
            onChangeText={setFormColor}
            right={<TextInput.Icon icon="palette" />}
            style={styles.input}
            error={!!formColor && !validarHex(formColor)}
          />
          <HelperText type={formColor && !validarHex(formColor) ? 'error' : 'info'} visible>
            {formColor && !validarHex(formColor)
              ? 'Formato HEX inválido (#RGB, #RRGGBB o #AARRGGBB).'
              : 'Si lo dejas vacío, se puede asignar por defecto.'}
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
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { color: '#666', marginRight: 6, fontSize: 12 },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#ECEFF1' },
  modalCard: { marginHorizontal: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8, textAlign: 'left' },
  input: { marginBottom: 8, backgroundColor: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
