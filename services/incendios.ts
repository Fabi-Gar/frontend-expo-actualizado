// services/incendios.ts
import { apiAuth } from '../client';

/** ---------- Tipos compartidos (UUID en todas las IDs) ---------- */
export type UsuarioRef = {
  id: string;
  nombre: string;
  correo?: string;
  creadoEn?: string;
} | null;

// ★ id ahora es string (UUID); agrega color opcional
export type EstadoRef = { id: string; nombre: string; color?: string | null };

export type EstadoActual = {
  // ★ back devuelve { id, nombre, color, fechaCambio }; lo adaptamos aquí
  id: string;
  fecha: string; // mapearemos fechaCambio -> fecha
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
  etiquetas?: { id: string; nombre: string }[];   // UUID
  reportes?: Reporte[];
  estadoActual?: EstadoActual | null;
  lat?: number | null;
  lng?: number | null; // compat
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
  const { data } = await apiAuth.get<IncendiosMapResponse>(`/api/incendios/map${qs ? `?${qs}` : ''}`);
  return data;
}

/** ---------- Helpers internos ---------- */
// ★ mapea el estadoActual del back (id/nombre/color/fechaCambio) a tu tipo local
function normalizeEstadoActual(it: any): EstadoActual | null | undefined {
  const ea = it?.estadoActual;
  if (!ea) return ea;
  // Si el back ya entrega el objeto con 'estado: {id,nombre}', respétalo
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
  // Si el back entrega { id, nombre, color, fechaCambio }
  return {
    id: ea.id,
    fecha: ea.fechaCambio ?? ea.fecha ?? new Date().toISOString(),
    estado: { id: ea.id, nombre: ea.nombre, color: ea.color ?? null },
    cambiadoPor: null,
  };
}

function normalizeIncendioCoords(it: Incendio): Incendio {
  const lon = it?.ubicacion?.coordinates?.[0];
  const lat = it?.ubicacion?.coordinates?.[1];
  const normLon = typeof lon === 'number' ? lon : (it as any).lon ?? null;
  const normLat = typeof lat === 'number' ? lat : (it as any).lat ?? null;
  const normLng = it?.lng != null ? it.lng : normLon; // compat
  const estadoActual = normalizeEstadoActual(it as any);
  return { ...it, lon: normLon, lat: normLat, lng: normLng as any, estadoActual };
}

/** ---------- CRUD /api/incendios ---------- */
export async function listIncendiosPaged(page = 1, pageSize = 50): Promise<Paginated<Incendio>> {
  const { data } = await apiAuth.get<Paginated<Incendio>>(`/api/incendios?page=${page}&pageSize=${pageSize}`);
  data.items = (data.items || []).map(normalizeIncendioCoords);
  return data;
}

export async function listIncendios(page = 1, pageSize = 50): Promise<Incendio[]> {
  const { data } = await apiAuth.get<Paginated<Incendio>>(`/api/incendios?page=${page}&pageSize=${pageSize}`);
  const arr = (data?.items || []).map(normalizeIncendioCoords);
  return arr;
}

export async function listIncendiosArray(page = 1, pageSize = 2000): Promise<Incendio[]> {
  return listIncendios(page, pageSize);
}

export async function getIncendio(id: string) {
  const { data } = await apiAuth.get<Incendio>(`/api/incendios/${id}`);
  return normalizeIncendioCoords(data);
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

  // ubicación: prioriza lon/lat, luego lng/lat
  const lon = payload.lon ?? payload.lng ?? (payload.ubicacion?.coordinates?.[0] ?? null);
  const lat = payload.lat ?? payload.ubicacion?.coordinates?.[1] ?? null;
  if (typeof lon === 'number' && typeof lat === 'number') {
    body.ubicacion = { type: 'Point', coordinates: [lon, lat] as [number, number] };
  }

  // ★ soporta regionId | region:{id}
  const regionId = (payload as any).regionId ?? (payload as any).region?.id;
  if (regionId != null) body.regionId = regionId as string;

  // ★ soporta validadoPorId | validadoPor:{id}
  const validadoPorId = (payload as any).validadoPorId ?? (payload as any).validadoPor?.id;
  if (validadoPorId != null) body.validadoPorId = validadoPorId as string;

  if ((payload as any).etiquetasIds != null) body.etiquetasIds = (payload as any).etiquetasIds as string[];

  // ★ estado inicial (opcional)
  if ((payload as any).estadoInicialId) body.estadoInicialId = (payload as any).estadoInicialId;
  if ((payload as any).estadoInicialNombre) body.estadoInicialNombre = (payload as any).estadoInicialNombre;

  const { data } = await apiAuth.post<Incendio>('/api/incendios', body);
  return normalizeIncendioCoords(data);
}

export async function updateIncendio(id: string, payload: Partial<Incendio> & { lat?: number; lng?: number; lon?: number }) {
  const body: any = { ...payload };

  // normaliza ubicación si viene en lat/lon/lng
  if (payload.lat != null || payload.lon != null || payload.lng != null) {
    const lon = payload.lon ?? payload.lng ?? null;
    const lat = payload.lat ?? null;
    if (typeof lon === 'number' && typeof lat === 'number') {
      body.ubicacion = { type: 'Point', coordinates: [lon, lat] as [number, number] };
    }
    delete body.lat; delete body.lon; delete body.lng;
  }

  // ★ normaliza regionId | region:{id}
  if ('region' in body && body.region && (body.region as any).id) {
    body.regionId = (body.region as any).id;
    delete body.region;
  }
  if ('regionId' in body && body.regionId == null) body.regionId = null;

  // ★ normaliza validadoPorId | validadoPor:{id}
  if ('validadoPor' in body && body.validadoPor && (body.validadoPor as any).id) {
    body.validadoPorId = (body.validadoPor as any).id;
    delete body.validadoPor;
  }
  if ('validadoPorId' in body && body.validadoPorId == null) body.validadoPorId = null;

  if ('etiquetasIds' in body && !Array.isArray(body.etiquetasIds)) body.etiquetasIds = [];

  // ★ soporte cambio de estado en PATCH
  // acepta: estadoId | estadoNombre | estado:{id} + notaEstado/fechaEstado/cambiadoPorId
  if (body.estado && (body.estado as any).id) {
    body.estadoId = (body.estado as any).id;
    delete body.estado;
  }

  const { data } = await apiAuth.patch<Incendio>(`/api/incendios/${id}`, body);
  return normalizeIncendioCoords(data);
}

export async function deleteIncendio(id: string) {
  const { data } = await apiAuth.delete<{ ok: boolean }>(`/api/incendios/${id}`);
  return data;
}

/** ---------- Crear incendio (avanzado) ---------- */
export type IncendioCreate = {
  titulo: string;
  descripcion?: string;
  regionId?: string;          // UUID (opcional)
  lat: number;
  lng?: number;               // compat
  lon?: number;               // preferido
  visiblePublico?: boolean;
  etiquetasIds?: string[];    // UUID[]
  fechaInicio?: string;
  validadoPorId?: string;     // UUID
  reporteInicial?: string;    // texto opcional
  reporteInicialFotos?: string[]; // ★ NUEVO: URLs (o rutas) de fotos del reporte inicial
  // ★
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
    // ★ estado inicial
    estadoInicialId: payload.estadoInicialId,
    estadoInicialNombre: payload.estadoInicialNombre,
  };

  // ★ incluir fotos del reporte inicial si vienen
  if (Array.isArray(payload.reporteInicialFotos) && payload.reporteInicialFotos.length) {
    body.reporteInicialFotos = payload.reporteInicialFotos.filter(Boolean);
  }

  const { data } = await apiAuth.post<Incendio>('/api/incendios', body);
  return normalizeIncendioCoords(data);
}

/** ---------- Reportes ---------- */
export async function addReporte(
  incendioId: string,
  payload: { descripcion: string; fecha?: string; usuarioId?: string }
) {
  const { data } = await apiAuth.post<Incendio>(`/api/incendios/${incendioId}/reportes`, payload);
  return normalizeIncendioCoords(data);
}

/** ---------- Otros helpers ---------- */
export async function hideIncendio(id: string) {
  const { data } = await apiAuth.patch<Incendio>(`/api/incendios/${id}`, {
    visiblePublico: false,
  });
  return normalizeIncendioCoords(data);
}

/** ★ Cambiar estado del incendio usando PATCH /api/incendios/:id */
export async function setEstadoIncendio(incendioId: string, opts: {
  estadoId?: string;
  estadoNombre?: string;
  notaEstado?: string;
  fechaEstado?: string;
  cambiadoPorId?: string;
}) {
  const { data } = await apiAuth.patch<Incendio>(`/api/incendios/${incendioId}`, opts);
  return normalizeIncendioCoords(data);
}
