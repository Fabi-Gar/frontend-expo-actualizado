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
  | { id: string; nombre: string; codigo?: string }
  | string
  | null;

export type Reporte = {
  id: string;
  descripcion: string;
  fecha: string;
  creadoPor?: UsuarioRef;
  fotos?: { id: string; url: string; orden?: number | null }[];
};

export type Incendio = {
  fotos: any;
  id: string;
  titulo: string;
  descripcion?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  visiblePublico?: boolean;
  creadoEn?: string;
  creadoPor?: UsuarioRef;
  ubicacion?: { type: 'Point'; coordinates: [number, number] } | null;
  region?: RegionRef;
  validadoPor?: UsuarioRef;
  etiquetas?: { id: string; nombre: string }[];
  reportes?: Reporte[];
  estadoActual?: EstadoActual | null;
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

/** ---------- Endpoint MAPA ---------- */
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

// 🔄 Adaptador principal: backend -> Incendio (front)
function fromBackendIncendio(raw: any): Incendio {
  const id = pickId(raw);
  const titulo =
    getStr(raw, ['titulo', 'nombre']) || `Incendio ${id?.slice(0, 8)}`;
  const fechaInicio = getDateLike(raw, ['fechaInicio', 'fecha_inicio', 'inicio_at']) ?? null;
  const fechaFin =
    getDateLike(raw, ['fechaFin', 'fecha_fin', 'fin_at', 'extinguido_at']) ?? null;
  const visiblePublico = getBool(raw, ['visiblePublico', 'visible_publico'], true);

const ubicacion =
  (raw?.centroide && raw.centroide.type === 'Point')
    ? raw.centroide
    : (raw?.ubicacion && raw.ubicacion.type === 'Point'
        ? raw.ubicacion
        : undefined);

  const portadaUrl =
    getStr(raw, ['portadaUrl', 'portada_url']) ?? null;
  const thumbnailUrl =
    getStr(raw, ['thumbnailUrl', 'thumbnail_url']) ?? null;

  const base: Incendio = {
    fotos: raw?.fotos ?? [],
    id,
    titulo,
    descripcion: getStr(raw, ['descripcion', 'observaciones']) ?? null,
    fechaInicio,
    fechaFin,
    visiblePublico,
    creadoEn: getDateLike(raw, ['creado_en', 'creadoEn']) ?? undefined,
    creadoPor: raw?.creadoPor ?? null,
    ubicacion: ubicacion ?? null,
    region: raw?.region ?? null,
    validadoPor: raw?.validadoPor ?? null,
    etiquetas: raw?.etiquetas ?? [],
    reportes: raw?.reportes ?? [],
    estadoActual: normalizeEstadoActual(raw) ?? null,
    portadaUrl,
    thumbnailUrl,
  };

  return normalizeIncendioCoords(base);
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

/** ---------- Crear incendio (avanzado) ---------- */
export type IncendioCreate = {
  titulo: string;
  descripcion?: string;
  regionId?: string;
  lat: number;
  lng?: number;
  lon?: number;
  visiblePublico?: boolean;
  etiquetasIds?: string[];
  fechaInicio?: string;
  validadoPorId?: string;
  reporteInicial?: string;
  reporteInicialFotos?: string[];
  estadoInicialId?: string;
  estadoInicialNombre?: string;
};

export async function createIncendioAvanzado(payload: IncendioCreate) {
  const lon = payload.lon ?? payload.lng;

  const body: any = {
    titulo: payload.titulo,
    descripcion: payload.descripcion ?? '',
    visiblePublico: payload.visiblePublico ?? true,
    fechaInicio: payload.fechaInicio ?? new Date().toISOString(),
    ubicacion:
      typeof lon === 'number' && typeof payload.lat === 'number'
        ? { type: 'Point', coordinates: [lon, payload.lat] as [number, number] }
        : undefined,
    regionId: payload.regionId,
    etiquetasIds: payload.etiquetasIds ?? [],
    validadoPorId: payload.validadoPorId,
    reporteInicial: payload.reporteInicial?.trim() || undefined,
    estadoInicialId: payload.estadoInicialId,
    estadoInicialNombre: payload.estadoInicialNombre,
  };

  if (Array.isArray(payload.reporteInicialFotos) && payload.reporteInicialFotos.length) {
    body.reporteInicialFotos = payload.reporteInicialFotos.filter(Boolean);
  }

  const { data } = await api.post('/incendios', body);
  return fromBackendIncendio(data);
}

/** ---------- Reportes ---------- */
export async function addReporte(
  incendioId: string,
  payload: { descripcion: string; fecha?: string; usuarioId?: string }
) {
  const { data } = await api.post(`/incendios/${incendioId}/reportes`, payload);
  return fromBackendIncendio(data);
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
