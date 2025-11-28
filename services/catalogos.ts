// services/catalogos.ts
import { api } from '../client'

/* ============================
 * Tipos base
 * ============================ */
export type UUID = string

export type Paginated<T> = {
  total: number
  page: number
  pageSize: number
  items: T[]
}

export type Opcion = { id: UUID; nombre: string }
export type Rol = { id: UUID; nombre: string; descripcion?: string | null; creadoEn?: string }
export type Institucion = { id: UUID; nombre: string; creadoEn?: string }
export type EstadoIncendio = { id: UUID; codigo: string; nombre: string; color?: string | null; orden?: number }
export type Departamento = {
  id: UUID;
  nombre: string;
  codigo?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
}
export type Municipio = {
  id: UUID;
  nombre: string;
  departamentoId: UUID;
  creadoEn?: string;
  actualizadoEn?: string;
}

/* Catálogos activos */
export type Medio = Opcion

/* ============================
 * Helpers
 * ============================ */
const setQP = (q: URLSearchParams, k: string, v: any) => {
  if (v === undefined || v === null || v === '') return
  q.set(k, String(v))
}

// === Compatibilidad para CierreEditor (nombres esperados) ===
export type CatalogItem = CatalogoItem;

export type CatalogName =
  | 'medios'
  | 'instituciones'
  | 'roles';

/** ===== Caché en memoria + de-dupe de requests ===== */
type CacheEntry<T> = { ts: number; data: T }
const CACHE = new Map<string, CacheEntry<any>>()
const INFLIGHT = new Map<string, Promise<any>>()
const TTL_MS = 60_000 // 1 minuto (ajústalo si quieres)

function cacheKey(method: string, url: string) {
  return `${method.toUpperCase()} ${url}`
}

async function getWithCache<T>(url: string, opts?: { ttl?: number; signal?: AbortSignal }): Promise<T> {
  const key = cacheKey('GET', url)
  const now = Date.now()
  const ttl = opts?.ttl ?? TTL_MS

  const cached = CACHE.get(key)
  if (cached && now - cached.ts < ttl) {
    return cached.data as T
  }

  if (INFLIGHT.has(key)) {
    return INFLIGHT.get(key)! as Promise<T>
  }

  const p = api.get(url, { signal: opts?.signal })
    .then(({ data }) => {
      CACHE.set(key, { ts: Date.now(), data })
      INFLIGHT.delete(key)
      return data as T
    })
    .catch((e) => {
      INFLIGHT.delete(key)
      throw e
    })

  INFLIGHT.set(key, p)
  return p
}

const norm = (r: any): Opcion => ({
  id:
    r?.rol_uuid ||
    r?.institucion_uuid ||
    r?.departamento_uuid ||
    r?.municipio_uuid ||
    r?.medio_uuid ||
    r?.id ||
    r?.uuid,
  nombre: r?.nombre ?? '',
})

/* ============================
 * Estados de incendio (catálogo maestro)
 * ============================ */
export async function getEstadosIncendio(signal?: AbortSignal): Promise<EstadoIncendio[]> {
  const { items } = await getWithCache<{ items: any[] }>(`/estados_incendio`, { signal })
  return (items ?? []).map((r: any) => ({
    id: r?.estado_incendio_uuid || r?.id || r?.uuid,
    codigo: r?.codigo,
    nombre: r?.nombre,
    color: r?.color ?? null,
    orden: r?.orden ?? undefined,
  }))
}

// (Opcional admin)
export async function createEstadoIncendio(payload: { codigo: string; nombre: string; color?: string | null; orden?: number }) {
  const { data } = await api.post<any>(`/estados_incendio`, payload)
  return data
}
export async function updateEstadoIncendio(id: UUID, payload: Partial<{ codigo: string; nombre: string; color?: string | null; orden?: number }>) {
  const { data } = await api.patch<any>(`/estados_incendio/${id}`, payload)
  return data
}
export async function deleteEstadoIncendio(id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/estados_incendio/${id}`)
  return data
}

/* ============================
 * Roles (admin)  /roles
 * ============================ */
export async function listRoles(page = 1, pageSize = 100, signal?: AbortSignal): Promise<Paginated<Rol>> {
  const q = new URLSearchParams()
  setQP(q, 'page', page)
  setQP(q, 'pageSize', pageSize)
  const data = await getWithCache<Paginated<any>>(`/roles?${q.toString()}`, { signal })
  return {
    ...data,
    items: (data.items ?? []).map((r: any) => ({
      id: r?.rol_uuid || r?.id || r?.uuid,
      nombre: r?.nombre,
      descripcion: r?.descripcion ?? null,
      creadoEn: r?.creado_en ?? r?.creadoEn,
    })),
  }
}
export async function getRol(id: UUID, signal?: AbortSignal): Promise<Rol> {
  const data = await getWithCache<any>(`/roles/${id}`, { signal })
  return {
    id: data?.rol_uuid || data?.id || data?.uuid,
    nombre: data?.nombre,
    descripcion: data?.descripcion ?? null,
    creadoEn: data?.creado_en ?? data?.creadoEn,
  }
}
export async function createRol(payload: { nombre: string; descripcion?: string | null }) {
  const { data } = await api.post<any>(`/roles`, payload)
  return data
}
export async function updateRol(id: UUID, payload: Partial<{ nombre: string; descripcion?: string | null }>) {
  const { data } = await api.patch<any>(`/roles/${id}`, payload)
  return data
}
export async function deleteRol(id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/roles/${id}`)
  return data
}

/* ============================
 * Instituciones  /instituciones
 * ============================ */
export async function listInstituciones(params?: { page?: number; pageSize?: number; q?: string; signal?: AbortSignal }): Promise<Paginated<Institucion>> {
  const q = new URLSearchParams()
  setQP(q, 'page', params?.page ?? 1)
  setQP(q, 'pageSize', params?.pageSize ?? 50)
  setQP(q, 'q', params?.q)
  const data = await getWithCache<Paginated<any>>(`/instituciones?${q.toString()}`, { signal: params?.signal })
  return {
    ...data,
    items: (data.items ?? []).map((r: any) => ({
      id: r?.institucion_uuid || r?.id || r?.uuid,
      nombre: r?.nombre,
      creadoEn: r?.creado_en ?? r?.creadoEn,
    })),
  }
}
export async function getInstitucion(id: UUID, signal?: AbortSignal): Promise<Institucion> {
  const data = await getWithCache<any>(`/instituciones/${id}`, { signal })
  return {
    id: data?.institucion_uuid || data?.id || data?.uuid,
    nombre: data?.nombre,
    creadoEn: data?.creado_en ?? data?.creadoEn,
  }
}
export async function createInstitucion(payload: { nombre: string }) {
  const { data } = await api.post<any>(`/instituciones`, payload)
  return data
}
export async function updateInstitucion(id: UUID, payload: Partial<{ nombre: string }>) {
  const { data } = await api.patch<any>(`/instituciones/${id}`, payload)
  return data
}
export async function deleteInstitucion(id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/instituciones/${id}`)
  return data
}

/* ============================
 * Departamentos / Municipios
 * ============================ */
export async function listDepartamentos(signal?: AbortSignal): Promise<Departamento[]> {
  const { items } = await getWithCache<{ items: any[] }>(`/departamentos`, { signal })
  return (items ?? []).map((d: any) => ({
    id: d?.departamento_uuid || d?.id || d?.uuid,
    nombre: d?.nombre,
    codigo: d?.codigo ?? null,
    creadoEn: d?.creado_en ?? d?.creadoEn ?? undefined,
    actualizadoEn: d?.actualizado_en ?? d?.actualizadoEn ?? undefined,
  }))
}
export async function createDepartamento(payload: { nombre: string; codigo?: string | null }) {
  const { data } = await api.post<any>(`/departamentos`, payload)
  return data
}
export async function updateDepartamento(id: UUID, payload: Partial<{ nombre: string; codigo?: string | null }>) {
  const { data } = await api.patch<any>(`/departamentos/${id}`, payload)
  return data
}
export async function deleteDepartamento(id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/departamentos/${id}`)
  return data
}

export async function listDepartamentosPaged(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  withMunicipios?: boolean;
  signal?: AbortSignal;
}): Promise<Paginated<Departamento & { municipios?: Municipio[] }>> {
  const qsp = new URLSearchParams()
  if (params?.page) qsp.set('page', String(params.page))
  if (params?.pageSize) qsp.set('pageSize', String(params.pageSize))
  if (params?.q) qsp.set('q', params.q)
  if (params?.withMunicipios) qsp.set('withMunicipios', '1')

  const data = await getWithCache<any>(`/departamentos?${qsp.toString()}`, { signal: params?.signal })

  const items = (data?.items ?? []).map((d: any) => ({
    id: d?.id ?? d?.departamento_uuid ?? d?.uuid,
    nombre: d?.nombre ?? '',
    codigo: d?.codigo ?? null,
    creadoEn: d?.creado_en ?? d?.creadoEn ?? undefined,
    actualizadoEn: d?.actualizado_en ?? d?.actualizadoEn ?? undefined,
    municipios: Array.isArray(d?.municipios)
      ? d.municipios.map((m: any) => ({
          id: m?.id ?? m?.municipio_uuid ?? m?.uuid,
          nombre: m?.nombre ?? '',
          departamentoId: (d?.id ?? d?.departamento_uuid ?? d?.uuid) as string,
          creadoEn: m?.creado_en ?? m?.creadoEn ?? undefined,
          actualizadoEn: m?.actualizado_en ?? m?.actualizadoEn ?? undefined,
        }))
      : undefined,
  }))

  return {
    total: data?.total ?? items.length,
    page: data?.page ?? params?.page ?? 1,
    pageSize: data?.pageSize ?? params?.pageSize ?? items.length,
    items,
  }
}

export async function listMunicipios(departamentoId: UUID, signal?: AbortSignal): Promise<Municipio[]> {
  const { items } = await getWithCache<{ items: any[] }>(`/departamentos/${departamentoId}/municipios`, { signal })
  return (items ?? []).map((m: any) => ({
    id: m?.municipio_uuid || m?.id || m?.uuid,
    nombre: m?.nombre,
    departamentoId,
    creadoEn: m?.creado_en ?? m?.creadoEn ?? undefined,
    actualizadoEn: m?.actualizado_en ?? m?.actualizadoEn ?? undefined,
  }))
}
export async function createMunicipio(departamentoId: UUID, payload: { nombre: string }) {
  const { data } = await api.post<any>(`/departamentos/${departamentoId}/municipios`, payload)
  return data
}
export async function updateMunicipio(id: UUID, payload: Partial<{ nombre: string; departamentoId?: UUID }>) {
  const { data } = await api.patch<any>(`/municipios/${id}`, payload)
  return data
}
export async function deleteMunicipio(id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/municipios/${id}`)
  return data
}

/* ============================
 * Catálogos de cierre /catalogos/*
 * ============================ */
async function getCatalogo(path: string, signal?: AbortSignal) {
  const { items } = await getWithCache<{ items: any[] }>(`/catalogos/${path}`, { signal })
  return (items ?? []).map(norm)
}
async function postCatalogo(path: string, payload: { nombre: string }) {
  const { data } = await api.post<any>(`/catalogos/${path}`, payload)
  return data
}
async function patchCatalogo(path: string, id: UUID, payload: Partial<{ nombre: string }>) {
  const { data } = await api.patch<any>(`/catalogos/${path}/${id}`, payload)
  return data
}
async function deleteCatalogo(path: string, id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/catalogos/${path}/${id}`)
  return data
}

// -------------------------------
// Catálogos genéricos (/catalogos/:catalogo)
// -------------------------------

export type CatalogoItem = {
  id: UUID;
  nombre: string;
  // Solo roles:
  descripcion?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
};

export type ListCatalogoParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  signal?: AbortSignal;
};

export async function listCatalogNames(signal?: AbortSignal): Promise<string[]> {
  const { items } = await getWithCache<{ items: string[] }>('/catalogos', { signal })
  return items ?? []
}

export async function listCatalogoItems(
  catalogo: string,
  params?: ListCatalogoParams
): Promise<Paginated<CatalogoItem>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.q) q.set('q', params.q);

  const data = await getWithCache<any>(
    `/catalogos/${catalogo}${q.toString() ? `?${q}` : ''}`,
    { signal: params?.signal }
  );

  const items = (data?.items ?? []).map((r: any) => ({
    id: r?.id ?? r?.uuid,
    nombre: r?.nombre ?? '',
    descripcion: typeof r?.descripcion !== 'undefined' ? (r.descripcion ?? null) : undefined,
    creadoEn: r?.creado_en ?? r?.creadoEn ?? undefined,
    actualizadoEn: r?.actualizado_en ?? r?.actualizadoEn ?? undefined,
  })) as CatalogoItem[];

  return {
    total: data?.total ?? items.length,
    page: data?.page ?? params?.page ?? 1,
    pageSize: data?.pageSize ?? params?.pageSize ?? items.length,
    items,
  };
}

export async function getCatalogoItem(catalogo: string, id: UUID, signal?: AbortSignal): Promise<CatalogoItem> {
  const data = await getWithCache<any>(`/catalogos/${catalogo}/${id}`, { signal })
  return {
    id: data?.id ?? data?.uuid,
    nombre: data?.nombre ?? '',
    descripcion: typeof data?.descripcion !== 'undefined' ? (data.descripcion ?? null) : undefined,
    creadoEn: data?.creado_en ?? data?.creadoEn ?? undefined,
    actualizadoEn: data?.actualizado_en ?? data?.actualizadoEn ?? undefined,
  };
}

export async function createCatalogoItem(
  catalogo: string,
  payload: { nombre: string; descripcion?: string | null }
): Promise<CatalogoItem> {
  const body: any = { nombre: payload.nombre };
  if (typeof payload.descripcion !== 'undefined') body.descripcion = payload.descripcion; // Solo roles
  const { data } = await api.post(`/catalogos/${catalogo}`, body);
  return {
    id: data?.id ?? data?.uuid,
    nombre: data?.nombre ?? '',
    descripcion: typeof data?.descripcion !== 'undefined' ? (data.descripcion ?? null) : undefined,
    creadoEn: data?.creado_en ?? data?.creadoEn ?? undefined,
    actualizadoEn: data?.actualizado_en ?? data?.actualizadoEn ?? undefined,
  };
}

export async function updateCatalogoItem(
  catalogo: string,
  id: UUID,
  payload: Partial<{ nombre: string; descripcion?: string | null }>
): Promise<CatalogoItem> {
  const body: any = {};
  if (typeof payload.nombre === 'string') body.nombre = payload.nombre;
  if (typeof payload.descripcion !== 'undefined') body.descripcion = payload.descripcion;
  const { data } = await api.patch(`/catalogos/${catalogo}/${id}`, body);
  return {
    id: data?.id ?? data?.uuid,
    nombre: data?.nombre ?? '',
    descripcion: typeof data?.descripcion !== 'undefined' ? (data.descripcion ?? null) : undefined,
    creadoEn: data?.creado_en ?? data?.creadoEn ?? undefined,
    actualizadoEn: data?.actualizado_en ?? data?.actualizadoEn ?? undefined,
  };
}

export async function deleteCatalogoItem(catalogo: string, id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/catalogos/${catalogo}/${id}`);
  return data;
}

/* ============================
 * Pre-carga en paralelo
 * ============================ */
export async function preloadCatalogosBasicos(signal?: AbortSignal) {
  const [
    estados,
    departamentos,
  ] = await Promise.all([
    getEstadosIncendio(signal),
    listDepartamentos(signal),
  ])

  return {
    estados,
    departamentos,
  }
}
