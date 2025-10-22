// hooks/usePushNotifications.ts
import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configurar cómo se muestran las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    // Registrar para notificaciones
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        console.log('📱 Token Expo Push:', token);
      }
    });

    // Listener: cuando llega una notificación (app abierta)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📩 Notificación recibida:', notification);
      setNotification(notification);
    });

    // Listener: cuando el usuario toca la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('👆 Usuario tocó notificación:', data);
      
      handleNotificationNavigation(data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
}

// Función para navegar según el tipo de notificación
function handleNotificationNavigation(data: any) {
  const { type, incendio_id, deeplink } = data;

  console.log('🧭 Navegando desde notificación:', { type, incendio_id, deeplink });

  // Opción 1: Usar deeplink si existe
  if (deeplink) {
    router.push(deeplink);
    return;
  }

  // Opción 2: Navegar según el tipo
  switch (type) {
    case 'incendio_aprobado':
    case 'incendio_actualizado':
    case 'incendio_cerrado':
    case 'incendio_nuevo_municipio':
    case 'incendio_nuevo_departamento':
      if (incendio_id) {
        router.push(`/incendios/${incendio_id}` as any);
      }
      break;

    case 'cierre_iniciado':
    case 'cierre_actualizado':
    case 'cierre_finalizado':
    case 'cierre_reabierto':
      if (incendio_id) {
        router.push(`/incendios/${incendio_id}` as any);
      }
      break;

    default:
      // Navegar al listado de notificaciones
      router.push('/notificaciones');
  }
}

// Función para registrar el dispositivo
async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;

  // Android: Configurar canal de notificaciones
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
      sound: 'default',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permisos de notificaciones no otorgados');
      return;
    }
    
    // Obtener token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId) {
        console.error('❌ No se encontró projectId en app.json');
        return;
      }

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('✅ Token obtenido:', token);
    } catch (error) {
      console.error('❌ Error obteniendo token:', error);
    }
  } else {
    console.warn('⚠️ Debes usar un dispositivo físico para notificaciones push');
  }

  return token;
}