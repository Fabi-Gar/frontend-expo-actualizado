import { api } from '../client';

export async function getFirstPhotoUrl(incendioId: string): Promise<string | null> {
  try {
    const r = await api.get(`/incendios/${incendioId}/fotos`, { params: { limit: 1 } });
    const list = r.data || [];
    const url = list?.[0]?.url || list?.[0]?.signedUrl || list?.[0]?.path || null;
    return typeof url === 'string' ? url : null;
  } catch {
    return null;
  }
}
