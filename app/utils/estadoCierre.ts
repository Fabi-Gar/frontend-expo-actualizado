// app/utils/estadoCierre.ts
// Utilidades para estados dinámicos de cierre basados en porcentaje de completitud

export type EstadoCierre = 'Reportado' | 'En atención' | 'Controlando' | 'Controlado' | 'Extinguido';

/**
 * Obtiene el color asociado a un estado de cierre
 */
export function cierreColor(estado: string): string {
  switch (estado) {
    case 'Reportado':
      return '#E65100'; // Naranja oscuro - recién reportado, poca información
    case 'En atención':
      return '#F57C00'; // Naranja - trabajando en el formulario
    case 'Controlando':
      return '#FBC02D'; // Amarillo - casi completo, controlando situación
    case 'Controlado':
      return '#689F38'; // Verde lima - formulario completo, bajo control
    case 'Extinguido':
      return '#2E7D32'; // Verde oscuro - cerrado oficialmente
    default:
      return '#9E9E9E'; // Gris - desconocido
  }
}

/**
 * Obtiene el ícono asociado a un estado de cierre
 */
export function cierreIcon(estado: string): string {
  switch (estado) {
    case 'Reportado':
      return '🔴'; // Reportado
    case 'En atención':
      return '🟠'; // En atención
    case 'Controlando':
      return '🟡'; // Controlando
    case 'Controlado':
      return '🟢'; // Controlado
    case 'Extinguido':
      return '✅'; // Extinguido
    default:
      return '⚪';
  }
}

/**
 * Obtiene el estilo para el badge de estado
 */
export function cierreBadgeStyle(estado: string) {
  const color = cierreColor(estado);
  return {
    backgroundColor: `${color}20`, // 20 = 12.5% opacity en hex
    color: color,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold' as const,
  };
}

/**
 * Obtiene el texto descriptivo del estado
 */
export function cierreDescripcion(estado: string, porcentaje?: number): string {
  const pct = porcentaje !== undefined ? ` (${porcentaje}%)` : '';
  switch (estado) {
    case 'Reportado':
      return `Reportado${pct}`;
    case 'En atención':
      return `En atención${pct}`;
    case 'Controlando':
      return `Controlando${pct}`;
    case 'Controlado':
      return `Controlado${pct}`;
    case 'Extinguido':
      return 'Extinguido';
    default:
      return estado;
  }
}
