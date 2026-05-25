/**
 * FC SECHURA — Reglas de negocio centralizadas.
 * Cualquier valor que controle el comportamiento de la academia vive aquí.
 * En el futuro, varios de estos pueden migrar a Firestore (colección `configuracion`)
 * para que tesorería los edite sin redeploy.
 */

// ===== PAGOS =====
export const PRECIO_MENSUALIDAD = 65; // S/ mensualidad base
export const MONEDA = 'S/';
export const DIAS_GRACIA_MENSUALIDAD = 0; // Sin gracia: vence == debe

export const CATALOGO_PRECIOS = Object.freeze({
  'Mensualidad':            65,
  'Mensualidad (BECADO)':   0,
  'Matrícula Anual':        50,
  'Uniforme Completo':      80,
  'Polo de Entrenamiento':  35,
  'Short Deportivo':        25,
  'Inscripción a Torneo':   40,
});

export const METODOS_PAGO = [
  { value: 'Efectivo',           label: 'Efectivo',           emoji: '💵' },
  { value: 'Yape/Plin',          label: 'Yape / Plin',        emoji: '📱' },
  { value: 'Transferencia',      label: 'Transferencia',      emoji: '🏦' },
  { value: 'Aprobación Interna', label: 'Beca / Convenio',    emoji: '✅' },
];

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ===== ROLES =====
export const ROLES = Object.freeze({
  ADMIN:      'admin',
  ENTRENADOR: 'entrenador',
  TESORERO:   'tesorero',
  INVITADO:   'invitado',
});

export const ROLES_STAFF        = [ROLES.ADMIN, ROLES.ENTRENADOR, ROLES.TESORERO];
export const ROLES_DEPORTIVOS   = [ROLES.ADMIN, ROLES.ENTRENADOR];
export const ROLES_FINANCIEROS  = [ROLES.ADMIN, ROLES.TESORERO];
export const ROLES_SOLO_ADMIN   = [ROLES.ADMIN];

// ===== ASISTENCIA =====
export const ANTI_REBOTE_QR_MS = 30_000; // 30s entre escaneos del mismo DNI
export const ESTADOS_ASISTENCIA = Object.freeze({
  ASISTIO: 'Asistió',
  TARDE:   'Tarde',
  FALTO:   'Faltó',
});

// ===== PERFORMANCE / TIERS FIFA =====
export const PLAYER_TIERS = [
  { min: 85, label: 'ÉLITE',  color: '#FBBF24', glow: 'rgba(251, 191, 36, 0.45)' },
  { min: 75, label: 'ORO',    color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.40)' },
  { min: 65, label: 'PLATA',  color: '#94A3B8', glow: 'rgba(148, 163, 184, 0.40)' },
  { min: 0,  label: 'BRONCE', color: '#B45309', glow: 'rgba(180,  83,   9, 0.35)' },
];

export const getPlayerTier = (ovr) =>
  PLAYER_TIERS.find((tier) => ovr >= tier.min) ?? PLAYER_TIERS[PLAYER_TIERS.length - 1];

export const STAT_KEYS = ['ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico'];

export const calculateOVR = (stats) =>
  Math.round(STAT_KEYS.reduce((sum, k) => sum + (Number(stats[k]) || 0), 0) / STAT_KEYS.length);

// ===== CATEGORÍAS POR EDAD =====
export const CATEGORIAS = ['4', '5', '6', '7', '8', '9', '10'];

// ===== FORMATEADORES =====
export const formatMoney = (n) => `${MONEDA} ${(Number(n) || 0).toFixed(2)}`;

export const formatDateLima = (date = new Date()) => {
  const opts = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('es-PE', opts).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { iso: `${get('year')}-${get('month')}-${get('day')}`, dmy: `${get('day')}/${get('month')}/${get('year')}` };
};

/* =============================================================
   FASE 2 — Misiones del jugador
   ============================================================= */
export const MISION_AREAS = Object.freeze({
  TECNICA: 'tecnica',
  FISICA:  'fisica',
  TACTICA: 'tactica',
  MENTAL:  'mental',
});

export const MISION_AREAS_LIST = [
  { value: MISION_AREAS.TECNICA, label: 'Técnica' },
  { value: MISION_AREAS.FISICA,  label: 'Física' },
  { value: MISION_AREAS.TACTICA, label: 'Táctica' },
  { value: MISION_AREAS.MENTAL,  label: 'Mental' },
];

export const MISION_ESTADOS = Object.freeze({
  NO_LOGRADO: 'no_logrado',
  EN_PROCESO: 'en_proceso',
  LOGRADO:    'logrado',
  DESTACADO:  'destacado',
});

export const MISION_ESTADOS_LIST = [
  { value: MISION_ESTADOS.NO_LOGRADO, label: 'No logrado', color: 'var(--sn-text-muted)' },
  { value: MISION_ESTADOS.EN_PROCESO, label: 'En proceso', color: 'var(--sn-warn)' },
  { value: MISION_ESTADOS.LOGRADO,    label: 'Logrado',    color: 'var(--sn-success)' },
  { value: MISION_ESTADOS.DESTACADO,  label: 'Destacado',  color: 'var(--sn-tier-elite)' },
];

export const MISIONES_SUGERIDAS = [
  'Recibir perfilado antes de girar',
  'Levantar la cabeza antes del pase',
  'Presionar 3 segundos tras pérdida',
  'Usar pierna izquierda',
  'Máximo 2 toques',
  'Buscar tercer hombre',
  'Marcar al hombre en saques de esquina',
];

/* =============================================================
   FASE 3 — Competencias por posición
   ============================================================= */
export const POSICIONES = Object.freeze({
  PORTERO:   'portero',
  DEFENSA:   'defensa',
  VOLANTE:   'volante',
  DELANTERO: 'delantero',
});

export const COMPETENCIAS_POR_POSICION = {
  [POSICIONES.PORTERO]:   ['Salida del arco', 'Reflejos', 'Juego aéreo', 'Pase con pie'],
  [POSICIONES.DEFENSA]:   ['Marca', 'Cobertura', 'Duelo individual', 'Salida limpia'],
  [POSICIONES.VOLANTE]:   ['Orientación', 'Pase corto/largo', 'Presión', 'Visión de juego'],
  [POSICIONES.DELANTERO]: ['Definición', 'Desmarque', 'Primer control', 'Presión'],
};

export const NIVELES_COMPETENCIA = [
  { value: 1, label: 'Básico',         color: 'var(--sn-tier-bronze)' },
  { value: 2, label: 'En desarrollo',  color: 'var(--sn-info)' },
  { value: 3, label: 'Competitivo',    color: 'var(--sn-tier-gold)' },
  { value: 4, label: 'Destacado',      color: 'var(--sn-tier-elite)' },
];

/* =============================================================
   FASE 4 — Cantera y proyección
   ============================================================= */
export const POTENCIAL = [
  { value: 'bajo',  label: 'Bajo',  color: 'var(--sn-text-dim)' },
  { value: 'medio', label: 'Medio', color: 'var(--sn-info)' },
  { value: 'alto',  label: 'Alto',  color: 'var(--sn-success)' },
  { value: 'elite', label: 'Élite', color: 'var(--sn-tier-elite)' },
];

export const ALERTAS_CANTERA = [
  'Domina su categoría',
  'Probar en categoría superior',
  'Requiere seguimiento técnico',
  'Promesa observada',
];

/* =============================================================
   FASE 5 — Expediente deportivo vivo (alumno)
   ============================================================= */
export const ESTADOS_ALUMNO = [
  { value: 'activo',     label: 'Activo',     color: 'var(--sn-success)' },
  { value: 'inactivo',   label: 'Inactivo',   color: 'var(--sn-text-muted)' },
  { value: 'observado',  label: 'Observado',  color: 'var(--sn-info)' },
  { value: 'lesionado',  label: 'Lesionado',  color: 'var(--sn-crit)' },
  { value: 'moroso',     label: 'Moroso',     color: 'var(--sn-warn)' },
  { value: 'becado',     label: 'Becado',     color: 'var(--sn-tier-elite)' },
  { value: 'suspendido', label: 'Suspendido', color: 'var(--sn-crit)' },
  { value: 'prueba',     label: 'En prueba',  color: 'var(--sn-text-muted)' },
  { value: 'retirado',   label: 'Retirado',   color: 'var(--sn-text-dim)' },
];

export const ETIQUETAS_ALUMNO_SUGERIDAS = [
  'Zurdo',
  'Rápido',
  'Potencial alto',
  'Baja asistencia',
  'Requiere seguimiento',
  'Capitán',
  'Disciplinado',
];

export const TIPOS_CONTACTO_FAMILIAR = [
  { value: 'padre',      label: 'Padre' },
  { value: 'madre',      label: 'Madre' },
  { value: 'apoderado',  label: 'Apoderado' },
  { value: 'emergencia', label: 'Emergencia' },
];

/* =============================================================
   FASE 7 — Convocatoria profesional
   ============================================================= */
export const DISPONIBILIDAD_CONVOCATORIA = [
  { value: 'confirmado',         label: 'Confirmado',          color: 'var(--sn-success)' },
  { value: 'disponible',         label: 'Disponible',          color: 'var(--sn-brand-glow)' },
  { value: 'pendiente',          label: 'Pendiente',           color: 'var(--sn-warn)' },
  { value: 'no_disponible',      label: 'No disponible',       color: 'var(--sn-crit)' },
];

export const MOTIVOS_NO_CONVOCADO = [
  'Lesión',
  'Morosidad',
  'Baja asistencia',
  'Decisión técnica',
  'Cupo limitado',
  'Suspendido/Inactivo',
  'Otro',
];

export const CHECKLIST_CONVOCATORIA = [
  'Uniforme listo',
  'Permiso/apoderado confirmado',
  'Pago al día',
  'Documentos listos',
  'Confirmado por WhatsApp',
  'Asistencia esperada',
];

/* =============================================================
   FASE 8 — Gestión de usuarios / permisos
   ============================================================= */
export const ESTADOS_USUARIO = [
  { value: 'activo',     label: 'Activo',     color: 'var(--sn-success)' },
  { value: 'inactivo',   label: 'Inactivo',   color: 'var(--sn-text-muted)' },
  { value: 'suspendido', label: 'Suspendido', color: 'var(--sn-crit)' },
  { value: 'pendiente',  label: 'Pendiente',  color: 'var(--sn-warn)' },
];

export const PERMISOS_FINOS = [
  { value: 'ver_alumnos',          label: 'Ver alumnos',          grupo: 'Alumnos' },
  { value: 'editar_alumnos',       label: 'Editar alumnos',       grupo: 'Alumnos' },
  { value: 'ver_expediente',       label: 'Ver expediente',       grupo: 'Alumnos' },
  { value: 'editar_expediente',    label: 'Editar expediente',    grupo: 'Alumnos' },
  { value: 'ver_pagos',            label: 'Ver pagos',            grupo: 'Finanzas' },
  { value: 'registrar_pagos',      label: 'Registrar pagos',      grupo: 'Finanzas' },
  { value: 'ver_asistencia',       label: 'Ver asistencia',       grupo: 'Operaciones' },
  { value: 'registrar_asistencia', label: 'Registrar asistencia', grupo: 'Operaciones' },
  { value: 'ver_convocatorias',    label: 'Ver convocatorias',    grupo: 'Deportivo' },
  { value: 'crear_convocatorias',  label: 'Crear convocatorias',  grupo: 'Deportivo' },
  { value: 'gestionar_usuarios',   label: 'Gestionar usuarios',   grupo: 'Sistema' },
  { value: 'ver_reportes',         label: 'Ver reportes',         grupo: 'Sistema' },
  { value: 'exportar_datos',       label: 'Exportar datos',       grupo: 'Sistema' },
  { value: 'ver_auditoria',        label: 'Ver auditoría',        grupo: 'Sistema' },
];

export const ACCIONES_AUDITABLES = Object.freeze({
  ANULAR_RECIBO:   'anular_recibo',
  ELIMINAR_ALUMNO: 'eliminar_alumno',
  REVOCAR_USUARIO: 'revocar_usuario',
  EDITAR_PAGO:     'editar_pago',
  CREAR_USUARIO:   'crear_usuario',
  EDITAR_USUARIO:  'editar_usuario',
});
