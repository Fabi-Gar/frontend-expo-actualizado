import * as SecureStore from 'expo-secure-store';

const KEY = 'auth_token';


export async function saveToken(token: string) {
  await SecureStore.setItemAsync('token', token);
}

export async function getToken() {
  return await SecureStore.getItemAsync('token');
}

export async function saveUser(user: any) {
  await SecureStore.setItemAsync('user', JSON.stringify(user));
}

export async function getUser() {
  const raw = await SecureStore.getItemAsync('user');
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync('token');
  await SecureStore.deleteItemAsync('user');
}

export async function clearToken() { await SecureStore.deleteItemAsync(KEY); }

