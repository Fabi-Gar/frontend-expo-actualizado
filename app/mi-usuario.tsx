import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  HelperText,
  ActivityIndicator,
  Chip,
  Divider,
  IconButton,
} from 'react-native-paper';

import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { api } from '@/client';
import { getUser as getUserLocal, saveUser as saveUserLocal } from '@/session';

type Rol = { rol_uuid: string; nombre: string; descripcion?: string | null };
type MeResponse = {
  usuario_uuid: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string;
  rol: Rol;
  is_admin: boolean;
  ultimo_login: string | null;
  creado_en: string;
  actualizado_en: string;
  eliminado_en: string | null;
  institucion: { institucion_uuid: string; nombre: string } | null;
};

const ProfileSchema = Yup.object().shape({
  nombre: Yup.string().required('Requerido'),
  apellido: Yup.string().required('Requerido'),
  email: Yup.string().email('Correo inválido').required('Requerido'),
  telefono: Yup.string().optional(),
});

const PasswordSchema = Yup.object().shape({
  new_password: Yup.string().min(6, 'Mínimo 6 caracteres').required('Requerido'),
  confirm_password: Yup.string()
    .oneOf([Yup.ref('new_password')], 'Las contraseñas no coinciden')
    .required('Requerido'),
});

export default function Perfil() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [secureNew, setSecureNew] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const router = useRouter()
  // Refs para navegar entre campos
  const apellidoRef = useRef<any>(null);
  const emailRef = useRef<any>(null);
  const telRef = useRef<any>(null);
  const passRef = useRef<any>(null);
  const pass2Ref = useRef<any>(null);

  const fetchMe = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<MeResponse>('/usuarios/me');
      setMe(data);
      await saveUserLocal(data as any);
    } catch (e: any) {
      const cached = await getUserLocal<MeResponse>();
      if (cached) {
        setMe(cached);
      } else {
        const msg =
          e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'No se pudo cargar el perfil';
        Alert.alert('Error', String(msg));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMe();
    setRefreshing(false);
  }, [fetchMe]);

  const handleSaveInfo = async (values: any) => {
    if (!me) return;
    try {
      setSavingInfo(true);
      const body = {
        nombre: values.nombre.trim(),
        apellido: values.apellido.trim(),
        email: values.email.trim().toLowerCase(),
        telefono: values.telefono?.trim() || null,
      };
      const { data } = await api.patch<MeResponse>(`/usuarios/${me.usuario_uuid}`, body);
      setMe(data);
      await saveUserLocal(data as any);
      Alert.alert('Éxito', 'Perfil actualizado');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'No se pudo actualizar el perfil';
      Alert.alert('Error', String(msg));
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePassword = async (values: any, resetForm: () => void) => {
    if (!me) return;
    try {
      setSavingPass(true);
      const body = { new_password: values.new_password };
      await api.patch(`/usuarios/${me.usuario_uuid}`, body);
      resetForm();
      Alert.alert('Éxito', 'Contraseña actualizada');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'No se pudo actualizar la contraseña';
      Alert.alert('Error', String(msg));
    } finally {
      setSavingPass(false);
    }
  };

  if (loading && !me) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando perfil…</Text>
      </View>
    );
    }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={Platform.select({ ios: 24, android: 56 })}
        keyboardOpeningTime={0}
      >
        <View style={styles.headerContainer}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
            style={styles.backButton}
          />
          <Text style={styles.title}>Mi perfil</Text>
          <View style={{ width: 40 }} />
        </View>
        {me && (
          <>
            <View style={styles.badgesRow}>
              <Chip style={styles.chip} icon="shield-account">{me.rol?.nombre || 'SIN ROL'}</Chip>
              <Chip style={styles.chip} icon="office-building">{me.institucion?.nombre || 'Sin institución'}</Chip>
              {me.is_admin ? <Chip style={styles.chip} icon="crown">Admin</Chip> : null}
            </View>

            <Divider style={{ marginVertical: 12 }} />

            {/* --- Datos básicos --- */}
            <Formik
              enableReinitialize
              initialValues={{
                nombre: me.nombre || '',
                apellido: me.apellido || '',
                email: me.email || '',
                telefono: me.telefono || '',
              }}
              validationSchema={ProfileSchema}
              onSubmit={handleSaveInfo}
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
                    placeholder="Teléfono"
                    placeholderTextColor="#444"
                    mode="flat"
                    style={styles.input}
                    value={values.telefono}
                    onChangeText={handleChange('telefono')}
                    onBlur={handleBlur('telefono')}
                    keyboardType="phone-pad"
                    error={!!(touched.telefono && errors.telefono)}
                    returnKeyType="done"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                  />
                  <HelperText type="error" visible={!!(touched.telefono && errors.telefono)} style={styles.helper}>
                    {errors.telefono}
                  </HelperText>

                  <Button
                    mode="contained"
                    onPress={() => handleSubmit()}
                    style={styles.saveButton}
                    labelStyle={styles.buttonText}
                    disabled={savingInfo}
                    loading={savingInfo}
                  >
                    Guardar cambios
                  </Button>
                </>
              )}
            </Formik>

            <Divider style={{ marginVertical: 16 }} />

            {/* --- Cambio de contraseña --- */}
            <Text style={styles.sectionTitle}>Cambiar contraseña</Text>
            <Formik
              initialValues={{ new_password: '', confirm_password: '' }}
              validationSchema={PasswordSchema}
              onSubmit={(vals, { resetForm }) => handleChangePassword(vals, resetForm)}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <>
                  <TextInput
                    ref={passRef}
                    placeholder="Nueva contraseña"
                    placeholderTextColor="#444"
                    mode="flat"
                    style={styles.input}
                    secureTextEntry={secureNew}
                    value={values.new_password}
                    onChangeText={handleChange('new_password')}
                    onBlur={handleBlur('new_password')}
                    error={!!(touched.new_password && errors.new_password)}
                    returnKeyType="next"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    onSubmitEditing={() => pass2Ref.current?.focus()}
                    right={
                      <TextInput.Icon
                        icon={secureNew ? 'eye' : 'eye-off'}
                        onPress={() => setSecureNew(s => !s)}
                        forceTextInputFocus={false}
                      />
                    }
                  />
                  <HelperText type="error" visible={!!(touched.new_password && errors.new_password)} style={styles.helper}>
                    {errors.new_password}
                  </HelperText>

                  <TextInput
                    ref={pass2Ref}
                    placeholder="Confirmar nueva contraseña"
                    placeholderTextColor="#444"
                    mode="flat"
                    style={styles.input}
                    secureTextEntry={secureConfirm}
                    value={values.confirm_password}
                    onChangeText={handleChange('confirm_password')}
                    onBlur={handleBlur('confirm_password')}
                    error={!!(touched.confirm_password && errors.confirm_password)}
                    returnKeyType="done"
                    textContentType="oneTimeCode" // evita autocompletar con la misma contraseña en iOS
                    onSubmitEditing={() => handleSubmit()}
                    right={
                      <TextInput.Icon
                        icon={secureConfirm ? 'eye' : 'eye-off'}
                        onPress={() => setSecureConfirm(s => !s)}
                        forceTextInputFocus={false}
                      />
                    }
                  />
                  <HelperText type="error" visible={!!(touched.confirm_password && errors.confirm_password)} style={styles.helper}>
                    {errors.confirm_password}
                  </HelperText>

                  <Button
                    mode="contained"
                    onPress={() => handleSubmit()}
                    style={styles.passwordButton}
                    labelStyle={styles.buttonText}
                    disabled={savingPass}
                    loading={savingPass}
                  >
                    Actualizar contraseña
                  </Button>
            </>
            )}
            </Formik>

            <Divider style={{ marginVertical: 16 }} />

            <View style={styles.metaBox}>
              <Text style={styles.metaText}>
                Último acceso: {me.ultimo_login ? new Date(me.ultimo_login).toLocaleString() : '—'}
              </Text>
              <Text style={styles.metaText}>Creado: {new Date(me.creado_en).toLocaleString()}</Text>
              <Text style={styles.metaText}>Actualizado: {new Date(me.actualizado_en).toLocaleString()}</Text>
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, marginBottom: 8, marginTop: 20, textAlign: 'center', fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginLeft: 20, marginBottom: 6 },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  chip: { marginHorizontal: 4, marginVertical: 4 },
  input: {
    backgroundColor: '#e0e0e0cc',
    marginBottom: 8,
    borderRadius: 8,
    marginLeft: 20,
    marginRight: 20,
  },
  helper: { marginLeft: 24, marginBottom: 6 },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    marginTop: 8,
    marginLeft: 20,
    marginRight: 20,
  },
  passwordButton: {
    backgroundColor: '#009688',
    borderRadius: 10,
    marginTop: 8,
    marginLeft: 20,
    marginRight: 20,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  metaBox: { paddingHorizontal: 20, paddingBottom: 24 },
  metaText: { color: '#555', marginBottom: 4 },

    headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 40,
    marginBottom: 8,
  },
  backButton: {
    margin: 0,
  },
  


});

