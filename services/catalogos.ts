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
/* Catálogos de cierre / soporte */
export type TipoIncendio = Opcion
export type TipoPropiedad = Opcion
export type Causa = Opcion
export type IniciadoJuntoA = Opcion
export type MedioAereo = Opcion
export type MedioTerrestre = Opcion
export type MedioAcuatico = Opcion
export type Abasto = Opcion
export type TecnicaExtincion = Opcion

/* ============================
 * Helpers
 * ============================ */
const setQP = (q: URLSearchParams, k: string, v: any) => {
  if (v === undefined || v === null || v === '') return
  q.set(k, String(v))
}

const norm = (r: any): Opcion => ({
  id:
    r?.rol_uuid ||
    r?.institucion_uuid ||
    r?.departamento_uuid ||
    r?.municipio_uuid ||
    r?.tipo_incendio_id ||
    r?.tipo_propiedad_id ||
    r?.causa_id ||
    r?.iniciado_id ||
    r?.medio_id ||
    r?.abasto_id ||
    r?.tecnica_id ||
    r?.id ||
    r?.uuid,
  nombre:
    r?.nombre ??
    r?.tipo_propiedad_nombre ??
    r?.causa_nombre ??
    r?.iniciado_nombre ??
    r?.medio_nombre ??
    r?.abasto_nombre ??
    r?.tecnica_nombre ??
    '',
})

/* ============================
 * Estados de incendio (catálogo maestro)
 * Rutas: GET /estados_incendio (+ opcional admin POST/PATCH/DELETE si lo tienes)
 * ============================ */
export async function getEstadosIncendio(): Promise<EstadoIncendio[]> {
  const { data } = await api.get<{ items: any[] }>(`/estados_incendio`)
  const arr = (data?.items ?? [])
  return arr.map((r: any) => ({
    id: r?.estado_incendio_uuid || r?.id || r?.uuid,
    codigo: r?.codigo,
    nombre: r?.nombre,
    color: r?.color ?? null,
    orden: r?.orden ?? undefined,
  }))
}

// (Opcional admin) — si tu back los expone
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
export async function listRoles(page = 1, pageSize = 100): Promise<Paginated<Rol>> {
  const q = new URLSearchParams()
  setQP(q, 'page', page)
  setQP(q, 'pageSize', pageSize)
  const { data } = await api.get<Paginated<any>>(`/roles?${q.toString()}`)
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
export async function getRol(id: UUID): Promise<Rol> {
  const { data } = await api.get<any>(`/roles/${id}`)
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
export async function listInstituciones(params?: { page?: number; pageSize?: number; q?: string }): Promise<Paginated<Institucion>> {
  const q = new URLSearchParams()
  setQP(q, 'page', params?.page ?? 1)
  setQP(q, 'pageSize', params?.pageSize ?? 50)
  setQP(q, 'q', params?.q)
  const { data } = await api.get<Paginated<any>>(`/instituciones?${q.toString()}`)
  return {
    ...data,
    items: (data.items ?? []).map((r: any) => ({
      id: r?.institucion_uuid || r?.id || r?.uuid,
      nombre: r?.nombre,
      creadoEn: r?.creado_en ?? r?.creadoEn,
    })),
  }
}
export async function getInstitucion(id: UUID): Promise<Institucion> {
  const { data } = await api.get<any>(`/instituciones/${id}`)
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
 *  - /departamentos
 *  - /departamentos/:id/municipios (GET, POST)
 *  - /municipios/:id (PATCH/DELETE)
 * ============================ */
export async function listDepartamentos(): Promise<Departamento[]> {
  const { data } = await api.get<{ items: any[] }>(`/departamentos`)
  return (data?.items ?? []).map((d: any) => ({
    id: d?.departamento_uuid || d?.id || d?.uuid,
    nombre: d?.nombre,
    codigo: d?.codigo ?? null,
    creadoEn: d?.creado_en ?? d?.creadoEn ?? undefined,          // 👈
    actualizadoEn: d?.actualizado_en ?? d?.actualizadoEn ?? undefined, // 👈
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
  withMunicipios?: boolean; // si quieres traer municipios en el mismo request
}): Promise<Paginated<Departamento & { municipios?: Municipio[] }>> {
  const qsp = new URLSearchParams()
  if (params?.page) qsp.set('page', String(params.page))
  if (params?.pageSize) qsp.set('pageSize', String(params.pageSize))
  if (params?.q) qsp.set('q', params.q)
  if (params?.withMunicipios) qsp.set('withMunicipios', '1')

  const { data } = await api.get(`/departamentos?${qsp.toString()}`)

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


export async function listMunicipios(departamentoId: UUID): Promise<Municipio[]> {
  const { data } = await api.get<{ items: any[] }>(`/departamentos/${departamentoId}/municipios`)
  return (data?.items ?? []).map((m: any) => ({
    id: m?.municipio_uuid || m?.id || m?.uuid,
    nombre: m?.nombre,
    departamentoId,
    creadoEn: m?.creado_en ?? m?.creadoEn ?? undefined,          // 👈
    actualizadoEn: m?.actualizado_en ?? m?.actualizadoEn ?? undefined, // 👈
  }))
}
export async function createMunicipio(departamentoId: UUID, payload: { nombre: string }) {
  const { data } = await api.post<any>(`/departamentos/${departamentoId}/municipios`, payload)
  return data
}
export async function updateMunicipio(id: UUID, payload: Partial<{ nombre: string; departamentoId?: UUID }>) {
  // si cambias de departamento, ajusta backend si soporta moverlo
  const { data } = await api.patch<any>(`/municipios/${id}`, payload)
  return data
}
export async function deleteMunicipio(id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/municipios/${id}`)
  return data
}

/* ============================
 * Catálogos de cierre /catalogos/*
 * GET + (admin) POST/PATCH/DELETE
 * ============================ */
async function getCatalogo(path: string) {
  const { data } = await api.get<{ items: any[] }>(`/catalogos/${path}`)
  return (data?.items ?? []).map(norm)
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

/* Tipos de incendio */
export const getTiposIncendio = () => getCatalogo('tipos_incendio')
export const createTipoIncendio = (p: { nombre: string }) => postCatalogo('tipos_incendio', p)
export const updateTipoIncendio = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('tipos_incendio', id, p)
export const deleteTipoIncendio = (id: UUID) => deleteCatalogo('tipos_incendio', id)

/* Tipos de propiedad */
export const getTiposPropiedad = () => getCatalogo('tipo_propiedad')
export const createTipoPropiedad = (p: { nombre: string }) => postCatalogo('tipo_propiedad', p)
export const updateTipoPropiedad = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('tipo_propiedad', id, p)
export const deleteTipoPropiedad = (id: UUID) => deleteCatalogo('tipo_propiedad', id)

/* Causas */
export const getCausas = () => getCatalogo('causas')
export const createCausa = (p: { nombre: string }) => postCatalogo('causas', p)
export const updateCausa = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('causas', id, p)
export const deleteCausa = (id: UUID) => deleteCatalogo('causas', id)

/* Iniciado junto a */
export const getIniciadoJuntoA = () => getCatalogo('iniciado_junto_a')
export const createIniciadoJuntoA = (p: { nombre: string }) => postCatalogo('iniciado_junto_a', p)
export const updateIniciadoJuntoA = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('iniciado_junto_a', id, p)
export const deleteIniciadoJuntoA = (id: UUID) => deleteCatalogo('iniciado_junto_a', id)

/* Medios aéreos */
export const getMediosAereos = () => getCatalogo('medios_aereos')
export const createMedioAereo = (p: { nombre: string }) => postCatalogo('medios_aereos', p)
export const updateMedioAereo = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('medios_aereos', id, p)
export const deleteMedioAereo = (id: UUID) => deleteCatalogo('medios_aereos', id)

/* Medios terrestres */
export const getMediosTerrestres = () => getCatalogo('medios_terrestres')
export const createMedioTerrestre = (p: { nombre: string }) => postCatalogo('medios_terrestres', p)
export const updateMedioTerrestre = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('medios_terrestres', id, p)
export const deleteMedioTerrestre = (id: UUID) => deleteCatalogo('medios_terrestres', id)

/* Medios acuáticos */
export const getMediosAcuaticos = () => getCatalogo('medios_acuaticos')
export const createMedioAcuatico = (p: { nombre: string }) => postCatalogo('medios_acuaticos', p)
export const updateMedioAcuatico = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('medios_acuaticos', id, p)
export const deleteMedioAcuatico = (id: UUID) => deleteCatalogo('medios_acuaticos', id)

/* Abastos */
export const getAbastos = () => getCatalogo('abastos')
export const createAbasto = (p: { nombre: string }) => postCatalogo('abastos', p)
export const updateAbasto = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('abastos', id, p)
export const deleteAbasto = (id: UUID) => deleteCatalogo('abastos', id)

/* Técnicas de extinción */
export const getTecnicasExtincion = () => getCatalogo('tecnicas_extincion')
export const createTecnicaExtincion = (p: { nombre: string }) => postCatalogo('tecnicas_extincion', p)
export const updateTecnicaExtincion = (id: UUID, p: Partial<{ nombre: string }>) => patchCatalogo('tecnicas_extincion', id, p)
export const deleteTecnicaExtincion = (id: UUID) => deleteCatalogo('tecnicas_extincion', id)

/* ============================
 * Pre-carga en paralelo
 * ============================ */
export async function preloadCatalogosBasicos() {
  const [
    estados,
    tiposIncendio,
    tiposPropiedad,
    causas,
    iniciado,
    mediosAereos,
    mediosTerrestres,
    mediosAcuaticos,
    abastos,
    tecnicas,
    departamentos,
  ] = await Promise.all([
    getEstadosIncendio(),
    getTiposIncendio(),
    getTiposPropiedad(),
    getCausas(),
    getIniciadoJuntoA(),
    getMediosAereos(),
    getMediosTerrestres(),
    getMediosAcuaticos(),
    getAbastos(),
    getTecnicasExtincion(),
    listDepartamentos(),
  ])

  return {
    estados,
    tiposIncendio,
    tiposPropiedad,
    causas,
    iniciado,
    mediosAereos,
    mediosTerrestres,
    mediosAcuaticos,
    abastos,
    tecnicas,
    departamentos,
  }
}
