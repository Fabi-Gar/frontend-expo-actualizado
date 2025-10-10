// hooks/useDepartamentos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDepartamentos, createDepartamento, updateDepartamento, deleteDepartamento, Departamento
} from '../services/catalogos'

const qk = {
  all: ['departamentos'] as const,
}

export function useDepartamentos() {
  return useQuery({
    queryKey: qk.all,
    queryFn: () => listDepartamentos(),
  })
}

export function useCreateDepartamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { nombre: string; codigo?: string | null }) => createDepartamento(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}

export function useUpdateDepartamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Departamento> }) =>
      updateDepartamento(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}

export function useDeleteDepartamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDepartamento(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}
