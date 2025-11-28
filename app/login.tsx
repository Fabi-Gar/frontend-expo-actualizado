import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { router } from 'expo-router';
import { login } from '../services/auth';
import { saveToken, saveUser } from '../session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PushNotificationService } from '../services/pushNotificationService';

const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Correo inválido').required('Requerido'),
  password: Yup.string().min(4, 'Mínimo 4 caracteres').required('Requerido'),
});

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [secure, setSecure] = useState(true);

  const onSubmitLogin = async (values: { email: string; password: string }) => {
    try {
      setLoading(true);

      const fcmToken = await AsyncStorage.getItem('fcm_token');

      console.log('🔍 DEBUG Login:', {
        email: values.email,
        hasFCMToken: !!fcmToken,
      });

      const { token, user } = await login({
        ...values,
        expoPushToken: fcmToken || undefined, // Enviar FCM token
      });

      // Guardar token y usuario
      await saveToken(token);
      await saveUser(user);

      console.log('✅ Login exitoso y token push enviado al backend');

      router.replace('/mapa');
    } catch (e: any) {
      // 🔎 Captura segura de error de red o backend
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Usuario o contraseña incorrecto';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡Bienvenido!</Text>

      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={LoginSchema}
        onSubmit={onSubmitLogin}
      >
        {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
          <>
            <TextInput
              placeholder="Correo electrónico"
              placeholderTextColor="#444"
              mode="flat"
              underlineColor="transparent"
              style={styles.input}
              onChangeText={handleChange('email')}
              onBlur={handleBlur('email')}
              value={values.email}
              autoCapitalize="none"
              keyboardType="email-address"
              error={!!(touched.email && errors.email)}
            />
            <HelperText
              type="error"
              visible={!!(touched.email && errors.email)}
              style={styles.helper}
            >
              {errors.email}
            </HelperText>

            <TextInput
              placeholder="Contraseña"
              placeholderTextColor="#444"
              mode="flat"
              underlineColor="transparent"
              style={styles.input}
              secureTextEntry={secure}
              value={values.password}
              onChangeText={handleChange('password')}
              onBlur={handleBlur('password')}
              error={!!(touched.password && errors.password)}
              right={
                <TextInput.Icon
                  icon={secure ? 'eye' : 'eye-off'}
                  onPress={() => setSecure((s) => !s)}
                  forceTextInputFocus={false}
                />
              }
            />
            <HelperText
              type="error"
              visible={!!(touched.password && errors.password)}
              style={styles.helper}
            >
              {errors.password}
            </HelperText>

            <Button
              mode="contained"
              onPress={() => handleSubmit()}
              style={styles.primaryButton}
              labelStyle={styles.buttonText}
              disabled={loading}
              loading={loading}
            >
              Iniciar sesión
            </Button>
          </>
        )}
      </Formik>

      <View style={styles.divider} />

      <TouchableOpacity
        onPress={() => router.push('/registro')}
        style={styles.registerButtonContainer}
        disabled={loading}
      >
        <Text style={styles.registerButtonText}>Registrarse</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, marginBottom: 24, textAlign: 'center', fontWeight: 'bold' },
  input: { backgroundColor: '#e0e0e0cc', marginBottom: 4, borderRadius: 8, marginLeft: 20, marginRight: 20 },
  helper: { marginLeft: 24, marginBottom: 6 },
  primaryButton: {
    marginBottom: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    marginTop: 8,
    paddingVertical: 4,
    marginLeft: 20,
    marginRight: 20,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  divider: { borderBottomColor: '#ccc', borderBottomWidth: 1, marginVertical: 24, marginTop: 45, marginBottom: 45, width: '100%' },
  registerButtonContainer: { backgroundColor: '#263238', paddingVertical: 15, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center', marginLeft: 20, marginRight: 20 },
  registerButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});