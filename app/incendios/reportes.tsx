// app/reportes/mios.tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, FlatList, Linking, Platform } from 'react-native';
import { ActivityIndicator, Card, Text, Chip, Button, Snackbar, Divider, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { api } from '@/client';
import { getUser } from '@/session';

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
  try {
    const p = r.ubicacion || r.incendio.centroide;
    if (!p || p.type !== 'Point' || !Array.isArray(p.coordinates)) return null;
    const [lng, lat] = p.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: Number(lat), lng: Number(lng) };
  } catch (error) {
    console.error('[getLatLng] Error:', error);
    return null;
  }
};

const openInMaps = (lat: number, lng: number, label = 'Incendio') => {
  try {
    const g = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}(${encodeURIComponent(label)})`;
    const apple = `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(label)}`;
    Linking.openURL(Platform.OS === 'ios' ? apple : g).catch(() => {
      Linking.openURL(g).catch(err => {
        console.error('[openInMaps] Error opening maps:', err);
      });
    });
  } catch (error) {
    console.error('[openInMaps] Error:', error);
  }
};

const fmtDate = (iso?: string | null) => {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    return d.toLocaleString();
  } catch (error) {
    console.error('[fmtDate] Error:', error);
    return String(iso || '');
  }
};

export default function MisReportes() {
  const insets = useSafeAreaInsets();

  // ===== Control de montaje =====
  const isMountedRef = useRef(true);

  // ===== Estado de usuario (admin / no admin) =====
  const [isAdmin, setIsAdmin] = useState(false);

  // ===== Estado de lista/paginación =====
  const [items, setItems] = useState<Reporte[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20; // Constante, no necesita useState
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // ===== Control de concurrencia / cancelación =====
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ===== Rate limiting =====
  const lastRequestTimeRef = useRef<number>(0);

  // ===== Carga de usuario (con protección de memory leak) =====
  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const u = await getUser();
        if (isActive && isMountedRef.current) {
          setIsAdmin(!!u?.is_admin);
        }
      } catch (error) {
        console.error('[getUser] Error:', error);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  // ===== Llamada de datos (estable con useCallback) =====
  const fetchPage = useCallback(async (p: number, replace = false) => {
    if (inFlightRef.current || !isMountedRef.current) {
      console.log('[fetchPage] Request en progreso o componente desmontado, ignorando');
      return;
    }

    // Rate limiting simple
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    if (timeSinceLastRequest < 500) {
      console.log('[fetchPage] Rate limit aplicado, esperando...');
      await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastRequest));
    }

    if (!isMountedRef.current) return;

    inFlightRef.current = true;
    lastRequestTimeRef.current = Date.now();

    // cancela request previa si existe
    if (abortRef.current) {
      abortRef.current.abort();
    }

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
        timeout: 15000,
      });

      // Verificar si el request fue abortado o el componente desmontado
      if (ctrl.signal.aborted || !isMountedRef.current) {
        console.log('[fetchPage] Request abortado o componente desmontado');
        return;
      }

      setTotal(data.total || 0);
      setPage(data.page || p);
      setItems(prev => (replace || p === 1 ? data.items : [...prev, ...data.items]));
      setErrorMsg('');
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.name === 'CanceledError') {
        console.log('[fetchPage] Request cancelado');
        return;
      }

      if (!isMountedRef.current) return;

      console.error('[fetchPage] Error:', {
        status: e?.response?.status,
        message: e?.message,
      });

      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'No se pudieron cargar tus reportes.';
      setErrorMsg(String(msg));
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
      }
      
      if (isMountedRef.current) {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []); // Sin dependencias innecesarias

  // ===== Monta una sola vez (sin loops) =====
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    fetchPage(1, true);
  }, [fetchPage]);

  // ===== Cleanup al desmontar =====
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Cancelar request pendiente
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      // Limpiar flags
      inFlightRef.current = false;
    };
  }, []);

  // ===== Paginación segura =====
  const canLoadMore = items.length < total;

  const onEndReachedCalledDuringMomentum = useRef(false);

  const onEndReached = useCallback(() => {
    try {
      if (onEndReachedCalledDuringMomentum.current) {
        return;
      }
      if (!canLoadMore || inFlightRef.current || !isMountedRef.current) {
        return;
      }

      onEndReachedCalledDuringMomentum.current = true;
      fetchPage(page + 1);
    } catch (error) {
      console.error('[onEndReached] Error:', error);
    }
  }, [canLoadMore, page, fetchPage]);

  const onRefresh = useCallback(() => {
    try {
      if (!isMountedRef.current) return;
      fetchPage(1, true);
    } catch (error) {
      console.error('[onRefresh] Error:', error);
    }
  }, [fetchPage]);

  const handleMomentumScrollBegin = useCallback(() => {
    onEndReachedCalledDuringMomentum.current = false;
  }, []);

  // ===== Render de cada tarjeta (memoizado) =====
  const renderItem = useCallback(({ item }: { item: Reporte }) => {
    try {
      const latlng = getLatLng(item);

      const estadoChip = (() => {
        try {
          const inc = item.incendio;
          if (inc.rechazado_en) {
            return (
              <Chip 
                compact 
                style={{ backgroundColor: '#FFEBEE' }} 
                textStyle={{ color: '#C62828' }}
              >
                Rechazado
              </Chip>
            );
          }
          if (inc.requiere_aprobacion && !inc.aprobado) {
            return (
              <Chip 
                compact 
                style={{ backgroundColor: '#FFF3E0' }} 
                textStyle={{ color: '#EF6C00' }}
              >
                Pend. aprobación
              </Chip>
            );
          }
          if (inc.aprobado) {
            return (
              <Chip 
                compact 
                style={{ backgroundColor: '#E8F5E9' }} 
                textStyle={{ color: '#2E7D32' }}
              >
                Aprobado
              </Chip>
            );
          }
          return <Chip compact>Registrado</Chip>;
        } catch (error) {
          console.error('[estadoChip] Error:', error);
          return <Chip compact>Estado desconocido</Chip>;
        }
      })();

      const titulo = item.incendio.titulo || 'Incendio sin título';
      const subt = [
        item.departamento?.nombre,
        item.municipio?.nombre,
        item.lugar_poblado || null,
      ].filter(Boolean).join(' · ');

      // Lógica de visibilidad del botón "Detalles"
      const canSeeDetails =
        isAdmin ||
        item.incendio.aprobado ||
        !item.incendio.requiere_aprobacion;

      return (
        <Card style={{ marginHorizontal: 12, marginBottom: 10 }} mode="elevated">
          <Card.Title
            title={titulo}
            subtitle={subt || 'Ubicación no especificada'}
            right={() => (
              <View style={{ flexDirection: 'row', gap: 6, marginRight: 8 }}>
                {estadoChip}
              </View>
            )}
          />
          <Card.Content>
            <View style={{ gap: 6 }}>
              <Text variant="bodyMedium">
                Reportado por: <Text style={{ fontWeight: '600' }}>
                  {item.reportado_por_nombre || 'Anónimo'}
                </Text>
              </Text>
              {!!item.telefono && (
                <Text variant="bodyMedium">Tel: {item.telefono}</Text>
              )}
              <Text variant="bodySmall" style={{ color: '#555' }}>
                Reportado: {fmtDate(item.reportado_en)}
              </Text>
              {!!item.observaciones && (
                <Text variant="bodyMedium">Obs.: {item.observaciones}</Text>
              )}
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
                  onPress={() => {
                    try {
                      openInMaps(latlng.lat, latlng.lng, titulo);
                    } catch (error) {
                      console.error('[Mapa button] Error:', error);
                    }
                  }}
                  icon={() => <Ionicons name="map" size={16} />}
                >
                  Mapa
                </Button>
                <Divider style={{ height: 24, marginHorizontal: 4 }} />
              </>
            )}

            {canSeeDetails && (
              <Button
                compact
                onPress={() => {
                  try {
                    router.push({ 
                      pathname: '/incendios/detalles', 
                      params: { id: item.incendio.incendio_uuid } 
                    });
                  } catch (error) {
                    console.error('[Detalles button] Error:', error);
                  }
                }}
                icon={() => <Ionicons name="information-circle-outline" size={16} />}
              >
                Detalles
              </Button>
            )}
          </Card.Actions>
        </Card>
      );
    } catch (error) {
      console.error('[renderItem] Error:', error);
      return (
        <Card style={{ marginHorizontal: 12, marginBottom: 10 }} mode="elevated">
          <Card.Content>
            <Text style={{ color: '#999' }}>Error al mostrar el reporte</Text>
          </Card.Content>
        </Card>
      );
    }
  }, [isAdmin]);

  // ===== Header memoizado =====
const HeaderComponent = useMemo(() => (
  <View style={{ 
    paddingTop: insets.top + 8, 
    paddingBottom: 8, 
    backgroundColor: '#4CAF50' 
  }}>
    {/* Fila del título con botón atrás */}
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      marginBottom: 4,
    }}>
      <IconButton
        icon="arrow-left"
        size={24}
        iconColor="#fff"
        onPress={() => router.back()}
        style={{ margin: 0 }}
      />
      <Text style={{ 
        color: '#fff', 
        fontWeight: 'bold', 
        fontSize: 18,
        flex: 1,
        textAlign: 'center',
      }}>
        Mis reportes
      </Text>
      <View style={{ width: 40 }} />
    </View>
    
    {/* Contador centrado */}
    <Text style={{ 
      color: '#E8F5E9', 
      fontSize: 12,
      textAlign: 'center',
    }}>
      {items.length} / {total}
    </Text>
  </View>
), [insets.top, items.length, total]);

  // ===== Empty component memoizado =====
  const EmptyComponent = useMemo(() => (
    <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
      <Ionicons name="list" size={36} color="#9E9E9E" />
      <Text style={{ marginTop: 8, color: '#777' }}>
        Aún no tienes reportes.
      </Text>
    </View>
  ), []);

  // ===== Footer component memoizado =====
  const FooterComponent = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 12 }}>
        <ActivityIndicator />
      </View>
    );
  }, [loadingMore]);

  // ===== Key extractor estable =====
  const keyExtractor = useCallback((item: Reporte) => item.reporte_uuid, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
      {HeaderComponent}

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onEndReachedThreshold={0.2}
          onEndReached={onEndReached}
          onMomentumScrollBegin={handleMomentumScrollBegin}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListFooterComponent={FooterComponent}
          ListEmptyComponent={EmptyComponent}
          contentContainerStyle={{ paddingVertical: 8 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
        />
      )}

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