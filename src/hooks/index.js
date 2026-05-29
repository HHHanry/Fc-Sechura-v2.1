export { useAlumnos, useAlumno, mutarAlumnos }                 from './useAlumnos';
export { useUltimosPagos, usePagos, usePagosDelMes, usePagosDeAlumno, mutarPagos } from './usePagos';
export { useAsistenciaHoy, useAsistenciaPorFecha, useAsistenciaDeAlumno, mutarAsistencia } from './useAsistencia';
export { useDeudores, useDeudasDeAlumno, mutarDeudas }          from './useDeudores';
export { toast, useToasts }                                     from './useToast';
export { useTheme }                                             from './useTheme';
export { useTacticas, mutarTacticas }                           from './useTacticas';
export { useConvocatorias, mutarConvocatorias }                 from './useConvocatorias';
export { invalidate, invalidatePrefix, invalidateMany, invalidateAll } from './useFirestoreCache';
export { useUsuarios }                                                 from './useUsuarios';

// === Fases 2-3 (estructura preparada) ===
export { useMisionesDeAlumno, mutarMisiones }             from './useMisiones';
export { useCompetenciasDeAlumno, mutarCompetencias }      from './useCompetencias';
export { useCanteraDeAlumno, useCanteraAll, mutarCantera } from './useCantera';
