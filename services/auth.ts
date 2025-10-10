import { api } from '../client'
import { saveToken, saveUser } from '../session'

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post('/auth/login', { email: payload.email, password: payload.password })
  const { token, user } = data || {}
  if (!token) throw new Error('Respuesta inválida del servidor')
  await saveToken(token)
  await saveUser(user)
  return { token, user }
}

export async function register(_payload: { name: string; email: string; password: string; rolId?: number }) {
  throw new Error('Registro deshabilitado: use un admin en /usuarios')
}
