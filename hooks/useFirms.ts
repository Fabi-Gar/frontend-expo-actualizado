import { useQuery } from '@tanstack/react-query';
import { getFirmsPuntos, getFirmsGeoJSON, FirmsListResp, GeoJSONResp } from '../services/firms';

export function useFirmsList(params: {
  days?: number;
  bbox?: [number, number, number, number];
  near?: [number, number];
  km?: number;
  page?: number;
  limit?: number;
  order?: 'recientes' | 'confianza' | 'frp';
}) {
  return useQuery<FirmsListResp, Error>({
    queryKey: ['firms', 'list', params],
    queryFn: () => getFirmsPuntos(params),
    staleTime: 60_000,
  });
}

export function useFirmsGeoJSON(params: {
  days?: number;
  bbox?: [number, number, number, number];
  near?: [number, number];
  km?: number;
  order?: 'recientes' | 'confianza' | 'frp';
}) {
  return useQuery<GeoJSONResp, Error>({
    queryKey: ['firms', 'geojson', params],
    queryFn: () => getFirmsGeoJSON(params),
    staleTime: 60_000,
  });
}
