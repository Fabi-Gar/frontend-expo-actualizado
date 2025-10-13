// app/incendios/detalles.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import { Text, Button, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getIncendio, Incendio, aprobarIncendio, rechazarIncendio } from '@/services/incendios';
import { getCierre, initCierre, finalizarCierre, reabrirCierre } from '@/services/cierre';
import { api } from '@/client';
import { getUser } from '@/session';
import { subscribe, EVENTS } from '@/hooks/events';
import { showToast } from '@/hooks/uiStore';

type Tab = 'ACT' | 'REP' | 'INFO';

export default function DetalleIncendio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Incendio | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('ACT');
  const [cierre, setCierre] = useState<any>(null);
  const [ultimoReporte, setUltimoReporte] = useState<any | null>(null);

  // ---- carga de usuario ----
  useEffect(() => {
    (async () => {
      try { setUser(await getUser()); } catch {}
    })();
  }, []);

  // ---- helpers rol/admin ----
  const roleId = user?.rol?.id as number | undefined;
  const roleName = typeof user?.rol?.nombre === 'string' ? user.rol.nombre.toLowerCase() : undefined;
  const isAdmin = roleId === 2 || (roleName?.includes('admin') ?? false);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getIncendio(String(id));
      setItem(data);

      // último reporte de este incendio
      try {
        const { data: rep } = await api.get(`/reportes?incendio_uuid=${id}&pageSize=1`);
        const it = (rep?.items || [])[0] ?? null;
        setUltimoReporte(it);
      } catch {
        setUltimoReporte(null);
      }

      // cierre (si existe)
      try {
        const c = await getCierre(String(id));
        setCierre(c);
      } catch {
        setCierre(null);
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'No se pudo cargar el incendio' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);

  // Estado del cierre (derivado por timestamps)
  const estadoCierre = useMemo(() => {
    const sc = cierre?.secuencia_control || {};
    if (sc?.extinguido_at) return 'Extinguido';
    if (sc?.controlado_at) return 'Controlado';
    if (sc?.llegada_medios_terrestres_at || sc?.llegada_medios_aereos_at) return 'En atención';
    return 'Pendiente';
  }, [cierre]);

  // Suscripciones para refrescar desde otros lugares
  useEffect(() => {
    const u1 = subscribe(EVENTS.INCENDIO_UPDATED, (p) => { if (p?.id === String(id)) refetch(); });
    const u2 = subscribe(EVENTS.INCENDIO_DELETED, (p) => {
      if (p?.id === String(id)) { showToast({ type: 'info', message: 'Este incendio fue eliminado/ocultado' }); router.replace('/mapa'); }
    });
    return () => { u1(); u2(); };
  }, [id, refetch, router]);

  const puedeModerarse = useMemo(() => {
    if (!item || !user) return false;
    if (isAdmin) return true;
    const creadorId =
      (item as any)?.creadoPor?.id ??
      (item as any)?.creado_por?.usuario_uuid ??
      (item as any)?.creadoPorId ??
      (item as any)?.createdBy?.id ??
      (item as any)?.createdById;
    const userId = user?.id || user?.usuario_uuid;
    return creadorId && userId && String(creadorId) === String(userId);
  }, [isAdmin, item, user]);

  const isAprobado = item?.aprobado === true;

  // ---- datos pestaña Actualizaciones ----
  const updates = useMemo(() => {
    const f = (d?: string) => (d ? new Date(d).toLocaleString() : undefined);
    const out: Array<{ id: string; title: string; date?: string; text?: string }> = [];

    // Prioriza el feed de cierre
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
      // Fallback: estadoActual + reportes (si existieran en otra vista)
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

  // ---- pestaña Información: se enfoca en básicos + Cierre (si hay) ----
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

  const onShare = async () => {
    if (!item) return;
    const lat = (item as any)?.lat ?? item?.ubicacion?.coordinates?.[1] ?? (item as any)?.centroide?.coordinates?.[1];
    const lon = (item as any)?.lng ?? (item as any)?.lon ?? item?.ubicacion?.coordinates?.[0] ?? (item as any)?.centroide?.coordinates?.[0];
    const msg = `Incendio: ${item.titulo}\n${item.descripcion || ''}${(lat!=null && lon!=null) ? `\nUbicación: ${lat}, ${lon}` : ''}`;
    try { await Share.share({ message: msg }); } catch {}
  };

  if (!item) {
    return (
      <View style={styles.loading}>
        <Text>{loading ? 'Cargando...' : 'Sin datos'}</Text>
      </View>
    );
  }

  // ------ datos del encabezado superior según último reporte ------
  const repDepto = ultimoReporte?.departamento?.nombre || '—';
  const repMuni  = ultimoReporte?.municipio?.nombre || '—';
  const repFecha = ultimoReporte?.reportado_en ? new Date(ultimoReporte.reportado_en).toLocaleString() : '—';
  const repMedio = ultimoReporte?.medio?.nombre || '—';

  // ------ datos del reportante (preferimos del reporte; si no, del creador) ------
  const repUsuario = ultimoReporte?.reportado_por || (item as any)?.creado_por || (item as any)?.creadoPor || null;
  const repNombre = [repUsuario?.nombre, repUsuario?.apellido].filter(Boolean).join(' ') || ultimoReporte?.reportado_por_nombre || '—';
  const repInstit = ultimoReporte?.institucion?.nombre || (repUsuario?.institucion?.nombre ?? '—');
  const repIsAdmin = (repUsuario?.is_admin === true) ? 'Sí' : 'No';
  const repRol = repUsuario?.rol?.nombre || '—';
  const repTel = repUsuario?.telefono ?? ultimoReporte?.telefono ?? '—';

  // ------- helpers de render -------
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

  // ---- Badge de estado de cierre ----
  const getStatusColors = (s: string) => {
    switch (s) {
      case 'Extinguido':   return { bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' };
      case 'Controlado':   return { bg: '#FFF8E1', text: '#EF6C00', border: '#FFE0B2' };
      case 'En atención':  return { bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' };
      default:             return { bg: '#F3E5F5', text: '#6A1B9A', border: '#E1BEE7' }; // Pendiente
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

  // ------- render de secciones del cierre (solo si existen) -------
  const renderCierre = () => {
    if (!cierre) {
      return (
        <View style={styles.card}>
          <Text>Sin información de cierre.</Text>
          {puedeModerarse && (
            <Button
              mode="outlined"
              style={{ marginTop: 8 }}
              onPress={async () => {
                try { await initCierre(String(id)); await refetch(); showToast({ type: 'success', message: 'Cierre iniciado' }); }
                catch { Alert.alert('Error', 'No se pudo iniciar el cierre'); }
              }}
            >
              Iniciar cierre
            </Button>
          )}
        </View>
      );
    }

    const yaExtinguido = estadoCierre === 'Extinguido';

    return (
      <>
        {/* Badge de estado */}
        <View style={{ marginBottom: 8 }}>
          <StatusBadge status={estadoCierre} />
        </View>

        {/* Tipo principal / Composición */}
        {(cierre?.tipo_incendio_principal?.nombre || (cierre?.composicion_tipo?.length ?? 0) > 0) && (
          <Section title="Tipo de incendio">
            {cierre?.tipo_incendio_principal?.nombre && (
              <Row label="Principal" value={cierre.tipo_incendio_principal.nombre} />
            )}
            {Array.isArray(cierre?.composicion_tipo) && cierre.composicion_tipo.length > 0 && (
              <Row
                label="Composición"
                value={cierre.composicion_tipo
                  .map((x: any) => `${x.tipo_incendio_nombre} ${x.pct}%`)
                  .join(' • ')}
              />
            )}
          </Section>
        )}

        {/* Topografía */}
        {(cierre?.topografia && (cierre.topografia.plano_pct != null || cierre.topografia.ondulado_pct != null || cierre.topografia.quebrado_pct != null)) && (
          <Section title="Topografía">
            <Row label="Plano" value={cierre.topografia.plano_pct != null ? `${cierre.topografia.plano_pct}%` : '—'} />
            <Row label="Ondulado" value={cierre.topografia.ondulado_pct != null ? `${cierre.topografia.ondulado_pct}%` : '—'} />
            <Row label="Quebrado" value={cierre.topografia.quebrado_pct != null ? `${cierre.topografia.quebrado_pct}%` : '—'} />
          </Section>
        )}

        {/* Propiedad */}
        {Array.isArray(cierre?.propiedad) && cierre.propiedad.length > 0 && (
          <Section title="Tipo de propiedad">
            {cierre.propiedad.map((p: any, i: number) => (
              <Row
                key={`prop_${i}`}
                label={p.tipo_propiedad_nombre}
                value={p.usado ? 'Usado' : 'No usado'}
              />
            ))}
          </Section>
        )}

        {/* Iniciado junto a */}
        {cierre?.iniciado_junto_a?.iniciado_nombre && (
          <Section title="Iniciado junto a">
            <Row label="Elemento" value={cierre.iniciado_junto_a.iniciado_nombre} />
          </Section>
        )}

        {/* Secuencia de control */}
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

        {/* Superficie */}
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

        {/* Superficie por vegetación */}
        {Array.isArray(cierre?.superficie_vegetacion) && cierre.superficie_vegetacion.length > 0 && (
          <Section title="Superficie por vegetación">
            {cierre.superficie_vegetacion.map((v: any, i: number) => (
              <Row
                key={`veg_${i}`}
                label={`${v?.ubicacion || ''} • ${v?.categoria || ''}${v?.subtipo ? ` (${v.subtipo})` : ''}`}
                value={v?.area_ha != null ? `${v.area_ha} ha` : '—'}
              />
            ))}
          </Section>
        )}

        {/* Técnicas */}
        {Array.isArray(cierre?.tecnicas) && cierre.tecnicas.length > 0 && (
          <Section title="Técnicas de extinción">
            {cierre.tecnicas.map((t: any, i: number) => (
              <Row key={`tec_${i}`} label={t?.tecnica || 'Técnica'} value={t?.pct != null ? `${t.pct}%` : '—'} />
            ))}
          </Section>
        )}

        {/* Medios */}
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

        {/* Abastos */}
        {Array.isArray(cierre?.abastos) && cierre.abastos.length > 0 && (
          <Section title="Abastos">
            {cierre.abastos.map((a: any, i: number) => (
              <Row key={`ab_${i}`} label={a?.abasto_nombre || 'Abasto'} value={`Cant: ${a?.cantidad ?? '—'}`} />
            ))}
          </Section>
        )}

        {/* Causa */}
        {(cierre?.causa?.causa_nombre || cierre?.causa?.otro_texto) && (
          <Section title="Causa probable">
            <Row label="Causa" value={cierre.causa.causa_nombre || cierre.causa.otro_texto || '—'} />
          </Section>
        )}

        {/* Meteo */}
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

        {/* Nota */}
        {cierre?.nota && (
          <Section title="Notas">
            <Text>{cierre.nota}</Text>
          </Section>
        )}

        {/* Acciones del cierre según estado */}
        {puedeModerarse && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {estadoCierre !== 'Extinguido' && (
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
          {/* Subtítulo muestra el estado del cierre calculado */}
          <Text style={styles.sub}>{estadoCierre}</Text>
        </View>

        {puedeModerarse && (
          <TouchableOpacity onPress={() => router.push({ pathname: '/incendios/crear', params: { id: String(id) } })}>
            <Text style={styles.link}>Editar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPIs arriba del todo sobre el último reporte */}
      <View style={styles.kpisTop}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiTop}>Departamento</Text>
          <Text style={styles.kpiBottom}>{repDepto}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiTop}>Municipio</Text>
          <Text style={styles.kpiBottom}>{repMuni}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiTop}>Reportado en</Text>
          <Text style={styles.kpiBottom}>{repFecha}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiTop}>Medio</Text>
          <Text style={styles.kpiBottom}>{repMedio}</Text>
        </View>
      </View>

      {/* Estado/Aprobado */}
      <View style={styles.kpis}>
        <View style={styles.kpi}>
          <Text style={styles.kpiTop}>Estado</Text>
          {/* KPI de estado también usa el estado calculado */}
          <Text style={styles.kpiBottom}>{estadoCierre}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiTop}>Aprobado</Text>
          <Text style={styles.kpiBottom}>{isAprobado ? 'Sí' : 'No'}</Text>
        </View>
      </View>

      <Text style={styles.meta}>
        Creado por {[((item as any)?.creado_por?.nombre || (item as any)?.creadoPor?.nombre), ((item as any)?.creado_por?.apellido || (item as any)?.creadoPor?.apellido)]
          .filter(Boolean).join(' ') || '—'}
        {(item as any).creadoEn || (item as any).creado_en ? ` • ${new Date(((item as any).creadoEn || (item as any).creado_en)).toLocaleString()}` : ''}
      </Text>

      {/* Acciones principales */}
      {(!isAprobado && puedeModerarse) ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            mode="contained"
            style={[styles.mainBtn, { backgroundColor: '#2E7D32' }]}
            onPress={async () => {
              try { await aprobarIncendio(String(id)); await refetch(); showToast({ type: 'success', message: 'Incendio aprobado' }); }
              catch { Alert.alert('Error', 'No se pudo aprobar'); }
            }}
          >Aprobar</Button>
          <Button
            mode="contained"
            style={[styles.mainBtn, { backgroundColor: '#C62828' }]}
            onPress={async () => {
              try { await rechazarIncendio(String(id), 'Revisión: no aprobado'); await refetch(); showToast({ type: 'info', message: 'Incendio rechazado' }); }
              catch { Alert.alert('Error', 'No se pudo rechazar'); }
            }}
          >Rechazar</Button>
        </View>
      ) : (
        <Button mode="contained" style={[styles.mainBtn, { backgroundColor: '#00B894' }]} onPress={onShare}>
          Compartir incidencia
        </Button>
      )}

      {/* Tabs centradas */}
      <View style={styles.tabsWrap}>
        <View style={styles.tabsCentered}>
          <TouchableOpacity onPress={() => setTab('ACT')}>
            <Text style={[styles.tab, tab === 'ACT' && styles.tabSel]}>Actualizaciones</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('REP')}>
            <Text style={[styles.tab, tab === 'REP' && styles.tabSel]}>Reportante</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('INFO')}>
            <Text style={[styles.tab, tab === 'INFO' && styles.tabSel]}>Información</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Divider />

      {/* Contenido tabs */}
      <View style={{ paddingHorizontal: 4 }}>
        {tab === 'ACT' && (
          <View style={{ paddingVertical: 12 }}>
            <Text style={styles.sectionTitle}>Historial / Reportes</Text>
            {updates.length ? (
              updates.map((u) => (
                <View key={u.id} style={styles.card}>
                  <Text style={{ fontWeight: 'bold' }}>{u.title}</Text>
                  {u.date ? <Text style={{ color: '#666' }}>{u.date}</Text> : null}
                  {!!u.text && <Text style={{ marginTop: 4 }}>{u.text}</Text>}
                </View>
              ))
            ) : (
              <Text>No hay actualizaciones.</Text>
            )}
          </View>
        )}

        {tab === 'REP' && (
          <View style={{ paddingVertical: 12 }}>
            <Text style={styles.sectionTitle}>Información del reportante</Text>
            <View style={styles.card}>
              <Row label="Nombre" value={repNombre} />
              <Row label="Institución" value={repInstit} />
              <Row label="Admin" value={repIsAdmin} />
              <Row label="Rol" value={repRol} />
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

            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionTitle}>Cierre</Text>
              {renderCierre()}
            </View>
          </View>
        )}
      </View>
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

  // Top KPIs from latest report
  kpisTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  kpiBox: { flexGrow: 1, flexBasis: '46%', backgroundColor: '#fff', borderRadius: 10, padding: 10, borderColor: '#EEE', borderWidth: 1 },
  kpiTop: { color: '#666' },
  kpiBottom: { fontWeight: 'bold', marginTop: 4 },

  // secondary KPIs
  kpis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  kpi: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: '#EEE' },

  meta: { color: '#666' },

  mainBtn: { borderRadius: 10, marginTop: 8 },

  // centered tabs
  tabsWrap: { paddingVertical: 8 },
  tabsCentered: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 },
  tab: { fontSize: 14, color: '#666' },
  tabSel: { color: '#2E7D32', fontWeight: 'bold' },

  sectionTitle: { fontWeight: 'bold', marginBottom: 8, fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderColor: '#EEE', borderWidth: 1 },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
