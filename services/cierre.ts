// services/cierre.ts
import { api } from '@/client';

// Tipos para el sistema de cierre dinámico
export type TipoCampo =
  | 'texto'
  | 'numero'
  | 'fecha'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'textarea';

export type CierreCampo = {
  campo_uuid: string;
  seccion_uuid: string;
  nombre: string;
  descripcion?: string | null;
  tipo: TipoCampo;
  requerido: boolean;
  opciones?: any | null; // JSON con opciones para select/multiselect
  orden: number;
  respuesta?: CierreRespuesta | null;
};

export type CierreRespuesta = {
  respuesta_uuid: string;
  valor_texto?: string | null;
  valor_numero?: number | null;
  valor_fecha?: string | null;
  valor_datetime?: string | null;
  valor_boolean?: boolean | null;
  valor_json?: any | null;
  respondido_por_uuid: string;
  actualizado_en: string;
};

export type CierreSeccion = {
  seccion_uuid: string;
  plantilla_uuid: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  campos: CierreCampo[];
};

export type CierrePlantilla = {
  plantilla_uuid: string;
  nombre: string;
  descripcion?: string | null;
  version: number;
};

export type FormularioCierre = {
  incendio_uuid: string;
  plantilla: CierrePlantilla;
  extinguido: boolean;
  secciones: CierreSeccion[];
};

export type RespuestaInput = {
  campo_uuid: string;
  valor_texto?: string | null;
  valor_numero?: number | null;
  valor_fecha?: string | null;
  valor_datetime?: string | null;
  valor_boolean?: boolean | null;
  valor_json?: any | null;
};

/**
 * Obtener el formulario de cierre para un incendio
 */
export async function getFormularioCierre(incendioUuid: string): Promise<FormularioCierre> {
  const { data } = await api.get<FormularioCierre>(`/cierre/${incendioUuid}`);
  return data;
}

/**
 * Guardar múltiples respuestas del formulario
 */
export async function guardarRespuestasCierre(
  incendioUuid: string,
  respuestas: RespuestaInput[]
): Promise<{ ok: boolean; saved: number }> {
  const { data } = await api.post<{ ok: boolean; saved: number }>(
    `/cierre/${incendioUuid}/respuestas`,
    { respuestas }
  );
  return data;
}

/**
 * Actualizar una respuesta individual
 */
export async function actualizarRespuestaCierre(
  incendioUuid: string,
  campoUuid: string,
  respuesta: Partial<RespuestaInput>
): Promise<CierreRespuesta> {
  const { data } = await api.patch<CierreRespuesta>(
    `/cierre/${incendioUuid}/respuestas/${campoUuid}`,
    respuesta
  );
  return data;
}

/**
 * Eliminar una respuesta
 */
export async function eliminarRespuestaCierre(
  incendioUuid: string,
  campoUuid: string
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/cierre/${incendioUuid}/respuestas/${campoUuid}`
  );
  return data;
}

/**
 * Finalizar incendio (marcar como extinguido)
 */
export async function finalizarIncendio(incendioUuid: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(`/cierre/${incendioUuid}/finalizar`, {});
  return data;
}

/**
 * Helper para obtener el valor de una respuesta según el tipo de campo
 */
export function getValorRespuesta(respuesta: CierreRespuesta | null | undefined, tipo: TipoCampo): any {
  if (!respuesta) return null;

  switch (tipo) {
    case 'texto':
    case 'textarea':
      return respuesta.valor_texto;
    case 'numero':
      return respuesta.valor_numero;
    case 'fecha':
      return respuesta.valor_fecha;
    case 'datetime':
      return respuesta.valor_datetime;
    case 'boolean':
      return respuesta.valor_boolean;
    case 'select':
    case 'multiselect':
      return respuesta.valor_json;
    default:
      return null;
  }
}

/**
 * Helper para crear input de respuesta según el tipo de campo
 */
export function crearRespuestaInput(
  campoUuid: string,
  valor: any,
  tipo: TipoCampo
): RespuestaInput {
  const input: RespuestaInput = { campo_uuid: campoUuid };

  switch (tipo) {
    case 'texto':
    case 'textarea':
      input.valor_texto = valor;
      break;
    case 'numero':
      input.valor_numero = valor;
      break;
    case 'fecha':
      input.valor_fecha = valor;
      break;
    case 'datetime':
      input.valor_datetime = valor;
      break;
    case 'boolean':
      input.valor_boolean = valor;
      break;
    case 'select':
    case 'multiselect':
      input.valor_json = valor;
      break;
  }

  return input;
}
