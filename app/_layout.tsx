// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Provider as PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox } from 'react-native';
import { NotificationProvider } from '@/components/NotificationContext';
import GlobalToast from '@/components/GlobalToast';
import GlobalLoader from '@/components/GlobalLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PushNotificationService} from '@/services/pushNotificationService';

LogBox.ignoreLogs(['useInsertionEffect must not schedule updates']);

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4CAF50',
    secondary: '#009688',
  },
};

export default function RootLayout() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // ✅ Inicializar Firebase y obtener FCM token
  useEffect(() => {
    initializeNotifications();
  }, []);

  // ✅ Registrar token cuando esté disponible y el usuario autenticado
  useEffect(() => {
    if (!fcmToken) return;
    
    // Guardar en AsyncStorage para usarlo en el login
    AsyncStorage.setItem('fcm_token', fcmToken);
    
    // Intentar registrar si ya hay usuario
    registerTokenInBackend(fcmToken);
  }, [fcmToken]);

  async function initializeNotifications() {
    try {
      console.log('🚀 Inicializando notificaciones Firebase...');
      
      // Inicializar servicio de notificaciones (incluye FCM)
      const token = await PushNotificationService.initialize();
      
      if (token) {
        console.log('✅ FCM Token obtenido:', token.substring(0, 30) + '...');
        setFcmToken(token);
        
        // ✅ Configurar listener para refrescar token
        PushNotificationService.setupTokenRefreshListener();
      } else {
        console.log('⚠️ No se pudo obtener FCM token');
      }
    } catch (error) {
      console.error('❌ Error inicializando notificaciones:', error);
    }
  }

  async function registerTokenInBackend(token: string) {
    try {
      // Obtener el usuario del AsyncStorage
      const userStr = await AsyncStorage.getItem('user');
      
      if (!userStr) {
        console.log('⏭️ Usuario no autenticado, esperando login...');
        return;
      }

      const user = JSON.parse(userStr);
      const userId = user.usuario_uuid;

      if (!userId) {
        console.log('⚠️ No se encontró usuario_uuid');
        return;
      }

      // Obtener preferencias guardadas (si las tienes)
      const municipiosStr = await AsyncStorage.getItem('municipios_suscritos');
      const departamentosStr = await AsyncStorage.getItem('departamentos_suscritos');
      
      const municipios = municipiosStr ? JSON.parse(municipiosStr) : [];
      const departamentos = departamentosStr ? JSON.parse(departamentosStr) : [];

      console.log('📤 Registrando token en backend para usuario:', userId);

      // Registrar en el backend
      await PushNotificationService.registerToken(
        userId,
        token,
        municipios,
        departamentos
      );

      console.log('✅ Token FCM registrado exitosamente en backend');
    } catch (error) {
      console.error('❌ Error registrando token:', error);
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <NotificationProvider>
            <Stack screenOptions={{ headerShown: false }} />
            <GlobalToast />
            <GlobalLoader />
          </NotificationProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}