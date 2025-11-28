// app/incendios/detalles.tsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Text, Button, Divider, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getIncendio, Incendio, aprobarIncendio, rechazarIncendio, getHistorialEstados, HistorialEstado } from '@/services/incendios';
import { api } from '@/client';
import { getUser } from '@/session';
import { subscribe, EVENTS } from '@/hooks/events';
import { showToast } from '@/hooks/uiStore';

// NUEVO: mismo helper usado en el mapa para resolver portada
import { getFirstPhotoUrlByIncendio } from '@/services/photos';

// Sistema de cierre dinámico con plantillas
import FormularioCierre from '@/components/FormularioCierre';
import { getFormularioCierre, FormularioCierre as FormularioCierreType } from '@/services/cierre';

type Tab = 'ACT' | 'REP' | 'INFO';

// --- helper para portada directa (si viene en el payload) ---
const getCoverUrl = (it: any): string | null =>
  it?.portadaUrl ||
  it?.foto_portada_url ||
  it?.thumbnailUrl ||
  it?.fotos?.[0]?.url ||
  null;

export default function DetalleIncendio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Incendio | null>(null);
  const [, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('ACT');

  const [siguiendo, setSiguiendo] = useState(false);
  const [loadingSeguir, setLoadingSeguir] = useState(false);

  // Estado para cierre dinámico
  const [formularioCierre, setFormularioCierre] = useState<FormularioCierreType | null>(null);
  const [cierreModalVisible, setCierreModalVisible] = useState(false);

  // Estado para historial de cambios
  const [historial, setHistorial] = useState<HistorialEstado[]>([]);

  // Gateo de UI: no mostrar hasta que datos + imagen estén listos (o timeout)
  const [dataReady, setDataReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  // Cache local para portadas resueltas y estado de portada final
  const metaCacheRef = useRef<{ covers: Record<string, string> }>({ covers: {} });
  const [resolvedCover, setResolvedCover] = useState<string | null>(null);

  useEffect(() => { (async () => { try { setUser(await getUser()); } catch {} })(); }, []);


  useEffect(() => {
  const checkSiguiendo = async () => {
    try {
      const res = await api.get(`/incendios/${id}/siguiendo`);
      setSiguiendo(res.data.siguiendo);
    } catch (error) {
      console.error('Error verificando seguimiento:', error);
    }
  };
  if (id) {
    checkSiguiendo();
  }
}, [id]);

  const isAdmin: boolean = user?.is_admin === true;

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setDataReady(false);

      const data = await getIncendio(String(id));
      setItem(data);

      // Formulario de cierre dinámico
      try {
        const formCierre = await getFormularioCierre(String(id));
        setFormularioCierre(formCierre);
      } catch (err) {
        // Si no hay formulario, no pasa nada
        setFormularioCierre(null);
      }

      // Historial de cambios de estado
      try {
        const hist = await getHistorialEstados(String(id));
        setHistorial(hist);
      } catch (err) {
        // Si no hay historial, array vacío
        setHistorial([]);
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'No se pudo cargar el incendio' });
    } finally {
      setLoading(false);
      setDataReady(true);
    }
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    const u1 = subscribe(EVENTS.INCENDIO_UPDATED, (p) => { if (p?.id === String(id)) refetch(); });
    const u2 = subscribe(EVENTS.INCENDIO_DELETED, (p) => {
      if (p?.id === String(id)) { showToast({ type: 'info', message: 'Este incendio fue eliminado/ocultado' }); router.replace('/mapa'); }
    });
    return () => { u1(); u2(); };
  }, [id, refetch, router]);

  // --------- Identidades ----------
  const userUuid = user?.usuario_uuid || user?.id || null;

  const creatorCandidates = [
    (item as any)?.creado_por?.usuario_uuid,
    (item as any)?.creado_por_uuid,
    (item as any)?.creadoPor?.usuario_uuid,
    (item as any)?.creado_por_id,
    (item as any)?.created_by_uuid,
    (item as any)?.createdBy?.id,
    (item as any)?.createdById,
    (item as any)?.usuario_creador_uuid,
  ];
  const creadorUuid = (creatorCandidates.find(v => typeof v === 'string' && v) as string) || null;

  // Ahora el reportante es el mismo que el creador (reporte fusionado)
  const reporterCandidates = [
    (item as any)?.reportado_por?.usuario_uuid,
    (item as any)?.reportado_por_uuid,
  ];
  const reportadorUuid = (reporterCandidates.find(v => typeof v === 'string' && v) as string) || null;

  const isCreator = !!(userUuid && creadorUuid && String(userUuid) === String(creadorUuid));
  const isReporter = !!(userUuid && reportadorUuid && String(userUuid) === String(reportadorUuid));

  const puedeModerarse = useMemo(() => {
    if (!item || !user) return false;
    return isAdmin || isCreator || isReporter;
  }, [isAdmin, item, user, isCreator, isReporter]);

  const isAprobado = item?.aprobado === true;

  const updates = useMemo(() => {
    const f = (d?: string) => (d ? new Date(d).toLocaleString() : undefined);
    const out: { id: string; title: string; date?: string; text?: string }[] = [];

    // Agregar cambios de estado del historial
    for (const h of historial) {
      const cambiador = h.cambiado_por
        ? `${h.cambiado_por.nombre} ${h.cambiado_por.apellido}`.trim()
        : 'Sistema';

      out.push({
        id: h.historial_uuid,
        title: `Estado: ${h.estado?.nombre || 'Desconocido'}`,
        date: f(h.creado_en),
        text: h.observacion || `Cambiado por ${cambiador}`,
      });
    }

    return out.sort((a, b) => (new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
  }, [historial]);

  const infoBasico = useMemo(() => {
    if (!item) return [];
    const rows = [];

    const f = (d?: string | null) => (d ? new Date(d).toLocaleString() : undefined);
    const lat = (item as any)?.lat ?? item?.ubicacion?.coordinates?.[1] ?? (item as any)?.centroide?.coordinates?.[1];
    const lon = (item as any)?.lng ?? (item as any)?.lon ?? item?.ubicacion?.coordinates?.[0] ?? (item as any)?.centroide?.coordinates?.[0];

    if (item.titulo) {
      rows.push({ id: 'titulo', title: 'Título', text: item.titulo });
    }
    if (item.descripcion) {
      rows.push({ id: 'desc', title: 'Descripción', text: item.descripcion });
    }
    if (lat != null && lon != null) {
      rows.push({ id: 'coord', title: 'Coordenadas', text: `${lat.toFixed(6)}, ${lon.toFixed(6)}` });
    }
    if ((item as any)?.departamento?.nombre) {
      rows.push({ id: 'depto', title: 'Departamento', text: (item as any).departamento.nombre });
    }
    if ((item as any)?.municipio?.nombre) {
      rows.push({ id: 'muni', title: 'Municipio', text: (item as any).municipio.nombre });
    }
    if ((item as any)?.lugar_poblado) {
      rows.push({ id: 'lugar', title: 'Lugar poblado', text: (item as any).lugar_poblado });
    }
    if ((item as any)?.finca) {
      rows.push({ id: 'finca', title: 'Finca', text: (item as any).finca });
    }
    if ((item as any)?.medio?.nombre) {
      rows.push({ id: 'medio', title: 'Medio de reporte', text: (item as any).medio.nombre });
    }
    if ((item as any)?.telefono) {
      rows.push({ id: 'tel', title: 'Teléfono', text: (item as any).telefono });
    }

    const reportadoEn = f((item as any).reportado_en || null);
    if (reportadoEn) {
      rows.push({ id: 'reportado', title: 'Reportado en', text: reportadoEn });
    }
    const creadoEn = f((item as any).creadoEn || (item as any).creado_en || null);
    if (creadoEn) {
      rows.push({ id: 'creado', title: 'Creado en', text: creadoEn });
    }
    const aprobadoEn = f((item as any).aprobadoEn || (item as any).aprobado_en || null);
    if (aprobadoEn) {
      rows.push({ id: 'aprob_en', title: 'Aprobado en', text: aprobadoEn });
    }

    return rows;
  }, [item, isAprobado]);


  // --- portada calculada directa (si viene en payload) ---
  const coverUrl = useMemo(() => getCoverUrl(item), [item]);

  // Igual que en Mapa: resolver portada con caché y servicio
  const ensureCoverUrl = useCallback(async (incendioId: string, base: any): Promise<string | null> => {
    if (!incendioId) return null;

    // 1) direct fields
    const direct =
      base?.portadaUrl ||
      base?.foto_portada_url ||
      base?.thumbnailUrl ||
      base?.fotos?.[0]?.url ||
      null;
    if (typeof direct === 'string' && direct.trim()) {
      const normalized = encodeURI(direct);
      metaCacheRef.current.covers[incendioId] = normalized;
      return normalized;
    }

    // 2) cache
    if (metaCacheRef.current.covers[incendioId]) {
      return metaCacheRef.current.covers[incendioId];
    }

    // 3) service
    try {
      const url = await getFirstPhotoUrlByIncendio(incendioId);
      if (url && typeof url === 'string') {
        const normalized = encodeURI(url);
        metaCacheRef.current.covers[incendioId] = normalized;
        return normalized;
      }
    } catch (e) {
      console.log('[ensureCoverUrl] error', e);
    }
    return null;
  }, []);

  // Resolver portada final (prioriza coverUrl; si no hay, usa servicio)
  useEffect(() => {
    let cancelled = false;
    setResolvedCover(null);

    const go = async () => {
      const incendioId =
        String(
          (item as any)?.id ??
          (item as any)?.incendio_uuid ??
          ''
        );

      if (!incendioId) {
        setResolvedCover(coverUrl ? encodeURI(coverUrl) : null);
        return;
      }

      const direct = coverUrl ? encodeURI(coverUrl) : null;
      const url = direct || (await ensureCoverUrl(incendioId, item || {}));
      if (!cancelled) setResolvedCover(url || null);
    };

    go();
    return () => { cancelled = true; };
  }, [item, coverUrl, ensureCoverUrl]);

  // Prefetch con timeout (no bloquea indefinidamente)
  const prefetchWithTimeout = useCallback(async (url: string, ms = 5000) => {
    try {
      const ok = await Promise.race<boolean>([
        Image.prefetch(url).then(() => true).catch(() => false),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), ms)),
      ]);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const toggleSeguir = () => {
  if (siguiendo) {
    // Si ya sigue, confirmar si quiere dejar de seguir
    Alert.alert(
      'Dejar de seguir',
      '¿Dejar de recibir notificaciones de este incendio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, dejar de seguir',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingSeguir(true);
              await api.delete(`/incendios/${id}/seguir`);
              setSiguiendo(false);
              Alert.alert('Dejaste de seguir este incendio');
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo realizar la acción');
            } finally {
              setLoadingSeguir(false);
            }
          },
        },
      ]
    );
  } else {
    // Si no sigue, confirmar si quiere seguir
    Alert.alert(
      'Seguir incendio',
      '¿Recibir notificaciones cuando haya actualizaciones?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, seguir',
          onPress: async () => {
            try {
              setLoadingSeguir(true);
              await api.post(`/incendios/${id}/seguir`);
              setSiguiendo(true);
              Alert.alert('Ahora sigues este incendio. Recibirás notificaciones de actualizaciones.');
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo realizar la acción');
            } finally {
              setLoadingSeguir(false);
            }
          },
        },
      ]
    );
  }
};

  // Gateo de imagen: esperamos a que haya resolvedCover (o no haya) + prefetch/timeout
  useEffect(() => {
    let cancelled = false;
    setImageReady(false);

    if (!resolvedCover) {
      // no hay portada → no bloquea UI
      setImageReady(true);
      return;
    }

    (async () => {
      await prefetchWithTimeout(resolvedCover, 5000);
      if (!cancelled) setImageReady(true);
    })();

    return () => { cancelled = true; };
  }, [resolvedCover, prefetchWithTimeout]);

  // Gateo global
  if (!dataReady || !imageReady) {
    return (
      <View style={styles.loading}>
        <Text>Cargando…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.loading}>
        <Text>Sin datos</Text>
      </View>
    );
  }

  // KPIs del reporte inicial (ahora en el incendio)
  const repDepto = (item as any)?.departamento?.nombre || '—';
  const repMuni  = (item as any)?.municipio?.nombre || '—';
  const repFecha = (item as any)?.reportado_en ? new Date((item as any).reportado_en).toLocaleString() : '—';
  const repMedio = (item as any)?.medio?.nombre || '—';

  const repUsuario = (item as any)?.reportado_por || (item as any)?.creado_por || (item as any)?.creadoPor || null;
  const repNombre = [repUsuario?.nombre, repUsuario?.apellido].filter(Boolean).join(' ') || (item as any)?.reportado_por_nombre || '—';
  const repInstit = (item as any)?.institucion_reporte?.nombre || (repUsuario?.institucion?.nombre ?? '—');
  const repTel = (item as any)?.telefono ?? repUsuario?.telefono ?? '—';

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: '#666' }}>{label}</Text>
      <Text style={{ fontWeight: 'bold' }}>{value || '—'}</Text>
    </View>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );

  const getStatusColors = (s: string) => {
    switch (s) {
      case 'Extinguido':   return { bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' };
      case 'Controlado':   return { bg: '#FFF8E1', text: '#EF6C00', border: '#FFE0B2' };
      case 'En atención':  return { bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' };
      default:             return { bg: '#F3E5F5', text: '#6A1B9A', border: '#E1BEE7' };
    }
  };
  const StatusBadge = ({ status }: { status: string }) => {
    const { bg, text, border } = getStatusColors(status);
    return (
      <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
        <Text style={{ color: text, fontWeight: 'bold' }}>{status}</Text>
      </View>
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        <Text style={styles.pageTitle}>Detalles del incendio</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.titulo}</Text>
            {/* Badge de estado de aprobación */}
            {item.aprobado && (
              <View style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: 'bold' }}>✓ Aprobado</Text>
              </View>
            )}
            {!item.aprobado && item.requiereAprobacion && !item.motivoRechazo && (
              <View style={{ backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                <Text style={{ color: '#E65100', fontSize: 12, fontWeight: 'bold' }}>⏱ Pendiente de aprobación</Text>
              </View>
            )}
            {item.motivoRechazo && (
              <View style={{ backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                <Text style={{ color: '#C62828', fontSize: 12, fontWeight: 'bold' }}>✗ Rechazado</Text>
              </View>
            )}
          </View>

          <IconButton
            icon={siguiendo ? 'bell' : 'bell-outline'}
            size={24}
            iconColor={siguiendo ? '#2196F3' : '#666'}
            onPress={toggleSeguir}
            disabled={loadingSeguir}
            style={{ margin: 0 }}
          />
        </View>

        {/* Portada/compartible */}
        <View style={{ marginTop: 8 }}>
          <Image
            source={resolvedCover ? { uri: resolvedCover } : require('@/assets/images/placeholder_incendio.png')}
            style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: '#eee' }}
            resizeMode="cover"
            onError={() => setResolvedCover(null)} // fallback al placeholder si falla
          />
        </View>

        {/* KPIs del último reporte */}
        <View style={styles.kpisTop}>
          <View style={styles.kpiBox}><Text style={styles.kpiTop}>Departamento</Text><Text style={styles.kpiBottom}>{repDepto}</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiTop}>Municipio</Text><Text style={styles.kpiBottom}>{repMuni}</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiTop}>Reportado en</Text><Text style={styles.kpiBottom}>{repFecha}</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiTop}>Medio</Text><Text style={styles.kpiBottom}>{repMedio}</Text></View>
        </View>

        {/* Estado/Aprobado */}


        <Text style={styles.meta}>
          Creado por {[((item as any)?.creado_por?.nombre || (item as any)?.creadoPor?.nombre), ((item as any)?.creado_por?.apellido || (item as any)?.creadoPor?.apellido)].filter(Boolean).join(' ') || '—'}
          {(item as any).creadoEn || (item as any).creado_en ? ` • ${new Date(((item as any).creadoEn || (item as any).creado_en)).toLocaleString()}` : ''}
        </Text>

        {/* Mostrar motivo de rechazo si existe */}
        {item?.motivoRechazo && (
          <View style={{ backgroundColor: '#FFEBEE', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#C62828', marginBottom: 12 }}>
            <Text style={{ fontWeight: 'bold', color: '#C62828', marginBottom: 4 }}>⚠️ Incendio Rechazado</Text>
            <Text style={{ color: '#555' }}>Motivo: {item.motivoRechazo}</Text>
            {(item as any).rechazadoEn && (
              <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                Rechazado el {new Date((item as any).rechazadoEn).toLocaleString()}
              </Text>
            )}
          </View>
        )}

        {/* Aprobación / Rechazo */}
        {(!isAprobado && puedeModerarse) && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button mode="contained" style={[styles.mainBtn, { backgroundColor: '#2E7D32' }]}
              onPress={async () => {
                try {
                  await aprobarIncendio(String(id));
                  await refetch();
                  showToast({ type: 'success', message: 'Incendio aprobado' });
                } catch {
                  Alert.alert('Error', 'No se pudo aprobar');
                }
              }}>
              Aprobar
            </Button>
            <Button mode="contained" style={[styles.mainBtn, { backgroundColor: '#C62828' }]}
              onPress={() => {
                Alert.prompt(
                  'Rechazar incendio',
                  'Indica el motivo del rechazo:',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Rechazar',
                      style: 'destructive',
                      onPress: async (motivo: string | undefined) => {
                        const motivoFinal = motivo?.trim() || 'Sin motivo especificado';
                        try {
                          await rechazarIncendio(String(id), motivoFinal);
                          await refetch();
                          showToast({ type: 'info', message: 'Incendio rechazado' });
                        } catch {
                          Alert.alert('Error', 'No se pudo rechazar');
                        }
                      }
                    }
                  ],
                  'plain-text'
                );
              }}>
              Rechazar
            </Button>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsWrap}>
          <View style={styles.tabsCentered}>
            <TouchableOpacity onPress={() => setTab('ACT')}><Text style={[styles.tab, tab === 'ACT' && styles.tabSel]}>Historial</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('REP')}><Text style={[styles.tab, tab === 'REP' && styles.tabSel]}>Reportante</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('INFO')}><Text style={[styles.tab, tab === 'INFO' && styles.tabSel]}>Información</Text></TouchableOpacity>
          </View>
        </View>
        <Divider />

        <View style={{ paddingHorizontal: 4 }}>
          {tab === 'ACT' && (
            <View style={{ paddingVertical: 12 }}>
              <Text style={styles.sectionTitle}>Historial de cambios</Text>
              {updates.length ? updates.map((u) => (
                <View key={u.id} style={styles.card}>
                  <Text style={{ fontWeight: 'bold' }}>{u.title}</Text>
                  {u.date ? <Text style={{ color: '#666', fontSize: 12 }}>{u.date}</Text> : null}
                  {!!u.text && <Text style={{ marginTop: 4, color: '#555' }}>{u.text}</Text>}
                </View>
              )) : <Text style={{ color: '#999', textAlign: 'center', marginTop: 16 }}>No hay cambios registrados.</Text>}
            </View>
          )}

          {tab === 'REP' && (
            <View style={{ paddingVertical: 12 }}>
              <Text style={styles.sectionTitle}>Información del reportante</Text>
              <View style={styles.card}>
                <Row label="Nombre" value={repNombre} />
                <Row label="Institución" value={repInstit} />
                <Row label="Teléfono" value={repTel} />
              </View>
            </View>
          )}

          {tab === 'INFO' && (
            <View style={{ paddingVertical: 12 }}>
              <Text style={styles.sectionTitle}>Información básica</Text>
              <View style={styles.card}>
                {infoBasico.map((row) => (
                  <View key={row.id} style={{ marginBottom: 8 }}>
                    <Text style={{ color: '#666' }}>{row.title}</Text>
                    <Text style={{ fontWeight: 'bold' }}>{row.text}</Text>
                  </View>
                ))}
              </View>

              {/* Sección de cierre dinámico */}
              {puedeModerarse && formularioCierre && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionTitle}>Formulario de Cierre</Text>

                  {formularioCierre.extinguido && (
                    <View style={{ backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#2E7D32' }}>
                      <Text style={{ color: '#2E7D32', fontWeight: 'bold' }}>✓ Incendio Extinguido</Text>
                    </View>
                  )}

                  <Button
                    mode="contained"
                    onPress={() => setCierreModalVisible(true)}
                    style={{ marginBottom: 12 }}
                  >
                    {formularioCierre.extinguido ? 'Ver datos de cierre' : 'Completar formulario de cierre'}
                  </Button>

                  {/* Resumen de respuestas */}
                  <View style={styles.card}>
                    <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8 }}>
                      {formularioCierre.plantilla.nombre}
                    </Text>
                    {formularioCierre.secciones.map((seccion) => {
                      const respuestasCompletas = seccion.campos.filter((c) => c.respuesta).length;
                      const total = seccion.campos.length;

                      return (
                        <View key={seccion.seccion_uuid} style={{ marginVertical: 4 }}>
                          <Text style={{ fontSize: 13, color: '#666' }}>
                            {seccion.nombre}: {respuestasCompletas}/{total} completado
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal de formulario de cierre */}
      <FormularioCierre
        visible={cierreModalVisible}
        incendioUuid={String(id)}
        onClose={() => setCierreModalVisible(false)}
        onSaved={async () => {
          await refetch();
        }}
        canFinalize={isAdmin}
      />
    </>
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

  kpisTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  kpiBox: { flexGrow: 1, flexBasis: '46%', backgroundColor: '#fff', borderRadius: 10, padding: 10, borderColor: '#EEE', borderWidth: 1 },
  kpiTop: { color: '#666' },
  kpiBottom: { fontWeight: 'bold', marginTop: 4 },

  kpis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  kpi: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: '#EEE' },

  meta: { color: '#666' },

  mainBtn: { borderRadius: 10, marginTop: 8 },

  tabsWrap: { paddingVertical: 8 },
  tabsCentered: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 },
  tab: { fontSize: 14, color: '#666' },
  tabSel: { color: '#2E7D32', fontWeight: 'bold' },

  sectionTitle: { fontWeight: 'bold', marginBottom: 8, fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderColor: '#EEE', borderWidth: 1 },

  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
