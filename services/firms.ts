import { apiAuth } from '../client';

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

export async function getFirmsPuntos(params: {
  days?: number;
  bbox?: [number, number, number, number];
  near?: [number, number];
  km?: number;
  page?: number;
  limit?: number;
  order?: 'recientes' | 'confianza' | 'frp';
}) {
  const q = new URLSearchParams();
  if (params.days) q.set('days', String(params.days));
  if (params.bbox) q.set('bbox', params.bbox.join(','));
  if (params.near) q.set('near', params.near.join(','));
  if (params.km) q.set('km', String(params.km));
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.order) q.set('order', params.order);
  const { data } = await apiAuth.get<FirmsListResp>(`/api/firms/puntos?${q.toString()}`);
  return data;
}

export async function getFirmsGeoJSON(params: {
  days?: number;
  bbox?: [number, number, number, number];
  near?: [number, number];
  km?: number;
  order?: 'recientes' | 'confianza' | 'frp';
}) {
  const q = new URLSearchParams();
  if (params.days) q.set('days', String(params.days));
  if (params.bbox) q.set('bbox', params.bbox.join(','));
  if (params.near) q.set('near', params.near.join(','));
  if (params.km) q.set('km', String(params.km));
  if (params.order) q.set('order', params.order);
  q.set('as', 'geojson');
  const { data } = await apiAuth.get<GeoJSONResp>(`/api/firms/puntos?${q.toString()}`);
  return data;
}
