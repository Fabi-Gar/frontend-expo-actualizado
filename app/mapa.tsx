/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Easing, Modal, FlatList, Platform, Image, Linking, Share, ScrollView
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';

// Componentes auxiliares
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

// 🔷 NUEVO: colores/estado desde cierre
import { cierreColor, inferirEstadoCierre } from '@/app/utils/cierre';
import { getCierre } from '@/services/cierre';

/* ======= Constantes locales ======= */
const AS_HEATMAP = 'heatmap';

const DEFAULT_REGION: Region = {
  latitude: 15.319,
  longitude: -91.472,
  latitudeDelta: 2.2,
  longitudeDelta: 2.2,
};

// BBOX Guatemala: [-92.27, 13.74, -88.18, 17.82]
const GT_BBOX = [
  { latitude: 13.74, longitude: -92.27 },
  { latitude: 17.82, longitude: -88.18 },
];

type Etiqueta = { id: string | number; nombre: string };

export default function Mapa() {
  const insets = useSafeAreaInsets();

  // ----- Estado UI -----
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

  // ----- Control del mapa -----
  const {
    mapRef, mapReadyRef, currentRegion, span,
    onRegionChangeComplete, setMapReady, centerOnUser, fitToCoordinates
  } = useMapRegion(DEFAULT_REGION);

  // ----- Usuario / permisos -----
  const [currentUser, setCurrentUser] = useState<any>(null);
  const isAdmin = isAdminUser(currentUser);

  // ----- Catálogo de etiquetas + filtros -----
  const [allEtiquetas, setAllEtiquetas] = useState<Etiqueta[]>([]);
  const [selectedEtiquetaIds, setSelectedEtiquetaIds] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ===== Incendios (hook) =====
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

  // ===== FIRMS (hook) =====
  const {
    enabled: firmsEnabled,
    setEnabled: setFirmsEnabled,
    daysWindow,
    setDaysWindow,
    loading: firmsLoading,
    heat: firmsHeat,
    geo: firmsGeo,
  } = useFirmsGT();

  // ===== Persistencia Heatmap (toggle) =====
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

  // ===== Usuario actual =====
  useEffect(() => {
    (async () => { try { setCurrentUser(await getUser()); } catch {} })();
  }, []);

  // ===== Conectividad =====
  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const noInternet = !(state.isConnected && state.isInternetReachable);
      setOffline(!!noInternet);
    });
    return () => sub && sub();
  }, []);

  // ===== Cargar/recargar incendios =====
  useEffect(() => { reload(); }, [reload]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // ===== Depuración: coordenadas inválidas =====
  useEffect(() => {
    if (!items?.length) return;
    let invalid = 0;
    for (const it of items) {
      const pos = getLatLngFromIncendio(it as any);
      if (!pos) invalid++;
    }
    if (invalid) {
      console.log(`[MAP] Incendios sin coord válidas: ${invalid}/${items.length}`);
    }
  }, [items]);

  // ===== NUEVO: estado de cierre y reportante por incendio =====
  const [cierreEstados, setCierreEstados] = useState<Record<string, string>>({});
  const [reportantes, setReportantes] = useState<Record<string, string>>({});

  const loadCierreYReportante = useCallback(async (arr: any[]) => {
    const ids = Array.from(new Set(arr.map((it) => String(it?.id ?? it?.incendio_uuid)))).filter(Boolean);
    if (!ids.length) return;

    const estAcc: Record<string, string> = {};
    const repAcc: Record<string, string> = {};

    await Promise.all(
      ids.map(async (id) => {
        try {
          // Cierre / estado
          const c = await getCierre(id);
          const estado = c?.estado_cierre || inferirEstadoCierre(c?.secuencia_control || undefined);
          estAcc[id] = estado;

          // Reportante (tomamos el primer disponible; API sin orden → nos sirve igual para mostrar)
          try {
            const { data: rep } = await api.get(`/reportes?incendio_uuid=${id}&pageSize=1`);
            const first = (rep?.items || [])[0] || null;
            const name =
              first?.reportado_por_nombre ||
              [first?.reportado_por?.nombre, first?.reportado_por?.apellido].filter(Boolean).join(' ') ||
              '';
            if (name) repAcc[id] = name;
          } catch {
            // fallback al creador si no hay reporte
            const it = arr.find((x) => String(x?.id ?? x?.incendio_uuid) === id);
            const u = it?.creado_por || it?.creadoPor || null;
            const by = [u?.nombre, u?.apellido].filter(Boolean).join(' ') || u?.email || '';
            if (by) repAcc[id] = by;
          }
        } catch {
          // si falla cierre, lo marcamos Pendiente y tratamos de sacar reportante del item
          estAcc[id] = estAcc[id] || 'Pendiente';
          const it = arr.find((x) => String(x?.id ?? x?.incendio_uuid) === id);
          const u = it?.creado_por || it?.creadoPor || null;
          const by = [u?.nombre, u?.apellido].filter(Boolean).join(' ') || u?.email || '';
          if (by) repAcc[id] = by;
        }
      })
    );

    setCierreEstados((prev) => ({ ...prev, ...estAcc }));
    setReportantes((prev) => ({ ...prev, ...repAcc }));
  }, []);

  // cargar estados/reportantes cada vez que cambian items
  useEffect(() => {
    if (!items?.length) return;
    loadCierreYReportante(items as any[]);
  }, [items, loadCierreYReportante]);

  // Autofit una sola vez cuando haya datos
  const firstAutoFitDoneRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !items.length || firstAutoFitDoneRef.current) return;
    const coords = items.map(getLatLngFromIncendio).filter(Boolean) as { latitude: number; longitude: number }[];
    if (coords.length) {
      fitToCoordinates(coords, { top: 60 + insets.top, right: 60, bottom: 60 + insets.bottom, left: 60 });
      firstAutoFitDoneRef.current = true;
    }
  }, [items, mapRef, fitToCoordinates, insets.top, insets.bottom]);

  // ===== Helpers UI =====
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

  // Navegación del menú lateral
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

  // Mostrar puntos FIRMS (markers) sólo con zoom alto
  const showFirmDots = span.latDelta < 0.05 && span.lngDelta < 0.05;

  const renderMarkers = () => (
    <>
      {items.map((item) => {
        const coord = getLatLngFromIncendio(item as any);
        if (!coord) return null;
        const { latitude: lat, longitude: lng } = coord;

        const id = String((item as any).id ?? (item as any).incendio_uuid);
        const estado = cierreEstados[id]; // ← estado de cierre cargado
        const pinColor = cierreColor(estado); // ← color por estado de cierre
        const publicadoPor = reportantes[id] ||
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

        return (
          <Marker
            key={id}
            coordinate={coord}
            pinColor={pinColor}
            tracksViewChanges={false}
            accessibilityLabel={`Incendio ${(item as any).titulo || 'Sin título'}`}
          >
            <Callout
              onPress={() =>
                router.push(`/incendios/detalles?id=${id}`)
              }
            >
              <View style={{ maxWidth: 240 }}>
                {/* Título */}
                <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                  {(item as any).titulo || 'Sin título'}
                </Text>

                {/* Imagen */}
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
                    source={cover ? { uri: cover } : require('@/assets/images/placeholder_incendio.png')}
                    style={{ width: 240, height: 120, borderRadius: 8, marginTop: 6 }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>

                {/* Descripción */}
                <Text style={{ marginTop: 6 }} numberOfLines={4}>
                  {(item as any).descripcion || 'Sin descripción'}
                </Text>

                {/* Publicado por */}
                <Text style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
                  {`Publicado por: ${publicadoPor || 'Anónimo'}`}
                </Text>

                {/* Estado de cierre */}
                <Text style={{ color: '#777', fontSize: 12, marginTop: 2 }}>
                  {`Estado: ${estado || 'Pendiente'}`}
                </Text>

                {/* Botón Ver */}
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: '#4CAF50',
                    paddingVertical: 6,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
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
      <View style={{ position: 'absolute', top: (insets.top || 0) + 8, left: 8, backgroundColor: '#0008', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, zIndex: 4 }}>
      </View>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={currentRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={onRegionChangeComplete}
        onMapReady={async () => { setMapReady(); await centerOnUser(); }}
        mapType={mapType}
        mapPadding={{ top: insets.top + 48, right: 0, bottom: insets.bottom, left: 0 }}
      >
        {/* Heatmap de incendios propios */}
        {heatmapEnabled && heatData.length > 0 && (
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

        {/* Capa FIRMS (heatmap) */}
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

        {/* Puntos FIRMS como markers */}
        {firmsEnabled && span.latDelta < 0.05 && span.lngDelta < 0.05 && (firmsGeo?.items?.features ?? []).map((f: any) => {
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
      </MapView>

      {(loading || firmsLoading) && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, color: '#333' }}>
            {loading ? 'Cargando incendios…' : 'Cargando detecciones satelitales…'}
          </Text>
        </View>
      )}

      <OfflineBanner visible={offline} onRetry={reload} />

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
            Mostrando {items.length} incendios
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            const r = currentRegion;
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
        <CustomButton icon="refresh" label={loading ? '...' : 'Recargar'} onPress={reload} />
        <CustomButton
          icon="map"
          label="GT"
          onPress={() => fitToCoordinates(GT_BBOX as any, { top: 80, right: 80, bottom: 80, left: 80 })}
        />
      </View>

      {/* Chips / Filtros */}
      <View pointerEvents="box-none" style={[styles.topChipsWrap, { top: (insets.top || 0) + 70 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topChipsBar}>
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
              const checked = selectedEtiquetaIds.includes(Number(item.id));
              return (
                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedEtiquetaIds(prev => {
                      const set = new Set(prev);
                      // eslint-disable-next-line no-unused-expressions
                      checked ? set.delete(Number(item.id)) : set.add(Number(item.id));
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
      {!loading && items.length === 0 && (
        <View style={[styles.emptyOverlay, { top: (insets.top || 0) + 120 }]}>
          <EmptyState
            title="No hay incendios para mostrar"
            subtitle="Cuando haya reportes, aparecerán aquí."
            actionLabel={isAdmin ? 'Crear reporte aquí' : undefined}
            onAction={() => {
              if (isAdmin) {
                const r = currentRegion;
                router.push({
                  pathname: '/incendios/crear',
                  params: { lat: String(r.latitude), lng: String(r.longitude) },
                });
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
});
