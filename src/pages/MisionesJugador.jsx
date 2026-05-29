import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAlumnos } from '../hooks/useAlumnos';
import { useAuth } from '../context/useAuth';
import { useMisionesDeAlumno, useMisionesAll, mutarMisiones } from '../hooks/useMisiones';
import { toast } from '../hooks/useToast';
import {
  Card, CardBody, Button, Badge, EmptyState, Modal, Skeleton, KpiCard,
} from '../components/ui';
import {
  MISION_AREAS_LIST, MISION_ESTADOS, MISION_ESTADOS_LIST, MISIONES_SUGERIDAS,
} from '../config/businessRules';

/* ========================================================
   FASE 2 — Plan vivo del jugador
   /misiones → Centro de mando del desarrollo individual.
     · Sin jugador: panel global (KPIs, distribución, ranking, actividad).
     · Con jugador (?alumno=<id>): vista enfocada + gestión de misiones.
   ======================================================== */

const FILTROS_ESTADO = [
  { value: 'todos', label: 'Todos' },
  ...MISION_ESTADOS_LIST.map((e) => ({ value: e.value, label: e.label })),
];

const FILTROS_AREA = [
  { value: 'todas', label: 'Todas las áreas' },
  ...MISION_AREAS_LIST.map((a) => ({ value: a.value, label: a.label })),
];

const AREA_COLOR = {
  tecnica: 'var(--sn-brand-glow)',
  fisica:  'var(--sn-success)',
  tactica: 'var(--sn-info)',
  mental:  'var(--sn-tier-elite)',
};

const ESTADO_TONE = {
  [MISION_ESTADOS.NO_LOGRADO]: 'neutral',
  [MISION_ESTADOS.EN_PROCESO]: 'warn',
  [MISION_ESTADOS.LOGRADO]:    'success',
  [MISION_ESTADOS.DESTACADO]:  'elite',
};

const esActiva   = (m) => m.estado === MISION_ESTADOS.NO_LOGRADO || m.estado === MISION_ESTADOS.EN_PROCESO;
const esLograda  = (m) => m.estado === MISION_ESTADOS.LOGRADO || m.estado === MISION_ESTADOS.DESTACADO;
const fechaHoyISO = () => new Date().toISOString().slice(0, 10);
const areaLabel  = (v) => MISION_AREAS_LIST.find((a) => a.value === v)?.label ?? v;

const MisionesJugador = () => {
  const { user } = useAuth();
  const { alumnos, loading: loadingAlumnos } = useAlumnos();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const alumnoState = location.state?.alumno;

  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [alumnoId, setAlumnoId]             = useState(searchParams.get('alumno') ?? alumnoState?.id ?? '');
  const [filtroArea, setFiltroArea]         = useState('todas');
  const [filtroEstado, setFiltroEstado]     = useState('todos');
  const [modalOpen, setModalOpen]           = useState(false);
  const [edicion, setEdicion]               = useState(null);

  // Filtros del panel global
  const [gCat, setGCat]       = useState('todas');
  const [gArea, setGArea]     = useState('todas');
  const [gEstado, setGEstado] = useState('todos');

  // Data: per-alumno (foco) + global (panel)
  const { misiones, loading: loadingMisiones } = useMisionesDeAlumno(alumnoId || null);
  const { misiones: todas, loading: loadingTodas } = useMisionesAll();

  const alumno = useMemo(
    () => alumnos.find((a) => a.id === alumnoId) ?? null,
    [alumnos, alumnoId],
  );

  const alumnoMap = useMemo(() => {
    const map = new Map();
    alumnos.forEach((a) => map.set(a.id, a));
    return map;
  }, [alumnos]);

  // Sincroniza URL cuando cambia el alumno
  useEffect(() => {
    if (alumnoId) setSearchParams({ alumno: alumnoId }, { replace: true });
    else setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId]);

  const alumnosFiltrados = useMemo(() => {
    const term = busquedaAlumno.trim().toLowerCase();
    if (!term) return [];
    return alumnos
      .filter((a) => `${a.nombre} ${a.apellido} ${a.dni}`.toLowerCase().includes(term))
      .slice(0, 12);
  }, [alumnos, busquedaAlumno]);

  /* ===== Categorías disponibles + filtrado del panel ===== */
  const categoriasConMisiones = useMemo(() => {
    const set = new Set();
    todas.forEach((m) => {
      const cat = alumnoMap.get(m.alumnoId)?.categoria ?? m.categoria;
      if (cat) set.add(cat);
    });
    return [...set].sort();
  }, [todas, alumnoMap]);

  const todasFiltradas = useMemo(() => todas.filter((m) => {
    const cat = alumnoMap.get(m.alumnoId)?.categoria ?? m.categoria;
    if (gCat !== 'todas' && cat !== gCat) return false;
    if (gArea !== 'todas' && m.area !== gArea) return false;
    if (gEstado !== 'todos' && m.estado !== gEstado) return false;
    return true;
  }), [todas, alumnoMap, gCat, gArea, gEstado]);

  const hayFiltrosGlobal = gCat !== 'todas' || gArea !== 'todas' || gEstado !== 'todos';
  const limpiarFiltrosGlobal = () => { setGCat('todas'); setGArea('todas'); setGEstado('todos'); };

  /* ===== Agregados globales (sobre el subconjunto filtrado) ===== */
  const global = useMemo(() => {
    const base = todasFiltradas;
    const total = base.length;
    const activas    = base.filter(esActiva).length;
    const logradas   = base.filter((m) => m.estado === MISION_ESTADOS.LOGRADO).length;
    const destacadas = base.filter((m) => m.estado === MISION_ESTADOS.DESTACADO).length;
    const completadas = logradas + destacadas;
    const tasaLogro = total > 0 ? Math.round((completadas / total) * 100) : 0;

    // Distribución por área
    const areas = MISION_AREAS_LIST.map((a) => {
      const enArea = base.filter((m) => m.area === a.value);
      return {
        value: a.value,
        label: a.label,
        color: AREA_COLOR[a.value],
        count: enArea.length,
        logradas: enArea.filter(esLograda).length,
      };
    });

    // Distribución por estado (donut)
    const estados = MISION_ESTADOS_LIST.map((e) => ({
      label: e.label,
      color: e.color,
      value: base.filter((m) => m.estado === e.value).length,
    })).filter((e) => e.value > 0);

    // Agregado por jugador
    const porJugador = new Map();
    base.forEach((m) => {
      if (!m.alumnoId) return;
      const cur = porJugador.get(m.alumnoId) ?? { id: m.alumnoId, total: 0, activas: 0, logradas: 0, destacadas: 0 };
      cur.total += 1;
      if (esActiva(m)) cur.activas += 1;
      if (m.estado === MISION_ESTADOS.LOGRADO) cur.logradas += 1;
      if (m.estado === MISION_ESTADOS.DESTACADO) cur.destacadas += 1;
      porJugador.set(m.alumnoId, cur);
    });
    const jugadores = [...porJugador.values()].map((j) => {
      const a = alumnoMap.get(j.id);
      const nombre = a ? `${a.nombre} ${a.apellido}` : (base.find((m) => m.alumnoId === j.id)?.alumnoNombre ?? 'Jugador');
      return {
        ...j,
        nombre,
        foto: a?.foto ?? null,
        categoria: a?.categoria ?? null,
        score: j.destacadas * 3 + j.logradas,
      };
    });

    const topJugadores = [...jugadores]
      .filter((j) => j.score > 0)
      .sort((a, b) => b.score - a.score || b.total - a.total)
      .slice(0, 5);

    const seguimiento = [...jugadores]
      .filter((j) => j.activas > 0)
      .sort((a, b) => b.activas - a.activas)
      .slice(0, 5);

    const recientes = base.slice(0, 7).map((m) => {
      const a = alumnoMap.get(m.alumnoId);
      return { ...m, nombre: a ? `${a.nombre} ${a.apellido}` : (m.alumnoNombre ?? 'Jugador') };
    });

    return {
      total, activas, logradas, destacadas, tasaLogro,
      jugadoresConPlan: porJugador.size,
      areas, estados, topJugadores, seguimiento, recientes,
    };
  }, [todasFiltradas, alumnoMap]);

  /* ===== Vista enfocada (con jugador) ===== */
  const misionesVisibles = useMemo(() => misiones
    .filter((m) => filtroArea === 'todas' || m.area === filtroArea)
    .filter((m) => filtroEstado === 'todos' || m.estado === filtroEstado),
  [misiones, filtroArea, filtroEstado]);

  const resumen = useMemo(() => {
    const activas = misiones.filter(esActiva);
    const ultimaLograda = misiones.find(esLograda);
    const conteoArea = {};
    misiones.forEach((m) => { if (m.area) conteoArea[m.area] = (conteoArea[m.area] ?? 0) + 1; });
    const areaTop = Object.entries(conteoArea).sort((a, b) => b[1] - a[1])[0]?.[0];
    const completadas = misiones.filter(esLograda).length;
    return {
      total:      misiones.length,
      activas:    activas.length,
      logradas:   misiones.filter((m) => m.estado === MISION_ESTADOS.LOGRADO).length,
      destacadas: misiones.filter((m) => m.estado === MISION_ESTADOS.DESTACADO).length,
      progreso:   misiones.length > 0 ? Math.round((completadas / misiones.length) * 100) : 0,
      ultimaLogradaDesc: ultimaLograda?.descripcion ?? null,
      areaTop,
    };
  }, [misiones]);

  const abrirNueva = () => { setEdicion(null); setModalOpen(true); };
  const abrirEdicion = (m) => { setEdicion(m); setModalOpen(true); };
  const seleccionar = (id) => { setAlumnoId(id); setBusquedaAlumno(''); };

  const handleSubmit = async (datos) => {
    try {
      if (edicion) {
        await mutarMisiones.actualizar(edicion.id, datos);
        toast.success('Misión actualizada.');
      } else {
        await mutarMisiones.crear({
          ...datos,
          alumnoId,
          alumnoNombre: alumno ? `${alumno.nombre} ${alumno.apellido}` : null,
          categoria:    alumno?.categoria ?? null,
          createdBy:    user?.nombre ?? user?.email ?? null,
        });
        toast.success('Misión asignada al jugador.');
      }
      setModalOpen(false);
      setEdicion(null);
    } catch {
      toast.error('No se pudo guardar la misión.');
    }
  };

  const cambiarEstado = async (m, nuevoEstado) => {
    try { await mutarMisiones.actualizar(m.id, { estado: nuevoEstado }); }
    catch { toast.error('No se pudo actualizar el estado.'); }
  };

  const eliminar = async (m) => {
    if (!window.confirm(`¿Eliminar la misión "${m.descripcion}"?`)) return;
    try {
      await mutarMisiones.eliminar(m.id);
      toast.success('Misión eliminada.');
    } catch {
      toast.error('No se pudo eliminar la misión.');
    }
  };

  return (
    <div style={pageBg}>
      <BackgroundFx />
      <div style={contentWrap}>
        <header style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <span style={eyebrowStyle}>DESARROLLO INDIVIDUAL · PLAN VIVO</span>
            <h1 style={titleStyle}>Misiones del jugador</h1>
            <p style={leadStyle}>
              {alumno
                ? 'Objetivos concretos por entrenamiento o semana y su seguimiento real.'
                : 'Centro de mando del desarrollo individual: el pulso de los objetivos de toda la academia.'}
            </p>
          </div>
          {alumno && (
            <Button variant="primary" size="lg" icon={<PlusIcon />} onClick={abrirNueva}>
              Nueva misión
            </Button>
          )}
        </header>

        {/* === SELECTOR DE ALUMNO === */}
        <Card style={{ marginBottom: 'var(--sn-space-5)' }}>
          <CardBody>
            <span style={subLabelStyle}>Jugador</span>
            {alumno ? (
              <div style={alumnoChipStyle}>
                <Avatar alumno={alumno} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: 'var(--sn-font-display)', fontWeight: 800, color: 'var(--sn-text-primary)' }}>
                    {alumno.nombre} {alumno.apellido}
                  </div>
                  <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                    Cat. {alumno.categoria ?? '—'} · DNI {alumno.dni ?? '—'}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setAlumnoId(''); setBusquedaAlumno(''); }}>
                  Ver panel global
                </Button>
              </div>
            ) : (
              <>
                <div style={{ ...searchWrapStyle, marginTop: 8 }}>
                  <SearchIcon />
                  <input
                    className="sn-focusable"
                    type="text"
                    value={busquedaAlumno}
                    onChange={(e) => setBusquedaAlumno(e.target.value)}
                    placeholder={loadingAlumnos ? 'Cargando alumnos…' : 'Buscar un jugador por nombre, apellido o DNI…'}
                    style={searchInputStyle}
                  />
                </div>

                {busquedaAlumno && (
                  <div style={resultsListStyle}>
                    {alumnosFiltrados.length === 0 ? (
                      <div style={{ padding: '0.6rem', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' }}>
                        Sin coincidencias.
                      </div>
                    ) : (
                      alumnosFiltrados.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => seleccionar(a.id)}
                          className="sn-focusable"
                          style={resultsItemStyle}
                        >
                          <Avatar alumno={a} small />
                          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)' }}>
                              {a.nombre} {a.apellido}
                            </div>
                            <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                              Cat. {a.categoria ?? '—'}
                            </div>
                          </div>
                          <ArrowRightIcon />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {/* === MODO PANEL GLOBAL === */}
        {!alumnoId && (
          <PanelGlobal
            data={global}
            loading={loadingTodas || loadingAlumnos}
            onSelect={seleccionar}
            totalSinFiltro={todas.length}
            categorias={categoriasConMisiones}
            filtros={{ cat: gCat, area: gArea, estado: gEstado }}
            setFiltros={{ setCat: setGCat, setArea: setGArea, setEstado: setGEstado }}
            hayFiltros={hayFiltrosGlobal}
            onLimpiar={limpiarFiltrosGlobal}
          />
        )}

        {/* === MODO ENFOCADO === */}
        {alumnoId && (
          <>
            <div style={resumenGridStyle} className="sn-misiones-resumen">
              <ResumenChip label="Total" value={resumen.total} tone="neutral" />
              <ResumenChip label="Activas" value={resumen.activas} tone="warn" />
              <ResumenChip label="Logradas" value={resumen.logradas} tone="success" />
              <ResumenChip label="Destacadas" value={resumen.destacadas} tone="elite" />
            </div>

            <Card style={{ marginTop: 'var(--sn-space-4)' }}>
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                  <span style={subLabelStyle}>Progreso del plan</span>
                  <span style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 800, color: 'var(--sn-success)' }}>{resumen.progreso}%</span>
                </div>
                <div style={trackStyle}>
                  <div style={{ ...barStyle, width: `${resumen.progreso}%`, background: 'var(--sn-success)' }} />
                </div>
                {(resumen.ultimaLogradaDesc || resumen.areaTop) && (
                  <div style={{ display: 'flex', gap: 'var(--sn-space-5)', flexWrap: 'wrap', marginTop: 'var(--sn-space-4)' }}>
                    {resumen.ultimaLogradaDesc && (
                      <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                        <span style={subLabelStyle}>Última lograda</span>
                        <div style={{ marginTop: 4, color: 'var(--sn-text-primary)', fontWeight: 700 }}>
                          “{resumen.ultimaLogradaDesc}”
                        </div>
                      </div>
                    )}
                    {resumen.areaTop && (
                      <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                        <span style={subLabelStyle}>Área más trabajada</span>
                        <div style={{ marginTop: 6 }}>
                          <Badge tone="brand">{areaLabel(resumen.areaTop)}</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card style={{ marginTop: 'var(--sn-space-4)' }}>
              <CardBody>
                <div style={filtrosBarStyle}>
                  <SelectFilter label="Área"   value={filtroArea}   onChange={setFiltroArea}   options={FILTROS_AREA} />
                  <SelectFilter label="Estado" value={filtroEstado} onChange={setFiltroEstado} options={FILTROS_ESTADO} />
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                    {loadingMisiones ? 'Cargando…' : `${misionesVisibles.length} misión(es)`}
                  </div>
                </div>
              </CardBody>
            </Card>

            <div style={{ marginTop: 'var(--sn-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
              {loadingMisiones ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={108} />)
              ) : misionesVisibles.length === 0 ? (
                <Card>
                  <CardBody>
                    <EmptyState
                      title="Sin misiones para este jugador"
                      description="Crea la primera con el botón “Nueva misión”."
                    />
                  </CardBody>
                </Card>
              ) : (
                misionesVisibles.map((m) => (
                  <MisionRow
                    key={m.id}
                    mision={m}
                    onCambiarEstado={cambiarEstado}
                    onEditar={abrirEdicion}
                    onEliminar={eliminar}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <MisionFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEdicion(null); }}
        onSubmit={handleSubmit}
        misionInicial={edicion}
        alumno={alumno}
      />

      <style>{`
        @media (max-width: 900px) {
          .sn-mis-grid-2 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .sn-misiones-resumen { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
};

/* ========================================================
   PANEL GLOBAL (sin jugador seleccionado)
   ======================================================== */

const PanelGlobal = ({ data, loading, onSelect, totalSinFiltro, categorias, filtros, setFiltros, hayFiltros, onLimpiar }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
        <Skeleton height={64} />
        <div style={kpiGridStyle}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={104} />)}
        </div>
        <div style={grid2Style} className="sn-mis-grid-2">
          <Skeleton height={240} /><Skeleton height={240} />
        </div>
      </div>
    );
  }

  // No hay ninguna misión cargada en todo el sistema
  if (totalSinFiltro === 0) {
    return (
      <Card>
        <CardBody style={{ padding: 'var(--sn-space-7)' }}>
          <EmptyState
            icon={<TargetIcon />}
            title="Aún no hay misiones en la academia"
            description="Busca un jugador arriba y asígnale su primer objetivo. A medida que el cuerpo técnico cargue misiones, este panel mostrará el pulso del desarrollo individual."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <FiltrosGlobal
        categorias={categorias}
        filtros={filtros}
        setFiltros={setFiltros}
        hayFiltros={hayFiltros}
        onLimpiar={onLimpiar}
        resultados={data.total}
      />

      {data.total === 0 ? (
        <Card>
          <CardBody style={{ padding: 'var(--sn-space-7)' }}>
            <EmptyState
              icon={<TargetIcon />}
              title="Sin coincidencias"
              description="Ninguna misión cumple los filtros seleccionados. Ajusta o limpia los filtros."
              action={hayFiltros ? <Button variant="secondary" size="sm" onClick={onLimpiar}>Limpiar filtros</Button> : undefined}
            />
          </CardBody>
        </Card>
      ) : (
      <>
      {/* KPIs */}
      <SectionHeader eyebrow="Vista rápida" title="Pulso del programa" />
      <div style={kpiGridStyle}>
        <KpiCard label="Misiones totales" value={data.total} icon={<TargetIcon />} hint="Cargadas en el sistema" accent="brand" />
        <KpiCard label="En progreso" value={data.activas} icon={<ClockIcon />} hint="Por lograr o en curso" accent="warn" />
        <KpiCard label="Logradas" value={data.logradas} icon={<CheckIcon />} hint="Objetivos cumplidos" accent="success" />
        <KpiCard label="Destacadas" value={data.destacadas} icon={<StarIcon />} hint="Por encima de lo esperado" accent="elite" />
        <KpiCard label="Tasa de logro" value={data.tasaLogro} suffix="%" icon={<TrendIcon />} hint="Logradas + destacadas" accent="success" />
        <KpiCard label="Jugadores con plan" value={data.jugadoresConPlan} icon={<UsersIcon />} hint="Con misiones asignadas" accent="brand" />
      </div>

      {/* Distribución */}
      <div style={{ marginTop: 'var(--sn-space-6)' }}>
        <SectionHeader eyebrow="Inteligencia" title="Distribución del trabajo" />
        <div style={grid2Style} className="sn-mis-grid-2">
          <Card>
            <CardBody style={{ padding: 0 }}>
              <PanelHead title="Por estado" subtitle="Cómo avanza el conjunto de objetivos" />
              <div style={{ padding: 'var(--sn-space-5)' }}>
                <EstadoDonut segments={data.estados} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody style={{ padding: 0 }}>
              <PanelHead title="Por área de desarrollo" subtitle="Dónde se concentra el foco técnico" />
              <div style={{ padding: 'var(--sn-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
                {data.areas.map((a) => (
                  <AreaBar key={a.value} area={a} max={data.total} />
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Ranking + seguimiento */}
      <div style={{ marginTop: 'var(--sn-space-6)' }}>
        <SectionHeader eyebrow="Jugadores" title="Quién destaca y quién necesita empuje" />
        <div style={grid2Style} className="sn-mis-grid-2">
          <Card>
            <CardBody style={{ padding: 0 }}>
              <PanelHead title="Top jugadores" subtitle="Por logros (destacadas pesan más)" icon={<TrophyIcon />} />
              <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5) var(--sn-space-5)' }}>
                {data.topJugadores.length === 0 ? (
                  <EmptyState title="Sin logros todavía" description="Cuando se completen misiones aparecerá el ranking." />
                ) : (
                  <ol style={listResetStyle}>
                    {data.topJugadores.map((j, i) => (
                      <li key={j.id}>
                        <button type="button" onClick={() => onSelect(j.id)} className="sn-focusable" style={playerRowStyle}>
                          <span style={rankBadgeStyle(i)}>{i + 1}</span>
                          <Avatar alumno={{ nombre: j.nombre, foto: j.foto }} small />
                          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                            <div style={playerNameStyle}>{j.nombre}</div>
                            <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                              {j.categoria ? `Cat. ${j.categoria} · ` : ''}{j.total} misión(es)
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {j.destacadas > 0 && <Badge tone="elite" size="sm">★ {j.destacadas}</Badge>}
                            <Badge tone="success" size="sm">✓ {j.logradas}</Badge>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody style={{ padding: 0 }}>
              <PanelHead title="Necesitan seguimiento" subtitle="Más misiones activas pendientes" icon={<FlagIcon />} tone="warn" />
              <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5) var(--sn-space-5)' }}>
                {data.seguimiento.length === 0 ? (
                  <EmptyState title="Todo al día" description="No hay misiones activas pendientes." />
                ) : (
                  <ol style={listResetStyle}>
                    {data.seguimiento.map((j) => (
                      <li key={j.id}>
                        <button type="button" onClick={() => onSelect(j.id)} className="sn-focusable" style={playerRowStyle}>
                          <Avatar alumno={{ nombre: j.nombre, foto: j.foto }} small />
                          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                            <div style={playerNameStyle}>{j.nombre}</div>
                            <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                              {j.categoria ? `Cat. ${j.categoria}` : 'Sin categoría'}
                            </div>
                          </div>
                          <Badge tone="warn" size="sm">{j.activas} activa(s)</Badge>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Actividad reciente */}
      <div style={{ marginTop: 'var(--sn-space-6)' }}>
        <SectionHeader eyebrow="Bitácora" title="Actividad reciente" />
        <Card>
          <CardBody style={{ padding: 0 }}>
            {data.recientes.length === 0 ? (
              <div style={{ padding: 'var(--sn-space-5)' }}>
                <EmptyState title="Sin actividad" description="No hay misiones recientes." />
              </div>
            ) : (
              <ul style={{ ...listResetStyle, gap: 0 }}>
                {data.recientes.map((m, i) => {
                  const area = MISION_AREAS_LIST.find((a) => a.value === m.area);
                  const estado = MISION_ESTADOS_LIST.find((e) => e.value === m.estado);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(m.alumnoId)}
                        className="sn-focusable"
                        style={{ ...activityRowStyle, borderTop: i === 0 ? 'none' : '1px solid var(--sn-border-faint)' }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: AREA_COLOR[m.area] ?? 'var(--sn-text-dim)', flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.descripcion}
                          </div>
                          <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                            {m.nombre}{area ? ` · ${area.label}` : ''}{m.fecha ? ` · ${m.fecha}` : ''}
                          </div>
                        </div>
                        {estado && <Badge tone={ESTADO_TONE[m.estado] ?? 'neutral'} size="sm">{estado.label}</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
      </>
      )}
    </>
  );
};

/* ========================================================
   Sub-componentes
   ======================================================== */

const FiltrosGlobal = ({ categorias, filtros, setFiltros, hayFiltros, onLimpiar, resultados }) => (
  <Card style={{ marginBottom: 'var(--sn-space-5)' }}>
    <CardBody>
      <div style={filtrosToolbarStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--sn-text-muted)', flexShrink: 0 }}>
          <FilterIcon />
          <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', textTransform: 'uppercase' }}>
            Filtrar panel
          </span>
        </span>

        <select value={filtros.cat} onChange={(e) => setFiltros.setCat(e.target.value)} className="sn-focusable" style={toolbarSelectStyle}>
          <option value="todas">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>Cat. {c}</option>)}
        </select>
        <select value={filtros.area} onChange={(e) => setFiltros.setArea(e.target.value)} className="sn-focusable" style={toolbarSelectStyle}>
          {FILTROS_AREA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filtros.estado} onChange={(e) => setFiltros.setEstado(e.target.value)} className="sn-focusable" style={toolbarSelectStyle}>
          {FILTROS_ESTADO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', whiteSpace: 'nowrap' }}>
            {resultados} misión(es)
          </span>
          {hayFiltros && (
            <button onClick={onLimpiar} className="sn-focusable" style={limpiarBtnStyle}>✕ Limpiar</button>
          )}
        </div>
      </div>
    </CardBody>
  </Card>
);

const SectionHeader = ({ eyebrow, title }) => (
  <header style={{ marginBottom: 'var(--sn-space-4)' }}>
    <span style={eyebrowStyle}>{eyebrow}</span>
    <h2 style={{ margin: '0.2rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-xl)', fontWeight: 700, color: 'var(--sn-text-primary)' }}>
      {title}
    </h2>
  </header>
);

const PanelHead = ({ title, subtitle, icon, tone = 'brand' }) => {
  const c = { brand: 'var(--sn-brand-glow)', warn: 'var(--sn-warn)', elite: 'var(--sn-tier-elite)' }[tone];
  return (
    <div style={panelHeadStyle}>
      {icon && (
        <span style={{ width: 32, height: 32, borderRadius: 'var(--sn-radius-sm)', background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`, flexShrink: 0 }}>
          {icon}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <h3 style={panelTitleStyle}>{title}</h3>
        {subtitle && <p style={panelSubtitleStyle}>{subtitle}</p>}
      </div>
    </div>
  );
};

/* Donut SVG local (centro etiquetado "MISIONES") */
const EstadoDonut = ({ segments, size = 168 }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <EmptyState title="Sin datos" description="No hay misiones para graficar." />;

  const r = 58, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const arcs = segments.filter((s) => s.value > 0).reduce((acc, seg) => {
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dashLen : 0;
    const dashLen = (seg.value / total) * circ;
    acc.push({ ...seg, dashLen, offset });
    return acc;
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sn-space-5)', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sn-border-faint)" strokeWidth={16} />
        {arcs.map((arc, i) => (
          <circle
            key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color} strokeWidth={16}
            strokeDasharray={`${arc.dashLen} ${circ - arc.dashLen}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '1.9rem', fontWeight: 800, fill: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-display)' }}>
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '0.6rem', fontWeight: 700, fill: 'var(--sn-text-muted)', letterSpacing: '0.1em' }}>
          MISIONES
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
        {arcs.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sn-fs-sm)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--sn-text-secondary)', flex: 1 }}>{seg.label}</span>
            <span style={{ fontWeight: 800, fontFamily: 'var(--sn-font-mono)', color: 'var(--sn-text-primary)' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AreaBar = ({ area, max }) => {
  const pct = max > 0 ? (area.count / max) * 100 : 0;
  const logroPct = area.count > 0 ? Math.round((area.logradas / area.count) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--sn-fs-sm)', fontWeight: 700, color: 'var(--sn-text-secondary)' }}>{area.label}</span>
        <span style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-sm)', fontWeight: 800, color: 'var(--sn-text-primary)' }}>
          {area.count} <span style={{ color: 'var(--sn-text-muted)', fontWeight: 600, fontSize: 'var(--sn-fs-xs)' }}>· {logroPct}% logrado</span>
        </span>
      </div>
      <div style={trackStyle}>
        <div style={{ ...barStyle, width: `${pct}%`, background: area.color }} />
      </div>
    </div>
  );
};

const Avatar = ({ alumno, small }) => {
  const size = small ? 34 : 44;
  const inicial = (alumno.nombre?.[0] ?? '?').toUpperCase();
  return alumno.foto ? (
    <img src={alumno.foto} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--sn-brand-gradient)', color: '#06121A',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: small ? 13 : 16, flexShrink: 0,
    }}>{inicial}</div>
  );
};

const ResumenChip = ({ label, value, tone }) => {
  const colors = {
    neutral: 'var(--sn-text-muted)', warn: 'var(--sn-warn)',
    success: 'var(--sn-success)', elite: 'var(--sn-tier-elite)',
  };
  return (
    <Card>
      <CardBody style={{ padding: 'var(--sn-space-3) var(--sn-space-4)' }}>
        <div style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: colors[tone], textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--sn-font-display)', fontWeight: 800, fontSize: 'var(--sn-fs-2xl)', color: 'var(--sn-text-primary)', lineHeight: 1 }}>
          {value}
        </div>
      </CardBody>
    </Card>
  );
};

const MisionRow = ({ mision: m, onCambiarEstado, onEditar, onEliminar }) => {
  const area   = MISION_AREAS_LIST.find((a) => a.value === m.area);
  const estado = MISION_ESTADOS_LIST.find((e) => e.value === m.estado);
  const estadoTone = ESTADO_TONE[m.estado] ?? 'neutral';

  return (
    <Card>
      <CardBody>
        <div style={{ display: 'flex', gap: 'var(--sn-space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {area   && <Badge tone="brand">{area.label}</Badge>}
              {estado && <Badge tone={estadoTone}>{estado.label}</Badge>}
              {m.fecha && <span style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>{m.fecha}</span>}
            </div>
            <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-md)' }}>
              {m.descripcion}
            </div>
            {m.comentario && (
              <div style={comentarioStyle}>
                <span style={{ fontWeight: 800, color: 'var(--sn-brand-glow)', letterSpacing: 'var(--sn-tracking-wide)', fontSize: 'var(--sn-fs-xs)' }}>
                  COMENTARIO
                </span>
                <div style={{ marginTop: 2 }}>{m.comentario}</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
            <div style={subLabelStyle}>Cambiar estado</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {MISION_ESTADOS_LIST.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => onCambiarEstado(m, e.value)}
                  className="sn-focusable"
                  style={estadoBtnStyle(m.estado === e.value, e.color)}
                  title={e.label}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <Button size="sm" variant="ghost" onClick={() => onEditar(m)} icon={<EditIcon />}>Editar</Button>
              <Button size="sm" variant="danger" onClick={() => onEliminar(m)} icon={<TrashIcon />}>Eliminar</Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

const SelectFilter = ({ label, value, onChange, options }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
    <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-wide)', color: 'var(--sn-text-muted)', textTransform: 'uppercase' }}>{label}</span>
    <select className="sn-focusable" value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
);

const MisionFormModal = ({ open, onClose, onSubmit, misionInicial, alumno }) => {
  const [datos, setDatos] = useState({
    descripcion: '', area: MISION_AREAS_LIST[0].value,
    estado: MISION_ESTADOS.NO_LOGRADO, comentario: '', fecha: fechaHoyISO(),
  });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDatos(misionInicial ? {
      descripcion: misionInicial.descripcion ?? '',
      area:        misionInicial.area ?? MISION_AREAS_LIST[0].value,
      estado:      misionInicial.estado ?? MISION_ESTADOS.NO_LOGRADO,
      comentario:  misionInicial.comentario ?? '',
      fecha:       misionInicial.fecha ?? fechaHoyISO(),
    } : {
      descripcion: '', area: MISION_AREAS_LIST[0].value,
      estado: MISION_ESTADOS.NO_LOGRADO, comentario: '', fecha: fechaHoyISO(),
    });
  }, [open, misionInicial]);

  const handle = async (e) => {
    e?.preventDefault?.();
    if (!datos.descripcion.trim()) return toast.error('Describe la misión.');
    setEnviando(true);
    try { await onSubmit(datos); }
    finally { setEnviando(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={misionInicial ? 'Editar misión' : 'Nueva misión'}
      description={alumno ? `Para ${alumno.nombre} ${alumno.apellido}` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button variant="primary" onClick={handle} loading={enviando}>
            {misionInicial ? 'Guardar cambios' : 'Asignar misión'}
          </Button>
        </>
      }
    >
      <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
        <FormField label="Descripción">
          <textarea
            value={datos.descripcion}
            onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
            rows={3}
            placeholder="Ej: Levantar la cabeza antes del pase"
            className="sn-focusable"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            autoFocus
          />
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {MISIONES_SUGERIDAS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDatos({ ...datos, descripcion: s })}
                className="sn-focusable"
                style={chipSugStyle}
              >
                {s}
              </button>
            ))}
          </div>
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sn-space-3)' }}>
          <FormField label="Área">
            <select value={datos.area} onChange={(e) => setDatos({ ...datos, area: e.target.value })} className="sn-focusable" style={selectStyle}>
              {MISION_AREAS_LIST.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </FormField>
          <FormField label="Estado">
            <select value={datos.estado} onChange={(e) => setDatos({ ...datos, estado: e.target.value })} className="sn-focusable" style={selectStyle}>
              {MISION_ESTADOS_LIST.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </FormField>
        </div>

        <FormField label="Fecha">
          <input type="date" value={datos.fecha} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} className="sn-focusable" style={inputStyle} />
        </FormField>

        <FormField label="Comentario del entrenador">
          <textarea
            value={datos.comentario}
            onChange={(e) => setDatos({ ...datos, comentario: e.target.value })}
            rows={2}
            placeholder="Ej: Mostró buena actitud en el rondo."
            className="sn-focusable"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
          />
        </FormField>
      </form>
    </Modal>
  );
};

const FormField = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-wide)', color: 'var(--sn-text-muted)', textTransform: 'uppercase' }}>{label}</span>
    {children}
  </label>
);

/* ========================================================
   Iconos
   ======================================================== */
const PlusIcon   = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>);
const SearchIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>);
const EditIcon   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>);
const TrashIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>);
const ArrowRightIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sn-text-muted)" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
const TargetIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>);
const ClockIcon  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
const CheckIcon  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>);
const StarIcon   = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
const TrendIcon  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>);
const UsersIcon  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const TrophyIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M5 4H3v3a3 3 0 0 0 3 3M19 4h2v3a3 3 0 0 1-3 3"/></svg>);
const FlagIcon   = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/></svg>);
const FilterIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>);

const BackgroundFx = () => (
  <div aria-hidden style={{
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: `radial-gradient(760px 460px at 0% 0%, color-mix(in srgb, var(--sn-brand-glow) 9%, transparent), transparent 60%)`,
  }} />
);

/* ========================================================
   Estilos
   ======================================================== */
const pageBg = { minHeight: 'calc(100vh - 73px)', background: 'var(--sn-bg-base)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)', position: 'relative' };
const contentWrap = { position: 'relative', maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)' };
const headerStyle = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--sn-space-4)', flexWrap: 'wrap', marginBottom: 'var(--sn-space-5)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const leadStyle = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)', maxWidth: 640 };

const subLabelStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-text-muted)', textTransform: 'uppercase' };

const kpiGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sn-space-4)' };
const grid2Style = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sn-space-5)', alignItems: 'start' };

const panelHeadStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: 'var(--sn-space-5)', borderBottom: '1px solid var(--sn-border-faint)',
};
const panelTitleStyle = { margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const panelSubtitleStyle = { margin: '0.2rem 0 0', fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-muted)' };

const trackStyle = { height: 10, borderRadius: 'var(--sn-radius-pill)', background: 'var(--sn-track-bg)', overflow: 'hidden' };
const barStyle = { height: '100%', borderRadius: 'var(--sn-radius-pill)', transition: 'width var(--sn-dur-slow) var(--sn-ease)' };

const listResetStyle = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-2)' };

const playerRowStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
  padding: '0.55rem 0.6rem', borderRadius: 'var(--sn-radius-md)',
  background: 'var(--sn-row-soft)', border: '1px solid var(--sn-border-faint)',
  cursor: 'pointer', transition: 'background var(--sn-dur-fast) var(--sn-ease), border-color var(--sn-dur-fast) var(--sn-ease)',
};
const playerNameStyle = { fontWeight: 700, color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

const rankBadgeStyle = (i) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
  fontFamily: 'var(--sn-font-mono)', fontWeight: 800, fontSize: 'var(--sn-fs-xs)',
  background: i === 0 ? 'color-mix(in srgb, var(--sn-tier-elite) 22%, transparent)' : 'var(--sn-row-strong)',
  color: i === 0 ? 'var(--sn-tier-elite)' : 'var(--sn-text-secondary)',
  border: i === 0 ? '1px solid color-mix(in srgb, var(--sn-tier-elite) 45%, transparent)' : '1px solid var(--sn-border-faint)',
});

const activityRowStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
  padding: 'var(--sn-space-4) var(--sn-space-5)',
  background: 'transparent', border: 'none', cursor: 'pointer',
  transition: 'background var(--sn-dur-fast) var(--sn-ease)',
};

const inputStyle = {
  width: '100%', background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)', borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)', padding: '0.6rem 0.85rem', outline: 'none', minHeight: 44,
};
const selectStyle = {
  ...inputStyle, appearance: 'none', minWidth: 0,
  backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2.5\'><path d=\'m6 9 6 6 6-6\'/></svg>")',
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', paddingRight: '2rem',
};

const searchWrapStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'var(--sn-input-bg)', border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)', padding: '0 0.85rem', color: 'var(--sn-text-muted)',
};
const searchInputStyle = {
  flex: 1, background: 'transparent', border: 'none', outline: 'none',
  color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)', padding: '0.7rem 0', minHeight: 44,
};
const resultsListStyle = {
  marginTop: 8, border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)', background: 'var(--sn-bg-surface)',
  maxHeight: 320, overflow: 'auto',
};
const resultsItemStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
  padding: '0.6rem 0.8rem', background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--sn-border-faint)', cursor: 'pointer', textAlign: 'left',
};

const alumnoChipStyle = {
  marginTop: 8, display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)',
  padding: 'var(--sn-space-3) var(--sn-space-4)', background: 'var(--sn-row-soft)',
  border: '1px solid var(--sn-border-faint)', borderRadius: 'var(--sn-radius-md)', flexWrap: 'wrap',
};

const resumenGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sn-space-3)', marginTop: 'var(--sn-space-2)' };
const filtrosBarStyle = { display: 'flex', alignItems: 'flex-end', gap: 'var(--sn-space-3)', flexWrap: 'wrap' };

const filtrosToolbarStyle = { display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)', flexWrap: 'wrap' };
const toolbarSelectStyle = { ...selectStyle, width: 'auto', minWidth: 170, flex: '0 1 200px' };
const limpiarBtnStyle = {
  padding: '0.4rem 0.8rem', borderRadius: 'var(--sn-radius-pill)',
  border: '1px solid var(--sn-border-soft)', background: 'transparent',
  color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const comentarioStyle = {
  marginTop: 'var(--sn-space-3)', padding: '0.6rem 0.8rem',
  background: 'var(--sn-row-soft)', border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)', color: 'var(--sn-text-secondary)', fontSize: 'var(--sn-fs-sm)',
};

const estadoBtnStyle = (active, color) => ({
  padding: '0.45rem 0.55rem', borderRadius: 'var(--sn-radius-sm)',
  border: active ? `1.5px solid ${color}` : '1px solid var(--sn-border-faint)',
  background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
  color: active ? 'var(--sn-text-primary)' : 'var(--sn-text-secondary)',
  fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap',
});

const chipSugStyle = {
  padding: '0.25rem 0.6rem', background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)', borderRadius: 'var(--sn-radius-pill)',
  color: 'var(--sn-text-secondary)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
};

export default MisionesJugador;
