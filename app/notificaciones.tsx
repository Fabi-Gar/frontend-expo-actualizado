import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Text, Switch, Button, Divider, Chip, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { api } from '@/client';
import { getUser } from '@/session';
import { listDepartamentos, Departamento } from '@/services/catalogos';
import { registerForPushIfNeeded } from '@/services/register';

export default function PrefsScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);

  const [regiones, setRegiones] = useState<string[]>([]);
  const [avisarmeAprobado, setAvisarmeAprobado] = useState<boolean>(true);
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

  // (Opcional) Si tuvieras un endpoint GET para traer prefs existentes,
  // podrías cargarlas aquí y hacer setRegiones([...]) y setAvisarmeAprobado(true/false).

  const toggleRegion = (code: string) => {
    setRegiones(prev =>
      prev.includes(code) ? prev.filter(r => r !== code) : [...prev, code]
    );
  };

  const onGuardar = async () => {
    if (!user?.usuario_uuid) {
      Alert.alert('Error', 'Usuario no autenticado.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/push/prefs', {
        userId: user.usuario_uuid,
        regionesSuscritas: regiones,
        avisarmeAprobado,
      });
      Alert.alert('Listo', 'Preferencias guardadas.');
      // router.back(); // si quieres volver
    } catch (e: any) {
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
      await registerForPushIfNeeded({ userId: user.usuario_uuid });
      Alert.alert('Listo', 'Token registrado con el servidor.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo registrar el token.');
    } finally {
      setRegistering(false);
    }
  };

  const isReady = useMemo(() => !loadingUser && !loadingDeps, [loadingUser, loadingDeps]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleLarge" style={{ marginBottom: 12 }}>
        Preferencias de notificaciones
      </Text>

      {!isReady ? (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <Divider />

          {/* Regiones (Departamentos) */}
          <View style={{ marginVertical: 16 }}>
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>
              Regiones suscritas (por Departamento)
            </Text>

            {departamentos.length === 0 ? (
              <Text>No hay departamentos disponibles.</Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {departamentos.map((d) => {
                  // Usamos el UUID del departamento como regionCode
                  const regionCode = d.id;
                  const selected = regiones.includes(regionCode);
                  return (
                    <Chip
                      key={regionCode}
                      selected={selected}
                      onPress={() => toggleRegion(regionCode)}
                      style={{ marginRight: 6, marginBottom: 6 }}
                    >
                      {d.nombre}
                    </Chip>
                  );
                })}
              </View>
            )}
          </View>

          <Divider />

          {/* Aprobación propia */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginVertical: 16,
            }}
          >
            <Text>Recibir aviso cuando aprueben mis incendios</Text>
            <Switch value={avisarmeAprobado} onValueChange={setAvisarmeAprobado} />
          </View>

          <Divider />

          {/* Acciones */}
          <Button
            mode="contained"
            onPress={onGuardar}
            loading={saving}
            style={{ marginTop: 16 }}
          >
            Guardar preferencias
          </Button>

          <Button
            mode="outlined"
            onPress={onRegistrarToken}
            loading={registering}
            style={{ marginTop: 12 }}
          >
            Registrar token de notificaciones
          </Button>
        </>
      )}
    </ScrollView>
  );
}
