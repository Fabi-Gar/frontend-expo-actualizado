import { api } from '../client';

export type FirmsPoint = {
  id: string;
  source: string;
  sourceId: string;
  acqTime: string;
  confidence: number | null;
  frp: number | null;
  lon?: number;
  lat?: number;
};

export type FirmsListResp = {
  total: number;
  page: number;
  pageSize: number;
  items: FirmsPoint[];
  window: { start: string; end: string };
};

export type GeoJSONFeature = {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { source: string; sourceId: string; acqTime: string; confidence: number | null; frp: number | null };
};
export type GeoJSONResp = {
  total: number;
  page: number;
  pageSize: number;
  items: { type: 'FeatureCollection'; features: GeoJSONFeature[] };
};

/** ----------------- helpers ----------------- */
function buildQuery(params: Record<string, any>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) q.set(k, v.join(','));
    else q.set(k, String(v));
  }
  return q.toString();
}

async function getWithFallback<T = any>(pathA: string, pathB: string) {
  try {
    const { data } = await api.get<T>(pathA);
    return data;
  } catch (e: any) {
    const status = e?.response?.status;
    if (status !== 404) throw e; // si no es 404, propaga
    const { data } = await api.get<T>(pathB);
    return data;
  }
}

/** ----------------- list (tabla) ----------------- */
export async function getFirmsPuntos(params: {
  days?: number;
  bbox?: [number, number, number, number];
  near?: [number, number];
  km?: number;
  page?: number;
  limit?: number;
  order?: 'recientes' | 'confianza' | 'frp';
  product?: string; // opcional
}) {
  const qs = buildQuery({
    days: params.days,
    bbox: params.bbox?.join(','),
    near: params.near?.join(','),
    km: params.km,
    page: params.page,
    limit: params.limit,
    order: params.order,
    // OJO: si tu API no soporta product, déjalo undefined
    product: params.product,
  });

  // intenta /puntos y cae a /firms si 404
    const urlA = `/firms/puntos?${qs}`;
    const urlB = `/firms?${qs}`;

  const data = await getWithFallback<FirmsListResp>(urlA, urlB);
  return data;
}

/** ----------------- geojson ----------------- */
export async function getFirmsGeoJSON(params: {
  days?: number;
  bbox?: [number, number, number, number];
  near?: [number, number];
  km?: number;
  order?: 'recientes' | 'confianza' | 'frp';
  product?: string; // opcional
}) {
  const qs = buildQuery({
    as: 'geojson',
    days: params.days,
    bbox: params.bbox?.join(','),
    near: params.near?.join(','),
    km: params.km,
    order: params.order,
    product: params.product,
  });

  const urlA = `/api/firms/puntos?${qs}`;
  const urlB = `/api/firms?${qs}`;
  const data = await getWithFallback<GeoJSONResp>(urlA, urlB);

  const count = data?.items?.features?.length ?? 0;
  console.log('[FIRMS] GeoJSON features:', count);
  return data;
}
