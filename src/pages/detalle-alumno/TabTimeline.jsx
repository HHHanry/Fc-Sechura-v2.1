import React, { useState, useMemo } from 'react';
import { Card, CardBody, Button, Badge, EmptyState, Timeline } from '../../components/ui';
import { mutarAlumnos } from '../../hooks/useAlumnos';
import { toast } from '../../hooks/useToast';
import { useAuth } from '../../context/useAuth';
import { audit } from '../../helpers/auditHelper';
import { formatDateLima } from '../../config/businessRules';

/* =====================================================
   Constantes
   ===================================================== */
const TIPOS_EVENTO = [
  { value: 'observacion',  label: 'Observación técnica' },
  { value: 'lesion',       label: 'Lesión' },
  { value: 'logro',        label: 'Logro' },
  { value: 'nota_admin',   label: 'Nota administrativa' },
];

const TONE_MAP = {
  cambio_estado: 'info',
  lesion:        'crit',
  observacion:   'brand',
  etiquetas:     'neutral',
  contacto:      'neutral',
  logro:         'elite',
  nota_admin:    'neutral',
};

const TIPO_LABEL = {
  cambio_estado: 'Cambio de estado',
  lesion:        'Lesión',
  observacion:   'Observación técnica',
  etiquetas:     'Etiquetas',
  contacto:      'Contacto',
  logro:         'Logro',
  nota_admin:    'Nota administrativa',
};

const EVENTO_VACIO = { tipo: 'observacion', descripcion: '' };

/* =====================================================
   Helpers
   ===================================================== */
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
};

const getTone = (tipo) => TONE_MAP[tipo] ?? 'neutral';

const getLabel = (tipo) => TIPO_LABEL[tipo] ?? capitalize(tipo);

/* =====================================================
   Componente principal
   ===================================================== */
export const TabTimeline = ({ alumno, setAlumno }) => {
  const { user } = useAuth();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [formEvento, setFormEvento] = useState({ ...EVENTO_VACIO });
  const [guardando, setGuardando] = useState(false);

  /* === Items mapeados para el componente Timeline, ordenados newest first === */
  const timelineItems = useMemo(() => {
    const eventos = [...(alumno.eventosDeportivos ?? [])];
    // Ordenar: más reciente primero
    eventos.sort((a, b) => {
      const da = a.fecha ?? '';
      const db = b.fecha ?? '';
      return db.localeCompare(da);
    });
    return eventos.map((ev, i) => ({
      id: i,
      title: getLabel(ev.tipo),
      description: ev.descripcion,
      date: ev.fecha,
      tone: getTone(ev.tipo),
      badge: ev.actor ? (
        <Badge tone="neutral" size="sm">
          {ev.actor}
        </Badge>
      ) : undefined,
    }));
  }, [alumno.eventosDeportivos]);

  /* === Handlers === */
  const abrirForm = () => {
    setFormEvento({ ...EVENTO_VACIO });
    setMostrarForm(true);
  };

  const cancelarForm = () => {
    setMostrarForm(false);
    setFormEvento({ ...EVENTO_VACIO });
  };

  const guardarEvento = async () => {
    if (!formEvento.descripcion.trim()) {
      toast.error('La descripción del evento es requerida.');
      return;
    }
    setGuardando(true);
    const { iso } = formatDateLima();
    const nuevoEvento = {
      fecha: iso,
      tipo: formEvento.tipo,
      descripcion: formEvento.descripcion.trim(),
      actor: user?.nombre ?? user?.email ?? 'Sistema',
    };
    const eventosActualizados = [...(alumno.eventosDeportivos ?? []), nuevoEvento];
    try {
      await mutarAlumnos.actualizar(alumno.id, { eventosDeportivos: eventosActualizados });
      setAlumno((prev) => ({ ...prev, eventosDeportivos: eventosActualizados }));
      await audit('agregar_evento_deportivo', { alumnoId: alumno.id, evento: nuevoEvento }, user);
      toast.success('Evento registrado en la bitácora.');
      setMostrarForm(false);
      setFormEvento({ ...EVENTO_VACIO });
    } catch {
      toast.error('No se pudo guardar el evento.');
    } finally {
      setGuardando(false);
    }
  };

  /* === Render === */
  return (
    <div style={sectionWrapStyle}>

      {/* === Card: Bitácora === */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          <div style={panelHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={iconBoxStyle}>
                <ClipboardIcon />
              </span>
              <div>
                <h3 style={panelTitleStyle}>Bitácora deportiva</h3>
                <span style={subLabelStyle}>
                  {timelineItems.length} {timelineItems.length === 1 ? 'evento' : 'eventos'} registrados
                </span>
              </div>
            </div>
            {!mostrarForm && (
              <Button variant="secondary" size="sm" icon={<PlusIcon />} onClick={abrirForm}>
                Agregar evento
              </Button>
            )}
          </div>

          <div style={{ padding: 'var(--sn-space-5)' }}>

            {/* Formulario inline */}
            {mostrarForm && (
              <div style={formCardStyle}>
                <h4 style={formTitleStyle}>Nuevo evento deportivo</h4>
                <div style={formGridStyle} className="sn-timeline-form-grid">
                  <label style={labelWrapStyle}>
                    <span style={subLabelStyle}>Tipo de evento</span>
                    <select
                      value={formEvento.tipo}
                      onChange={(e) => setFormEvento((p) => ({ ...p, tipo: e.target.value }))}
                      className="sn-focusable"
                      style={inputStyle}
                    >
                      {TIPOS_EVENTO.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ ...labelWrapStyle, gridColumn: '1 / -1' }}>
                    <span style={subLabelStyle}>Descripción *</span>
                    <textarea
                      value={formEvento.descripcion}
                      onChange={(e) => setFormEvento((p) => ({ ...p, descripcion: e.target.value }))}
                      rows={3}
                      placeholder="Describe el evento con detalle…"
                      className="sn-focusable"
                      style={{ ...inputStyle, minHeight: 88, fontFamily: 'var(--sn-font-ui)', resize: 'vertical' }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sn-space-4)' }}>
                  <Button variant="ghost" size="sm" onClick={cancelarForm} disabled={guardando}>
                    Cancelar
                  </Button>
                  <Button variant="primary" size="sm" onClick={guardarEvento} loading={guardando}>
                    Registrar evento
                  </Button>
                </div>
              </div>
            )}

            {/* Separador si hay form y hay eventos */}
            {mostrarForm && timelineItems.length > 0 && (
              <div style={separatorStyle} />
            )}

            {/* Timeline vacío */}
            {timelineItems.length === 0 && !mostrarForm && (
              <EmptyState
                icon={<ClipboardIcon />}
                title="Sin eventos registrados"
                description="La bitácora de este jugador está vacía. Agrega el primer evento deportivo."
                action={
                  <Button variant="secondary" size="sm" icon={<PlusIcon />} onClick={abrirForm}>
                    Agregar evento
                  </Button>
                }
              />
            )}

            {/* Timeline con eventos */}
            {timelineItems.length > 0 && (
              <Timeline
                items={timelineItems}
                emptyText="Sin eventos registrados."
              />
            )}
          </div>
        </CardBody>
      </Card>

      <style>{`
        @media (max-width: 599.98px) {
          .sn-timeline-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

/* =====================================================
   Iconos
   ===================================================== */
const ClipboardIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/></svg>);
const PlusIcon      = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>);

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
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: 'var(--sn-space-5)',
  borderBottom: '1px solid var(--sn-border-faint)',
  gap: 'var(--sn-space-3)',
};

const panelTitleStyle = {
  margin: 0, fontFamily: 'var(--sn-font-display)',
  fontSize: 'var(--sn-fs-md)', fontWeight: 700,
  color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)',
};

const iconBoxStyle = {
  width: 32, height: 32, borderRadius: 'var(--sn-radius-sm)',
  background: 'color-mix(in srgb, var(--sn-brand-glow) 14%, transparent)',
  color: 'var(--sn-brand-glow)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid color-mix(in srgb, var(--sn-brand-glow) 40%, transparent)',
  flexShrink: 0,
};

const formCardStyle = {
  background: 'var(--sn-bg-elevated)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  padding: 'var(--sn-space-5)',
  marginBottom: 'var(--sn-space-4)',
};

const formTitleStyle = {
  margin: '0 0 var(--sn-space-4)',
  fontFamily: 'var(--sn-font-display)',
  fontSize: 'var(--sn-fs-sm)',
  fontWeight: 700,
  color: 'var(--sn-text-primary)',
};

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 'var(--sn-space-3)',
};

const labelWrapStyle = {
  display: 'flex', flexDirection: 'column', gap: 6,
};

const separatorStyle = {
  height: 1,
  background: 'var(--sn-border-faint)',
  margin: '0 0 var(--sn-space-4)',
};
