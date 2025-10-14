import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, TextInput, Chip, Menu, Divider, Button, Snackbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { listIncendios, Incendio, listIncendiosSinAprobar } from '@/services/incendios';
import { getUser } from '@/session';
import { isAdminUser } from '../utils/roles';
import { getCierre } from '@/services/cierre';
import { cierreBadgeStyle, cierreColor } from '@/app/utils/cierre';

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

/* ------------------ tipos filtro ------------------ */
type AprobadoFilter = 'ALL' | 'APROBADOS' | 'NO_APROBADOS';

export default function IncendiosList() {
  const [items, setItems] = useState<Incendio[]>([]);
  const [q, setQ] = useState('');
  const [, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // estados de cierre por incendio_uuid/id
  const [cierreEstados, setCierreEstados] = useState<Record<string, string>>({});

  // filtros UI
  const [aprobFilter, setAprobFilter] = useState<AprobadoFilter>('ALL');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');
  const [estadoMenuVisible, setEstadoMenuVisible] = useState(false);

  // error amigable
  const [errorMsg, setErrorMsg] = useState('');

  // para inicializar el filtro por defecto (solo una vez) cuando sepamos si es admin
  const initRef = useRef(false);

  // throttle / retry
  const lastLoadRef = useRef(0);
  const loadingRef = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (retryRef.current) clearTimeout(retryRef.current); }, []);

  const scheduleRetry = useCallback((ms: number) => {
    if (retryRef.current) return;
    retryRef.current = setTimeout(() => {
      retryRef.current = null;
      safeLoad();
    }, ms);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reportError = useCallback((err: unknown, fallback = 'No se pudieron cargar los incidentes. Intenta de nuevo.') => {
    const anyErr = err as any;
    const status = anyErr?.response?.status;
    const retryAfter = anyErr?.response?.headers?.['retry-after'];

    console.error('[LISTA][ERROR]', {
      status,
      url: anyErr?.config?.url,
      method: anyErr?.config?.method,
      retryAfter,
      data: anyErr?.response?.data,
      message: anyErr?.message,
    });

    let msg =
      anyErr?.response?.data?.error ||
      anyErr?.response?.data?.message ||
      anyErr?.message ||
      fallback;

    if (status === 429) {
      console.warn('[LISTA][RATE_LIMIT]', { retryAfter, url: anyErr?.config?.url });
      const seconds = Number(retryAfter);
      msg = seconds && Number.isFinite(seconds)
        ? `Demasiadas solicitudes. Inténtalo de nuevo en ${seconds} s.`
        : 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
      scheduleRetry(Number.isFinite(seconds) ? Number(seconds) * 1000 : 3000);
    } else if (status === 503) {
      msg = 'Servicio temporalmente no disponible. Inténtalo más tarde.';
    } else if (status === 502) {
      msg = 'Hubo un problema con el servidor. Reintenta en breve.';
    } else if (anyErr?.request && !anyErr?.response) {
      msg = 'Sin respuesta del servidor. Verifica tu conexión.';
    }

    setErrorMsg(String(msg));
  }, [scheduleRetry]);

  const fetchApproved = useCallback(async () => {
    const arr = await listIncendios(1, 50); // aprobados
    return arr || [];
  }, []);

  const fetchPending = useCallback(async () => {
    const pag = await listIncendiosSinAprobar({ page: 1, pageSize: 50 });
    return pag.items || [];
  }, []);

  // carga estados de cierre para el conjunto actual
  const loadCierreEstados = useCallback(async (arr: Incendio[]) => {
    const ids = Array.from(new Set(arr.map((it) => String((it as any).id ?? (it as any).incendio_uuid))));
    if (!ids.length) return;

    const acc: Record<string, string> = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          const c = await getCierre(id);
          if (c && typeof c.estado_cierre === 'string') {
            acc[id] = c.estado_cierre;
          } else {
            const sc = c?.secuencia_control || {};
            const estado = sc?.extinguido_at
              ? 'Extinguido'
              : sc?.controlado_at
              ? 'Controlado'
              : (sc?.llegada_medios_terrestres_at || sc?.llegada_medios_aereos_at)
              ? 'En atención'
              : 'Pendiente';
            acc[id] = estado;
          }
        } catch (e) {
          // no rompas la lista si falla uno
          acc[id] = acc[id] || 'Pendiente';
          const ae = e as any;
          console.warn('[LISTA][getCierre] fallo id', id, ae?.response?.status ?? ae);
        }
      })
    );

    setCierreEstados((prev) => ({ ...prev, ...acc }));
  }, []);

  const safeLoad = useCallback(async () => {
    const now = Date.now();
    if (loadingRef.current || now - lastLoadRef.current < 800) return;

    loadingRef.current = true;
    setRefreshing(true);
    try {
      const u = await getUser();
      setUser(u);
      const admin = isAdminUser(u);

      if (admin && !initRef.current) {
        initRef.current = true;
        setAprobFilter((prev) => (prev === 'ALL' ? 'NO_APROBADOS' : prev));
      }

      let current: Incendio[] = [];
      if (!admin) {
        current = await fetchApproved();
      } else if (aprobFilter === 'NO_APROBADOS') {
        current = await fetchPending();
      } else if (aprobFilter === 'APROBADOS') {
        current = await fetchApproved();
      } else {
        const [approved, pending] = await Promise.all([fetchApproved(), fetchPending()]);
        const map = new Map<string, Incendio>();
        [...pending, ...approved].forEach((it) => map.set(String((it as any).id ?? (it as any).incendio_uuid), it));
        current = Array.from(map.values());
      }

      setItems(current);
      await loadCierreEstados(current);

      setErrorMsg('');
      lastLoadRef.current = Date.now();
    } catch (e) {
      setItems([]);
      reportError(e, 'No se pudieron cargar los incidentes. Intenta de nuevo.');
    } finally {
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [aprobFilter, fetchApproved, fetchPending, loadCierreEstados, reportError]);

  // primera carga + al cambiar filtros
  useEffect(() => { safeLoad(); }, [safeLoad]);

  // al volver al foco de esta pantalla
  useFocusEffect(useCallback(() => { safeLoad(); }, [safeLoad]));

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

  // aplica búsqueda y filtros locales (se mantiene tu filtro por estadoActual)
  const data = useMemo(() => {
    const s = q.trim().toLowerCase();

    return (items || []).filter((it) => {
      if (estadoFilter !== 'TODOS') {
        const nombre = String(it?.estadoActual?.estado?.nombre || '').trim();
        if (nombre !== estadoFilter) return false;
      }

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
  }, [items, q, estadoFilter]);

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
        keyExtractor={(x) => String((x as any).id ?? (x as any).incendio_uuid)}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={safeLoad} />}
        renderItem={({ item }) => {
          const itemId = String((item as any).id ?? (item as any).incendio_uuid);
          const updatedAt = (item as any).creadoEn || (item as any).fechaInicio || item.estadoActual?.fecha || null;
          const aprobado = (item as any)?.aprobado === true;

          const estadoCierre = cierreEstados[itemId];
          const flame = cierreColor(estadoCierre);

          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/incendios/detalles',
                  params: { id: itemId },
                })
              }
            >
              <View style={styles.leftIcon}>
                <Ionicons name="flame" size={28} color={flame} />
              </View>

              <View style={styles.middle}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {item.titulo || 'Sin título'}
                </Text>

                <Text numberOfLines={2} style={styles.rowSub}>
                  {item.descripcion?.trim() || 'Sin descripción'}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <Text style={[styles.badgeMini, aprobado ? styles.badgeOk : styles.badgeWarn]}>
                    {aprobado ? 'Aprobado' : 'No aprobado'}
                  </Text>
                  <Text style={[styles.badgeMini, cierreBadgeStyle(estadoCierre)]}>
                    {estadoCierre ? `Estado: ${estadoCierre}` : 'Cierre: —'}
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

      {/* Error amigable */}
      <Snackbar
        visible={!!errorMsg}
        onDismiss={() => setErrorMsg('')}
        duration={3500}
        action={{ label: 'OK', onPress: () => setErrorMsg('') }}
      >
        {errorMsg}
      </Snackbar>
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
  badgeOk: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  badgeWarn: { backgroundColor: '#FFF3E0', color: '#E65100' },

  // estilos de fallback por si no usas cierreBadgeStyle (dejados por compatibilidad)
  badgeCierreExt: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  badgeCierreCtrl: { backgroundColor: '#E3F2FD', color: '#1565C0' },
  badgeCierreAtn: { backgroundColor: '#FFF3E0', color: '#E65100' },
  badgeCierrePend: { backgroundColor: '#F5F5F5', color: '#616161' },

  right: { width: 120, alignItems: 'flex-end' },
  rightTime: { color: '#666', fontSize: 12 },
});
