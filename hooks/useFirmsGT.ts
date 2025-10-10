// hooks/useFirmsGT.ts
import { useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiAuth } from '@/client';
import { WeightedLatLng, probabilityFromConfidence } from '@/app/utils/map';

const AS_FIRMS_ENABLED = 'firms_enabled';
const AS_FIRMS_DAYS = 'firms_days';
const AS_FIRMS_CACHE_PREFIX = 'firms_gt_cache_all_d';
const FIRMS_CACHE_TTL = 30 * 60 * 1000; // 30 min

// BBOX Guatemala por defecto
const GT_BBOX: [number, number, number, number] = [-92.27, 13.74, -88.18, 17.82];

// Nombres de productos esperados por tu backend
const DEFAULT_PRODUCTS = 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,MODIS_NRT';

type UseFirmsOptions = {
  bbox?: [number, number, number, number];
  initialEnabled?: boolean;
  initialDaysWindow?: 1 | 3 | 7;
  products?: string; // coma separada
};

export function useFirmsGT(opts: UseFirmsOptions = {}) {
  const {
    bbox = GT_BBOX,
    initialEnabled = true,
    initialDaysWindow = 3,
    products = DEFAULT_PRODUCTS,
  } = opts;

  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [daysWindow, setDaysWindow] = useState<1 | 3 | 7>(initialDaysWindow);
  const [loading, setLoading] = useState<boolean>(false);
  const [geo, setGeo] = useState<any | null>(null); // GeoJSON response (compat)

  // cargar preferencias
  useEffect(() => {
    (async () => {
      try {
        const en = await AsyncStorage.getItem(AS_FIRMS_ENABLED);
        if (en === '0') setEnabled(false);
        if (en === '1') setEnabled(true);
        const d = await AsyncStorage.getItem(AS_FIRMS_DAYS);
        if (d) {
          const n = Number(d);
          if (n === 1 || n === 3 || n === 7) setDaysWindow(n);
        }
      } catch {}
    })();
  }, []);

  // persistir preferencias
  useEffect(() => {
    AsyncStorage.setItem(AS_FIRMS_ENABLED, enabled ? '1' : '0').catch(() => {});
  }, [enabled]);
  useEffect(() => {
    AsyncStorage.setItem(AS_FIRMS_DAYS, String(daysWindow)).catch(() => {});
  }, [daysWindow]);

  const load = useCallback(async () => {
    try {
      if (!enabled) { setGeo(null); return; }
      setLoading(true);

      const key = `${AS_FIRMS_CACHE_PREFIX}${daysWindow}`;
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && (Date.now() - parsed.ts) < FIRMS_CACHE_TTL && parsed?.data) {
            setGeo(parsed.data);
            return;
          }
        } catch {}
      }

      const q = new URLSearchParams();
      q.set('as', 'geojson');
      q.set('days', String(daysWindow));
      q.set('order', 'recientes');
      q.set('bbox', bbox.join(','));
      q.set('product', products);
      q.set('limit', '5000');
      q.set('page', '1');

      const { data } = await apiAuth.get(`/api/firms/puntos?${q.toString()}`);

      setGeo(data);
      await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } finally {
      setLoading(false);
    }
  }, [enabled, daysWindow, bbox, products]);

  // auto load
  useEffect(() => { void load(); }, [load]);

  const heat: WeightedLatLng[] = useMemo(() => {
    const feats = geo?.items?.features ?? [];
    return feats.map((f: any) => {
      const [lon, lat] = f.geometry.coordinates as [number, number];
      const conf = Number(f.properties?.confidence ?? 50);
      const weight = probabilityFromConfidence(conf);
      return { latitude: lat, longitude: lon, weight };
    });
  }, [geo]);

  return {
    enabled, setEnabled,
    daysWindow, setDaysWindow,
    loading,
    geo,            // GeoJSON (para markers si quieres)
    heat,           // puntos ya listos para Heatmap
    reload: load,
  };
}
