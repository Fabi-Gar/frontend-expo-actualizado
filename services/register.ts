// push/register.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { pushRegister } from '@/services/push';

/** Obtiene el token de Expo (usa projectId de EAS si existe) */
async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    // iOS: asegúrate que el usuario conceda permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      Constants?.expoConfig?.extra?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data || null;
  } catch (e) {
    console.warn('getExpoPushToken error', e);
    return null;
  }
}

/** Crea canal Android por si no existiera */
async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    } catch {}
  }
}

/** Registra el token en backend si hace falta */
export async function registerForPushIfNeeded(opts: {
  userId: string;
  regionesSuscritas?: string[];
  avisarmeAprobado?: boolean;
}) {
  await ensureAndroidChannel();

  const token = await getExpoPushToken();
  if (!token) {
    console.log('No se obtuvo Expo push token (permiso denegado o simulador)');
    return;
  }

  // Enviar al backend
  await pushRegister({
    userId: opts.userId,
    expoPushToken: token,
    regionesSuscritas: opts.regionesSuscritas,
    avisarmeAprobado: opts.avisarmeAprobado,
  });
  // Si quieres, guarda el token en algún storage para mostrar en depuración
  // await AsyncStorage.setItem('@expoPushToken', token);
}
