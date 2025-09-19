import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Text } from 'react-native-paper';

type Item = { id: string | number; title: string; date?: string; text?: string };

export function IncendioDetailsTabs({
  updates,
  info,
  initialTab = 'updates',
  hideEstadoEntries = true,
}: {
  updates: Item[];
  info: Item[];
  initialTab?: 'updates' | 'info';
  hideEstadoEntries?: boolean;
}) {
  const [tab, setTab] = useState<'updates' | 'info'>(initialTab);

  const filteredUpdates = useMemo(() => {
    if (!hideEstadoEntries) return updates;
    return (updates || []).filter(u => {
      const idStarts = typeof u.id === 'string' && u.id.startsWith('estado-');
      const titleStarts = typeof u.title === 'string' && /^estado:/i.test(u.title.trim());
      return !(idStarts || titleStarts);
    });
  }, [updates, hideEstadoEntries]);

  const data = useMemo(
    () => (tab === 'updates' ? filteredUpdates : info),
    [tab, filteredUpdates, info]
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'updates' && styles.tabActive]} onPress={() => setTab('updates')}>
          <Text style={[styles.tabText, tab === 'updates' && styles.tabTextActive]}>Actualizaciones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'info' && styles.tabActive]} onPress={() => setTab('info')}>
          <Text style={[styles.tabText, tab === 'info' && styles.tabTextActive]}>Información</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(x) => String(x.id)}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {!!item.date && <Text style={styles.itemDate}>{item.date}</Text>}
            </View>
            {!!item.text && <Text style={styles.itemText}>{item.text}</Text>}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Sin registros</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  tabBar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#DDD' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#4CAF50' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: '#4CAF50', fontWeight: 'bold' },
  sep: { height: 10 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, elevation: 1, shadowOpacity: 0.05, shadowRadius: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemTitle: { fontWeight: 'bold' },
  itemDate: { color: '#888', fontSize: 12 },
  itemText: { color: '#333' },
  empty: { textAlign: 'center', marginTop: 20, color: '#777' },
});
