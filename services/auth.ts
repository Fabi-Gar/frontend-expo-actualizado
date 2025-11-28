import { api } from '../client'

export async function login(payload: {
  email: string;
  password: string;
  expoPushToken?: string; // ← Agregar parámetro opcional
}) {
  const { data } = await api.post('/auth/login', {
    email: payload.email,
    password: payload.password,
    expoPushToken: payload.expoPushToken, // ← Enviar al backend
  })

  const { token, user } = data || {}
  if (!token) throw new Error('Respuesta inválida del servidor')

  return { token, user }
}

export async function register(_payload: { name: string; email: string; password: string; rolId?: number }) {
  throw new Error('Registro deshabilitado: use un admin en /usuarios')
}