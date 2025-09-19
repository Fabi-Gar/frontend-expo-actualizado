import React from 'react';
import { Stack } from 'expo-router';
import { Provider as PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox } from 'react-native';
import { NotificationProvider } from '@/components/NotificationContext';
import GlobalToast from '@/components/GlobalToast';
import GlobalLoader from '@/components/GlobalLoader';

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
