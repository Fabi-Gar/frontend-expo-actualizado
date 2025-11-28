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
  Card,
  Chip,
  Searchbar,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  CierrePlantilla,
  listPlantillas,
  createPlantilla,
  deletePlantilla,
  activarPlantilla,
} from '../../services/plantillasCierre';

export default function PlantillasCierreAdmin() {
  const [items, setItems] = useState<CierrePlantilla[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal crear
  const [modalVisible, setModalVisible] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (fn: () => void, ms = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, ms);
  };

  // Cargar plantillas
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listPlantillas();
      setItems(data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.code || 'No se pudieron cargar las plantillas');
      setItems([]);
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

  // B�squeda local
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(x =>
      (x.nombre || '').toLowerCase().includes(s) ||
      (x.descripcion || '').toLowerCase().includes(s)
    );
  }, [items, q]);

  // Modal helpers
  const openCreate = () => {
    setFormNombre('');
    setFormDescripcion('');
    setModalVisible(true);
  };

  const openEdit = (item: CierrePlantilla) => {
    if (item.eliminado_en) return;
    router.push(`/admin/editar-plantilla/${item.plantilla_uuid}`);
  };

  const closeModal = () => setModalVisible(false);

  const saveFromModal = async () => {
    const nombre = formNombre.trim();
    if (!nombre) {
      Alert.alert('Validaci�n', 'El nombre es requerido');
      return;
    }
    try {
      setLoading(true);
      await createPlantilla({
        nombre,
        descripcion: formDescripcion.trim() || undefined,
      });
      closeModal();
      await load();
      Alert.alert('Listo', 'Plantilla creada');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.code || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  // Activar plantilla
  const handleActivar = async (item: CierrePlantilla) => {
    if (item.activa) {
      Alert.alert('Info', 'Esta plantilla ya est� activa');
      return;
    }
    Alert.alert(
      'Activar Plantilla',
      `�Activar la plantilla "${item.nombre}"? Esto desactivar� la plantilla actual.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Activar',
          onPress: async () => {
            try {
              setLoading(true);
              await activarPlantilla(item.plantilla_uuid);
              await load();
              Alert.alert('Listo', 'Plantilla activada');
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.code || 'No se pudo activar');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Eliminar
  const askDelete = (item: CierrePlantilla) => {
    if (item.eliminado_en) return;
    if (item.activa) {
      Alert.alert('Error', 'No puedes eliminar la plantilla activa');
      return;
    }
    Alert.alert('Eliminar', `�Eliminar la plantilla "${item.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await deletePlantilla(item.plantilla_uuid);
            await load();
            Alert.alert('Listo', 'Plantilla eliminada');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || e?.response?.data?.code || 'No se pudo eliminar');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small" style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Formularios de Cierre" />
        <Appbar.Action icon="plus" onPress={openCreate} />
      </Appbar.Header>

      {/* Barra de b�squeda */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Buscar formularios"
          value={q}
          onChangeText={setQ}
          style={styles.searchbar}
          icon="magnify"
        />
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.catalogTitle}>Gestión de Formularios</Text>
        <Text style={styles.catalogSubtitle}>
          {filtered.length} {filtered.length === 1 ? 'formulario' : 'formularios'}
        </Text>
      </View>

      {/* Lista de plantillas */}
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={{ marginTop: 8, color: '#666' }}>Cargando&</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.plantilla_uuid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color="#BDBDBD" />
              <Text style={styles.emptyText}>No hay formularios</Text>
              <Text style={styles.emptySubtext}>Toca el bot�n + para crear uno</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isDeleted = !!item.eliminado_en;
            return (
              <Card style={[styles.card, isDeleted && styles.cardDeleted]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => (!isDeleted) && openEdit(item)}
                  disabled={isDeleted}
                >
                  <Card.Content style={styles.cardContent}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <Text style={styles.itemTitle}>{item.nombre}</Text>
                        {item.activa && (
                          <Chip
                            mode="flat"
                            style={styles.activeChip}
                            textStyle={styles.activeChipText}
                            icon="check-circle"
                          >
                            Activa
                          </Chip>
                        )}
                      </View>
                      {item.descripcion && (
                        <Text style={styles.itemDescription}>{item.descripcion}</Text>
                      )}
                      <Text style={styles.itemMeta}>
                        Versión {item.version}
                        {item.creado_en && ` • ${new Date(item.creado_en).toLocaleDateString()}`}
                      </Text>
                      {isDeleted && item.eliminado_en && (
                        <Text style={styles.deletedBadge}>
                          <Ionicons name="trash-outline" size={12} /> Eliminada
                        </Text>
                      )}
                    </View>

                    {!isDeleted && (
                      <View style={styles.actions}>
                        {!item.activa && (
                          <TouchableOpacity
                            onPress={() => handleActivar(item)}
                            style={styles.activateButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => askDelete(item)}
                          style={styles.deleteButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="trash-outline" size={20} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card.Content>
                </TouchableOpacity>
              </Card>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal crear */}
      <Modal visible={modalVisible} onDismiss={closeModal} contentContainerStyle={styles.modalCard}>
        <Text style={styles.modalTitle}>Nuevo Formulario</Text>

        <TextInput
          label="Nombre *"
          mode="outlined"
          value={formNombre}
          onChangeText={setFormNombre}
          style={styles.input}
          autoFocus
        />
        <HelperText type="info" visible>
          Ej: Formulario de Cierre v2.0
        </HelperText>

        <TextInput
          label="Descripci�n (opcional)"
          mode="outlined"
          value={formDescripcion}
          onChangeText={setFormDescripcion}
          style={styles.input}
          multiline
          numberOfLines={3}
        />

        <View style={styles.modalActions}>
          <Button mode="text" onPress={closeModal} disabled={loading}>
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={saveFromModal}
            loading={loading}
            disabled={loading}
            buttonColor="#4CAF50"
          >
            Crear
          </Button>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#4CAF50',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFF',
  },
  searchbar: {
    backgroundColor: '#F5F5F5',
    elevation: 0,
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  catalogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
  },
  catalogSubtitle: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  sep: {
    height: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#757575',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    elevation: 2,
  },
  cardDeleted: {
    opacity: 0.5,
    backgroundColor: '#FAFAFA',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  activeChip: {
    backgroundColor: '#4CAF50',
    height: 28,
    paddingHorizontal: 8,
  },
  activeChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    lineHeight: 16,
  },
  itemDescription: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  itemMeta: {
    fontSize: 13,
    color: '#757575',
    marginTop: 6,
    fontWeight: '500',
  },
  deletedBadge: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  activateButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
  },
  modalCard: {
    marginHorizontal: 24,
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 16,
    color: '#212121',
  },
  input: {
    marginBottom: 4,
    backgroundColor: '#FFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
});
