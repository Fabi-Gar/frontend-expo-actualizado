// app/index.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getToken, logout } from '../session';

// Función para validar si el token JWT no ha expirado
async function isTokenValid(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  
  try {
    // Decodificar el payload del JWT (sin validar firma, solo leer)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // exp viene en segundos, convertir a ms
    const now = Date.now();
    
    return now < exp; // true si no ha expirado
  } catch (error) {
    console.error('Error decodificando token:', error);
    return false;
  }
}

export default function Index() {
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getToken();
      const isValid = await isTokenValid();
      
      if (token && isValid) {
        console.log('✅ Token válido encontrado, redirigiendo al mapa');
        router.replace('/mapa');
      } else {
        console.log('❌ Token no válido o no existe, redirigiendo al login');
        await logout(); // Limpiar token expirado
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error verificando token:', error);
      await logout();
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4CAF50" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});