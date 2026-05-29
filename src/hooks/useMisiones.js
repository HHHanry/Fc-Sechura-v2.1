/**
 * FASE 2 — Hook de misiones del jugador.
 * Usa el patrón useQuery + invalidatePrefix igual que los otros hooks.
 */
import { useQuery, invalidatePrefix } from './useFirestoreCache';
import { misionesService } from '../services/misionesService';

const KEY = 'misiones_jugador';

export const useMisionesDeAlumno = (alumnoId) => {
  const q = useQuery(
    `${KEY}:${alumnoId ?? '__none__'}`,
    () => (alumnoId ? misionesService.listarPorAlumno(alumnoId) : Promise.resolve([])),
    [alumnoId],
  );
  return { misiones: q.data ?? [], loading: q.loading, error: q.error, refetch: q.refetch };
};

/** Todas las misiones del sistema — alimenta el panel global de /misiones. */
export const useMisionesAll = () => {
  const q = useQuery(`${KEY}:__all__`, () => misionesService.listarTodas(), []);
  return { misiones: q.data ?? [], loading: q.loading, error: q.error, refetch: q.refetch };
};

export const mutarMisiones = {
  crear: async (data) => {
    const r = await misionesService.crear(data);
    invalidatePrefix(KEY);
    return r;
  },
  actualizar: async (id, data) => {
    const r = await misionesService.actualizar(id, data);
    invalidatePrefix(KEY);
    return r;
  },
  eliminar: async (id) => {
    const r = await misionesService.eliminar(id);
    invalidatePrefix(KEY);
    return r;
  },
};
