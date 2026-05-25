/**
 * Sprint 0 — Defaults seguros para campos nuevos de Fase 5+.
 * Nunca muta el original. Aplica defaults solo si el campo no existe.
 * Usar: const al = withDefaults(alumnoRaw);
 */
export const withDefaults = (alumno) => {
  if (!alumno) return alumno;
  return {
    ...alumno,
    estado:              alumno.estado              ?? 'activo',
    etiquetas:           alumno.etiquetas           ?? [],
    contactosFamiliares: alumno.contactosFamiliares ?? [],
    eventosDeportivos:   alumno.eventosDeportivos   ?? [],
  };
};
