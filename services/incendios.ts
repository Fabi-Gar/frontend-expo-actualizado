// services/incendios.ts
import { api } from '../client';

/** ---------- Tipos compartidos (UUID en todas las IDs) ---------- */
export type UsuarioRef = {
  id: string;
  nombre: string;
  correo?: string;
  creadoEn?: string;
} | null;

export type EstadoRef = { id: string; nombre: string; color?: string | null };

export type EstadoActual = {
  id: string;
  fecha: string;
  estado: EstadoRef;
  cambiadoPor?: UsuarioRef;
};

export type RegionRef =
  | { id: string | null; nombre: string; codigo?: string | null }
  | string
  | null;

export type Reporte = {
  id: string;
  descripcion: string;
  fecha: string;
  creadoPor?: UsuarioRef;
  fotos?: { id: string; url: string; orden?: number | null }[];
};

export type UltimoReporteRef = {
  reportadoPorNombre?: string | null;
  reportadoEn?: string | null;
  telefono?: string | null;
} | null;

export type Incendio = {
  fotos: any;
  id: string;
  titulo: string;
  descripcion?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  visiblePublico?: boolean;

  aprobado?: boolean;
  aprobadoEn?: string | null;
  rechazadoEn?: string | null;
  requiereAprobacion?: boolean;
  motivoRechazo?: string | null;

  creadoEn?: string;
  creadoPor?: UsuarioRef;
  ubicacion?: { type: 'Point'; coordinates: [number, number] } | null;
  region?: RegionRef;
  validadoPor?: UsuarioRef;
  etiquetas?: { id: string; nombre: string }[];
  reportes?: Reporte[];
  estadoActual?: EstadoActual | null;
  ultimoReporte?: UltimoReporteRef;

  lat?: number | null;
  lng?: number | null;
  lon?: number | null;

  portadaUrl?: string | null;
  thumbnailUrl?: string | null;
};

export type Paginated<T> = {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
};

/** ---------- Endpoint MAPA (legacy) ---------- */
export type IncendioMapItem = {
  id: string;
  titulo: string;
  visiblePublico: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  lon: number | null;
  lat: number | null;
  thumbnailUrl?: string | null;
};

export type IncendiosMapResponse = {
  window: { startZ: string; endZ: string };
  total: number;
  page: number;
  pageSize: number;
  items: IncendioMapItem[];
};

export async function getIncendiosMap(params?: {
  date?: string; // YYYY-MM-DD
  include?: 'thumbnail';
  order?: 'actividad' | 'creacion';
  bbox?: string; // minLon,minLat,maxLon,maxLat
  near?: string; // lon,lat
  km?: number;
  limit?: number;
  page?: number;
}) {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    q.append(k, String(v));
  });
  const qs = q.toString();
  const { data } = await api.get<IncendiosMapResponse>(`/incendios/map${qs ? `?${qs}` : ''}`);
  return data;
}

/** ---------- Helpers internos ---------- */

function getDateLike(obj: any, keys: string[], fallback: string | null = null) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v) return v;
  }
  return fallback;
}

function getStr(obj: any, keys: string[], fallback: string | null = null) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string') return v;
  }
  return fallback;
}

function getBool(obj: any, keys: string[], fallback = false) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'boolean') return v;
  }
  return fallback;
}

function pickId(o: any): string {
  return (
    o?.incendio_uuid ||
    o?.id ||
    o?.uuid ||
    o?.incendioId ||
    o?.incendioUUID ||
    ''
  );
}

// Mapea distintos formatos de estado actual -> EstadoActual
function normalizeEstadoActual(raw: any): EstadoActual | null | undefined {
  const ea = raw?.estadoActual ?? raw?.estado_actual;
  if (!ea) return ea;

  // Caso 1: { estado: {id,nombre,color}, fecha / fechaCambio }
  if (ea.estado) {
    return {
      id: ea.id ?? ea.estado?.id ?? '',
      fecha: ea.fecha ?? ea.fechaCambio ?? new Date().toISOString(),
      estado: {
        id: ea.estado?.id ?? ea.id ?? '',
        nombre: ea.estado?.nombre ?? ea.nombre ?? '',
        color: ea.estado?.color ?? ea.color ?? null,
      },
      cambiadoPor: ea.cambiadoPor ?? null,
    };
  }

  // Caso 2: { id, nombre, color, fechaCambio }
  return {
    id: ea.id ?? '',
    fecha: ea.fechaCambio ?? ea.fecha ?? new Date().toISOString(),
    estado: { id: ea.id ?? '', nombre: ea.nombre ?? '', color: ea.color ?? null },
    cambiadoPor: null,
  };
}

function normalizeIncendioCoords(it: Incendio): Incendio {
  const lon = (it as any)?.ubicacion?.coordinates?.[0];
  const lat = (it as any)?.ubicacion?.coordinates?.[1];
  const normLon =
    typeof lon === 'number' ? lon : (it as any).lon ?? (it as any).lng ?? null;
  const normLat = typeof lat === 'number' ? lat : (it as any).lat ?? null;
  const normLng = it?.lng != null ? it.lng : normLon;
  const estadoActual = normalizeEstadoActual(it as any);
  return { ...it, lon: normLon, lat: normLat, lng: normLng as any, estadoActual };
}

function fromBackendIncendio(raw: any): Incendio {
  const id = pickId(raw);

  const titulo =
    getStr(raw, ['titulo', 'nombre']) || `Incendio ${id?.slice(0, 8)}`;

  const fechaInicio =
    getDateLike(raw, ['fechaInicio', 'fecha_inicio', 'inicio_at']) ?? null;

  const fechaFin =
    getDateLike(raw, ['fechaFin', 'fecha_fin', 'fin_at', 'extinguido_at']) ?? null;

  const visiblePublico = getBool(raw, ['visiblePublico', 'visible_publico'], true);

  // ubicación: prioriza centroide
  const centroide =
    raw?.centroide && raw.centroide.type === 'Point' ? raw.centroide : undefined;
  const ubicacion =
    centroide ??
    (raw?.ubicacion && raw.ubicacion.type === 'Point'
      ? raw.ubicacion
      : undefined);

  const portadaUrl = getStr(raw, ['portadaUrl', 'portada_url']) ?? null;
  const thumbnailUrl = getStr(raw, ['thumbnailUrl', 'thumbnail_url']) ?? null;

  const aprobadoEn = getDateLike(raw, ['aprobado_en']) ?? null;
  const rechazadoEn = getDateLike(raw, ['rechazado_en']) ?? null;
  const requiereAprobacion = !!raw?.requiere_aprobacion;
  const motivoRechazo = getStr(raw, ['motivo_rechazo']) ?? null;

  const aprobado =
    raw?.aprobado === true ||
    (!!aprobadoEn && !rechazadoEn) || false;

  // creado_por → creadoPor
  const creador = raw?.creado_por
    ? ({
        id: raw.creado_por.usuario_uuid ?? raw.creado_por.id ?? null,
        nombre: `${raw.creado_por.nombre ?? ''} ${raw.creado_por.apellido ?? ''}`.trim() || raw.creado_por.email || '',
        correo: raw.creado_por.email ?? undefined,
      } as UsuarioRef)
    : raw?.creadoPor ?? null;

  // region: del endpoint /with-ultimo-reporte (jsonb {region_uuid, nombre}) o fallback string
  let region: RegionRef = raw?.region ?? null;
  if (region && typeof region === 'object' && ('region_uuid' in region || 'id' in region || 'nombre' in region)) {
    region = {
      id: (region as any).region_uuid ?? (region as any).id ?? null,
      nombre: (region as any).nombre ?? (typeof region === 'string' ? region : ''),
      codigo: (region as any).codigo ?? null,
    };
  } else if (typeof region === 'string') {
    region = { id: null, nombre: region };
  }

  // ultimo_reporte del endpoint /with-ultimo-reporte
  const ultimoReporte: UltimoReporteRef =
    raw?.ultimo_reporte
      ? {
          reportadoPorNombre: raw.ultimo_reporte.reportado_por_nombre ?? null,
          reportadoEn: raw.ultimo_reporte.reportado_en ?? null,
          telefono: raw.ultimo_reporte.telefono ?? null,
        }
      : null;

  const base: Incendio = {
    fotos: raw?.fotos ?? [],
    id,
    titulo,
    descripcion: getStr(raw, ['descripcion', 'observaciones']) ?? null,
    fechaInicio,
    fechaFin,
    visiblePublico,

    aprobado,
    aprobadoEn,
    rechazadoEn,
    requiereAprobacion,
    motivoRechazo,

    creadoEn: getDateLike(raw, ['creado_en', 'creadoEn']) ?? undefined,
    creadoPor: creador,
    ubicacion: ubicacion ?? null,
    region,
    validadoPor: raw?.validadoPor ?? null,
    etiquetas: raw?.etiquetas ?? [],
    reportes: raw?.reportes ?? [],
    estadoActual: normalizeEstadoActual(raw) ?? null,
    ultimoReporte,

    portadaUrl,
    thumbnailUrl,
  };

  // ⬇️ Inyectar foto suelta si el backend la incluyó (de /with-reporte multipart)
  if (raw?.foto?.url) {
    try {
      const fotosArr = Array.isArray(base.fotos) ? base.fotos : [];
      fotosArr.push({
        id: raw.foto.foto_reporte_uuid ?? raw.foto.id ?? 'foto-0',
        url: raw.foto.url,
        orden: 0,
      });
      base.fotos = fotosArr;
      if (!base.portadaUrl) base.portadaUrl = raw.foto.url;
    } catch {}
  }
  // ⬆️ Fin inyección de foto

  return normalizeIncendioCoords(base);
}

export function fechaReferencia(it: Incendio): string | null {
  return (
    it.estadoActual?.fecha ??
    it.aprobadoEn ??
    it.creadoEn ??
    it.fechaInicio ??
    it.fechaFin ??
    null
  );
}


/** ---------- CRUD /incendios ---------- */
export async function listIncendiosPaged(page = 1, pageSize = 50): Promise<Paginated<Incendio>> {
  const { data } = await api.get(`/incendios?page=${page}&pageSize=${pageSize}`);
  // Soporta tanto respuesta paginada ({items}) como arreglo directo
  if (Array.isArray(data)) {
    return {
      total: data.length,
      page,
      pageSize,
      items: data.map(fromBackendIncendio),
    };
  }
  const pag = data as Paginated<any>;
  pag.items = (pag.items || []).map(fromBackendIncendio);
  return pag as Paginated<Incendio>;
}

export async function listIncendios(page = 1, pageSize = 50): Promise<Incendio[]> {
  const res = await listIncendiosPaged(page, pageSize);
  return res.items;
}

export async function listIncendiosArray(page = 1, pageSize = 2000): Promise<Incendio[]> {
  return listIncendios(page, pageSize);
}

export async function getIncendio(id: string) {
  const { data } = await api.get(`/incendios/${id}`);
  return fromBackendIncendio(data);
}

/** ---------- Crear / Actualizar / Eliminar ---------- */
export async function createIncendio(payload: Partial<Incendio> & { lat?: number; lng?: number; lon?: number }) {
  const body: any = {
    titulo: payload.titulo,
    descripcion: payload.descripcion ?? null,
    visiblePublico: payload.visiblePublico ?? true,
    fechaInicio: payload.fechaInicio ?? null,
    fechaFin: payload.fechaFin ?? null,
    portadaUrl: payload.portadaUrl ?? null,
    portadaCredito: (payload as any).portadaCredito ?? null,
  };

  const lon = payload.lon ?? payload.lng ?? payload.ubicacion?.coordinates?.[0] ?? null;
  const lat = payload.lat ?? payload.ubicacion?.coordinates?.[1] ?? null;
  if (typeof lon === 'number' && typeof lat === 'number') {
    body.ubicacion = { type: 'Point', coordinates: [lon, lat] as [number, number] };
  }

  const regionId = (payload as any).regionId ?? (payload as any).region?.id;
  if (regionId != null) body.regionId = regionId as string;

  const validadoPorId = (payload as any).validadoPorId ?? (payload as any).validadoPor?.id;
  if (validadoPorId != null) body.validadoPorId = validadoPorId as string;

  if ((payload as any).etiquetasIds != null) body.etiquetasIds = (payload as any).etiquetasIds as string[];

  if ((payload as any).estadoInicialId) body.estadoInicialId = (payload as any).estadoInicialId;
  if ((payload as any).estadoInicialNombre) body.estadoInicialNombre = (payload as any).estadoInicialNombre;

  const { data } = await api.post('/incendios', body);
  return fromBackendIncendio(data);
}

export async function updateIncendio(id: string, payload: Partial<Incendio> & { lat?: number; lng?: number; lon?: number }) {
  const body: any = { ...payload };

  if (payload.lat != null || payload.lon != null || payload.lng != null) {
    const lon = payload.lon ?? payload.lng ?? null;
    const lat = payload.lat ?? null;
    if (typeof lon === 'number' && typeof lat === 'number') {
      body.ubicacion = { type: 'Point', coordinates: [lon, lat] as [number, number] };
    }
    delete body.lat; delete body.lon; delete body.lng;
  }

  if ('region' in body && body.region && (body.region as any).id) {
    body.regionId = (body.region as any).id;
    delete body.region;
  }
  if ('regionId' in body && body.regionId == null) body.regionId = null;

  if ('validadoPor' in body && body.validadoPor && (body.validadoPor as any).id) {
    body.validadoPorId = (body.validadoPor as any).id;
    delete body.validadoPor;
  }
  if ('validadoPorId' in body && body.validadoPorId == null) body.validadoPorId = null;

  if ('etiquetasIds' in body && !Array.isArray(body.etiquetasIds)) body.etiquetasIds = [];

  if (body.estado && (body.estado as any).id) {
    body.estadoId = (body.estado as any).id;
    delete body.estado;
  }

  const { data } = await api.patch(`/incendios/${id}`, body);
  return fromBackendIncendio(data);
}

export async function deleteIncendio(id: string) {
  const { data } = await api.delete<{ ok: boolean }>(`/incendios/${id}`);
  return data;
}

/** ---------- Crear incendio + reporte (JSON anidado, legacy/compat) ---------- */

export type CreateWithReportePayload = {
  titulo: string;
  descripcion?: string | null;
  centroide: { type: 'Point'; coordinates: [number, number] };
  estado_incendio_uuid?: string; // opcional: el server pone default si no viene
  reporte: {
    medio_uuid: string;
    ubicacion?: { type: 'Point'; coordinates: [number, number] }; // si no viene, usamos centroide
    reportado_en?: string;                // default: now()
    observaciones?: string | null;
    telefono?: string | null;
    departamento_uuid?: string | null;
    municipio_uuid?: string | null;
    lugar_poblado?: string | null;
    finca?: string | null;
    // institucion_uuid: la setea el backend desde el token/perfil
  };
};

/**
 * Intenta POST /incendios/with-reporte (body anidado JSON)
 * si no existe, intenta /incendios/with-reporte2.
 * (Se mantiene por compatibilidad cuando no hay archivo).
 */
export async function createIncendioWithReporte(payload: CreateWithReportePayload) {
  const body = {
    incendio: {
      titulo: payload.titulo,
      descripcion: payload.descripcion ?? null,
      centroide: payload.centroide ?? null,
      estado_incendio_uuid: payload.estado_incendio_uuid,
    },
    reporte: {
      medio_uuid: payload.reporte.medio_uuid,
      ubicacion: payload.reporte.ubicacion ?? payload.centroide ?? null,
      reportado_en: payload.reporte.reportado_en ?? new Date().toISOString(),
      observaciones: payload.reporte.observaciones ?? null,
      telefono: payload.reporte.telefono ?? null,
      departamento_uuid: payload.reporte.departamento_uuid ?? null,
      municipio_uuid: payload.reporte.municipio_uuid ?? null,
      lugar_poblado: payload.reporte.lugar_poblado ?? null,
      finca: payload.reporte.finca ?? null,
    },
  };

  try {
    const { data } = await api.post('/incendios/with-reporte', body);
    return {
      incendio: fromBackendIncendio(data),
      // pasa el uuid crudo que manda el backend
      reporte_uuid:
        data?.reporte_uuid ||
        data?.reporte?.reporte_uuid ||
        (Array.isArray(data?.reportes) ? data.reportes[0]?.reporte_uuid : null) ||
        null,
      raw: data, // útil si luego quieres inspeccionar más campos
    };
  } catch (e: any) {
    if (e?.response?.status === 404) {
      const { data } = await api.post('/incendios/with-reporte2', body);
      return {
        incendio: fromBackendIncendio(data),
        reporte_uuid:
          data?.reporte_uuid ||
          data?.reporte?.reporte_uuid ||
          (Array.isArray(data?.reportes) ? data.reportes[0]?.reporte_uuid : null) ||
          null,
        raw: data,
      };
    }
    throw e;
  }
}

/** ---------- Crear incendio + reporte (multipart con file y foto en respuesta) ---------- */

export type CreateWithReporteFormParams = {
  incendio: {
    titulo: string;
    descripcion?: string | null;
    centroide: { type: 'Point'; coordinates: [number, number] };
    estado_incendio_uuid?: string;
  };
  reporte: {
    medio_uuid: string;
    ubicacion?: { type: 'Point'; coordinates: [number, number] };
    reportado_en?: string;
    observaciones?: string | null;
    telefono?: string | null;
    departamento_uuid?: string | null;
    municipio_uuid?: string | null;
    lugar_poblado?: string | null;
    finca?: string | null;
    credito?: string | null;
  };
  file?: { uri: string; name: string; type: string };
};

/**
 * POST /incendios/with-reporte (multipart: incendio, reporte (JSON) + file)
 * Devuelve el incendio normalizado y, si viene `foto` en la respuesta,
 * la mete en `fotos` y también como `portadaUrl` (si no existe).
 */
export async function createIncendioWithReporteForm(params: CreateWithReporteFormParams): Promise<Incendio> {
  const fd = new FormData();
  fd.append('incendio', JSON.stringify(params.incendio));
  fd.append('reporte', JSON.stringify(params.reporte));
  if (params.file) {
    fd.append('file', params.file as any);
  }

  const { data } = await api.post('/incendios/with-reporte', fd, {
    transformRequest: (x) => x, // deja que Axios defina el boundary
  });

  // Si el backend devuelve { foto: { url, ... } }, adjúntala
  const merged = {
    ...data,
    fotos: Array.isArray(data?.fotos) ? data.fotos.slice() : [],
  };

  if (data?.foto?.url) {
    const foto = data.foto;
    merged.fotos.push({
      id: foto.foto_reporte_uuid ?? foto.id ?? 'foto-0',
      url: foto.url,
      orden: 0,
    });
    // si no hay portadaUrl, usa la recién subida
    if (!merged.portadaUrl && !merged.portada_url) {
      merged.portadaUrl = foto.url;
    }
  }

  return fromBackendIncendio(merged);
}

/**
 * Wrapper opcional: si se pasa `file`, usa multipart; si no, usa el JSON actual.
 */
export async function createIncendioWithReporteSmart(
  payload: CreateWithReportePayload & {
    file?: { uri: string; name: string; type: string } | null;
    creditoFoto?: string | null;
  }
) {
  if (payload.file) {
    const { file, creditoFoto, ...rest } = payload as any;
    return createIncendioWithReporteForm({
      incendio: {
        titulo: rest.titulo,
        descripcion: rest.descripcion ?? null,
        centroide: rest.centroide,
        estado_incendio_uuid: rest.estado_incendio_uuid,
      },
      reporte: {
        medio_uuid: rest.reporte.medio_uuid,
        ubicacion: rest.reporte.ubicacion ?? rest.centroide,
        reportado_en: rest.reporte.reportado_en ?? new Date().toISOString(),
        observaciones: rest.reporte.observaciones ?? null,
        telefono: rest.reporte.telefono ?? null,
        departamento_uuid: rest.reporte.departamento_uuid ?? null,
        municipio_uuid: rest.reporte.municipio_uuid ?? null,
        lugar_poblado: rest.reporte.lugar_poblado ?? null,
        finca: rest.reporte.finca ?? null,
        credito: creditoFoto ?? null,
      },
      file: file ?? undefined,
    });
  }

  // Si no hay archivo, usa el flujo JSON que ya tenías
  return createIncendioWithReporte(payload);
}

/** ---------- Otros helpers ---------- */
export async function hideIncendio(id: string) {
  const { data } = await api.patch(`/incendios/${id}`, {
    visiblePublico: false,
  });
  return fromBackendIncendio(data);
}

export async function setEstadoIncendio(
  incendioId: string,
  opts: {
    estadoId?: string;
    estadoNombre?: string;
    notaEstado?: string;
    fechaEstado?: string;
    cambiadoPorId?: string;
  }
) {
  const { data } = await api.patch(`/incendios/${incendioId}`, opts);
  return fromBackendIncendio(data);
}

/** ---------- NUEVOS: feeds para mapa y admin ---------- */

/**
 * Incendios aprobados, con:
 * - creado_por (nombre, apellido, email)
 * - region (o fallback depto/muni del último reporte)
 * - ultimo_reporte { reportado_por_nombre, reportado_en, telefono }
 * GET /incendios/with-ultimo-reporte
 */
export async function listIncendiosWithUltimoReporte(params?: {
  q?: string;
  desde?: string; // ISO
  hasta?: string; // ISO
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.desde) qs.set('desde', params.desde);
  if (params?.hasta) qs.set('hasta', params.hasta);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const url = `/incendios/with-ultimo-reporte${qs.toString() ? `?${qs}` : ''}`;

  const { data } = await api.get<{ total: number; page: number; pageSize: number; items: any[] }>(url);
  return {
    total: data.total ?? (data.items?.length ?? 0),
    page: data.page ?? params?.page ?? 1,
    pageSize: data.pageSize ?? params?.pageSize ?? (data.items?.length ?? 0),
    items: (data.items ?? []).map(fromBackendIncendio) as Incendio[],
  } as Paginated<Incendio>;
}

/**
 * Incendios NO aprobados (admin) con los mismos campos extra.
 * GET /incendios/sin-aprobar
 */
export async function listIncendiosSinAprobar(params?: {
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const url = `/incendios/sin-aprobar${qs.toString() ? `?${qs}` : ''}`;

  const { data } = await api.get<{ total: number; page: number; pageSize: number; items: any[] }>(url);
  return {
    total: data.total ?? (data.items?.length ?? 0),
    page: data.page ?? params?.page ?? 1,
    pageSize: data.pageSize ?? params?.pageSize ?? (data.items?.length ?? 0),
    items: (data.items ?? []).map(fromBackendIncendio) as Incendio[],
  } as Paginated<Incendio>;
}


// --- aprobar / rechazar ---
export async function aprobarIncendio(id: string) {
  const { data } = await api.patch(`/incendios/${id}/aprobar`, {});
  return fromBackendIncendio(data);
}

export async function rechazarIncendio(id: string, motivo: string) {
  const { data } = await api.patch(`/incendios/${id}/rechazar`, { motivo_rechazo: motivo });
  return fromBackendIncendio(data);
}
