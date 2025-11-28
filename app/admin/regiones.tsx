// app/admin/departamentos/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
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
  Divider,
  IconButton,
} from 'react-native-paper';
import { router } from 'expo-router';

import {
  listDepartamentos,
  createDepartamento,
  updateDepartamento,
  deleteDepartamento,
  listMunicipios,
  createMunicipio,
  updateMunicipio,
  deleteMunicipio,
  type Departamento,
  type Municipio,
} from '@/services/catalogos';

export default function DepartamentosIndex() {
  // ====== Departamentos ======
  const [items, setItems] = useState<Departamento[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Depto
  const [deptModalVisible, setDeptModalVisible] = useState(false);
  const [editingDept, setEditingDept] = useState<Departamento | null>(null);
  const [formDeptNombre, setFormDeptNombre] = useState('');

  // ====== Municipios (modal de gestión) ======
  const [muniModalVisible, setMuniModalVisible] = useState(false);
  const [currentDepto, setCurrentDepto] = useState<Departamento | null>(null);
  const [munis, setMunis] = useState<Municipio[]>([]);
  const [muniLoading, setMuniLoading] = useState(false);

  // Modal Crear/Editar Muni
  const [editingMuni, setEditingMuni] = useState<Municipio | null>(null);
  const [formMuniNombre, setFormMuniNombre] = useState('');
  const muniInputRef = useRef<any>(null);
  // ====== Carga departamentos ======
  const loadDeptos = useCallback(async () => {
    try {
      setLoading(true);
      // Tu service actual trae todo (sin paginación ni q). Hacemos filtro local:
      const arr = await listDepartamentos();
      setItems(arr || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar departamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeptos();
  }, [loadDeptos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDeptos();
    } finally {
      setRefreshing(false);
    }
  }, [loadDeptos]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((d) => (d.nombre || '').toLowerCase().includes(s));
  }, [items, q]);

  // ====== Crear/Editar Depto ======
  const openCreateDept = () => {
    setEditingDept(null);
    setFormDeptNombre('');
    setDeptModalVisible(true);
  };
  const openEditDept = (d: Departamento) => {
    setEditingDept(d);
    setFormDeptNombre(d.nombre || '');
    setDeptModalVisible(true);
  };
  const saveDept = async () => {
    const nombre = formDeptNombre.trim();
    if (!nombre) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }
    try {
      setLoading(true);
      if (editingDept) {
        await updateDepartamento(editingDept.id, { nombre });
      } else {
        await createDepartamento({ nombre });
      }
      setDeptModalVisible(false);
      await loadDeptos();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar el departamento');
    } finally {
      setLoading(false);
    }
  };
  const askDeleteDept = (d: Departamento) => {
    Alert.alert('Eliminar', `¿Eliminar el departamento "${d.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDeleteDept(d.id) },
    ]);
  };
  const doDeleteDept = async (id: string) => {
    try {
      setLoading(true);
      await deleteDepartamento(id);
      await loadDeptos();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo eliminar');
    } finally {
      setLoading(false);
    }
  };

  // ====== Municipios (gestión) ======
  const openMunis = async (d: Departamento) => {
    setCurrentDepto(d);
    setMuniModalVisible(true);
    setEditingMuni(null);
    setFormMuniNombre('');
    try {
      setMuniLoading(true);
      const arr = await listMunicipios(d.id);
      setMunis(arr || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar municipios');
    } finally {
      setMuniLoading(false);
    }
  };

  const startCreateMuni = () => {
    setEditingMuni(null);
    setFormMuniNombre('');
    setTimeout(() => muniInputRef.current?.focus?.(), 100);
  };
  const startEditMuni = (m: Municipio) => {
    setEditingMuni(m);
    setFormMuniNombre(m.nombre || '');
    setTimeout(() => muniInputRef.current?.focus?.(), 100);
  };
  const saveMuni = async () => {
    const nombre = formMuniNombre.trim();
    if (!nombre) {
      Alert.alert('Validación', 'El nombre del municipio es requerido');
      return;
    }
    if (!currentDepto) return;
    try {
      setMuniLoading(true);
      if (editingMuni) {
        await updateMunicipio(editingMuni.id, { nombre, departamentoId: currentDepto.id });
      } else {
        await createMunicipio(currentDepto.id, { nombre });
      }
      const arr = await listMunicipios(currentDepto.id);
      setMunis(arr || []);
      setEditingMuni(null);
      setFormMuniNombre('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar el municipio');
    } finally {
      setMuniLoading(false);
    }
  };
  const askDeleteMuni = (m: Municipio) => {
    Alert.alert('Eliminar', `¿Eliminar el municipio "${m.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDeleteMuni(m.id) },
    ]);
  };
  const doDeleteMuni = async (id: string) => {
    if (!currentDepto) return;
    try {
      setMuniLoading(true);
      await deleteMunicipio(id);
      const arr = await listMunicipios(currentDepto.id);
      setMunis(arr || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo eliminar el municipio');
    } finally {
      setMuniLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Departamentos" />
        <Appbar.Action icon="plus" onPress={openCreateDept} />
      </Appbar.Header>

      <View style={styles.searchBox}>
        <TextInput
          mode="outlined"
          placeholder="Buscar departamento"
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando departamentos…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No hay departamentos</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.nombre}</Text>
                {!!item?.creadoEn && (
                  <Text>
                    Creado: {new Date(item.creadoEn).toLocaleString()}
                  </Text>
                )}
              </View>

              <View style={styles.rowActions}>
                <IconButton
                  icon="city-variant-outline"
                  onPress={() => openMunis(item)}
                  accessibilityLabel="Gestionar municipios"
                />
                <IconButton
                  icon="pencil-outline"
                  onPress={() => openEditDept(item)}
                  accessibilityLabel="Editar departamento"
                />
                <IconButton
                  icon="trash-can-outline"
                  iconColor="#B00020"
                  onPress={() => askDeleteDept(item)}
                  accessibilityLabel="Eliminar departamento"
                />
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}

      {/* ===== Modal crear/editar departamento ===== */}
      <Modal
        visible={deptModalVisible}
        onDismiss={() => setDeptModalVisible(false)}
        contentContainerStyle={styles.modalCard}
      >
        <Text style={styles.modalTitle}>{editingDept ? 'Editar departamento' : 'Nuevo departamento'}</Text>

        <TextInput
          label="Nombre"
          mode="outlined"
          value={formDeptNombre}
          onChangeText={setFormDeptNombre}
          style={styles.input}
        />
        <HelperText type="info" visible>
          Ejemplo: Huehuetenango, Alta Verapaz…
        </HelperText>

        <View style={styles.actions}>
          <Button onPress={() => setDeptModalVisible(false)}>Cancelar</Button>
          <Button mode="contained" onPress={saveDept} loading={loading} disabled={loading}>
            {editingDept ? 'Actualizar' : 'Crear'}
          </Button>
        </View>
      </Modal>

      {/* ===== Modal gestión de municipios ===== */}
      <Modal
        visible={muniModalVisible}
        onDismiss={() => setMuniModalVisible(false)}
        contentContainerStyle={[styles.modalCard, { maxHeight: '85%' }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.modalTitle}>
            Municipios — {currentDepto?.nombre || ''}
          </Text>
          <IconButton icon="plus" onPress={startCreateMuni} />
        </View>

        {/* Editor rápido municipio */}
        {(editingMuni || formMuniNombre) && (
          <>
            <TextInput
              ref={muniInputRef}
              label={editingMuni ? 'Editar municipio' : 'Nuevo municipio'}
              mode="outlined"
              value={formMuniNombre}
              onChangeText={setFormMuniNombre}
              style={styles.input}
            />
            <View style={[styles.actions, { marginTop: 0 }]}>
              <Button
                onPress={() => { setEditingMuni(null); setFormMuniNombre(''); }}
                disabled={muniLoading}
              >
                Cancelar
              </Button>
              <Button mode="contained" onPress={saveMuni} loading={muniLoading} disabled={muniLoading}>
                {editingMuni ? 'Actualizar' : 'Agregar'}
              </Button>
            </View>
            <Divider style={{ marginVertical: 8 }} />
          </>
        )}

        {muniLoading && munis.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8 }}>Cargando municipios…</Text>
          </View>
        ) : (
          <FlatList
            data={munis}
            keyExtractor={(x) => String(x.id)}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={<View style={styles.center}><Text>No hay municipios</Text></View>}
            renderItem={({ item }) => (
              <View style={styles.muniRow}>
                <Text style={{ flex: 1, fontSize: 15 }}>{item.nombre}</Text>
                <IconButton icon="pencil-outline" onPress={() => startEditMuni(item)} />
                <IconButton icon="trash-can-outline" iconColor="#B00020" onPress={() => askDeleteMuni(item)} />
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 8 }}
          />
        )}

        <View style={styles.actions}>
          <Button onPress={() => setMuniModalVisible(false)}>Cerrar</Button>
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
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  rowTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  rowActions: { flexDirection: 'row', alignItems: 'center' },

  modalCard: { marginHorizontal: 16, backgroundColor: 'white', padding: 16, borderRadius: 12 },
  modalTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 8, textAlign: 'left' },
  input: { marginBottom: 8, backgroundColor: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },

  muniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
