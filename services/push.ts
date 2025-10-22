// services/push.ts
import { api } from '../client';

/**
 * Registrar token FCM y preferencias en el backend
 */
export async function pushRegister(params: {
  userId: string;
  expoPushToken: string; // Es FCM token pero backend lo espera con este nombre
  municipiosSuscritos?: string[];
  departamentosSuscritos?: string[];
  avisarmeAprobado?: boolean;
  avisarmeActualizaciones?: boolean;
  avisarmeCierres?: boolean;
}) {
  const { data } = await api.post('/push/register', params);
  return data; // { ok, data: { prefsId, tokenId } }
}

/**
 * Actualizar preferencias de notificaciones
 */
export async function pushUpdatePrefs(params: {
  userId: string;
  municipiosSuscritos?: string[];
  departamentosSuscritos?: string[];
  avisarmeAprobado?: boolean;
  avisarmeActualizaciones?: boolean;
  avisarmeCierres?: boolean;
}) {
  const { data } = await api.post('/push/prefs', params);
  return data;
}

/**
 * Desregistrar token FCM del backend
 */
export async function pushUnregister(params: {
  userId: string;
  expoPushToken: string; // Es FCM token pero backend lo espera con este nombre
}) {
  const { data } = await api.post('/push/unregister', params);
  return data;
}