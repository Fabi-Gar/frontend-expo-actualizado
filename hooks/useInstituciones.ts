import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listInstituciones, getInstitucion,
  createInstitucion, updateInstitucion, deleteInstitucion, Institucion, Paginated
} from '../services/catalogos'

const qk = {
  all: ['instituciones'] as const,
  page: (page: number, pageSize: number, q?: string) => [...qk.all, page, pageSize, q ?? ''] as const,
  one: (id: string) => [...qk.all, 'detail', id] as const,
}

export function useInstituciones(params?: { page?: number; pageSize?: number; q?: string }) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 50
  const q = params?.q
  return useQuery<Paginated<Institucion>>({
    queryKey: qk.page(page, pageSize, q),
    queryFn: () => listInstituciones({ page, pageSize, q }),
    // v5: reemplaza keepPreviousData
    placeholderData: (prev) => prev,
  })
}

export function useInstitucion(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: id ? qk.one(id) : qk.all,
    queryFn: () => getInstitucion(id!),
  })
}

export function useCreateInstitucion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { nombre: string }) => createInstitucion(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}

export function useUpdateInstitucion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Institucion> }) =>
      updateInstitucion(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: qk.one(id) })
      qc.invalidateQueries({ queryKey: qk.all })
    },
  })
}

export function useDeleteInstitucion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstitucion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}
