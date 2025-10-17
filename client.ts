// client.ts
import axios, { AxiosError } from 'axios'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { getToken, logout } from './session'

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants?.expoConfig?.extra as any)?.apiUrl ||
  ''

export const api = axios.create({
  baseURL,
  timeout: 40000, // ⬅️ 20s global
})

// --- Request interceptor ---
api.interceptors.request.use(async (config) => {
  const token = await getToken()
  // marca tiempo de inicio para medir latencia
  ;(config as any).__start = Date.now()

  // Timeout mayor para uploads (multipart)
  const ct =
    (config.headers?.['Content-Type'] as string) ||
    (config.headers?.['content-type'] as string) ||
    ''
  if (ct.includes('multipart/form-data')) {
    config.timeout = Math.max(config.timeout ?? 0, 55000) 
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  console.log('[API REQUEST]', config.method?.toUpperCase(), config.url, token ? '✅ Bearer' : '🚫 no token', `timeout=${config.timeout}ms`)
  return config
})

// --- Response interceptor (ok) ---
api.interceptors.response.use(
  (r) => {
    const t = Date.now() - ((r.config as any).__start || Date.now())
    console.log('[API OK]', r.config.method?.toUpperCase(), r.config.url, r.status, `${t}ms`)
    return r
  },

  // --- Response interceptor (error) ---
  async (error: AxiosError) => {
    const cfg: any = error.config || {}
    const t = Date.now() - (cfg.__start || Date.now())
    const method = (cfg.method || 'get').toLowerCase()

    console.log(
      '[API ERR]',
      method.toUpperCase(),
      cfg?.url,
      'code=', (error as any)?.code,
      'status=', error?.response?.status,
      `${t}ms`
    )

    // 401 → logout como ya hacías
    if (error?.response?.status === 401) {
      try { await logout() } catch {}
      router.replace('/login')
    }

    const isTimeout = (error as any)?.code === 'ECONNABORTED'
    const noResponse = !error.response
    const canRetry = !cfg.__retried && method === 'get' && (isTimeout || noResponse)

    if (canRetry) {
      cfg.__retried = true
      // pequeño backoff
      await new Promise((r) => setTimeout(r, 600))
      console.log('[API RETRY]', method.toUpperCase(), cfg.url)
      return api(cfg)
    }

    return Promise.reject(error)
  }
)
