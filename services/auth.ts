import { api } from '../client';

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post('/api/auth/login', {
    correo: payload.email,
    password: payload.password,
  });
  return data;
}

export async function register(payload: { name: string; email: string; password: string; rolId?: number }) {
  const { data } = await api.post('/api/auth/register', {
    nombre: payload.name,
    correo: payload.email,
    password: payload.password,
    rolId: payload.rolId ?? 1,
  });
  return data;
}
