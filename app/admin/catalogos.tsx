// app/admin/catalogos/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
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
  Chip,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  // servicios genéricos por path
  // OJO: estos ya existen en tu services/catalogos.ts
  // getCatalogo/postCatalogo/patchCatalogo/deleteCatalogo son internos,
  // así que acá usaremos las funciones específicas expuestas.
  getTiposIncendio,
  createTipoIncendio,
  updateTipoIncendio,
  deleteTipoIncendio,

  getTiposPropiedad,
  createTipoPropiedad,
  updateTipoPropiedad,
  deleteTipoPropiedad,

  getCausas,
  createCausa,
  updateCausa,
  deleteCausa,

  getIniciadoJuntoA,
  createIniciadoJuntoA,
  updateIniciadoJuntoA,
  deleteIniciadoJuntoA,

  getMediosAereos,
  createMedioAereo,
  updateMedioAereo,
  deleteMedioAereo,

  getMediosTerrestres,
  createMedioTerrestre,
  updateMedioTerrestre,
  deleteMedioTerrestre,

  getMediosAcuaticos,
  createMedioAcuatico,
  updateMedioAcuatico,
  deleteMedioAcuatico,

  getAbastos,
  createAbasto,
  updateAbasto,
  deleteAbasto,

  getTecnicasExtincion,
  createTecnicaExtincion,
  updateTecnicaExtincion,
  deleteTecnicaExtincion,

  type Opcion,
} from '../../services/catalogos';

// ---------- Configuración de catálogos disponibles ----------
// key = identificador interno (UI), label = texto para el menú
// y resolvemos cómo cargar/crear/editar/eliminar para cada uno
type CatalogKey =
  | 'tipos_incendio'
  | 'tipo_propiedad'
  | 'causas'
  | 'iniciado_junto_a'
  | 'medios_aereos'
  | 'medios_terrestres'
  | 'medios_acuaticos'
  | 'abastos'
  | 'tecnicas_extincion';

type CatalogConfig = {
  key: CatalogKey;
  label: string;
  list: () => Promise<Opcion[]>;
  create: (p: { nombre: string }) => Promise<any>;
  update: (id: string, p: Partial<{ nombre: string }>) => Promise<any>;
  remove: (id: string) => Promise<any>;
};

const CATALOGS: CatalogConfig[] = [
  {
    key: 'tipos_incendio',
    label: 'Tipos de incendio',
    list: getTiposIncendio,
    create: createTipoIncendio,
    update: updateTipoIncendio,
    remove: deleteTipoIncendio,
  },
  {
    key: 'tipo_propiedad',
    label: 'Tipos de propiedad',
    list: getTiposPropiedad,
    create: createTipoPropiedad,
    update: updateTipoPropiedad,
    remove: deleteTipoPropiedad,
  },
  {
    key: 'causas',
    label: 'Causas',
    list: getCausas,
    create: createCausa,
    update: updateCausa,
    remove: deleteCausa,
  },
  {
    key: 'iniciado_junto_a',
    label: 'Iniciado junto a',
    list: getIniciadoJuntoA,
    create: createIniciadoJuntoA,
    update: updateIniciadoJuntoA,
    remove: deleteIniciadoJuntoA,
  },
  {
    key: 'medios_aereos',
    label: 'Medios aéreos',
    list: getMediosAereos,
    create: createMedioAereo,
    update: updateMedioAereo,
    remove: deleteMedioAereo,
  },
  {
    key: 'medios_terrestres',
    label: 'Medios terrestres',
    list: getMediosTerrestres,
    create: createMedioTerrestre,
    update: updateMedioTerrestre,
    remove: deleteMedioTerrestre,
  },
  {
    key: 'medios_acuaticos',
    label: 'Medios acuáticos',
    list: getMediosAcuaticos,
    create: createMedioAcuatico,
    update: updateMedioAcuatico,
    remove: deleteMedioAcuatico,
  },
  {
    key: 'abastos',
    label: 'Abastos',
    list: getAbastos,
    create: createAbasto,
    update: updateAbasto,
    remove: deleteAbasto,
  },
  {
    key: 'tecnicas_extincion',
    label: 'Técnicas de extinción',
    list: getTecnicasExtincion,
    create: createTecnicaExtincion,
    update: updateTecnicaExtincion,
    remove: deleteTecnicaExtincion,
  },
];

// ---------- Pantalla ----------
export default function CatalogosIndex() {
  const [current, setCurrent] = useState<CatalogConfig>(CATALOGS[0]);
  const [menuVisible, setMenuVisible] = useState(false);

  const [items, setItems] = useState<Opcion[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Opcion | null>(null);
  const [formNombre, setFormNombre] = useState('');

  // Debounce de carga
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (fn: () => void, ms = 150) => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(fn, ms);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const arr = await current.list();
      // orden alfabético por nombre
      setItems([...arr].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message || e?.response?.data?.error || 'No se pudieron cargar los items'
      );
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => {
    schedule(load, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

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
  const openEdit = (it: Opcion) => {
    setEditing(it);
    setFormNombre(it.nombre || '');
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
        await current.update(editing.id, { nombre });
      } else {
        await current.create({ nombre });
      }
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const askDelete = (it: Opcion) => {
    Alert.alert('Eliminar', `¿Eliminar "${it.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => doDelete(it.id) },
    ]);
  };
  const doDelete = async (id: string) => {
    try {
      setLoading(true);
      await current.remove(id);
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
        <Appbar.Content title="Catálogos (Admin)" />
        {/* Selector de catálogo */}
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="format-list-bulleted" onPress={() => setMenuVisible(true)} />}
        >
          {CATALOGS.map(cat => (
            <Menu.Item
              key={cat.key}
              onPress={() => { setCurrent(cat); setMenuVisible(false); }}
              title={cat.label}
              leadingIcon={current.key === cat.key ? 'check' : undefined}
            />
          ))}
        </Menu>

        <Appbar.Action icon="plus" onPress={openCreate} />
      </Appbar.Header>

      {/* “Breadcrumb” del catálogo actual */}
      <View style={styles.currentRow}>
        <Text style={{ marginRight: 8 }}>Catálogo:</Text>
        <Chip icon="folder">{current.label}</Chip>
      </View>

      {/* Búsqueda */}
      <View style={styles.searchBox}>
        <TextInput
          mode="outlined"
          placeholder={`Buscar en ${current.label.toLowerCase()}`}
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando items…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => String(x.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<View style={styles.center}><Text>No hay items</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => openEdit(item)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.nombre}</Text>
                  <Text style={styles.metaText}>ID: {item.id}</Text>
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

      {/* Modal crear/editar item */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={closeModal} contentContainerStyle={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editing ? `Editar item de ${current.label}` : `Nuevo item en ${current.label}`}
          </Text>

          <TextInput
            label="Nombre"
            mode="outlined"
            value={formNombre}
            onChangeText={setFormNombre}
            style={styles.input}
          />
          <HelperText type="info" visible>
            Solo texto; se guardará en el catálogo seleccionado.
          </HelperText>

          <View style={styles.actions}>
            <Button onPress={closeModal} disabled={loading}>Cancelar</Button>
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
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
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
