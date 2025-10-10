// utils/map.ts
import { Incendio } from '@/services/incendios';

export type WeightedLatLng = { latitude: number; longitude: number; weight?: number };

export function isFiniteNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function getLatLngFromIncendio(item: Incendio) {
  if (isFiniteNumber((item as any).lat) && isFiniteNumber((item as any).lng)) {
    return { latitude: (item as any).lat, longitude: (item as any).lng };
  }
  if (isFiniteNumber((item as any).lat) && isFiniteNumber((item as any).lon)) {
    return { latitude: (item as any).lat, longitude: (item as any).lon };
  }
  const coords = item.ubicacion?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (isFiniteNumber(lat) && isFiniteNumber(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

export function getPinColor(item: Incendio) {
  const id = Number(item?.estadoActual?.estado?.id);
  if (id === 1) return '#E53935'; // Activo
  if (id === 2) return '#FB8C00'; // Reportado / Controlado
  if (id === 3) return '#2E7D32'; // Apagado / Extinguido
  return '#757575';
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
