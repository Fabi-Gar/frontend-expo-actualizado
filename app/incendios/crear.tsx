// app/incendios/crear.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { Appbar, TextInput, Button, Text, HelperText, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Yup from 'yup';
import { Formik, FormikProps } from 'formik';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { getCurrentCoords } from '@/hooks/location';
import MapPickerModal from '@/components/MapPickerModal';
import SingleSelectModal from '@/components/SelectorModals/SingleSelectModal';

import { listCatalogoItems, listDepartamentos, listMunicipios } from '@/services/catalogos';
import { createIncendioWithReporte } from '@/services/incendios';
import { uploadReporteFoto } from '@/services/uploads';

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
  observaciones: string;
  lugarPoblado: string;
  finca: string;
};

const schema = Yup.object({
  titulo: Yup.string().trim().required('Requerido'),
  descripcion: Yup.string().trim().nullable(),
  lat: Yup.string().trim().required('Selecciona ubicación'),
  lng: Yup.string().trim().required('Selecciona ubicación'),
  medioId: Yup.string().required('Selecciona un medio'),
  deptoId: Yup.string().nullable(),
  muniId: Yup.string().nullable(),
  telefono: Yup.string().nullable(),
  observaciones: Yup.string().nullable(),
  lugarPoblado: Yup.string().nullable(),
  finca: Yup.string().nullable(),
});

export default function CrearIncendioConReporte() {
  const router = useRouter();
  const { lat: pLat, lng: pLng } = useLocalSearchParams<{ lat?: string; lng?: string }>();

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
  const [pickedImage, setPickedImage] = useState<{ uri: string; fileName?: string | null; mimeType?: string | null } | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  // Seed inicial
  const seedRef = useRef<FormValues | null>(null);

  // Evitar doble carga en dev (StrictMode/Expo)
  const didInitRef = useRef(false);

  // ===== Helpers de error (amigable + log técnico) =====
  const reportError = useCallback((err: unknown, fallback = 'Ocurrió un error') => {
    const e: any = err || {};
    const status = e?.response?.status;
    const retryAfter = e?.response?.headers?.['retry-after'];
    const url = e?.config?.url;

    // Log detallado a consola (para depurar)
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
  }, []);

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
        quality: 1, // original; comprimimos después
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setPickedImage({
        uri: asset.uri,
        fileName: asset.fileName || `foto_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      });
    } catch (e) {
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

    (async () => {
      try {
        const net = await NetInfo.fetch();
        if (!(net.isConnected && net.isInternetReachable)) {
          Alert.alert('Sin conexión', 'Conéctate a internet para cargar los catálogos.');
        }

        const [mediosResp, deptosResp] = await Promise.all([
          listCatalogoItems('medios', { pageSize: 200, signal: ac.signal }),
          listDepartamentos(ac.signal),
        ]);

        if (ac.signal.aborted) return;

        setMedios((mediosResp.items || []).map((m: any) => ({ id: String(m.id), label: m.nombre })));
        setDeptos((deptosResp || []).map((d: any) => ({ id: String(d.id), label: d.nombre })));

        seedRef.current = {
          titulo: '',
          descripcion: '',
          lat: pLat ? String(pLat) : '',
          lng: pLng ? String(pLng) : '',

          medioId: null,
          deptoId: null,
          muniId: null,

          telefono: '',
          observaciones: '',
          lugarPoblado: '',
          finca: '',
        };
      } catch (e) {
        if (ac.signal.aborted) return;
        reportError(e, 'No se pudieron cargar catálogos');
        seedRef.current = {
          titulo: '',
          descripcion: '',
          lat: pLat ? String(pLat) : '',
          lng: pLng ? String(pLng) : '',
          medioId: null,
          deptoId: null,
          muniId: null,
          telefono: '',
          observaciones: '',
          lugarPoblado: '',
          finca: '',
        };
      } finally {
        if (!ac.signal.aborted) setInitLoading(false);
      }
    })();

    return () => ac.abort();
  }, [pLat, pLng, reportError]);

  /* ============================
   * Municipios dependientes
   * ============================ */
  const muniReqIdRef = useRef(0);
  const loadMunicipios = useCallback(async (deptoId?: string | null) => {
    muniReqIdRef.current += 1;
    const reqId = muniReqIdRef.current;

    if (!deptoId) {
      setMunis([]);
      return;
    }

    const ac = new AbortController();
    try {
      const arr = await listMunicipios(String(deptoId), ac.signal);
      if (ac.signal.aborted || reqId !== muniReqIdRef.current) return;
      setMunis((arr || []).map((m: any) => ({ id: String(m.id), label: m.nombre })));
    } catch (e) {
      if (ac.signal.aborted || reqId !== muniReqIdRef.current) return;
      console.warn('[CREAR][municipios] fallo', e);
      setMunis([]);
      Alert.alert('Aviso', 'No se pudieron cargar municipios para el departamento seleccionado.');
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

  const nameById = (arr: Option[], id?: string | null) =>
    id ? (arr.find((x) => String(x.id) === String(id))?.label ?? '') : '';

  // Submit
  const handleSubmitCreate = async (values: FormValues) => {
    try {
      setLoading(true);

      const net = await NetInfo.fetch();
      if (!(net.isConnected && net.isInternetReachable)) {
        Alert.alert('Sin conexión', 'Conéctate a internet para guardar.');
        setLoading(false);
        return;
      }

      const latN = Number(values.lat);
      const lonN = Number(values.lng);

      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
        Alert.alert('Revisa', 'Coordenadas inválidas');
        return;
      }
      if (!values.medioId) {
        Alert.alert('Revisa', 'Selecciona el medio del reporte');
        return;
      }

      // Payload plano para /incendios/with-reporte
      const payload = {
        titulo: values.titulo.trim(),
        descripcion: values.descripcion?.trim() || null,
        centroide: { type: 'Point' as const, coordinates: [lonN, latN] as [number, number] },
        reporte: {
          medio_uuid: String(values.medioId),
          ubicacion: { type: 'Point' as const, coordinates: [lonN, latN] as [number, number] },
          reportado_en: new Date().toISOString(),
          observaciones: values.observaciones?.trim() || null,
          telefono: values.telefono?.trim() || null,
          departamento_uuid: values.deptoId || null,
          municipio_uuid: values.muniId || null,
          lugar_poblado: values.lugarPoblado?.trim() || null,
          finca: values.finca?.trim() || null,
        },
      };

      // → ahora el servicio retorna { incendio, reporte_uuid }
      const { incendio, reporte_uuid } = await createIncendioWithReporte(payload);

      // Si hay foto seleccionada, comprimirla y subirla
      if (reporte_uuid && pickedImage?.uri) {
        try {
          // Comprimir/redimensionar (máx 1600px de ancho, JPEG 0.8)
          const manipulated = await ImageManipulator.manipulateAsync(
            pickedImage.uri,
            [{ resize: { width: 1600 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );

          setUploadPct(0);
          await uploadReporteFoto(
            String(reporte_uuid),
            {
              uri: manipulated.uri,
              name: pickedImage.fileName || `foto_${Date.now()}.jpg`,
              type: 'image/jpeg',
            },
            undefined, // crédito opcional: pásalo aquí si lo agregas al form
            (pct) => setUploadPct(pct)
          );
        } catch (e) {
          console.error('[CREAR] subida de foto falló', e);
          Alert.alert('Aviso', 'Incendio creado, pero la foto no se pudo subir.');
        }
      }

      Alert.alert('Listo', 'Incendio creado con reporte');
      router.replace('/mapa');
    } catch (e: any) {
      reportError(e, 'No se pudo guardar');
    } finally {
      setLoading(false);
      setUploadPct(0);
    }
  };

  const seed = seedRef.current;

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nuevo incendio" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.container}>
        <Formik<FormValues>
          initialValues={seed}
          validationSchema={schema}
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
                  onBlur={handleBlur('titulo')}
                  style={styles.input}
                  error={!!(touched.titulo && errors.titulo)}
                />
                <HelperText type="error" visible={!!(touched.titulo && errors.titulo)}>
                  {errors.titulo as any}
                </HelperText>

                <TextInput
                  label="Descripción"
                  value={values.descripcion}
                  onChangeText={handleChange('descripcion')}
                  onBlur={handleBlur('descripcion')}
                  style={styles.input}
                  multiline
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
                  right={<TextInput.Icon icon="map" onPress={() => setMapModal(true)} />}
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
                  onConfirm={({ lat, lng }) => {
                    void setFieldValue('lat', String(lat));
                    void setFieldValue('lng', String(lng));
                    setMapModal(false);
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
                  right={<TextInput.Icon icon="menu-down" onPress={() => setMedioModal(true)} />}
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
                  right={<TextInput.Icon icon="menu-down" onPress={() => setDeptoModal(true)} />}
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
                        if (!values.deptoId) {
                          Alert.alert('Atención', 'Primero elige un departamento');
                          return;
                        }
                        setMuniModal(true);
                      }}
                    />
                  }
                  style={styles.input}
                  placeholder="Toca para seleccionar"
                />

                <TextInput
                  label="Teléfono (opcional)"
                  value={values.telefono}
                  onChangeText={handleChange('telefono')}
                  onBlur={handleBlur('telefono')}
                  style={styles.input}
                  keyboardType="phone-pad"
                />

                <TextInput
                  label="Observaciones (opcional)"
                  value={values.observaciones}
                  onChangeText={handleChange('observaciones')}
                  onBlur={handleBlur('observaciones')}
                  style={styles.input}
                  multiline
                />

                <TextInput
                  label="Lugar poblado (opcional)"
                  value={values.lugarPoblado}
                  onChangeText={handleChange('lugarPoblado')}
                  onBlur={handleBlur('lugarPoblado')}
                  style={styles.input}
                />

                <TextInput
                  label="Finca (opcional)"
                  value={values.finca}
                  onChangeText={handleChange('finca')}
                  onBlur={handleBlur('finca')}
                  style={styles.input}
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
                    <Button mode="text" onPress={() => setPickedImage(null)} style={{ marginTop: 4 }}>
                      Quitar foto
                    </Button>
                  </View>
                ) : (
                  <Button mode="outlined" icon="image-plus" onPress={pickImage} style={{ marginBottom: 8 }}>
                    Elegir imagen
                  </Button>
                )}
                {uploadPct > 0 && uploadPct < 1 ? (
                  <Text>Subiendo foto… {Math.round(uploadPct * 100)}%</Text>
                ) : null}

                {/* Acciones */}
                <View style={styles.actions}>
                  <Button
                    mode="outlined"
                    onPress={() => router.replace('/mapa')}
                    disabled={loading}
                    style={styles.btnCancel}
                  >
                    Cancelar
                  </Button>

                  <Button
                    mode="contained"
                    onPress={() => handleSubmit()}
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
                  onSelect={(id) => {
                    void setFieldValue('medioId', (id as string) ?? null);
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
                    void setFieldValue('deptoId', (id as string) ?? null);
                    // reset municipio y cargar
                    void setFieldValue('muniId', null);
                    await loadMunicipios(id as string);
                  }}
                  onClose={() => setDeptoModal(false)}
                  allowClear
                />

                <SingleSelectModal
                  visible={muniModal}
                  title="Selecciona municipio"
                  options={munis}
                  value={values.muniId}
                  onSelect={(id) => void setFieldValue('muniId', (id as string) ?? null)}
                  onClose={() => setMuniModal(false)}
                  allowClear
                />
              </View>
            );
          }}
        </Formik>
      </ScrollView>
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
