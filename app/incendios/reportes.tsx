// app/reportes/mios.tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, Linking, Platform } from 'react-native';
import { ActivityIndicator, Card, Text, Chip, Button, Snackbar, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { api } from '@/client';
import { getUser } from '@/session'; // 👈 para saber si es admin

// ===== Utils =====
type Punto = { type: 'Point'; coordinates: [number, number] }; // [lon, lat]

type Reporte = {
  reporte_uuid: string;
  reportado_por_nombre?: string | null;
  telefono?: string | null;
  reportado_en: string;
  observaciones?: string | null;
  ubicacion?: Punto | null;
  departamento?: { nombre: string } | null;
  municipio?: { nombre: string } | null;
  lugar_poblado?: string | null;

  incendio: {
    incendio_uuid: string;
    titulo?: string | null;
    descripcion?: string | null;
    requiere_aprobacion: boolean;
    aprobado: boolean;
    aprobado_en?: string | null;
    rechazado_en?: string | null;
    motivo_rechazo?: string | null;
    centroide?: Punto | null;
    creado_en: string;
    actualizado_en: string;
  };
};

type Resp = {
  total: number;
  page: number;
  pageSize: number;
  items: Reporte[];
};

const getLatLng = (r: Reporte) => {
  const p = r.ubicacion || r.incendio.centroide;
  if (!p || p.type !== 'Point' || !Array.isArray(p.coordinates)) return null;
  const [lng, lat] = p.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
};

const openInMaps = (lat: number, lng: number, label = 'Incendio') => {
  const g = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}(${encodeURIComponent(label)})`;
  const apple = `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(label)}`;
  Linking.openURL(Platform.OS === 'ios' ? apple : g).catch(() => Linking.openURL(g));
};

const fmtDate = (iso?: string | null) => {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString(); // ajusta TZ si quieres
  } catch { return String(iso || ''); }
};

export default function MisReportes() {
  const insets = useSafeAreaInsets();

  // ===== Estado de usuario (admin / no admin) =====
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const u = await getUser();
        setIsAdmin(!!u?.is_admin);
      } catch {}
    })();
  }, []);

  // ===== Estado de lista/paginación =====
  const [items, setItems] = useState<Reporte[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // ===== Control de concurrencia / cancelación =====
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ===== Llamada de datos (estable) =====
  const fetchPage = useCallback(async (p: number, replace = false) => {
    if (inFlightRef.current) return; // evita overlap
    inFlightRef.current = true;

    // cancela request previa si existe
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      if (replace) {
        setRefreshing(true);
      } else if (p === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { data } = await api.get<Resp>('/reportes/mios', {
        params: { page: p, pageSize },
        signal: ctrl.signal,
      });

      setTotal(data.total || 0);
      setPage(data.page || p);
      setItems(prev => (replace || p === 1 ? data.items : [...prev, ...data.items]));
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // request cancelada: no mostrar error
      } else {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'No se pudieron cargar tus reportes.';
        setErrorMsg(String(msg));
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [pageSize]);

  // Monta una sola vez (sin loops)
  useEffect(() => { fetchPage(1, true); }, [fetchPage]);

  // ===== Paginación segura =====
  const canLoadMore = items.length < total;

  // Evita múltiples triggers por momentum
  const onEndReachedCalledDuringMomentum = useRef(false);
  const onEndReached = () => {
    if (onEndReachedCalledDuringMomentum.current) return;
    if (!canLoadMore) return;
    onEndReachedCalledDuringMomentum.current = true;
    fetchPage(page + 1);
  };

  const onRefresh = () => fetchPage(1, true);

  // ===== Render de cada tarjeta =====
  const RenderItem = ({ item }: { item: Reporte }) => {
    const latlng = getLatLng(item);

    const estadoChip = (() => {
      const inc = item.incendio;
      if (inc.rechazado_en) return <Chip compact style={{ backgroundColor: '#FFEBEE' }} textStyle={{ color: '#C62828' }}>Rechazado</Chip>;
      if (inc.requiere_aprobacion && !inc.aprobado) return <Chip compact style={{ backgroundColor: '#FFF3E0' }} textStyle={{ color: '#EF6C00' }}>Pend. aprobación</Chip>;
      if (inc.aprobado) return <Chip compact style={{ backgroundColor: '#E8F5E9' }} textStyle={{ color: '#2E7D32' }}>Aprobado</Chip>;
      return <Chip compact>Registrado</Chip>;
    })();

    const titulo = item.incendio.titulo || 'Incendio sin título';
    const subt = [
      item.departamento?.nombre,
      item.municipio?.nombre,
      item.lugar_poblado || null,
    ].filter(Boolean).join(' · ');

    // 👇 Lógica de visibilidad del botón "Detalles"
    // - Admin siempre puede ver.
    // - Si requiere aprobación y NO está aprobado → ocultar para no-admin.
    // - Si NO requiere aprobación → mostrar.
    const canSeeDetails =
      isAdmin ||
      item.incendio.aprobado ||
      !item.incendio.requiere_aprobacion;

    return (
      <Card style={{ marginHorizontal: 12, marginBottom: 10 }} mode="elevated">
        <Card.Title
          title={titulo}
          subtitle={subt || 'Ubicación no especificada'}
          right={() => <View style={{ flexDirection: 'row', gap: 6, marginRight: 8 }}>{estadoChip}</View>}
        />
        <Card.Content>
          <View style={{ gap: 6 }}>
            <Text variant="bodyMedium">Reportado por: <Text style={{ fontWeight: '600' }}>{item.reportado_por_nombre || 'Anónimo'}</Text></Text>
            {!!item.telefono && <Text variant="bodyMedium">Tel: {item.telefono}</Text>}
            <Text variant="bodySmall" style={{ color: '#555' }}>Reportado: {fmtDate(item.reportado_en)}</Text>
            {!!item.observaciones && <Text variant="bodyMedium">Obs.: {item.observaciones}</Text>}
            {latlng && (
              <Text variant="bodySmall" style={{ color: '#555' }}>
                Coords: {latlng.lat.toFixed(6)}, {latlng.lng.toFixed(6)}
              </Text>
            )}
          </View>
        </Card.Content>

        <Card.Actions style={{ justifyContent: 'flex-end' }}>
          {latlng && (
            <>
              <Button
                compact
                onPress={() => openInMaps(latlng.lat, latlng.lng, titulo)}
                icon={() => <Ionicons name="map" size={16} />}
              >
                Mapa
              </Button>
              {/* 👇 Eliminado botón Copiar */}
              <Divider style={{ height: 24, marginHorizontal: 4 }} />
            </>
          )}

          {canSeeDetails && (
            <Button
              compact
              onPress={() => router.push({ pathname: '/incendios/detalles', params: { id: item.incendio.incendio_uuid } })}
              icon={() => <Ionicons name="information-circle-outline" size={16} />}
            >
              Detalles
            </Button>
          )}
        </Card.Actions>
      </Card>
    );
  };

  // ===== Header =====
  const Header = () => (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#4CAF50' }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Mis reportes</Text>
      <Text style={{ color: '#E8F5E9', fontSize: 12 }}>{items.length} / {total}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
      <Header />

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.reporte_uuid}
          renderItem={RenderItem}
          onEndReachedThreshold={0.2}
          onEndReached={onEndReached}
          onMomentumScrollBegin={() => { onEndReachedCalledDuringMomentum.current = false; }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
              <Ionicons name="list" size={36} color="#9E9E9E" />
              <Text style={{ marginTop: 8, color: '#777' }}>Aún no tienes reportes.</Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}

      <Snackbar visible={!!errorMsg} onDismiss={() => setErrorMsg('')} duration={3500} action={{ label: 'OK', onPress: () => setErrorMsg('') }}>
        {errorMsg}
      </Snackbar>
    </View>
  );
}
