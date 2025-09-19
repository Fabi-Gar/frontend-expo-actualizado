import axios from 'axios';

const baseURL = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000';
console.log('🔗 API baseURL:', baseURL);

export const api = axios.create({
  baseURL,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});


// helper simple
export function toQuery(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    q.append(k, String(v));
  });
  return q.toString();
}
