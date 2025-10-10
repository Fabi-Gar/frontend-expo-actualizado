import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Button, Checkbox, Searchbar, Chip, ActivityIndicator, Menu } from 'react-native-paper';

export type MultiOption = {
  id: string | number;
  label: string;
  eliminadoEn?: string | null;
};

type Show = 'active' | 'deleted' | 'all';

type Props = {
  visible: boolean;
  title: string;
  options?: MultiOption[];
  value: (number | string)[];
  onChange: (ids: (number | string)[]) => void;
  onClose: () => void;
  allowClear?: boolean;

  // modo remoto (opcional)
  loader?: (params: { q: string; show: Show }) => Promise<MultiOption[]>;
  enableShowFilter?: boolean;
  initialShow?: Show;
  disableDeletedSelection?: boolean;
};

export default function MultiSelectModal({
  visible,
  title,
  options,
  value,
  onChange,
  onClose,
  allowClear = true,
  loader,
  enableShowFilter = false,
  initialShow = 'active',
  disableDeletedSelection = false,
}: Props) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>(initialShow);
  const [menuVisible, setMenuVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [remoteOptions, setRemoteOptions] = useState<MultiOption[]>([]);

  const selected = useMemo(() => new Set(value.map(String)), [value]);

  // Debounce búsqueda
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (fn: () => void, ms = 300) => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(fn, ms);
  };

  // Carga remota si hay loader; si no, usamos options locales
  useEffect(() => {
    if (!loader) return;
    schedule(async () => {
      try {
        setLoading(true);
        const data = await loader({ q, show });
        setRemoteOptions(data || []);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [q, show, loader, visible]);

  // Memoizar la fuente de datos para evitar cambios de deps
  const source: MultiOption[] = useMemo(() => {
    return loader ? remoteOptions : (options || []);
  }, [loader, remoteOptions, options]);

  const filtered = useMemo(() => {
    if (loader) return source; 
    const s = q.trim().toLowerCase();
    if (!s) return source;
    return source.filter((o) => o.label.toLowerCase().includes(s));
  }, [source, q, loader]);

  const toggle = (id: number | string, isDeleted: boolean) => {
    if (isDeleted && disableDeletedSelection) return;
    const next = new Set(selected);
    const key = String(id);

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    onChange(Array.from(next).map((x) => (isNaN(Number(x)) ? x : Number(x))));
  };

  const clearAll = () => onChange([]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>

            {enableShowFilter && (
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <Chip onPress={() => setMenuVisible(true)} icon="filter-variant">
                    {show === 'deleted' ? 'Eliminadas' : show === 'all' ? 'Todas' : 'Activas'}
                  </Chip>
                }
              >
                <Menu.Item title="Activas" onPress={() => { setShow('active'); setMenuVisible(false); }} />
                <Menu.Item title="Eliminadas" onPress={() => { setShow('deleted'); setMenuVisible(false); }} />
                <Menu.Item title="Todas" onPress={() => { setShow('all'); setMenuVisible(false); }} />
              </Menu>
            )}
          </View>

          <Searchbar value={q} onChangeText={setQ} placeholder="Buscar…" style={{ marginBottom: 8 }} />

          {loading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 8 }}>Cargando…</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(x) => String(x.id)}
              renderItem={({ item }) => {
                const idStr = String(item.id);
                const checked = selected.has(idStr);
                const isDeleted = !!item.eliminadoEn;
                return (
                  <TouchableOpacity style={styles.row} onPress={() => toggle(item.id, isDeleted)} activeOpacity={0.8}>
                    <Checkbox status={checked ? 'checked' : 'unchecked'} />
                    <Text style={[isDeleted && { opacity: 0.7 }]}>
                      {item.label}{isDeleted ? ' (Eliminada)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text>No hay opciones</Text>}
              style={{ maxHeight: 360 }}
              keyboardShouldPersistTaps="handled"
            />
          )}

          <View style={styles.actions}>
            {allowClear && <Button onPress={clearAll}>Limpiar</Button>}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
});
