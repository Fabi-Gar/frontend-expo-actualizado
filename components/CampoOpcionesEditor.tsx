// components/CampoOpcionesEditor.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Chip,
  Divider,
  Card,
} from 'react-native-paper';

export type OpcionCampo = {
  value: string;
  label: string;
  requiresQuantity?: boolean;
  requiresPercentage?: boolean;
  quantityLabel?: string;
  percentageLabel?: string;
};

interface Props {
  opciones: OpcionCampo[];
  onChange: (opciones: OpcionCampo[]) => void;
}

export default function CampoOpcionesEditor({ opciones, onChange }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formValue, setFormValue] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formRequiresQuantity, setFormRequiresQuantity] = useState(false);
  const [formRequiresPercentage, setFormRequiresPercentage] = useState(false);
  const [formQuantityLabel, setFormQuantityLabel] = useState('');
  const [formPercentageLabel, setFormPercentageLabel] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);

  const resetForm = () => {
    setFormValue('');
    setFormLabel('');
    setFormRequiresQuantity(false);
    setFormRequiresPercentage(false);
    setFormQuantityLabel('');
    setFormPercentageLabel('');
    setEditingIndex(null);
    setIsFormVisible(false);
  };

  const handleAdd = () => {
    resetForm();
    setEditingIndex(null);
    setIsFormVisible(true);
  };

  const handleEdit = (index: number) => {
    const opcion = opciones[index];
    setFormValue(opcion.value);
    setFormLabel(opcion.label);
    setFormRequiresQuantity(opcion.requiresQuantity || false);
    setFormRequiresPercentage(opcion.requiresPercentage || false);
    setFormQuantityLabel(opcion.quantityLabel || '');
    setFormPercentageLabel(opcion.percentageLabel || '');
    setEditingIndex(index);
    setIsFormVisible(true);
  };

  const handleSave = () => {
    const value = formValue.trim();
    const label = formLabel.trim();

    if (!value || !label) {
      Alert.alert('Validación', 'Value y Label son requeridos');
      return;
    }

    // Verificar duplicados (excepto si estamos editando la misma opción)
    const isDuplicate = opciones.some(
      (opt, idx) => opt.value === value && idx !== editingIndex
    );
    if (isDuplicate) {
      Alert.alert('Validación', 'Ya existe una opción con ese value');
      return;
    }

    const newOpcion: OpcionCampo = {
      value,
      label,
    };

    if (formRequiresQuantity) {
      newOpcion.requiresQuantity = true;
      newOpcion.quantityLabel = formQuantityLabel.trim() || 'Cantidad';
    }

    if (formRequiresPercentage) {
      newOpcion.requiresPercentage = true;
      newOpcion.percentageLabel = formPercentageLabel.trim() || 'Porcentaje';
    }

    if (editingIndex !== null) {
      // Editar
      const updated = [...opciones];
      updated[editingIndex] = newOpcion;
      onChange(updated);
    } else {
      // Agregar
      onChange([...opciones, newOpcion]);
    }

    resetForm();
  };

  const handleDelete = (index: number) => {
    Alert.alert('Eliminar Opción', '¿Eliminar esta opción?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          const updated = opciones.filter((_, i) => i !== index);
          onChange(updated);
          if (editingIndex === index) {
            resetForm();
          }
        },
      },
    ]);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...opciones];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const moveDown = (index: number) => {
    if (index === opciones.length - 1) return;
    const updated = [...opciones];
    [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
    onChange(updated);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Opciones del campo</Text>
        <Button
          mode="outlined"
          icon="plus"
          onPress={handleAdd}
          compact
          style={styles.addButton}
        >
          Agregar
        </Button>
      </View>

      {/* Lista de opciones existentes */}
      <ScrollView style={styles.list} nestedScrollEnabled>
        {opciones.length === 0 && (
          <Text style={styles.emptyText}>
            No hay opciones. Toca Agregar para crear una.
          </Text>
        )}

        {opciones.map((opcion, index) => {
          const isEditing = editingIndex === index && isFormVisible;
          return (
            <Card
              key={index}
              style={[styles.opcionCard, isEditing && styles.opcionCardEditing]}
            >
              <Card.Content style={styles.opcionContent}>
                <View style={styles.opcionInfo}>
                  <View style={styles.opcionRow}>
                    <Chip style={styles.indexChip} textStyle={styles.indexChipText}>
                      {index + 1}
                    </Chip>
                    <Text style={styles.opcionLabel}>{opcion.label}</Text>
                  </View>
                  <Text style={styles.opcionValue}>value: {opcion.value}</Text>
                  {opcion.requiresQuantity && (
                    <Chip
                      icon="numeric"
                      style={styles.featureChip}
                      textStyle={styles.featureChipText}
                      compact
                    >
                      {opcion.quantityLabel || 'Cantidad'}
                    </Chip>
                  )}
                  {opcion.requiresPercentage && (
                    <Chip
                      icon="percent"
                      style={styles.featureChip}
                      textStyle={styles.featureChipText}
                      compact
                    >
                      {opcion.percentageLabel || 'Porcentaje'}
                    </Chip>
                  )}
                </View>
                <View style={styles.opcionActions}>
                  <IconButton
                    icon="arrow-up"
                    size={16}
                    onPress={() => moveUp(index)}
                    disabled={index === 0}
                  />
                  <IconButton
                    icon="arrow-down"
                    size={16}
                    onPress={() => moveDown(index)}
                    disabled={index === opciones.length - 1}
                  />
                  <IconButton
                    icon="pencil"
                    size={16}
                    onPress={() => handleEdit(index)}
                  />
                  <IconButton
                    icon="delete"
                    size={16}
                    iconColor="#F44336"
                    onPress={() => handleDelete(index)}
                  />
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {/* Formulario de edición/creación */}
      {isFormVisible && (
        <View style={styles.form}>
          <Divider style={styles.divider} />
          <Text style={styles.formTitle}>
            {editingIndex !== null ? 'Editar Opción' : 'Nueva Opción'}
          </Text>

          <TextInput
            label="Value (identificador único) *"
            mode="outlined"
            value={formValue}
            onChangeText={setFormValue}
            style={styles.input}
            dense
            placeholder="ej: camion_cisterna"
          />

          <TextInput
            label="Label (texto visible) *"
            mode="outlined"
            value={formLabel}
            onChangeText={setFormLabel}
            style={styles.input}
            dense
            placeholder="ej: Camión Cisterna"
          />

          {/* Requiere Cantidad */}
          <View style={styles.checkboxContainer}>
            <Chip
              icon={formRequiresQuantity ? 'checkbox-marked' : 'checkbox-blank-outline'}
              onPress={() => setFormRequiresQuantity(!formRequiresQuantity)}
              style={formRequiresQuantity ? styles.checkedChip : styles.uncheckedChip}
            >
              Requiere cantidad
            </Chip>
          </View>

          {formRequiresQuantity && (
            <TextInput
              label="Etiqueta para cantidad"
              mode="outlined"
              value={formQuantityLabel}
              onChangeText={setFormQuantityLabel}
              style={styles.input}
              dense
              placeholder="ej: Número de camiones"
            />
          )}

          {/* Requiere Porcentaje */}
          <View style={styles.checkboxContainer}>
            <Chip
              icon={formRequiresPercentage ? 'checkbox-marked' : 'checkbox-blank-outline'}
              onPress={() => setFormRequiresPercentage(!formRequiresPercentage)}
              style={formRequiresPercentage ? styles.checkedChip : styles.uncheckedChip}
            >
              Requiere porcentaje
            </Chip>
          </View>

          {formRequiresPercentage && (
            <TextInput
              label="Etiqueta para porcentaje"
              mode="outlined"
              value={formPercentageLabel}
              onChangeText={setFormPercentageLabel}
              style={styles.input}
              dense
              placeholder="ej: % del área afectada"
            />
          )}

          <View style={styles.formActions}>
            <Button mode="text" onPress={resetForm}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={handleSave} buttonColor="#4CAF50">
              {editingIndex !== null ? 'Actualizar' : 'Agregar'}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 500,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#424242',
  },
  addButton: {
    borderColor: '#4CAF50',
  },
  list: {
    maxHeight: 200,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  opcionCard: {
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  opcionCardEditing: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#F1F8E9',
  },
  opcionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  opcionInfo: {
    flex: 1,
  },
  opcionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  indexChip: {
    backgroundColor: '#E3F2FD',
    height: 24,
    marginRight: 8,
  },
  indexChipText: {
    fontSize: 11,
    color: '#1976D2',
    fontWeight: 'bold',
  },
  opcionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    flex: 1,
  },
  opcionValue: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  featureChip: {
    backgroundColor: '#FFF3E0',
    marginTop: 4,
    marginRight: 4,
    height: 24,
  },
  featureChipText: {
    fontSize: 10,
    color: '#EF6C00',
  },
  opcionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    marginVertical: 16,
  },
  form: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 12,
  },
  input: {
    marginBottom: 10,
    backgroundColor: '#FFF',
  },
  checkboxContainer: {
    marginVertical: 8,
  },
  checkedChip: {
    backgroundColor: '#4CAF50',
  },
  uncheckedChip: {
    backgroundColor: '#E0E0E0',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
});
