import React, { useMemo, useState } from 'react';
import { useConvocatorias, mutarConvocatorias } from '../hooks/useConvocatorias';
import { invalidate } from '../hooks/useFirestoreCache';
import { increment, arrayUnion } from '../services/firestoreClient';
import { alumnosService } from '../services/alumnosService';
import { toast } from '../hooks/useToast';
import { Card, CardBody, Button, Badge, Modal, EmptyState, FilterBar } from '../components/ui';

// Catálogo de medallas (gamificación)
const CATALOGO_MEDALLAS = [
  { id: 'mvp',           label: 'MVP',     color: 'var(--sn-tier-elite)', icon: '⭐' },
  { id: 'muralla',       label: 'Muralla', color: 'var(--sn-info)',       icon: '🛡️' },
  { id: 'motor',         label: 'Motor',   color: 'var(--sn-success)',    icon: '⚡' },
  { id: 'francotirador', label: 'Sniper',  color: 'var(--sn-crit)',       icon: '🎯' },
];

const ScoutingPartidos = () => {
  const { convocatorias, loading } = useConvocatorias(20);

  const [partidoActivo, setPartidoActivo] = useState(null);
  const [scoreFinal, setScoreFinal]       = useState({ favor: 0, contra: 0 });
  const [statsJugadores, setStatsJugadores] = useState([]);
  const [confirmarOpen, setConfirmarOpen] = useState(false);
  const [cerrando, setCerrando]           = useState(false);

  // Filtros de la bitácora
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCat, setFiltroCat]       = useState('');

  const categoriasBitacora = useMemo(
    () => [...new Set(convocatorias.map((c) => c.categoria).filter(Boolean))].sort(),
    [convocatorias],
  );

  const bitacora = useMemo(() => convocatorias.filter((p) => {
    const estado = p.estado === 'Completado' ? 'completado' : 'pendiente';
    const matchEstado = !filtroEstado || estado === filtroEstado;
    const matchCat = !filtroCat || String(p.categoria) === String(filtroCat);
    return matchEstado && matchCat;
  }), [convocatorias, filtroEstado, filtroCat]);

  const hayFiltros = !!(filtroEstado || filtroCat);

  const abrirEditor = (partido) => {
    if (partido.estado === 'Completado') return toast.warn('Este partido ya fue procesado.');
    setPartidoActivo(partido);
    setScoreFinal({ favor: partido.golesFavor ?? 0, contra: partido.golesContra ?? 0 });
    setStatsJugadores((partido.jugadoresConvocados ?? []).map((j) => ({
      id: j.id,
      nombre: j.nombre,
      apellido: j.apellido,
      goles: 0,
      asistencias: 0,
      amarillas: 0,
      rojas: 0,
      medallas: [],
    })));
  };

  const actualizarStat = (id, campo, delta) => {
    setStatsJugadores((prev) => prev.map((j) => {
      if (j.id !== id) return j;
      let v = j[campo] + delta;
      if (v < 0) v = 0;
      if (campo === 'amarillas' && v > 2) v = 2;
      if (campo === 'rojas'     && v > 1) v = 1;
      return { ...j, [campo]: v };
    }));
  };

  const toggleMedalla = (id, medallaId) => {
    setStatsJugadores((prev) => prev.map((j) => {
      if (j.id !== id) return j;
      const tiene = j.medallas.includes(medallaId);
      return { ...j, medallas: tiene ? j.medallas.filter((m) => m !== medallaId) : [...j.medallas, medallaId] };
    }));
  };

  const finalizarPartido = async () => {
    if (!partidoActivo) return;
    setCerrando(true);
    try {
      const resultado = scoreFinal.favor > scoreFinal.contra ? 'VICTORIA'
                       : scoreFinal.favor < scoreFinal.contra ? 'DERROTA' : 'EMPATE';

      await mutarConvocatorias.actualizar(partidoActivo.id, {
        estado: 'Completado',
        resultadoFinal: resultado,
        golesFavorFinal: scoreFinal.favor,
        golesContraFinal: scoreFinal.contra,
        statsJugadores,
      });

      // Actualización masiva: stats acumuladas + medallas vitrina
      await Promise.all(statsJugadores.map((j) => {
        const updates = {
          partidosJugados: increment(1),
          golesHistoricos: increment(j.goles),
          asistenciasHistoricas: increment(j.asistencias),
        };
        if (j.medallas.length > 0) {
          updates.medallasHistoricas = arrayUnion(...j.medallas);
        }
        return alumnosService.actualizar(j.id, updates);
      }));

      // Invalidar caché de alumnos para que portales/perfiles refresquen
      invalidate('alumnos');
      statsJugadores.forEach((j) => invalidate(`alumnos:${j.id}`));

      toast.success(`Partido cerrado · ${resultado}. Perfiles actualizados.`);
      setConfirmarOpen(false);
      setPartidoActivo(null);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cerrar el partido.');
    } finally { setCerrando(false); }
  };

  const resultadoLive = useMemo(() => {
    if (scoreFinal.favor > scoreFinal.contra) return { label: 'VICTORIA', tone: 'success' };
    if (scoreFinal.favor < scoreFinal.contra) return { label: 'DERROTA', tone: 'crit' };
    return { label: 'EMPATE', tone: 'warn' };
  }, [scoreFinal]);

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        <header style={headerStyle}>
          <div>
            <span style={eyebrowStyle}>DEPORTIVO · POST-MATCH</span>
            <h1 style={titleStyle}>Score & logros</h1>
            <p style={leadStyle}>Cierre de partidos, evaluación de plantilla y asignación de medallas.</p>
          </div>
        </header>

        <div style={{ marginBottom: 'var(--sn-space-5)' }}>
          <FilterBar
            filters={[
              { id: 'estado', ariaLabel: 'Filtrar por estado del partido', value: filtroEstado, onChange: setFiltroEstado,
                options: [
                  { value: '', label: 'Todos los partidos' },
                  { value: 'pendiente', label: 'Por cerrar' },
                  { value: 'completado', label: 'Procesados' },
                ] },
              { id: 'cat', ariaLabel: 'Filtrar por categoría', value: filtroCat, onChange: setFiltroCat,
                options: [{ value: '', label: 'Todas las categorías' }, ...categoriasBitacora.map((c) => ({ value: String(c), label: `Cat. ${c}` }))] },
            ]}
            meta={loading ? 'Cargando…' : `${bitacora.length} de ${convocatorias.length} partidos`}
            onReset={hayFiltros ? () => { setFiltroEstado(''); setFiltroCat(''); } : undefined}
          />
        </div>

        <div style={mainGridStyle} className="sn-scout-grid">
          {/* === BITÁCORA === */}
          <Card>
            <CardBody style={{ padding: 0 }}>
              <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5)', borderBottom: '1px solid var(--sn-border-faint)' }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)' }}>Bitácora de partidos</h3>
                <span style={subLabelStyle}>{bitacora.length} convocatorias</span>
              </div>
              <div className="sn-scroll" style={{ maxHeight: 640, overflow: 'auto', padding: 'var(--sn-space-3)' }}>
                {loading ? (
                  <EmptyState title="Cargando..." description="Sincronizando con la base de datos." />
                ) : bitacora.length === 0 ? (
                  <EmptyState
                    title={convocatorias.length === 0 ? 'Sin partidos' : 'Sin coincidencias'}
                    description={convocatorias.length === 0 ? 'No hay convocatorias registradas todavía.' : 'Ningún partido cumple con los filtros aplicados.'}
                  />
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-2)' }}>
                    {bitacora.map((p) => {
                      const completado = p.estado === 'Completado';
                      return (
                        <li key={p.id}
                          onClick={() => abrirEditor(p)}
                          style={{
                            ...matchCardStyle,
                            borderLeftColor: completado ? 'var(--sn-success)' : 'var(--sn-warn)',
                            opacity: completado ? 0.7 : 1,
                            cursor: completado ? 'default' : 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <Badge tone={completado ? 'success' : 'warn'}>
                              {completado ? 'Procesado' : 'Falta cerrar'}
                            </Badge>
                            <span style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                              {p.fecha?.split('-').reverse().join('/')}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, fontWeight: 800, fontSize: 'var(--sn-fs-md)', color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            vs {p.rival}
                          </div>
                          <div style={{ marginTop: 2, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-brand-glow)', fontWeight: 700, letterSpacing: 'var(--sn-tracking-wide)' }}>
                            CAT. {p.categoria} · {p.jugadoresConvocados?.length ?? 0} JUGADORES
                          </div>
                          {completado && p.resultadoFinal && (
                            <div style={{ marginTop: 6, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontFamily: 'var(--sn-font-mono)' }}>
                              {p.golesFavorFinal ?? 0} − {p.golesContraFinal ?? 0} · {p.resultadoFinal}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>

          {/* === EDITOR === */}
          {!partidoActivo ? (
            <Card variant="surface" style={{ borderStyle: 'dashed', borderWidth: 1 }}>
              <CardBody>
                <EmptyState
                  icon="◎"
                  title="Selecciona un partido pendiente"
                  description="Haz clic en una tarjeta amarilla para registrar resultado y otorgar medallas."
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                {/* Score final */}
                <Section title="1. Resultado final" action={<Badge tone={resultadoLive.tone}>{resultadoLive.label}</Badge>}>
                  <div style={scoreWrapStyle}>
                    <div style={{ flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <h4 style={teamLabelStyle}>FC SECHURA</h4>
                    </div>
                    <input type="number" min="0" value={scoreFinal.favor}
                      onChange={(e) => setScoreFinal({ ...scoreFinal, favor: Number(e.target.value) })}
                      className="sn-focusable" style={scoreInputStyle} />
                    <span style={{ color: 'var(--sn-text-muted)', fontFamily: 'var(--sn-font-display)', fontWeight: 900, fontSize: 'var(--sn-fs-2xl)' }}>−</span>
                    <input type="number" min="0" value={scoreFinal.contra}
                      onChange={(e) => setScoreFinal({ ...scoreFinal, contra: Number(e.target.value) })}
                      className="sn-focusable" style={scoreInputStyle} />
                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <h4 style={{ ...teamLabelStyle, color: 'var(--sn-text-secondary)' }} title={partidoActivo.rival}>{partidoActivo.rival}</h4>
                    </div>
                  </div>
                </Section>

                {/* Stats individuales */}
                <Section title="2. Estadísticas y logros individuales">
                  <div className="sn-scroll" style={{ maxHeight: 460, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-2)' }}>
                    {statsJugadores.map((j) => (
                      <div key={j.id} style={playerRowStyle}>
                        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.apellido}</div>
                          <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>{j.nombre}</div>
                        </div>

                        <Counter label="GOL" value={j.goles}       onMinus={() => actualizarStat(j.id, 'goles', -1)}       onPlus={() => actualizarStat(j.id, 'goles', 1)} tone="brand" />
                        <Counter label="AST" value={j.asistencias} onMinus={() => actualizarStat(j.id, 'asistencias', -1)} onPlus={() => actualizarStat(j.id, 'asistencias', 1)} tone="success" />

                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                          {CATALOGO_MEDALLAS.map((m) => {
                            const activa = j.medallas.includes(m.id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => toggleMedalla(j.id, m.id)}
                                title={m.label}
                                className="sn-focusable"
                                style={{
                                  width: 38, height: 38, borderRadius: '50%',
                                  background: activa ? `color-mix(in srgb, ${m.color} 18%, transparent)` : 'var(--sn-input-bg)',
                                  border: `2px solid ${activa ? m.color : 'var(--sn-border-soft)'}`,
                                  color: activa ? m.color : 'var(--sn-text-muted)',
                                  cursor: 'pointer',
                                  fontSize: 16,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  transform: activa ? 'translateY(-2px) scale(1.08)' : 'none',
                                  boxShadow: activa ? `0 0 16px color-mix(in srgb, ${m.color} 40%, transparent)` : 'none',
                                  transition: 'all var(--sn-dur-fast) var(--sn-ease)',
                                }}
                              >
                                {m.icon}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <div style={{ borderTop: '1px solid var(--sn-border-faint)', paddingTop: 'var(--sn-space-4)' }}>
                  <Button variant="success" size="lg" onClick={() => setConfirmarOpen(true)}
                    style={{ width: '100%' }} icon={<LockIcon />}>
                    Cerrar partido y enviar stats al portal
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* === Modal confirmar cierre === */}
      <Modal
        open={confirmarOpen}
        onClose={() => !cerrando && setConfirmarOpen(false)}
        size="md"
        title="¿Confirmar cierre del partido?"
        description={partidoActivo ? `vs ${partidoActivo.rival} · ${scoreFinal.favor} − ${scoreFinal.contra}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmarOpen(false)} disabled={cerrando}>Conservar</Button>
            <Button variant="success" onClick={finalizarPartido} loading={cerrando} icon={<LockIcon />}>Cerrar partido</Button>
          </>
        }
      >
        <div style={efectoStyle}>
          <div style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-success)', marginBottom: 'var(--sn-space-2)' }}>
            EFECTO EN PERFILES
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--sn-text-secondary)', fontSize: 'var(--sn-fs-sm)', lineHeight: 1.7 }}>
            <li>+1 partido jugado para todos los convocados.</li>
            <li>Goles y asistencias suman a los acumulados históricos.</li>
            <li>Las medallas otorgadas se agregan a la vitrina del jugador.</li>
            <li>El portal público se actualiza automáticamente.</li>
          </ul>
        </div>
      </Modal>

      <style>{`
        @media (max-width: 991.98px) {
          .sn-scout-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

const Section = ({ title, action, children }) => (
  <section style={{ marginBottom: 'var(--sn-space-5)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sn-space-3)' }}>
      <h4 style={{ margin: 0, fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-text-muted)' }}>{title}</h4>
      {action}
    </div>
    {children}
  </section>
);

const Counter = ({ label, value, onMinus, onPlus, tone = 'brand' }) => {
  const c = { brand: 'var(--sn-brand-glow)', success: 'var(--sn-success)' }[tone];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 6px',
      background: 'var(--sn-input-bg)',
      border: '1px solid var(--sn-border-soft)',
      borderRadius: 'var(--sn-radius-pill)',
    }}>
      <button onClick={onMinus} className="sn-focusable" style={{ ...counterBtnStyle, background: 'var(--sn-track-bg)', color: 'var(--sn-text-muted)' }}>−</button>
      <span style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 900, color: 'var(--sn-text-primary)', minWidth: 26, textAlign: 'center' }}>{value}</span>
      <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, color: 'var(--sn-text-muted)', letterSpacing: 'var(--sn-tracking-wide)', marginRight: 4 }}>{label}</span>
      <button onClick={onPlus} className="sn-focusable" style={{ ...counterBtnStyle, background: c, color: 'var(--sn-text-on-accent)' }}>+</button>
    </div>
  );
};

const LockIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>);

const pageBg = { minHeight: 'calc(100vh - var(--sn-navbar-h))', background: 'var(--sn-bg-mesh)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
const contentWrap = { maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)' };
const headerStyle = { marginBottom: 'var(--sn-space-5)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const leadStyle = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' };

const mainGridStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: 'var(--sn-space-5)', alignItems: 'start' };

const subLabelStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-text-muted)', textTransform: 'uppercase' };

const matchCardStyle = {
  padding: 'var(--sn-space-3) var(--sn-space-4)',
  background: 'var(--sn-bg-elevated)',
  border: '1px solid var(--sn-border-faint)',
  borderLeft: '4px solid',
  borderRadius: 'var(--sn-radius-md)',
  transition: 'all var(--sn-dur-fast) var(--sn-ease)',
};

const scoreWrapStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 'var(--sn-space-3)',
  padding: 'var(--sn-space-4)',
  background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(10,6,23,0.55) 100%)',
  border: '1px solid var(--sn-border-glow)',
  borderRadius: 'var(--sn-radius-lg)',
};

const teamLabelStyle = { margin: 0, fontFamily: 'var(--sn-font-display)', fontWeight: 800, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-md)' };

const scoreInputStyle = {
  width: 80, padding: '0.5rem 0',
  background: 'var(--sn-bg-elevated)',
  border: '1px solid var(--sn-border-soft)',
  color: 'var(--sn-text-primary)',
  borderRadius: 'var(--sn-radius-md)',
  fontFamily: 'var(--sn-font-display)',
  fontSize: 'var(--sn-fs-2xl)',
  fontWeight: 900, textAlign: 'center',
  outline: 'none',
};

const playerRowStyle = {
  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sn-space-3)',
  padding: 'var(--sn-space-3) var(--sn-space-4)',
  background: 'var(--sn-row-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const counterBtnStyle = {
  width: 26, height: 26, borderRadius: '50%',
  border: 'none', cursor: 'pointer',
  fontWeight: 900, fontSize: 14,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const efectoStyle = {
  background: 'rgba(16,185,129,0.06)',
  border: '1px solid rgba(16,185,129,0.30)',
  borderRadius: 'var(--sn-radius-md)',
  padding: 'var(--sn-space-4)',
};

export default ScoutingPartidos;
