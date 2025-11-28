// app/incendios/listaIncendios.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Text, TextInput, Chip, Snackbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { listIncendios, listIncendiosSinAprobar, type Incendio } from '@/services/incendios';
import { getUser } from '@/session';
import { isAdminUser } from '../utils/roles';
import { api } from '@/client';
import { getFirstPhotoUrlByIncendio } from '@/services/photos';
import { cierreColor, cierreBadgeStyle } from '@/app/utils/estadoCierre';

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
  const [debouncedQ, setDebouncedQ] = useState('');
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // cache para covers y estados; in-flight control
  const [cierreEstados, setCierreEstados] = useState<Record<string, string>>({});
  const [covers, setCovers] = useState<Record<string, string>>({});
  const metaCacheRef = useRef<{
    estados: Record<string, string>;
    covers: Record<string, string>;
    fetchingEstados: boolean;
  }>({
    estados: {},
    covers: {},
    fetchingEstados: false,
  });
  const inFlightCovers = useRef<Map<string, Promise<void>>>(new Map());
  const inFlightEstados = useRef<Set<string>>(new Set());

  // filtros UI
  const [aprobFilter, setAprobFilter] = useState<AprobadoFilter>('ALL');

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
  const isMountedRef = useRef<boolean>(true);

  // ==== Debounce búsqueda ====
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

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
      scrollEndTimerRef.current = null;
    }
  }, []);

  const handleScrollEnd = useCallback(() => {
    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
    }
    scrollEndTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 500);
  }, []);

  // ==== Resolver cover sin duplicados, con cache e Image.prefetch ====
  const resolveCover = useCallback(async (id: string, item: any) => {
    if (!id || !isMountedRef.current) return;
    
    try {
      // Verificar cache primero
      if (metaCacheRef.current.covers[id]) return;
      
      // Evitar requests duplicados
      if (inFlightCovers.current.has(id)) {
        await inFlightCovers.current.get(id);
        return;
      }

      const p = (async () => {
        try {
          // Primero intentar con campos directos del item
          const direct = pickDirectThumbFields(item);
          if (direct) {
            const normalized = encodeURI(direct);
            metaCacheRef.current.covers[id] = normalized;
            if (isMountedRef.current) {
              setCovers(prev => ({ ...prev, [id]: normalized }));
            }
            Image.prefetch(normalized).catch(() => {});
            return;
          }
          
          // Solo hacer request si no hay thumbnail directo y no estamos scrolleando
          if (isScrollingRef.current || !isMountedRef.current) return;
          
          const url = await executeWithRateLimit(() => getFirstPhotoUrlByIncendio(id), 1500);
          if (url && isMountedRef.current) {
            const normalized = encodeURI(url);
            metaCacheRef.current.covers[id] = normalized;
            setCovers(prev => ({ ...prev, [id]: normalized }));
            Image.prefetch(normalized).catch(() => {});
          }
        } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.warn(`[COVER] Error loading cover for ${id}:`, error?.message);
        }
      })();

      inFlightCovers.current.set(id, p);
      try {
        await p;
      } finally {
        inFlightCovers.current.delete(id);
      }
    } catch (error) {
      console.error('[resolveCover] Error:', error);
    }
  }, [executeWithRateLimit]);

  // Cargar covers de visibles (como markers)
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    try {
      // No cargar covers mientras se está scrolleando
      if (isScrollingRef.current || !isMountedRef.current) return;

      // Precargar solo los que son visibles y no están en cache
      for (const v of viewableItems || []) {
        const it = v?.item;
        if (!it) continue;
        
        const id = getId(it);
        if (id && !metaCacheRef.current.covers[id] && !inFlightCovers.current.has(id)) {
          resolveCover(id, it).catch(err => {
            console.error('[onViewableItemsChanged] Error:', err);
          });
        }
      }
    } catch (error) {
      console.error('[onViewableItemsChanged] Error:', error);
    }
  });
  
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });


  // ==== Estados por batch (con debounce y deduplicación) ====
  const fetchEstadosBatch = useCallback(async (arr: any[]) => {
    if (!isMountedRef.current || metaCacheRef.current.fetchingEstados) {
      console.log('[fetchEstadosBatch] Evitando fetch duplicado');
      return;
    }

    try {
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
      metaCacheRef.current.fetchingEstados = true;
      pendientes.forEach(id => inFlightEstados.current.add(id));

      const { data } = await executeWithRateLimit(() =>
        api.get('/api/cierre/estados', {
          params: { ids: pendientes.join(',') },
          signal: abortControllerRef.current?.signal,
          timeout: 10000,
        }),
        1200
      );

      if (!isMountedRef.current) return;

      const estados: Record<string, string> = {};
      for (const id of pendientes) {
        const entry = data?.byId?.[id];
        estados[id] = entry?.estado || 'Reportado';
      }

      metaCacheRef.current.estados = { ...metaCacheRef.current.estados, ...estados };
      setCierreEstados(prev => ({ ...prev, ...estados }));
    } catch (error: any) {
      if (error.name === 'AbortError') return;

      console.warn('[ESTADOS] Error loading estados:', error?.message);

      if (!isMountedRef.current) return;

      const ids = Array.from(new Set(arr.map(it => getId(it)).filter(Boolean)));
      const pendientes = ids.filter(id => !(id in metaCacheRef.current.estados));

      const estados: Record<string, string> = {};
      for (const id of pendientes) estados[id] = 'Reportado';

      metaCacheRef.current.estados = { ...metaCacheRef.current.estados, ...estados };
      setCierreEstados(prev => ({ ...prev, ...estados }));
    } finally {
      metaCacheRef.current.fetchingEstados = false;
      // Limpiar estados en proceso
      const ids = Array.from(new Set(arr.map(it => getId(it)).filter(Boolean)));
      ids.forEach(id => inFlightEstados.current.delete(id));
    }
  }, [executeWithRateLimit]);

  // ==== Carga (con paginación de 10) ====
  const fetchApprovedPage = useCallback(async (p: number, signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return [];
      
      const res = await executeWithRateLimit(() => listIncendios(p, PAGE_SIZE));
      
      if (signal?.aborted) return [];
      
      const items = (res as any)?.items ?? res ?? [];
      return items as Incendio[];
    } catch (error: any) {
      if (error.name === 'AbortError') return [];
      throw error;
    }
  }, [executeWithRateLimit]);

  const fetchPendingPage = useCallback(async (p: number, signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return [];
      
      const pag = await executeWithRateLimit(() => 
        listIncendiosSinAprobar({ page: p, pageSize: PAGE_SIZE })
      );
      
      if (signal?.aborted) return [];
      
      return (pag?.items ?? []) as Incendio[];
    } catch (error: any) {
      if (error.name === 'AbortError') return [];
      throw error;
    }
  }, [executeWithRateLimit]);

  // Función específica para cargar TODOS los items (secuencialmente)
  const fetchAllPage = useCallback(async (p: number, signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return [];
      
      // Cargar aprobados primero
      const approved = await fetchApprovedPage(p, signal);
      
      if (signal?.aborted) return [];
      
      // Pequeña pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (signal?.aborted) return [];
      
      // Luego cargar pendientes
      const pending = await fetchPendingPage(p, signal);
      
      if (signal?.aborted) return [];
      
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
      if (error.name === 'AbortError') return [];
      throw error;
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

    if (isMountedRef.current) {
      setErrorMsg(String(msg));
    }
  }, []);

  const mergeUnique = useCallback((arrA: any[], arrB: any[]) => {
    try {
      const map = new Map<string, any>();
      [...arrA, ...arrB].forEach((it) => {
        const id = getId(it);
        if (id) map.set(id, it);
      });
      return Array.from(map.values());
    } catch (error) {
      console.error('[mergeUnique] Error:', error);
      return arrA;
    }
  }, []);

  // Ref para mantener items actuales sin causar re-renders
  const itemsRef = useRef<Incendio[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadPage = useCallback(async (p: number, reset = false) => {
    if (loadingRef.current) {
      console.log('[loadPage] Ya hay una carga en progreso, ignorando');
      return;
    }
    
    if (!isMountedRef.current) {
      console.log('[loadPage] Componente desmontado, ignorando');
      return;
    }
    
    // Cancelar request anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    loadingRef.current = true;
    
    try {
      const u = user ?? (await getUser().catch(() => null));
      if (!user && isMountedRef.current) setUser(u);
      
      const admin = isAdminUser(u);

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
      if (abortController.signal.aborted) {
        console.log('[loadPage] Request abortado');
        return;
      }
      
      if (!isMountedRef.current) {
        console.log('[loadPage] Componente desmontado después de fetch');
        return;
      }

      // set de items + dedupe global usando itemsRef
      const currentItems = reset ? [] : itemsRef.current;
      const next = reset ? pageItems : mergeUnique(currentItems, pageItems);
      
      // ordena por actualizado/creado desc
      next.sort((a, b) => {
        const wa = getWhen(a) ? new Date(getWhen(a) as any).getTime() : 0;
        const wb = getWhen(b) ? new Date(getWhen(b) as any).getTime() : 0;
        return wb - wa;
      });

      if (isMountedRef.current) {
        setItems(next);
        setHasMore(pageItems.length === PAGE_SIZE);
      }

      // estados y covers para lo nuevo
      if (pageItems.length > 0 && isMountedRef.current) {
        await fetchEstadosBatch(pageItems);

        // pre-hidratar solo primeros 6 covers para mejor rendimiento
        const firstSix = next.slice(0, 6);
        for (const item of firstSix) {
          if (!isMountedRef.current) break;
          const id = getId(item);
          if (id) {
            resolveCover(id, item).catch(err => {
              console.error('[loadPage] Error resolviendo cover:', err);
            });
          }
        }
      }

      if (isMountedRef.current) {
        setErrorMsg('');
      }
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.name === 'CanceledError') {
        console.log('[loadPage] Fetch cancelado');
        return;
      }
      
      if (!isMountedRef.current) {
        console.log('[loadPage] Error ignorado - componente desmontado');
        return;
      }
      
      if (reset && isMountedRef.current) {
        setItems([]);
      }
      reportError(e);
    } finally {
      // CRÍTICO: Siempre limpiar el flag, incluso si fue abortado
      loadingRef.current = false;
      
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [
    aprobFilter,
    fetchApprovedPage,
    fetchPendingPage,
    fetchAllPage,
    fetchEstadosBatch,
    reportError,
    resolveCover,
    user,
    mergeUnique
  ]); // ✅ Removido 'items' de dependencias

  // Inicialización del filtro para admins (solo una vez)
  useEffect(() => {
    if (!user) return;
    
    const admin = isAdminUser(user);
    if (admin && !initRef.current) {
      initRef.current = true;
      if (aprobFilter === 'ALL') {
        setAprobFilter('NO_APROBADOS');
        return; // El cambio de filtro disparará la carga
      }
    }
  }, [user, aprobFilter]);

  // primera carga - con dependencias controladas
  const initialLoadDoneRef = useRef(false);
  
  useEffect(() => {
    // Esperar a que el usuario esté cargado
    if (!user) return;
    
    // Solo cargar si ya se inicializó el filtro (o no es necesario inicializar)
    const admin = isAdminUser(user);
    if (admin && !initRef.current) {
      return; // Esperar a que se inicialice el filtro
    }

    // Evitar carga duplicada
    if (initialLoadDoneRef.current) {
      // Si ya se cargó antes, resetear con el nuevo filtro
      loadPage(1, true);
      setPage(1);
    } else {
      // Primera carga
      initialLoadDoneRef.current = true;
      loadPage(1, true);
      setPage(1);
    }
    
    return () => {
      // Cleanup: cancelar requests pendientes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
        scrollEndTimerRef.current = null;
      }
      // Resetear loading flag
      loadingRef.current = false;
    };
  }, [aprobFilter, user]); // ✅ Removido loadPage de dependencias

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cancelar todos los requests pendientes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Limpiar timers
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }

      // Limpiar in-flight covers y estados
      inFlightCovers.current.clear();
      inFlightEstados.current.clear();
    };
  }, []);

  // al volver al foco - con prevención de doble ejecución
  const focusCallbackRef = useRef<boolean>(false);
  
  useFocusEffect(
    useCallback(() => {
      // Evitar ejecución en mount inicial
      if (!focusCallbackRef.current) {
        focusCallbackRef.current = true;
        return;
      }

      // Evitar si ya está cargando
      if (loadingRef.current) {
        console.log('[useFocusEffect] Ya hay una carga en progreso, ignorando');
        return;
      }

      let isActive = true;
      
      const refreshData = async () => {
        try {
          // Pequeño delay para evitar conflictos
          await new Promise(resolve => setTimeout(resolve, 150));
          
          if (!isActive || !isMountedRef.current || loadingRef.current) return;

          // Resetear cache
          metaCacheRef.current.estados = {};
          metaCacheRef.current.covers = {};
          metaCacheRef.current.fetchingEstados = false;
          setCierreEstados({});
          setCovers({});
          inFlightCovers.current.clear();
          inFlightEstados.current.clear();

          if (!isActive || !isMountedRef.current) return;
          
          await loadPage(1, true);
          if (isMountedRef.current) {
            setPage(1);
          }
        } catch (error) {
          console.error('[useFocusEffect] Error:', error);
        }
      };

      refreshData();

      return () => {
        isActive = false;
      };
    }, [])
  ); // ✅ Sin dependencias para evitar re-creaciones

  const onRefresh = useCallback(async () => {
    if (refreshing || !isMountedRef.current) return;
    
    setRefreshing(true);
    try {
      // Cancelar requests pendientes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      metaCacheRef.current.estados = {};
      metaCacheRef.current.covers = {};
      metaCacheRef.current.fetchingEstados = false;
      setCierreEstados({});
      setCovers({});
      inFlightCovers.current.clear();
      inFlightEstados.current.clear();

      await loadPage(1, true);
      setPage(1);
    } catch (error) {
      console.error('[onRefresh] Error:', error);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadPage, refreshing]);

  const onEndReached = useCallback(async () => {
    try {
      const now = Date.now();
      const timeSinceLastEndReached = now - lastEndReachedTimeRef.current;
      
      // Prevenir múltiples llamadas rápidas durante el scroll
      if (timeSinceLastEndReached < 2000) {
        return;
      }
      
      if (!hasMore || loadingRef.current || refreshing || isScrollingRef.current || !isMountedRef.current) {
        return;
      }
      
      lastEndReachedTimeRef.current = now;
      const next = page + 1;
      
      await loadPage(next);
      
      if (isMountedRef.current) {
        setPage(next);
      }
    } catch (error) {
      console.error('[onEndReached] Error:', error);
    }
  }, [hasMore, page, loadPage, refreshing]);

  // aplica búsqueda (debounced)
  const data = useMemo(() => {
    try {
      const s = debouncedQ.trim().toLowerCase();

      return (items || []).filter((it) => {
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
    } catch (error) {
      console.error('[data filter] Error:', error);
      return items;
    }
  }, [items, debouncedQ]);

  // Handler para cambio de filtro con reset
  const handleAprobFilterChange = useCallback((newFilter: AprobadoFilter) => {
    try {
      setAprobFilter(newFilter);
      setPage(1);
      setItems([]);
    } catch (error) {
      console.error('[handleAprobFilterChange] Error:', error);
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          onPress={() => {
            try {
              router.back();
            } catch (error) {
              console.error('[Back button] Error:', error);
            }
          }} 
          style={styles.backBtn}
        >
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
        onEndReachedThreshold={0.8}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollBegin={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        renderItem={({ item }) => {
          try {
            const itemId = getId(item);
            const updatedAt = getWhen(item);
            const aprobado = (item as any)?.aprobado === true || (item as any)?.requiere_aprobacion === false;
            const estado = cierreEstados[itemId] || 'Reportado';

            const flame = cierreColor(estado);

            const cached = covers[itemId] || metaCacheRef.current.covers[itemId] || null;
            const direct = pickDirectThumbFields(item);
            const thumb = cached || (direct ? (() => {
              try {
                return encodeURI(direct);
              } catch {
                return null;
              }
            })() : null);

            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.8}
                onPress={() => {
                  try {
                    router.push({ pathname: '/incendios/detalles', params: { id: itemId } });
                  } catch (error) {
                    console.error('[Navigate to details] Error:', error);
                  }
                }}
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
                      {aprobado ? '✓ Aprobado' : '⏱ Pendiente'}
                    </Text>
                    <Text style={[styles.badgeMini, { backgroundColor: `${cierreColor(estado)}20`, color: cierreColor(estado) }]}>
                      {estado}
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
          } catch (error) {
            console.error('[renderItem] Error:', error);
            return null;
          }
        }}
        ListEmptyComponent={
          <View style={{ paddingTop: 32, alignItems: 'center' }}>
            <Text>{loadingRef.current ? 'Cargando...' : 'No hay incidentes'}</Text>
          </View>
        }
        ListFooterComponent={
          hasMore && !loadingRef.current ? (
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