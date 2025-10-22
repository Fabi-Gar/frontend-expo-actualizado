// services/pushNotificationService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://garmen.cloud';

export const PushNotificationService = {
  /**
   * Registrar token en el backend
   */
  async registerToken(
    userId: string,
    expoPushToken: string,
    municipiosSuscritos: string[] = [],
    departamentosSuscritos: string[] = []
  ) {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      const response = await fetch(`${API_URL}/api/push/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          expoPushToken,
          municipiosSuscritos,
          departamentosSuscritos,
          avisarmeAprobado: true,
          avisarmeActualizaciones: true,
          avisarmeCierres: true,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar token');
      }

      console.log('✅ Token registrado en backend');
      return data;
    } catch (error) {
      console.error('❌ Error registrando token:', error);
      throw error;
    }
  },

  /**
   * Actualizar preferencias de notificaciones
   */
  async updatePreferences(
    userId: string,
    preferences: {
      municipiosSuscritos?: string[];
      departamentosSuscritos?: string[];
      avisarmeAprobado?: boolean;
      avisarmeActualizaciones?: boolean;
      avisarmeCierres?: boolean;
    }
  ) {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      const response = await fetch(`${API_URL}/api/push/prefs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          ...preferences,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error actualizando preferencias');
      }

      console.log('✅ Preferencias actualizadas');
      return data;
    } catch (error) {
      console.error('❌ Error actualizando preferencias:', error);
      throw error;
    }
  },

  /**
   * Desregistrar token (logout)
   */
  async unregisterToken(userId: string, expoPushToken: string) {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      const response = await fetch(`${API_URL}/api/push/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          expoPushToken,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error desregistrando token');
      }

      console.log('✅ Token desregistrado');
      return data;
    } catch (error) {
      console.error('❌ Error desregistrando token:', error);
      throw error;
    }
  },
};