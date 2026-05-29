/**
 * FASE 2 — Misiones del jugador (plan vivo).
 * Colección: `misiones_jugador`
 * Schema sugerido:
 *   { alumnoId, area, descripcion, estado, comentario, fecha, categoria, createdBy }
 */
import { list, create, update, remove, where, orderBy } from './firestoreClient';

const PATH = 'misiones_jugador';

export const misionesService = {
  /** Todas las misiones de un alumno (más recientes primero). */
  listarPorAlumno: (alumnoId) =>
    list(PATH, where('alumnoId', '==', alumnoId), orderBy('createdAt', 'desc')),

  /** Todas las misiones activas (estado != 'logrado' && != 'destacado'). */
  listarActivas: () =>
    list(PATH, where('estado', 'in', ['no_logrado', 'en_proceso']), orderBy('createdAt', 'desc')),

  /** Todas las misiones del sistema (más recientes primero) — para el panel global. */
  listarTodas: () =>
    list(PATH, orderBy('createdAt', 'desc')),

  crear:    (data) => create(PATH, data),
  actualizar: (id, data) => update(PATH, id, data),
  eliminar: (id) => remove(PATH, id),
};
