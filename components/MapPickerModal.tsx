import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Text, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (coords: { lat: number; lng: number }) => void;
  initial?: { lat?: number; lng?: number };
};

const DEFAULT_REGION: Region = {
  latitude: 15.319,      // Huehuetenango centro aprox
  longitude: -91.472,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function MapPickerModal({ visible, onClose, onConfirm, initial }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // preparar región/marker al abrir
  useEffect(() => {
    if (!visible) return;
    let mounted = true;

    (async () => {
      try {
        // si viene una coordenada inicial, úsala
        if (initial?.lat && initial?.lng) {
          const r: Region = {
            latitude: initial.lat,
            longitude: initial.lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          };
          if (!mounted) return;
          setRegion(r);
          setMarker({ latitude: r.latitude, longitude: r.longitude });
          if (mapReady) mapRef.current?.animateToRegion(r, 0);
          return;
        }

        // sino, intenta ubicación actual
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!mounted) return;
          setRegion(DEFAULT_REGION);
          setMarker(null);
          if (mapReady) mapRef.current?.animateToRegion(DEFAULT_REGION, 0);
          return;
        }

        const last = await Location.getLastKnownPositionAsync({ maxAge: 15000 });
        const loc = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

        const r: Region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        if (!mounted) return;
        setRegion(r);
        setMarker({ latitude: r.latitude, longitude: r.longitude });
        if (mapReady) mapRef.current?.animateToRegion(r, 0);
      } catch {
        if (!mounted) return;
        setRegion(DEFAULT_REGION);
        setMarker(null);
        if (mapReady) mapRef.current?.animateToRegion(DEFAULT_REGION, 0);
      }
    })();

    return () => { mounted = false; };
  }, [visible, initial?.lat, initial?.lng, mapReady]);

  const centerOnUser = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setRegion(DEFAULT_REGION);
        setMarker(null);
        mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const r: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(r);
      setMarker({ latitude: r.latitude, longitude: r.longitude });
      mapRef.current?.animateToRegion(r, 500);
    } catch {
      setRegion(DEFAULT_REGION);
      setMarker(null);
      mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
    }
  }, []);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Selecciona la ubicación</Text>

          <View style={styles.mapWrapper}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={region}                               // región controlada
              onMapReady={() => {
                setMapReady(true);
                mapRef.current?.animateToRegion(region, 0); // asegura centrado al montar
              }}
              onRegionChangeComplete={(r) => setRegion(r)}
              onPress={(e) => setMarker(e.nativeEvent.coordinate)}
              showsUserLocation
              showsMyLocationButton={false}
              mapType="standard"
            >
              {marker && (
                <Marker
                  coordinate={marker}
                  draggable
                  onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
                />
              )}
            </MapView>
          </View>

          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolBtn} onPress={centerOnUser}>
              <Ionicons name="locate" size={18} color="#fff" />
              <Text style={styles.toolText}>Mi ubicación</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <Button mode="text" onPress={onClose} style={{ marginRight: 8 }} textColor="#455A64">
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                if (marker) onConfirm({ lat: marker.latitude, lng: marker.longitude });
                onClose();
              }}
            >
              Usar aquí
            </Button>
          </View>

          {marker && (
            <Text style={styles.coords}>
              {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, textAlign: 'center' },

  // Importante: el radius va en el wrapper, y overflow hidden
  mapWrapper: {
    height: 320,
    width: width - 32,     // ancho consistente dentro del modal
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#e6f0ff', // evita parpadeo oscuro antes de pintar tiles
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  toolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#009688',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toolText: { color: '#fff' },
  coords: { marginTop: 6, textAlign: 'center', color: '#455A64' },
});
