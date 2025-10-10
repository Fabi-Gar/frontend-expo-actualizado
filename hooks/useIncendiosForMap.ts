// hooks/useIncendiosForMap.ts
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { listIncendiosArray, Incendio } from '@/services/incendios';
import { WeightedLatLng, getLatLngFromIncendio } from '@/app/utils/map';

type Options = {
  /** Mostrar sólo visiblesPublico===true (por defecto true) */
  onlyPublic?: boolean;
  /** Filtrar por etiquetas (ids en string/number) */
  // eslint-disable-next-line @typescript-eslint/array-type
  etiquetaIds?: Array<string | number>;
  /** Tamaño de página para carga bulk (default 2000) */
  pageSize?: number;
  /** Autofit una sola vez cuando haya elementos (el contenedor decide) */
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
    () => new Set((etiquetaIds || []).map((x) => String(x))),
    [etiquetaIds]
  );

  const [items, setItems] = useState<Incendio[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedOnceRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const arr = await listIncendiosArray(1, pageSize);
      let next = arr || [];
      if (onlyPublic) {
        next = next.filter((x) => x.visiblePublico === true);
      }
      if (etiquetaSet.size) {
        next = next.filter((it) =>
          (it.etiquetas || []).some((e) => etiquetaSet.has(String(e.id)))
        );
      }
      setItems(next);
      loadedOnceRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [onlyPublic, etiquetaSet, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

const heatData: WeightedLatLng[] = useMemo(() => {
  return (items || [])
    .map((it) => {
      const pos = getLatLngFromIncendio(it);
      if (!pos) return null;
      const nombre = it?.estadoActual?.estado?.nombre;
      const weight = weightByNombre(nombre);
      return { latitude: pos.latitude, longitude: pos.longitude, weight };
    })
    .filter(Boolean) as WeightedLatLng[];
}, [items]);

  return {
    items,              // incendios (filtrados)
    heatData,           // puntos para Heatmap
    loading,
    reload,
    loadedOnce: loadedOnceRef.current,
  };
}
