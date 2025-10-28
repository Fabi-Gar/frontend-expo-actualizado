// app/incendios/detalles.tsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Text, Button, Divider, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getIncendio, Incendio, aprobarIncendio, rechazarIncendio } from '@/services/incendios';
import { getCierre, initCierre, finalizarCierre, reabrirCierre } from '@/services/cierre';
import { api } from '@/client';
import { getUser } from '@/session';
import { subscribe, EVENTS } from '@/hooks/events';
import { showToast } from '@/hooks/uiStore';

import CierreEditor from '@/components/CierreEditor';
// NUEVO: mismo helper usado en el mapa para resolver portada
import { getFirstPhotoUrlByIncendio } from '@/services/photos';

type Tab = 'ACT' | 'REP' | 'INFO';

// --- helper para portada directa (si viene en el payload) ---
const getCoverUrl = (it: any, ultimo?: any): string | null =>
  it?.portadaUrl ||
  it?.foto_portada_url ||
  it?.thumbnailUrl ||
  it?.fotos?.[0]?.url ||
  ultimo?.foto_portada_url ||
  ultimo?.thumbnailUrl ||
  ultimo?.fotos?.[0]?.url ||
  null;

export default function DetalleIncendio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Incendio | null>(null);
  const [, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('ACT');
  const [cierre, setCierre] = useState<any>(null);

  const [ultimoReporte, setUltimoReporte] = useState<any | null>(null);
  const [primerReporte, setPrimerReporte] = useState<any | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);

  const [siguiendo, setSiguiendo] = useState(false);
const [loadingSeguir, setLoadingSeguir] = useState(false);

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

      // Último reporte (visual)
      try {
        const { data: repUlt } = await api.get(`/reportes`, { params: { incendio_uuid: id, pageSize: 1 } });
        setUltimoReporte((repUlt?.items || [])[0] ?? null);
      } catch { setUltimoReporte(null); }

      // Primer reporte (permiso)
      try {
        const { data: repPrim } = await api.get(`/reportes`, { params: { incendio_uuid: id, pageSize: 1, order: 'ASC' } });
        setPrimerReporte((repPrim?.items || [])[0] ?? null);
      } catch { setPrimerReporte(null); }

      // Cierre
      try {
        const c = await getCierre(String(id));
        setCierre(c);
      } catch { setCierre(null); }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'No se pudo cargar el incendio' });
    } finally {
      setLoading(false);
      setDataReady(true);
    }
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);

  const estadoCierre = useMemo(() => {
    const sc = cierre?.secuencia_control || {};
    if (sc?.extinguido_at) return 'Extinguido';
    if (sc?.controlado_at) return 'Controlado';
    if (sc?.llegada_medios_terrestres_at || sc?.llegada_medios_aereos_at) return 'En atención';
    return 'Pendiente';
  }, [cierre]);

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

  const firstReporterUuid =
    primerReporte?.reportado_por?.usuario_uuid ??
    (primerReporte as any)?.reportado_por_uuid ??
    null;

  const isCreator = !!(userUuid && creadorUuid && String(userUuid) === String(creadorUuid));
  const isFirstReporter = !!(userUuid && firstReporterUuid && String(userUuid) === String(firstReporterUuid));

  const puedeModerarse = useMemo(() => {
    if (!item || !user) return false;
    return isAdmin || isCreator;
  }, [isAdmin, item, user, isCreator]);

  const canSeeCierre = true;

  const canEditCierre = useMemo(() => {
    if (!userUuid) return false;
    return isAdmin || isCreator || isFirstReporter;
  }, [isAdmin, isCreator, isFirstReporter, userUuid]);

  const canFinalizeCierre = isAdmin || isCreator;

  const isAprobado = item?.aprobado === true;

  const updates = useMemo(() => {
    const f = (d?: string) => (d ? new Date(d).toLocaleString() : undefined);
    const out: { id: string; title: string; date?: string; text?: string }[] = [];

    if (cierre?.updates?.length) {
      for (const u of cierre.updates) {
        out.push({
          id: u.id,
          title: u.descripcion_corta || u.tipo || 'Actualización',
          date: f(u.creado_en),
          text: u.creado_por_nombre ? `Por ${u.creado_por_nombre}` : undefined,
        });
      }
    } else {
      if ((item as any)?.estadoActual) {
        const ea = (item as any).estadoActual;
        out.push({
          id: `estado-${ea.id}`,
          title: `Estado: ${ea?.estado?.nombre || ''}`,
          date: f(ea?.fecha),
          text: ea?.cambiadoPor?.nombre ? `Por ${ea.cambiadoPor.nombre}` : undefined,
        });
      }
      for (const r of ((item as any)?.reportes || [])) {
        out.push({ id: r.id, title: 'Actualización', date: f(r.fecha as any), text: r.descripcion || '' });
      }
    }
    return out.sort((a, b) => (new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
  }, [item, cierre]);

  const infoBasico = useMemo(() => {
    if (!item) return [];
    const f = (d?: string | null) => (d ? new Date(d).toLocaleString() : '—');
    const lat = (item as any)?.lat ?? item?.ubicacion?.coordinates?.[1] ?? (item as any)?.centroide?.coordinates?.[1];
    const lon = (item as any)?.lng ?? (item as any)?.lon ?? item?.ubicacion?.coordinates?.[0] ?? (item as any)?.centroide?.coordinates?.[0];

    return [
      { id: 'titulo', title: 'Título', text: item.titulo || '—' },
      { id: 'desc', title: 'Descripción', text: item.descripcion || '—' },
      { id: 'coord', title: 'Coordenadas', text: (lat != null && lon != null) ? `${lat}, ${lon}` : '—' },
      { id: 'aprob', title: 'Aprobado', text: isAprobado ? 'Sí' : 'No' },
      { id: 'aprob_en', title: 'Aprobado en', text: f((item as any).aprobadoEn || (item as any).aprobado_en || null) },
      { id: 'creado', title: 'Creado en', text: f((item as any).creadoEn || (item as any).creado_en || null) },
    ];
  }, [item, isAprobado]);


  // --- portada calculada directa (si viene en payload) ---
  const coverUrl = useMemo(() => getCoverUrl(item, ultimoReporte), [item, ultimoReporte]);

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
          (ultimoReporte as any)?.incendio_uuid ??
          ''
        );

      if (!incendioId) {
        setResolvedCover(coverUrl ? encodeURI(coverUrl) : null);
        return;
      }

      const direct = coverUrl ? encodeURI(coverUrl) : null;
      const url = direct || (await ensureCoverUrl(incendioId, item || ultimoReporte || {}));
      if (!cancelled) setResolvedCover(url || null);
    };

    go();
    return () => { cancelled = true; };
  }, [item, ultimoReporte, coverUrl, ensureCoverUrl]);

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

  // KPIs (visual) del último reporte
  const repDepto = ultimoReporte?.departamento?.nombre || '—';
  const repMuni  = ultimoReporte?.municipio?.nombre || '—';
  const repFecha = ultimoReporte?.reportado_en ? new Date(ultimoReporte.reportado_en).toLocaleString() : '—';
  const repMedio = ultimoReporte?.medio?.nombre || '—';

  const repUsuario = ultimoReporte?.reportado_por || (item as any)?.creado_por || (item as any)?.creadoPor || null;
  const repNombre = [repUsuario?.nombre, repUsuario?.apellido].filter(Boolean).join(' ') || ultimoReporte?.reportado_por_nombre || '—';
  const repInstit = ultimoReporte?.institucion?.nombre || (repUsuario?.institucion?.nombre ?? '—');
  const repIsAdmin = (repUsuario?.is_admin === true) ? 'Sí' : 'No';
  const repTel = repUsuario?.telefono ?? ultimoReporte?.telefono ?? '—';

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

  const openEditor = async () => {
    if (!canEditCierre) return;
    try {
      if (!cierre) {
        await initCierre(String(id));
        showToast({ type: 'success', message: 'Cierre iniciado' });
        await refetch();
      }
      setEditorVisible(true);
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el cierre');
    }
  };

  const renderCierre = () => {
    if (!cierre) {
      return (
        <View style={styles.card}>
          <Text>Sin información de cierre.</Text>
          {canEditCierre && (
            <Button mode="outlined" style={{ marginTop: 8 }} onPress={openEditor}>
              Iniciar y agregar datos de cierre
            </Button>
          )}
        </View>
      );
    }

    return (
      <>
        <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusBadge status={estadoCierre} />
          {canEditCierre && (
            <Button mode="outlined" onPress={() => setEditorVisible(true)}>
              Editar datos de cierre
            </Button>
          )}
        </View>

        {(cierre?.tipo_incendio_principal?.nombre || (cierre?.composicion_tipo?.length ?? 0) > 0) && (
          <Section title="Tipo de incendio">
            {cierre?.tipo_incendio_principal?.nombre && <Row label="Principal" value={cierre.tipo_incendio_principal.nombre} />}
            {Array.isArray(cierre?.composicion_tipo) && cierre.composicion_tipo.length > 0 && (
              <Row label="Composición" value={cierre.composicion_tipo.map((x: any) => `${x.tipo_incendio_nombre} ${x.pct}%`).join(' • ')} />
            )}
          </Section>
        )}

        {(cierre?.topografia && (cierre.topografia.plano_pct != null || cierre.topografia.ondulado_pct != null || cierre.topografia.quebrado_pct != null)) && (
          <Section title="Topografía">
            <Row label="Plano" value={cierre.topografia.plano_pct != null ? `${cierre.topografia.plano_pct}%` : '—'} />
            <Row label="Ondulado" value={cierre.topografia.ondulado_pct != null ? `${cierre.topografia.ondulado_pct}%` : '—'} />
            <Row label="Quebrado" value={cierre.topografia.quebrado_pct != null ? `${cierre.topografia.quebrado_pct}%` : '—'} />
          </Section>
        )}

        {Array.isArray(cierre?.propiedad) && cierre.propiedad.length > 0 && (
          <Section title="Tipo de propiedad">
            {cierre.propiedad.map((p: any, i: number) => (
              <Row key={`prop_${i}`} label={p.tipo_propiedad_nombre} value={p.usado ? 'Usado' : 'No usado'} />
            ))}
          </Section>
        )}

        {cierre?.iniciado_junto_a?.iniciado_nombre && (
          <Section title="Iniciado junto a">
            <Row label="Elemento" value={cierre.iniciado_junto_a.iniciado_nombre} />
          </Section>
        )}

        {(cierre?.secuencia_control &&
          (cierre.secuencia_control.llegada_medios_terrestres_at ||
           cierre.secuencia_control.llegada_medios_aereos_at ||
           cierre.secuencia_control.controlado_at ||
           cierre.secuencia_control.extinguido_at)) && (
          <Section title="Secuencia de control">
            {cierre.secuencia_control.llegada_medios_terrestres_at && (
              <Row label="Llegada medios terrestres" value={new Date(cierre.secuencia_control.llegada_medios_terrestres_at).toLocaleString()} />
            )}
            {cierre.secuencia_control.llegada_medios_aereos_at && (
              <Row label="Llegada medios aéreos" value={new Date(cierre.secuencia_control.llegada_medios_aereos_at).toLocaleString()} />
            )}
            {cierre.secuencia_control.controlado_at && (
              <Row label="Controlado" value={new Date(cierre.secuencia_control.controlado_at).toLocaleString()} />
            )}
            {cierre.secuencia_control.extinguido_at && (
              <Row label="Extinguido" value={new Date(cierre.secuencia_control.extinguido_at).toLocaleString()} />
            )}
          </Section>
        )}

        {(cierre?.superficie && (cierre.superficie.area_total_ha != null ||
          cierre.superficie.dentro_ap_ha != null ||
          cierre.superficie.fuera_ap_ha != null ||
          cierre.superficie.nombre_ap)) && (
          <Section title="Superficie">
            <Row label="Área total (ha)" value={cierre.superficie.area_total_ha != null ? String(cierre.superficie.area_total_ha) : '—'} />
            <Row label="Dentro de AP (ha)" value={cierre.superficie.dentro_ap_ha != null ? String(cierre.superficie.dentro_ap_ha) : '—'} />
            <Row label="Fuera de AP (ha)" value={cierre.superficie.fuera_ap_ha != null ? String(cierre.superficie.fuera_ap_ha) : '—'} />
            {cierre.superficie.nombre_ap && <Row label="Área protegida" value={cierre.superficie.nombre_ap} />}
          </Section>
        )}

        {Array.isArray(cierre?.superficie_vegetacion) && cierre.superficie_vegetacion.length > 0 && (
          <Section title="Superficie por vegetación">
            {cierre.superficie_vegetacion.map((v: any, i: number) => (
              <Row key={`veg_${i}`} label={`${v?.ubicacion || ''} • ${v?.categoria || ''}${v?.subtipo ? ` (${v.subtipo})` : ''}`} value={v?.area_ha != null ? `${v.area_ha} ha` : '—'} />
            ))}
          </Section>
        )}

        {Array.isArray(cierre?.tecnicas) && cierre.tecnicas.length > 0 && (
          <Section title="Técnicas de extinción">
            {cierre.tecnicas.map((t: any, i: number) => (
              <Row key={`tec_${i}`} label={t?.tecnica || 'Técnica'} value={t?.pct != null ? `${t.pct}%` : '—'} />
            ))}
          </Section>
        )}

        {(Array.isArray(cierre?.medios?.terrestres) && cierre.medios.terrestres.length > 0) && (
          <Section title="Medios terrestres">
            {cierre.medios.terrestres.map((m: any, i: number) => (
              <Row key={`mt_${i}`} label={m.medio_terrestre_nombre} value={`Cantidad: ${m?.cantidad ?? '—'}`} />
            ))}
          </Section>
        )}
        {(Array.isArray(cierre?.medios?.aereos) && cierre.medios.aereos.length > 0) && (
          <Section title="Medios aéreos">
            {cierre.medios.aereos.map((m: any, i: number) => (
              <Row key={`ma_${i}`} label={m.medio_aereo_nombre} value={`${m?.pct ?? 0}%`} />
            ))}
          </Section>
        )}
        {(Array.isArray(cierre?.medios?.acuaticos) && cierre.medios.acuaticos.length > 0) && (
          <Section title="Medios acuáticos">
            {cierre.medios.acuaticos.map((m: any, i: number) => (
              <Row key={`mac_${i}`} label={m.medio_acuatico_nombre} value={`Cantidad: ${m?.cantidad ?? '—'}`} />
            ))}
          </Section>
        )}
        {(Array.isArray(cierre?.medios?.instituciones) && cierre.medios.instituciones.length > 0) && (
          <Section title="Instituciones participantes">
            {cierre.medios.instituciones.map((m: any, i: number) => (
              <Row key={`mi_${i}`} label="Institución" value={m.institucion_nombre} />
            ))}
          </Section>
        )}

        {Array.isArray(cierre?.abastos) && cierre.abastos.length > 0 && (
          <Section title="Abastos">
            {cierre.abastos.map((a: any, i: number) => (
              <Row key={`ab_${i}`} label={a?.abasto_nombre || 'Abasto'} value={`Cant: ${a?.cantidad ?? '—'}`} />
            ))}
          </Section>
        )}

        {(cierre?.causa?.causa_nombre || cierre?.causa?.otro_texto) && (
          <Section title="Causa probable">
            <Row label="Causa" value={cierre.causa.causa_nombre || cierre.causa.otro_texto || '—'} />
          </Section>
        )}

        {(cierre?.meteo && (cierre.meteo.temp_c != null || cierre.meteo.hr_pct != null || cierre.meteo.viento_vel != null || cierre.meteo.viento_dir)) && (
          <Section title="Condiciones meteorológicas">
            <Row label="Temperatura" value={cierre.meteo.temp_c != null ? `${cierre.meteo.temp_c} °C` : '—'} />
            <Row label="Humedad relativa" value={cierre.meteo.hr_pct != null ? `${cierre.meteo.hr_pct}%` : '—'} />
            <Row label="Viento" value={[
              cierre.meteo.viento_vel != null ? `${cierre.meteo.viento_vel} km/h` : null,
              cierre.meteo.viento_dir || null,
            ].filter(Boolean).join(' • ') || '—'} />
          </Section>
        )}

        {cierre?.nota && (
          <Section title="Notas">
            <Text>{cierre.nota}</Text>
          </Section>
        )}

        {/* Acciones del cierre */}
        {canEditCierre && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {estadoCierre !== 'Extinguido' && canFinalizeCierre && (
              <Button
                mode="contained"
                onPress={async () => {
                  try { await finalizarCierre(String(id)); await refetch(); showToast({ type: 'success', message: 'Cierre finalizado' }); }
                  catch { Alert.alert('Error', 'No se pudo finalizar'); }
                }}
              >
                Finalizar
              </Button>
            )}
            {isAdmin && estadoCierre === 'Extinguido' && (
              <Button
                mode="outlined"
                onPress={async () => {
                  try { await reabrirCierre(String(id)); await refetch(); showToast({ type: 'success', message: 'Cierre reabierto' }); }
                  catch { Alert.alert('Error', 'No se pudo reabrir'); }
                }}
              >
                Reabrir
              </Button>
            )}
          </View>
        )}
      </>
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
          <View>
            <Text style={styles.title}>{item.titulo}</Text>
            <Text style={styles.sub}>{estadoCierre}</Text>
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
        <View style={styles.kpis}>
          <View style={styles.kpi}><Text style={styles.kpiTop}>Estado</Text><Text style={styles.kpiBottom}>{estadoCierre}</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiTop}>Aprobado</Text><Text style={styles.kpiBottom}>{isAprobado ? 'Sí' : 'No'}</Text></View>
        </View>

        <Text style={styles.meta}>
          Creado por {[((item as any)?.creado_por?.nombre || (item as any)?.creadoPor?.nombre), ((item as any)?.creado_por?.apellido || (item as any)?.creadoPor?.apellido)].filter(Boolean).join(' ') || '—'}
          {(item as any).creadoEn || (item as any).creado_en ? ` • ${new Date(((item as any).creadoEn || (item as any).creado_en)).toLocaleString()}` : ''}
        </Text>

        {/* Aprobación / Rechazo */}
        {(!isAprobado && puedeModerarse) && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button mode="contained" style={[styles.mainBtn, { backgroundColor: '#2E7D32' }]}
              onPress={async () => { try { await aprobarIncendio(String(id)); await refetch(); showToast({ type: 'success', message: 'Incendio aprobado' }); } catch { Alert.alert('Error', 'No se pudo aprobar'); } }}>
              Aprobar
            </Button>
            <Button mode="contained" style={[styles.mainBtn, { backgroundColor: '#C62828' }]}
              onPress={async () => { try { await rechazarIncendio(String(id), 'Revisión: no aprobado'); await refetch(); showToast({ type: 'info', message: 'Incendio rechazado' }); } catch { Alert.alert('Error', 'No se pudo rechazar'); } }}>
              Rechazar
            </Button>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsWrap}>
          <View style={styles.tabsCentered}>
            <TouchableOpacity onPress={() => setTab('ACT')}><Text style={[styles.tab, tab === 'ACT' && styles.tabSel]}>Actualizaciones</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('REP')}><Text style={[styles.tab, tab === 'REP' && styles.tabSel]}>Reportante</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('INFO')}><Text style={[styles.tab, tab === 'INFO' && styles.tabSel]}>Información</Text></TouchableOpacity>
          </View>
        </View>
        <Divider />

        <View style={{ paddingHorizontal: 4 }}>
          {tab === 'ACT' && (
            <View style={{ paddingVertical: 12 }}>
              <Text style={styles.sectionTitle}>Historial / Reportes</Text>
              {updates.length ? updates.map((u) => (
                <View key={u.id} style={styles.card}>
                  <Text style={{ fontWeight: 'bold' }}>{u.title}</Text>
                  {u.date ? <Text style={{ color: '#666' }}>{u.date}</Text> : null}
                  {!!u.text && <Text style={{ marginTop: 4 }}>{u.text}</Text>}
                </View>
              )) : <Text>No hay actualizaciones.</Text>}
            </View>
          )}

          {tab === 'REP' && (
            <View style={{ paddingVertical: 12 }}>
              <Text style={styles.sectionTitle}>Información del reportante</Text>
              <View style={styles.card}>
                <Row label="Nombre" value={repNombre} />
                <Row label="Institución" value={repInstit} />
                <Row label="Admin" value={repIsAdmin} />
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

              {canSeeCierre && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionTitle}>Cierre</Text>
                  {renderCierre()}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <CierreEditor
        visible={editorVisible}
        incendioId={String(id)}
        onClose={() => setEditorVisible(false)}
        onSaved={async () => {
          setEditorVisible(false);
          await refetch();
          showToast({ type: 'success', message: 'Cierre actualizado' });
        }}
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
