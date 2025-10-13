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
  Portal,
  Modal,
  Button,
  HelperText,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  getEstadosIncendio,
  createEstadoIncendio,
  updateEstadoIncendio,
  deleteEstadoIncendio,
  EstadoIncendio,
} from '../../services/catalogos';

export default function EstadosIndex() {
  const [items, setItems] = useState<EstadoIncendio[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<EstadoIncendio | null>(null);
  const [formCodigo, setFormCodigo] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formOrden, setFormOrden] = useState<string>(''); // lo guardamos como string y validamos a número

  // debounce de carga
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (fn: () => void, ms = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, ms);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEstadosIncendio();
      // El backend ya los trae ordenados por orden ASC, pero por si acaso:
      const sorted = [...data].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      setItems(sorted || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudieron cargar estados');
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(x =>
      (`${x.codigo || ''} ${x.nombre || ''}`).toLowerCase().includes(s)
    );
  }, [items, q]);

  // ---- Modal helpers
  const openCreate = () => {
    setEditing(null);
    setFormCodigo('');
    setFormNombre('');
    setFormOrden('');
    setModalVisible(true);
  };

  const openEdit = (e: EstadoIncendio) => {
    setEditing(e);
    setFormCodigo(e.codigo || '');
    setFormNombre(e.nombre || '');
    setFormOrden(
      typeof e.orden === 'number' && Number.isFinite(e.orden) ? String(e.orden) : ''
    );
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const parseOrden = (v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  };

  const saveFromModal = async () => {
    const codigo = formCodigo.trim();
    const nombre = formNombre.trim();
    const ordenNum = parseOrden(formOrden);

    if (!codigo || !nombre) {
      Alert.alert('Validación', 'Código y nombre son requeridos');
      return;
    }
    if (ordenNum === null) {
      Alert.alert('Validación', 'Orden debe ser un entero >= 0');
      return;
    }

    try {
      setLoading(true);
      if (editing) {
        await updateEstadoIncendio(editing.id, { codigo, nombre, color: undefined, orden: ordenNum });
      } else {
        await createEstadoIncendio({ codigo, nombre, color: undefined, orden: ordenNum });
      }
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const askDelete = (e: EstadoIncendio) => {
    Alert.alert('Eliminar', `¿Eliminar el estado "${e.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(e.id) },
    ]);
  };

  const doDelete = async (id: string) => {
    try {
      setLoading(true);
      await deleteEstadoIncendio(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudo eliminar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Estados (Admin)" />
        <Appbar.Action icon="plus" onPress={openCreate} />
      </Appbar.Header>

      <View style={styles.searchBox}>
        <TextInput
          mode="outlined"
          placeholder="Buscar por código o nombre"
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
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => openEdit(item)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.nombre}</Text>
                  <Text style={styles.metaText}>
                    Código: <Text style={{ fontWeight: 'bold' }}>{item.codigo}</Text> · Orden: {item.orden ?? 0}
                  </Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => askDelete(item)}>
                  <Ionicons name="trash-outline" size={20} color="#B00020" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}

      {/* Modal crear/editar */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={closeModal} contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>{editing ? 'Editar estado' : 'Nuevo estado'}</Text>

          <TextInput
            label="Código"
            mode="outlined"
            value={formCodigo}
            onChangeText={setFormCodigo}
            style={styles.input}
          />
          <HelperText type="info" visible>Ejemplos: ACT, REP, OFF… (único)</HelperText>

          <TextInput
            label="Nombre"
            mode="outlined"
            value={formNombre}
            onChangeText={setFormNombre}
            style={styles.input}
          />
          <HelperText type="info" visible>Ejemplos: Activo, Reportado, Apagado…</HelperText>

          <TextInput
            label="Orden (entero ≥ 0)"
            mode="outlined"
            value={formOrden}
            onChangeText={setFormOrden}
            keyboardType="number-pad"
            style={styles.input}
          />

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
  metaText: { color: '#666', fontSize: 12 },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#ECEFF1' },
  modalCard: { marginHorizontal: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8, textAlign: 'left' },
  input: { marginBottom: 8, backgroundColor: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
