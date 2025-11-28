import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { listIncendiosArray, Incendio, getIncendiosMap } from '@/services/incendios';
import { WeightedLatLng, getLatLngFromIncendio } from '@/app/utils/map';

type Options = {
  /** Mostrar sólo visiblesPublico===true (por defecto true) */
  onlyPublic?: boolean;
  /** Filtrar por etiquetas (ids en string/number) */
  etiquetaIds?: (string | number)[];
  /** Tamaño de página para carga (default 2000) */
  pageSize?: number;
};

const weightByNombre = (nombre?: string) => {
  if (!nombre) return 0.5;
  const n = nombre.toUpperCase();
  if (n.includes('ACTIVO')) return 1.0;
  if (n.includes('CIERRE')) return 0.7;
  if (n.includes('FALSA'))  return 0.3;
  return 0.5;
};

export function useIncendiosForMap(opts: Options = {}) {
  const {
    onlyPublic = true,
    etiquetaIds = [],
    pageSize = 2000,
  } = opts;

  const etiquetaSet = useMemo(
    () => new Set((etiquetaIds || []).map(String)),
    [etiquetaIds]
  );

  const [items, setItems] = useState<Incendio[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedOnceRef = useRef(false);
  const isLoadingRef = useRef(false);

  const fetchMapFeed = useCallback(async (limit: number) => {
    try {
      const resp = await getIncendiosMap({
        include: 'thumbnail',
        order: 'actividad',
        limit,
        page: 1,
      });
      return (resp?.items ?? []) as unknown as Incendio[];
    } catch (e) {
      console.warn('[useIncendiosForMap] getIncendiosMap falló, uso listIncendiosArray()', e);
      const arr = await listIncendiosArray(1, limit);
      return (arr || []) as Incendio[];
    }
  }, []);

  const reload = useCallback(async () => {
    if (isLoadingRef.current) {
      console.log('[useIncendiosForMap] Ya hay una carga en progreso, ignorando');
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    
    try {
      let next: Incendio[] = [];

      if (etiquetaSet.size > 0) {
        const arr = await listIncendiosArray(1, pageSize);
        next = (arr || []) as Incendio[];
      } else {
        next = await fetchMapFeed(pageSize);
      }

      if (onlyPublic) next = next.filter((x: any) => x.visiblePublico === true);

      if (etiquetaSet.size) {
        next = next.filter((it: any) =>
          (it.etiquetas || []).some((e: any) => etiquetaSet.has(String(e.id)))
        );
      }

      setItems(next);
      loadedOnceRef.current = true;

    } catch (error) {
      console.error('[useIncendiosForMap] Error cargando incendios:', error);
      
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [onlyPublic, etiquetaSet, pageSize, fetchMapFeed]);

  useEffect(() => {
    if (!loadedOnceRef.current) {
      void reload();
    }
  }, [reload]);

  const heatData: WeightedLatLng[] = useMemo(() => {
    return (items || [])
      .map((it) => {
        const pos = getLatLngFromIncendio(it as any);
        if (!pos) return null;
        const nombre = (it as any)?.estadoActual?.estado?.nombre;
        const weight = weightByNombre(nombre);
        return { latitude: pos.latitude, longitude: pos.longitude, weight };
      })
      .filter(Boolean) as WeightedLatLng[];
  }, [items]);

  return {
    items,              
    heatData,
    loading,
    reload,
    loadedOnce: loadedOnceRef.current,
  };
}