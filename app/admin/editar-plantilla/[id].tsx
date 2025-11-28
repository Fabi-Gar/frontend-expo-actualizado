import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Appbar,
  TextInput,
  Text,
  ActivityIndicator,
  Modal,
  Button,
  Card,
  Chip,
  IconButton,
  Divider,
  FAB,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import {
  getPlantilla,
  updatePlantilla,
  CierreSeccion,
  CierreCampo,
  createSeccion,
  updateSeccion,
  deleteSeccion,
  createCampo,
  updateCampo,
  deleteCampo,
} from '../../../services/plantillasCierre';
import CampoOpcionesEditor, { OpcionCampo } from '../../../components/CampoOpcionesEditor';

type PlantillaCompleta = {
  plantilla_uuid: string;
  nombre: string;
  descripcion?: string | null;
  activa: boolean;
  version: number;
  secciones: (CierreSeccion & { campos: CierreCampo[] })[];
};

export default function EditarPlantilla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plantilla, setPlantilla] = useState<PlantillaCompleta | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Modal básico (nombre/descripción)
  const [modalBasico, setModalBasico] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');

  // Modal sección
  const [modalSeccion, setModalSeccion] = useState(false);
  const [editingSeccion, setEditingSeccion] = useState<CierreSeccion | null>(null);
  const [formSeccionNombre, setFormSeccionNombre] = useState('');
  const [formSeccionDesc, setFormSeccionDesc] = useState('');
  const [formSeccionOrden, setFormSeccionOrden] = useState('');

  // Modal campo
  const [modalCampo, setModalCampo] = useState(false);
  const [editingCampo, setEditingCampo] = useState<CierreCampo | null>(null);
  const [currentSeccionUuid, setCurrentSeccionUuid] = useState('');
  const [formCampoNombre, setFormCampoNombre] = useState('');
  const [formCampoDesc, setFormCampoDesc] = useState('');
  const [formCampoTipo, setFormCampoTipo] = useState('text');
  const [formCampoRequerido, setFormCampoRequerido] = useState(false);
  const [formCampoOrden, setFormCampoOrden] = useState('');
  const [formCampoUnidad, setFormCampoUnidad] = useState('');
  const [formCampoPlaceholder, setFormCampoPlaceholder] = useState('');
  const [formCampoOpciones, setFormCampoOpciones] = useState<OpcionCampo[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getPlantilla(id);
      setPlantilla(data);
      setFormNombre(data.nombre || '');
      setFormDescripcion(data.descripcion || '');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo cargar la plantilla');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSection = (seccionUuid: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(seccionUuid)) {
      newExpanded.delete(seccionUuid);
    } else {
      newExpanded.add(seccionUuid);
    }
    setExpandedSections(newExpanded);
  };

  // === PLANTILLA BÁSICA ===
  const openEditBasico = () => {
    setFormNombre(plantilla?.nombre || '');
    setFormDescripcion(plantilla?.descripcion || '');
    setModalBasico(true);
  };

  const saveBasico = async () => {
    if (!plantilla) return;
    const nombre = formNombre.trim();
    if (!nombre) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }
    try {
      setLoading(true);
      await updatePlantilla(plantilla.plantilla_uuid, {
        nombre,
        descripcion: formDescripcion.trim() || undefined,
      });
      setModalBasico(false);
      await load();
      Alert.alert('Listo', 'Plantilla actualizada');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo actualizar');
    } finally {
      setLoading(false);
    }
  };

  // === SECCIONES ===
  const openCreateSeccion = () => {
    setEditingSeccion(null);
    setFormSeccionNombre('');
    setFormSeccionDesc('');
    const maxOrden = plantilla?.secciones?.reduce((max, s) => Math.max(max, s.orden), 0) || 0;
    setFormSeccionOrden(String(maxOrden + 1));
    setModalSeccion(true);
  };

  const openEditSeccion = (seccion: CierreSeccion) => {
    setEditingSeccion(seccion);
    setFormSeccionNombre(seccion.nombre || '');
    setFormSeccionDesc(seccion.descripcion || '');
    setFormSeccionOrden(String(seccion.orden));
    setModalSeccion(true);
  };

  const saveSeccion = async () => {
    if (!plantilla) return;
    const nombre = formSeccionNombre.trim();
    const orden = parseInt(formSeccionOrden, 10);
    if (!nombre || isNaN(orden)) {
      Alert.alert('Validación', 'Nombre y orden son requeridos');
      return;
    }
    try {
      setLoading(true);
      if (editingSeccion) {
        await updateSeccion(editingSeccion.seccion_uuid, {
          nombre,
          descripcion: formSeccionDesc.trim() || undefined,
          orden,
        });
      } else {
        await createSeccion(plantilla.plantilla_uuid, {
          nombre,
          descripcion: formSeccionDesc.trim() || undefined,
          orden,
        });
      }
      setModalSeccion(false);
      await load();
      Alert.alert('Listo', editingSeccion ? 'Sección actualizada' : 'Sección creada');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo guardar la sección');
    } finally {
      setLoading(false);
    }
  };

  const askDeleteSeccion = (seccion: CierreSeccion) => {
    Alert.alert('Eliminar Sección', `¿Eliminar "${seccion.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await deleteSeccion(seccion.seccion_uuid);
            await load();
            Alert.alert('Listo', 'Sección eliminada');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo eliminar');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // === CAMPOS ===
  const openCreateCampo = (seccionUuid: string) => {
    setEditingCampo(null);
    setCurrentSeccionUuid(seccionUuid);
    setFormCampoNombre('');
    setFormCampoDesc('');
    setFormCampoTipo('text');
    setFormCampoRequerido(false);
    setFormCampoUnidad('');
    setFormCampoPlaceholder('');
    setFormCampoOpciones([]);
    const seccion = plantilla?.secciones.find((s) => s.seccion_uuid === seccionUuid);
    const maxOrden = seccion?.campos?.reduce((max, c) => Math.max(max, c.orden), 0) || 0;
    setFormCampoOrden(String(maxOrden + 1));
    setModalCampo(true);
  };

  const openEditCampo = (campo: CierreCampo) => {
    setEditingCampo(campo);
    setCurrentSeccionUuid(campo.seccion_uuid);
    setFormCampoNombre(campo.nombre || '');
    setFormCampoDesc(campo.descripcion || '');
    setFormCampoTipo(campo.tipo || 'text');
    setFormCampoRequerido(campo.requerido || false);
    setFormCampoOrden(String(campo.orden));
    setFormCampoUnidad(campo.unidad || '');
    setFormCampoPlaceholder(campo.placeholder || '');

    // Parsear opciones
    let opciones: OpcionCampo[] = [];
    if (campo.opciones) {
      try {
        if (Array.isArray(campo.opciones)) {
          opciones = campo.opciones.map((opt: any) => {
            if (typeof opt === 'string') {
              return { value: opt, label: opt };
            }
            return opt as OpcionCampo;
          });
        }
      } catch (e) {
        console.error('Error parsing opciones:', e);
      }
    }
    setFormCampoOpciones(opciones);
    setModalCampo(true);
  };

  const saveCampo = async () => {
    const nombre = formCampoNombre.trim();
    const orden = parseInt(formCampoOrden, 10);
    if (!nombre || isNaN(orden)) {
      Alert.alert('Validación', 'Nombre y orden son requeridos');
      return;
    }

    // Validar opciones para select/multiselect
    if ((formCampoTipo === 'select' || formCampoTipo === 'multiselect') && formCampoOpciones.length === 0) {
      Alert.alert('Validación', 'Los campos de tipo select/multiselect requieren al menos una opción');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        nombre,
        descripcion: formCampoDesc.trim() || undefined,
        tipo: formCampoTipo,
        orden,
        requerido: formCampoRequerido,
        unidad: formCampoUnidad.trim() || undefined,
        placeholder: formCampoPlaceholder.trim() || undefined,
      };

      // Agregar opciones si es select o multiselect
      if (formCampoTipo === 'select' || formCampoTipo === 'multiselect') {
        payload.opciones = formCampoOpciones;
      }

      if (editingCampo) {
        await updateCampo(editingCampo.campo_uuid, payload);
      } else {
        await createCampo(currentSeccionUuid, payload);
      }
      setModalCampo(false);
      await load();
      Alert.alert('Listo', editingCampo ? 'Campo actualizado' : 'Campo creado');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo guardar el campo');
    } finally {
      setLoading(false);
    }
  };

  const askDeleteCampo = (campo: CierreCampo) => {
    Alert.alert('Eliminar Campo', `¿Eliminar "${campo.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await deleteCampo(campo.campo_uuid);
            await load();
            Alert.alert('Listo', 'Campo eliminado');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo eliminar');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  if (!plantilla && loading) {
    return (
      <View style={styles.root}>
        <Appbar.Header mode="small" style={styles.header}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Cargando..." />
        </Appbar.Header>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </View>
    );
  }

  if (!plantilla) {
    return (
      <View style={styles.root}>
        <Appbar.Header mode="small" style={styles.header}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Error" />
        </Appbar.Header>
        <View style={styles.center}>
          <Text>No se pudo cargar la plantilla</Text>
        </View>
      </View>
    );
  }

  const tiposCampo = [
    { label: 'Texto', value: 'text' },
    { label: 'Área de texto', value: 'textarea' },
    { label: 'Número', value: 'number' },
    { label: 'Fecha', value: 'date' },
    { label: 'Fecha y hora', value: 'datetime' },
    { label: 'Selección única', value: 'select' },
    { label: 'Selección múltiple', value: 'multiselect' },
    { label: 'Checkbox', value: 'checkbox' },
    { label: 'Porcentaje', value: 'percentage' },
  ];

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small" style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={plantilla.nombre} />
        <Appbar.Action icon="pencil" onPress={openEditBasico} />
      </Appbar.Header>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Información básica */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estado:</Text>
              {plantilla.activa ? (
                <Chip icon="check-circle" style={styles.activeChip} textStyle={styles.activeChipText}>
                  Activa
                </Chip>
              ) : (
                <Chip icon="circle-outline" style={styles.inactiveChip} textStyle={styles.inactiveChipText}>
                  Inactiva
                </Chip>
              )}
            </View>
            {plantilla.descripcion && (
              <Text style={styles.infoDesc}>{plantilla.descripcion}</Text>
            )}
            <Text style={styles.infoMeta}>
              Versión {plantilla.version} • {plantilla.secciones.length} secciones
            </Text>
          </Card.Content>
        </Card>

        {/* Secciones */}
        <View style={styles.sectionsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>Secciones</Text>
            <IconButton icon="plus" size={20} onPress={openCreateSeccion} />
          </View>

          {plantilla.secciones
            .sort((a, b) => a.orden - b.orden)
            .map((seccion) => {
              const isExpanded = expandedSections.has(seccion.seccion_uuid);
              return (
                <Card key={seccion.seccion_uuid} style={styles.seccionCard}>
                  <TouchableOpacity
                    onPress={() => toggleSection(seccion.seccion_uuid)}
                    activeOpacity={0.7}
                  >
                    <Card.Content style={styles.seccionHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.seccionTitleRow}>
                          <Chip style={styles.ordenChip} textStyle={styles.ordenChipText}>
                            {seccion.orden}
                          </Chip>
                          <Text style={styles.seccionTitle}>{seccion.nombre}</Text>
                        </View>
                        {seccion.descripcion && (
                          <Text style={styles.seccionDesc}>{seccion.descripcion}</Text>
                        )}
                        <Text style={styles.seccionMeta}>
                          {seccion.campos?.length || 0} campos
                        </Text>
                      </View>
                      <View style={styles.seccionActions}>
                        <IconButton
                          icon="pencil"
                          size={18}
                          onPress={() => openEditSeccion(seccion)}
                        />
                        <IconButton
                          icon="delete"
                          size={18}
                          iconColor="#F44336"
                          onPress={() => askDeleteSeccion(seccion)}
                        />
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#666"
                        />
                      </View>
                    </Card.Content>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View>
                      <Divider />
                      <Card.Content style={styles.camposContainer}>
                        <View style={styles.camposHeader}>
                          <Text style={styles.camposTitle}>Campos</Text>
                          <IconButton
                            icon="plus"
                            size={16}
                            onPress={() => openCreateCampo(seccion.seccion_uuid)}
                          />
                        </View>

                        {seccion.campos && seccion.campos.length > 0 ? (
                          seccion.campos
                            .sort((a, b) => a.orden - b.orden)
                            .map((campo) => (
                              <View key={campo.campo_uuid} style={styles.campoItem}>
                                <View style={{ flex: 1 }}>
                                  <View style={styles.campoTitleRow}>
                                    <Chip style={styles.ordenChipSmall} textStyle={styles.ordenChipTextSmall}>
                                      {campo.orden}
                                    </Chip>
                                    <Text style={styles.campoName}>{campo.nombre}</Text>
                                    {campo.requerido && (
                                      <Chip
                                        icon="asterisk"
                                        style={styles.requiredChip}
                                        textStyle={styles.requiredChipText}
                                      >
                                        Requerido
                                      </Chip>
                                    )}
                                  </View>
                                  <Text style={styles.campoTipo}>Tipo: {campo.tipo}</Text>
                                  {campo.descripcion && (
                                    <Text style={styles.campoDesc}>{campo.descripcion}</Text>
                                  )}
                                  {campo.unidad && (
                                    <Text style={styles.campoUnidad}>Unidad: {campo.unidad}</Text>
                                  )}
                                  {campo.opciones && Array.isArray(campo.opciones) && campo.opciones.length > 0 && (
                                    <View style={styles.campoOpciones}>
                                      <Text style={styles.campoOpcionesLabel}>
                                        {campo.opciones.length} opción{campo.opciones.length !== 1 ? 'es' : ''}
                                      </Text>
                                      {campo.opciones.some((opt: any) => opt.requiresQuantity || opt.requiresPercentage) && (
                                        <View style={styles.campoOpcionesChips}>
                                          {campo.opciones.some((opt: any) => opt.requiresQuantity) && (
                                            <Chip icon="numeric" style={styles.opcionFeatureChip} textStyle={styles.opcionFeatureChipText} compact>
                                              Con cantidad
                                            </Chip>
                                          )}
                                          {campo.opciones.some((opt: any) => opt.requiresPercentage) && (
                                            <Chip icon="percent" style={styles.opcionFeatureChip} textStyle={styles.opcionFeatureChipText} compact>
                                              Con porcentaje
                                            </Chip>
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  )}
                                </View>
                                <View style={styles.campoActions}>
                                  <IconButton
                                    icon="pencil"
                                    size={16}
                                    onPress={() => openEditCampo(campo)}
                                  />
                                  <IconButton
                                    icon="delete"
                                    size={16}
                                    iconColor="#F44336"
                                    onPress={() => askDeleteCampo(campo)}
                                  />
                                </View>
                              </View>
                            ))
                        ) : (
                          <Text style={styles.emptyCampos}>
                            No hay campos. Toca + para agregar.
                          </Text>
                        )}
                      </Card.Content>
                    </View>
                  )}
                </Card>
              );
            })}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB para agregar sección */}
      <FAB
        icon="plus"
        label="Sección"
        style={styles.fab}
        onPress={openCreateSeccion}
        color="#FFF"
      />

      {/* Modal: Editar básico */}
      <Modal visible={modalBasico} onDismiss={() => setModalBasico(false)} contentContainerStyle={styles.modalCard}>
        <Text style={styles.modalTitle}>Editar Formulario</Text>
        <TextInput
          label="Nombre *"
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
          numberOfLines={3}
        />
        <View style={styles.modalActions}>
          <Button mode="text" onPress={() => setModalBasico(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button mode="contained" onPress={saveBasico} loading={loading} buttonColor="#4CAF50">
            Guardar
          </Button>
        </View>
      </Modal>

      {/* Modal: Sección */}
      <Modal visible={modalSeccion} onDismiss={() => setModalSeccion(false)} contentContainerStyle={styles.modalCard}>
        <Text style={styles.modalTitle}>
          {editingSeccion ? 'Editar Sección' : 'Nueva Sección'}
        </Text>
        <TextInput
          label="Nombre *"
          mode="outlined"
          value={formSeccionNombre}
          onChangeText={setFormSeccionNombre}
          style={styles.input}
        />
        <TextInput
          label="Descripción"
          mode="outlined"
          value={formSeccionDesc}
          onChangeText={setFormSeccionDesc}
          style={styles.input}
          multiline
          numberOfLines={2}
        />
        <TextInput
          label="Orden *"
          mode="outlined"
          value={formSeccionOrden}
          onChangeText={setFormSeccionOrden}
          style={styles.input}
          keyboardType="numeric"
        />
        <View style={styles.modalActions}>
          <Button mode="text" onPress={() => setModalSeccion(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button mode="contained" onPress={saveSeccion} loading={loading} buttonColor="#4CAF50">
            {editingSeccion ? 'Actualizar' : 'Crear'}
          </Button>
        </View>
      </Modal>

      {/* Modal: Campo */}
      <Modal visible={modalCampo} onDismiss={() => setModalCampo(false)} contentContainerStyle={styles.modalCard}>
        <ScrollView nestedScrollEnabled>
          <Text style={styles.modalTitle}>
            {editingCampo ? 'Editar Campo' : 'Nuevo Campo'}
          </Text>
          <TextInput
            label="Nombre *"
            mode="outlined"
            value={formCampoNombre}
            onChangeText={setFormCampoNombre}
            style={styles.input}
          />
          <TextInput
            label="Descripción"
            mode="outlined"
            value={formCampoDesc}
            onChangeText={setFormCampoDesc}
            style={styles.input}
            multiline
            numberOfLines={2}
          />
          <TextInput
            label="Orden *"
            mode="outlined"
            value={formCampoOrden}
            onChangeText={setFormCampoOrden}
            style={styles.input}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Tipo de campo</Text>
          <View style={styles.tipoChips}>
            {tiposCampo.map((tipo) => (
              <Chip
                key={tipo.value}
                selected={formCampoTipo === tipo.value}
                onPress={() => setFormCampoTipo(tipo.value)}
                style={styles.tipoChip}
              >
                {tipo.label}
              </Chip>
            ))}
          </View>

          <View style={styles.checkboxRow}>
            <Chip
              icon={formCampoRequerido ? 'checkbox-marked' : 'checkbox-blank-outline'}
              onPress={() => setFormCampoRequerido(!formCampoRequerido)}
              style={formCampoRequerido ? styles.requiredChip : styles.optionalChip}
            >
              Campo requerido
            </Chip>
          </View>

          {/* Campos adicionales */}
          <TextInput
            label="Placeholder"
            mode="outlined"
            value={formCampoPlaceholder}
            onChangeText={setFormCampoPlaceholder}
            style={styles.input}
            placeholder="ej: Ingrese el valor..."
          />
          <TextInput
            label="Unidad (ej: hectáreas, km/h, °C)"
            mode="outlined"
            value={formCampoUnidad}
            onChangeText={setFormCampoUnidad}
            style={styles.input}
            placeholder="ej: hectáreas"
          />

          {/* Editor de opciones para select/multiselect */}
          {(formCampoTipo === 'select' || formCampoTipo === 'multiselect') && (
            <View style={styles.opcionesSection}>
              <CampoOpcionesEditor
                opciones={formCampoOpciones}
                onChange={setFormCampoOpciones}
              />
            </View>
          )}

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setModalCampo(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={saveCampo} loading={loading} buttonColor="#4CAF50">
              {editingCampo ? 'Actualizar' : 'Crear'}
            </Button>
          </View>
        </ScrollView>
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
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    margin: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  activeChip: {
    backgroundColor: '#4CAF50',
    height: 32,
    paddingHorizontal: 12,
  },
  activeChipText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  inactiveChip: {
    backgroundColor: '#EEEEEE',
    height: 32,
    paddingHorizontal: 12,
  },
  inactiveChipText: {
    fontSize: 13,
    color: '#757575',
    fontWeight: 'bold',
  },
  infoDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  infoMeta: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  sectionsContainer: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
  },
  seccionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  seccionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 8,
  },
  seccionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ordenChip: {
    backgroundColor: '#E3F2FD',
    height: 32,
    minWidth: 32,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ordenChipText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: 'bold',
  },
  seccionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  seccionDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginLeft: 44,
  },
  seccionMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontWeight: '500',
    marginLeft: 44,
  },
  seccionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  camposContainer: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  camposHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  camposTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#424242',
  },
  campoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  campoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  ordenChipSmall: {
    backgroundColor: '#FFF3E0',
    height: 24,
    minWidth: 24,
    justifyContent: 'center',
    marginRight: 8,
  },
  ordenChipTextSmall: {
    fontSize: 12,
    color: '#EF6C00',
    fontWeight: 'bold',
  },
  campoName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginRight: 8,
  },
  requiredChip: {
    backgroundColor: '#FFEBEE',
    height: 24,
    paddingHorizontal: 8,
  },
  requiredChipText: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: '600',
  },
  optionalChip: {
    backgroundColor: '#E0E0E0',
    height: 32,
    paddingHorizontal: 8,
  },
  campoTipo: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
    fontStyle: 'italic',
  },
  campoDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  campoUnidad: {
    fontSize: 13,
    color: '#1976D2',
    marginTop: 4,
    fontWeight: '500',
  },
  campoActions: {
    flexDirection: 'row',
  },
  emptyCampos: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#4CAF50',
  },
  modalCard: {
    marginHorizontal: 16,
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    maxHeight: '85%',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 22,
    marginBottom: 20,
    color: '#212121',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    marginBottom: 12,
  },
  tipoChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  tipoChip: {
    height: 36,
    justifyContent: 'center',
  },
  checkboxRow: {
    marginVertical: 12,
  },
  opcionesSection: {
    marginTop: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  campoOpciones: {
    marginTop: 8,
  },
  campoOpcionesLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  campoOpcionesChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  opcionFeatureChip: {
    backgroundColor: '#FFF3E0',
    height: 24,
  },
  opcionFeatureChipText: {
    fontSize: 10,
    color: '#EF6C00',
  },
});
