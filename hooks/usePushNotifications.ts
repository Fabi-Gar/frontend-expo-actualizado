// hooks/usePushNotifications.ts
import { useState, useEffect } from 'react';
import { PushNotificationService } from '../services/pushNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const usePushNotifications = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        console.log('🚀 Inicializando notificaciones...');
        
        // 1. Inicializar servicio completo
        const token = await PushNotificationService.initialize();
        setFcmToken(token);
        
        // 2. Configurar listener de refresh de token
        PushNotificationService.setupTokenRefreshListener();
        
        setIsInitialized(true);

        // 3. Verificar si ya hay un usuario logueado y registrar token
        if (token) {
          await registerTokenForExistingUser(token);
        }

      } catch (err: any) {
        console.error('❌ Error inicializando notificaciones:', err);
        setIsInitialized(true); // Marcamos como inicializado incluso con error
      }
    };

    initializeNotifications();
  }, []);

  // Función para registrar token para usuario existente
  const registerTokenForExistingUser = async (token: string) => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const userId = user.id || user._id || user.usuario_uuid;
        
        if (userId) {
          console.log('📡 Registrando token para usuario existente:', userId);
          await PushNotificationService.registerToken(userId, token);
        }
      }
    } catch (error) {
      console.error('❌ Error registrando token para usuario existente:', error);
    }
  };

  // Función para obtener token (útil para login)
  const getFCMToken = async (): Promise<string | null> => {
    if (fcmToken) return fcmToken;
    
    // Si no tenemos token, intentar obtenerlo
    try {
      const token = await PushNotificationService.getFCMToken();
      setFcmToken(token);
      return token;
    } catch (error) {
      console.error('❌ Error obteniendo token FCM:', error);
      return null;
    }
  };

  return {
    fcmToken,
    getFCMToken, // ← IMPORTANTE: Para usar en el login
    isInitialized,
  };
};