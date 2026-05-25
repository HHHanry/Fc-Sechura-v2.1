import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAlumnos } from '../hooks/useAlumnos';
import { useAuth } from '../context/useAuth';
import { useCanteraDeAlumno, useCanteraAll, mutarCantera } from '../hooks/useCantera';
import { useCompetenciasDeAlumno } from '../hooks/useCompetencias';
import { toast } from '../hooks/useToast';
import {
  Card, CardBody, Button, Badge, EmptyState, Skeleton,
} from '../components/ui';
import {
  POTENCIAL, ALERTAS_CANTERA, CATEGORIAS,
  NIVELES_COMPETENCIA, COMPETENCIAS_POR_POSICION,
  calculateOVR, getPlayerTier, STAT_KEYS,
} from '../config/businessRules';

/* ========================================================
   FASE 4 — Cantera y proyección
   Ruta: /cantera (?alumno=<id> opcional)
   Panel de identificación de promesas, potencial y alertas.
   ======================================================== */

const FILTROS_POTENCIAL = [
  { value: 'todos', label: 'Todos' },
  ...POTENCIAL.map((p) => ({ value: p.value, label: p.label })),
];

const FILTROS_CATEGORIA = [
  { value: 'todas', label: 'Todas las cat.' },
  ...CATEGORIAS.map((c) => ({ value: c, label: `Cat. ${c}` })),
];

const CateraProyeccion = () => {
  const { user } = useAuth();
  const { alumnos, loading: loadingAlumnos } = useAlumnos();
  const { registros, loading: loadingReg } = useCanteraAll();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const alumnoState = location.state?.alumno;

  const [vista, setVista]               = useState('panel'); // panel | evaluar
  const [busqueda, setBusqueda]         = useState('');
  const [alumnoId, setAlumnoId]         = useState(searchParams.get('alumno') ?? alumnoState?.id ?? '');
  const [filtroPotencial, setFiltroPotencial] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  // Evaluación individual
  const [potencial, setPotencial]       = useState('');
  const [alertas, setAlertas]           = useState([]);
  const [notas, setNotas]               = useState('');
  const [guardando, setGuardando]       = useState(false);
  const [dirty, setDirty]               = useState(false);

  const { cantera, loading: loadingCantera } = useCanteraDeAlumno(alumnoId || null);
  const { competencias }                     = useCompetenciasDeAlumno(alumnoId || null);

  const alumno = useMemo(
    () => alumnos.find((a) => a.id === alumnoId) ?? null,
    [alumnos, alumnoId],
  );

  useEffect(() => {
    if (alumnoId) setSearchParams({ alumno: alumnoId }, { replace: true });
    else setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId]);

  useEffect(() => {
    if (cantera) {
      setPotencial(cantera.potencial ?? '');
      setAlertas(cantera.alertas ?? []);
      setNotas(cantera.notas ?? '');
    } else {
      setPotencial('');
      setAlertas([]);
      setNotas('');
    }
    setDirty(false);
  }, [cantera]);

  useEffect(() => {
    if (alumnoId) setVista('evaluar');
  }, [alumnoId]);

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
    setVista('evaluar');
  };

  const toggleAlerta = (alerta) => {
    setAlertas((prev) =>
      prev.includes(alerta) ? prev.filter((a) => a !== alerta) : [...prev, alerta]
    );
    setDirty(true);
  };

  const guardar = async () => {
    if (!alumnoId) return toast.error('Selecciona un jugador primero.');
    if (!potencial) return toast.error('Selecciona un nivel de potencial.');
    setGuardando(true);
    try {
      await mutarCantera.guardar(alumnoId, {
        alumnoId,
        potencial,
        alertas,
        notas: notas.trim(),
        evaluador: user?.nombre ?? user?.email ?? 'staff',
      });
      toast.success('Proyección guardada.');
      setDirty(false);
    } catch {
      toast.error('Error al guardar la proyección.');
    } finally {
      setGuardando(false);
    }
  };

  // Panel: enriquecer registros con datos de alumno
  const panelData = useMemo(() => {
    if (loadingReg || loadingAlumnos) return [];
    const alumnoMap = {};
    alumnos.forEach((a) => { alumnoMap[a.id] = a; });
    return registros
      .map((r) => {
        const al = alumnoMap[r.alumnoId];
        if (!al) return null;
        return { ...r, alumno: al };
      })
      .filter(Boolean)
      .filter((r) => filtroPotencial === 'todos' || r.potencial === filtroPotencial)
      .filter((r) => filtroCategoria === 'todas' || r.alumno.categoria === filtroCategoria);
  }, [registros, alumnos, loadingReg, loadingAlumnos, filtroPotencial, filtroCategoria]);

  // Datos de contexto del alumno seleccionado
  const alumnoOVR = useMemo(() => {
    if (!alumno) return null;
    const stats = {};
    STAT_KEYS.forEach((k) => { stats[k] = Number(alumno[k]) || 0; });
    const ovr = calculateOVR(stats);
    return ovr > 0 ? { ovr, tier: getPlayerTier(ovr) } : null;
  }, [alumno]);

  const compResumen = useMemo(() => {
    if (!competencias?.competencias || !competencias.posicion) return null;
    const comps = COMPETENCIAS_POR_POSICION[competencias.posicion] ?? [];
    const vals = comps.map((c) => competencias.competencias[c] ?? 0).filter((v) => v > 0);
    if (vals.length === 0) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const nivel = NIVELES_COMPETENCIA.slice().reverse().find((n) => avg >= n.value);
    return { posicion: competencias.posicion, avg, nivel };
  }, [competencias]);

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        <header style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <span style={eyebrowStyle}>DEPORTIVO · PROYECCIÓN</span>
            <h1 style={titleStyle}>Cantera y proyección</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="sm"
              variant={vista === 'panel' ? 'primary' : 'secondary'}
              onClick={() => setVista('panel')}
            >
              Panel
            </Button>
            <Button
              size="sm"
              variant={vista === 'evaluar' ? 'primary' : 'secondary'}
              onClick={() => setVista('evaluar')}
            >
              Evaluar
            </Button>
          </div>
        </header>

        {vista === 'panel' ? (
          /* ====== VISTA PANEL ====== */
          <div>
            <div style={filtersRowStyle}>
              <select
                value={filtroPotencial}
                onChange={(e) => setFiltroPotencial(e.target.value)}
                className="sn-focusable"
                style={selectStyle}
              >
                {FILTROS_POTENCIAL.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="sn-focusable"
                style={selectStyle}
              >
                {FILTROS_CATEGORIA.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {(loadingReg || loadingAlumnos) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 80 }} />)}
              </div>
            ) : panelData.length === 0 ? (
              <Card>
                <CardBody>
                  <EmptyState
                    title="Sin evaluaciones de cantera"
                    description="Evalúa jugadores desde la pestaña 'Evaluar' para verlos aquí."
                  />
                </CardBody>
              </Card>
            ) : (
              <div className="sn-cantera-grid">
                {panelData.map((r) => (
                  <PlayerCanteraCard
                    key={r.alumnoId}
                    registro={r}
                    onSelect={() => { setAlumnoId(r.alumnoId); setVista('evaluar'); }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ====== VISTA EVALUAR ====== */
          <div className="sn-cantera-layout">
            <div className="sn-cantera-main">
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
                                  Cat. {a.categoria ?? '—'}
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

              {alumnoId ? (
                loadingCantera ? (
                  <Card><CardBody><Skeleton style={{ height: 260 }} /></CardBody></Card>
                ) : (
                  <>
                    {/* Potencial */}
                    <Card>
                      <CardBody>
                        <span style={subLabelStyle}>Nivel de potencial</span>
                        <div style={potencialGridStyle}>
                          {POTENCIAL.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              className={`sn-cantera-pot-btn sn-focusable ${potencial === p.value ? 'is-active' : ''}`}
                              onClick={() => { setPotencial(p.value); setDirty(true); }}
                              style={potencial === p.value ? { borderColor: p.color, background: `color-mix(in srgb, ${p.color} 15%, transparent)` } : {}}
                            >
                              <PotencialIcon level={p.value} />
                              <span style={{ fontWeight: 700 }}>{p.label}</span>
                            </button>
                          ))}
                        </div>
                      </CardBody>
                    </Card>

                    {/* Alertas */}
                    <Card>
                      <CardBody>
                        <span style={subLabelStyle}>Alertas de cantera</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                          {ALERTAS_CANTERA.map((alerta) => (
                            <button
                              key={alerta}
                              type="button"
                              className={`sn-cantera-alerta-chip sn-focusable ${alertas.includes(alerta) ? 'is-active' : ''}`}
                              onClick={() => toggleAlerta(alerta)}
                            >
                              {alertas.includes(alerta) ? '✓ ' : ''}{alerta}
                            </button>
                          ))}
                        </div>
                      </CardBody>
                    </Card>

                    {/* Notas + Guardar */}
                    <Card>
                      <CardBody>
                        <span style={subLabelStyle}>Observaciones del formador</span>
                        <textarea
                          value={notas}
                          onChange={(e) => { setNotas(e.target.value); setDirty(true); }}
                          placeholder="Aspectos destacados, actitud, proyección a futuro…"
                          rows={4}
                          className="sn-focusable"
                          style={{ ...inputStyle, resize: 'vertical', minHeight: 90, marginTop: 8 }}
                        />
                        <Button
                          variant="success"
                          loading={guardando}
                          onClick={guardar}
                          disabled={!dirty || !potencial}
                          style={{ width: '100%', marginTop: 12 }}
                        >
                          Guardar proyección
                        </Button>
                      </CardBody>
                    </Card>
                  </>
                )
              ) : (
                <Card>
                  <CardBody>
                    <EmptyState
                      title="Selecciona un jugador"
                      description="Busca a un alumno arriba para evaluar su potencial y proyección."
                    />
                  </CardBody>
                </Card>
              )}
            </div>

            {/* Sidebar: contexto del jugador */}
            <aside className="sn-cantera-side sn-scroll">
              {alumno && (
                <>
                  <Card>
                    <CardBody>
                      <span style={subLabelStyle}>Contexto deportivo</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                        <ContextRow label="Categoría" value={alumno.categoria ? `Cat. ${alumno.categoria}` : '—'} />
                        {alumnoOVR && (
                          <ContextRow
                            label="OVR FIFA"
                            value={alumnoOVR.ovr}
                            badge={<Badge tone={alumnoOVR.tier.label === 'ÉLITE' ? 'elite' : alumnoOVR.tier.label === 'ORO' ? 'warn' : 'neutral'} size="sm">{alumnoOVR.tier.label}</Badge>}
                          />
                        )}
                        {compResumen && (
                          <ContextRow
                            label="Competencias"
                            value={`${compResumen.nivel?.label ?? '—'} (${compResumen.avg.toFixed(1)})`}
                          />
                        )}
                        <ContextRow label="Última eval." value={alumno.ultimaEvaluacion ?? 'Sin evaluar'} />
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <span style={subLabelStyle}>Accesos rápidos</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                        <Link to={`/perfil-alumno/${alumno.id}`} style={quickLinkStyle}>
                          Expediente completo →
                        </Link>
                        <Link to={`/competencias?alumno=${alumno.id}`} style={quickLinkStyle}>
                          Mapa de competencias →
                        </Link>
                        <Link to={`/misiones?alumno=${alumno.id}`} style={quickLinkStyle}>
                          Plan vivo →
                        </Link>
                      </div>
                    </CardBody>
                  </Card>
                </>
              )}

              <Card>
                <CardBody>
                  <span style={subLabelStyle}>Referencia de niveles</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {POTENCIAL.map((p) => (
                      <div key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)' }}>
                          {p.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </aside>
          </div>
        )}
      </div>

      <style>{`
        .sn-cantera-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: var(--sn-space-5);
          align-items: start;
        }
        .sn-cantera-main {
          display: flex; flex-direction: column;
          gap: var(--sn-space-3);
          min-width: 0;
        }
        .sn-cantera-side {
          display: flex; flex-direction: column;
          gap: var(--sn-space-3);
          position: sticky; top: 80px;
          max-height: calc(100vh - 100px);
          overflow-y: auto; overflow-x: hidden;
          padding-right: 4px;
        }

        .sn-cantera-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--sn-space-3);
        }

        .sn-cantera-pot-btn {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 14px 8px;
          border-radius: var(--sn-radius-md);
          background: var(--sn-bg-soft);
          border: 2px solid var(--sn-border-faint);
          color: var(--sn-text-secondary);
          font-family: var(--sn-font-ui);
          font-size: var(--sn-fs-sm);
          cursor: pointer;
          transition: all var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-cantera-pot-btn:hover { border-color: var(--sn-border-soft); }
        .sn-cantera-pot-btn.is-active {
          color: var(--sn-text-primary);
          font-weight: 800;
        }

        .sn-cantera-alerta-chip {
          display: inline-flex; align-items: center;
          padding: 6px 14px;
          border-radius: var(--sn-radius-pill);
          background: var(--sn-bg-soft);
          border: 1px solid var(--sn-border-faint);
          color: var(--sn-text-secondary);
          font-family: var(--sn-font-ui);
          font-size: var(--sn-fs-xs);
          font-weight: 700;
          cursor: pointer;
          transition: all var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-cantera-alerta-chip:hover { border-color: var(--sn-border-soft); }
        .sn-cantera-alerta-chip.is-active {
          background: color-mix(in srgb, var(--sn-brand-glow) 14%, transparent);
          border-color: color-mix(in srgb, var(--sn-brand-glow) 45%, transparent);
          color: var(--sn-brand-glow);
        }

        @media (max-width: 991.98px) {
          .sn-cantera-layout { grid-template-columns: 1fr !important; }
          .sn-cantera-side {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
            padding-right: 0;
          }
        }
        @media (max-width: 480px) {
          .sn-cantera-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

/* =============================================================
   Card de jugador en el panel
   ============================================================= */
const PlayerCanteraCard = ({ registro, onSelect }) => {
  const { alumno } = registro;
  const potInfo = POTENCIAL.find((p) => p.value === registro.potencial);
  const ovr = alumno.ovr ?? calculateOVR(
    Object.fromEntries(STAT_KEYS.map((k) => [k, Number(alumno[k]) || 0]))
  );
  const tier = ovr > 0 ? getPlayerTier(ovr) : null;

  return (
    <Card>
      <CardBody style={{ padding: 'var(--sn-space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={avatarStyle}>
            {(alumno.nombre?.[0] ?? '?').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-md)' }}>
              {alumno.nombre} {alumno.apellido}
            </div>
            <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', marginTop: 2 }}>
              Cat. {alumno.categoria ?? '—'}
              {tier && ` · OVR ${ovr}`}
            </div>
          </div>
          {potInfo && (
            <Badge
              tone={registro.potencial === 'elite' ? 'elite' : registro.potencial === 'alto' ? 'success' : registro.potencial === 'medio' ? 'info' : 'neutral'}
            >
              {potInfo.label}
            </Badge>
          )}
        </div>

        {registro.alertas?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
            {registro.alertas.map((a) => (
              <span key={a} style={alertChipSmall}>{a}</span>
            ))}
          </div>
        )}

        {registro.notas && (
          <div style={{ marginTop: 8, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
            "{registro.notas.length > 100 ? registro.notas.slice(0, 100) + '…' : registro.notas}"
          </div>
        )}

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" onClick={onSelect}>Ver / Editar</Button>
        </div>
      </CardBody>
    </Card>
  );
};

/* =============================================================
   Componentes auxiliares
   ============================================================= */
const ContextRow = ({ label, value, badge }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <span style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontWeight: 700 }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 700, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)' }}>{value}</span>
      {badge}
    </div>
  </div>
);

const PotencialIcon = ({ level }) => {
  const fills = { bajo: 1, medio: 2, alto: 3, elite: 4 };
  const count = fills[level] ?? 1;
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            width: 8, height: 20 + i * 4,
            borderRadius: 3,
            background: i <= count
              ? (POTENCIAL.find((p) => p.value === level)?.color ?? 'var(--sn-text-dim)')
              : 'var(--sn-border-faint)',
            transition: 'background var(--sn-dur-fast)',
          }}
        />
      ))}
    </div>
  );
};

/* =============================================================
   Estilos
   ============================================================= */
const pageBg = { minHeight: 'calc(100vh - 73px)', background: 'var(--sn-bg-base)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
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

const selectStyle = {
  ...inputStyle,
  width: 'auto', minWidth: 140,
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2.5\'><path d=\'m6 9 6 6 6-6\'/></svg>")',
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center',
  paddingRight: '2rem',
};

const filtersRowStyle = {
  display: 'flex', gap: 10, flexWrap: 'wrap',
  marginBottom: 'var(--sn-space-4)',
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
  background: 'var(--sn-brand-gradient)', color: '#06121A',
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

const potencialGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8, marginTop: 10,
};

const alertChipSmall = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'color-mix(in srgb, var(--sn-warn) 12%, transparent)',
  border: '1px solid color-mix(in srgb, var(--sn-warn) 35%, transparent)',
  fontSize: 'var(--sn-fs-xs)',
  color: 'var(--sn-warn)',
  fontWeight: 700,
};

const quickLinkStyle = {
  display: 'block',
  padding: '8px 12px',
  borderRadius: 'var(--sn-radius-md)',
  background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)',
  color: 'var(--sn-brand-glow)',
  fontSize: 'var(--sn-fs-sm)',
  fontWeight: 700,
  textDecoration: 'none',
  transition: 'background var(--sn-dur-fast)',
};

export default CateraProyeccion;
