import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { TextInput, Button, Text, Switch, HelperText } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Yup from 'yup';
import { Formik, FormikProps } from 'formik';

import { getCurrentCoords } from '@/hooks/location';
import PhotoPickerRow from '@/components/PhotoPickerRow';
import MapPickerModal from '@/components/MapPickerModal';

// Campos desacoplados
import RegionSelectField from '@/components/SelectorModals/RegionSelectField';
import EstadoSelectField from '@/components/SelectorModals/EstadoSelectField';
import EtiquetasSelectField from '@/components/SelectorModals/EtiquetasSelectField';

import {
  createIncendioAvanzado,
  setEstadoIncendio,
  getIncendio,
  updateIncendio,
  Incendio,
} from '@/services/incendios';
import { listRegiones, listEtiquetas, listEstados, Region, Etiqueta, Estado } from '@/services/catalogos';
import { getUser } from '@/session';

type IncendioFormValues = {
  titulo: string;
  descripcion: string;
  regionId?: number | null;
  lat: string;
  lng: string;
  etiquetasIds: number[];
  estadoId: number;
  visiblePublico: boolean;
  fechaFin: string;
  reporteInicial: string;
};

const makeSchema = (isEdit: boolean) =>
  Yup.object({
    titulo: Yup.string().trim().required('Requerido'),
    // Si quieres forzar región en crear, agrega .required('Selecciona una región')
    regionId: Yup.number()
      .transform((v, orig) => (orig === '' || orig == null ? undefined : v))
      .nullable(),
    lat: isEdit ? Yup.string().nullable() : Yup.string().trim().required('Selecciona ubicación'),
    lng: isEdit ? Yup.string().nullable() : Yup.string().trim().required('Selecciona ubicación'),
    estadoId: Yup.number().typeError('Selecciona un estado').required('Requerido'),
    reporteInicial: isEdit
      ? Yup.string().trim().nullable()
      : Yup.string().trim().min(5, 'Muy corto').required('Describe el reporte inicial'),
    fechaFin: Yup.string()
      .trim()
      .nullable()
      .test('iso', 'Formato ISO inválido', (v) => !v || !v.length || !Number.isNaN(Date.parse(v))),
    visiblePublico: Yup.boolean().optional(),
    etiquetasIds: Yup.array(Yup.number()).default([]),
  });

export default function IncendioForm() {
  const router = useRouter();
  const { id, lat: pLat, lng: pLng } = useLocalSearchParams<{ id?: string; lat?: string; lng?: string }>();
  const isEdit = !!id;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const isAdmin = currentUser?.rol?.id === 2;

  const [regiones, setRegiones] = useState<Region[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [estados, setEstados] = useState<Estado[]>([]);

  const [mapModal, setMapModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  const [photos, setPhotos] = useState<{ uri: string; name?: string; mime?: string }[]>([]);

  // Semilla estable para evitar re-montar Formik (no uses enableReinitialize)
  const seedRef = useRef<IncendioFormValues | null>(null);

  // Cargar usuario, catálogos y (si aplica) los datos del incendio a editar
  useEffect(() => {
    (async () => {
      try {
        const u = await getUser();
        setCurrentUser(u || null);

        const [r, e, s] = await Promise.all([listRegiones(), listEtiquetas(), listEstados()]);
        setRegiones(r || []);
        setEtiquetas(e || []);
        setEstados(s || []);

        if (isEdit && id) {
          const item: Incendio = await getIncendio(String(id));
          const regionId =
            typeof item.region === 'object' && item.region ? (item.region as any).id : undefined;
          const lat =
            typeof (item as any).lat === 'number'
              ? (item as any).lat
              : item.ubicacion?.coordinates?.[1];
          const lon =
            typeof (item as any).lng === 'number'
              ? (item as any).lng
              : (item as any).lon ?? item.ubicacion?.coordinates?.[0];
          const etiquetasIds = (item.etiquetas || []).map((t) => t.id);
          const estadoId = item.estadoActual?.estado?.id ?? 1;

          seedRef.current = {
            titulo: item.titulo || '',
            descripcion: item.descripcion || '',
            regionId: (regionId as any) ?? null,
            lat: lat != null ? String(lat) : '',
            lng: lon != null ? String(lon) : '',
            etiquetasIds,
            estadoId,
            visiblePublico: !!item.visiblePublico,
            fechaFin: item.fechaFin ? new Date(item.fechaFin).toISOString() : '',
            reporteInicial: '',
          };
        } else {
          seedRef.current = {
            titulo: '',
            descripcion: '',
            regionId: null,
            lat: (pLat as string) ?? '',
            lng: (pLng as string) ?? '',
            etiquetasIds: [],
            estadoId: 1,
            visiblePublico: u?.rol?.id === 2 ? true : false,
            fechaFin: '',
            reporteInicial: '',
          };
        }
      } catch {
        Alert.alert('Error', 'No se pudieron cargar datos iniciales');
      } finally {
        setInitLoading(false);
      }
    })();
  }, [id, isEdit, pLat, pLng]);


  const handleSubmitCreate = async (values: IncendioFormValues) => {
    try {
      setLoading(true);

      const latN = parseFloat(values.lat as any);
      const lonN = parseFloat(values.lng as any);
      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
        Alert.alert('Revisa', 'Coordenadas inválidas');
        setLoading(false);
        return;
      }

      const created = await createIncendioAvanzado({
        titulo: values.titulo,
        descripcion: values.descripcion,
        regionId: values.regionId ?? undefined,
        lat: latN,
        lon: lonN,
        visiblePublico: isAdmin ? values.visiblePublico : false,
        etiquetasIds: values.etiquetasIds,
        fechaInicio: new Date().toISOString(),
        reporteInicial: values.reporteInicial,
      });

      await setEstadoIncendio(created.id, Number(values.estadoId));

      // Si tienes un flujo para subir fotos, colócalo aquí.
      // await uploadIncendioPhotos(created.id, photos);

      Alert.alert('Listo', 'Incendio creado');
      router.replace('/mapa');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEdit = async (values: IncendioFormValues) => {
    if (!id) return;
    try {
      setLoading(true);

      const body: any = {
        titulo: values.titulo,
        descripcion: values.descripcion,
        visiblePublico: isAdmin ? values.visiblePublico : false,
      };

      const latN = parseFloat(values.lat as any);
      const lonN = parseFloat(values.lng as any);
      if (Number.isFinite(latN) && Number.isFinite(lonN)) {
        body.lat = latN;
        body.lon = lonN;
      }

      if (values.fechaFin && values.fechaFin.trim().length > 0) {
        body.fechaFin = values.fechaFin;
      }

      await updateIncendio(String(id), body);

      try {
        await setEstadoIncendio(String(id), Number(values.estadoId));
      } catch {
        // Si falla el estado, no bloqueamos
      }

      Alert.alert('Listo', 'Incendio actualizado');
      router.replace('/mapa');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setLoading(false);
    }
  };

  if (initLoading || !seedRef.current) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{isEdit ? 'Editar incendio' : 'Nuevo incendio'}</Text>

      <Formik<IncendioFormValues>
        initialValues={seedRef.current}
        validationSchema={makeSchema(isEdit)}
        onSubmit={isEdit ? handleSubmitEdit : handleSubmitCreate}
        validateOnChange
        validateOnBlur
      >
        {(formik: FormikProps<IncendioFormValues>) => {
          const {
            handleChange,
            handleBlur,
            handleSubmit,
            values,
            errors,
            touched,
            setFieldValue,
          } = formik;

          const hasCoords =
            values.lat?.trim?.().length > 0 && values.lng?.trim?.().length > 0;

          return (
            <View>
              <TextInput
                label="Título"
                value={values.titulo}
                onChangeText={handleChange('titulo')}
                onBlur={handleBlur('titulo')}
                style={styles.input}
                error={!!(touched.titulo && errors.titulo)}
              />

              <TextInput
                label="Descripción"
                value={values.descripcion}
                onChangeText={handleChange('descripcion')}
                onBlur={handleBlur('descripcion')}
                style={styles.input}
                multiline
              />

              {isAdmin ? (
                <View style={styles.row}>
                  <Text style={{ marginRight: 12 }}>Visible al público</Text>
                  <Switch
                    value={values.visiblePublico}
                    onValueChange={(v) => { void setFieldValue('visiblePublico', v); }}
                  />
                </View>
              ) : (
                <HelperText type="info" visible>
                  Este reporte será <Text style={{ fontWeight: 'bold' }}>NO público</Text> hasta que un
                  administrador lo habilite.
                </HelperText>
              )}

              {/* Región */}
              <RegionSelectField
                // convertimos las regiones del service (id:number) a (id:string)
                regions={regiones.map(r => ({ id: String(r.id), nombre: r.nombre }))}

                // el formulario debe guardar y pasar string | null
                value={(values.regionId as unknown as string) ?? null}

                // guardamos el UUID (string) en el form
                onChange={(id) => setFieldValue('regionId', id)}

                error={touched.regionId ? (errors.regionId as string) : undefined}
                touched={!!touched.regionId}
              />




              {/* Estado */}
              <EstadoSelectField
                value={values.estadoId}
                onChange={(id) => setFieldValue('estadoId', id)}
                estados={estados}
                error={touched.estadoId ? (errors.estadoId as any) : undefined}
                touched={touched.estadoId as any}
              />

              {/* Coordenadas */}
              {!isEdit ? (
                <>
                  <TextInput
                    label="Localización"
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
                      const c = await getCurrentCoords();
                      if (!c) {
                        Alert.alert('Permiso', 'Ubicación no disponible');
                        return;
                      }
                      await setFieldValue('lat', String(c.lat));
                      await setFieldValue('lng', String(c.lng));
                    }}
                    disabled={loading}
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
                </>
              ) : (
                <>
                  <TextInput label="Latitud" value={values.lat} style={styles.input} disabled />
                  <TextInput label="Longitud" value={values.lng} style={styles.input} disabled />
                </>
              )}

              {/* Etiquetas (multi) */}
              {!isEdit && (
                <EtiquetasSelectField
                  value={values.etiquetasIds}
                  onChange={(ids) => setFieldValue('etiquetasIds', ids)}
                  etiquetas={etiquetas}
                  error={touched.etiquetasIds ? (errors.etiquetasIds as any) : undefined}
                  touched={touched.etiquetasIds as any}
                />
              )}

              {/* Reporte inicial / Fecha fin en edición */}
              {!isEdit ? (
                <>
                  <Text style={{ marginBottom: 6, marginTop: 8 }}>Fotos (opcional)</Text>
                  <PhotoPickerRow value={photos} onChange={setPhotos} max={4} />

                  <TextInput
                    label="Reporte inicial"
                    value={values.reporteInicial}
                    onChangeText={handleChange('reporteInicial')}
                    onBlur={handleBlur('reporteInicial')}
                    style={styles.input}
                    multiline
                    placeholder="¿Qué se observó? ¿Cómo se recibió el aviso?"
                    error={!!(touched.reporteInicial && errors.reporteInicial)}
                  />
                  <HelperText type="error" visible={!!(touched.reporteInicial && errors.reporteInicial)}>
                    {errors.reporteInicial as any}
                  </HelperText>
                </>
              ) : (
                <>
                  <TextInput
                    label="Fecha fin (ISO) opcional"
                    value={values.fechaFin}
                    onChangeText={handleChange('fechaFin')}
                    onBlur={handleBlur('fechaFin')}
                    style={styles.input}
                    placeholder="2025-08-02T14:00:00.000Z"
                    error={!!(touched.fechaFin && errors.fechaFin)}
                  />
                  <HelperText type="error" visible={!!(touched.fechaFin && errors.fechaFin)}>
                    {errors.fechaFin as any}
                  </HelperText>
                </>
              )}

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
                  {isEdit ? 'Actualizar' : 'Guardar'}
                </Button>
              </View>
            </View>
          );
        }}
      </Formik>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', paddingTop: 45 },
  input: { marginBottom: 12, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  btnCancel: { flexGrow: 1, flexBasis: '30%', borderColor: '#4CAF50' },
  btnSave: { flexGrow: 1, flexBasis: '30%', backgroundColor: '#4CAF50' },
});
