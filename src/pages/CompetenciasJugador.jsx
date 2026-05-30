import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useAlumnos } from '../hooks/useAlumnos';
import { useAuth } from '../context/useAuth';
import { useCompetenciasDeAlumno, mutarCompetencias } from '../hooks/useCompetencias';
import { toast } from '../hooks/useToast';
import {
  Card, CardBody, Button, Badge, EmptyState, Skeleton,
} from '../components/ui';
import {
  POSICIONES, COMPETENCIAS_POR_POSICION, NIVELES_COMPETENCIA,
} from '../config/businessRules';

/* ========================================================
   FASE 3 — Mapa de competencias por posición
   Ruta: /competencias (?alumno=<id> opcional)
   ======================================================== */

const POSICIONES_LIST = [
  { value: POSICIONES.PORTERO,   label: 'Portero',   icon: '🧤' },
  { value: POSICIONES.DEFENSA,   label: 'Defensa',   icon: '🛡️' },
  { value: POSICIONES.VOLANTE,   label: 'Volante',   icon: '⚙️' },
  { value: POSICIONES.DELANTERO, label: 'Delantero', icon: '⚡' },
];

const NIVEL_MAX = 4;

const CompetenciasJugador = () => {
  const { user } = useAuth();
  const { alumnos, loading: loadingAlumnos } = useAlumnos();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const alumnoState = location.state?.alumno;

  const [busqueda, setBusqueda]     = useState('');
  const [alumnoId, setAlumnoId]     = useState(searchParams.get('alumno') ?? alumnoState?.id ?? '');
  const [posicion, setPosicion]     = useState(POSICIONES.VOLANTE);
  const [niveles, setNiveles]       = useState({});
  const [notas, setNotas]           = useState('');
  const [guardando, setGuardando]   = useState(false);
  const [dirty, setDirty]           = useState(false);

  const { competencias, loading: loadingComp } = useCompetenciasDeAlumno(alumnoId || null);

  const alumno = useMemo(
    () => alumnos.find((a) => a.id === alumnoId) ?? null,
    [alumnos, alumnoId],
  );

  const competenciasPos = useMemo(() => COMPETENCIAS_POR_POSICION[posicion] ?? [], [posicion]);

  useEffect(() => {
    if (alumnoId) setSearchParams({ alumno: alumnoId }, { replace: true });
    else setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId]);

  useEffect(() => {
    if (competencias) {
      setPosicion(competencias.posicion ?? POSICIONES.VOLANTE);
      setNiveles(competencias.competencias ?? {});
      setNotas(competencias.notas ?? '');
    } else {
      setNiveles({});
      setNotas('');
    }
    setDirty(false);
  }, [competencias]);

  const alumnosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return [];
    return alumnos
      .filter((a) => `${a.nombre} ${a.apellido} ${a.dni}`.toLowerCase().includes(term))
      .slice(0, 12);
  }, [alumnos, busqueda]);

  const seleccionarAlumno = (a) => {
    setAlumnoId(a.id);
    setBusqueda('');
  };

  const setNivel = (comp, val) => {
    setNiveles((prev) => ({ ...prev, [comp]: val }));
    setDirty(true);
  };

  const guardar = async () => {
    if (!alumnoId) return toast.error('Selecciona un jugador primero.');
    setGuardando(true);
    try {
      await mutarCompetencias.guardar(alumnoId, {
        alumnoId,
        posicion,
        competencias: niveles,
        notas: notas.trim(),
        evaluador: user?.nombre ?? user?.email ?? 'staff',
      });
      toast.success('Evaluación guardada.');
      setDirty(false);
    } catch {
      toast.error('Error al guardar la evaluación.');
    } finally {
      setGuardando(false);
    }
  };

  const promedio = useMemo(() => {
    const vals = competenciasPos.map((c) => niveles[c] ?? 0).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [niveles, competenciasPos]);

  const nivelGlobal = useMemo(() => {
    if (promedio === 0) return null;
    return NIVELES_COMPETENCIA.slice().reverse().find((n) => promedio >= n.value) ?? NIVELES_COMPETENCIA[0];
  }, [promedio]);

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        <header style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <span style={eyebrowStyle}>DEPORTIVO · EVALUACIÓN</span>
            <h1 style={titleStyle}>Mapa de competencias</h1>
          </div>
        </header>

        <div className="sn-comp-layout">
          {/* === COLUMNA PRINCIPAL === */}
          <div className="sn-comp-main">
            {/* Buscador de alumno */}
            <Card>
              <CardBody>
                <span style={subLabelStyle}>Jugador</span>
                {alumno ? (
                  <div style={selectedPlayerStyle}>
                    <div style={avatarStyle}>
                      {(alumno.nombre?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)' }}>
                        {alumno.nombre} {alumno.apellido}
                      </div>
                      <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                        Cat. {alumno.categoria ?? '—'} · DNI {alumno.dni ?? '—'}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { setAlumnoId(''); setBusqueda(''); }}>
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="text" autoFocus
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder={loadingAlumnos ? 'Cargando alumnos…' : 'Buscar por nombre, apellido o DNI'}
                      className="sn-focusable"
                      style={inputStyle}
                    />
                    {alumnosFiltrados.length > 0 && (
                      <div style={dropdownStyle}>
                        {alumnosFiltrados.map((a) => (
                          <button
                            key={a.id} type="button"
                            onClick={() => seleccionarAlumno(a)}
                            className="sn-focusable"
                            style={dropdownRowStyle}
                          >
                            <div style={{ ...avatarStyle, width: 30, height: 30, fontSize: 12 }}>
                              {(a.nombre?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                              <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-sm)' }}>
                                {a.nombre} {a.apellido}
                              </div>
                              <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                                Cat. {a.categoria ?? '—'} · DNI {a.dni ?? '—'}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Selector de posición */}
            <Card>
              <CardBody>
                <span style={subLabelStyle}>Posición a evaluar</span>
                <div style={posGridStyle}>
                  {POSICIONES_LIST.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className={`sn-comp-pos-btn sn-focusable ${posicion === p.value ? 'is-active' : ''}`}
                      onClick={() => { setPosicion(p.value); setDirty(true); }}
                    >
                      <span style={{ fontSize: 20 }}>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Radar + sliders */}
            {alumnoId ? (
              loadingComp ? (
                <Card><CardBody><Skeleton style={{ height: 300 }} /></CardBody></Card>
              ) : (
                <Card>
                  <CardBody>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sn-space-3)' }}>
                      <span style={subLabelStyle}>Evaluación — {POSICIONES_LIST.find((p) => p.value === posicion)?.label}</span>
                      {nivelGlobal && (
                        <Badge tone={promedio >= 3.5 ? 'elite' : promedio >= 2.5 ? 'brand' : promedio >= 1.5 ? 'info' : 'neutral'}>
                          {nivelGlobal.label} ({promedio.toFixed(1)})
                        </Badge>
                      )}
                    </div>

                    <div className="sn-comp-eval-grid">
                      <div className="sn-comp-radar-wrap">
                        <RadarChart competencias={competenciasPos} niveles={niveles} maxLevel={NIVEL_MAX} />
                      </div>

                      <div className="sn-comp-sliders">
                        {competenciasPos.map((comp) => (
                          <CompetenciaSlider
                            key={comp}
                            label={comp}
                            value={niveles[comp] ?? 0}
                            onChange={(v) => setNivel(comp, v)}
                          />
                        ))}

                        <div style={{ marginTop: 'var(--sn-space-3)' }}>
                          <span style={subLabelStyle}>Notas del evaluador</span>
                          <textarea
                            value={notas}
                            onChange={(e) => { setNotas(e.target.value); setDirty(true); }}
                            placeholder="Observaciones, aspectos a mejorar…"
                            rows={3}
                            className="sn-focusable"
                            style={{ ...inputStyle, resize: 'vertical', minHeight: 80, marginTop: 6 }}
                          />
                        </div>

                        <Button
                          variant="success"
                          loading={guardando}
                          onClick={guardar}
                          disabled={!dirty}
                          style={{ width: '100%', marginTop: 'var(--sn-space-3)' }}
                        >
                          Guardar evaluación
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )
            ) : (
              <Card>
                <CardBody>
                  <EmptyState
                    title="Selecciona un jugador"
                    description="Busca a un alumno arriba para evaluar sus competencias por posición."
                  />
                </CardBody>
              </Card>
            )}
          </div>

          {/* === SIDEBAR: Leyenda + historial === */}
          <aside className="sn-comp-side sn-scroll">
            <Card>
              <CardBody>
                <span style={subLabelStyle}>Niveles de competencia</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {NIVELES_COMPETENCIA.map((n) => (
                    <div key={n.value} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: n.color, flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)' }}>
                          {n.value}. {n.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <span style={subLabelStyle}>Competencias por posición</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                  {POSICIONES_LIST.map((p) => (
                    <div key={p.value}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)', marginBottom: 4 }}>
                        {p.icon} {p.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(COMPETENCIAS_POR_POSICION[p.value] ?? []).map((c) => (
                          <span key={c} style={chipStyle}>{c}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {alumno && competencias && (
              <Card>
                <CardBody>
                  <span style={subLabelStyle}>Última evaluación</span>
                  <div style={{ marginTop: 8, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-secondary)' }}>
                    <div><strong>Posición:</strong> {POSICIONES_LIST.find((p) => p.value === competencias.posicion)?.label ?? competencias.posicion}</div>
                    <div><strong>Evaluador:</strong> {competencias.evaluador ?? '—'}</div>
                    {competencias.notas && (
                      <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--sn-text-muted)' }}>
                        "{competencias.notas}"
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            )}
          </aside>
        </div>
      </div>

      <style>{`
        .sn-comp-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: var(--sn-space-5);
          align-items: start;
        }
        .sn-comp-main {
          display: flex; flex-direction: column;
          gap: var(--sn-space-3);
          min-width: 0;
        }
        .sn-comp-side {
          display: flex; flex-direction: column;
          gap: var(--sn-space-3);
          position: sticky; top: 80px;
          max-height: calc(100vh - 100px);
          overflow-y: auto; overflow-x: hidden;
          padding-right: 4px;
        }

        .sn-comp-eval-grid {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: var(--sn-space-4);
          align-items: start;
        }
        .sn-comp-radar-wrap {
          display: flex; align-items: center; justify-content: center;
          padding: var(--sn-space-2);
        }
        .sn-comp-sliders {
          display: flex; flex-direction: column;
          gap: var(--sn-space-3);
        }

        .sn-comp-pos-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px 8px; min-height: 60px;
          border-radius: var(--sn-radius-md);
          background: var(--sn-bg-soft);
          border: 2px solid var(--sn-border-faint);
          color: var(--sn-text-secondary);
          font-family: var(--sn-font-ui);
          font-weight: 700; font-size: var(--sn-fs-xs);
          cursor: pointer;
          transition: all var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-comp-pos-btn:hover { border-color: var(--sn-border-soft); background: var(--sn-row-soft); }
        .sn-comp-pos-btn.is-active {
          background: var(--sn-brand-gradient);
          border-color: transparent;
          color: var(--sn-text-on-brand);
        }

        @media (max-width: 991.98px) {
          .sn-comp-layout { grid-template-columns: 1fr !important; }
          .sn-comp-side {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
            padding-right: 0;
          }
        }
        .sn-comp-level-btn {
          width: 36px; height: 36px;
          border-radius: var(--sn-radius-sm);
          background: var(--sn-bg-surface);
          border: 2px solid var(--sn-border-soft);
          color: var(--sn-text-secondary);
          font-family: var(--sn-font-ui);
          font-weight: 800; font-size: var(--sn-fs-xs);
          cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all var(--sn-dur-fast) var(--sn-ease);
          flex-shrink: 0;
        }
        .sn-comp-level-btn:hover { border-color: var(--sn-text-muted); }
        .sn-comp-level-btn.is-active {
          color: var(--sn-text-on-accent);
          font-weight: 900;
          border-color: transparent;
        }
        .sn-comp-level-btn.is-empty {
          width: 36px;
          color: var(--sn-text-dim);
          font-size: 16px;
        }

        @media (max-width: 640px) {
          .sn-comp-eval-grid {
            grid-template-columns: 1fr !important;
          }
          .sn-comp-radar-wrap {
            max-width: 240px;
            margin: 0 auto;
          }
          .sn-comp-pos-btn {
            padding: 8px 4px;
            min-height: 52px;
          }
        }
      `}</style>
    </div>
  );
};

/* =============================================================
   RADAR CHART — SVG puro, sin dependencias
   ============================================================= */
const RadarChart = ({ competencias, niveles, maxLevel }) => {
  const n = competencias.length;
  if (n < 3) return null;

  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - 60) / 2;

  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const getPoint = (i, level) => {
    const angle = startAngle + i * angleStep;
    const r = (level / maxLevel) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const gridLevels = [1, 2, 3, 4];
  const values = competencias.map((c) => niveles[c] ?? 0);

  const dataPoints = values.map((v, i) => getPoint(i, v));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}>
      {/* Grid rings */}
      {gridLevels.map((level) => {
        const points = Array.from({ length: n }, (_, i) => getPoint(i, level));
        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
        return (
          <path
            key={level}
            d={path}
            fill="none"
            stroke="var(--sn-border-faint)"
            strokeWidth={level === maxLevel ? 1.5 : 0.8}
            opacity={level === maxLevel ? 0.6 : 0.35}
          />
        );
      })}

      {/* Axis lines */}
      {competencias.map((_, i) => {
        const outer = getPoint(i, maxLevel);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={outer.x} y2={outer.y}
            stroke="var(--sn-border-faint)"
            strokeWidth={0.7}
            opacity={0.4}
          />
        );
      })}

      {/* Data polygon */}
      {values.some((v) => v > 0) && (
        <path
          d={dataPath}
          fill="color-mix(in srgb, var(--sn-brand-glow) 25%, transparent)"
          stroke="var(--sn-brand-glow)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}

      {/* Data points */}
      {dataPoints.map((p, i) => values[i] > 0 && (
        <circle
          key={i}
          cx={p.x} cy={p.y} r={4}
          fill="var(--sn-brand-glow)"
          stroke="var(--sn-bg-surface)"
          strokeWidth={2}
        />
      ))}

      {/* Labels */}
      {competencias.map((comp, i) => {
        const labelPoint = getPoint(i, maxLevel + 0.7);
        const angle = startAngle + i * angleStep;
        const anchor = Math.abs(Math.cos(angle)) < 0.01
          ? 'middle'
          : Math.cos(angle) > 0 ? 'start' : 'end';
        const dy = Math.abs(Math.sin(angle)) < 0.01
          ? '0.35em'
          : Math.sin(angle) > 0 ? '1em' : '-0.3em';

        return (
          <text
            key={comp}
            x={labelPoint.x} y={labelPoint.y}
            textAnchor={anchor}
            dy={dy}
            fill="var(--sn-text-secondary)"
            fontSize={10}
            fontWeight={700}
            fontFamily="var(--sn-font-ui)"
          >
            {comp.length > 14 ? comp.slice(0, 12) + '…' : comp}
          </text>
        );
      })}
    </svg>
  );
};

/* =============================================================
   SLIDER POR COMPETENCIA
   ============================================================= */
const CompetenciaSlider = ({ label, value, onChange }) => {
  const nivelInfo = NIVELES_COMPETENCIA.find((n) => n.value === value);

  return (
    <div style={sliderRowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)' }}>
          {label}
        </span>
        {value > 0 && nivelInfo && (
          <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 700, color: nivelInfo.color }}>
            {nivelInfo.label}
          </span>
        )}
      </div>
      <div style={levelBtnsRow}>
        <button
          type="button"
          className={`sn-comp-level-btn sn-focusable ${value === 0 ? 'is-empty' : ''}`}
          onClick={() => onChange(0)}
          title="Sin evaluar"
        >
          —
        </button>
        {NIVELES_COMPETENCIA.map((n) => (
          <button
            key={n.value}
            type="button"
            className={`sn-comp-level-btn sn-focusable ${value === n.value ? 'is-active' : ''}`}
            onClick={() => onChange(n.value)}
            title={n.label}
            style={value === n.value ? { background: n.color, borderColor: n.color, color: 'var(--sn-text-on-accent)' } : {}}
          >
            {n.value}
          </button>
        ))}
      </div>
      <div style={barTrackStyle}>
        <div style={{
          ...barFillStyle,
          width: `${(value / NIVEL_MAX) * 100}%`,
          background: nivelInfo?.color ?? 'var(--sn-border-soft)',
        }} />
      </div>
    </div>
  );
};

/* =============================================================
   Estilos
   ============================================================= */
const pageBg = { minHeight: 'calc(100vh - var(--sn-navbar-h))', background: 'var(--sn-bg-mesh)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
const contentWrap = { maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-4) var(--sn-space-4) var(--sn-space-6)' };
const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sn-space-3)', flexWrap: 'wrap', marginBottom: 'var(--sn-space-4)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.2rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const subLabelStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-text-muted)', textTransform: 'uppercase' };

const inputStyle = {
  width: '100%', background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0.85rem', outline: 'none',
  minHeight: 44,
};

const selectedPlayerStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  marginTop: 8, padding: '10px 12px',
  background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const avatarStyle = {
  width: 36, height: 36, borderRadius: '50%',
  background: 'var(--sn-brand-gradient)', color: 'var(--sn-text-on-brand)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 900, fontSize: 14, flexShrink: 0,
};

const dropdownStyle = {
  marginTop: 4, border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)', background: 'var(--sn-bg-surface)',
  maxHeight: 280, overflow: 'auto',
  boxShadow: 'var(--sn-shadow-md)',
};

const dropdownRowStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
  padding: '0.55rem 0.75rem',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--sn-border-faint)',
  cursor: 'pointer', textAlign: 'left',
};

const posGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8, marginTop: 10,
};

const chipStyle = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)',
  fontSize: 'var(--sn-fs-xs)',
  color: 'var(--sn-text-muted)',
  fontWeight: 600,
};

const sliderRowStyle = {
  padding: '10px 12px',
  background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const levelBtnsRow = {
  display: 'flex', gap: 6,
};

const barTrackStyle = {
  marginTop: 8, height: 5,
  borderRadius: 3,
  background: 'var(--sn-border-faint)',
  overflow: 'hidden',
};

const barFillStyle = {
  height: '100%',
  borderRadius: 3,
  transition: 'width 0.3s ease, background 0.3s ease',
};

export default CompetenciasJugador;
