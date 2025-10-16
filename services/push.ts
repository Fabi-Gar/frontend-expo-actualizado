// services/push.ts
import { api } from '../client';

export async function pushRegister(params: {
  userId: string;
  expoPushToken: string;
  regionesSuscritas?: string[];
  avisarmeAprobado?: boolean;
}) {
  const { data } = await api.post('/push/register', params);
  return data; // { ok, data: { prefsId, tokenId } }
}

export async function pushUpdatePrefs(params: {
  userId: string;
  regionesSuscritas?: string[];
  avisarmeAprobado?: boolean;
}) {
  const { data } = await api.post('/push/prefs', params);
  return data;
}

export async function pushUnregister(params: {
  userId: string;
  expoPushToken: string;
}) {
  const { data } = await api.post('/push/unregister', params);
  return data;
}
