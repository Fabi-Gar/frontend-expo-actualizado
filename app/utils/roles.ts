// src/utils/roles.ts

/**
 * Devuelve true si el usuario es administrador.
 * Usa el flag is_admin del backend, y opcionalmente
 * verifica por nombre del rol por compatibilidad.
 */
export function isAdminUser(user: any): boolean {
  if (!user) return false;
  if (user.is_admin === true) return true;
  const rolName = String(user?.rol?.nombre || '').toUpperCase();
  return rolName === 'ADMIN' || rolName.includes('SUPER');
}

/**
 * Devuelve true si el usuario es miembro de una institución.
 * Usa el flag es_miembro_institucion del backend.
 */
export function isInstitucionUser(user: any): boolean {
  if (!user) return false;
  return user.es_miembro_institucion === true;
}
