import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { listIncendios, Incendio } from '../../services/incendios';
import { getUser } from '../../session';

function timeAgo(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '—';
  const diff = Date.now() - d;
  const sec = Math.max(1, Math.floor(diff / 1000));
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `Hace aproximadamente ${days} día${days > 1 ? 's' : ''}`;
  if (hrs > 0) return `Hace aproximadamente ${hrs} hora${hrs > 1 ? 's' : ''}`;
  if (min > 0) return `Hace aproximadamente ${min} minuto${min > 1 ? 's' : ''}`;
  return 'Hace segundos';
}

function flameColor(item: Incendio) {
  const id = item?.estadoActual?.estado?.id;
  if (id === 1) return '#E53935'; // Activo
  if (id === 2) return '#FB8C00'; // Reportado
  if (id === 3) return '#2E7D32'; // Apagado
  return '#616161';
}

export default function IncendiosList() {
  const [items, setItems] = useState<Incendio[]>([]);
  const [q, setQ] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const u = await getUser();
      setUser(u);
      const arr = await listIncendios(1, 50); // ahora ya es Incendio[]
      const isAdmin = u?.rol?.id === 2;
      const visibles = isAdmin ? arr : arr.filter((x) => x.visiblePublico === true);
      setItems(visibles || []);
    } catch {
      setItems([]); // fallback
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => {
      const regionNombre =
        typeof x.region === 'object' && x.region ? (x.region as any).nombre || '' :
        typeof x.region === 'string' ? x.region : '';
      const t = `${x.titulo || ''} ${regionNombre}`.toLowerCase();
      return t.includes(s);
    });
  }, [items, q]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Incidentes</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar incidente"
          mode="flat"
          underlineColor="transparent"
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.title}>Listado</Text>
        <Text style={styles.rightHeader}>
          {items.length ? `Total: ${items.length}` : 'Última actualización'}
        </Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(x) => String(x.id)}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        renderItem={({ item }) => {
          const regionNombre =
            typeof item.region === 'object' && item.region
              ? (item.region as any).nombre || ''
              : typeof item.region === 'string'
              ? item.region
              : '';
          const updatedAt = item.estadoActual?.fecha || item.creadoEn || item.fechaInicio || null;
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={() =>
                router.push({ pathname: '/incendios/detalles', params: { id: String(item.id) } })
              }
            >
              <View style={styles.leftIcon}>
                <Ionicons name="flame" size={28} color={flameColor(item)} />
              </View>
              <View style={styles.middle}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {item.titulo}
                </Text>
                <Text numberOfLines={1} style={styles.rowSub}>
                  {regionNombre || 'Sin región'}
                </Text>
              </View>
              <View style={styles.right}>
                <Text numberOfLines={1} style={styles.rightTime}>
                  {timeAgo(updatedAt as any)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ paddingTop: 32, alignItems: 'center' }}>
            <Text>No hay incidentes</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
    paddingTop: 40,
  },
  backBtn: { padding: 4, marginRight: 8 },
  pageTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  searchRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: { backgroundColor: '#f3e6ef', borderRadius: 10 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  rightHeader: { color: '#666' },
  sep: { height: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  leftIcon: { width: 40, alignItems: 'center' },
  middle: { flex: 1, paddingRight: 10 },
  rowTitle: { fontWeight: 'bold', fontSize: 15 },
  rowSub: { color: '#777', fontSize: 12 },
  right: { width: 150, alignItems: 'flex-end' },
  rightTime: { color: '#666', fontSize: 12 },
});
