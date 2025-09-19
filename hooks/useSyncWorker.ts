import { useEffect } from 'react';
import { useConnectivity } from './useConnectivity';
import { peekAll, dequeueById, SYNC_EVENTS } from './syncQueue';
import { createIncendioAvanzado, setEstadoIncendio } from '@/services/incendios';
import { uploadIncendioPhotos } from '@/services/uploads';
import { showToast } from './uiStore';
import { emit, EVENTS } from './events';

export function useSyncWorker() {
  const online = useConnectivity();

  useEffect(() => {
    if (!online) return;
    let cancelled = false;

    (async () => {
      const queue = await peekAll();
      for (const job of queue) {
        if (cancelled) return;
        try {
          if (job.type === 'create_incendio') {
            const { values, photos } = job.payload;
            // 1) crear
            const created = await createIncendioAvanzado({
              titulo: values.titulo,
              descripcion: values.descripcion,
              regionId: Number(values.regionId),
              lat: parseFloat(values.lat),
              lng: parseFloat(values.lng),
              visiblePublico: values.visiblePublico === true,
              etiquetasIds: values.etiquetasIds || [],
              fechaInicio: new Date().toISOString(),
              reporteInicial: values.reporteInicial,
            });

            // 2) estado
            try { await setEstadoIncendio(created.id, Number(values.estadoId)); } catch {}

            // 3) fotos
            if (photos?.length) {
              try { await uploadIncendioPhotos(created.id, photos); } catch {}
            }

            await dequeueById(job.id);
            emit(EVENTS.INCENDIO_CREATED, { id: created.id });
          }
        } catch (e) {
          showToast({ type: 'error', message: 'Error al sincronizar datos pendientes' });
          return;
        }
      }
      showToast({ type: 'success', message: 'Datos pendientes sincronizados' });
    })();

    return () => { cancelled = true; };
  }, [online]);
}
