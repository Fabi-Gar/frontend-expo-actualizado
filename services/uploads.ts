// services/uploads.ts
import { api } from '@/client';

type RNFile = { uri: string; name: string; type: string };

export async function uploadReporteFoto(
  reporte_uuid: string,
  file: RNFile,
  credito?: string,
  onProgress?: (pct: number) => void
) {
  const fd = new FormData();
  fd.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
  if (credito) fd.append('credito', credito);

  const { data } = await api.post(`/reportes/${reporte_uuid}/fotos`, fd, {
    transformRequest: (x) => x,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
    onUploadProgress: (pe) => {
      if (pe.total && onProgress) onProgress(pe.loaded / pe.total);
    },
  });

  if (onProgress) onProgress(1);
  return data;
}
