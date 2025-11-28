
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Easing, Modal, FlatList, Platform, Image, ScrollView, Dimensions
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  Region,
  MapType,
  Marker,
  Heatmap,
  type LatLng
} from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import { ActivityIndicator, Text, Chip, Checkbox, Button, Snackbar, RadioButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';

import ImageViewerModal from '@/components/ImageViewerModal';
import OfflineBanner from '@/components/OfflineBanner';
import EmptyState from '@/components/EmptyState';
import { MapTypeDrawer, DRAWER_WIDTH } from '@/components/MapTypeDrawer';
import { MenuDrawer } from '@/components/MenuDrawer';

import { api } from '@/client';
import { getUser } from '@/session';
import { useIncendiosForMap } from '../hooks/useIncendiosForMap';
import { useFirmsGT } from '../hooks/useFirmsGT';
import { useMapRegion } from '../hooks/useMapRegion';
import { getLatLngFromIncendio } from '@/app/utils/map';
import { isAdminUser, isInstitucionUser } from './utils/roles';
import { getFirstPhotoUrlByIncendio } from '@/services/photos';
import { cierreColor } from '@/app/utils/estadoCierre';

// ========================================
// CONSTANTS
// ========================================
const AS_HEATMAP = 'heatmap';

const DEFAULT_REGION: Region = {
  latitude: 15.319,
  longitude: -91.472,
  latitudeDelta: 2.2,
  longitudeDelta: 2.2,
};

const GT_BBOX = [
  { latitude: 13.74, longitude: -92.27 },
  { latitude: 17.82, longitude: -88.18 },
];

// Timing constants
const MARKER_OPTIMIZATION_DELAY = 800;
const DEBOUNCE_RELOAD_MS = 2000;
const FETCH_ESTADOS_DEBOUNCE_MS = 500;
const TAP_DEBOUNCE_MS = 180;
const FETCH_TIMEOUT_MS = 10000;
const FETCH_REPORTANTE_TIMEOUT_MS = 8000;

// Retry constants
const BASE_DELAY_MS = 3000;
const MAX_DELAY_MS = 30000;
const JITTER_MS = 400;
const MAX_RETRY_ATTEMPTS = 6;

// UI constants
const PREVIEW_CARD_WIDTH = 260;
const PREVIEW_CARD_HEIGHT = 210;
const MAX_LIST_HEIGHT = 340;
const FIRMS_LIST_HEIGHT = 280;
const MIN_ZOOM_FOR_FIRM_DOTS = 0.05;

type DaysOption = 1 | 3 | 7;

const screen = Dimensions.get('window');

const getCoverUrl = (it: any): string | null =>
  it?.portadaUrl ||
  it?.foto_portada_url ||
  it?.thumbnailUrl ||
  it?.fotos?.[0]?.url ||
  null;

// ========================================
// MAIN COMPONENT
// ========================================
export default function Mapa() {
  const insets = useSafeAreaInsets();

  // Map state
  const [mapType, setMapType] = useState<MapType>('standard');
  const [viewer, setViewer] = useState<{ visible: boolean; urls: string[]; index: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(true);

  // Optimization: disable marker repainting for better performance
  // Set to false to prevent unnecessary re-renders when marker content changes
  const trackViews = false;

  // Drawer animations
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const menuAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Map hooks
  const {
    mapRef, currentRegion, span,
    onRegionChangeComplete, setMapReady, centerOnUser, fitToCoordinates
  } = useMapRegion(DEFAULT_REGION);

  // User state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const isAdmin = isAdminUser(currentUser);
  const isInstitucion = isInstitucionUser(currentUser);

  // Data hooks
  const {
    items,
    loading,
    reload
  } = useIncendiosForMap({
    onlyPublic: true,
    pageSize: 700,
  });

  const {
    enabled: firmsEnabled,
    setEnabled: setFirmsEnabled,
    daysWindow,
    setDaysWindow,
    loading: firmsLoading,
    heat: firmsHeat,
    geo: firmsGeo,
  } = useFirmsGT();

  // FIRMS modal state
  const [firmsOpen, setFirmsOpen] = useState(false);
  const FIRMS_OPTIONS = useMemo(() => {
    const base = [1, 3, 7];
    return Array.from(new Set([...base, daysWindow])).sort((a, b) => a - b);
  }, [daysWindow]);
  const [tempDaysWindow, setTempDaysWindow] = useState<number>(daysWindow);
  useEffect(() => setTempDaysWindow(daysWindow), [daysWindow]);

  // ========================================
  // ASYNCSTORAGE & USER SETUP
  // ========================================
  useEffect(() => {
    (async () => {
      try {
        const value = await AsyncStorage.getItem(AS_HEATMAP);
        if (value === '0') setHeatmapEnabled(false);
        if (value === '1') setHeatmapEnabled(true);
      } catch (err) {
        console.error('[AsyncStorage] Error al leer heatmap:', err);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(AS_HEATMAP, heatmapEnabled ? '1' : '0').catch((err) => {
      console.error('[AsyncStorage] Error al guardar heatmap:', err);
    });
  }, [heatmapEnabled]);

  useEffect(() => {
    (async () => {
      try {
        const user = await getUser();
        setCurrentUser(user);
      } catch (err) {
        console.error('[getUser] Error al obtener usuario:', err);
      }
    })();
  }, []);

  // Network monitoring
  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      const noInternet = !(state.isConnected && state.isInternetReachable);
      setOffline(!!noInternet);
    });
    return () => {
      if (subscription) {
        subscription();
      }
    };
  }, []);

  const [errorMsg, setErrorMsg] = useState<string>('');

  // ========================================
  // RETRY SYSTEM
  // ========================================
  const lastReloadRef = useRef<number>(0);
  const reloadingRef = useRef<boolean>(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef<number>(0);

  const randJitter = () => (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * JITTER_MS);
  const resetRetryBackoff = () => { retryAttemptRef.current = 0; };

  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  const safeReload = useCallback(async () => {
    const now = Date.now();
    if (now - lastReloadRef.current < DEBOUNCE_RELOAD_MS || reloadingRef.current) {
      console.log('[safeReload] Evitando recarga duplicada');
      return;
    }

    reloadingRef.current = true;
    try {
      await reloadRef.current();
      lastReloadRef.current = Date.now();
      resetRetryBackoff();
    } catch (e: any) {
      console.error('[MAP][safeReload]', e?.response?.status ?? e);
      setErrorMsg('No se pudieron cargar los incendios. Intenta de nuevo.');
    } finally {
      reloadingRef.current = false;
    }
  }, []);

  const scheduleRetry = useCallback((ms?: number, doRetry?: () => void) => {
    if (retryTimeoutRef.current) {
      console.log('[scheduleRetry] Ya hay un retry programado, ignorando');
      return;
    }

    const base = ms ?? Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, retryAttemptRef.current));
    const wait = Math.max(1000, Math.min(MAX_DELAY_MS, base + randJitter()));
    retryAttemptRef.current = Math.min(retryAttemptRef.current + 1, MAX_RETRY_ATTEMPTS);

    retryTimeoutRef.current = setTimeout(async () => {
      retryTimeoutRef.current = null;
      try {
        if (typeof doRetry === 'function') await doRetry();
        else await safeReload();
      } catch (err) {
        console.error('[scheduleRetry] Error en retry:', err);
      }
    }, wait);
  }, [safeReload]);

  const reportError = useCallback((err: unknown, fallback = 'Ocurrió un error inesperado.') => {
    const anyErr: any = err || {};
    const status: number | undefined =
      anyErr?.response?.status ?? anyErr?.status ?? (typeof anyErr?.code === 'number' ? anyErr.code : undefined);
    const retryAfterHeader =
      anyErr?.response?.headers?.['retry-after'] ??
      anyErr?.response?.headers?.['Retry-After'] ??
      anyErr?.headers?.['retry-after'] ?? null;

    let msg =
      anyErr?.response?.data?.message ||
      anyErr?.response?.data?.error ||
      anyErr?.response?.data?.detail ||
      anyErr?.message || fallback;

    if (status === 429) {
      const headerValue = String(retryAfterHeader ?? '').trim();
      const seconds = Number(headerValue);
      const milliseconds = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
      msg = milliseconds 
        ? `Demasiadas solicitudes. Inténtalo de nuevo en ${Math.ceil(milliseconds / 1000)} s.` 
        : 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
      scheduleRetry(milliseconds ?? undefined, () => safeReload());
    } else if (status === 503) {
      msg = 'Servicio temporalmente no disponible. Inténtalo más tarde.';
    } else if (status === 502) {
      msg = 'Hubo un problema con el servidor. Reintenta en breve.';
    } else if (anyErr?.request && !anyErr?.response) {
      msg = 'Sin respuesta del servidor. Verifica tu conexión.';
    } else if (status === 401 || status === 403) {
      msg = 'No autorizado. Inicia sesión o verifica tus permisos.';
    } else if (status && status >= 500) {
      msg = 'Error del servidor. Inténtalo en unos minutos.';
    }

    setErrorMsg(String(msg));
    return msg;
  }, [scheduleRetry, safeReload]);

  // ========================================
  // FOCUS EFFECT
  // ========================================
  const isMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMountedRef.current) {
        safeReload();
      } else {
        isMountedRef.current = true;
      }
    }, [safeReload])
  );

  // Validate coordinates
  useEffect(() => {
    if (!items?.length) return;
    let invalid = 0;
    for (const item of items) {
      if (!getLatLngFromIncendio(item as any)) invalid++;
    }
    if (invalid) console.log(`[MAP] Incendios sin coord válidas: ${invalid}/${items.length}`);
  }, [items]);

  // ========================================
  // METADATA CACHING SYSTEM
  // ========================================
  const [reportantes, setReportantes] = useState<Record<string, string>>({});
  const metaCacheRef = useRef<{
    reportantes: Record<string, string>;
    covers: Record<string, string>;
  }>({
    reportantes: {},
    covers: {},
  });

  const abortersRef = useRef<Map<string, AbortController>>(new Map());
  const inFlightRepRef = useRef<Map<string, Promise<void>>>(new Map());

  // Fetch reportante with protection
  const ensureReportante = useCallback(async (id: string, item: any) => {
    if (!id) return;
    if (metaCacheRef.current.reportantes[id]) return;

    const existing = inFlightRepRef.current.get(id);
    if (existing) {
      try { 
        await existing; 
      } catch (err) { 
        console.error('[ensureReportante] Espera promesa:', err); 
      }
      return;
    }

    const ctrl = new AbortController();
    abortersRef.current.set(id, ctrl);

    const promise = (async () => {
      try {
        const { data: rep } = await api.get('/reportes', {
          params: { incendio_uuid: id, pageSize: 1 },
          signal: ctrl.signal,
          timeout: FETCH_REPORTANTE_TIMEOUT_MS,
        });

        const first = (rep?.items || [])[0] || null;
        const name =
          first?.reportado_por_nombre ||
          [first?.reportado_por?.nombre, first?.reportado_por?.apellido].filter(Boolean).join(' ') ||
          '';

        if (name) {
          metaCacheRef.current.reportantes[id] = name;
          setReportantes(prev => ({ ...prev, [id]: name }));
          return;
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
          console.warn('[ensureReportante] Error al obtener reporte:', err?.message);
        }
      }

      try {
        const user = item?.creado_por || item?.creadoPor || null;
        const reportedBy = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.email || '';
        if (reportedBy) {
          metaCacheRef.current.reportantes[id] = reportedBy;
          setReportantes(prev => ({ ...prev, [id]: reportedBy }));
        }
      } catch (err) {
        console.error('[ensureReportante] Fallback:', err);
      }
    })();

    inFlightRepRef.current.set(id, promise);

    try { 
      await promise; 
    } catch (err) { 
      console.error('[ensureReportante] Promesa:', err); 
    } finally {
      inFlightRepRef.current.delete(id);
      abortersRef.current.delete(id);
    }
  }, []);

  // Cleanup aborters
  useEffect(() => {
    return () => {
      abortersRef.current.forEach(controller => { 
        try { 
          controller.abort(); 
        } catch (_) {} 
      });
      abortersRef.current.clear();
    };
  }, []);

  // Fetch cover URL with protection
  const ensureCoverUrl = useCallback(async (incendioId: string, item: any): Promise<string | null> => {
    if (!incendioId) return null;

    const direct =
      item?.portadaUrl ||
      item?.foto_portada_url ||
      item?.thumbnailUrl ||
      item?.fotos?.[0]?.url ||
      null;

    if (typeof direct === 'string' && direct.trim()) {
      try {
        const normalized = encodeURI(direct);
        metaCacheRef.current.covers[incendioId] = normalized;
        return normalized;
      } catch (err) {
        console.error('[ensureCoverUrl] encodeURI:', err);
      }
    }

    if (metaCacheRef.current.covers[incendioId]) {
      return metaCacheRef.current.covers[incendioId];
    }

    try {
      const url = await getFirstPhotoUrlByIncendio(incendioId);
      if (url && typeof url === 'string') {
        const normalized = encodeURI(url);
        metaCacheRef.current.covers[incendioId] = normalized;
        return normalized;
      }
    } catch (e: any) {
      console.error('[ensureCoverUrl] getFirstPhotoUrlByIncendio:', e?.message);
    }

    return null;
  }, []);

  // ========================================
  // AUTO-FIT INITIAL
  // ========================================
  const firstAutoFitDoneRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !items.length || firstAutoFitDoneRef.current) return;

    try {
      const coords = items
        .map(getLatLngFromIncendio)
        .filter(Boolean) as { latitude: number; longitude: number }[];

      if (coords.length) {
        fitToCoordinates(coords, {
          top: 60 + insets.top,
          right: 60,
          bottom: 60 + insets.bottom,
          left: 60
        });
        firstAutoFitDoneRef.current = true;
      }
    } catch (err) {
      console.error('[Auto-fit] Error al ajustar mapa:', err);
    }
  }, [items, mapRef, fitToCoordinates, insets.top, insets.bottom]);

  // ========================================
  // DRAWER ANIMATIONS
  // ========================================
  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 300,
      easing: Easing.in(Easing.ease),
      useNativeDriver: false
    }).start(() => setDrawerOpen(false));
  };

  const openMenu = () => {
    setMenuOpen(true);
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 300,
      easing: Easing.in(Easing.ease),
      useNativeDriver: false
    }).start(() => setMenuOpen(false));
  };

  // ========================================
  // NAVIGATION HANDLERS
  // ========================================
  const handleMenuNavigate = (route: string) => {
    if (route === 'Logout') { closeMenu(); return; }
    if (route === 'Mi Usuario') { closeMenu(); router.push('/mi-usuario'); return; }
    if (route === 'notificaciones') { closeMenu(); router.push('/notificaciones'); return; }
    if (route === 'preferencias') { router.push('/preferencias'); return; }
    if (route === 'Reportes') { closeMenu(); router.push('/incendios/reportes'); return; }
    if (route === 'listaIncendios') { closeMenu(); router.push('/incendios/listaIncendios'); return; }
    if (route === 'Sin Aprobar') { closeMenu(); router.push('/admin/sin-aprobar'); return; }
    if (route === 'Catalogo Incendio') { closeMenu(); router.push('/admin/catalogos'); return; }
    if (route === 'Estados') { closeMenu(); router.push('/admin/estados'); return; }
    if (route === 'Regiones') { closeMenu(); router.push('/admin/regiones'); return; }
    if (route === 'Usuarios') { closeMenu(); router.push('/admin/usuarios'); return; }
    if (route === 'Roles') { closeMenu(); router.push('/admin/roles'); return; }
    closeMenu();
  };

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================
  const lastTapRef = useRef<number>(0);
  const debounceTap = (fn: () => void, ms = TAP_DEBOUNCE_MS) => {
    const now = Date.now();
    if (now - lastTapRef.current < ms) return;
    lastTapRef.current = now;
    fn();
  };




  const showFirmDots = span.latDelta < MIN_ZOOM_FOR_FIRM_DOTS && span.lngDelta < MIN_ZOOM_FOR_FIRM_DOTS;

  // ========================================
  // PREVIEW STATE & MARKER RENDERING
  // ========================================
  const [preview, setPreview] = useState<null | { id: string; item: any; pt: { x: number; y: number } }>(null);


  const [showIncendios, setShowIncendios] = useState<boolean>(true);

  const itemsFiltrados = useMemo(() => {
    return showIncendios ? items : [];
  }, [items, showIncendios]);

  const renderMarkers = () => (
    <>
      {itemsFiltrados.map((item: any) => {
        const coord = getLatLngFromIncendio(item);
        if (!coord) return null;

        const id = String(item.id ?? item.incendio_uuid);
        const estado = item?.estadoActual?.estado?.nombre || 'Reportado';
        const color = cierreColor(estado);

        const handleMarkerPress = async () => {
          try {
            const point = await mapRef.current?.pointForCoordinate(coord as LatLng);
            const pt = point || { x: screen.width / 2, y: screen.height / 2 };

            debounceTap(() => setPreview({ id, item, pt }));

            Promise.all([
              ensureReportante(id, item),
              (async () => {
                const cached = metaCacheRef.current.covers[id] || getCoverUrl(item);
                if (!cached) {
                  const resolved = await ensureCoverUrl(id, item);
                  if (resolved) setPreview(prev => (prev && prev.id === id ? { ...prev } : prev));
                }
              })()
            ]).catch(err => {
              console.error('[handleMarkerPress] Error en fetch background:', err);
            });
          } catch (err) {
            console.error('[handleMarkerPress] Error:', err);
          }
        };

        return (
          <Marker
            key={`${id}-${estado}`}
            coordinate={coord}
            pinColor={color}
            tracksViewChanges={trackViews}
            zIndex={9999}
            onPress={handleMarkerPress}
            anchor={{ x: 0.5, y: 1 }}
          />
        );
      })}
    </>
  );

  // ========================================
  // REFRESH HANDLERS
  // ========================================
  const isRefreshingRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      console.log('[handleRefresh] Ya hay un refresh en progreso, ignorando...');
      return;
    }

    isRefreshingRef.current = true;
    try {
      await safeReload();
    } catch (err) {
      console.error('[handleRefresh] Error:', err);
      setErrorMsg('Error al refrescar los datos');
    } finally {
      isRefreshingRef.current = false;
    }
  }, [safeReload]);

  // ========================================
  // RENDER
  // ========================================
  return (
    <View style={styles.container}>
      <View style={{ 
        position: 'absolute', 
        top: (insets.top || 0) + 8, 
        left: 8, 
        backgroundColor: '#0000', 
        paddingHorizontal: 8, 
        paddingVertical: 6, 
        borderRadius: 8, 
        zIndex: 4 
      }} />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={currentRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={onRegionChangeComplete}
        onMapReady={async () => {
          try {
            setMapReady();
            await centerOnUser();
          } catch (e) {
            console.error('[MapReady] Error:', e);
            reportError(e, 'No se pudo centrar el mapa en tu ubicación');
          }
        }}
        mapType={mapType}
        mapPadding={{ top: insets.top + 48, right: 0, bottom: insets.bottom, left: 0 }}
      >
        {firmsEnabled && firmsHeat.length > 0 && !showFirmDots && (
          <Heatmap
            points={firmsHeat}
            radius={15}
            opacity={0.8}
            gradient={{ 
              colors: ['#2196F3', '#03A9F4', '#8BC34A', '#FFC107', '#F44336'], 
              startPoints: [0.1, 0.3, 0.5, 0.7, 0.9], 
              colorMapSize: 256 
            }}
          />
        )}

        {firmsEnabled && showFirmDots && (firmsGeo?.items?.features ?? []).map((feature: any) => {
          const [longitude, latitude] = feature.geometry.coordinates as [number, number];
          const acquisitionTime = feature.properties?.acqTime || '';
          const uniqueId = feature.id || `${latitude},${longitude},${acquisitionTime}`;

          return (
            <Marker 
              key={uniqueId} 
              coordinate={{ latitude, longitude }} 
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.firmsDot} />
            </Marker>
          );
        })}

        {showIncendios && renderMarkers()}
      </MapView>

      {(loading || firmsLoading) && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, color: '#333' }}>
            {loading ? 'Cargando incendios…' : 'Cargando detecciones satelitales…'}
          </Text>
        </View>
      )}

      {preview && (() => {
        const { id, item, pt } = preview;
        const estado = (item as any)?.estadoActual?.estado?.nombre || 'Reportado';
        const publicadoPor =
          reportantes[id] ||
          (() => {
            const user = (item as any).creado_por || (item as any).creadoPor || null;
            return [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.email || 'Anónimo';
          })();
        const coverRaw =
          metaCacheRef.current.covers[id] ||
          (item as any)?.portadaUrl ||
          (item as any)?.foto_portada_url ||
          (item as any)?.thumbnailUrl ||
          (item as any)?.fotos?.[0]?.url ||
          null;
        const cover = coverRaw ? (() => {
          try {
            return encodeURI(String(coverRaw));
          } catch {
            return null;
          }
        })() : null;

        const left = Math.max(8, Math.min(pt.x - PREVIEW_CARD_WIDTH / 2, screen.width - PREVIEW_CARD_WIDTH - 8));
        const top = Math.max((insets.top || 0) + 90, pt.y - PREVIEW_CARD_HEIGHT - 16);

        return (
          <>
            <TouchableWithoutFeedback onPress={() => setPreview(null)}>
              <View style={styles.previewOverlayBehind} />
            </TouchableWithoutFeedback>

            <View
              style={[styles.previewCard, {
                left, 
                top, 
                width: PREVIEW_CARD_WIDTH,
              }]}
              collapsable={false}
              renderToHardwareTextureAndroid
              needsOffscreenAlphaCompositing
            >
              <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                {(item as any).titulo || 'Sin título'}
              </Text>

              <TouchableOpacity
                accessibilityRole="imagebutton"
                accessibilityLabel="Ver foto a pantalla completa"
                activeOpacity={0.85}
                onPress={() => {
                  try {
                    if (cover) setViewer({ visible: true, urls: [cover], index: 0 });
                  } catch (err) {
                    console.error('[Preview] Error al abrir imagen:', err);
                  }
                }}
                style={{ marginTop: 6 }}
              >
                <Image
                  source={cover ? { uri: cover } : require('@/assets/images/placeholder_incendio.png')}
                  style={{ width: '100%', height: 110, borderRadius: 8 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>

              <Text style={{ marginTop: 6 }} numberOfLines={2}>
                {(item as any).descripcion || 'Sin descripción'}
              </Text>

              <Text style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
                {`Publicado por: ${publicadoPor || (reportantes[id] ? '' : '…')}`}
              </Text>
              <Text style={{ color: '#777', fontSize: 12, marginTop: 2 }}>
                {`Estado: ${estado}`}
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    try {
                      router.push(`/incendios/detalles?id=${id}`);
                    } catch (err) {
                      console.error('[Preview] Error al navegar:', err);
                    }
                  }}
                  style={[styles.cardBtn, { backgroundColor: '#E8F5E9' }]}
                >
                  <Text style={{ fontWeight: '600', color: '#2E7D32' }}>Detalles</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        );
      })()}

      <OfflineBanner visible={offline} onRetry={() => safeReload()} />

      {(drawerOpen || menuOpen) && (
        <TouchableWithoutFeedback onPress={() => {
          try {
            if (drawerOpen) closeDrawer();
            if (menuOpen) closeMenu();
          } catch (err) {
            console.error('[Overlay] Error al cerrar:', err);
          }
        }}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <MapTypeDrawer 
        animation={drawerAnim} 
        onSelectType={(type) => { 
          setMapType(type); 
          closeDrawer(); 
        }} 
      />
      {/* LeyendaDrawer removed - old cierre estado system */}
      <MenuDrawer
        animation={menuAnim}
        onClose={closeMenu}
        onNavigate={handleMenuNavigate}
        isAdmin={isAdmin}
        isInstitucion={isInstitucion}
      />

      <View style={[styles.header, { paddingTop: insets.top + 12, paddingBottom: 15 }]}>
        <TouchableOpacity 
          onPress={openMenu} 
          accessibilityRole="button" 
          accessibilityLabel="Abrir menú"
        >
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerText}>App incendios</Text>
          <Text style={{ color: '#E8F5E9', fontSize: 12 }}>
            Mostrando {itemsFiltrados.length} incendios
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            try {
              const region = currentRegion;
              router.push({ 
                pathname: '/incendios/crear', 
                params: { 
                  lat: String(region.latitude), 
                  lng: String(region.longitude) 
                } 
              });
            } catch (err) {
              console.error('[Header] Error al navegar a crear:', err);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Crear nuevo reporte"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.rightButtons, { top: (insets.top || 0) + 120 }]}>
        <CustomButton icon="layers" label="Capa" onPress={openDrawer} />
        <CustomButton 
          icon="location" 
          label="Cerca" 
          onPress={() => {
            try {
              centerOnUser();
            } catch (err) {
              console.error('[CustomButton] Error al centrar usuario:', err);
              reportError(err, 'No se pudo centrar en tu ubicación');
            }
          }}
        />
        <CustomButton
          icon="refresh" 
          label={loading ? '...' : 'Recargar'} 
          onPress={handleRefresh} 
        />
        <CustomButton 
          icon="map" 
          label="GT" 
          onPress={() => {
            try {
              fitToCoordinates(GT_BBOX as any, { 
                top: 80, 
                right: 80, 
                bottom: 80, 
                left: 80 
              });
            } catch (err) {
              console.error('[CustomButton] Error al ajustar a GT:', err);
            }
          }} 
        />
      </View>

      <View pointerEvents="box-none" style={[styles.topChipsWrap, { top: (insets.top || 0) + 70 }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.topChipsBar}
        >
          <Chip 
            selected={firmsEnabled} 
            onPress={() => setFirmsEnabled(value => !value)} 
            style={styles.chip} 
            icon={firmsEnabled ? 'satellite-uplink' : 'satellite-variant'} 
            accessibilityRole="button" 
            accessibilityLabel="Alternar FIRMS"
          >
            {firmsEnabled ? `FIRMS: ${daysWindow}d` : 'FIRMS: OFF'}
          </Chip>

          <Chip
            style={styles.chip}
            icon="calendar"
            onPress={() => setFirmsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Cambiar ventana de días FIRMS"
          >
            {`${daysWindow} días`}
          </Chip>

          <Chip 
            selected={showIncendios} 
            onPress={() => setShowIncendios(value => !value)} 
            style={styles.chip} 
            icon={showIncendios ? 'fire' : 'close'} 
            accessibilityRole="button" 
            accessibilityLabel="Alternar incendios"
          >
            {showIncendios ? 'Incendios: ON' : 'Incendios: OFF'}
          </Chip>
        </ScrollView>
      </View>

      <Modal 
        visible={firmsOpen} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setFirmsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFirmsOpen(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.sheetTitle}>Ventana de días (FIRMS)</Text>

          <FlatList
            data={FIRMS_OPTIONS}
            keyExtractor={(option) => String(option)}
            style={{ maxHeight: FIRMS_LIST_HEIGHT }}
            renderItem={({ item }) => {
              const checked = tempDaysWindow === item;
              return (
                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={() => setTempDaysWindow(item)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: checked }}
                  accessibilityLabel={`${item} días`}
                >
                  <RadioButton value={String(item)} status={checked ? 'checked' : 'unchecked'} />
                  <Text>{item} días</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text>No hay opciones</Text>}
          />

          <View style={styles.sheetActions}>
            <Button onPress={() => setTempDaysWindow(daysWindow)}>Restablecer</Button>
            <View style={{ flex: 1 }} />
            <Button
              mode="contained"
              onPress={() => {
                try {
                  if (tempDaysWindow !== daysWindow) {
                    setDaysWindow(tempDaysWindow as DaysOption);
                  }
                  setFirmsOpen(false);
                } catch (err) {
                  console.error('[FIRMS Modal] Error al aplicar:', err);
                }
              }}
            >
              Aplicar
            </Button>
          </View>
        </View>
      </Modal>

      {!loading && itemsFiltrados.length === 0 && (
        <View style={[styles.emptyOverlay, { top: (insets.top || 0) + 120 }]}>
          <EmptyState
            title="No hay incendios para mostrar"
            subtitle="Ajusta los filtros o visibilidad para ver resultados."
            actionLabel={isAdmin ? 'Crear reporte aquí' : undefined}
            onAction={() => {
              try {
                if (isAdmin) {
                  const region = currentRegion;
                  router.push({ 
                    pathname: '/incendios/crear', 
                    params: { 
                      lat: String(region.latitude), 
                      lng: String(region.longitude) 
                    } 
                  });
                }
              } catch (err) {
                console.error('[EmptyState] Error al crear reporte:', err);
              }
            }}
          />
        </View>
      )}

      <Snackbar 
        visible={!!errorMsg} 
        onDismiss={() => setErrorMsg('')} 
        duration={3500} 
        action={{ label: 'OK', onPress: () => setErrorMsg('') }}
      >
        {errorMsg}
      </Snackbar>

      <ImageViewerModal 
        visible={!!viewer} 
        urls={viewer?.urls || []} 
        index={viewer?.index ?? 0} 
        onClose={() => setViewer(null)} 
      />
    </View>
  );
}

// ========================================
// CUSTOM BUTTON COMPONENT
// ========================================
const CustomButton = ({ 
  icon, 
  label, 
  onPress 
}: { 
  icon: string; 
  label?: string; 
  onPress: () => void;
}) => (
  <TouchableOpacity 
    style={styles.customButton} 
    onPress={onPress} 
    accessibilityRole="button" 
    accessibilityLabel={label || icon}
  >
    <Ionicons name={icon as any} size={24} color="white" />
    {label && <Text style={styles.buttonLabel}>{label}</Text>}
  </TouchableOpacity>
);

// ========================================
// STYLES
// ========================================
const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  overlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    zIndex: 10 
  },
  loaderOverlay: {
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', 
    zIndex: 5,
  },
  emptyOverlay: { 
    position: 'absolute', 
    left: 16, 
    right: 16, 
    zIndex: 4 
  },
  header: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#4CAF50', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    zIndex: 3 
  },
  headerText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  rightButtons: { 
    position: 'absolute', 
    right: 16, 
    gap: 10, 
    zIndex: 3 
  },
  customButton: { 
    backgroundColor: '#009688', 
    borderRadius: 10, 
    padding: 10, 
    alignItems: 'center' 
  },
  buttonLabel: { 
    color: '#fff', 
    fontSize: 12, 
    marginTop: 4 
  },
  topChipsWrap: { 
    position: 'absolute', 
    left: 16, 
    right: 16, 
    zIndex: 3 
  },
  topChipsBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingRight: 8 
  },
  chip: { 
    backgroundColor: '#FFFFFFEE', 
    marginRight: 8 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.35)' 
  },
  bottomSheet: {
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: '#fff',
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16, 
    paddingHorizontal: 16, 
    paddingTop: 12,
    ...Platform.select({
      ios: { 
        shadowColor: '#000', 
        shadowOpacity: 0.2, 
        shadowRadius: 8, 
        shadowOffset: { width: 0, height: -2 } 
      },
      android: { 
        elevation: 12 
      },
    }),
  },
  sheetTitle: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  sheetRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    gap: 8 
  },
  sheetActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8 
  },
  dotWrap: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  dotHalo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    opacity: 0.25,
    borderWidth: 1,
    borderColor: '#00000022',
  },
  dotCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    ...Platform.select({
      ios: { 
        shadowColor: '#000', 
        shadowOpacity: 0.25, 
        shadowRadius: 2, 
        shadowOffset: { width: 0, height: 1 } 
      },
      android: { 
        elevation: 3 
      },
    }),
  },
  firmsDot: {
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: '#FF5722',
    borderWidth: 1, 
    borderColor: '#fff',
  },
  previewOverlayBehind: {
    position: 'absolute',
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 5,
  },
  previewCard: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    elevation: 10,
    zIndex: 6,
    shadowColor: '#000', 
    shadowOpacity: 0.22, 
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardBtn: {
    backgroundColor: '#EEE',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
});