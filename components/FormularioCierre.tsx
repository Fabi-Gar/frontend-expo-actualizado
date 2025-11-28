// components/FormularioCierre.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import {
  Appbar,
  Text,
  TextInput,
  Button,
  Checkbox,
  RadioButton,
  ActivityIndicator,
  HelperText,
  Divider,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getFormularioCierre,
  guardarRespuestasCierre,
  finalizarIncendio,
  FormularioCierre as FormularioCierreType,
  CierreCampo,
  RespuestaInput,
  getValorRespuesta,
  crearRespuestaInput,
} from '@/services/cierre';
import { showToast } from '@/hooks/uiStore';

interface Props {
  visible: boolean;
  incendioUuid: string;
  onClose: () => void;
  onSaved: () => void;
  canFinalize?: boolean;
}

export default function FormularioCierre({
  visible,
  incendioUuid,
  onClose,
  onSaved,
  canFinalize = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formulario, setFormulario] = useState<FormularioCierreType | null>(null);
  const [valores, setValores] = useState<Record<string, any>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);

  useEffect(() => {
    if (visible && incendioUuid) {
      cargarFormulario();
    }
  }, [visible, incendioUuid]);

  const cargarFormulario = async () => {
    try {
      setLoading(true);
      const form = await getFormularioCierre(incendioUuid);
      setFormulario(form);

      // Pre-cargar valores existentes
      const valoresIniciales: Record<string, any> = {};
      form.secciones.forEach((seccion) => {
        seccion.campos.forEach((campo) => {
          const valor = getValorRespuesta(campo.respuesta || null, campo.tipo);
          if (valor !== null && valor !== undefined) {
            valoresIniciales[campo.campo_uuid] = valor;
          }
        });
      });
      setValores(valoresIniciales);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error?.message || 'No se pudo cargar el formulario');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async () => {
    try {
      // Validar campos requeridos
      const nuevosErrores: Record<string, string> = {};
      formulario?.secciones.forEach((seccion) => {
        seccion.campos.forEach((campo) => {
          if (campo.requerido && !valores[campo.campo_uuid]) {
            nuevosErrores[campo.campo_uuid] = 'Este campo es requerido';
          }
        });
      });

      if (Object.keys(nuevosErrores).length > 0) {
        setErrores(nuevosErrores);
        showToast({ type: 'error', message: 'Por favor completa los campos requeridos' });
        return;
      }

      setSaving(true);

      // Convertir valores a RespuestaInput
      const respuestas: RespuestaInput[] = [];
      Object.entries(valores).forEach(([campoUuid, valor]) => {
        // Encontrar el tipo del campo
        let tipoCampo = 'texto';
        formulario?.secciones.forEach((seccion) => {
          const campo = seccion.campos.find((c) => c.campo_uuid === campoUuid);
          if (campo) {
            tipoCampo = campo.tipo;
          }
        });

        respuestas.push(crearRespuestaInput(campoUuid, valor, tipoCampo as any));
      });

      await guardarRespuestasCierre(incendioUuid, respuestas);
      showToast({ type: 'success', message: 'Cierre guardado correctamente' });
      onSaved();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error?.message || 'No se pudo guardar el cierre');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizar = async () => {
    Alert.alert(
      'Finalizar incendio',
      '¿Estás seguro de que quieres marcar este incendio como extinguido? Esta acción notificará a todos los seguidores.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await finalizarIncendio(incendioUuid);
              showToast({ type: 'success', message: 'Incendio finalizado' });
              onSaved();
              onClose();
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.error?.message || 'No se pudo finalizar');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const renderCampo = (campo: CierreCampo) => {
    const valor = valores[campo.campo_uuid];
    const error = errores[campo.campo_uuid];

    const actualizarValor = (nuevoValor: any) => {
      setValores((prev) => ({ ...prev, [campo.campo_uuid]: nuevoValor }));
      setErrores((prev) => {
        const newErrors = { ...prev };
        delete newErrors[campo.campo_uuid];
        return newErrors;
      });
    };

    switch (campo.tipo) {
      case 'texto':
        return (
          <View key={campo.campo_uuid} style={styles.campo}>
            <TextInput
              label={campo.nombre + (campo.requerido ? ' *' : '')}
              value={valor || ''}
              onChangeText={actualizarValor}
              error={!!error}
              mode="outlined"
            />
            {campo.descripcion && (
              <HelperText type="info">{campo.descripcion}</HelperText>
            )}
            {error && <HelperText type="error">{error}</HelperText>}
          </View>
        );

      case 'textarea':
        return (
          <View key={campo.campo_uuid} style={styles.campo}>
            <TextInput
              label={campo.nombre + (campo.requerido ? ' *' : '')}
              value={valor || ''}
              onChangeText={actualizarValor}
              error={!!error}
              mode="outlined"
              multiline
              numberOfLines={4}
            />
            {campo.descripcion && (
              <HelperText type="info">{campo.descripcion}</HelperText>
            )}
            {error && <HelperText type="error">{error}</HelperText>}
          </View>
        );

      case 'numero':
        return (
          <View key={campo.campo_uuid} style={styles.campo}>
            <TextInput
              label={campo.nombre + (campo.requerido ? ' *' : '')}
              value={valor?.toString() || ''}
              onChangeText={(text) => {
                const num = parseFloat(text);
                actualizarValor(isNaN(num) ? null : num);
              }}
              keyboardType="numeric"
              error={!!error}
              mode="outlined"
            />
            {campo.descripcion && (
              <HelperText type="info">{campo.descripcion}</HelperText>
            )}
            {error && <HelperText type="error">{error}</HelperText>}
          </View>
        );

      case 'boolean':
        return (
          <View key={campo.campo_uuid} style={styles.campo}>
            <View style={styles.checkboxRow}>
              <Checkbox
                status={valor === true ? 'checked' : 'unchecked'}
                onPress={() => actualizarValor(!valor)}
              />
              <Text>{campo.nombre + (campo.requerido ? ' *' : '')}</Text>
            </View>
            {campo.descripcion && (
              <HelperText type="info">{campo.descripcion}</HelperText>
            )}
            {error && <HelperText type="error">{error}</HelperText>}
          </View>
        );

      case 'fecha':
      case 'datetime':
        return (
          <View key={campo.campo_uuid} style={styles.campo}>
            <Button
              mode="outlined"
              onPress={() => setShowDatePicker(campo.campo_uuid)}
              style={styles.dateButton}
            >
              {valor
                ? new Date(valor).toLocaleDateString()
                : campo.nombre + (campo.requerido ? ' *' : '')}
            </Button>
            {showDatePicker === campo.campo_uuid && (
              <DateTimePicker
                value={valor ? new Date(valor) : new Date()}
                mode={campo.tipo === 'datetime' ? 'datetime' : 'date'}
                onChange={(event, date) => {
                  setShowDatePicker(null);
                  if (date) {
                    actualizarValor(date.toISOString());
                  }
                }}
              />
            )}
            {campo.descripcion && (
              <HelperText type="info">{campo.descripcion}</HelperText>
            )}
            {error && <HelperText type="error">{error}</HelperText>}
          </View>
        );

      case 'select':
        const opciones = Array.isArray(campo.opciones) ? campo.opciones : [];
        // Formato: {value: "camion", quantity: 5, percentage: 20} o "simple-value"
        const valorActual = typeof valor === 'object' ? valor?.value : valor;

        const handleSelectChange = (newValue: string, opcion: any) => {
          if (opcion.requiresQuantity || opcion.requiresPercentage) {
            // Mantener quantity/percentage si ya existía
            const prevQuantity = typeof valor === 'object' ? valor?.quantity : null;
            const prevPercentage = typeof valor === 'object' ? valor?.percentage : null;
            actualizarValor({ value: newValue, quantity: prevQuantity, percentage: prevPercentage });
          } else {
            actualizarValor(newValue);
          }
        };

        const updateSelectQuantity = (quantity: string) => {
          if (typeof valor === 'object') {
            actualizarValor({ ...valor, quantity: quantity ? parseFloat(quantity) : null });
          }
        };

        const updateSelectPercentage = (percentage: string) => {
          if (typeof valor === 'object') {
            actualizarValor({ ...valor, percentage: percentage ? parseFloat(percentage) : null });
          }
        };

        const selectedOpcion = opciones.find((o: any) => {
          const opValue = typeof o === 'string' ? o : o.value || o.id || o.label;
          return opValue === valorActual;
        });

        const requiresQuantity = selectedOpcion?.requiresQuantity || false;
        const requiresPercentage = selectedOpcion?.requiresPercentage || false;
        const quantityLabel = selectedOpcion?.quantityLabel || 'Cantidad';
        const percentageLabel = selectedOpcion?.percentageLabel || 'Porcentaje';

        return (
          <View key={campo.campo_uuid} style={styles.campo}>
            <Text style={styles.label}>{campo.nombre + (campo.requerido ? ' *' : '')}</Text>
            <RadioButton.Group onValueChange={(v) => {
              const opcion = opciones.find((o: any) => {
                const opValue = typeof o === 'string' ? o : o.value || o.id || o.label;
                return opValue === v;
              });
              handleSelectChange(v, opcion || {});
            }} value={valorActual || ''}>
              {opciones.map((opcion: any, idx: number) => {
                const label = typeof opcion === 'string' ? opcion : opcion.label || opcion.nombre;
                const value = typeof opcion === 'string' ? opcion : opcion.value || opcion.id || label;
                return (
                  <View key={idx} style={styles.radioRow}>
                    <RadioButton value={value} />
                    <Text>{label}</Text>
                  </View>
                );
              })}
            </RadioButton.Group>

            {/* Campos adicionales si la opción seleccionada los requiere */}
            {valorActual && (requiresQuantity || requiresPercentage) && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {requiresQuantity && (
                  <TextInput
                    label={quantityLabel}
                    value={valor?.quantity?.toString() || ''}
                    onChangeText={updateSelectQuantity}
                    keyboardType="numeric"
                    mode="outlined"
                    dense
                    style={{ backgroundColor: '#f5f5f5' }}
                  />
                )}
                {requiresPercentage && (
                  <TextInput
                    label={percentageLabel + ' (%)'}
                    value={valor?.percentage?.toString() || ''}
                    onChangeText={updateSelectPercentage}
                    keyboardType="numeric"
                    mode="outlined"
                    dense
                    style={{ backgroundColor: '#f5f5f5' }}
                  />
                )}
              </View>
            )}

            {campo.descripcion && (
              <HelperText type="info">{campo.descripcion}</HelperText>
            )}
            {error && <HelperText type="error">{error}</HelperText>}
          </View>
        );

      case 'multiselect':
        const opcionesMulti = Array.isArray(campo.opciones) ? campo.opciones : [];
        // Formato: [{value: "camion", quantity: 5, percentage: 20}] o ["simple", "values"]
        const valoresSeleccionados = Array.isArray(valor) ? valor : [];

        const getValorItem = (value: string) => {
          const item = valoresSeleccionados.find((v: any) =>
            (typeof v === 'object' ? v.value === value : v === value)
          );
          return item;
        };

        const isSelected = (value: string) => {
          return valoresSeleccionados.some((v: any) =>
            (typeof v === 'object' ? v.value === value : v === value)
          );
        };

        const updateSelection = (value: string, opcion: any) => {
          const seleccionado = isSelected(value);
          let nuevos;

          if (seleccionado) {
            // Deseleccionar
            nuevos = valoresSeleccionados.filter((v: any) =>
              (typeof v === 'object' ? v.value !== value : v !== value)
            );
          } else {
            // Seleccionar - si requiere campos adicionales, crear objeto
            if (opcion.requiresQuantity || opcion.requiresPercentage) {
              nuevos = [...valoresSeleccionados, { value, quantity: null, percentage: null }];
            } else {
              nuevos = [...valoresSeleccionados, value];
            }
          }
          actualizarValor(nuevos);
        };

        const updateQuantity = (value: string, quantity: string) => {
          const nuevos = valoresSeleccionados.map((v: any) => {
            if (typeof v === 'object' && v.value === value) {
              return { ...v, quantity: quantity ? parseFloat(quantity) : null };
            }
            return v;
          });
          actualizarValor(nuevos);
        };

        const updatePercentage = (value: string, percentage: string) => {
          const nuevos = valoresSeleccionados.map((v: any) => {
            if (typeof v === 'object' && v.value === value) {
              return { ...v, percentage: percentage ? parseFloat(percentage) : null };
            }
            return v;
          });
          actualizarValor(nuevos);
        };

        return (
          <View key={campo.campo_uuid} style={styles.campo}>
            <Text style={styles.label}>{campo.nombre + (campo.requerido ? ' *' : '')}</Text>
            {opcionesMulti.map((opcion: any, idx: number) => {
              const label = typeof opcion === 'string' ? opcion : opcion.label || opcion.nombre;
              const value = typeof opcion === 'string' ? opcion : opcion.value || opcion.id || label;
              const seleccionado = isSelected(value);
              const valorItem = getValorItem(value);
              const requiresQuantity = opcion.requiresQuantity || false;
              const requiresPercentage = opcion.requiresPercentage || false;
              const quantityLabel = opcion.quantityLabel || 'Cantidad';
              const percentageLabel = opcion.percentageLabel || 'Porcentaje';

              return (
                <View key={idx} style={{ marginBottom: 12 }}>
                  <View style={styles.checkboxRow}>
                    <Checkbox
                      status={seleccionado ? 'checked' : 'unchecked'}
                      onPress={() => updateSelection(value, opcion)}
                    />
                    <Text>{label}</Text>
                  </View>

                  {/* Campos adicionales si está seleccionado */}
                  {seleccionado && (requiresQuantity || requiresPercentage) && (
                    <View style={{ marginLeft: 40, marginTop: 8, gap: 8 }}>
                      {requiresQuantity && (
                        <TextInput
                          label={quantityLabel}
                          value={valorItem?.quantity?.toString() || ''}
                          onChangeText={(text) => updateQuantity(value, text)}
                          keyboardType="numeric"
                          mode="outlined"
                          dense
                          style={{ backgroundColor: '#f5f5f5' }}
                        />
                      )}
                      {requiresPercentage && (
                        <TextInput
                          label={percentageLabel + ' (%)'}
                          value={valorItem?.percentage?.toString() || ''}
                          onChangeText={(text) => updatePercentage(value, text)}
                          keyboardType="numeric"
                          mode="outlined"
                          dense
                          style={{ backgroundColor: '#f5f5f5' }}
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
            {campo.descripcion && (
              <HelperText type="info">{campo.descripcion}</HelperText>
            )}
            {error && <HelperText type="error">{error}</HelperText>}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Appbar.Header>
          <Appbar.BackAction onPress={onClose} />
          <Appbar.Content title="Formulario de cierre" />
        </Appbar.Header>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 16 }}>Cargando formulario...</Text>
          </View>
        ) : formulario ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {formulario.extinguido && (
              <View style={styles.alertExtinguido}>
                <Text style={styles.alertText}>✓ Este incendio está extinguido</Text>
              </View>
            )}

            <Text style={styles.plantillaNombre}>{formulario.plantilla.nombre}</Text>
            {formulario.plantilla.descripcion && (
              <Text style={styles.plantillaDesc}>{formulario.plantilla.descripcion}</Text>
            )}

            {formulario.secciones.map((seccion) => (
              <View key={seccion.seccion_uuid} style={styles.seccion}>
                <Text style={styles.seccionNombre}>{seccion.nombre}</Text>
                {seccion.descripcion && (
                  <Text style={styles.seccionDesc}>{seccion.descripcion}</Text>
                )}
                <Divider style={{ marginVertical: 8 }} />
                {seccion.campos.map(renderCampo)}
              </View>
            ))}

            <View style={styles.actions}>
              <Button mode="contained" onPress={handleGuardar} loading={saving} disabled={saving}>
                Guardar cambios
              </Button>

              {canFinalize && !formulario.extinguido && (
                <Button
                  mode="outlined"
                  onPress={handleFinalizar}
                  loading={saving}
                  disabled={saving}
                  style={{ marginTop: 12 }}
                  textColor="#C62828"
                >
                  Marcar como extinguido
                </Button>
              )}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  alertExtinguido: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  alertText: { color: '#2E7D32', fontWeight: 'bold' },
  plantillaNombre: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  plantillaDesc: { fontSize: 14, color: '#666', marginBottom: 16 },
  seccion: { marginBottom: 24 },
  seccionNombre: { fontSize: 16, fontWeight: 'bold', color: '#37474F' },
  seccionDesc: { fontSize: 13, color: '#666', marginTop: 4 },
  campo: { marginVertical: 8 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dateButton: { justifyContent: 'flex-start' },
  actions: { marginTop: 16 },
});
