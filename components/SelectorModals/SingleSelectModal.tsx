// components/SingleSelectModal.tsx
import React from 'react';
import { Modal, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Button, Checkbox } from 'react-native-paper';

export type SingleSelectOption = { id: number | string; label: string };

type Props = {
  visible: boolean;
  title: string;
  options: SingleSelectOption[];
  value: number | string | null | undefined;
  onSelect: (id: number | string | null) => void;
  onClose: () => void;
  allowClear?: boolean;
  defaultValue?: number | string | null;
};

export default function SingleSelectModal({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  allowClear = true,
  defaultValue = null,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <FlatList
            data={options}
            keyExtractor={(x) => String(x.id)}
            renderItem={({ item }) => {
              const checked = String(value ?? '') === String(item.id);
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Checkbox status={checked ? 'checked' : 'unchecked'} />
                  <Text>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text>No hay opciones</Text>}
          />

          <View style={styles.actions}>
            {allowClear && (
              <Button
                onPress={() => {
                  onSelect(null);
                  onClose();
                }}
              >
                Quitar selección
              </Button>
            )}
            <View style={{ flex: 1 }} />
            {defaultValue !== undefined && defaultValue !== null && (
              <Button
                onPress={() => {
                  onSelect(defaultValue);
                  onClose();
                }}
              >
                Por defecto
              </Button>
            )}
            <Button onPress={onClose}>Cerrar</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, maxHeight: '75%' },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
});
