// services/usuarios.ts
import { api } from '../client';

export type UUID = string;

export type RolMin = { id: UUID; nombre: string };
export type InstitucionMin = { id: UUID; nombre: string } | null;

export type UserAccount = {
  id: UUID;
  nombre: string;
  apellido: string;
  telefono?: string | null;
  correo: string;           // mapeo de email
  rol?: RolMin | null;
  institucion?: InstitucionMin;
  isAdmin?: boolean;        // mapeo de is_admin
  creadoEn?: string;
  actualizadoEn?: string;
  eliminadoEn?: string | null;
  activo?: boolean;         // no viene explícito: lo dejamos true por compat
};

export type UsersPaged = {
  total: number;
  page: number;
  pageSize: number;
  items: UserAccount[];
};

function fromBackendUser(raw: any): UserAccount {
  return {
    id: raw?.usuario_uuid ?? raw?.id ?? raw?.uuid,
    nombre: raw?.nombre ?? '',
    apellido: raw?.apellido ?? '',
    telefono: raw?.telefono ?? null,
    correo: raw?.email ?? '',
    rol: raw?.rol
      ? {
          id: raw.rol?.rol_uuid ?? raw.rol?.id ?? raw.rol?.uuid,
          nombre: raw.rol?.nombre ?? '',
        }
      : null,
    institucion: raw?.institucion
      ? {
          id: raw.institucion?.institucion_uuid ?? raw.institucion?.id ?? raw.institucion?.uuid,
          nombre: raw.institucion?.nombre ?? '',
        }
      : null,
    isAdmin: !!raw?.is_admin,
    creadoEn: raw?.creado_en ?? raw?.creadoEn ?? undefined,
    actualizadoEn: raw?.actualizado_en ?? raw?.actualizadoEn ?? undefined,
    eliminadoEn: raw?.eliminado_en ?? null,
    activo: true, // el backend lista solo no eliminados; lo marcamos como true para UI
  };
}

/** Lista paginada (ADMIN) – GET /usuarios */
export async function listUsers(params?: { page?: number; pageSize?: number }): Promise<UsersPaged> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const { data } = await api.get(`/usuarios?${q.toString()}`);
  return {
    total: data?.total ?? 0,
    page: data?.page ?? params?.page ?? 1,
    pageSize: data?.pageSize ?? params?.pageSize ?? 20,
    items: (data?.items ?? []).map(fromBackendUser),
  };
}

/** Mi perfil – GET /usuarios/me */
export async function getMyProfile(): Promise<UserAccount> {
  const { data } = await api.get('/usuarios/me');
  return fromBackendUser(data);
}

/** Crear (ADMIN) – POST /usuarios */
export async function createUser(payload: {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rolId: UUID;                       // rol_uuid requerido
  telefono?: string | null;
  institucionId?: UUID | null;       // institucion_uuid
  isAdmin?: boolean;
}) {
  const body: any = {
    nombre: payload.nombre,
    apellido: payload.apellido,
    telefono: payload.telefono ?? null,
    email: payload.email,
    password: payload.password,
    rol_uuid: payload.rolId,
    institucion_uuid: payload.institucionId ?? null,
    is_admin: !!payload.isAdmin,
  };
  const { data } = await api.post('/usuarios', body);
  return fromBackendUser(data);
}

/** Actualizar – PATCH /usuarios/:id
 *  (admin puede todo; usuario normal solo a sí mismo, campos limitados)
 */
export async function updateUser(id: UUID, payload: {
  nombre?: string;
  apellido?: string;
  telefono?: string | null;
  email?: string;
  newPassword?: string;          // new_password
  rolId?: UUID;                  // rol_uuid (admin)
  institucionId?: UUID | null;   // institucion_uuid
  isAdmin?: boolean;             // admin
}) {
  const body: any = {};
  if (payload.nombre != null) body.nombre = payload.nombre;
  if (payload.apellido != null) body.apellido = payload.apellido;
  if (payload.telefono !== undefined) body.telefono = payload.telefono;
  if (payload.email != null) body.email = payload.email;
  if (payload.newPassword) body.new_password = payload.newPassword;
  if (payload.rolId) body.rol_uuid = payload.rolId;
  if (payload.institucionId !== undefined) body.institucion_uuid = payload.institucionId;
  if (typeof payload.isAdmin === 'boolean') body.is_admin = payload.isAdmin;

  const { data } = await api.patch(`/usuarios/${id}`, body);
  return fromBackendUser(data);
}

/** Eliminar (soft) – DELETE /usuarios/:id (ADMIN)
 *  No hay endpoint de restore en tu backend actual
 */
export async function deleteUser(id: UUID) {
  const { data } = await api.delete<{ ok: boolean }>(`/usuarios/${id}`);
  return data;
}
