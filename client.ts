// client.ts
import axios from 'axios'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { getToken,logout  } from './session'

const baseURL = process.env.EXPO_PUBLIC_API_URL || (Constants?.expoConfig?.extra as any)?.apiUrl || ''

export const api = axios.create({ baseURL })

api.interceptors.request.use(async (config) => {
  const token = await getToken()
   console.log('[API REQUEST]', config.url, token ? '✅ Bearer attached' : '🚫 no token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  async (error) => {
    if (error?.response?.status === 401) {
      await logout()
      router.replace('/login')
    }
    return Promise.reject(error)
  }
)
