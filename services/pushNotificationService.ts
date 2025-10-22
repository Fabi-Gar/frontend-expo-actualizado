// services/pushNotificationService.ts
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

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
   * Manejar navegación desde notificaciones
   */
  private static handleNotificationNavigation(data: any) {
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

  /**
   * Configurar el listener de notificaciones en primer plano (para Expo)
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

    // Listener cuando el usuario toca una notificación local
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('👆 Usuario tocó notificación local:', data);
      this.handleNotificationNavigation(data);
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

    // Cuando el usuario toca la notificación (app en background)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('🔔 Notificación tocada (background):', remoteMessage);
      if (remoteMessage.data) {
        this.handleNotificationNavigation(remoteMessage.data);
      }
    });

    // Cuando la app se abre desde una notificación (estaba cerrada)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('🔔 App abierta desde notificación:', remoteMessage);
          if (remoteMessage.data) {
            // Pequeño delay para asegurar que el router está listo
            setTimeout(() => {
              this.handleNotificationNavigation(remoteMessage.data);
            }, 1000);
          }
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
          sound: 'default',
        },
        trigger: null, // Mostrar inmediatamente
      });
    });
  }

  /**
   * Configurar canal de Android
   */
  static async configureAndroidChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones de Incendios',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
        sound: 'default',
      });
    }
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
        expoPushToken: fcmToken, // Backend lo espera con este nombre
        municipiosSuscritos,
        departamentosSuscritos,
        avisarmeAprobado: true,
        avisarmeActualizaciones: true,
        avisarmeCierres: true,
      });

      console.log('✅ Token FCM registrado en backend');
      return response.data;
    } catch (error) {
      console.error('❌ Error registrando FCM token:', error);
      throw error;
    }
  }

  /**
   * Actualizar preferencias de notificaciones
   */
  static async updatePreferences(
    userId: string,
    municipiosSuscritos: string[] = [],
    departamentosSuscritos: string[] = [],
    avisarmeAprobado: boolean = true,
    avisarmeActualizaciones: boolean = true,
    avisarmeCierres: boolean = true
  ) {
    try {
      const { api } = await import('../client');
      
      const response = await api.post('/push/prefs', {
        userId,
        municipiosSuscritos,
        departamentosSuscritos,
        avisarmeAprobado,
        avisarmeActualizaciones,
        avisarmeCierres,
      });

      console.log('✅ Preferencias actualizadas');
      return response.data;
    } catch (error) {
      console.error('❌ Error actualizando preferencias:', error);
      throw error;
    }
  }

  /**
   * Desregistrar token del backend
   */
  static async unregisterToken(userId: string, fcmToken: string) {
    try {
      const { api } = await import('../client');
      
      const response = await api.post('/push/unregister', {
        userId,
        expoPushToken: fcmToken,
      });

      console.log('✅ Token desregistrado del backend');
      return response.data;
    } catch (error) {
      console.error('❌ Error desregistrando token:', error);
      throw error;
    }
  }

  /**
   * Inicializar servicio completo
   */
  static async initialize() {
    try {
      console.log('🚀 Inicializando servicio de notificaciones FCM...');
      
      // Configurar canal de Android
      await this.configureAndroidChannel();
      
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

  /**
   * Refrescar token (útil para manejar cambios de token)
   */
  static setupTokenRefreshListener() {
    messaging().onTokenRefresh(async (newToken) => {
      console.log('🔄 Token FCM actualizado:', newToken.substring(0, 30) + '...');
      
      // Guardar nuevo token
      await AsyncStorage.setItem('fcm_token', newToken);
      
      // Re-registrar en backend
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          const userId = user.usuario_uuid;
          
          if (userId) {
            await this.registerToken(userId, newToken);
          }
        }
      } catch (error) {
        console.error('❌ Error re-registrando token actualizado:', error);
      }
    });
  }
}