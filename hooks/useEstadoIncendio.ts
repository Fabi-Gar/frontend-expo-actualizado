import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEstadosIncendio, createEstadoIncendio, updateEstadoIncendio, deleteEstadoIncendio, EstadoIncendio
} from '../services/catalogos'

const qk = { all: ['estados-incendio'] as const, one: (id: string) => ['estado-incendio', id] as const }

export function useEstadosIncendio() {
  return useQuery({ queryKey: qk.all, queryFn: () => getEstadosIncendio() })
}

export function useCreateEstadoIncendio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { codigo: string; nombre: string; color?: string | null; orden?: number }) =>
      createEstadoIncendio(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}

export function useUpdateEstadoIncendio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<EstadoIncendio> }) =>
      updateEstadoIncendio(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: qk.one(id) })
      qc.invalidateQueries({ queryKey: qk.all })
    },
  })
}

export function useDeleteEstadoIncendio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEstadoIncendio(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}
