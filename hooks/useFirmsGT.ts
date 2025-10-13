// hooks/useFirmsGT.ts
import { useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/client';
import { WeightedLatLng, probabilityFromConfidence } from '@/app/utils/map';

const AS_FIRMS_ENABLED = 'firms_enabled';
const AS_FIRMS_DAYS = 'firms_days';
const AS_FIRMS_CACHE_PREFIX = 'firms_gt_cache_v3_d';
const FIRMS_CACHE_TTL = 30 * 60 * 1000; // 30 min

// BBOX Guatemala por defecto (w,s,e,n)
const GT_BBOX: [number, number, number, number] = [-92.27, 13.74, -88.18, 17.82];

// Nombres de productos esperados por tu backend (si aplica)
const DEFAULT_PRODUCTS = 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,MODIS_NRT';

type UseFirmsOptions = {
  bbox?: [number, number, number, number];
  initialEnabled?: boolean;
  initialDaysWindow?: 1 | 3 | 7;
  products?: string; // coma separada (si lo usas en el back)
};

type Feature = {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    source?: string;
    sourceId?: string;
    acqTime?: string;
    confidence?: number | null;
    frp?: number | null;
  };
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

type BackendListItem = {
  id: string;
  source?: string;
  sourceId?: string;
  acqTime?: string;
  confidence?: number | null;
  frp?: number | null;
  lon?: number | null;
  lat?: number | null;
};

type BackendResp =
  | { total: number; page: number; pageSize: number; items: FeatureCollection } // as=geojson
  | { total: number; page: number; pageSize: number; items: BackendListItem[] }; // lista plana

function toNum(n: any): number | null {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

// Normaliza cualquier respuesta a FeatureCollection
function normalizeToFC(data: BackendResp): FeatureCollection {
  // Caso 1: items ya es FeatureCollection
  const itemsAny: any = (data as any)?.items;
  if (itemsAny?.type === 'FeatureCollection' && Array.isArray(itemsAny?.features)) {
    return itemsAny as FeatureCollection;
  }

  // Caso 2: items es arreglo plano con lon/lat
  const arr: BackendListItem[] = Array.isArray(itemsAny) ? itemsAny : [];
  const feats: Feature[] = arr
    .map((r) => {
      const lon = toNum(r.lon);
      const lat = toNum(r.lat);
      if (lon == null || lat == null) return null;
      return {
        type: 'Feature' as const,
        id: r.id,
        geometry: { type: 'Point' as const, coordinates: [lon, lat] },
        properties: {
          source: r.source,
          sourceId: r.sourceId,
          acqTime: r.acqTime,
          confidence: r.confidence == null ? null : Number(r.confidence),
          frp: r.frp == null ? null : Number(r.frp),
        },
      };
    })
    .filter(Boolean) as Feature[];

  return { type: 'FeatureCollection', features: feats };
}

export function useFirmsGT(opts: UseFirmsOptions = {}) {
  const {
    bbox = GT_BBOX,
    initialEnabled = true,
    initialDaysWindow = 3,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    products = DEFAULT_PRODUCTS, // por si luego lo usas
  } = opts;

  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [daysWindow, setDaysWindow] = useState<1 | 3 | 7>(initialDaysWindow);
  const [loading, setLoading] = useState<boolean>(false);

  // Guardamos SIEMPRE como FeatureCollection dentro de "items"
  const [geo, setGeo] = useState<{ total?: number; page?: number; pageSize?: number; items: FeatureCollection } | null>(null);

  // cargar preferencias
  useEffect(() => {
    (async () => {
      try {
        const en = await AsyncStorage.getItem(AS_FIRMS_ENABLED);
        if (en === '0') setEnabled(false);
        else if (en === '1') setEnabled(true);
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
      if (!enabled) {
        setGeo(null);
        return;
      }
      setLoading(true);

      const bboxKey = bbox.join(',');
      const key = `${AS_FIRMS_CACHE_PREFIX}${daysWindow}_${bboxKey}`;

      // cache
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < FIRMS_CACHE_TTL && parsed?.data) {
            setGeo(parsed.data);
            console.log('[FIRMS] cache hit', key, 'features:', parsed?.data?.items?.features?.length ?? 0);
            return;
          }
        } catch {}
      }

      const q = new URLSearchParams();
      q.set('as', 'geojson'); // pedimos geojson, pero igual normalizamos por si el back devuelve lista
      q.set('days', String(daysWindow));
      q.set('order', 'recientes');
      q.set('bbox', bboxKey);
      q.set('limit', '5000');
      q.set('page', '1');
      // si algún día expones products en el back:
      // q.set('product', products);

      // Usa el endpoint con /puntos (tu back lo implementa ahí)
      const { data } = await api.get<BackendResp>(`/firms/puntos?${q.toString()}`);

      const fc = normalizeToFC(data);
      const wrapped = { total: (data as any)?.total, page: (data as any)?.page, pageSize: (data as any)?.pageSize, items: fc };

      // Logs de depuración útiles
      const feats = fc?.features ?? [];
      const bad = feats.filter((f) => {
        const [lon, lat] = f.geometry?.coordinates || [NaN, NaN];
        return !Number.isFinite(lon) || !Number.isFinite(lat) || !lat || !lon;
      }).length;

      console.log('[FIRMS] fetched features:', feats.length, 'invalid:', bad);
      if (feats.length) {
        const [lon0, lat0] = feats[0].geometry.coordinates;
        console.log('[FIRMS] sample:', { id: feats[0].id, lon0, lat0, conf: feats[0].properties?.confidence ?? null });
      }

      setGeo(wrapped as any);
      await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: wrapped }));
    } finally {
      setLoading(false);
    }
  }, [enabled, daysWindow, bbox /*, products*/]);

  // auto load
  useEffect(() => {
    void load();
  }, [load]);

  const heat: WeightedLatLng[] = useMemo(() => {
    const feats = geo?.items?.features ?? [];
    return feats.map((f: Feature) => {
      const [lon, lat] = f.geometry.coordinates;
      const conf = Number(f.properties?.confidence ?? 50);
      const weight = probabilityFromConfidence(conf);
      return { latitude: lat, longitude: lon, weight };
    });
  }, [geo]);

  return {
    enabled, setEnabled,
    daysWindow, setDaysWindow,
    loading,
    geo,   // { total, page, pageSize, items: FeatureCollection }
    heat,  // puntos listos para Heatmap
    reload: load,
  };
}
