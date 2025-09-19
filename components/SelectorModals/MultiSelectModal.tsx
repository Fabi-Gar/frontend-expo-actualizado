import React, { useMemo, useState } from 'react';
import { Modal, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Button, Checkbox, Searchbar } from 'react-native-paper';

export type MultiOption = { id: number | string; label: string };

type Props = {
  visible: boolean;
  title: string;
  options: MultiOption[];
  value: (number | string)[];
  onChange: (ids: (number | string)[]) => void;
  onClose: () => void;
  allowClear?: boolean;
};

export default function MultiSelectModal({
  visible,
  title,
  options,
  value,
  onChange,
  onClose,
  allowClear = true,
}: Props) {
  const [q, setQ] = useState('');

  const selected = useMemo(() => new Set(value.map(String)), [value]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, q]);

  const toggle = (id: number | string) => {
    const next = new Set(selected);
    const key = String(id);
    // eslint-disable-next-line no-unused-expressions
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(Array.from(next).map((x) => (isNaN(Number(x)) ? x : Number(x))));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <Searchbar value={q} onChangeText={setQ} placeholder="Buscar…" style={{ marginBottom: 8 }} />

          <FlatList
            data={filtered}
            keyExtractor={(x) => String(x.id)}
            renderItem={({ item }) => {
              const checked = selected.has(String(item.id));
              return (
                <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)}>
                  <Checkbox status={checked ? 'checked' : 'unchecked'} />
                  <Text>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text>No hay opciones</Text>}
            style={{ maxHeight: 360 }}
          />

          <View style={styles.actions}>
            {allowClear && (
              <Button onPress={() => onChange([])}>Limpiar</Button>
            )}
            <View style={{ flex: 1 }} />
            <Button onPress={onClose}>Listo</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, maxHeight: '85%' },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
});
