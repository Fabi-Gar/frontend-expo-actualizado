// app/incendios/listaIncendios.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Text, TextInput, Chip, Menu, Divider, Button, Snackbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { listIncendios, listIncendiosSinAprobar, type Incendio } from '@/services/incendios';
import { getUser } from '@/session';
import { isAdminUser } from '../utils/roles';
import { api } from '@/client';
import { cierreBadgeStyle, cierreColor } from '@/app/utils/cierre';
import { getFirstPhotoUrlByIncendio } from '@/services/photos';

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

const PAGE_SIZE = 10;

// id normalizado
const getId = (it: any) => String(it?.id ?? it?.incendio_uuid ?? '');

// creado/actualizado para ordenar
const getWhen = (it: any) =>
  it?.actualizado_en || it?.actualizadoEn || it?.creado_en || it?.creadoEn || it?.estadoActual?.fecha || null;

// Miniatura: intenta varias fuentes del objeto normalizado
const pickDirectThumbFields = (it: any): string | null =>
  it?.thumbnailUrl ||
  it?.portadaUrl ||
  (Array.isArray(it?.fotos) && it.fotos[0]?.url) ||
  (Array.isArray(it?.reportes) && it.reportes[0]?.fotos?.[0]?.url) ||
  null;

/* ------------------ tipos filtro ------------------ */
type AprobadoFilter = 'ALL' | 'APROBADOS' | 'NO_APROBADOS';

export default function IncendiosList() {
  const [items, setItems] = useState<Incendio[]>([]);
  const [q, setQ] = useState('');
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // estados de cierre por incendio_uuid/id (dinámico)
  const [cierreEstados, setCierreEstados] = useState<Record<string, string>>({});

  // cache para covers y estados; in-flight control
  const [covers, setCovers] = useState<Record<string, string>>({});
  const metaCacheRef = useRef<{ estados: Record<string, string>; covers: Record<string, string> }>({
    estados: {},
    covers: {},
  });
  const inFlightCovers = useRef<Map<string, Promise<void>>>(new Map());
  const inFlightEstados = useRef<Set<string>>(new Set());

  // filtros UI
  const [aprobFilter, setAprobFilter] = useState<AprobadoFilter>('ALL');
  const [estadoFilterMenu, setEstadoFilterMenu] = useState(false);
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]); // usando estados de cierre dinámicos

  // paginación
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // error amigable
  const [errorMsg, setErrorMsg] = useState('');

  // para inicializar el filtro por defecto (solo una vez) cuando sepamos si es admin
  const initRef = useRef(false);

  // Rate limiting protection y control de scroll
  const lastRequestTimeRef = useRef<number>(0);
  const lastEndReachedTimeRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);
  const scrollEndTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ==== Rate Limiting Helper ====
  const executeWithRateLimit = useCallback(async (requestFn: () => Promise<any>, minDelay: number = 1000) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    
    if (timeSinceLastRequest < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
    }
    
    lastRequestTimeRef.current = Date.now();
    return requestFn();
  }, []);

  // ==== Control de Scroll ====
  const handleScrollBegin = useCallback(() => {
    isScrollingRef.current = true;
    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
    }
  }, []);

  const handleScrollEnd = useCallback(() => {
    scrollEndTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 500); // 500ms después de que termine el scroll
  }, []);

  // ==== Resolver cover sin duplicados, con cache e Image.prefetch ====
  const resolveCover = useCallback(async (id: string, item: any) => {
    if (!id) return;
    
    // Verificar cache primero
    if (metaCacheRef.current.covers[id]) return;
    
    // Evitar requests duplicados
    if (inFlightCovers.current.has(id)) {
      await inFlightCovers.current.get(id);
      return;
    }

    const p = (async () => {
      // Primero intentar con campos directos del item
      const direct = pickDirectThumbFields(item);
      if (direct) {
        const normalized = encodeURI(direct);
        metaCacheRef.current.covers[id] = normalized;
        setCovers(prev => ({ ...prev, [id]: normalized }));
        Image.prefetch(normalized).catch(() => {});
        return;
      }
      
      // Solo hacer request si no hay thumbnail directo y no estamos scrolleando
      if (isScrollingRef.current) return;
      
      try {
        const url = await executeWithRateLimit(() => getFirstPhotoUrlByIncendio(id));
        if (url) {
          const normalized = encodeURI(url);
          metaCacheRef.current.covers[id] = normalized;
          setCovers(prev => ({ ...prev, [id]: normalized }));
          Image.prefetch(normalized).catch(() => {});
        }
      } catch (error) {
        console.warn(`[COVER] Error loading cover for ${id}:`, error);
      }
    })();

    inFlightCovers.current.set(id, p);
    try {
      await p;
    } finally {
      inFlightCovers.current.delete(id);
    }
  }, [executeWithRateLimit]);

  // Cargar covers de visibles (como markers)
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    // No cargar covers mientras se está scrolleando
    if (isScrollingRef.current) return;

    const visibleIds = new Set(viewableItems.map((v: any) => getId(v?.item)).filter(Boolean));
    
    // Precargar solo los que son visibles y no están en cache
    for (const v of viewableItems || []) {
      const it = v?.item;
      const id = getId(it);
      if (id && !metaCacheRef.current.covers[id] && !inFlightCovers.current.has(id)) {
        resolveCover(id, it);
      }
    }
  });
  
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });

  // ==== Estados por batch (con debounce y deduplicación) ====
  const fetchEstadosBatch = useCallback(async (arr: any[]) => {
    const ids = Array.from(new Set(arr.map(it => getId(it)).filter(Boolean)));
    
    // Filtrar IDs que ya están en cache o en proceso
    const pendientes = ids.filter(id => 
      !(id in metaCacheRef.current.estados) && 
      !inFlightEstados.current.has(id)
    );
    
    if (!pendientes.length) {
      setCierreEstados(prev => ({ ...prev, ...metaCacheRef.current.estados }));
      return;
    }

    // Marcar como en proceso
    pendientes.forEach(id => inFlightEstados.current.add(id));

    try {
      const { data } = await executeWithRateLimit(() => 
        api.get('/cierre/estados', { 
          params: { ids: pendientes.join(',') },
          signal: abortControllerRef.current?.signal
        })
      );
      
      const estados: Record<string, string> = {};
      for (const id of pendientes) {
        const entry = data?.byId?.[id];
        estados[id] = entry?.estado || 'Pendiente';
      }
      
      metaCacheRef.current.estados = { ...metaCacheRef.current.estados, ...estados };
      setCierreEstados(prev => ({ ...prev, ...estados }));
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.warn('[ESTADOS] Error loading estados:', error);
      const estados: Record<string, string> = {};
      for (const id of pendientes) estados[id] = 'Pendiente';
      metaCacheRef.current.estados = { ...metaCacheRef.current.estados, ...estados };
      setCierreEstados(prev => ({ ...prev, ...estados }));
    } finally {
      // Limpiar estados en proceso
      pendientes.forEach(id => inFlightEstados.current.delete(id));
    }
  }, [executeWithRateLimit]);

  // ==== Carga (con paginación de 10) ====
  const fetchApprovedPage = useCallback(async (p: number, signal?: AbortSignal) => {
    try {
      const res = await executeWithRateLimit(() => listIncendios(p, PAGE_SIZE));
      const items = (res as any)?.items ?? res ?? [];
      return items as Incendio[];
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        throw error;
      }
      return [];
    }
  }, [executeWithRateLimit]);

  const fetchPendingPage = useCallback(async (p: number, signal?: AbortSignal) => {
    try {
      const pag = await executeWithRateLimit(() => listIncendiosSinAprobar({ page: p, pageSize: PAGE_SIZE }));
      return (pag?.items ?? []) as Incendio[];
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        throw error;
      }
      return [];
    }
  }, [executeWithRateLimit]);

  // Función específica para cargar TODOS los items (secuencialmente)
  const fetchAllPage = useCallback(async (p: number, signal?: AbortSignal) => {
    try {
      // Cargar aprobados primero
      const approved = await fetchApprovedPage(p, signal);
      
      // Pequeña pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Luego cargar pendientes
      const pending = await fetchPendingPage(p, signal);
      
      // Combinar y ordenar
      const combined = [...approved, ...pending];
      const unique = Array.from(new Map(combined.map(item => [getId(item), item])).values());
      
      // Ordenar por fecha (más reciente primero)
      unique.sort((a, b) => {
        const wa = getWhen(a) ? new Date(getWhen(a) as any).getTime() : 0;
        const wb = getWhen(b) ? new Date(getWhen(b) as any).getTime() : 0;
        return wb - wa;
      });
      
      // Tomar solo PAGE_SIZE elementos
      return unique.slice(0, PAGE_SIZE);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        throw error;
      }
      return [];
    }
  }, [fetchApprovedPage, fetchPendingPage]);

  const reportError = useCallback((err: unknown, fallback = 'No se pudieron cargar los incidentes. Intenta de nuevo.') => {
    const anyErr = err as any;
    
    // Ignorar errores de abort
    if (anyErr?.name === 'AbortError') return;
    
    const status = anyErr?.response?.status;
    const retryAfter = anyErr?.response?.headers?.['retry-after'];

    console.error('[LISTA][ERROR]', {
      status,
      url: anyErr?.config?.url,
      method: anyErr?.config?.method,
      retryAfter,
      message: anyErr?.message,
    });

    let msg =
      anyErr?.response?.data?.error ||
      anyErr?.response?.data?.message ||
      anyErr?.message ||
      fallback;

    if (status === 429) {
      const seconds = Number(retryAfter);
      msg = seconds && Number.isFinite(seconds)
        ? `Demasiadas solicitudes. Inténtalo de nuevo en ${seconds} segundos.`
        : 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
    } else if (status === 503) {
      msg = 'Servicio temporalmente no disponible. Inténtalo más tarde.';
    } else if (status === 502) {
      msg = 'Hubo un problema con el servidor. Reintenta en breve.';
    } else if (anyErr?.request && !anyErr?.response) {
      msg = 'Sin respuesta del servidor. Verifica tu conexión.';
    }

    setErrorMsg(String(msg));
  }, []);

  const mergeUnique = (arrA: any[], arrB: any[]) => {
    const map = new Map<string, any>();
    [...arrA, ...arrB].forEach((it) => map.set(getId(it), it));
    return Array.from(map.values());
  };

  const loadPage = useCallback(async (p: number, reset = false) => {
    if (loadingRef.current) return;
    
    // Cancelar request anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    loadingRef.current = true;
    try {
      const u = user ?? (await getUser().catch(() => null));
      if (!user) setUser(u);
      const admin = isAdminUser(u);
      
      // al entrar por primera vez, si admin → por defecto NO_APROBADOS
      if (admin && !initRef.current) {
        initRef.current = true;
        setAprobFilter((prev) => (prev === 'ALL' ? 'NO_APROBADOS' : prev));
        return; // Salir aquí, el efecto se volverá a ejecutar con el nuevo filtro
      }

      let pageItems: Incendio[] = [];
      
      if (!admin) {
        // no admin → solo aprobados
        pageItems = await fetchApprovedPage(p, abortController.signal);
      } else if (aprobFilter === 'APROBADOS') {
        pageItems = await fetchApprovedPage(p, abortController.signal);
      } else if (aprobFilter === 'NO_APROBADOS') {
        pageItems = await fetchPendingPage(p, abortController.signal);
      } else {
        // ALL: usar la nueva función que carga secuencialmente
        pageItems = await fetchAllPage(p, abortController.signal);
      }

      // Verificar si el request fue cancelado
      if (abortController.signal.aborted) return;

      // set de items + dedupe global
      const next = reset ? pageItems : mergeUnique(items, pageItems);
      
      // ordena por actualizado/creado desc
      next.sort((a, b) => {
        const wa = getWhen(a) ? new Date(getWhen(a) as any).getTime() : 0;
        const wb = getWhen(b) ? new Date(getWhen(b) as any).getTime() : 0;
        return wb - wa;
      });

      setItems(next);
      setHasMore(pageItems.length === PAGE_SIZE);

      // estados y covers para lo nuevo
      await fetchEstadosBatch(pageItems);

      // pre-hidratar solo primeros 6 covers para mejor rendimiento
      next.slice(0, 6).forEach(i => resolveCover(getId(i), i));

      setErrorMsg('');
    } catch (e) {
      if (abortController.signal.aborted) return;
      
      if (reset) setItems([]);
      reportError(e);
    } finally {
      if (!abortController.signal.aborted) {
        loadingRef.current = false;
      }
    }
  }, [aprobFilter, fetchApprovedPage, fetchPendingPage, fetchAllPage, fetchEstadosBatch, items, reportError, resolveCover, user]);

  // primera carga - con dependencias controladas
  useEffect(() => {
    loadPage(1, true);
    setPage(1);
    
    return () => {
      // Cleanup: cancelar requests pendientes al desmontar
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, [aprobFilter]); // Solo dependencia de aprobFilter

  // al volver al foco - con prevención de doble ejecución
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      const refreshData = async () => {
        if (!isActive) return;
        
        // Pequeño delay para evitar conflictos con carga inicial
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!isActive) return;
        
        metaCacheRef.current.estados = {};
        metaCacheRef.current.covers = {};
        setCierreEstados({});
        setCovers({});
        await loadPage(1, true);
        setPage(1);
      };

      refreshData();

      return () => {
        isActive = false;
      };
    }, [loadPage])
  );

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      // Cancelar requests pendientes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      metaCacheRef.current.estados = {};
      metaCacheRef.current.covers = {};
      setCierreEstados({});
      setCovers({});
      await loadPage(1, true);
      setPage(1);
    } finally {
      setRefreshing(false);
    }
  }, [loadPage, refreshing]);

  const onEndReached = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastEndReached = now - lastEndReachedTimeRef.current;
    
    // Prevenir múltiples llamadas rápidas durante el scroll
    if (timeSinceLastEndReached < 2000) { // 2 segundos mínimo entre paginaciones
      return;
    }
    
    if (!hasMore || loadingRef.current || refreshing || isScrollingRef.current) return;
    
    lastEndReachedTimeRef.current = now;
    const next = page + 1;
    await loadPage(next);
    setPage(next);
  }, [hasMore, page, loadPage, refreshing]);

  // Estados disponibles (desde cierreEstados de items visibles)
  const estadosDisponibles = useMemo(() => {
    const ids = items.map(getId).filter(Boolean);
    const list = ids.map(id => cierreEstados[id]).filter(Boolean);
    return Array.from(new Set(list));
  }, [items, cierreEstados]);

  // aplica búsqueda y filtro por estados dinámicos
  const data = useMemo(() => {
    const s = q.trim().toLowerCase();

    return (items || []).filter((it) => {
      const id = getId(it);
      const estado = cierreEstados[id] || 'Pendiente';

      if (selectedEstados.length && !selectedEstados.includes(estado)) return false;

      if (s) {
        const regionNombre =
          typeof (it as any).region === 'object' && (it as any).region
            ? ((it as any).region as any).nombre || ''
            : typeof (it as any).region === 'string'
            ? (it as any).region
            : '';
        const txt = `${(it as any).titulo || ''} ${(it as any).descripcion || ''} ${regionNombre}`.toLowerCase();
        if (!txt.includes(s)) return false;
      }

      return true;
    });
  }, [items, q, selectedEstados, cierreEstados]);

  // Handler para cambio de filtro con reset
  const handleAprobFilterChange = useCallback((newFilter: AprobadoFilter) => {
    setAprobFilter(newFilter);
    setPage(1);
    setItems([]); // Limpiar items inmediatamente para mejor UX
  }, []);

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
          onPress={() => { handleAprobFilterChange('ALL'); }}
          icon="filter-variant"
        >
          {`Aprobación: ${aprobFilter === 'ALL' ? 'Todos' : aprobFilter === 'APROBADOS' ? 'Aprobados' : 'No aprobados'}`}
        </Chip>
        <Chip
          style={styles.chipSmall}
          selected={aprobFilter === 'APROBADOS'}
          onPress={() => { handleAprobFilterChange('APROBADOS'); }}
        >
          Aprobados
        </Chip>
        <Chip
          style={styles.chipSmall}
          selected={aprobFilter === 'NO_APROBADOS'}
          onPress={() => { handleAprobFilterChange('NO_APROBADOS'); }}
        >
          No aprobados
        </Chip>

        {/* Estado (menú dinámico) */}
        <Menu
          visible={estadoFilterMenu}
          onDismiss={() => setEstadoFilterMenu(false)}
          anchor={
            <Chip
              style={styles.chip}
              onPress={() => setEstadoFilterMenu(true)}
              icon="flag"
              selected={selectedEstados.length > 0}
            >
              {selectedEstados.length ? `Estados (${selectedEstados.length})` : 'Estados: Todos'}
            </Chip>
          }
        >
          {estadosDisponibles.map((nombre, i) => (
            <React.Fragment key={nombre || `opt_${i}`}>
              {i > 0 ? <Divider /> : null}
              <Menu.Item
                onPress={() => {
                  setSelectedEstados(prev => {
                    const set = new Set(prev);
                    if (set.has(nombre)) set.delete(nombre);
                    else set.add(nombre);
                    return Array.from(set);
                  });
                }}
                title={nombre || '—'}
                trailingIcon={selectedEstados.includes(nombre) ? 'check' : undefined}
              />
            </React.Fragment>
          ))}
          <Divider />
          <View style={{ paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', gap: 8 }}>
            <Button onPress={() => { setSelectedEstados([]); setEstadoFilterMenu(false); }}>Limpiar</Button>
            <View style={{ flex: 1 }} />
            <Button mode="contained" onPress={() => setEstadoFilterMenu(false)}>Aplicar</Button>
          </View>
        </Menu>
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Listado</Text>
        <Text style={styles.rightHeader}>
          {items.length ? `Mostrando ${data.length} de ${items.length}` : '—'}
        </Text>
      </View>

      {/* Lista */}
      <FlatList
        data={data}
        keyExtractor={(x) => getId(x)}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.8} // Mayor threshold para cargar antes
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollBegin={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        renderItem={({ item }) => {
          const itemId = getId(item);
          const updatedAt = getWhen(item);
          const aprobado = (item as any)?.aprobado === true || (item as any)?.requiere_aprobacion === false;

          const estado = cierreEstados[itemId] || 'Pendiente';
          const flame = cierreColor(estado);

          const cached = covers[itemId] || metaCacheRef.current.covers[itemId] || null;
          const direct = pickDirectThumbFields(item);
          const thumb = cached || (direct ? encodeURI(direct) : null);

          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={() =>
                router.push({ pathname: '/incendios/detalles', params: { id: itemId } })
              }
            >
              <View style={styles.left}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.thumb} />
                ) : (
                  <View style={styles.leftIcon}>
                    <Ionicons name="flame" size={28} color={flame} />
                  </View>
                )}
              </View>

              <View style={styles.middle}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {(item as any).titulo || 'Sin título'}
                </Text>

                <Text numberOfLines={2} style={styles.rowSub}>
                  {(item as any).descripcion?.trim() || 'Sin descripción'}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <Text style={[styles.badgeMini, aprobado ? styles.badgeOk : styles.badgeWarn]}>
                    {aprobado ? 'Aprobado' : 'No aprobado'}
                  </Text>
                  <Text style={[styles.badgeMini, cierreBadgeStyle(estado)]}>
                    {estado ? `Estado: ${estado}` : 'Cierre: —'}
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
            <Text>{loadingRef.current ? 'Cargando...' : 'No hay incidentes'}</Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>Cargando más…</Text>
            </View>
          ) : null
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

  left: { width: 56, height: 56, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#eee' },
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

  right: { width: 120, alignItems: 'flex-end' },
  rightTime: { color: '#666', fontSize: 12 },
});