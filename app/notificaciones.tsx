// app/notificaciones.tsx
import React, { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Button, Chip } from 'react-native-paper';
import { Stack } from 'expo-router';
import { api } from '@/client';

interface Notificacion {
  notificacion_uuid: string;
  titulo: string;
  mensaje: string;
  tipo?: string;
  leida_en: string | null;
  creado_en: string;
}

export default function NotificacionesScreen() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotificaciones();
  }, []);

  const loadNotificaciones = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await api.get('/notificaciones');
      setNotificaciones(response.data.data || []);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotificaciones(false);
  };

  const marcarComoLeida = async (id: string) => {
    try {
      await api.post(`/notificaciones/${id}/leer`);
      setNotificaciones(prev =>
        prev.map(n =>
          n.notificacion_uuid === id ? { ...n, leida_en: new Date().toISOString() } : n
        )
      );
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  };

  const marcarTodasComoLeidas = async () => {
    try {
      await api.post('/notificaciones/leer-todas');
      loadNotificaciones(false);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getIconoTipo = (tipo?: string) => {
    switch (tipo) {
      case 'incendio_aprobado': return '✅';
      case 'incendio_actualizado': return '📢';
      case 'incendio_cerrado': return '🏁';
      case 'incendio_nuevo_municipio': return '🔥';
      default: return '🔔';
    }
  };

  const noLeidas = notificaciones.filter(n => !n.leida_en).length;

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: '🔔 Notificaciones',
          headerShown: true,
        }} 
      />
      
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        ) : notificaciones.length === 0 ? (
          <View style={styles.centered}>
            <Text variant="headlineSmall" style={{ marginBottom: 8 }}>
              📭
            </Text>
            <Text>No tienes notificaciones</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              {noLeidas > 0 && (
                <Chip icon="bell" style={{ marginRight: 8 }}>
                  {noLeidas} sin leer
                </Chip>
              )}
              {notificaciones.length > 0 && (
                <Button 
                  mode="outlined" 
                  onPress={marcarTodasComoLeidas}
                  compact
                >
                  Marcar todas leídas
                </Button>
              )}
            </View>

            {notificaciones.map((notif) => (
              <Card
                key={notif.notificacion_uuid}
                style={[
                  styles.card,
                  notif.leida_en ? styles.cardLeida : styles.cardNoLeida,
                ]}
                onPress={() => !notif.leida_en && marcarComoLeida(notif.notificacion_uuid)}
              >
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <Text style={styles.icono}>
                      {getIconoTipo(notif.tipo)}
                    </Text>
                    <Text variant="titleMedium" style={styles.titulo}>
                      {notif.titulo}
                    </Text>
                  </View>
                  <Text variant="bodyMedium" style={styles.mensaje}>
                    {notif.mensaje}
                  </Text>
                  <Text variant="bodySmall" style={styles.fecha}>
                    {new Date(notif.creado_en).toLocaleString('es-GT')}
                  </Text>
                </Card.Content>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
  },
  cardNoLeida: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  cardLeida: {
    backgroundColor: '#fff',
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icono: {
    fontSize: 24,
    marginRight: 8,
  },
  titulo: {
    fontWeight: 'bold',
    flex: 1,
  },
  mensaje: {
    marginBottom: 8,
  },
  fecha: {
    color: '#666',
  },
});