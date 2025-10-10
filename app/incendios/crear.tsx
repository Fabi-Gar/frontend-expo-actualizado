import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Appbar, TextInput, Button, Text, Switch, HelperText, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Yup from 'yup';
import { Formik, FormikProps } from 'formik';

import { getCurrentCoords } from '@/hooks/location';
import PhotoPickerRow from '@/components/PhotoPickerRow';
import MapPickerModal from '@/components/MapPickerModal';

import SingleSelectModal from '@/components/SelectorModals/SingleSelectModal';
import MultiSelectModal from '@/components/SelectorModals/MultiSelectModal';

import {
  createIncendioAvanzado,
  getIncendio,
  updateIncendio,
  Incendio,
} from '@/services/incendios';
import {
  listRegiones,
  listEtiquetas,
  listEstados,
  Region,
  Etiqueta,
  Estado
} from '@/services/catalogos';
import { getUser } from '@/session';

type IncendioFormValues = {
  titulo: string;
  descripcion: string;
  regionId: string | null;  // UUID
  lat: string;
  lng: string;              // Se enviará como lon al backend
  etiquetasIds: string[];   // UUID[]
  estadoId: string;         // UUID (requerido)
  visiblePublico: boolean;
  fechaFin: string;
  reporteInicial: string;
};

type Option = { id: string; label: string };

const toArray = <T,>(resp: any): T[] => (Array.isArray(resp) ? resp : (resp?.items ?? []));

const makeSchema = (isEdit: boolean) =>
  Yup.object({
    titulo: Yup.string().trim().required('Requerido'),
    regionId: Yup.string().nullable(),
    lat: isEdit ? Yup.string().nullable() : Yup.string().trim().required('Selecciona ubicación'),
    lng: isEdit ? Yup.string().nullable() : Yup.string().trim().required('Selecciona ubicación'),
    estadoId: Yup.string().trim().required('Selecciona un estado'),
    reporteInicial: isEdit
      ? Yup.string().trim().nullable()
      : Yup.string().trim().min(5, 'Muy corto').required('Describe el reporte inicial'),
    fechaFin: Yup.string()
      .trim()
      .nullable()
      .test('iso', 'Formato ISO inválido', (v) => !v || !v.length || !Number.isNaN(Date.parse(v))),
    visiblePublico: Yup.boolean().optional(),
    etiquetasIds: Yup.array(Yup.string()).default([]),
  });

export default function IncendioForm() {
  const router = useRouter();
  const { id, lat: pLat, lng: pLng } = useLocalSearchParams<{ id?: string; lat?: string; lng?: string }>();
  const isEdit = !!id;

  // Catálogos
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);

  // Modales select
  const [regionModal, setRegionModal] = useState(false);
  const [estadoModal, setEstadoModal] = useState(false);
  const [tagsModal, setTagsModal] = useState(false);

  const [mapModal, setMapModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [photos, setPhotos] = useState<{ uri: string; name?: string; mime?: string }[]>([]);

  const [isAdmin, setIsAdmin] = useState(false);

  const seedRef = useRef<IncendioFormValues | null>(null);

  // Load inicial
  useEffect(() => {
    (async () => {
      try {
        const user = await getUser();
        const admin = (user?.rol?.nombre || '').toLowerCase().includes('admin');
        setIsAdmin(admin);

        const [rRaw, eRaw, sRaw] = await Promise.all([listRegiones(), listEtiquetas(), listEstados()]);
        const r = toArray<Region>(rRaw);
        const t = toArray<Etiqueta>(eRaw);
        const s = toArray<Estado>(sRaw);

        setRegiones(r);
        setEtiquetas(t);
        setEstados(s);

        if (isEdit && id) {
          const item: Incendio = await getIncendio(String(id));

          const regionId = item?.region ? String((item as any).region.id) : null;

          const lat = typeof (item as any).lat === 'number'
            ? (item as any).lat
            : item.ubicacion?.coordinates?.[1];

          const lon = typeof (item as any).lng === 'number'
            ? (item as any).lng
            : (item as any).lon ?? item.ubicacion?.coordinates?.[0];

          const etiquetasIds = (item.etiquetas || []).map((t: any) => String(t.id));
          const estadoId = String(item.estadoActual?.estado?.id ?? (s?.[0]?.id || ''));

          seedRef.current = {
            titulo: item.titulo || '',
            descripcion: item.descripcion || '',
            regionId,
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
            estadoId: s?.[0]?.id || '',
            visiblePublico: admin, // por defecto si es admin
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

  if (initLoading || !seedRef.current) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando…</Text>
      </View>
    );
  }

  // Opciones para modales
  const regionOptions: Option[] = regiones.map(r => ({ id: String(r.id), label: r.nombre }));
  const estadoOptions: Option[] = estados.map(e => ({ id: String(e.id), label: e.nombre }));
  const etiquetaOptions: { id: string; label: string }[] = etiquetas.map(t => ({ id: String(t.id), label: t.nombre }));

  const nameById = (arr: Option[], id?: string | null) =>
    id ? (arr.find(x => String(x.id) === String(id))?.label ?? '') : '';

  // Crear
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

      // ⬇️ URLs de fotos del reporte inicial (se usará la primera como portada en el backend)
      const reporteInicialFotos = (photos || [])
        .map(p => p?.uri)
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0);

      await createIncendioAvanzado({
        titulo: values.titulo,
        descripcion: values.descripcion,
        regionId: values.regionId ?? undefined,
        lat: latN,
        lon: lonN,
        visiblePublico: isAdmin ? values.visiblePublico : false,
        etiquetasIds: values.etiquetasIds,
        fechaInicio: new Date().toISOString(),
        reporteInicial: values.reporteInicial,
        reporteInicialFotos,
        estadoInicialId: values.estadoId,
      });

      Alert.alert('Listo', 'Incendio creado');
      router.replace('/mapa');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  // Editar
  const handleSubmitEdit = async (values: IncendioFormValues) => {
    if (!id) return;
    try {
      setLoading(true);

      const body: any = {
        titulo: values.titulo,
        descripcion: values.descripcion,
        visiblePublico: isAdmin ? values.visiblePublico : false,
        regionId: values.regionId ?? null, // permitir limpiar
        etiquetasIds: values.etiquetasIds ?? [],
        // 👇 cambio de estado incluido en el mismo PATCH
        estadoId: values.estadoId || undefined,
      };

      const latN = parseFloat(values.lat as any);
      const lonN = parseFloat(values.lng as any);
      if (Number.isFinite(latN) && Number.isFinite(lonN)) {
        body.lat = latN;
        body.lon = lonN;
      }

      if (values.fechaFin?.trim()) body.fechaFin = values.fechaFin.trim();

      await updateIncendio(String(id), body);

      Alert.alert('Listo', 'Incendio actualizado');
      router.replace('/mapa');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo actualizar');
    } finally {
      setLoading(false);
    }
  };

  const seed = seedRef.current;

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={isEdit ? 'Editar incendio' : 'Nuevo incendio'} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.container}>
        <Formik<IncendioFormValues>
          initialValues={seed}
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

            const hasCoords = !!(values.lat?.trim?.() && values.lng?.trim?.());

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

                <View style={styles.row}>
                  <Text style={{ marginRight: 12 }}>Visible al público</Text>
                  <Switch
                    value={values.visiblePublico}
                    onValueChange={(v) => { void setFieldValue('visiblePublico', v); }}
                    disabled={!isAdmin}
                  />
                </View>
                {!isAdmin && (
                  <HelperText type="info" visible>
                    Un administrador debe habilitar la visibilidad pública.
                  </HelperText>
                )}

                {/* Región */}
                <TextInput
                  label="Región"
                  value={nameById(regionOptions, values.regionId)}
                  editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setRegionModal(true)} />}
                  style={styles.input}
                  error={!!(touched.regionId && errors.regionId)}
                  placeholder="Toca para seleccionar"
                />
                <HelperText type="error" visible={!!(touched.regionId && errors.regionId)}>
                  {errors.regionId as any}
                </HelperText>

                {/* Estado */}
                <TextInput
                  label="Estado"
                  value={nameById(estadoOptions, values.estadoId)}
                  editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setEstadoModal(true)} />}
                  style={styles.input}
                  error={!!(touched.estadoId && errors.estadoId)}
                  placeholder="Toca para seleccionar"
                />
                <HelperText type="error" visible={!!(touched.estadoId && errors.estadoId)}>
                  {errors.estadoId as any}
                </HelperText>

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

                {/* Etiquetas (solo crear) */}
                {!isEdit && (
                  <>
                    <TextInput
                      label="Etiquetas"
                      value={
                        values.etiquetasIds.length
                          ? `${values.etiquetasIds.length} seleccionada(s)`
                          : ''
                      }
                      editable={false}
                      right={<TextInput.Icon icon="menu-down" onPress={() => setTagsModal(true)} />}
                      style={styles.input}
                      placeholder="Toca para seleccionar"
                    />
                    <HelperText type="info" visible>
                      Puedes elegir varias
                    </HelperText>
                  </>
                )}

                {/* Reporte inicial / Fecha fin */}
                {!isEdit ? (
                  <>
                    <Text style={{ marginBottom: 6, marginTop: 8 }}>Fotos (opcional)</Text>
                    <PhotoPickerRow value={photos} onChange={setPhotos} max={4} />

                    <HelperText type="info" visible>
                      La primera foto se usará como portada del incendio.
                    </HelperText>

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

                {/* Modales */}
                <SingleSelectModal
                  visible={regionModal}
                  title="Selecciona región"
                  options={regionOptions}
                  value={values.regionId ?? null}
                  onSelect={(id) => setFieldValue('regionId', (id as string) ?? null)}
                  onClose={() => setRegionModal(false)}
                  allowClear
                />

                <SingleSelectModal
                  visible={estadoModal}
                  title="Selecciona estado"
                  options={estadoOptions}
                  value={values.estadoId ?? null}
                  onSelect={(id) => setFieldValue('estadoId', (id as string) ?? '')}
                  onClose={() => setEstadoModal(false)}
                  allowClear={false}
                />

                <MultiSelectModal
                  visible={tagsModal}
                  title="Selecciona etiquetas"
                  options={etiquetaOptions}
                  value={values.etiquetasIds}
                  onChange={(ids) => setFieldValue('etiquetasIds', ids.map(String))}
                  onClose={() => setTagsModal(false)}
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
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  btnCancel: { flexGrow: 1, flexBasis: '30%', borderColor: '#4CAF50' },
  btnSave: { flexGrow: 1, flexBasis: '30%', backgroundColor: '#4CAF50' },
});
