import { apiAuth } from '../client';

/** ---------- Tipos compartidos ---------- */
export type UsuarioRef = {
  id: string;
  nombre: string;
  correo?: string;
  creadoEn?: string;
} | null;

export type EstadoRef = { id: number; nombre: string };

export type EstadoActual = {
  id: number;
  fecha: string;
  estado: EstadoRef;
  cambiadoPor?: UsuarioRef;
};

export type RegionRef =
  | { id: number; nombre: string; codigo?: string }
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
  etiquetas?: { id: number; nombre: string }[];
  reportes?: Reporte[];
  estadoActual?: EstadoActual | null;
  lat?: number | null; // conveniencia en front
  lng?: number | null; // compat con front (a partir de lon)
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
function normalizeIncendioCoords(it: Incendio): Incendio {
  const lon = it?.ubicacion?.coordinates?.[0];
  const lat = it?.ubicacion?.coordinates?.[1];
  const normLon = typeof lon === 'number' ? lon : (it as any).lon ?? null;
  const normLat = typeof lat === 'number' ? lat : (it as any).lat ?? null;
  // poblamos lng desde lon para compatibilidad
  const normLng = it?.lng != null ? it.lng : normLon;
  return { ...it, lon: normLon, lat: normLat, lng: normLng as any };
}

/** ---------- CRUD /api/incendios ---------- */
/** NUEVO: objeto paginado tal cual (si lo necesitas) */
export async function listIncendiosPaged(page = 1, pageSize = 50): Promise<Paginated<Incendio>> {
  const { data } = await apiAuth.get<Paginated<Incendio>>(`/api/incendios?page=${page}&pageSize=${pageSize}`);
  data.items = (data.items || []).map(normalizeIncendioCoords);
  return data;
}

/** POR DEFECTO: devuelve SIEMPRE un array plano (para las pantallas) */
export async function listIncendios(page = 1, pageSize = 50): Promise<Incendio[]> {
  const { data } = await apiAuth.get<Paginated<Incendio>>(`/api/incendios?page=${page}&pageSize=${pageSize}`);
  const arr = (data?.items || []).map(normalizeIncendioCoords);
  return arr;
}

/** Versión “simple” (array) — alias de listIncendios */
export async function listIncendiosArray(page = 1, pageSize = 2000): Promise<Incendio[]> {
  return listIncendios(page, pageSize);
}

export async function getIncendio(id: string) {
  const { data } = await apiAuth.get<Incendio>(`/api/incendios/${id}`);
  return normalizeIncendioCoords(data);
}

/** ---------- Crear / Actualizar / Eliminar ---------- */
// El back acepta ubicacion como GeoJSON o como lon/lat (nosotros mandamos GeoJSON).
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

  if ((payload as any).regionId != null) body.regionId = (payload as any).regionId;
  if ((payload as any).etiquetasIds != null) body.etiquetasIds = (payload as any).etiquetasIds;

  const { data } = await apiAuth.post<Incendio>('/api/incendios', body);
  return normalizeIncendioCoords(data);
}

// PATCH parcial
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

  const { data } = await apiAuth.patch<Incendio>(`/api/incendios/${id}`, body);
  return normalizeIncendioCoords(data);
}

export async function deleteIncendio(id: string) {
  const { data } = await apiAuth.delete<{ ok: boolean }>(`/api/incendios/${id}`);
  return data;
}

/** ---------- Crear incendio (avanzado, compat) ---------- */
export type IncendioCreate = {
  titulo: string;
  descripcion?: string;
  regionId?: number;
  lat: number;
  lng?: number; // compat
  lon?: number; // preferido
  visiblePublico?: boolean;
  etiquetasIds?: number[];
  fechaInicio?: string;
  validadoPorId?: string;
  reporteInicial?: string;
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
  };

  const { data } = await apiAuth.post<Incendio>('/api/incendios', body);
  return normalizeIncendioCoords(data);
}

/** ---------- Otros helpers ---------- */
export async function hideIncendio(id: string) {
  const { data } = await apiAuth.patch<Incendio>(`/api/incendios/${id}`, {
    visiblePublico: false,
  });
  return normalizeIncendioCoords(data);
}

/** Estado del incendio (prioriza el endpoint nuevo /:id/estado) */
export async function setEstadoIncendio(incendioId: string, estadoId: number) {
  try {
    const { data } = await apiAuth.post(`/api/incendios/${incendioId}/estado`, { estadoId });
    return data;
  } catch (e) {
    const attempts = [
      { url: '/api/estado-incendio', body: { incendioId, estadoId }, method: 'post' as const },
      { url: '/api/estado-incendio', body: { incendio: incendioId, estado: estadoId }, method: 'post' as const },
      { url: '/api/estado-incendio/agregar', body: { incendioId, estadoId }, method: 'post' as const },
    ];
    let lastError: any;
    for (const a of attempts) {
      try {
        const { data } = await apiAuth[a.method](a.url, a.body);
        return data;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }
}
