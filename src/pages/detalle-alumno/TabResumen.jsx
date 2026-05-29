import React, { useState } from 'react';
import { Card, CardBody, Button, Badge, EmptyState, Modal, StatusBadge, TagInput } from '../../components/ui';
import { mutarAlumnos } from '../../hooks/useAlumnos';
import { toast } from '../../hooks/useToast';
import { useAuth } from '../../context/useAuth';
import { audit } from '../../helpers/auditHelper';
import {
  ESTADOS_ALUMNO,
  ETIQUETAS_ALUMNO_SUGERIDAS,
  TIPOS_CONTACTO_FAMILIAR,
  formatDateLima,
} from '../../config/businessRules';

/* =====================================================
   Constantes
   ===================================================== */
const ESTADOS_QUE_REQUIEREN_MOTIVO = ['lesionado', 'retirado', 'moroso', 'observado', 'suspendido', 'inactivo'];

const ETIQUETAS_SUGERIDAS_EXTRA = [
  ...ETIQUETAS_ALUMNO_SUGERIDAS,
  'Arquero', 'Defensa', 'Volante', 'Delantero', 'Capitán',
  'Potencial alto', 'Seguimiento', 'Necesita evaluación',
  'Disciplinario', 'Asistencia baja',
];
// Deduplicar
const TODAS_SUGERENCIAS = [...new Set(ETIQUETAS_SUGERIDAS_EXTRA)];

const CONTACTO_TONO = {
  padre:      'brand',
  madre:      'info',
  apoderado:  'warn',
  emergencia: 'crit',
};

const CONTACTO_VACIO = {
  tipo: 'padre', nombre: '', celular: '', esPrincipal: false, observaciones: '',
};

/* =====================================================
   Componente principal
   ===================================================== */
export const TabResumen = ({ alumno, setAlumno, puedeEditar = false }) => {
  const { user } = useAuth();

  // --- Estado: cambio de estado del alumno ---
  const [estadoPendiente, setEstadoPendiente] = useState(null);
  const [motivoCambio, setMotivoCambio] = useState('');
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  // --- Estado: etiquetas ---
  const [guardandoEtiquetas, setGuardandoEtiquetas] = useState(false);

  // --- Estado: contactos ---
  const [formContacto, setFormContacto] = useState(null);   // null = cerrado, objeto = editando/creando
  const [indexEditando, setIndexEditando] = useState(null);  // null = nuevo
  const [guardandoContacto, setGuardandoContacto] = useState(false);
  const [indexBorrando, setIndexBorrando] = useState(null);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);

  /* === Handlers: estado === */
  const handleSeleccionarEstado = (nuevoEstado) => {
    if (nuevoEstado === alumno.estado) return;
    setMotivoCambio('');
    if (ESTADOS_QUE_REQUIEREN_MOTIVO.includes(nuevoEstado)) {
      setEstadoPendiente(nuevoEstado);
    } else {
      confirmarCambioEstado(nuevoEstado, '');
    }
  };

  const confirmarCambioEstado = async (estado, motivo) => {
    setGuardandoEstado(true);
    const estadoAnterior = alumno.estado;
    const estadoAnteriorLabel = ESTADOS_ALUMNO.find((e) => e.value === estadoAnterior)?.label ?? estadoAnterior;
    const estadoNuevoLabel = ESTADOS_ALUMNO.find((e) => e.value === estado)?.label ?? estado;
    const descripcion = motivo
      ? `Estado: ${estadoAnteriorLabel} → ${estadoNuevoLabel}. Motivo: ${motivo}`
      : `Estado: ${estadoAnteriorLabel} → ${estadoNuevoLabel}`;
    const { iso } = formatDateLima();
    const nuevoEvento = {
      fecha: iso,
      tipo: 'cambio_estado',
      descripcion,
      actor: user?.nombre ?? user?.email ?? 'Sistema',
    };
    const eventosActualizados = [...(alumno.eventosDeportivos ?? []), nuevoEvento];
    try {
      await mutarAlumnos.actualizar(alumno.id, {
        estado,
        eventosDeportivos: eventosActualizados,
      });
      setAlumno((prev) => ({ ...prev, estado, eventosDeportivos: eventosActualizados }));
      await audit('cambio_estado', { alumnoId: alumno.id, de: estadoAnterior, a: estado, motivo }, user);
      toast.success(`Estado actualizado a "${estadoNuevoLabel}".`);
    } catch {
      toast.error('No se pudo actualizar el estado.');
    } finally {
      setGuardandoEstado(false);
      setEstadoPendiente(null);
      setMotivoCambio('');
    }
  };

  /* === Handlers: etiquetas === */
  const handleEtiquetasChange = async (nuevasEtiquetas) => {
    // Actualización optimista
    setAlumno((prev) => ({ ...prev, etiquetas: nuevasEtiquetas }));
    setGuardandoEtiquetas(true);
    try {
      await mutarAlumnos.actualizar(alumno.id, { etiquetas: nuevasEtiquetas });
      await audit('actualizar_etiquetas', { alumnoId: alumno.id, etiquetas: nuevasEtiquetas }, user);
      toast.success('Etiquetas actualizadas.');
    } catch {
      toast.error('No se pudieron guardar las etiquetas.');
      // Revertir
      setAlumno((prev) => ({ ...prev, etiquetas: alumno.etiquetas }));
    } finally {
      setGuardandoEtiquetas(false);
    }
  };

  /* === Handlers: contactos === */
  const abrirNuevoContacto = () => {
    setFormContacto({ ...CONTACTO_VACIO });
    setIndexEditando(null);
  };

  const abrirEditarContacto = (idx) => {
    setFormContacto({ ...alumno.contactosFamiliares[idx] });
    setIndexEditando(idx);
  };

  const cancelarFormContacto = () => {
    setFormContacto(null);
    setIndexEditando(null);
  };

  const guardarContacto = async () => {
    if (!formContacto.nombre.trim()) {
      toast.error('El nombre del contacto es requerido.');
      return;
    }
    setGuardandoContacto(true);
    const contactosActuales = [...(alumno.contactosFamiliares ?? [])];
    let contactosActualizados;
    let accion;
    if (indexEditando !== null) {
      contactosActualizados = contactosActuales.map((c, i) => (i === indexEditando ? { ...formContacto } : c));
      accion = 'editar_contacto';
    } else {
      contactosActualizados = [...contactosActuales, { ...formContacto }];
      accion = 'agregar_contacto';
    }
    try {
      await mutarAlumnos.actualizar(alumno.id, { contactosFamiliares: contactosActualizados });
      setAlumno((prev) => ({ ...prev, contactosFamiliares: contactosActualizados }));
      await audit(accion, { alumnoId: alumno.id, contacto: formContacto }, user);
      toast.success(indexEditando !== null ? 'Contacto actualizado.' : 'Contacto agregado.');
      setFormContacto(null);
      setIndexEditando(null);
    } catch {
      toast.error('No se pudo guardar el contacto.');
    } finally {
      setGuardandoContacto(false);
    }
  };

  const solicitarBorrarContacto = (idx) => {
    setIndexBorrando(idx);
    setConfirmandoBorrar(true);
  };

  const confirmarBorrarContacto = async () => {
    setGuardandoContacto(true);
    const contactoEliminado = alumno.contactosFamiliares[indexBorrando];
    const contactosActualizados = alumno.contactosFamiliares.filter((_, i) => i !== indexBorrando);
    try {
      await mutarAlumnos.actualizar(alumno.id, { contactosFamiliares: contactosActualizados });
      setAlumno((prev) => ({ ...prev, contactosFamiliares: contactosActualizados }));
      await audit('eliminar_contacto', { alumnoId: alumno.id, contacto: contactoEliminado }, user);
      toast.success('Contacto eliminado.');
    } catch {
      toast.error('No se pudo eliminar el contacto.');
    } finally {
      setGuardandoContacto(false);
      setConfirmandoBorrar(false);
      setIndexBorrando(null);
    }
  };

  /* === Render === */
  return (
    <div style={sectionWrapStyle}>

      {/* === SECCIÓN: Estado === */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          <div style={panelHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={iconBoxStyle('var(--sn-brand-glow)')}>
                <ShieldIcon />
              </span>
              <h3 style={panelTitleStyle}>Estado del alumno</h3>
            </div>
          </div>
          <div style={{ padding: 'var(--sn-space-5)' }}>
            <div style={estadoRowStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={subLabelStyle}>Estado actual</span>
                <StatusBadge value={alumno.estado} size="lg" />
              </div>
              {puedeEditar && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={subLabelStyle}>Cambiar a</span>
                  <select
                    value={alumno.estado}
                    onChange={(e) => handleSeleccionarEstado(e.target.value)}
                    disabled={guardandoEstado}
                    className="sn-focusable"
                    style={{ ...inputStyle, width: 'auto', minWidth: 160 }}
                  >
                    {ESTADOS_ALUMNO.map((e) => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* === SECCIÓN: Etiquetas === */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          <div style={panelHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={iconBoxStyle('var(--sn-info)')}>
                <TagIcon />
              </span>
              <div>
                <h3 style={panelTitleStyle}>Etiquetas del jugador</h3>
                {guardandoEtiquetas && <span style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>Guardando…</span>}
              </div>
            </div>
          </div>
          <div style={{ padding: 'var(--sn-space-5)' }}>
            {puedeEditar ? (
              <>
                <TagInput
                  value={alumno.etiquetas}
                  onChange={handleEtiquetasChange}
                  suggestions={TODAS_SUGERENCIAS}
                  placeholder="Agregar etiqueta…"
                  max={12}
                />
                {alumno.etiquetas.length === 0 && (
                  <p style={{ marginTop: 8, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                    Sin etiquetas. Escribe o elige una sugerencia.
                  </p>
                )}
              </>
            ) : (
              alumno.etiquetas.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                  Sin etiquetas registradas.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {alumno.etiquetas.map((t, i) => <Badge key={i} tone="neutral">{t}</Badge>)}
                </div>
              )
            )}
          </div>
        </CardBody>
      </Card>

      {/* === SECCIÓN: Contacto familiar === */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          <div style={{ ...panelHeaderStyle, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={iconBoxStyle('var(--sn-success)')}>
                <UsersIcon />
              </span>
              <h3 style={panelTitleStyle}>Contacto familiar</h3>
            </div>
            {puedeEditar && !formContacto && (
              <Button variant="secondary" size="sm" icon={<PlusIcon />} onClick={abrirNuevoContacto}>
                Agregar
              </Button>
            )}
          </div>

          <div style={{ padding: 'var(--sn-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>

            {/* Lista de contactos */}
            {alumno.contactosFamiliares.length === 0 && !formContacto && (
              <EmptyState
                icon={<UsersIcon />}
                title="Sin contactos registrados"
                description="Agrega el contacto de un familiar o apoderado responsable."
              />
            )}

            {alumno.contactosFamiliares.map((c, idx) => (
              <div key={idx} style={contactCardStyle}>
                <div style={contactCardHeaderStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge tone={CONTACTO_TONO[c.tipo] ?? 'neutral'}>
                      {TIPOS_CONTACTO_FAMILIAR.find((t) => t.value === c.tipo)?.label ?? c.tipo}
                    </Badge>
                    {c.esPrincipal && (
                      <span style={starBadgeStyle} title="Contacto principal">★ Principal</span>
                    )}
                  </div>
                  {puedeEditar && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="sn-focusable"
                        style={iconBtnStyle}
                        onClick={() => abrirEditarContacto(idx)}
                        title="Editar contacto"
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="sn-focusable"
                        style={{ ...iconBtnStyle, color: 'var(--sn-crit)' }}
                        onClick={() => solicitarBorrarContacto(idx)}
                        title="Eliminar contacto"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-sm)' }}>
                    {c.nombre || '—'}
                  </span>
                  {c.celular && (
                    <a href={`tel:${c.celular}`} style={celularLinkStyle}>
                      <PhoneIcon /> {c.celular}
                    </a>
                  )}
                  {c.observaciones && (
                    <p style={{ margin: 0, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontStyle: 'italic' }}>
                      {c.observaciones}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Formulario inline */}
            {formContacto && (
              <div style={formCardStyle}>
                <h4 style={{ margin: '0 0 var(--sn-space-4)', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)' }}>
                  {indexEditando !== null ? 'Editar contacto' : 'Nuevo contacto'}
                </h4>
                <div style={formGridStyle} className="sn-contacto-form-grid">
                  <label style={labelWrapStyle}>
                    <span style={subLabelStyle}>Tipo</span>
                    <select
                      value={formContacto.tipo}
                      onChange={(e) => setFormContacto((p) => ({ ...p, tipo: e.target.value }))}
                      className="sn-focusable"
                      style={inputStyle}
                    >
                      {TIPOS_CONTACTO_FAMILIAR.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={labelWrapStyle}>
                    <span style={subLabelStyle}>Nombre completo *</span>
                    <input
                      type="text"
                      value={formContacto.nombre}
                      onChange={(e) => setFormContacto((p) => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej: Juan Pérez"
                      className="sn-focusable"
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelWrapStyle}>
                    <span style={subLabelStyle}>Celular</span>
                    <input
                      type="tel"
                      value={formContacto.celular}
                      onChange={(e) => setFormContacto((p) => ({ ...p, celular: e.target.value }))}
                      placeholder="Ej: 987654321"
                      className="sn-focusable"
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ ...labelWrapStyle, gridColumn: '1 / -1' }}>
                    <span style={subLabelStyle}>Observaciones</span>
                    <textarea
                      value={formContacto.observaciones}
                      onChange={(e) => setFormContacto((p) => ({ ...p, observaciones: e.target.value }))}
                      rows={2}
                      placeholder="Horarios disponibles, notas…"
                      className="sn-focusable"
                      style={{ ...inputStyle, fontFamily: 'var(--sn-font-ui)' }}
                    />
                  </label>
                  <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
                    <input
                      type="checkbox"
                      checked={!!formContacto.esPrincipal}
                      onChange={(e) => setFormContacto((p) => ({ ...p, esPrincipal: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: 'var(--sn-brand-glow)', cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--sn-text-primary)', fontWeight: 600, fontSize: 'var(--sn-fs-sm)' }}>
                      Marcar como contacto principal
                    </span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sn-space-4)' }}>
                  <Button variant="ghost" size="sm" onClick={cancelarFormContacto} disabled={guardandoContacto}>
                    Cancelar
                  </Button>
                  <Button variant="primary" size="sm" onClick={guardarContacto} loading={guardandoContacto}>
                    {indexEditando !== null ? 'Guardar cambios' : 'Agregar contacto'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* === MODAL: Confirmar cambio de estado === */}
      <Modal
        open={!!estadoPendiente}
        onClose={() => { setEstadoPendiente(null); setMotivoCambio(''); }}
        title="Confirmar cambio de estado"
        description={`Estás por cambiar el estado del alumno a "${ESTADOS_ALUMNO.find((e) => e.value === estadoPendiente)?.label ?? estadoPendiente}". Este cambio quedará registrado en la bitácora.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setEstadoPendiente(null); setMotivoCambio(''); }} disabled={guardandoEstado}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmarCambioEstado(estadoPendiente, motivoCambio)}
              loading={guardandoEstado}
            >
              Confirmar cambio
            </Button>
          </>
        }
      >
        <label style={labelWrapStyle}>
          <span style={subLabelStyle}>Motivo (opcional)</span>
          <textarea
            value={motivoCambio}
            onChange={(e) => setMotivoCambio(e.target.value)}
            rows={3}
            placeholder="Ej: Lesión en rodilla derecha diagnosticada el…"
            className="sn-focusable"
            style={{ ...inputStyle, fontFamily: 'var(--sn-font-ui)' }}
          />
        </label>
      </Modal>

      {/* === MODAL: Confirmar borrar contacto === */}
      <Modal
        open={confirmandoBorrar}
        onClose={() => { setConfirmandoBorrar(false); setIndexBorrando(null); }}
        title="Eliminar contacto"
        description="Esta acción no se puede deshacer. ¿Confirmas que deseas eliminar este contacto?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setConfirmandoBorrar(false); setIndexBorrando(null); }} disabled={guardandoContacto}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarBorrarContacto} loading={guardandoContacto}>
              Eliminar
            </Button>
          </>
        }
      />

      <style>{`
        @media (max-width: 599.98px) {
          .sn-contacto-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

/* =====================================================
   Iconos
   ===================================================== */
const ShieldIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>);
const TagIcon     = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.6 8.3 15.7 3.4a2 2 0 0 0-1.4-.4H5a2 2 0 0 0-2 2v9.3a2 2 0 0 0 .6 1.4l4.9 4.9a2 2 0 0 0 2.8 0l9.3-9.3a2 2 0 0 0 0-3Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>);
const UsersIcon   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const PlusIcon    = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>);
const EditIcon    = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>);
const TrashIcon   = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>);
const PhoneIcon   = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.04 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.71 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.71A2 2 0 0 1 22 16.92Z"/></svg>);

/* =====================================================
   Estilos
   ===================================================== */
const subLabelStyle = {
  fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
  letterSpacing: 'var(--sn-tracking-wide)', textTransform: 'uppercase',
  color: 'var(--sn-text-muted)',
};

const inputStyle = {
  width: '100%', background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0.85rem', outline: 'none', minHeight: 44,
  boxSizing: 'border-box',
};

const sectionWrapStyle = {
  display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)',
};

const panelHeaderStyle = {
  display: 'flex', alignItems: 'center',
  padding: 'var(--sn-space-5)',
  borderBottom: '1px solid var(--sn-border-faint)',
};

const panelTitleStyle = {
  margin: 0, fontFamily: 'var(--sn-font-display)',
  fontSize: 'var(--sn-fs-md)', fontWeight: 700,
  color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)',
};

const iconBoxStyle = (color) => ({
  width: 32, height: 32, borderRadius: 'var(--sn-radius-sm)',
  background: `color-mix(in srgb, ${color} 14%, transparent)`,
  color,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
  flexShrink: 0,
});

const estadoRowStyle = {
  display: 'flex', gap: 'var(--sn-space-5)', alignItems: 'flex-end', flexWrap: 'wrap',
};

const contactCardStyle = {
  background: 'var(--sn-overlay-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
  padding: 'var(--sn-space-4)',
};

const contactCardHeaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
};

const starBadgeStyle = {
  fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
  color: 'var(--sn-tier-elite)',
  letterSpacing: 'var(--sn-tracking-wide)',
};

const iconBtnStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, minHeight: 32,
  borderRadius: 'var(--sn-radius-sm)',
  background: 'transparent', border: '1px solid var(--sn-border-faint)',
  color: 'var(--sn-text-muted)', cursor: 'pointer',
  transition: 'background var(--sn-dur-fast)',
};

const celularLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  color: 'var(--sn-brand-glow)', fontWeight: 700, fontSize: 'var(--sn-fs-xs)',
  textDecoration: 'none',
};

const formCardStyle = {
  background: 'var(--sn-bg-elevated)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  padding: 'var(--sn-space-5)',
};

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 'var(--sn-space-3)',
};

const labelWrapStyle = {
  display: 'flex', flexDirection: 'column', gap: 6,
};
