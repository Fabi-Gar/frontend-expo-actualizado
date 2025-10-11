import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, TextInput, Chip, Menu, Divider, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { listIncendios, Incendio } from '@/services/incendios';
import { getUser } from '@/session';
import { isAdminUser } from '../utils/roles';

/* ------------------ helpers ------------------ */
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
  // Si backend manda color, úsalo
  const c = item?.estadoActual?.estado?.color;
  if (typeof c === 'string' && c.trim()) return c;

  const nombre = String(item?.estadoActual?.estado?.nombre || '').toUpperCase();
  if (nombre.includes('ACTIVO')) return '#E53935';      // rojo
  if (nombre.includes('REPOR') || nombre.includes('PEND')) return '#FB8C00'; // naranja
  if (nombre.includes('APAG') || nombre.includes('CERR')) return '#2E7D32';  // verde
  return '#616161'; // gris
}

/* ------------------ tipos filtro ------------------ */
type AprobadoFilter = 'ALL' | 'APROBADOS' | 'NO_APROBADOS';

export default function IncendiosList() {
  const [items, setItems] = useState<Incendio[]>([]);
  const [q, setQ] = useState('');
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // filtros UI
  const [aprobFilter, setAprobFilter] = useState<AprobadoFilter>('ALL');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');
  const [estadoMenuVisible, setEstadoMenuVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const u = await getUser();
      setUser(u);

      const arr = await listIncendios(1, 50); // retorna Incendio[]
      const isAdmin = isAdminUser(u);

      // no-admin: solo aprobados
      const base = isAdmin ? arr : (arr || []).filter((x: any) => (x as any)?.aprobado === true);

      setItems(base || []);
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // estados únicos para el menú (derivados de los items visibles)
  const estadosUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const nombre = String(it?.estadoActual?.estado?.nombre || '').trim();
      if (nombre) set.add(nombre);
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ['TODOS', ...arr];
  }, [items]);

  // aplica búsqueda y filtros
  const data = useMemo(() => {
    const isAdmin = isAdminUser(user);
    const s = q.trim().toLowerCase();

    return (items || [])
      .filter((it) => {
        // filtro por aprobación (solo afecta a admin, porque no-admin ya viene filtrado en load)
        if (isAdmin) {
          const aprobado = (it as any)?.aprobado === true;
          if (aprobFilter === 'APROBADOS' && !aprobado) return false;
          if (aprobFilter === 'NO_APROBADOS' && aprobado) return false;
        }

        // filtro por estado
        if (estadoFilter !== 'TODOS') {
          const nombre = String(it?.estadoActual?.estado?.nombre || '').trim();
          if (nombre !== estadoFilter) return false;
        }

        // búsqueda por texto: título + descripción + región
        if (s) {
          const regionNombre =
            typeof it.region === 'object' && it.region
              ? (it.region as any).nombre || ''
              : typeof it.region === 'string'
              ? it.region
              : '';
          const txt = `${it.titulo || ''} ${it.descripcion || ''} ${regionNombre}`.toLowerCase();
          if (!txt.includes(s)) return false;
        }

        return true;
      });
  }, [items, q, aprobFilter, estadoFilter, user]);

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Incidentes</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar por título, descripción o región"
          mode="flat"
          underlineColor="transparent"
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {/* Filtros */}
      <View style={styles.filtersRow}>
        {/* Aprobación */}
        <Chip
          style={styles.chip}
          selected={aprobFilter === 'ALL'}
          onPress={() => setAprobFilter('ALL')}
          icon="filter-variant"
        >
          {`Aprobación: ${aprobFilter === 'ALL' ? 'Todos' : aprobFilter === 'APROBADOS' ? 'Aprobados' : 'No aprobados'}`}
        </Chip>
        <Chip
          style={styles.chipSmall}
          selected={aprobFilter === 'APROBADOS'}
          onPress={() => setAprobFilter('APROBADOS')}
        >
          Aprobados
        </Chip>
        <Chip
          style={styles.chipSmall}
          selected={aprobFilter === 'NO_APROBADOS'}
          onPress={() => setAprobFilter('NO_APROBADOS')}
        >
          No aprobados
        </Chip>

        {/* Estado (menú) */}
        <Menu
          visible={estadoMenuVisible}
          onDismiss={() => setEstadoMenuVisible(false)}
          anchor={
            <Chip
              style={styles.chip}
              onPress={() => setEstadoMenuVisible(true)}
              icon="flag"
              selected={estadoFilter !== 'TODOS'}
            >
              {`Estado: ${estadoFilter}`}
            </Chip>
          }
        >
          {estadosUnicos.map((nombre, i) => (
            <React.Fragment key={nombre || `opt_${i}`}>
              {i > 0 ? <Divider /> : null}
              <Menu.Item
                onPress={() => {
                  setEstadoFilter(nombre);
                  setEstadoMenuVisible(false);
                }}
                title={nombre || '—'}
              />
            </React.Fragment>
          ))}
          <Divider />
          <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Button onPress={() => { setEstadoFilter('TODOS'); setEstadoMenuVisible(false); }}>
              Limpiar estado
            </Button>
          </View>
        </Menu>
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Listado</Text>
        <Text style={styles.rightHeader}>
          {items.length ? `Total: ${data.length}/${items.length}` : 'Última actualización'}
        </Text>
      </View>

      {/* Lista */}
      <FlatList
        data={data}
        keyExtractor={(x) => String(x.id)}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => {
          const updatedAt = item.creadoEn || item.fechaInicio || item.estadoActual?.fecha || null;
          const aprobado = (item as any)?.aprobado === true;

          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/incendios/detalles',
                  params: { id: String(item.id) },
                })
              }
            >
              <View style={styles.leftIcon}>
                <Ionicons name="flame" size={28} color={flameColor(item)} />
              </View>

              <View style={styles.middle}>
                {/* Título */}
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {item.titulo || 'Sin título'}
                </Text>

                {/* Descripción */}
                <Text numberOfLines={2} style={styles.rowSub}>
                  {item.descripcion?.trim() || 'Sin descripción'}
                </Text>

                {/* Estado y aprobado (pequeño badge texto) */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Text style={styles.badgeMini}>
                    {String(item?.estadoActual?.estado?.nombre || 'Sin estado')}
                  </Text>
                  <Text style={[styles.badgeMini, aprobado ? styles.badgeOk : styles.badgeWarn]}>
                    {aprobado ? 'Aprobado' : 'No aprobado'}
                  </Text>
                </View>
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

/* ------------------ estilos ------------------ */
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

  searchRow: { paddingHorizontal: 16, marginBottom: 6 },
  searchInput: { backgroundColor: '#f3e6ef', borderRadius: 10 },

  filtersRow: {
    paddingHorizontal: 16,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: { backgroundColor: '#F7F7F7' },
  chipSmall: { backgroundColor: '#F7F7F7' },

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

  rowTitle: { fontWeight: 'bold', fontSize: 15, color: '#222' },
  rowSub: { color: '#666', fontSize: 12, marginTop: 2 },

  badgeMini: {
    fontSize: 11,
    color: '#444',
    backgroundColor: '#EEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeOk: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
  },
  badgeWarn: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
  },

  right: { width: 120, alignItems: 'flex-end' },
  rightTime: { color: '#666', fontSize: 12 },
});
