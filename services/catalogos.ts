import { apiAuth } from '../client';

// ===== Tipos (UUID en id) =====
export type Region = { id: string; nombre: string; codigo?: string };
export type Etiqueta = { id: string; nombre: string; eliminadoEn?: string | null };
export type Estado = { id: string; nombre: string; color?: string };

export type Role = {
  id: string;      
  nombre: string;
  creadoEn: string;
  actualizadoEn: string;
  eliminadoEn?: string | null;
};

export type RolesPaged = {
  items: Role[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type UsersPaged = {
  items: UserAccount[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type UserAccount = {
  id: string;
  nombre: string;
  correo: string;
  rol?: Role | null;
  creadoEn: string;
  actualizadoEn: string;
  eliminadoEn?: string | null;
  activo: boolean;
};

// ===== Regiones =====
export async function listRegiones(): Promise<Region[]> {
  const { data } = await apiAuth.get('/api/regiones');
  return Array.isArray(data) ? (data as Region[]) : [];
}

export async function createRegion(payload: { nombre?: string; codigo?: string }) {
  const { data } = await apiAuth.post('/api/regiones', payload);
  return data as Region;
}

export async function updateRegion(id: string, payload: { nombre?: string; codigo?: string }) {
  const { data } = await apiAuth.patch(`/api/regiones/${id}`, payload);
  return data as Region;
}

export async function deleteRegion(id: string) {
  const { data } = await apiAuth.delete(`/api/regiones/${id}`);
  return data;
}

// ===== Etiquetas =====
export async function listEtiquetas(opts?: { show?: 'deleted' | 'all' }) : Promise<Etiqueta[]> {
  const q = opts?.show ? `?show=${opts.show}` : '';
  const { data } = await apiAuth.get(`/api/etiquetas${q}`);
  return Array.isArray(data) ? (data as Etiqueta[]) : [];
}

export async function createEtiqueta(payload: { nombre?: string }) {
  const { data } = await apiAuth.post('/api/etiquetas', payload);
  return data as Etiqueta;
}

export async function updateEtiqueta(id: string, payload: { nombre?: string }) {
  const { data } = await apiAuth.patch(`/api/etiquetas/${id}`, payload);
  return data as Etiqueta;
}

export async function deleteEtiqueta(id: string) {
  const res = await apiAuth.delete(`/api/etiquetas/${id}`);
  return res.data ?? { ok: true };
}

export async function restoreEtiqueta(id: string) {
  const { data } = await apiAuth.post(`/api/etiquetas/${id}/restore`, {});
  return data as Etiqueta;
}

// ===== Estados =====
export async function listEstados(): Promise<Estado[]> {
  const { data } = await apiAuth.get('/api/estado-incendio');
  return Array.isArray(data) ? (data as Estado[]) : [];
}

export async function createEstado(payload: { nombre: string; color?: string }) {
  const { data } = await apiAuth.post('/api/estado-incendio', payload);
  return data as Estado;
}

export async function updateEstado(id: string, payload: { nombre?: string; color?: string }) {
  const { data } = await apiAuth.patch(`/api/estado-incendio/${id}`, payload);
  return data as Estado;
}
export async function deleteEstado(id: string) {
  const res = await apiAuth.delete(`/api/estado-incendio/${id}`);
  return res.data ?? { ok: true };
}

// ===== Roles =====

export async function listRoles(opts?: { show?: 'deleted' | 'all'; page?: number; limit?: number; q?: string }): Promise<RolesPaged> {
  const params = new URLSearchParams();
  if (opts?.show) params.set('show', opts.show);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.q) params.set('q', opts.q);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const { data } = await apiAuth.get(`/api/roles${qs}`);
  return data as RolesPaged; // backend: { items, page, limit, total, hasMore }
}

export async function createRole(payload: { nombre: string }) {
  const { data } = await apiAuth.post('/api/roles', payload);
  return data as Role;
}

export async function updateRole(id: string, payload: { nombre?: string }) {
  const { data } = await apiAuth.patch(`/api/roles/${id}`, payload);
  return data as Role;
}

export async function deleteRole(id: string) {
  const { data } = await apiAuth.delete(`/api/roles/${id}`);
  return data;
}

export async function restoreRole(id: string) {
  const { data } = await apiAuth.post(`/api/roles/${id}/restore`);
  return data;
}
// ===== Usuarios (id UUID) =====


export async function listUsers(opts?: { show?: 'deleted' | 'all'; page?: number; limit?: number; q?: string }): Promise<UsersPaged> {
  const params = new URLSearchParams();
    if (opts?.show) params.set('show', opts.show);
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.q) params.set('q', opts.q);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const { data } = await apiAuth.get(`/api/usuarios${qs}`);
  return data as UsersPaged; 
}


export async function createUser(payload: { nombre: string; correo: string; password: string; rolId?: string }) {
  const { data } = await apiAuth.post("/api/usuarios", payload);
  return data as UserAccount;
}

export async function updateUser(
  id: string,
  payload: { nombre?: string; correo?: string; password?: string; rolId?: string | null; activo?: boolean }
) {
  const { data } = await apiAuth.patch(`/api/usuarios/${id}`, payload);
  return data as UserAccount;
}

export async function deleteUser(id: string) {
  const { data } = await apiAuth.delete(`/api/usuarios/${id}`);
  return data;
}

export async function restoreUser(id: string) {
  const { data } = await apiAuth.post(`/api/usuarios/${id}/restore`);
  return data as UserAccount;
}