// services/pushNotificationService.ts
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export class PushNotificationService {
  
  /**
   * Obtener el token FCM (Firebase Cloud Messaging)
   */
  static async getFCMToken(): Promise<string | null> {
    try {
      // Solicitar permisos primero
      const permission = await messaging().requestPermission();
      const enabled = 
        permission === messaging.AuthorizationStatus.AUTHORIZED ||
        permission === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('⚠️ Permisos de notificaciones denegados');
        return null;
      }

      // Obtener token FCM
      const fcmToken = await messaging().getToken();
      console.log('🔥 FCM Token obtenido:', fcmToken.substring(0, 30) + '...');
      
      // Guardar en AsyncStorage
      await AsyncStorage.setItem('fcm_token', fcmToken);
      
      return fcmToken;
    } catch (error) {
      console.error('❌ Error obteniendo FCM token:', error);
      return null;
    }
  }

  /**
   * Configurar el listener de notificaciones en primer plano
   */
  static configureForegroundListener() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  /**
   * Listener de notificaciones cuando la app está en background o cerrada
   */
  static configureBackgroundListener() {
    // Notificación recibida cuando app en background
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('📩 Notificación en background:', remoteMessage);
    });

    // Cuando el usuario toca la notificación
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('🔔 Notificación tocada (background):', remoteMessage);
      // Navegar a la pantalla correspondiente
      if (remoteMessage.data?.deeplink) {
        // router.push(remoteMessage.data.deeplink);
      }
    });

    // Cuando la app se abre desde una notificación (estaba cerrada)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('🔔 App abierta desde notificación:', remoteMessage);
          // Navegar a la pantalla correspondiente
        }
      });
  }

  /**
   * Listener de notificaciones en foreground
   */
  static configureForegroundMessageListener() {
    messaging().onMessage(async (remoteMessage) => {
      console.log('📨 Notificación en foreground:', remoteMessage);
      
      // Mostrar notificación local cuando la app está abierta
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'Nueva notificación',
          body: remoteMessage.notification?.body || '',
          data: remoteMessage.data || {},
        },
        trigger: null, // Mostrar inmediatamente
      });
    });
  }

  /**
   * Registrar token en el backend
   */
  static async registerToken(
    userId: string,
    fcmToken: string,
    municipiosSuscritos: string[] = [],
    departamentosSuscritos: string[] = []
  ) {
    try {
      const { api } = await import('../client');
      
      const response = await api.post('/push/register', {
        userId,
        expoPushToken: fcmToken, // Ahora es FCM token
        municipiosSuscritos,
        departamentosSuscritos,
        avisarmeAprobado: true,
        avisarmeActualizaciones: true,
        avisarmeCierres: true,
      });

      console.log('✅ Token FCM registrado en backend:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error registrando FCM token:', error);
      throw error;
    }
  }

  /**
   * Inicializar servicio completo
   */
  static async initialize() {
    try {
      console.log('🚀 Inicializando servicio de notificaciones...');
      
      // Configurar handlers
      this.configureForegroundListener();
      this.configureBackgroundListener();
      this.configureForegroundMessageListener();
      
      // Obtener token
      const fcmToken = await this.getFCMToken();
      
      if (fcmToken) {
        console.log('✅ Servicio de notificaciones inicializado');
        return fcmToken;
      } else {
        console.log('⚠️ No se pudo obtener el token FCM');
        return null;
      }
    } catch (error) {
      console.error('❌ Error inicializando notificaciones:', error);
      return null;
    }
  }
}