import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { router } from 'expo-router';
import { register, login } from '../services/auth';
import { saveToken } from '../session';

const RegisterSchema = Yup.object().shape({
  name: Yup.string().required('Requerido'),
  username: Yup.string().email('Correo inválido').required('Requerido'),
  password: Yup.string().min(4, 'Mínimo 4 caracteres').required('Requerido'),
  confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Las contraseñas no coinciden').required('Requerido'),
});

export default function Registro() {
  const [loading, setLoading] = useState(false);
  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);

  const handleRegister = async (values: any) => {
    try {
      setLoading(true);
      await register({ name: values.name, email: values.username, password: values.password, rolId: 1 });
      const { token } = await login({ email: values.username, password: values.password });
      if (!token) throw new Error('Respuesta inválida');
      await saveToken(token);
      router.replace('/mapa');
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo registrar';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Regístrate</Text>

      <Formik
        initialValues={{ name: '', username: '', password: '', confirmPassword: '' }}
        validationSchema={RegisterSchema}
        onSubmit={handleRegister}
      >
        {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
          <>
            <TextInput
              placeholder="Nombre"
              placeholderTextColor="#444"
              mode="flat"
              style={styles.input}
              value={values.name}
              onChangeText={handleChange('name')}
              onBlur={handleBlur('name')}
              error={!!(touched.name && errors.name)}
            />
            <HelperText type="error" visible={!!(touched.name && errors.name)} style={styles.helper}>
              {errors.name}
            </HelperText>

            <TextInput
              placeholder="Correo"
              placeholderTextColor="#444"
              mode="flat"
              style={styles.input}
              value={values.username}
              onChangeText={handleChange('username')}
              onBlur={handleBlur('username')}
              autoCapitalize="none"
              keyboardType="email-address"
              error={!!(touched.username && errors.username)}
            />
            <HelperText type="error" visible={!!(touched.username && errors.username)} style={styles.helper}>
              {errors.username}
            </HelperText>

            <TextInput
              placeholder="Crear contraseña"
              placeholderTextColor="#444"
              mode="flat"
              secureTextEntry={secure1}
              style={styles.input}
              value={values.password}
              onChangeText={handleChange('password')}
              onBlur={handleBlur('password')}
              error={!!(touched.password && errors.password)}
              right={<TextInput.Icon icon={secure1 ? 'eye' : 'eye-off'} onPress={() => setSecure1(s => !s)} forceTextInputFocus={false} />}
            />
            <HelperText type="error" visible={!!(touched.password && errors.password)} style={styles.helper}>
              {errors.password}
            </HelperText>

            <TextInput
              placeholder="Repite la contraseña"
              placeholderTextColor="#444"
              mode="flat"
              secureTextEntry={secure2}
              style={styles.input}
              value={values.confirmPassword}
              onChangeText={handleChange('confirmPassword')}
              onBlur={handleBlur('confirmPassword')}
              error={!!(touched.confirmPassword && errors.confirmPassword)}
              right={<TextInput.Icon icon={secure2 ? 'eye' : 'eye-off'} onPress={() => setSecure2(s => !s)} forceTextInputFocus={false} />}
            />
            <HelperText type="error" visible={!!(touched.confirmPassword && errors.confirmPassword)} style={styles.helper}>
              {errors.confirmPassword}
            </HelperText>

            <Button
              mode="contained"
              onPress={() => handleSubmit()}
              style={styles.registerButton}
              labelStyle={styles.buttonText}
              disabled={loading}
              loading={loading}
            >
              Registrarse
            </Button>
          </>
        )}
      </Formik>

      <View style={styles.divider} />

      <TouchableOpacity onPress={() => router.replace('/login')} style={styles.loginButtonContainer} disabled={loading}>
        <Text style={styles.loginButtonText}>Iniciar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, marginBottom: 24, textAlign: 'center', fontWeight: 'bold' },
  input: { backgroundColor: '#e0e0e0cc', marginBottom: 8, borderRadius: 8, marginLeft: 20, marginRight: 20 },
  helper: { marginLeft: 24, marginBottom: 6 },
  registerButton: { backgroundColor: '#4CAF50', borderRadius: 10, marginTop: 28, marginLeft: 20, marginRight: 20 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  divider: { borderBottomColor: '#ccc', borderBottomWidth: 1, marginVertical: 24, width: '100%', marginBottom: 45, marginTop: 45 },
  loginButtonContainer: { backgroundColor: '#263238', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center', marginLeft: 20, marginRight: 20 },
  loginButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
