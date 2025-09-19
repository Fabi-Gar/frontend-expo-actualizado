import { api } from '../client';

export async function uploadIncendioPhotos(incendioId: string, files: { uri: string; name?: string; mime?: string }[]) {
  const form = new FormData();
  files.forEach((f, idx) => {
    form.append('files', {
      uri: f.uri,
      name: f.name ?? `photo_${idx}.jpg`,
      type: f.mime ?? 'image/jpeg',
    } as any);
  });
  const r = await api.post(`/incendios/${incendioId}/fotos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return r.data;
}
