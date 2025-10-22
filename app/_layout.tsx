// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Provider as PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, Platform } from 'react-native';
import { NotificationProvider } from '@/components/NotificationContext';
import GlobalToast from '@/components/GlobalToast';
import GlobalLoader from '@/components/GlobalLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Importar el hook de notificaciones
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { PushNotificationService } from '@/services/pushNotificationService';

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
  // ✅ Usar el hook de notificaciones
  const { expoPushToken } = usePushNotifications();

  // ✅ Registrar token cuando esté disponible
  useEffect(() => {
    if (!expoPushToken) return;

    registerTokenInBackend(expoPushToken);
  }, [expoPushToken]);

  async function registerTokenInBackend(token: string) {
    try {
      // Obtener userId del AsyncStorage (ajusta según tu implementación)
      const userId = await AsyncStorage.getItem('user_id');
      
      if (!userId) {
        console.log('⏭️ Usuario no autenticado, esperando login...');
        return;
      }

      // Obtener preferencias guardadas (si las tienes)
      const municipiosStr = await AsyncStorage.getItem('municipios_suscritos');
      const departamentosStr = await AsyncStorage.getItem('departamentos_suscritos');
      
      const municipios = municipiosStr ? JSON.parse(municipiosStr) : [];
      const departamentos = departamentosStr ? JSON.parse(departamentosStr) : [];

      // Registrar en el backend
      await PushNotificationService.registerToken(
        userId,
        token,
        municipios,
        departamentos
      );

      console.log('✅ Token registrado exitosamente en backend');
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