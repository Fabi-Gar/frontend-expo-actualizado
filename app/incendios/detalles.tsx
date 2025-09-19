import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getIncendio, Incendio } from '../../services/incendios';
import { IncendioDetailsTabs } from '@/components/IncendioDetailsTabs';
import { getUser } from '../../session';
import { subscribe, EVENTS } from '@/hooks/events';
import { showToast } from '@/hooks/uiStore';

export default function DetalleIncendio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Incendio | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const u = await getUser();
      setUser(u);
    })();
  }, []);

  const roleId = user?.rol?.id as number | undefined;
  const roleName = typeof user?.rol?.nombre === 'string' ? user.rol.nombre.toLowerCase() : undefined;
  const isAdmin = roleId === 2 || (roleName?.includes('admin') ?? false);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getIncendio(String(id));
      setItem(data);
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'No se pudo cargar el incendio' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const u1 = subscribe(EVENTS.INCENDIO_UPDATED, (p) => {
      if (p?.id === String(id)) refetch();
    });
    const u2 = subscribe(EVENTS.INCENDIO_DELETED, (p) => {
      if (p?.id === String(id)) {
        showToast({ type: 'info', message: 'Este incendio fue eliminado/ocultado' });
        router.replace('/mapa');
      }
    });
    return () => {
      u1();
      u2();
    };
  }, [id, refetch, router]);

  const canEdit = useMemo(() => {
    if (!item || !user) return false;
    if (isAdmin) return true;
    const creadorId = (item as any)?.creadoPor?.id ?? (item as any)?.creadoPorId ?? (item as any)?.createdBy?.id ?? (item as any)?.createdById;
    const creadorCorreo = (item as any)?.creadoPor?.correo ?? (item as any)?.creadoPorCorreo ?? (item as any)?.createdBy?.correo;
    const primerReporteCreadorId = item.reportes?.[0]?.creadoPor?.id;
    const userId = user?.id;
    const userCorreo = user?.correo;
    if (creadorId && userId && String(creadorId) === String(userId)) return true;
    if (creadorCorreo && userCorreo && String(creadorCorreo).toLowerCase() === String(userCorreo).toLowerCase()) return true;
    if (primerReporteCreadorId && userId && String(primerReporteCreadorId) === String(userId)) return true;
    return false;
  }, [isAdmin, item, user]);

  const updates = useMemo(() => {
    if (!item) return [];
    const f = (d?: string | Date) => (d ? new Date(d).toLocaleString() : undefined);
    const base = (item.reportes || []).map((r, i) => ({
      id: r.id || `r-${i}`,
      title: 'Actualización',
      date: f(r.fecha as any),
      text: r.descripcion || '',
    }));
    if (item.estadoActual) {
      base.unshift({
        id: `estado-${item.estadoActual.id}`,
        title: `Estado: ${item.estadoActual.estado?.nombre || ''}`,
        date: f(item.estadoActual.fecha),
        text: item.estadoActual.cambiadoPor?.nombre ? `Por ${item.estadoActual.cambiadoPor.nombre}` : '',
      });
    }
    return base;
  }, [item]);

  const info = useMemo(() => {
    if (!item) return [];
    const regionNombre = typeof item.region === 'object' && item.region ? item.region.nombre : 'Sin región';
    const etiquetasTxt = item.etiquetas?.length ? item.etiquetas.map(e => e.nombre).join(', ') : 'Sin etiqueta';
    const estadoNombre = item.estadoActual?.estado?.nombre || 'Sin estado';
    const f = (d?: string | null) => (d ? new Date(d).toLocaleString() : '—');
    const base = [
      { id: 'reg', title: 'Región', text: regionNombre },
      { id: 'area', title: 'Área en m²', text: (item as any).area ? String((item as any).area) : '—' },
      { id: 'etq', title: 'Etiqueta(s)', text: etiquetasTxt },
      { id: 'est', title: 'Estado', text: estadoNombre },
      { id: 'fi', title: 'Fecha inicio', text: f(item.fechaInicio) },
      { id: 'ff', title: 'Fecha fin', text: f(item.fechaFin) },
    ];
    if (isAdmin) {
      base.push(
        { id: 'coord', title: 'Coordenadas', text: `${(item as any).lat ?? '—'}, ${(item as any).lng ?? '—'}` },
        { id: 'vis', title: 'Visible al público', text: item.visiblePublico ? 'Sí' : 'No' },
        { id: 'val', title: 'Validado por', text: (item as any).validadoPor?.nombre ?? '—' },
      );
    }
    return base;
  }, [item, isAdmin]);

  const etiquetaTexto = useMemo(
    () => (item?.etiquetas?.length ? item.etiquetas.map(e => e.nombre).join(', ') : 'Sin etiqueta'),
    [item]
  );

  if (!item) return <View style={styles.loading}><Text>{loading ? 'Cargando...' : 'Sin datos'}</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Detalles del incendio</Text>
      </View>

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{item.titulo}</Text>
          <Text style={styles.sub}>{typeof item.region === 'object' && item.region ? item.region.nombre : 'Sin región'}</Text>
        </View>
        {canEdit && (
          <TouchableOpacity onPress={() => router.push({ pathname: '/incendios/crear', params: { id: String(id) } })}>
            <Text style={styles.link}>Editar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.kpis}>
        <View style={styles.kpi}>
          <Text style={styles.kpiTop}>Área en m²</Text>
          <Text style={styles.kpiBottom}>{(item as any).area ?? '—'}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiTop}>Etiqueta(s)</Text>
          <Text style={styles.kpiBottom}>{etiquetaTexto}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiTop}>Estado</Text>
          <Text style={styles.kpiBottom}>{item.estadoActual?.estado?.nombre || '—'}</Text>
        </View>
      </View>

      <Text style={styles.meta}>
        Creado por {(item as any).creadoPor?.nombre || '—'} {item?.fechaInicio ? `• ${new Date(item.fechaInicio).toLocaleString()}` : ''}
      </Text>

      <Button mode="contained" style={styles.shareBtn} onPress={() => {}}>
        Compartir incidencia
      </Button>

      <IncendioDetailsTabs updates={updates} info={info} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingTop: 40 },
  backBtn: { marginRight: 12, padding: 4 },
  pageTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
  sub: { color: '#666' },
  link: { color: '#4CAF50', fontWeight: 'bold' },
  kpis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  kpi: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: '#EEE' },
  kpiTop: { color: '#666' },
  kpiBottom: { fontWeight: 'bold', marginTop: 4, textAlign: 'center', paddingHorizontal: 6 },
  meta: { color: '#666' },
  shareBtn: { backgroundColor: '#00B894', borderRadius: 10 },
});
