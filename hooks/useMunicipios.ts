// hooks/useMunicipios.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listMunicipios, createMunicipio, updateMunicipio, deleteMunicipio, Municipio
} from '../services/catalogos'

const qk = {
  list: (departamentoId: string) => ['municipios', departamentoId] as const,
  one: (id: string) => ['municipio', id] as const,
}

export function useMunicipios(departamentoId?: string) {
  return useQuery({
    enabled: !!departamentoId,
    queryKey: departamentoId ? qk.list(departamentoId) : ['municipios'],
    queryFn: () => listMunicipios(departamentoId!),
  })
}

export function useCreateMunicipio(departamentoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { nombre: string }) => createMunicipio(departamentoId, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.list(departamentoId) }),
  })
}

export function useUpdateMunicipio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Municipio> }) =>
      updateMunicipio(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: qk.one(id) })
      qc.invalidateQueries({ queryKey: ['municipios'] }) // por si la lista no está segmentada
    },
  })
}

export function useDeleteMunicipio(departamentoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMunicipio(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.list(departamentoId) }),
  })
}
