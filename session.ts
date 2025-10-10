import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') return localStorage.setItem(key, value)
  try { await SecureStore.setItemAsync(key, value) } catch { await AsyncStorage.setItem(key, value) }
}
async function getItem(key: string) {
  if (Platform.OS === 'web') return localStorage.getItem(key) || null
  try { return await SecureStore.getItemAsync(key) } catch { return await AsyncStorage.getItem(key) }
}
async function removeItem(key: string) {
  if (Platform.OS === 'web') return localStorage.removeItem(key)
  try { await SecureStore.deleteItemAsync(key) } catch { await AsyncStorage.removeItem(key) }
}

export async function saveToken(token: string) { await setItem(TOKEN_KEY, token) }
export async function getToken() { return await getItem(TOKEN_KEY) }
export async function clearToken() { await removeItem(TOKEN_KEY) }

export async function saveUser(user: any) { await setItem(USER_KEY, JSON.stringify(user)) }
export async function getUser<T = any>() {
  const v = await getItem(USER_KEY)
  return v ? (JSON.parse(v) as T) : null
}
export async function clearUser() { await removeItem(USER_KEY) }

export async function logout() { await clearToken(); await clearUser() }
