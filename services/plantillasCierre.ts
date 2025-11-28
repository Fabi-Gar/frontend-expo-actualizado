import { api } from '../client';

// Tipos para Plantillas de Cierre
export type CierrePlantilla = {
  plantilla_uuid: string;
  nombre: string;
  descripcion?: string | null;
  activa: boolean;
  version: number;
  creado_en?: string;
  actualizado_en?: string;
  eliminado_en?: string | null;
};

export type CierreSeccion = {
  seccion_uuid: string;
  plantilla_uuid: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  creado_en?: string;
  actualizado_en?: string;
};

export type CierreCampo = {
  campo_uuid: string;
  seccion_uuid: string;
  campo_padre_uuid?: string | null;
  nombre: string;
  descripcion?: string | null;
  placeholder?: string | null;
  tipo: string; // text, textarea, number, date, select, multiselect, checkbox, etc.
  orden: number;
  requerido: boolean;
  opciones?: any | null;
  validaciones?: any | null;
  dependencias?: any | null;
  unidad?: string | null;
  ayuda?: string | null;
  creado_en?: string;
  actualizado_en?: string;
};

// ===== PLANTILLAS =====

export async function listPlantillas(): Promise<CierrePlantilla[]> {
  const { data } = await api.get('/cierre-admin/plantillas');
  return data?.plantillas || [];
}

export async function getPlantilla(plantilla_uuid: string): Promise<any> {
  const { data } = await api.get(`/cierre-admin/plantillas/${plantilla_uuid}`);
  return data;
}

export async function createPlantilla(payload: {
  nombre: string;
  descripcion?: string;
}): Promise<CierrePlantilla> {
  const { data } = await api.post('/cierre-admin/plantillas', payload);
  return data;
}

export async function updatePlantilla(
  plantilla_uuid: string,
  payload: { nombre?: string; descripcion?: string }
): Promise<CierrePlantilla> {
  const { data } = await api.patch(`/cierre-admin/plantillas/${plantilla_uuid}`, payload);
  return data;
}

export async function deletePlantilla(plantilla_uuid: string): Promise<void> {
  await api.delete(`/cierre-admin/plantillas/${plantilla_uuid}`);
}

export async function activarPlantilla(plantilla_uuid: string): Promise<void> {
  await api.post(`/cierre-admin/plantillas/${plantilla_uuid}/activar`);
}

// ===== SECCIONES =====

export async function createSeccion(
  plantilla_uuid: string,
  payload: { nombre: string; descripcion?: string; orden: number }
): Promise<CierreSeccion> {
  const { data } = await api.post(`/cierre-admin/plantillas/${plantilla_uuid}/secciones`, payload);
  return data;
}

export async function updateSeccion(
  seccion_uuid: string,
  payload: { nombre?: string; descripcion?: string; orden?: number }
): Promise<CierreSeccion> {
  const { data } = await api.patch(`/cierre-admin/secciones/${seccion_uuid}`, payload);
  return data;
}

export async function deleteSeccion(seccion_uuid: string): Promise<void> {
  await api.delete(`/cierre-admin/secciones/${seccion_uuid}`);
}

// ===== CAMPOS =====

export async function createCampo(
  seccion_uuid: string,
  payload: any
): Promise<CierreCampo> {
  const { data } = await api.post(`/cierre-admin/secciones/${seccion_uuid}/campos`, payload);
  return data;
}

export async function updateCampo(
  campo_uuid: string,
  payload: any
): Promise<CierreCampo> {
  const { data } = await api.patch(`/cierre-admin/campos/${campo_uuid}`, payload);
  return data;
}

export async function deleteCampo(campo_uuid: string): Promise<void> {
  await api.delete(`/cierre-admin/campos/${campo_uuid}`);
}
