// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { Provider as PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, Platform } from 'react-native';
import { NotificationProvider } from '@/components/NotificationContext';
import GlobalToast from '@/components/GlobalToast';
import GlobalLoader from '@/components/GlobalLoader';

// --- push notif
//import * as Notifications from 'expo-notifications';
//import { registerForPushIfNeeded } from '@/services/register';

LogBox.ignoreLogs(['useInsertionEffect must not schedule updates']);

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4CAF50',
    secondary: '#009688',
  },
};

/* Mostrar notificación aunque la app esté en foreground (opcional)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // iOS 14+
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});*/

export default function RootLayout() {
  const router = useRouter();

  const userId: string | null = null;

  /* Crear canal Android "default"
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      }).catch(() => {});
    }
  }, []);*/

  /* Navegar cuando el usuario toca una notificación
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response: Notifications.NotificationResponse) => {
        const data = (response.notification.request.content.data || {}) as Record<string, any>;
        const incendioId = data.incendio_id as string | number | undefined;
        const deeplink = data.deeplink as string | undefined;

        if (incendioId != null) {
          // forma type-safe con pathname + params
          router.push({
            pathname: '/incendios/detalles',
            params: { id: String(incendioId) },
          });
          return;
        }

        if (typeof deeplink === 'string') {
          // si te llega un string arbitrario, castear a Href
          router.push(deeplink as unknown as Href);
        }
      }
    );
    return () => sub.remove();
  }, [router]);

  // Registrar token con el backend cuando haya userId
  useEffect(() => {
    if (!userId) return;
    registerForPushIfNeeded({ userId }).catch((e: unknown) =>
      console.warn('registerForPushIfNeeded error', e)
    );
  }, [userId]);*/

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
