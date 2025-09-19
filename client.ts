import axios, { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { getToken } from './session'; 

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
});

export const apiAuth = axios.create({ baseURL: api.defaults.baseURL });

apiAuth.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken();
  if (token) {
    if (!config.headers) config.headers = new AxiosHeaders();
    if (config.headers instanceof AxiosHeaders) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      (config.headers as any)['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});
