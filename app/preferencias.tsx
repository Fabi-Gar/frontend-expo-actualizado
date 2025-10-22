import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Text, Switch, Button, Divider, Chip, ActivityIndicator, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { api } from '@/client';
import { getUser } from '@/session';
import { listDepartamentos, listMunicipios, Departamento, Municipio } from '@/services/catalogos';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PushNotificationService } from '@/services/pushNotificationService';

export default function PrefsScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMuns, setLoadingMuns] = useState(false);

  const [regiones, setRegiones] = useState<string[]>([]);
  const [municipiosSeleccionados, setMunicipiosSeleccionados] = useState<string[]>([]);
  
  // Preferencias de notificaciones
  const [avisarmeAprobado, setAvisarmeAprobado] = useState<boolean>(true);
  const [avisarmeActualizaciones, setAvisarmeActualizaciones] = useState<boolean>(true);
  const [avisarmeCierres, setAvisarmeCierres] = useState<boolean>(true);
  
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Cargar usuario
  useEffect(() => {
    (async () => {
      try {
        const u = await getUser();
        setUser(u || null);
      } finally {
        setLoadingUser(false);
      }
    })();
  }, []);

  // Cargar departamentos
  useEffect(() => {
    (async () => {
      try {
        const deps = await listDepartamentos();
        setDepartamentos(deps);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'No se pudieron cargar departamentos');
      } finally {
        setLoadingDeps(false);
      }
    })();
  }, []);

  // Cargar municipios cuando se seleccionen departamentos
  useEffect(() => {
    if (regiones.length > 0) {
      loadMunicipios();
    } else {
      setMunicipios([]);
    }
  }, [regiones]);

  // Cargar preferencias existentes
  useEffect(() => {
    if (user?.usuario_uuid) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const storedRegiones = await AsyncStorage.getItem('departamentos_suscritos');
      const storedMunicipios = await AsyncStorage.getItem('municipios_suscritos');
      const storedAprobado = await AsyncStorage.getItem('avisarme_aprobado');
      const storedActualizaciones = await AsyncStorage.getItem('avisarme_actualizaciones');
      const storedCierres = await AsyncStorage.getItem('avisarme_cierres');

      if (storedRegiones) setRegiones(JSON.parse(storedRegiones));
      if (storedMunicipios) setMunicipiosSeleccionados(JSON.parse(storedMunicipios));
      if (storedAprobado) setAvisarmeAprobado(JSON.parse(storedAprobado));
      if (storedActualizaciones) setAvisarmeActualizaciones(JSON.parse(storedActualizaciones));
      if (storedCierres) setAvisarmeCierres(JSON.parse(storedCierres));

      console.log('✅ Preferencias cargadas');
    } catch (e) {
      console.error('Error cargando preferencias:', e);
    }
  };

  const loadMunicipios = async () => {
    try {
      setLoadingMuns(true);
      // Cargar municipios de todos los departamentos seleccionados
      const promises = regiones.map(depId => listMunicipios(depId));
      const results = await Promise.all(promises);
      // Aplanar el array de arrays
      const allMunicipios = results.flat();
      setMunicipios(allMunicipios);
    } catch (e: any) {
      console.error('Error cargando municipios:', e);
      Alert.alert('Error', e?.message || 'No se pudieron cargar municipios');
    } finally {
      setLoadingMuns(false);
    }
  };

  const toggleRegion = (code: string) => {
    setRegiones(prev => {
      const newRegiones = prev.includes(code) 
        ? prev.filter(r => r !== code) 
        : [...prev, code];
      
      // Si se deselecciona un departamento, quitar sus municipios
      if (!newRegiones.includes(code)) {
        setMunicipiosSeleccionados(prevMuns => 
          prevMuns.filter(m => {
            const mun = municipios.find(mu => mu.id === m);
            return mun?.departamentoId !== code;
          })
        );
      }
      
      return newRegiones;
    });
  };

  const toggleMunicipio = (code: string) => {
    setMunicipiosSeleccionados(prev =>
      prev.includes(code) ? prev.filter(m => m !== code) : [...prev, code]
    );
  };

  const onGuardar = async () => {
    if (!user?.usuario_uuid) {
      Alert.alert('Error', 'Usuario no autenticado.');
      return;
    }
    
    try {
      setSaving(true);

      // Guardar en el backend
      await api.post('/push/prefs', {
        userId: user.usuario_uuid,
        departamentosSuscritos: regiones,
        municipiosSuscritos: municipiosSeleccionados,
        avisarmeAprobado,
        avisarmeActualizaciones,
        avisarmeCierres,
      });

      // Guardar en AsyncStorage
      await AsyncStorage.setItem('departamentos_suscritos', JSON.stringify(regiones));
      await AsyncStorage.setItem('municipios_suscritos', JSON.stringify(municipiosSeleccionados));
      await AsyncStorage.setItem('avisarme_aprobado', JSON.stringify(avisarmeAprobado));
      await AsyncStorage.setItem('avisarme_actualizaciones', JSON.stringify(avisarmeActualizaciones));
      await AsyncStorage.setItem('avisarme_cierres', JSON.stringify(avisarmeCierres));

      Alert.alert('Listo', 'Preferencias guardadas exitosamente.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      console.error('Error guardando preferencias:', e);
      Alert.alert('Error', e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const onRegistrarToken = async () => {
    if (!user?.usuario_uuid) {
      Alert.alert('Error', 'Usuario no autenticado.');
      return;
    }
    
    try {
      setRegistering(true);
      
      const fcmToken = await AsyncStorage.getItem('fcm_token');
      
      if (!fcmToken) {
        Alert.alert('Error', 'No se encontró token FCM. Reinicia la app.');
        return;
      }

      await PushNotificationService.registerToken(
        user.usuario_uuid,
        fcmToken,
        municipiosSeleccionados,
        regiones
      );

      Alert.alert('Listo', 'Token registrado con el servidor.');
    } catch (e: any) {
      console.error('Error registrando token:', e);
      Alert.alert('Error', e?.message || 'No se pudo registrar el token.');
    } finally {
      setRegistering(false);
    }
  };

  const isReady = useMemo(() => !loadingUser && !loadingDeps, [loadingUser, loadingDeps]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Header con botón de regreso */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
        />
        <Text variant="titleLarge" style={{ flex: 1 }}>
          Preferencias de notificaciones
        </Text>
        <IconButton
          icon="bell"
          size={24}
          iconColor="#FF6B35"
        />
      </View>

      {!isReady ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12 }}>Cargando preferencias...</Text>
        </View>
      ) : (
        <>
          <Divider />

          {/* Regiones (Departamentos) */}
          <View style={{ marginVertical: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <IconButton icon="map-marker" size={20} style={{ margin: 0 }} />
              <Text variant="titleMedium">
                Departamentos suscritos
              </Text>
            </View>
            <Text variant="bodySmall" style={{ marginBottom: 12, color: '#666' }}>
              Recibirás notificaciones de incendios en estos departamentos
            </Text>

            {departamentos.length === 0 ? (
              <Text style={{ color: '#999' }}>No hay departamentos disponibles.</Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {departamentos.map((d) => {
                  const regionCode = d.id;
                  const selected = regiones.includes(regionCode);
                  return (
                    <Chip
                      key={regionCode}
                      selected={selected}
                      onPress={() => toggleRegion(regionCode)}
                      style={{ marginRight: 6, marginBottom: 6 }}
                      icon={selected ? 'check-circle' : 'circle-outline'}
                    >
                      {d.nombre}
                    </Chip>
                  );
                })}
              </View>
            )}
          </View>

          <Divider />

          {/* Municipios */}
          {regiones.length > 0 && (
            <>
              <View style={{ marginVertical: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <IconButton icon="map-marker-radius" size={20} style={{ margin: 0 }} />
                  <Text variant="titleMedium">
                    Municipios específicos
                  </Text>
                </View>
                <Text variant="bodySmall" style={{ marginBottom: 12, color: '#666' }}>
                  Opcionalmente, selecciona municipios específicos dentro de los departamentos
                </Text>

                {loadingMuns ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <ActivityIndicator />
                  </View>
                ) : municipios.length === 0 ? (
                  <Text style={{ color: '#999' }}>No hay municipios disponibles.</Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {municipios.map((m) => {
                      const selected = municipiosSeleccionados.includes(m.id);
                      return (
                        <Chip
                          key={m.id}
                          selected={selected}
                          onPress={() => toggleMunicipio(m.id)}
                          style={{ marginRight: 6, marginBottom: 6 }}
                          icon={selected ? 'check-circle' : 'circle-outline'}
                        >
                          {m.nombre}
                        </Chip>
                      );
                    })}
                  </View>
                )}
              </View>

              <Divider />
            </>
          )}

          {/* Preferencias de notificaciones */}
          <View style={{ marginVertical: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <IconButton icon="cog" size={20} style={{ margin: 0 }} />
              <Text variant="titleMedium">
                Tipos de notificaciones
              </Text>
            </View>

            {/* Aprobación */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                paddingVertical: 8,
              }}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <IconButton icon="check-circle" size={20} iconColor="#4CAF50" style={{ margin: 0, marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text>Mis incendios aprobados</Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>
                    Cuando aprueben un incendio que reportaste
                  </Text>
                </View>
              </View>
              <Switch value={avisarmeAprobado} onValueChange={setAvisarmeAprobado} />
            </View>

            {/* Actualizaciones */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                paddingVertical: 8,
              }}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <IconButton icon="bell-ring" size={20} iconColor="#FF9800" style={{ margin: 0, marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text>Actualizaciones de incendios</Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>
                    Cambios en incendios que sigues
                  </Text>
                </View>
              </View>
              <Switch value={avisarmeActualizaciones} onValueChange={setAvisarmeActualizaciones} />
            </View>

            {/* Cierres */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
              }}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <IconButton icon="flag-checkered" size={20} iconColor="#2196F3" style={{ margin: 0, marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text>Cierres de incendios</Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>
                    Cuando un incendio sea controlado o cerrado
                  </Text>
                </View>
              </View>
              <Switch value={avisarmeCierres} onValueChange={setAvisarmeCierres} />
            </View>
          </View>

          <Divider />

          {/* Acciones */}
          <Button
            mode="contained"
            onPress={onGuardar}
            loading={saving}
            disabled={saving || registering}
            icon="content-save"
            style={{ marginTop: 16 }}
          >
            Guardar preferencias
          </Button>

          <Button
            mode="outlined"
            onPress={onRegistrarToken}
            loading={registering}
            disabled={saving || registering}
            icon="cloud-upload"
            style={{ marginTop: 12 }}
          >
            Registrar token de notificaciones
          </Button>

          {user && (
            <View style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
              <Text variant="bodySmall" style={{ color: '#666', textAlign: 'center' }}>
                <IconButton icon="account" size={16} style={{ margin: 0 }} />
                Usuario: {user.email || user.usuario_uuid}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}