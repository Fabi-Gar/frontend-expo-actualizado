// src/services/cierre.ts
import { api } from '@/client';
import type { EstadoCierre } from '@/app/utils/cierre';

export type Cierre = {
  incendio_uuid: string;
  cerrado: boolean;
  /** Estado de cierre calculado por backend (o inferido como fallback) */
  estado_cierre: EstadoCierre;
  tipo_incendio_principal: { id: string; nombre: string | null } | null;
  composicion_tipo: {
    tipo_incendio_id: string;
    tipo_incendio_nombre: string;
    pct: number;
  }[];
  topografia: {
    plano_pct: number | null;
    ondulado_pct: number | null;
    quebrado_pct: number | null;
  } | null;
  propiedad: { tipo_propiedad_id: string; tipo_propiedad_nombre: string; usado: boolean }[];
  iniciado_junto_a: { iniciado_id: string; iniciado_nombre: string; otro_texto?: string | null } | null;
  secuencia_control: {
    llegada_medios_terrestres_at?: string | null;
    llegada_medios_aereos_at?: string | null;
    controlado_at?: string | null;
    extinguido_at?: string | null;
  } | null;
  superficie: {
    area_total_ha?: number | null;
    dentro_ap_ha?: number | null;
    fuera_ap_ha?: number | null;
    nombre_ap?: string | null;
  } | null;
  superficie_vegetacion: {
    id: string;
    ubicacion: 'DENTRO_AP' | 'FUERA_AP';
    categoria: 'bosque_natural' | 'plantacion_forestal' | 'otra_vegetacion';
    subtipo?: string | null;
    area_ha: number | null;
  }[];
  tecnicas: { tecnica: 'directo' | 'indirecto' | 'control_natural'; pct: number | null }[];
  medios: {
    terrestres: { medio_terrestre_id: string; medio_terrestre_nombre: string; cantidad: number | null }[];
    aereos: { medio_aereo_id: string; medio_aereo_nombre: string; pct: number | null }[];
    acuaticos: { medio_acuatico_id: string; medio_acuatico_nombre: string; cantidad: number | null }[];
    instituciones: { institucion_uuid: string; institucion_nombre: string }[];
  };
  abastos: { abasto_id: string; abasto_nombre: string; cantidad: number | null }[];
  causa: { causa_id: string; causa_nombre: string; otro_texto?: string | null } | null;
  meteo: { temp_c?: number | null; hr_pct?: number | null; viento_vel?: number | null; viento_dir?: string | null } | null;
  updates: { id: string; tipo: string; descripcion_corta: string; creado_en: string; creado_por?: string | null; creado_por_nombre?: string | null }[];
  nota?: string | null;
};

const toNum = (x: any): number | null => (x == null ? null : typeof x === 'number' ? x : Number(x));

function inferEstado(sc: Cierre['secuencia_control']): EstadoCierre {
  if (!sc) return 'Pendiente';
  if (sc.extinguido_at) return 'Extinguido';
  if (sc.controlado_at) return 'Controlado';
  if (sc.llegada_medios_terrestres_at || sc.llegada_medios_aereos_at) return 'En atención';
  return 'Pendiente';
}

function normalize(raw: any): Cierre {
  const comp = Array.isArray(raw?.composicion_tipo)
    ? raw.composicion_tipo.map((o: any) => ({
        tipo_incendio_id: String(o.tipo_incendio_id),
        tipo_incendio_nombre: o.tipo_incendio_nombre,
        pct: toNum(o.pct),
      }))
    : [];

  // backend ya envía tipo_incendio_principal como objeto { id, nombre }
  const tipoPrincipal: { id: string; nombre: string | null } | null = raw?.tipo_incendio_principal
    ? {
        id: String(raw.tipo_incendio_principal.id),
        nombre: raw.tipo_incendio_principal.nombre ?? null,
      }
    : null;

  const secuencia_control = raw?.secuencia_control || null;

  // usa el campo del backend si viene; si no, infiere
  let estado_cierre: EstadoCierre;
  if (typeof raw?.estado_cierre === 'string') {
    const s = raw.estado_cierre.toLowerCase();
    if (s.includes('extin')) estado_cierre = 'Extinguido';
    else if (s.includes('control')) estado_cierre = 'Controlado';
    else if (s.includes('atenc')) estado_cierre = 'En atención';
    else estado_cierre = 'Pendiente';
  } else {
    estado_cierre = inferEstado(secuencia_control);
  }

  return {
    incendio_uuid: raw?.incendio_uuid,
    cerrado: !!raw?.cerrado,
    estado_cierre,

    tipo_incendio_principal: tipoPrincipal,

    composicion_tipo: comp,

    topografia: raw?.topografia
      ? {
          plano_pct: toNum(raw.topografia.plano_pct),
          ondulado_pct: toNum(raw.topografia.ondulado_pct),
          quebrado_pct: toNum(raw.topografia.quebrado_pct),
        }
      : null,

    propiedad: Array.isArray(raw?.propiedad) ? raw.propiedad : [],

    iniciado_junto_a: raw?.iniciado_junto_a || null,

    secuencia_control,

    superficie: raw?.superficie
      ? {
          area_total_ha: toNum(raw.superficie.area_total_ha),
          dentro_ap_ha: toNum(raw.superficie.dentro_ap_ha),
          fuera_ap_ha: toNum(raw.superficie.fuera_ap_ha),
          nombre_ap: raw.superficie.nombre_ap ?? null,
        }
      : null,

    superficie_vegetacion: Array.isArray(raw?.superficie_vegetacion)
      ? raw.superficie_vegetacion.map((v: any) => ({
          id: String(v.id),
          ubicacion: v.ubicacion,
          categoria: v.categoria,
          subtipo: v.subtipo ?? null,
          area_ha: toNum(v.area_ha),
        }))
      : [],

    tecnicas: Array.isArray(raw?.tecnicas)
      ? raw.tecnicas.map((t: any) => ({ tecnica: t.tecnica, pct: toNum(t.pct) }))
      : [],

    medios: {
      terrestres: Array.isArray(raw?.medios?.terrestres)
        ? raw.medios.terrestres.map((m: any) => ({
            medio_terrestre_id: String(m.medio_terrestre_id),
            medio_terrestre_nombre: m.medio_terrestre_nombre,
            cantidad: toNum(m.cantidad),
          }))
        : [],
      aereos: Array.isArray(raw?.medios?.aereos)
        ? raw.medios.aereos.map((m: any) => ({
            medio_aereo_id: String(m.medio_aereo_id),
            medio_aereo_nombre: m.medio_aereo_nombre,
            pct: toNum(m.pct),
          }))
        : [],
      acuaticos: Array.isArray(raw?.medios?.acuaticos)
        ? raw.medios.acuaticos.map((m: any) => ({
            medio_acuatico_id: String(m.medio_acuatico_id),
            medio_acuatico_nombre: m.medio_acuatico_nombre,
            cantidad: toNum(m.cantidad),
          }))
        : [],
      instituciones: Array.isArray(raw?.medios?.instituciones) ? raw.medios.instituciones : [],
    },

    abastos: Array.isArray(raw?.abastos)
      ? raw.abastos.map((a: any) => ({
          abasto_id: String(a.abasto_id),
          abasto_nombre: a.abasto_nombre,
          cantidad: toNum(a.cantidad),
        }))
      : [],

    causa: raw?.causa || null,

    meteo: raw?.meteo
      ? {
          temp_c: toNum(raw.meteo.temp_c),
          hr_pct: toNum(raw.meteo.hr_pct),
          viento_vel: toNum(raw.meteo.viento_vel),
          viento_dir: raw.meteo.viento_dir ?? null,
        }
      : null,

    updates: Array.isArray(raw?.updates) ? raw.updates : [],

    nota: raw?.nota ?? null,
  };
}

export async function getCierre(incendio_uuid: string): Promise<Cierre> {
  const { data } = await api.get(`/cierre/${incendio_uuid}`);
  return normalize(data);
}

export async function initCierre(incendio_uuid: string) {
  const { data } = await api.post('/cierre/init', { incendio_uuid });
  return data;
}

export async function finalizarCierre(incendio_uuid: string) {
  const { data } = await api.post(`/cierre/${incendio_uuid}/finalizar`);
  return data;
}

export async function reabrirCierre(incendio_uuid: string) {
  const { data } = await api.post(`/cierre/${incendio_uuid}/reabrir`);
  return data;
}
