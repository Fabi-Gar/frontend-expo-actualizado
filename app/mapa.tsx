/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Easing, Modal, FlatList, Platform, Image, Linking, Share, ScrollView, Dimensions
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  Region,
  MapType,
  Marker,
  Heatmap,
  type LatLng
} from 'react-native-maps';
import * as Clipboard from 'expo-clipboard';
import NetInfo from '@react-native-community/netinfo';
import { ActivityIndicator, Text, Chip, Checkbox, Button, Snackbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';

import ImageViewerModal from '@/components/ImageViewerModal';
import OfflineBanner from '@/components/OfflineBanner';
import EmptyState from '@/components/EmptyState';
import { MapTypeDrawer, DRAWER_WIDTH } from '@/components/MapTypeDrawer';
import { LeyendaDrawer } from '@/components/LeyendaDrawer';
import { MenuDrawer } from '@/components/MenuDrawer';

import { api } from '@/client';
import { getUser } from '@/session';
import { useIncendiosForMap } from '../hooks/useIncendiosForMap';
import { useFirmsGT } from '../hooks/useFirmsGT';
import { useMapRegion } from '../hooks/useMapRegion';
import { getLatLngFromIncendio, probabilityFromConfidence, probabilityLabel } from '@/app/utils/map';
import { isAdminUser } from './utils/roles';

import { cierreColor } from '@/app/utils/cierre';

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

type Etiqueta = { id: string | number; nombre: string };

const screen = Dimensions.get('window');
const getCoverUrl = (it: any): string | null =>
  it?.portadaUrl ||
  it?.foto_portada_url ||
  it?.thumbnailUrl ||
  it?.fotos?.[0]?.url ||
  null;

export default function Mapa() {
  const insets = useSafeAreaInsets();

  const [mapType, setMapType] = useState<MapType>('standard');
  const [viewer, setViewer] = useState<{ visible: boolean; urls: string[]; index: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(true);
  const [trackViews, setTrackViews] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTrackViews(false), 800); // luego vuelve a false para rendimiento
    return () => clearTimeout(t);
  }, []);


  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const leyendaAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const menuAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leyendaOpen, setLeyendaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    mapRef, currentRegion, span,
    onRegionChangeComplete, setMapReady, centerOnUser, fitToCoordinates
  } = useMapRegion(DEFAULT_REGION);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const isAdmin = isAdminUser(currentUser);

  const [allEtiquetas, setAllEtiquetas] = useState<Etiqueta[]>([]);
  const [selectedEtiquetaIds, setSelectedEtiquetaIds] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const {
    items,
    heatData,
    loading,
    reload
  } = useIncendiosForMap({
    onlyPublic: true,
    etiquetaIds: selectedEtiquetaIds,
    pageSize: 2000,
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

  // ====== init ======
  useEffect(() => { (async () => {
    try { const v = await AsyncStorage.getItem(AS_HEATMAP); if (v === '0') setHeatmapEnabled(false); if (v === '1') setHeatmapEnabled(true); } catch {}
  })(); }, []);
  useEffect(() => { AsyncStorage.setItem(AS_HEATMAP, heatmapEnabled ? '1' : '0').catch(() => {}); }, [heatmapEnabled]);
  useEffect(() => { (async () => { try { setCurrentUser(await getUser()); } catch {} })(); }, []);
  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const noInternet = !(state.isConnected && state.isInternetReachable);
      setOffline(!!noInternet);
    });
    return () => sub && sub();
  }, []);

  // ====== errores ======
  const [errorMsg, setErrorMsg] = useState<string>('');

  // ====== reload estabilizado + backoff ======
  const lastReloadRef = useRef<number>(0);
  const reloadingRef = useRef<boolean>(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef<number>(0);
  const BASE_DELAY_MS = 3000, MAX_DELAY_MS = 30000, JITTER_MS = 400;
  const randJitter = () => (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * JITTER_MS);
  const resetRetryBackoff = () => { retryAttemptRef.current = 0; };

  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; }, [reload]);

  const safeReload = useCallback(async () => {
    const now = Date.now();
    if (now - lastReloadRef.current < 2000 || reloadingRef.current) return;
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
    if (retryTimeoutRef.current) return;
    const base = ms ?? Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, retryAttemptRef.current));
    const wait = Math.max(1000, Math.min(MAX_DELAY_MS, base + randJitter()));
    retryAttemptRef.current = Math.min(retryAttemptRef.current + 1, 6);
    retryTimeoutRef.current = setTimeout(async () => {
      retryTimeoutRef.current = null;
      try { if (typeof doRetry === 'function') await doRetry(); else await safeReload(); } catch {}
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
      const s = String(retryAfterHeader ?? '').trim();
      const sec = Number(s);
      const ms = Number.isFinite(sec) ? Math.max(0, sec * 1000) : null;
      msg = ms ? `Demasiadas solicitudes. Inténtalo de nuevo en ${Math.ceil(ms/1000)} s.` : 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
      scheduleRetry(ms ?? undefined, () => safeReload());
    } else if (status === 503) msg = 'Servicio temporalmente no disponible. Inténtalo más tarde.';
    else if (status === 502) msg = 'Hubo un problema con el servidor. Reintenta en breve.';
    else if (anyErr?.request && !anyErr?.response) msg = 'Sin respuesta del servidor. Verifica tu conexión.';
    else if (status === 401 || status === 403) msg = 'No autorizado. Inicia sesión o verifica tus permisos.';
    else if (status && status >= 500) msg = 'Error del servidor. Inténtalo en unos minutos.';

    setErrorMsg(String(msg));
    return msg;
  }, [scheduleRetry, safeReload]);

  useFocusEffect(useCallback(() => { safeReload(); }, [safeReload]));

  // ====== logs coords inválidas ======
  useEffect(() => {
    if (!items?.length) return;
    let invalid = 0;
    for (const it of items) if (!getLatLngFromIncendio(it as any)) invalid++;
    if (invalid) console.log(`[MAP] Incendios sin coord válidas: ${invalid}/${items.length}`);
  }, [items]);

  // ====== Cache + estado para meta ======
  const [cierreEstados, setCierreEstados] = useState<Record<string, string>>({});
  const [reportantes, setReportantes] = useState<Record<string, string>>({});
  const metaCacheRef = useRef<{ estados: Record<string,string>, reportantes: Record<string,string> }>({
    estados: {}, reportantes: {},
  });
  const abortersRef = useRef<Map<string, AbortController>>(new Map());
  const inFlightRepRef = useRef<Map<string, Promise<void>>>(new Map());

  // ---- 1) Batch: estados de TODOS los markers ----
  const fetchEstadosBatch = useCallback(async (arr: any[]) => {
    const ids = Array.from(new Set(arr.map(it => String(it?.id ?? it?.incendio_uuid)).filter(Boolean)));
    const pendientes = ids.filter(id => !(id in metaCacheRef.current.estados));
    if (!pendientes.length) {
      setCierreEstados(prev => ({ ...prev, ...metaCacheRef.current.estados }));
      return;
    }
    try {
      const { data } = await api.get('/cierre/estados', { params: { ids: pendientes.join(',') } });
      const estados: Record<string,string> = {};
      for (const id of pendientes) {
        const entry = data?.byId?.[id];
        estados[id] = entry?.estado || 'Pendiente';
      }
      metaCacheRef.current.estados = { ...metaCacheRef.current.estados, ...estados };
      setCierreEstados(prev => ({ ...prev, ...estados }));
    } catch (e) {
      console.warn('[MAP][fetchEstadosBatch] fallo', e);
      const estados: Record<string,string> = {};
      for (const id of pendientes) estados[id] = 'Pendiente';
      metaCacheRef.current.estados = { ...metaCacheRef.current.estados, ...estados };
      setCierreEstados(prev => ({ ...prev, ...estados }));
    }
  }, []);
  useEffect(() => { if (items?.length) fetchEstadosBatch(items as any[]); }, [items, fetchEstadosBatch]);

  // ---- 2) Lazy: reportante (await antes de mostrar preview) ----
  const ensureReportante = useCallback(async (id: string, item: any) => {
    if (!id || metaCacheRef.current.reportantes[id]) return;
    const existing = inFlightRepRef.current.get(id);
    if (existing) { await existing; return; }

    const ctrl = new AbortController();
    abortersRef.current.set(id, ctrl);
    const p = (async () => {
      try {
        const { data: rep } = await api.get(`/reportes`, {
          params: { incendio_uuid: id, pageSize: 1 },
          signal: ctrl.signal
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
      } catch {}
      const u = item?.creado_por || item?.creadoPor || null;
      const by = [u?.nombre, u?.apellido].filter(Boolean).join(' ') || u?.email || '';
      if (by) {
        metaCacheRef.current.reportantes[id] = by;
        setReportantes(prev => ({ ...prev, [id]: by }));
      }
    })();
    inFlightRepRef.current.set(id, p);
    try { await p; } finally {
      inFlightRepRef.current.delete(id);
      abortersRef.current.delete(id);
    }
  }, []);
  useEffect(() => () => { abortersRef.current.forEach(c => c.abort()); abortersRef.current.clear(); }, []);

  // ====== autofit inicial ======
  const firstAutoFitDoneRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !items.length || firstAutoFitDoneRef.current) return;
    const coords = items.map(getLatLngFromIncendio).filter(Boolean) as { latitude: number; longitude: number }[];
    if (coords.length) {
      fitToCoordinates(coords, { top: 60 + insets.top, right: 60, bottom: 60 + insets.bottom, left: 60 });
      firstAutoFitDoneRef.current = true;
    }
  }, [items, mapRef, fitToCoordinates, insets.top, insets.bottom]);

  // ====== UI helpers ======
  const openDrawer = () => { setDrawerOpen(true); Animated.timing(drawerAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: false }).start(); };
  const closeDrawer = () => { Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: false }).start(() => setDrawerOpen(false)); };
  const openLeyenda = () => { setLeyendaOpen(true); Animated.timing(leyendaAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: false }).start(); };
  const closeLeyenda = () => { Animated.timing(leyendaAnim, { toValue: -DRAWER_WIDTH, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: false }).start(() => setLeyendaOpen(false)); };
  const openMenu = () => { setMenuOpen(true); Animated.timing(menuAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: false }).start(); };
  const closeMenu = () => { Animated.timing(menuAnim, { toValue: -DRAWER_WIDTH, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: false }).start(() => setMenuOpen(false)); };

  const handleMenuNavigate = (route: string) => {
    if (route === 'Mapa' || route === 'Ayuda' || route === 'Logout') { closeMenu(); return; }
    if (route === 'listaIncendios') { closeMenu(); router.push('/incendios/listaIncendios'); return; }
    if (route === 'Catalogo Incendio') { closeMenu(); router.push('/admin/catalogos'); return; }
    if (route === 'Estados') { closeMenu(); router.push('/admin/estados'); return; }
    if (route === 'Regiones') { closeMenu(); router.push('/admin/regiones'); return; }
    if (route === 'Usuarios') { closeMenu(); router.push('/admin/usuarios'); return; }
    if (route === 'Roles') { closeMenu(); router.push('/admin/roles'); return; }
    closeMenu();
  };

  const lastTapRef = useRef<number>(0);
  const debounceTap = (fn: () => void, ms = 180) => { const now = Date.now(); if (now - lastTapRef.current < ms) return; lastTapRef.current = now; fn(); };
  const openInMaps = (lat: number, lng: number, label = 'Incendio') => {
    const g = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}(${encodeURIComponent(label)})`;
    const apple = `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(label)}`;
    Linking.openURL(Platform.OS === 'ios' ? apple : g).catch(() => Linking.openURL(g));
  };
  const shareIncendio = async (id: string | number, lat?: number, lng?: number, titulo?: string) => {
    const base = `Incendio${titulo ? `: ${titulo}` : ''}`;
    const link = `https://app-incendios.example/incendios/detalles?id=${id}`;
    const loc = (lat != null && lng != null) ? `\nUbicación: ${lat.toFixed(6)}, ${lng.toFixed(6)}` : '';
    await Share.share({ message: `${base}\n${link}${loc}` });
  };
  const copyCoords = async (lat: number, lng: number) => { await Clipboard.setStringAsync(`${lat.toFixed(6)}, ${lng.toFixed(6)}`); };

  const showFirmDots = span.latDelta < 0.05 && span.lngDelta < 0.05;

  // ====== Preview manual (sin Callout)
  const [preview, setPreview] = useState<null | { id: string; item: any; pt: { x: number; y: number } }>(null);

  // ---- Custom marker (círculo con halo, sin pico)
  const MarkerDot = ({ color }: { color: string }) => (
    <View style={styles.dotWrap}>
      <View style={[styles.dotHalo, { backgroundColor: color }]} />
      <View style={[styles.dotCore, { backgroundColor: color }]} />
    </View>
  );

  // ★ Render de markers con custom view y preview manual
  const renderMarkers = () => (
    <>
      {items.map((item) => {
        const coord = getLatLngFromIncendio(item as any);
        if (!coord) return null;

        const id = String((item as any).id ?? (item as any).incendio_uuid);
        const estado = cierreEstados[id] || 'Pendiente';
        const color = cierreColor(estado);

      const handleMarkerPress = async () => {
        const point = await mapRef.current?.pointForCoordinate(coord as LatLng);
        const pt = point || { x: screen.width / 2, y: screen.height / 2 };

        await ensureReportante(id, item);

        const cover = getCoverUrl(item as any);

        // Si hay foto, abrimos el modal de foto a pantalla completa.
        if (cover) {
          debounceTap(() =>
            setViewer({ visible: true, urls: [cover], index: 0 })
          );
          return;
        }

        // Si NO hay foto, mantenemos tu preview card actual.
        debounceTap(() => setPreview({ id, item, pt }));
      };


return (
  <Marker
    key={id}
    coordinate={coord}
    // tracksViewChanges ya no hace falta si no hay hijo
    // tracksViewChanges={false}
    pinColor={color}              // ← usa tu color calculado
    zIndex={9999}                 // ← que quede encima del heatmap
    onPress={handleMarkerPress}
    anchor={{ x: 0.5, y: 1 }}     // ← ancla clásico del pin (punta)
  />
);


      })}
    </>
  );

  return (
    <View style={styles.container}>
      <View style={{ position: 'absolute', top: (insets.top || 0) + 8, left: 8, backgroundColor: '#0000', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, zIndex: 4 }} />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={currentRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={onRegionChangeComplete}
        onMapReady={async () => {
          try { setMapReady(); await centerOnUser(); }
          catch (e) { reportError(e, 'No se pudo centrar el mapa en tu ubicación'); }
        }}
        mapType={mapType}
        mapPadding={{ top: insets.top + 48, right: 0, bottom: insets.bottom, left: 0 }}
      >


        {firmsEnabled && firmsHeat.length > 0 && (
          <Heatmap
            points={firmsHeat}
            radius={25}
            opacity={0.6}
            gradient={{ colors: ['#2196F3', '#03A9F4', '#8BC34A', '#FFC107', '#F44336'], startPoints: [0.1, 0.3, 0.5, 0.7, 0.9], colorMapSize: 256 }}
          />
        )}

        {firmsEnabled && span.latDelta < 0.05 && span.lngDelta < 0.05 && (firmsGeo?.items?.features ?? []).map((f: any) => {
          const [lon, lat] = f.geometry.coordinates as [number, number];
          const conf = Number(f.properties?.confidence ?? 0);
          const prob = probabilityFromConfidence(conf);
          const probTxt = probabilityLabel(prob);
          const when = f.properties?.acqTime || '';
          const id = f.id || `${lat},${lon},${when}`;

          return (
            <Marker key={id} coordinate={{ latitude: lat, longitude: lon }} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.firmsDot}/>
            </Marker>
          );
        })}

        {renderMarkers()}
      </MapView>

      {(loading || firmsLoading) && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, color: '#333' }}>
            {loading ? 'Cargando incendios…' : 'Cargando detecciones satelitales…'}
          </Text>
        </View>
      )}

      {/* ===== Preview card + overlay (overlay detrás) ===== */}
      {preview && (() => {
        const { id, item, pt } = preview;
        const estado = cierreEstados[id] || 'Pendiente';
        const publicadoPor =
          reportantes[id] ||
          (() => {
            const u = (item as any).creado_por || (item as any).creadoPor || null;
            return [u?.nombre, u?.apellido].filter(Boolean).join(' ') || u?.email || 'Anónimo';
          })();
        const cover =
          (item as any)?.portadaUrl ||
          (item as any)?.foto_portada_url ||
          (item as any)?.thumbnailUrl ||
          (item as any)?.fotos?.[0]?.url ||
          null;

        const CARD_W = 260, CARD_H = 210;
        const left = Math.max(8, Math.min(pt.x - CARD_W / 2, screen.width - CARD_W - 8));
        const top = Math.max((insets.top || 0) + 90, pt.y - CARD_H - 16);

        const coord = getLatLngFromIncendio(item as any);

        return (
          <>
            {/* Fondo gris detrás del modal */}
            <TouchableWithoutFeedback onPress={() => setPreview(null)}>
              <View style={styles.previewOverlayBehind} />
            </TouchableWithoutFeedback>

            {/* Tarjeta por encima */}
            <View
              style={[styles.previewCard, {
                left, top, width: CARD_W,
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
                onPress={() => { if (cover) setViewer({ visible: true, urls: [cover], index: 0 }); }}
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
                  onPress={() => router.push(`/incendios/detalles?id=${id}`)}
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

      {(drawerOpen || leyendaOpen || menuOpen) && (
        <TouchableWithoutFeedback onPress={() => { if (drawerOpen) closeDrawer(); if (leyendaOpen) closeLeyenda(); if (menuOpen) closeMenu(); }}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <MapTypeDrawer animation={drawerAnim} onSelectType={(type) => { setMapType(type); closeDrawer(); }} />
      <LeyendaDrawer animation={leyendaAnim} />
      <MenuDrawer animation={menuAnim} onClose={closeMenu} onNavigate={handleMenuNavigate} isAdmin={isAdmin} />

      <View style={[styles.header, { paddingTop: insets.top + 12, paddingBottom: 15 }]}>
        <TouchableOpacity onPress={openMenu} accessibilityRole="button" accessibilityLabel="Abrir menú">
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerText}>App incendios</Text>
          <Text style={{ color: '#E8F5E9', fontSize: 12 }}>
            Mostrando {items.length} incendios
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            const r = currentRegion;
            router.push({ pathname: '/incendios/crear', params: { lat: String(r.latitude), lng: String(r.longitude) } });
          }}
          accessibilityRole="button"
          accessibilityLabel="Crear nuevo reporte"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.rightButtons, { top: (insets.top || 0) + 120 }]}>
        <CustomButton icon="layers" label="Capa" onPress={openDrawer} />
        <CustomButton icon="location" label="Cerca" onPress={centerOnUser} />
        <CustomButton icon="book" label="Leyenda" onPress={openLeyenda} />
        <CustomButton icon="refresh" label={loading ? '...' : 'Recargar'} onPress={() => safeReload()} />
        <CustomButton icon="map" label="GT" onPress={() => fitToCoordinates(GT_BBOX as any, { top: 80, right: 80, bottom: 80, left: 80 })} />
      </View>

      <View pointerEvents="box-none" style={[styles.topChipsWrap, { top: (insets.top || 0) + 70 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topChipsBar}>

          <Chip selected={firmsEnabled} onPress={() => setFirmsEnabled(v => !v)} style={styles.chip} icon={firmsEnabled ? 'satellite-uplink' : 'satellite-variant'} accessibilityRole="button" accessibilityLabel="Alternar FIRMS">
            {firmsEnabled ? `FIRMS: ${daysWindow}d` : 'FIRMS: OFF'}
          </Chip>

          <Chip style={styles.chip} icon="calendar" onPress={() => setDaysWindow(prev => (prev === 1 ? 3 : prev === 3 ? 7 : 1))} accessibilityRole="button" accessibilityLabel="Cambiar ventana de días FIRMS">
            {`${daysWindow} días`}
          </Chip>

        </ScrollView>
      </View>

      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setFiltersOpen(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.sheetTitle}>Filtrar por etiquetas</Text>

          <FlatList
            data={allEtiquetas}
            keyExtractor={(x) => String(x.id)}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => {
              const checked = selectedEtiquetaIds.includes(Number(item.id));
              return (
                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedEtiquetaIds(prev => {
                      const set = new Set(prev);
                      if (checked) {
                        set.delete(Number(item.id));
                      } else {
                        set.add(Number(item.id));
                      }
                      return Array.from(set);
                    });
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`Etiqueta ${item.nombre}`}
                >
                  <Checkbox status={checked ? 'checked' : 'unchecked'} />
                  <Text>{item.nombre}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text>No hay etiquetas</Text>}
          />

          <View style={styles.sheetActions}>
            <Button onPress={() => setSelectedEtiquetaIds([])}>Limpiar</Button>
            <View style={{ flex: 1 }} />
            <Button mode="contained" onPress={() => setFiltersOpen(false)}>Aplicar</Button>
          </View>
        </View>
      </Modal>

      {!loading && items.length === 0 && (
        <View style={[styles.emptyOverlay, { top: (insets.top || 0) + 120 }]}>
          <EmptyState
            title="No hay incendios para mostrar"
            subtitle="Cuando haya reportes, aparecerán aquí."
            actionLabel={isAdmin ? 'Crear reporte aquí' : undefined}
            onAction={() => {
              if (isAdmin) {
                const r = currentRegion;
                router.push({ pathname: '/incendios/crear', params: { lat: String(r.latitude), lng: String(r.longitude) } });
              }
            }}
          />
        </View>
      )}

      <Snackbar visible={!!errorMsg} onDismiss={() => setErrorMsg('')} duration={3500} action={{ label: 'OK', onPress: () => setErrorMsg('') }}>
        {errorMsg}
      </Snackbar>

      <ImageViewerModal visible={!!viewer} urls={viewer?.urls || []} index={viewer?.index ?? 0} onClose={() => setViewer(null)} />
    </View>
  );
}

const CustomButton = ({ icon, label, onPress }: { icon: string; label?: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.customButton} onPress={onPress} accessibilityRole="button" accessibilityLabel={label || icon}>
    <Ionicons name={icon as any} size={24} color="white" />
    {label && <Text style={styles.buttonLabel}>{label}</Text>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 10 },
  loaderOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 5,
  },
  emptyOverlay: { position: 'absolute', left: 16, right: 16, zIndex: 4 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#4CAF50', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 3 },
  headerText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  rightButtons: { position: 'absolute', right: 16, gap: 10, zIndex: 3 },
  customButton: { backgroundColor: '#009688', borderRadius: 10, padding: 10, alignItems: 'center' },
  buttonLabel: { color: '#fff', fontSize: 12, marginTop: 4 },

  topChipsWrap: { position: 'absolute', left: 16, right: 16, zIndex: 3 },
  topChipsBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  chip: { backgroundColor: '#FFFFFFEE', marginRight: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 12 },
    }),
  },
  sheetTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, textAlign: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

  // ==== Custom markers (halo redondo)
  dotWrap: { alignItems: 'center', justifyContent: 'center' },
dotHalo: {
  position: 'absolute',
  width: 26,
  height: 26,
  borderRadius: 13,
  opacity: 0.25,
  borderWidth: 1,            // <— añade esto
  borderColor: '#00000022',  // <— sombra leve del halo
},

  dotCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 3 },
    }),
  },

  firmsDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5722',
    borderWidth: 1, borderColor: '#fff',
  },

  previewOverlayBehind: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  cardBtn: {
    backgroundColor: '#EEE',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
});
