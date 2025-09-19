import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Easing, Alert, Modal, FlatList, Platform, Image, Linking, Share, ScrollView
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  Region,
  MapType,
  Marker,
  Callout,
  Heatmap,
} from 'react-native-maps';
import * as Clipboard from 'expo-clipboard';
import NetInfo from '@react-native-community/netinfo';

import { ActivityIndicator, Text, Chip, Checkbox, Button } from 'react-native-paper';

import ImageViewerModal from '../components/ImageViewerModal';
import OfflineBanner from '../components/OfflineBanner';
import EmptyState from '../components/EmptyState';
import { getCurrentCoords } from '../hooks/location';

import ClusteredMapView from 'react-native-map-clustering';
import { Ionicons } from '@expo/vector-icons';
import { MapTypeDrawer, DRAWER_WIDTH } from '@/components/MapTypeDrawer';
import { LeyendaDrawer } from '@/components/LeyendaDrawer';
import { MenuDrawer } from '@/components/MenuDrawer';
import { router, useFocusEffect } from 'expo-router';
import { listIncendiosArray, Incendio } from '../services/incendios';
import { listEtiquetas, Etiqueta } from '../services/catalogos';
import { getUser } from '../session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiAuth } from '../client';

interface WeightedLatLng {
  latitude: number;
  longitude: number;
  weight?: number;
}

function isFiniteNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function getLatLngFromIncendio(item: Incendio) {
  if (isFiniteNumber((item as any).lat) && isFiniteNumber((item as any).lng)) {
    return { latitude: (item as any).lat, longitude: (item as any).lng };
  }
  if (isFiniteNumber((item as any).lat) && isFiniteNumber((item as any).lon)) {
    return { latitude: (item as any).lat, longitude: (item as any).lon };
  }
  const coords = item.ubicacion?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (isFiniteNumber(lat) && isFiniteNumber(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

function getPinColor(item: Incendio) {
  const id = item?.estadoActual?.estado?.id;
  if (id === 1) return '#E53935'; // Activo
  if (id === 2) return '#FB8C00'; // Reportado
  if (id === 3) return '#2E7D32'; // Apagado
  return '#757575';
}

const DEFAULT_REGION: Region = {
  latitude: 15.319,
  longitude: -91.472,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

// BBOX de Guatemala aprox: [minLon, minLat, maxLon, maxLat]
const GT_BBOX: [number, number, number, number] = [-92.27, 13.74, -88.18, 17.82];

// AsyncStorage keys
const AS_HEATMAP = 'heatmap';
const AS_FIRMS_ENABLED = 'firms_enabled';
const AS_FIRMS_DAYS = 'firms_days';

// TTL del caché de FIRMS (ms)
const FIRMS_CACHE_TTL = 30 * 60 * 1000; // 30 min

// Helpers
function probabilityFromConfidence(conf: number) {
  // conf 0-100 -> 0.2-1.0
  const w = Math.min(1, Math.max(0.2, conf / 100));
  return w;
}
function probabilityLabel(p: number) {
  if (p >= 0.85) return 'Muy alta';
  if (p >= 0.7)  return 'Alta';
  if (p >= 0.5)  return 'Media';
  if (p >= 0.35) return 'Baja';
  return 'Muy baja';
}

export default function Mapa() {
  const insets = useSafeAreaInsets();

  const [region] = useState<Region>(DEFAULT_REGION);
  const [mapType, setMapType] = useState<MapType>('standard');

  const [viewer, setViewer] = useState<{ visible: boolean; urls: string[]; index: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(true);

  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const leyendaAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const menuAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leyendaOpen, setLeyendaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const mapReadyRef = useRef(false);
  const currentRegionRef = useRef<Region>(DEFAULT_REGION);

  const firstAutoFitDoneRef = useRef(false);

  const [items, setItems] = useState<Incendio[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const roleId = currentUser?.rol?.id as number | undefined;
  const roleName = typeof currentUser?.rol?.nombre === 'string' ? currentUser.rol.nombre.toLowerCase() : undefined;
  const isAdmin = roleId === 2 || (roleName?.includes?.('admin') ?? false);

  const [allEtiquetas, setAllEtiquetas] = useState<Etiqueta[]>([]);
  const [selectedEtiquetaIds, setSelectedEtiquetaIds] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Span de región para detectar zoom (y mostrar markers FIRMS con callouts)
  const [span, setSpan] = useState({
    latDelta: DEFAULT_REGION.latitudeDelta,
    lngDelta: DEFAULT_REGION.longitudeDelta,
  });

  // === Persistencia Heatmap (incendios) ===
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(AS_HEATMAP);
        if (v === '0') setHeatmapEnabled(false);
        if (v === '1') setHeatmapEnabled(true);
      } catch {}
    })();
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(AS_HEATMAP, heatmapEnabled ? '1' : '0').catch(() => {});
  }, [heatmapEnabled]);

  // Usuario para admin
  useEffect(() => {
    (async () => {
      try { setCurrentUser(await getUser()); } catch {}
    })();
  }, []);

  // Conectividad con NetInfo
  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const noInternet = !(state.isConnected && state.isInternetReachable);
      setOffline(!!noInternet);
    });
    return () => sub && sub();
  }, []);

  // Cargar catálogos (etiquetas)
  useEffect(() => {
    (async () => {
      try {
        const etqs = await listEtiquetas();
        setAllEtiquetas(etqs || []);
      } catch {}
    })();
  }, []);

  // Centrar en usuario (botón “Cerca”)
  const centerOnUser = useCallback(async () => {
    const coords = await getCurrentCoords();
    if (!coords) return;
    const next: Region = {
      latitude: coords.lat,
      longitude: coords.lng,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
    currentRegionRef.current = next;
    if (mapReadyRef.current && mapRef.current) {
      (mapRef.current as any).animateToRegion(next, 500);
    }
  }, []);

  // Cargar incendios (array plano)
  const loadIncendios = useCallback(async () => {
    try {
      setLoading(true);
      const arr = await listIncendiosArray(1, 2000);
      const visibles = (arr || []).filter(x => x.visiblePublico === true);
      setItems(visibles);

      // autofit solo una vez
      if (mapRef.current && visibles.length && !firstAutoFitDoneRef.current) {
        const coords = visibles
          .map(getLatLngFromIncendio)
          .filter(Boolean) as { latitude: number; longitude: number }[];
        if (coords.length) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 60 + insets.top, right: 60, bottom: 60 + insets.bottom, left: 60 },
            animated: true,
          });
          firstAutoFitDoneRef.current = true;
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar los incendios');
    } finally {
      setLoading(false);
    }
  }, [insets.bottom, insets.top]);

  useEffect(() => { loadIncendios(); }, [loadIncendios]);
  useFocusEffect(useCallback(() => { loadIncendios(); }, [loadIncendios]));

  // Drawers open/close
  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
  };
  const closeDrawer = () => {
    Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: false }).start(() => setDrawerOpen(false));
  };
  const openLeyenda = () => {
    setLeyendaOpen(true);
    Animated.timing(leyendaAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
  };
  const closeLeyenda = () => {
    Animated.timing(leyendaAnim, { toValue: -DRAWER_WIDTH, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: false }).start(() => setLeyendaOpen(false));
  };
  const openMenu = () => {
    setMenuOpen(true);
    Animated.timing(menuAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
  };
  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: -DRAWER_WIDTH, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: false }).start(() => setMenuOpen(false));
  };

  const handleMenuNavigate = (route: string) => {
    if (route === 'Mapa') { closeMenu(); return; }
    if (route === 'Ayuda') { closeMenu(); return; }
    if (route === 'listaIncendios') { closeMenu(); router.push('/incendios/listaIncendios'); return; }
    if (route === 'Etiquetas') { closeMenu(); router.push('/admin/etiquetas'); return; }
    if (route === 'Estados') { closeMenu(); router.push('/admin/estados'); return; }
    if (route === 'Regiones') { closeMenu(); router.push('/admin/regiones'); return; }
    if (route === 'Usuarios') { closeMenu(); router.push('/admin/usuarios'); return; }
    if (route === 'Roles') { closeMenu(); router.push('/admin/roles'); return; }
    if (route === 'Logout') { closeMenu(); return; }
    closeMenu();
  };

  // ===== Filtro por etiquetas =====
  const filteredItems = useMemo(() => {
    if (!selectedEtiquetaIds.length) return items;
    const setIds = new Set(selectedEtiquetaIds);
    return items.filter(it => (it.etiquetas || []).some(e => setIds.has(e.id)));
  }, [items, selectedEtiquetaIds]);

  // Heatmap datos desde filteredItems (incendios)
  const heatData: WeightedLatLng[] = useMemo(() => {
    return filteredItems
      .map((it) => {
        const pos = getLatLngFromIncendio(it);
        if (!pos) return null;
        const estadoId = it?.estadoActual?.estado?.id;
        const weight = estadoId === 1 ? 1.0 : estadoId === 2 ? 0.7 : estadoId === 3 ? 0.3 : 0.5;
        return { latitude: pos.latitude, longitude: pos.longitude, weight };
      })
      .filter(Boolean) as WeightedLatLng[];
  }, [filteredItems]);

  // ======= FIRMS: cargar TODOS Guatemala + persistencia =======
  const [firmsEnabled, setFirmsEnabled] = useState<boolean>(true);
  const [daysWindow, setDaysWindow] = useState<number>(3); // 1/3/7
  const [firmsGeo, setFirmsGeo] = useState<any | null>(null);
  const [firmsLoading, setFirmsLoading] = useState<boolean>(false);

  // lee prefs FIRMS
  useEffect(() => {
    (async () => {
      try {
        const en = await AsyncStorage.getItem(AS_FIRMS_ENABLED);
        if (en === '0') setFirmsEnabled(false);
        if (en === '1') setFirmsEnabled(true);
        const d = await AsyncStorage.getItem(AS_FIRMS_DAYS);
        if (d) {
          const n = Number(d);
          if (n === 1 || n === 3 || n === 7) setDaysWindow(n);
        }
      } catch {}
    })();
  }, []);
  // guarda prefs FIRMS
  useEffect(() => {
    AsyncStorage.setItem(AS_FIRMS_ENABLED, firmsEnabled ? '1' : '0').catch(() => {});
  }, [firmsEnabled]);
  useEffect(() => {
    AsyncStorage.setItem(AS_FIRMS_DAYS, String(daysWindow)).catch(() => {});
  }, [daysWindow]);

  // carga FIRMS (Guatemala completa) con caché en AsyncStorage
  const AS_FIRMS_CACHE_PREFIX = 'firms_gt_cache_all_d'; // + days

  useEffect(() => {
    let cancelled = false;

    async function loadFirmsAllGT() {
      try {
        if (!firmsEnabled) { setFirmsGeo(null); return; }

        const key = `${AS_FIRMS_CACHE_PREFIX}${daysWindow}`;
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed?.ts && (Date.now() - parsed.ts) < FIRMS_CACHE_TTL && parsed?.data) {
              if (!cancelled) setFirmsGeo(parsed.data);
              return;
            }
          } catch {}
        }

        setFirmsLoading(true);

        const q = new URLSearchParams();
        q.set('as', 'geojson');
        q.set('days', String(daysWindow));            // 1/3/7
        q.set('order', 'recientes');                  // o 'confianza' / 'frp'
        q.set('bbox', GT_BBOX.join(','));             // Guatemala
        // IMPORTANTE: nombres reales de productos en tu BD
        q.set('product', 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,MODIS_NRT');
        q.set('limit', '5000');                       // tope del backend
        q.set('page', '1');

        // Si esperas >5000, aquí podrías paginar en un loop.
        const { data } = await apiAuth.get(`/api/firms/puntos?${q.toString()}`);

        if (!cancelled) {
          setFirmsGeo(data);
          await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
        }
      } catch {
        // opcional: Alert.alert('FIRMS', 'Error al cargar FIRMS/MODIS GT');
      } finally {
        if (!cancelled) setFirmsLoading(false);
      }
    }

    loadFirmsAllGT();
    return () => { cancelled = true; };
  }, [firmsEnabled, daysWindow]);

  // Transformar FIRMS → Heatmap points (Guatemala completa)
  const firmsHeat = useMemo(() => {
    const feats = firmsGeo?.items?.features ?? [];
    return feats.map((f: any) => {
      const [lon, lat] = f.geometry.coordinates as [number, number];
      const conf = Number(f.properties?.confidence ?? 50);
      const weight = probabilityFromConfidence(conf);
      return { latitude: lat, longitude: lon, weight };
    });
  }, [firmsGeo]);

  // Mostrar puntos FIRMS como markers (tap) con zoom alto (para ver callouts)
  const showFirmDots = useMemo(() => {
    return span.latDelta < 0.05 && span.lngDelta < 0.05;
  }, [span.latDelta, span.lngDelta]);

  const lastTapRef = useRef<number>(0);
  const debounceTap = (fn: () => void, ms = 180) => {
    const now = Date.now();
    if (now - lastTapRef.current < ms) return;
    lastTapRef.current = now;
    fn();
  };

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

  const copyCoords = async (lat: number, lng: number) => {
    await Clipboard.setStringAsync(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  };

  const renderMarkers = () => (
    <>
      {filteredItems.map((item) => {
        const coord = getLatLngFromIncendio(item);
        if (!coord) return null;
        const { latitude: lat, longitude: lng } = coord;

        const cover =
          (item as any)?.portadaUrl ||
          (item as any)?.thumbnailUrl ||
          undefined;

        return (
          <Marker
            key={item.id}
            coordinate={coord}
            pinColor={getPinColor(item)}
            tracksViewChanges={false}
            accessibilityLabel={`Incendio ${item.titulo}`}
          >
            <Callout onPress={() => router.push(`/incendios/detalles?id=${item.id}`)}>
              <View style={{ maxWidth: 220 }}>
                <Text style={{ fontWeight: 'bold' }}>{item.titulo}</Text>

                <TouchableOpacity
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Ver foto a pantalla completa"
                  activeOpacity={0.85}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (cover) debounceTap(() => setViewer({ visible: true, urls: [cover], index: 0 }));
                  }}
                >
                  <Image
                    source={
                      cover
                        ? { uri: cover }
                        : require('../assets/images/placeholder_incendio.png')
                    }
                    style={{ width: 220, height: 110, borderRadius: 8, marginTop: 6 }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>

                <Text>
                  {typeof item.region === 'object' && item.region !== null ? item.region.nombre : 'Sin región'}
                </Text>
                <Text>{item.estadoActual?.estado?.nombre || 'Sin estado'}</Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'space-between' }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Abrir en mapas"
                    onPress={(e) => { e.stopPropagation(); debounceTap(() => openInMaps(lat, lng, item.titulo)); }}
                    style={{ paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#EEEEEE', borderRadius: 8 }}
                  >
                    <Text style={{ fontWeight: '600' }}>Abrir mapas</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Compartir incendio"
                    onPress={(e) => { e.stopPropagation(); debounceTap(() => shareIncendio(item.id, lat, lng, item.titulo)); }}
                    style={{ paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#EEEEEE', borderRadius: 8 }}
                  >
                    <Text style={{ fontWeight: '600' }}>Compartir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Copiar coordenadas"
                    onPress={(e) => { e.stopPropagation(); debounceTap(() => copyCoords(lat, lng)); }}
                    style={{ paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#EEEEEE', borderRadius: 8 }}
                  >
                    <Text style={{ fontWeight: '600' }}>Copiar</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 6, backgroundColor: '#4CAF50', paddingVertical: 6, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ver</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Badge de depuración opcional */}
      {firmsEnabled && (
        <View style={{ position: 'absolute', top: (insets.top || 0) + 44, left: 16, backgroundColor: '#0008', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 4 }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>FIRMS: {firmsGeo?.items?.features?.length ?? 0}</Text>
        </View>
      )}

      <ClusteredMapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={(r) => {
          currentRegionRef.current = r;
          // actualizar span para decidir si mostramos markers FIRMS
          setSpan({ latDelta: r.latitudeDelta, lngDelta: r.longitudeDelta });
        }}
        mapType={mapType}
        mapPadding={{ top: insets.top + 48, right: 0, bottom: insets.bottom, left: 0 }}
        // @ts-ignore
        clusterColor="#4CAF50"
        // @ts-ignore
        clusterTextColor="#fff"
        // @ts-ignore
        spiralEnabled={true}
        // @ts-ignore
        animationEnabled={true}
        onMapReady={async () => {
          mapReadyRef.current = true;
          const coords = await getCurrentCoords();
          if (coords && mapRef.current) {
            const initial: Region = {
              latitude: coords.lat,
              longitude: coords.lng,
              latitudeDelta: 0.06,
              longitudeDelta: 0.06,
            };
            currentRegionRef.current = initial;
            setSpan({ latDelta: initial.latitudeDelta, lngDelta: initial.longitudeDelta });
            (mapRef.current as any).animateToRegion(initial, 0);
          } else {
            centerOnUser();
          }
        }}
      >
        {/* Heatmap de incendios propios */}
        {heatmapEnabled && (
          <Heatmap
            points={heatData}
            radius={42}
            opacity={0.75}
            gradient={{
              colors: ['#00BCD4', '#4CAF50', '#FFEB3B', '#FF9800', '#F44336'],
              startPoints: [0.1, 0.3, 0.5, 0.7, 0.9],
              colorMapSize: 256,
            }}
          />
        )}

        {/* Capa FIRMS (heatmap, Guatemala completa) */}
        {firmsEnabled && firmsHeat.length > 0 && (
          <Heatmap
            points={firmsHeat}
            radius={36}
            opacity={0.6}
            gradient={{
              colors: ['#2196F3', '#03A9F4', '#8BC34A', '#FFC107', '#F44336'],
              startPoints: [0.1, 0.3, 0.5, 0.7, 0.9],
              colorMapSize: 256,
            }}
          />
        )}

        {/* Puntos FIRMS como markers (tap/callout) cuando hay suficiente zoom */}
        {firmsEnabled && showFirmDots && (firmsGeo?.items?.features ?? []).map((f: any) => {
          const [lon, lat] = f.geometry.coordinates as [number, number];
          const conf = Number(f.properties?.confidence ?? 0);
          const prob = probabilityFromConfidence(conf);
          const probTxt = probabilityLabel(prob);
          const when = f.properties?.acqTime || '';
          const id = f.id || `${lat},${lon},${when}`;

          return (
            <Marker
              key={id}
              coordinate={{ latitude: lat, longitude: lon }}
              pinColor="#FF5722"
              tracksViewChanges={false}
            >
              <Callout>
                <View style={{ maxWidth: 240 }}>
                  <Text style={{ fontWeight: 'bold' }}>Detección satelital (FIRMS)</Text>
                  <Text>Fuente: {String(f.properties?.source || 'N/D')}</Text>
                  <Text>Confianza: {conf}%</Text>
                  <Text>Probabilidad de incendio: {probTxt}</Text>
                  {when ? <Text>Fecha/hora: {String(when)}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => openInMaps(lat, lon, 'FIRMS')}
                      style={{ backgroundColor: '#EEE', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 }}
                    >
                      <Text style={{ fontWeight: '600' }}>Abrir mapas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => copyCoords(lat, lon)}
                      style={{ backgroundColor: '#EEE', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 }}
                    >
                      <Text style={{ fontWeight: '600' }}>Copiar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Marcadores de incendios */}
        {renderMarkers()}
      </ClusteredMapView>

      {/* Loader overlay mientras carga incendios o FIRMS */}
      {(loading || firmsLoading) && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, color: '#333' }}>
            {loading ? 'Cargando incendios…' : 'Cargando detecciones satelitales…'}
          </Text>
        </View>
      )}

      <OfflineBanner visible={offline} onRetry={loadIncendios} />

      {(drawerOpen || leyendaOpen || menuOpen) && (
        <TouchableWithoutFeedback
          onPress={() => { if (drawerOpen) closeDrawer(); if (leyendaOpen) closeLeyenda(); if (menuOpen) closeMenu(); }}
        >
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <MapTypeDrawer animation={drawerAnim} onSelectType={(type) => { setMapType(type); closeDrawer(); }} />
      <LeyendaDrawer animation={leyendaAnim} />
      <MenuDrawer
        animation={menuAnim}
        onClose={closeMenu}
        onNavigate={handleMenuNavigate}
        isAdmin={isAdmin}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingBottom: 15 }]}>
        <TouchableOpacity onPress={openMenu} accessibilityRole="button" accessibilityLabel="Abrir menú">
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerText}>App incendios</Text>
          <Text style={{ color: '#E8F5E9', fontSize: 12 }}>
            Mostrando {filteredItems.length} de {items.length}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            const r = currentRegionRef.current;
            router.push({
              pathname: '/incendios/crear',
              params: { lat: String(r.latitude), lng: String(r.longitude) },
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Crear nuevo reporte"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Botonera derecha */}
      <View style={[styles.rightButtons, { top: (insets.top || 0) + 120 }]}>
        <CustomButton icon="layers" label="Capa" onPress={openDrawer} />
        <CustomButton icon="location" label="Cerca" onPress={centerOnUser} />
        <CustomButton icon="book" label="Leyenda" onPress={openLeyenda} />
        <CustomButton icon="refresh" label={loading ? '...' : 'Recargar'} onPress={loadIncendios} />
      </View>

      {/* Chips en slider horizontal dentro de contenedor ABSOLUTO (no tapa el mapa) */}
      <View
        pointerEvents="box-none"
        style={[styles.topChipsWrap, { top: (insets.top || 0) + 70 }]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topChipsBar}
        >
          <Chip
            selected={heatmapEnabled}
            onPress={() => setHeatmapEnabled(v => !v)}
            style={styles.chip}
            icon={heatmapEnabled ? 'fire' : 'fire-off'}
            accessibilityRole="button"
            accessibilityLabel="Alternar heatmap incendios"
          >
            {heatmapEnabled ? 'Incendios: ON' : 'Incendios: OFF'}
          </Chip>

          <Chip
            selected={firmsEnabled}
            onPress={() => setFirmsEnabled(v => !v)}
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
            onPress={() => setDaysWindow(prev => (prev === 1 ? 3 : prev === 3 ? 7 : 1))}
            accessibilityRole="button"
            accessibilityLabel="Cambiar ventana de días FIRMS"
          >
            {`${daysWindow} días`}
          </Chip>

          <Chip
            style={styles.chip}
            icon="tag"
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros de etiquetas"
          >
            {selectedEtiquetaIds.length ? `Etiquetas: ${selectedEtiquetaIds.length}` : 'Etiquetas'}
          </Chip>
        </ScrollView>
      </View>

      {/* Modal filtros etiquetas */}
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
              const checked = selectedEtiquetaIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedEtiquetaIds(prev => {
                      const set = new Set(prev);
                      checked ? set.delete(item.id) : set.add(item.id);
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

      {/* Empty state */}
      {!loading && filteredItems.length === 0 && (
        <View style={[styles.emptyOverlay, { top: (insets.top || 0) + 120 }]}>
          <EmptyState
            title="No hay incendios para mostrar"
            subtitle={
              selectedEtiquetaIds.length
                ? 'Prueba limpiar filtros de etiquetas.'
                : 'Cuando haya reportes, aparecerán aquí.'
            }
            actionLabel={
              isAdmin ? 'Crear reporte aquí' : (selectedEtiquetaIds.length ? 'Limpiar filtros' : undefined)
            }
            onAction={() => {
              if (isAdmin) {
                const r = currentRegionRef.current;
                router.push({
                  pathname: '/incendios/crear',
                  params: { lat: String(r.latitude), lng: String(r.longitude) },
                });
              } else if (selectedEtiquetaIds.length) {
                setSelectedEtiquetaIds([]);
              }
            }}
          />
        </View>
      )}

      <ImageViewerModal
        visible={!!viewer}
        urls={viewer?.urls || []}
        index={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const CustomButton = ({ icon, label, onPress }: { icon: string; label?: string; onPress: () => void }) => (
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

  // Chips horizontal sin ocupar pantalla completa:
  topChipsWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 3,
  },
  topChipsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
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
});
