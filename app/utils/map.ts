// app/utils/map.ts
import { Incendio } from '@/services/incendios';

export default function _MapUtilsRoute() {
  return null
}

export type WeightedLatLng = { latitude: number; longitude: number; weight?: number };

export function isFiniteNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function getLatLngFromIncendio(it: any) {
  // 1) GeoJSON en 'ubicacion' (lo recomendado tras el mapeo)
  const cu = it?.ubicacion?.coordinates;
  if (Array.isArray(cu) && cu.length >= 2) {
    const [lon, lat] = cu;
    if (isFinite(lat) && isFinite(lon)) return { latitude: lat, longitude: lon };
  }

  // 2) GeoJSON en 'centroide' (compatibilidad)
  const cc = it?.centroide?.coordinates;
  if (Array.isArray(cc) && cc.length >= 2) {
    const [lon, lat] = cc;
    if (isFinite(lat) && isFinite(lon)) return { latitude: lat, longitude: lon };
  }

  // 3) Campos planos (fallback)
  const lat = Number(it?.lat ?? it?.latitude);
  const lon = Number(it?.lng ?? it?.lon ?? it?.longitude);
  if (isFinite(lat) && isFinite(lon)) return { latitude: lat, longitude: lon };

  return null;
}



/**
 * Color del pin según estado:
 * 1) Si el backend envía color en estadoActual.estado.color → úsalo.
 * 2) Si no, usa nombre (case-insensitive):
 *    - ACTIVO      → rojo
 *    - CIERRE      → naranja
 *    - INFO_FALSA  → verde
 * 3) Fallback gris.
 */
export function getPinColor(item: Incendio) {
  const color = (item as any)?.estadoActual?.estado?.color as string | undefined | null;
  if (color && typeof color === 'string' && color.trim()) return color;

  const nombre = (item as any)?.estadoActual?.estado?.nombre as string | undefined;
  const n = (nombre || '').toUpperCase();

  if (n.includes('ACTIVO'))     return '#E53935'; // rojo
  if (n.includes('CIERRE'))     return '#FB8C00'; // naranja
  if (n.includes('FALSA'))      return '#2E7D32'; // verde
  return '#757575'; // gris por defecto
}

// FIRMS
export function probabilityFromConfidence(conf: number) {
  // conf 0-100 -> 0.2-1.0
  const w = Math.min(1, Math.max(0.2, conf / 100));
  return w;
}

export function probabilityLabel(p: number) {
  if (p >= 0.85) return 'Muy alta';
  if (p >= 0.7)  return 'Alta';
  if (p >= 0.5)  return 'Media';
  if (p >= 0.35) return 'Baja';
  return 'Muy baja';
}
