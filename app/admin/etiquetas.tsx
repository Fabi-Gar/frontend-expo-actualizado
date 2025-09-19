import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  listEtiquetas,
  createEtiqueta,
  updateEtiqueta,
  deleteEtiqueta,
  Etiqueta,
} from '../../services/catalogos';

export default function EtiquetasIndex() {
  const [items, setItems] = useState<Etiqueta[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Etiqueta | null>(null);
  const [formNombre, setFormNombre] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listEtiquetas();
      setItems(data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar etiquetas');
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await listEtiquetas();
      setItems(data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar etiquetas');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(x => (x.nombre || '').toLowerCase().includes(s));
  }, [items, q]);

  // Modal helpers
  const openCreate = () => {
    setEditing(null);
    setFormNombre('');
    setModalVisible(true);
  };

  const openEdit = (r: Etiqueta) => {
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
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const askDelete = (r: Etiqueta) => {
    Alert.alert('Eliminar', `¿Eliminar la etiqueta "${r.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(r.id) },
    ]);
  };

  const doDelete = async (id: number) => {
    try {
      setLoading(true);
      await deleteEtiqueta(id);
      await load();
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
        <Appbar.Content title="Etiquetas (Admin)" />
        <Appbar.Action icon="plus" onPress={openCreate} />
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
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => openEdit(item)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.nombre}</Text>
                  <Text style={styles.metaText}>ID: {item.id}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: '#ECEFF1' }]}
                  onPress={() => askDelete(item)}
                >
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
  metaText: { color: '#666' },
  iconBtn: { padding: 8, borderRadius: 8 },
  modalCard: { marginHorizontal: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8, textAlign: 'center' },
  input: { marginBottom: 8, backgroundColor: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
