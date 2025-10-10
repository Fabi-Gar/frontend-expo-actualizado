// hooks/useMapRegion.ts
import { useCallback, useRef, useState } from 'react';
import MapView, { Region } from 'react-native-maps';
import { getCurrentCoords } from '@/hooks/location';

export type Span = { latDelta: number; lngDelta: number };

export function useMapRegion(initial: Region) {
  const mapRef = useRef<MapView | null>(null);
  const mapReadyRef = useRef(false);
  const [currentRegion, setCurrentRegion] = useState<Region>(initial);
  const [span, setSpan] = useState<Span>({
    latDelta: initial.latitudeDelta,
    lngDelta: initial.longitudeDelta,
  });

  const onRegionChangeComplete = useCallback((r: Region) => {
    setCurrentRegion(r);
    setSpan({ latDelta: r.latitudeDelta, lngDelta: r.longitudeDelta });
  }, []);

  const setMapReady = useCallback(() => { mapReadyRef.current = true; }, []);

  const centerOnUser = useCallback(async () => {
    const coords = await getCurrentCoords();
    if (!coords) return;
    const next: Region = {
      latitude: coords.lat,
      longitude: coords.lng,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
    setCurrentRegion(next);
    setSpan({ latDelta: next.latitudeDelta, lngDelta: next.longitudeDelta });
    if (mapReadyRef.current && mapRef.current) {
      (mapRef.current as any).animateToRegion(next, 500);
    }
  }, []);

  const animateTo = useCallback((r: Region, duration = 500) => {
    setCurrentRegion(r);
    setSpan({ latDelta: r.latitudeDelta, lngDelta: r.longitudeDelta });
    if (mapRef.current) (mapRef.current as any).animateToRegion(r, duration);
  }, []);

  const fitToCoordinates = useCallback(
    (coords: { latitude: number; longitude: number }[], edgePadding = { top: 60, right: 60, bottom: 60, left: 60 }) => {
      if (!coords.length || !mapRef.current) return;
      mapRef.current.fitToCoordinates(coords, { edgePadding, animated: true });
    },
    []
  );

  return {
    mapRef,
    mapReadyRef,
    currentRegion,
    span,
    onRegionChangeComplete,
    setMapReady,
    centerOnUser,
    animateTo,
    fitToCoordinates,
  };
}
