import { ROLES_FINANCIEROS, ROLES_DEPORTIVOS, ROLES_SOLO_ADMIN } from '../config/businessRules';

/**
 * Verifica si un usuario tiene un permiso fino específico.
 * Aditivo: si el usuario no tiene el campo `permisosFinos`, se basa solo en el rol.
 * Nunca bloquea más de lo que allowedRoles ya permite.
 */
export const tienePermiso = (user, permiso) => {
  if (!user) return false;
  if (user.rol === 'admin') return true;
  if (Array.isArray(user.permisosFinos)) return user.permisosFinos.includes(permiso);
  return permisoDefaultPorRol(user.rol, permiso);
};

const permisoDefaultPorRol = (rol, permiso) => {
  const defaults = {
    entrenador: [
      'ver_alumnos', 'editar_alumnos', 'ver_expediente', 'editar_expediente',
      'ver_asistencia', 'registrar_asistencia',
      'ver_convocatorias', 'crear_convocatorias',
    ],
    tesorero: [
      'ver_alumnos', 'ver_expediente',
      'ver_pagos', 'registrar_pagos',
      'ver_asistencia',
      'ver_reportes',
    ],
    invitado: ['ver_alumnos'],
  };
  return (defaults[rol] || []).includes(permiso);
};

export const puedeVerFinanzas  = (user) => user && ROLES_FINANCIEROS.includes(user.rol);
export const puedeVerDeportivo = (user) => user && ROLES_DEPORTIVOS.includes(user.rol);
export const esAdmin           = (user) => user && ROLES_SOLO_ADMIN.includes(user.rol);
