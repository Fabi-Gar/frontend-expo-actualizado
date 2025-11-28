// app/incendios/crear.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import {
  Appbar,
  TextInput,
  Button,
  Text,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Yup from 'yup';
import { Formik, FormikProps } from 'formik';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { getCurrentCoords } from '@/hooks/location';
import MapPickerModal from '@/components/MapPickerModal';
import SingleSelectModal from '@/components/SelectorModals/SingleSelectModal';

import { listCatalogoItems, listDepartamentos, listMunicipios } from '@/services/catalogos';
import { createIncendioFormData } from '@/services/incendios';
import { getUser } from '@/session';

type Option = { id: string; label: string };

// --------- Form values ---------
type FormValues = {
  titulo: string;
  descripcion: string;
  lat: string;
  lng: string;

  medioId: string | null;
  deptoId: string | null;
  muniId: string | null;

  telefono: string;
  lugarPoblado: string;
  finca: string;
};

// Schema dinámico que se crea según si el usuario tiene teléfono
const createSchema = (userHasPhone: boolean) => Yup.object({
  titulo: Yup.string().trim().required('Requerido'),
  descripcion: Yup.string().trim().nullable(),
  lat: Yup.string().trim().required('Selecciona ubicación'),
  lng: Yup.string().trim().required('Selecciona ubicación'),
  medioId: Yup.string().required('Selecciona un medio'),
  deptoId: Yup.string().nullable(),
  muniId: Yup.string().nullable(),
  telefono: userHasPhone
    ? Yup.string().nullable()
    : Yup.string().required('Requerido (no tienes teléfono en tu perfil)'),
  lugarPoblado: Yup.string().nullable(),
  finca: Yup.string().nullable(),
});

export default function CrearIncendioConReporte() {
  const router = useRouter();
  const { lat: pLat, lng: pLng } = useLocalSearchParams<{ lat?: string; lng?: string }>();

  // Control de montaje
  const isMountedRef = useRef(true);

  const ensureIncendioPrefix = (raw: string) => {
  const t = (raw ?? '').trim();
  if (!t) return t; // el schema ya exige requerido
  const norm = t.toLowerCase();
  if (norm.startsWith('incendio ') || norm.startsWith('incendio:')) return t;
  return `Incendio ${t}`;
};


  // Usuario
  const [user, setUser] = useState<any>(null);
  const [userHasPhone, setUserHasPhone] = useState(false);

  // Catálogos
  const [medios, setMedios] = useState<Option[]>([]);
  const [deptos, setDeptos] = useState<Option[]>([]);
  const [munis, setMunis] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // Modales
  const [mapModal, setMapModal] = useState(false);
  const [medioModal, setMedioModal] = useState(false);
  const [deptoModal, setDeptoModal] = useState(false);
  const [muniModal, setMuniModal] = useState(false);

  // Foto opcional
  const [pickedImage, setPickedImage] = useState<{
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
  } | null>(null);

  // Seed inicial
  const seedRef = useRef<FormValues | null>(null);

  // Evitar doble carga en dev (StrictMode/Expo)
  const didInitRef = useRef(false);

  // AbortController para municipios
  const muniAbortRef = useRef<AbortController | null>(null);

  // ===== Refs para navegación entre inputs =====
  const descRef = useRef<any>(null);
  const telRef = useRef<any>(null);
  const lugarRef = useRef<any>(null);
  const fincaRef = useRef<any>(null);

  // ===== Helpers de error (amigable + log técnico) - Estable =====
  const reportError = useCallback((err: unknown, fallback = 'Ocurrió un error') => {
    const e: any = err || {};
    const status = e?.response?.status;
    const retryAfter = e?.response?.headers?.['retry-after'];
    const url = e?.config?.url;

    console.error('[CREAR][ERROR]', {
      status,
      url,
      retryAfter,
      message: e?.message,
      data: e?.response?.data,
    });

    let msg =
      e?.response?.data?.error?.message ||
      e?.response?.data?.message ||
      e?.message ||
      fallback;

    if (status === 429) {
      const seconds = Number(retryAfter);
      msg =
        Number.isFinite(seconds) && seconds > 0
          ? `Demasiadas solicitudes. Inténtalo de nuevo en ${seconds} s.`
          : 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
    } else if (status === 503) {
      msg = 'Servicio temporalmente no disponible. Inténtalo más tarde.';
    } else if (status === 502) {
      msg = 'Hubo un problema con el servidor. Reintenta en breve.';
    } else if (e?.request && !e?.response) {
      msg = 'Sin respuesta del servidor. Verifica tu conexión.';
    }

    Alert.alert('Error', String(msg));
  }, []); // Sin dependencias para estabilidad

  // Elegir foto (opcional)
  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos', 'Necesitamos acceso a tus fotos para adjuntar la imagen.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        exif: false,
      });

      if (result.canceled || !isMountedRef.current) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      if (isMountedRef.current) {
        setPickedImage({
          uri: asset.uri,
          fileName: asset.fileName || `foto_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (e) {
      console.error('[pickImage] Error:', e);
      reportError(e, 'No se pudo seleccionar la imagen');
    }
  }, [reportError]);

  /* ============================
   * Carga inicial de catálogos
   * ============================ */
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const ac = new AbortController();
    let isActive = true;

    (async () => {
      try {
        const net = await NetInfo.fetch();
        if (!(net.isConnected && net.isInternetReachable)) {
          if (isActive && isMountedRef.current) {
            Alert.alert('Sin conexión', 'Conéctate a internet para cargar los catálogos.');
          }
        }

        // Cargar usuario y catálogos en paralelo
        const [mediosResp, deptosResp, userData] = await Promise.all([
          listCatalogoItems('medios', { pageSize: 200, signal: ac.signal }),
          listDepartamentos(ac.signal),
          getUser().catch(() => null),
        ]);

        if (!isActive || ac.signal.aborted || !isMountedRef.current) return;

        // Procesar usuario
        const hasPhone = !!(userData?.telefono && String(userData.telefono).trim());
        setUser(userData);
        setUserHasPhone(hasPhone);

        const mediosData = (mediosResp.items || []).map((m: any) => ({
          id: String(m.id),
          label: m.nombre
        }));

        const deptosData = (deptosResp || []).map((d: any) => ({
          id: String(d.id),
          label: d.nombre
        }));

        setMedios(mediosData);
        setDeptos(deptosData);

        seedRef.current = {
          titulo: '',
          descripcion: '',
          lat: pLat ? String(pLat) : '',
          lng: pLng ? String(pLng) : '',
          medioId: null,
          deptoId: null,
          muniId: null,
          telefono: hasPhone ? String(userData.telefono) : '',
          lugarPoblado: '',
          finca: '',
        };
      } catch (e: any) {
        if (ac.signal.aborted || !isActive || !isMountedRef.current) return;

        console.error('[CREAR][init] Error cargando catálogos:', e);
        reportError(e, 'No se pudieron cargar catálogos');

        // Seed con valores por defecto
        seedRef.current = {
          titulo: '',
          descripcion: '',
          lat: pLat ? String(pLat) : '',
          lng: pLng ? String(pLng) : '',
          medioId: null,
          deptoId: null,
          muniId: null,
          telefono: '',
          lugarPoblado: '',
          finca: '',
        };
      } finally {
        if (isActive && isMountedRef.current) {
          setInitLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
      ac.abort();
    };
  }, [pLat, pLng]); // reportError NO en dependencias (es estable)

  /* ============================
   * Municipios dependientes
   * ============================ */
  const muniReqIdRef = useRef(0);
  
  const loadMunicipios = useCallback(async (deptoId?: string | null) => {
    muniReqIdRef.current += 1;
    const reqId = muniReqIdRef.current;

    // Cancelar request anterior
    if (muniAbortRef.current) {
      muniAbortRef.current.abort();
    }

    if (!deptoId) {
      if (isMountedRef.current) {
        setMunis([]);
      }
      return;
    }

    const ac = new AbortController();
    muniAbortRef.current = ac;

    try {
      const arr = await listMunicipios(String(deptoId), ac.signal);
      
      if (ac.signal.aborted || reqId !== muniReqIdRef.current || !isMountedRef.current) {
        return;
      }

      const munisData = (arr || []).map((m: any) => ({ 
        id: String(m.id), 
        label: m.nombre 
      }));

      setMunis(munisData);
    } catch (e: any) {
      if (ac.signal.aborted || reqId !== muniReqIdRef.current || !isMountedRef.current) {
        return;
      }

      console.warn('[CREAR][municipios] Error:', e);
      
      if (isMountedRef.current) {
        setMunis([]);
        Alert.alert('Aviso', 'No se pudieron cargar municipios para el departamento seleccionado.');
      }
    } finally {
      if (muniAbortRef.current === ac) {
        muniAbortRef.current = null;
      }
    }
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Cancelar request de municipios si existe
      if (muniAbortRef.current) {
        muniAbortRef.current.abort();
        muniAbortRef.current = null;
      }
    };
  }, []);

  // Submit con FormData
  const handleSubmitCreate = async (values: FormValues) => {
    if (!isMountedRef.current) return;

    try {
      if (isMountedRef.current) {
        setLoading(true);
      }

      const net = await NetInfo.fetch();
      if (!(net.isConnected && net.isInternetReachable)) {
        if (isMountedRef.current) {
          Alert.alert('Sin conexión', 'Conéctate a internet para guardar.');
          setLoading(false);
        }
        return;
      }

      const latN = Number(values.lat);
      const lonN = Number(values.lng);

      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
        if (isMountedRef.current) {
          Alert.alert('Revisa', 'Coordenadas inválidas');
          setLoading(false);
        }
        return;
      }

      if (!values.medioId) {
        if (isMountedRef.current) {
          Alert.alert('Revisa', 'Selecciona el medio del reporte');
          setLoading(false);
        }
        return;
      }

      // Preparar FormData
      const formData = new FormData();

      try {
        // Datos del incendio con campos del reporte fusionados
        const payload: any = {
          titulo: values.titulo.trim(),
          descripcion: values.descripcion?.trim() || null,
          centroide: {
            type: 'Point' as const,
            coordinates: [lonN, latN] as [number, number]
          },
          medio_uuid: String(values.medioId),
          reportado_en: new Date().toISOString(),
          departamento_uuid: values.deptoId || null,
          municipio_uuid: values.muniId || null,
          lugar_poblado: values.lugarPoblado?.trim() || null,
          finca: values.finca?.trim() || null,
        };

        // Solo incluir teléfono si el usuario NO tiene teléfono guardado
        if (!userHasPhone) {
          payload.telefono = values.telefono?.trim() || null;
        }
        // Si userHasPhone es true, no enviamos telefono y el backend usará el del perfil

        formData.append('data', JSON.stringify(payload));
      } catch (e) {
        console.error('[CREAR] Error preparando FormData:', e);
        throw new Error('Error al preparar los datos');
      }

      // Agregar foto si existe (comprimida)
      if (pickedImage?.uri) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            pickedImage.uri,
            [{ resize: { width: 1600 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );

          if (isMountedRef.current) {
            formData.append('file', {
              uri: manipulated.uri,
              name: pickedImage.fileName || `foto_${Date.now()}.jpg`,
              type: 'image/jpeg',
            } as any);
          }
        } catch (e) {
          console.error('[CREAR] compresión de foto falló:', e);
          if (isMountedRef.current) {
            Alert.alert('Aviso', 'No se pudo procesar la imagen, se creará sin foto');
          }
        }
      }

      // Usar el servicio FormData con nuevo formato
      const result = await createIncendioFormData(formData);

      if (!isMountedRef.current) return;

      Alert.alert(
        'Listo', 
        `Incendio creado ${pickedImage ? 'con foto' : 'sin foto'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (isMountedRef.current) {
                router.replace('/mapa');
              }
            }
          }
        ]
      );
    } catch (e: any) {
      console.error('[handleSubmitCreate] Error:', e);
      if (isMountedRef.current) {
        reportError(e, 'No se pudo guardar');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Helper seguro para obtener nombre por ID
  const nameById = useCallback((arr: Option[], id?: string | null): string => {
    try {
      if (!id || !arr || !Array.isArray(arr)) return '';
      const found = arr.find((x) => String(x.id) === String(id));
      return found?.label ?? '';
    } catch (error) {
      console.error('[nameById] Error:', error);
      return '';
    }
  }, []);

  if (initLoading || !seedRef.current) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando…</Text>
      </View>
    );
  }

  const seed = seedRef.current;

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => {
          try {
            router.back();
          } catch (error) {
            console.error('[Back button] Error:', error);
          }
        }} />
        <Appbar.Content title="Nuevo incendio" />
      </Appbar.Header>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={Platform.select({ ios: 24, android: 56 })}
          keyboardOpeningTime={0}
        >
          <Formik<FormValues>
            initialValues={seed}
            validationSchema={createSchema(userHasPhone)}
            onSubmit={handleSubmitCreate}
            validateOnChange
            validateOnBlur
          >
            {(formik: FormikProps<FormValues>) => {
              const {
                handleChange,
                handleBlur,
                handleSubmit,
                values,
                errors,
                touched,
                setFieldValue,
              } = formik;

              const hasCoords = !!(values.lat?.trim?.() && values.lng?.trim?.());

              return (
                <View>
                  {/* Incendio */}
                  <TextInput
                    label="Título"
                    value={values.titulo}
                    onChangeText={handleChange('titulo')}
                    onBlur={async () => {
                      const next = ensureIncendioPrefix(values.titulo);
                      await setFieldValue('titulo', next, true);     
                      await formik.setFieldTouched('titulo', true);  
                    }}

                    style={styles.input}
                    error={!!(touched.titulo && errors.titulo)}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      try {
                        descRef.current?.focus();
                      } catch (error) {
                        console.error('[titulo onSubmit] Error:', error);
                      }
                    }}
                  />

                  <HelperText type="error" visible={!!(touched.titulo && errors.titulo)}>
                    {errors.titulo as any}
                  </HelperText>

                  <TextInput
                    ref={descRef}
                    label="Descripción"
                    value={values.descripcion}
                    onChangeText={handleChange('descripcion')}
                    onBlur={handleBlur('descripcion')}
                    style={styles.input}
                    multiline
                    returnKeyType="next"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  {/* Ubicación */}
                  <TextInput
                    label="Ubicación"
                    value={
                      hasCoords
                        ? `${Number(values.lat).toFixed(6)}, ${Number(values.lng).toFixed(6)}`
                        : ''
                    }
                    editable={false}
                    right={
                      <TextInput.Icon 
                        icon="map" 
                        onPress={() => {
                          try {
                            setMapModal(true);
                          } catch (error) {
                            console.error('[map icon] Error:', error);
                          }
                        }} 
                      />
                    }
                    style={styles.input}
                    placeholder="Toca el icono de mapa para elegir"
                    error={!!errors.lat || !!errors.lng}
                  />
                  <HelperText type="error" visible={!!errors.lat || !!errors.lng}>
                    {(errors.lat as any) || (errors.lng as any)}
                  </HelperText>

                  <Button
                    mode="outlined"
                    onPress={async () => {
                      try {
                        const c = await getCurrentCoords();
                        if (!c) {
                          Alert.alert('Permiso', 'Ubicación no disponible');
                          return;
                        }
                        await setFieldValue('lat', String(c.lat));
                        await setFieldValue('lng', String(c.lng));
                      } catch (e) {
                        console.error('[getCurrentCoords] Error:', e);
                        reportError(e, 'No se pudo obtener tu ubicación');
                      }
                    }}
                    style={{ marginBottom: 8 }}
                  >
                    Usar mi ubicación
                  </Button>

                  <MapPickerModal
                    visible={mapModal}
                    onClose={() => setMapModal(false)}
                    onConfirm={async ({ lat, lng }) => {
                      try {
                        await setFieldValue('lat', String(lat));
                        await setFieldValue('lng', String(lng));
                        setMapModal(false);
                      } catch (error) {
                        console.error('[MapPickerModal onConfirm] Error:', error);
                      }
                    }}
                    initial={{
                      lat: values.lat ? Number(values.lat) : undefined,
                      lng: values.lng ? Number(values.lng) : undefined,
                    }}
                  />

                  {/* Reporte */}
                  <Text style={styles.section}>Reporte inicial</Text>

                  {/* Medio */}
                  <TextInput
                    label="Medio"
                    value={nameById(medios, values.medioId)}
                    editable={false}
                    right={
                      <TextInput.Icon 
                        icon="menu-down" 
                        onPress={() => {
                          try {
                            setMedioModal(true);
                          } catch (error) {
                            console.error('[medio icon] Error:', error);
                          }
                        }} 
                      />
                    }
                    style={styles.input}
                    error={!!(touched.medioId && errors.medioId)}
                    placeholder="Toca para seleccionar"
                  />
                  <HelperText type="error" visible={!!(touched.medioId && errors.medioId)}>
                    {errors.medioId as any}
                  </HelperText>

                  {/* Departamento */}
                  <TextInput
                    label="Departamento"
                    value={nameById(deptos, values.deptoId)}
                    editable={false}
                    right={
                      <TextInput.Icon 
                        icon="menu-down" 
                        onPress={() => {
                          try {
                            setDeptoModal(true);
                          } catch (error) {
                            console.error('[depto icon] Error:', error);
                          }
                        }} 
                      />
                    }
                    style={styles.input}
                    placeholder="Toca para seleccionar"
                  />

                  {/* Municipio */}
                  <TextInput
                    label="Municipio"
                    value={nameById(munis, values.muniId)}
                    editable={false}
                    right={
                      <TextInput.Icon
                        icon="menu-down"
                        onPress={() => {
                          try {
                            if (!values.deptoId) {
                              Alert.alert('Atención', 'Primero elige un departamento');
                              return;
                            }
                            setMuniModal(true);
                          } catch (error) {
                            console.error('[muni icon] Error:', error);
                          }
                        }}
                      />
                    }
                    style={styles.input}
                    placeholder="Toca para seleccionar"
                  />

                  {/* Teléfono: solo si el usuario NO tiene teléfono en su perfil */}
                  {!userHasPhone && (
                    <>
                      <TextInput
                        ref={telRef}
                        label="Teléfono *"
                        value={values.telefono}
                        onChangeText={handleChange('telefono')}
                        onBlur={handleBlur('telefono')}
                        style={styles.input}
                        keyboardType="phone-pad"
                        returnKeyType="next"
                        textContentType="telephoneNumber"
                        autoComplete="tel"
                        error={!!(touched.telefono && errors.telefono)}
                        onSubmitEditing={() => {
                          try {
                            lugarRef.current?.focus();
                          } catch (error) {
                            console.error('[tel onSubmit] Error:', error);
                          }
                        }}
                      />
                      <HelperText type="error" visible={!!(touched.telefono && errors.telefono)}>
                        {errors.telefono as any}
                      </HelperText>
                    </>
                  )}

                  {/* Mensaje informativo si el usuario tiene teléfono */}
                  {userHasPhone && (
                    <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8 }}>
                      <Text style={{ color: '#2E7D32', fontSize: 14 }}>
                        ✓ Usando tu teléfono: {user?.telefono}
                      </Text>
                    </View>
                  )}

                  <TextInput
                    ref={lugarRef}
                    label="Lugar poblado (opcional)"
                    value={values.lugarPoblado}
                    onChangeText={handleChange('lugarPoblado')}
                    onBlur={handleBlur('lugarPoblado')}
                    style={styles.input}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      try {
                        fincaRef.current?.focus();
                      } catch (error) {
                        console.error('[lugar onSubmit] Error:', error);
                      }
                    }}
                  />

                  <TextInput
                    ref={fincaRef}
                    label="Finca (opcional)"
                    value={values.finca}
                    onChangeText={handleChange('finca')}
                    onBlur={handleBlur('finca')}
                    style={styles.input}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      try {
                        handleSubmit();
                      } catch (error) {
                        console.error('[finca onSubmit] Error:', error);
                      }
                    }}
                  />

                  {/* Foto opcional */}
                  <Text style={styles.section}>Foto del reporte (opcional)</Text>
                  {pickedImage?.uri ? (
                    <View style={{ marginBottom: 8 }}>
                      <Image
                        source={{ uri: pickedImage.uri }}
                        style={{ width: '100%', height: 180, borderRadius: 8, backgroundColor: '#eee' }}
                        resizeMode="cover"
                      />
                      <Button 
                        mode="text" 
                        onPress={() => {
                          try {
                            setPickedImage(null);
                          } catch (error) {
                            console.error('[Quitar foto] Error:', error);
                          }
                        }} 
                        style={{ marginTop: 4 }}
                      >
                        Quitar foto
                      </Button>
                    </View>
                  ) : (
                    <Button 
                      mode="outlined" 
                      icon="image-plus" 
                      onPress={pickImage} 
                      style={{ marginBottom: 8 }}
                    >
                      Elegir imagen
                    </Button>
                  )}

                  {/* Acciones */}
                  <View style={styles.actions}>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        try {
                          router.replace('/mapa');
                        } catch (error) {
                          console.error('[Cancelar] Error:', error);
                        }
                      }}
                      disabled={loading}
                      style={styles.btnCancel}
                    >
                      Cancelar
                    </Button>

                    <Button
                      mode="contained"
                      onPress={() => {
                        try {
                          handleSubmit();
                        } catch (error) {
                          console.error('[Guardar] Error:', error);
                        }
                      }}
                      loading={loading}
                      disabled={loading}
                      style={styles.btnSave}
                    >
                      Guardar
                    </Button>
                  </View>

                  {/* Modales selectores */}
                  <SingleSelectModal
                    visible={medioModal}
                    title="Selecciona medio"
                    options={medios}
                    value={values.medioId}
                    onSelect={async (id) => {
                      try {
                        await setFieldValue('medioId', (id as string) ?? null);
                      } catch (error) {
                        console.error('[medio onSelect] Error:', error);
                      }
                    }}
                    onClose={() => setMedioModal(false)}
                    allowClear={false}
                  />

                  <SingleSelectModal
                    visible={deptoModal}
                    title="Selecciona departamento"
                    options={deptos}
                    value={values.deptoId}
                    onSelect={async (id) => {
                      try {
                        await setFieldValue('deptoId', (id as string) ?? null);
                        await setFieldValue('muniId', null);
                        await loadMunicipios(id as string);
                      } catch (error) {
                        console.error('[depto onSelect] Error:', error);
                      }
                    }}
                    onClose={() => setDeptoModal(false)}
                    allowClear
                  />

                  <SingleSelectModal
                    visible={muniModal}
                    title="Selecciona municipio"
                    options={munis}
                    value={values.muniId}
                    onSelect={async (id) => {
                      try {
                        await setFieldValue('muniId', (id as string) ?? null);
                      } catch (error) {
                        console.error('[muni onSelect] Error:', error);
                      }
                    }}
                    onClose={() => setMuniModal(false)}
                    allowClear
                  />
                </View>
              );
            }}
          </Formik>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 24 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  input: { marginBottom: 12, backgroundColor: '#fff' },
  section: { marginTop: 12, marginBottom: 8, fontWeight: 'bold', color: '#333' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  btnCancel: { flexGrow: 1, flexBasis: '30%', borderColor: '#4CAF50' },
  btnSave: { flexGrow: 1, flexBasis: '30%', backgroundColor: '#4CAF50' },
});