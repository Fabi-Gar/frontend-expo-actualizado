import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getIncendiosMap,
  listIncendios,
  listIncendiosArray,
  getIncendio,
  createIncendio,
  updateIncendio,
  deleteIncendio,
  setEstadoIncendio,
  IncendiosMapResponse,
  Incendio,
  Paginated,
} from '../services/incendios';

/** =========================
 *  MAPA
 *  ========================= */
type MapParams = Parameters<typeof getIncendiosMap>[0];
export function useIncendiosMap(params: MapParams = {}) {
  return useQuery<IncendiosMapResponse>({
    queryKey: ['incendios', 'map', params],
    queryFn: () => getIncendiosMap(params),
    staleTime: 15_000,
    // v5: reemplazo de keepPreviousData
    placeholderData: (prev) => prev,
  });
}

/** =========================
 *  LISTA PAGINADA (/api/incendios)
 *  ========================= */
export function useIncendios(page = 1, pageSize = 50) {
  return useQuery<Paginated<Incendio>>({
    queryKey: ['incendios', 'list', { page, pageSize }],
    queryFn: () => listIncendios(page, pageSize),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

/** =========================
 *  LISTA SIMPLE (LEGACY) — array
 *  ========================= */
export function useIncendiosArray(page = 1, pageSize = 2000) {
  return useQuery<Incendio[]>({
    queryKey: ['incendios', 'list-array', { page, pageSize }],
    queryFn: () => listIncendiosArray(page, pageSize),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

/** =========================
 *  DETALLE
 *  ========================= */
export function useIncendio(id?: string) {
  return useQuery<Incendio>({
    queryKey: ['incendios', 'detail', id],
    queryFn: () => getIncendio(id!),
    enabled: !!id,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

/** =========================
 *  MUTACIONES CRUD
 *  ========================= */
export function useCreateIncendio() {
  const qc = useQueryClient();
  return useMutation<Incendio, unknown, Parameters<typeof createIncendio>[0]>({
    mutationKey: ['incendios', 'create'],
    mutationFn: createIncendio,
    onSuccess: (_data: Incendio) => {
      qc.invalidateQueries({ queryKey: ['incendios', 'list'] });
      qc.invalidateQueries({ queryKey: ['incendios', 'list-array'] });
      qc.invalidateQueries({ queryKey: ['incendios', 'map'] });
    },
  });
}

export function useUpdateIncendio() {
  const qc = useQueryClient();
  return useMutation<
    Incendio,
    unknown,
    { id: string; payload: Partial<Incendio> & { lat?: number; lng?: number; lon?: number } }
  >({
    mutationKey: ['incendios', 'update'],
    mutationFn: ({ id, payload }) => updateIncendio(id, payload),
    onSuccess: (data: Incendio) => {
      qc.invalidateQueries({ queryKey: ['incendios', 'detail', data.id] });
      qc.invalidateQueries({ queryKey: ['incendios', 'list'] });
      qc.invalidateQueries({ queryKey: ['incendios', 'list-array'] });
      qc.invalidateQueries({ queryKey: ['incendios', 'map'] });
    },
  });
}

export function useDeleteIncendio() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, unknown, string>({
    mutationKey: ['incendios', 'delete'],
    mutationFn: (id: string) => deleteIncendio(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incendios', 'list'] });
      qc.invalidateQueries({ queryKey: ['incendios', 'list-array'] });
      qc.invalidateQueries({ queryKey: ['incendios', 'map'] });
    },
  });
}

/** =========================
 *  CAMBIO DE ESTADO
 *  ========================= */
export function useSetEstadoIncendio() {
  const qc = useQueryClient();
  return useMutation<any, unknown, { incendioId: string; estadoId: number }>({
    mutationKey: ['incendios', 'set-estado'],
    mutationFn: ({ incendioId, estadoId }) => setEstadoIncendio(incendioId, estadoId),
    onSuccess: (_res: any, vars: { incendioId: string; estadoId: number }) => {
      qc.invalidateQueries({ queryKey: ['incendios', 'detail', vars.incendioId] });
      qc.invalidateQueries({ queryKey: ['incendios', 'list'] });
      qc.invalidateQueries({ queryKey: ['incendios', 'map'] });
    },
  });
}
