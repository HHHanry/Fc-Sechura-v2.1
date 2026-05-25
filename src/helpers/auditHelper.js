/**
 * Sprint 0 — Helper mínimo de auditoría.
 * Envuelve auditoriaService.log() con el actor del contexto Auth.
 * Uso: await audit('cambio_estado', { alumnoId, de: 'activo', a: 'lesionado' }, user);
 */
import { auditoriaService } from '../services/auditoriaService';

export const audit = (accion, payload = {}, user = {}) =>
  auditoriaService.log(accion, payload, {
    uid: user.uid ?? null,
    nombre: user.nombre ?? user.email ?? null,
    rol: user.rol ?? null,
  });
