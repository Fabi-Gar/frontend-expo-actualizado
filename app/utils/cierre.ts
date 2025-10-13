// src/utils/cierre.ts
export type EstadoCierre = 'Pendiente' | 'En atención' | 'Controlado' | 'Extinguido';

export function cierreBadgeStyle(estado?: string) {
  const e = String(estado || '').toLowerCase();
  if (e === 'extinguido') return { backgroundColor: '#E8F5E9', color: '#2E7D32' };
  if (e === 'controlado') return { backgroundColor: '#E3F2FD', color: '#1565C0' };
  if (e === 'en atención') return { backgroundColor: '#FFF3E0', color: '#E65100' };
  return { backgroundColor: '#F5F5F5', color: '#616161' };
}

export function inferirEstadoCierre(sc?: {
  llegada_medios_terrestres_at?: string | null;
  llegada_medios_aereos_at?: string | null;
  controlado_at?: string | null;
  extinguido_at?: string | null;
}): EstadoCierre {
  if (!sc) return 'Pendiente';
  if (sc.extinguido_at) return 'Extinguido';
  if (sc.controlado_at) return 'Controlado';
  if (sc.llegada_medios_terrestres_at || sc.llegada_medios_aereos_at) return 'En atención';
  return 'Pendiente';
}


export function cierreColor(estado?: string) {
  const e = String(estado || '').toLowerCase();
  if (e === 'extinguido') return '#2E7D32';     // verde
  if (e === 'controlado') return '#1565C0';     // azul
  if (e === 'en atención') return '#E65100';    // naranja
  return '#616161';                              // gris (pendiente/desconocido)
}
