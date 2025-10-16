import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { router } from 'expo-router';
import { api } from '@/client';
import { saveToken, saveUser } from '@/session';

const RegisterSchema = Yup.object().shape({
  nombre: Yup.string().required('Requerido'),
  apellido: Yup.string().required('Requerido'),
  email: Yup.string().email('Correo inválido').required('Requerido'),
  telefono: Yup.string().optional(),
  password: Yup.string().min(6, 'Mínimo 6 caracteres').required('Requerido'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Las contraseñas no coinciden')
    .required('Requerido'),
});

export default function Registro() {
  const [loading, setLoading] = useState(false);
  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);

  // Refs para navegar entre inputs con el teclado
  const apellidoRef = useRef<any>(null);
  const emailRef = useRef<any>(null);
  const telRef = useRef<any>(null);
  const passRef = useRef<any>(null);
  const pass2Ref = useRef<any>(null);

  const handleRegister = async (values: any) => {
    try {
      setLoading(true);
      const body: any = {
        nombre: values.nombre.trim(),
        apellido: values.apellido.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        telefono: values.telefono?.trim() || null,
        institucion_uuid: null,
      };
      const { data } = await api.post('/auth/register', body);
      const token = data?.token;
      const user = data?.user;

      // Validación de token razonable (formato JWT header.payload.signature)
      if (!token || typeof token !== 'string' || token.split('.').length !== 3 || !user) {
        throw new Error('No se recibió token o usuario');
      }

      await saveToken(token);
      await saveUser(user);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      router.replace('/mapa');
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'No se pudo registrar';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.root}>
        <KeyboardAwareScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={Platform.select({ ios: 24, android: 48 })} // empuje adicional para que el input activo no quede tapado
          keyboardOpeningTime={0}
        >
          <Text style={styles.title}>Regístrate</Text>

          <Formik
            initialValues={{
              nombre: '',
              apellido: '',
              email: '',
              telefono: '',
              password: '',
              confirmPassword: '',
            }}
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
                  value={values.nombre}
                  onChangeText={handleChange('nombre')}
                  onBlur={handleBlur('nombre')}
                  error={!!(touched.nombre && errors.nombre)}
                  returnKeyType="next"
                  textContentType="givenName"
                  autoComplete="given-name"
                  onSubmitEditing={() => apellidoRef.current?.focus()}
                />
                <HelperText type="error" visible={!!(touched.nombre && errors.nombre)} style={styles.helper}>
                  {errors.nombre}
                </HelperText>

                <TextInput
                  ref={apellidoRef}
                  placeholder="Apellido"
                  placeholderTextColor="#444"
                  mode="flat"
                  style={styles.input}
                  value={values.apellido}
                  onChangeText={handleChange('apellido')}
                  onBlur={handleBlur('apellido')}
                  error={!!(touched.apellido && errors.apellido)}
                  returnKeyType="next"
                  textContentType="familyName"
                  autoComplete="family-name"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
                <HelperText type="error" visible={!!(touched.apellido && errors.apellido)} style={styles.helper}>
                  {errors.apellido}
                </HelperText>

                <TextInput
                  ref={emailRef}
                  placeholder="Correo"
                  placeholderTextColor="#444"
                  mode="flat"
                  style={styles.input}
                  value={values.email}
                  onChangeText={handleChange('email')}
                  onBlur={handleBlur('email')}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={!!(touched.email && errors.email)}
                  returnKeyType="next"
                  textContentType="emailAddress"
                  autoComplete="email"
                  onSubmitEditing={() => telRef.current?.focus()}
                />
                <HelperText type="error" visible={!!(touched.email && errors.email)} style={styles.helper}>
                  {errors.email}
                </HelperText>

                <TextInput
                  ref={telRef}
                  placeholder="Teléfono (opcional)"
                  placeholderTextColor="#444"
                  mode="flat"
                  style={styles.input}
                  value={values.telefono}
                  onChangeText={handleChange('telefono')}
                  onBlur={handleBlur('telefono')}
                  keyboardType="phone-pad"
                  error={!!(touched.telefono && errors.telefono)}
                  returnKeyType="next"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  onSubmitEditing={() => passRef.current?.focus()}
                />
                <HelperText type="error" visible={!!(touched.telefono && errors.telefono)} style={styles.helper}>
                  {errors.telefono}
                </HelperText>

                <TextInput
                  ref={passRef}
                  placeholder="Crear contraseña"
                  placeholderTextColor="#444"
                  mode="flat"
                  secureTextEntry={secure1}
                  style={styles.input}
                  value={values.password}
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  error={!!(touched.password && errors.password)}
                  returnKeyType="next"
                  textContentType="newPassword"
                  autoComplete="new-password"
                  onSubmitEditing={() => pass2Ref.current?.focus()}
                  right={
                    <TextInput.Icon
                      icon={secure1 ? 'eye' : 'eye-off'}
                      onPress={() => setSecure1(s => !s)}
                      forceTextInputFocus={false}
                    />
                  }
                />
                <HelperText type="error" visible={!!(touched.password && errors.password)} style={styles.helper}>
                  {errors.password}
                </HelperText>

                <TextInput
                  ref={pass2Ref}
                  placeholder="Repite la contraseña"
                  placeholderTextColor="#444"
                  mode="flat"
                  secureTextEntry={secure2}
                  style={styles.input}
                  value={values.confirmPassword}
                  onChangeText={handleChange('confirmPassword')}
                  onBlur={handleBlur('confirmPassword')}
                  error={!!(touched.confirmPassword && errors.confirmPassword)}
                  returnKeyType="done"
                  textContentType="oneTimeCode" // evita autocompletar con el mismo pass en iOS
                  onSubmitEditing={() => handleSubmit()}
                  right={
                    <TextInput.Icon
                      icon={secure2 ? 'eye' : 'eye-off'}
                      onPress={() => setSecure2(s => !s)}
                      forceTextInputFocus={false}
                    />
                  }
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
        </KeyboardAwareScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingBottom: 48, // espacio extra para el botón con teclado abierto
    justifyContent: 'center',
  },
  title: { fontSize: 22, marginBottom: 24, textAlign: 'center', fontWeight: 'bold' },
  input: { backgroundColor: '#e0e0e0cc', marginBottom: 8, borderRadius: 8, marginLeft: 20, marginRight: 20 },
  helper: { marginLeft: 24, marginBottom: 6 },
  registerButton: { backgroundColor: '#4CAF50', borderRadius: 10, marginTop: 28, marginLeft: 20, marginRight: 20 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  divider: { borderBottomColor: '#ccc', borderBottomWidth: 1, marginVertical: 24, width: '100%', marginBottom: 45, marginTop: 45 },
  loginButtonContainer: { backgroundColor: '#263238', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center', marginLeft: 20, marginRight: 20 },
  loginButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
