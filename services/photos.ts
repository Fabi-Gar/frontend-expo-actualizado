// src/services/fotos.ts
import { api } from '../client';

export async function getFirstPhotoUrlByIncendio(incendio_uuid: string): Promise<string | null> {
  try {
    // 1) Traer 1 reporte del incendio
    const rep = await api.get('/reportes', { params: { incendio_uuid, pageSize: 1 } });
    const firstRep = (rep?.data?.items || [])[0];
    if (!firstRep?.reporte_uuid) return null;

    // 2) Traer 1 foto del reporte
    const fotos = await api.get(`/reportes/${firstRep.reporte_uuid}/fotos`);
    const url: string | null =
      fotos?.data?.items?.[0]?.url ?? null;

    return typeof url === 'string' ? url : null;
  } catch (e) {
    console.log('[getFirstPhotoUrlByIncendio] error', e);
    return null;
  }
}
