import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRoles, getRol, createRol, updateRol, deleteRol, Rol, Paginated } from '../services/catalogos'

const qk = {
  all: ['roles'] as const,
  page: (page: number, pageSize: number) => [...qk.all, page, pageSize] as const,
  one: (id: string) => [...qk.all, 'detail', id] as const,
}

export function useRoles(page = 1, pageSize = 50) {
  return useQuery<Paginated<Rol>>({
    queryKey: qk.page(page, pageSize),
    queryFn: () => listRoles(page, pageSize),
    placeholderData: (prev) => prev, // ← reemplazo de keepPreviousData
  })
}

export function useRol(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: id ? qk.one(id) : qk.all,
    queryFn: () => getRol(id!),
  })
}

export function useCreateRol() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { nombre: string; descripcion?: string | null }) => createRol(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}

export function useUpdateRol() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Rol> }) => updateRol(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: qk.one(id) })
      qc.invalidateQueries({ queryKey: qk.all })
    },
  })
}

export function useDeleteRol() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRol(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  })
}
