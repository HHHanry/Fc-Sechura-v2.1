import { ROLES_FINANCIEROS, ROLES_DEPORTIVOS, ROLES_SOLO_ADMIN } from '../config/businessRules';

/**
 * Permisos finos del módulo Alumnos (notación punto).
 *
 * La MATRIZ POR ROL es la fuente de verdad:
 *   - admin     → acceso total ('*').
 *   - entrenador→ ver alumnos, expediente y carnet. NO crear/editar/dar de baja.
 *   - tesorero  → solo lectura (alumnos + expediente para consultar pagos/deudas).
 *                 NUNCA registrar, editar ni dar de baja.
 *   - invitado  → lectura mínima.
 *
 * `user.permisos` (configurable en Gestión de Usuarios) puede SUMAR permisos
 * extra, nunca quitar los del rol. Como ese panel usa otro vocabulario
 * (ver_alumnos, editar_alumnos…), en la práctica las acciones de escritura de
 * alumnos quedan 100% gobernadas por la matriz → garantiza que un tesorero
 * jamás obtenga escritura.
 */
const PERMISOS_POR_ROL = {
  admin: ['*'],
  entrenador: [
    'alumnos.ver',
    'alumnos.ver_expediente',
    'alumnos.ver_carnet',
  ],
  tesorero: [
    'alumnos.ver',
    'alumnos.ver_expediente',
  ],
  invitado: [
    'alumnos.ver',
  ],
};

/** ¿El usuario tiene el permiso fino indicado? (additivo, nunca resta lo del rol) */
export const tienePermiso = (user, permiso) => {
  if (!user || !user.rol) return false;
  const base = PERMISOS_POR_ROL[user.rol] ?? [];
  if (base.includes('*')) return true;
  if (base.includes(permiso)) return true;
  // Grant fino explícito y exacto (misma notación punto). Solo suma, no resta.
  const finos = user.permisos ?? user.permisosFinos;
  if (Array.isArray(finos) && finos.includes(permiso)) return true;
  return false;
};

/* === Helpers de conveniencia · módulo Alumnos === */
export const puedeVerAlumnos      = (user) => tienePermiso(user, 'alumnos.ver');
export const puedeRegistrarAlumno = (user) => tienePermiso(user, 'alumnos.crear');
export const puedeEditarAlumno    = (user) => tienePermiso(user, 'alumnos.editar');
export const puedeDarBajaAlumno   = (user) => tienePermiso(user, 'alumnos.dar_baja');
export const puedeVerExpediente   = (user) => tienePermiso(user, 'alumnos.ver_expediente');
export const puedeVerCarnet       = (user) => tienePermiso(user, 'alumnos.ver_carnet');

/* === Helpers de área (navegación / dashboard) === */
export const puedeVerFinanzas  = (user) => !!user && ROLES_FINANCIEROS.includes(user.rol);
export const puedeVerDeportivo = (user) => !!user && ROLES_DEPORTIVOS.includes(user.rol);
export const esAdmin           = (user) => !!user && ROLES_SOLO_ADMIN.includes(user.rol);
