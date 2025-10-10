import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTiposIncendio, createTipoIncendio, updateTipoIncendio, deleteTipoIncendio,
  getTiposPropiedad, createTipoPropiedad, updateTipoPropiedad, deleteTipoPropiedad,
  getCausas, createCausa, updateCausa, deleteCausa,
  getIniciadoJuntoA, createIniciadoJuntoA, updateIniciadoJuntoA, deleteIniciadoJuntoA,
  getMediosAereos, createMedioAereo, updateMedioAereo, deleteMedioAereo,
  getMediosTerrestres, createMedioTerrestre, updateMedioTerrestre, deleteMedioTerrestre,
  getMediosAcuaticos, createMedioAcuatico, updateMedioAcuatico, deleteMedioAcuatico,
  getAbastos, createAbasto, updateAbasto, deleteAbasto,
  getTecnicasExtincion, createTecnicaExtincion, updateTecnicaExtincion, deleteTecnicaExtincion,
  Opcion, UUID
} from '../services/catalogos'

type HookPack = {
  useList: () => ReturnType<typeof useQuery<Opcion[], unknown>>
  useCreate: () => ReturnType<typeof useMutation<any, unknown, { nombre: string }>>
  useUpdate: () => ReturnType<typeof useMutation<any, unknown, { id: UUID; patch: Partial<Opcion> }>>
  useDelete: () => ReturnType<typeof useMutation<any, unknown, UUID>>
}

function factory(label: string, getFn: () => Promise<Opcion[]>, createFn: any, updateFn: any, deleteFn: any): HookPack {
  const qk = { all: [label] as const, one: (id: string) => [label, id] as const }
  const useList = () => useQuery({ queryKey: qk.all, queryFn: getFn })
  const useCreate = () => {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (p: { nombre: string }) => createFn(p),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
    })
  }
  const useUpdate = () => {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: ({ id, patch }: { id: UUID; patch: Partial<Opcion> }) => updateFn(id, patch),
      onSuccess: (_, { id }) => {
        qc.invalidateQueries({ queryKey: qk.one(id) })
        qc.invalidateQueries({ queryKey: qk.all })
      },
    })
  }
  const useDelete = () => {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (id: UUID) => deleteFn(id),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
    })
  }
  return { useList, useCreate, useUpdate, useDelete }
}

export const tiposIncendio = factory('tipos-incendio', getTiposIncendio, createTipoIncendio, updateTipoIncendio, deleteTipoIncendio)
export const tiposPropiedad = factory('tipos-propiedad', getTiposPropiedad, createTipoPropiedad, updateTipoPropiedad, deleteTipoPropiedad)
export const causas = factory('causas', getCausas, createCausa, updateCausa, deleteCausa)
export const iniciadoJuntoA = factory('iniciado-junto-a', getIniciadoJuntoA, createIniciadoJuntoA, updateIniciadoJuntoA, deleteIniciadoJuntoA)
export const mediosAereos = factory('medios-aereos', getMediosAereos, createMedioAereo, updateMedioAereo, deleteMedioAereo)
export const mediosTerrestres = factory('medios-terrestres', getMediosTerrestres, createMedioTerrestre, updateMedioTerrestre, deleteMedioTerrestre)
export const mediosAcuaticos = factory('medios-acuaticos', getMediosAcuaticos, createMedioAcuatico, updateMedioAcuatico, deleteMedioAcuatico)
export const abastos = factory('abastos', getAbastos, createAbasto, updateAbasto, deleteAbasto)
export const tecnicasExtincion = factory('tecnicas-extincion', getTecnicasExtincion, createTecnicaExtincion, updateTecnicaExtincion, deleteTecnicaExtincion)
