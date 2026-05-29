import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTacticas, mutarTacticas } from '../hooks/useTacticas';
import { useAlumnos } from '../hooks/useAlumnos';
import { toast } from '../hooks/useToast';
import { Card, CardBody, Button, EmptyState, Modal } from '../components/ui';

/* =============================================================
   PIZARRA TÁCTICA — FC SECHURA
   Layout:
     · Desktop ≥992px: sidebar de controles a la izquierda + cancha a la derecha.
     · Móvil/iPad: cancha primero con sticky toolbar SIEMPRE visible arriba;
       opciones secundarias debajo. Cero scroll para cambiar de modo.
   Features:
     · 11 vs 11 (local + rival ámbar)
     · Modos: mover / línea / flecha / libre / asignar jugador
     · Vínculo opcional ficha ⇄ alumno (playerId, nombre, dorsal, iniciales)
     · Metadata de jugada (categoría, tipo, objetivo, notas)
   ============================================================= */

const HOME_COLORS = {
  POR: 'var(--sn-tier-elite)',
  DEF: 'var(--sn-crit)',
  MID: 'var(--sn-brand-glow)',
  ATT: 'var(--sn-success)',
};
const AWAY_COLOR_PORTERO = '#7C2D12';
const AWAY_COLOR_CAMPO   = '#F59E0B';

const mkFicha = (id, x, y, label, color, role, extra = {}) => ({
  id, x, y, label, color, role,
  team:      extra.team ?? 'home',
  isBall:    !!extra.isBall,
  playerId:  extra.playerId  ?? null,
  nombre:    extra.nombre    ?? null,
  dorsal:    extra.dorsal    ?? null,
  iniciales: extra.iniciales ?? null,
});

const FORMACIONES_HOME = {
  '4-3-3': [
    mkFicha('h1',  50, 90, 'POR', HOME_COLORS.POR, 'POR'),
    mkFicha('h2',  20, 70, 'LI',  HOME_COLORS.DEF, 'DEF'),
    mkFicha('h3',  40, 75, 'DFC', HOME_COLORS.DEF, 'DEF'),
    mkFicha('h4',  60, 75, 'DFC', HOME_COLORS.DEF, 'DEF'),
    mkFicha('h5',  80, 70, 'LD',  HOME_COLORS.DEF, 'DEF'),
    mkFicha('h6',  30, 50, 'MC',  HOME_COLORS.MID, 'MID'),
    mkFicha('h7',  50, 60, 'MCD', HOME_COLORS.MID, 'MID'),
    mkFicha('h8',  70, 50, 'MC',  HOME_COLORS.MID, 'MID'),
    mkFicha('h9',  25, 25, 'EI',  HOME_COLORS.ATT, 'ATT'),
    mkFicha('h10', 50, 15, 'DC',  HOME_COLORS.ATT, 'ATT'),
    mkFicha('h11', 75, 25, 'ED',  HOME_COLORS.ATT, 'ATT'),
  ],
  '4-4-2': [
    mkFicha('h1',  50, 90, 'POR', HOME_COLORS.POR, 'POR'),
    mkFicha('h2',  20, 70, 'LI',  HOME_COLORS.DEF, 'DEF'),
    mkFicha('h3',  40, 75, 'DFC', HOME_COLORS.DEF, 'DEF'),
    mkFicha('h4',  60, 75, 'DFC', HOME_COLORS.DEF, 'DEF'),
    mkFicha('h5',  80, 70, 'LD',  HOME_COLORS.DEF, 'DEF'),
    mkFicha('h6',  20, 45, 'MI',  HOME_COLORS.MID, 'MID'),
    mkFicha('h7',  40, 50, 'MC',  HOME_COLORS.MID, 'MID'),
    mkFicha('h8',  60, 50, 'MC',  HOME_COLORS.MID, 'MID'),
    mkFicha('h9',  80, 45, 'MD',  HOME_COLORS.MID, 'MID'),
    mkFicha('h10', 35, 20, 'DC',  HOME_COLORS.ATT, 'ATT'),
    mkFicha('h11', 65, 20, 'DC',  HOME_COLORS.ATT, 'ATT'),
  ],
  '4-2-3-1': [
    mkFicha('h1',  50, 90, 'POR', HOME_COLORS.POR, 'POR'),
    mkFicha('h2',  20, 72, 'LI',  HOME_COLORS.DEF, 'DEF'),
    mkFicha('h3',  40, 76, 'DFC', HOME_COLORS.DEF, 'DEF'),
    mkFicha('h4',  60, 76, 'DFC', HOME_COLORS.DEF, 'DEF'),
    mkFicha('h5',  80, 72, 'LD',  HOME_COLORS.DEF, 'DEF'),
    mkFicha('h6',  38, 58, 'MCD', HOME_COLORS.MID, 'MID'),
    mkFicha('h7',  62, 58, 'MCD', HOME_COLORS.MID, 'MID'),
    mkFicha('h8',  25, 38, 'EI',  HOME_COLORS.MID, 'MID'),
    mkFicha('h9',  50, 35, 'MEO', HOME_COLORS.MID, 'MID'),
    mkFicha('h10', 75, 38, 'ED',  HOME_COLORS.MID, 'MID'),
    mkFicha('h11', 50, 15, 'DC',  HOME_COLORS.ATT, 'ATT'),
  ],
};

const buildRival = (clave) => {
  const base = FORMACIONES_HOME[clave] ?? FORMACIONES_HOME['4-3-3'];
  return base.map((f) => ({
    ...f,
    id: `r-${f.id}`,
    team: 'away',
    color: f.role === 'POR' ? AWAY_COLOR_PORTERO : AWAY_COLOR_CAMPO,
    y: Math.max(5, 100 - f.y),
  }));
};

const BALL = mkFicha('ball', 50, 50, '⚽', '#FFFFFF', 'BALL', { team: 'ball', isBall: true });

const TIPOS_JUGADA = [
  { value: '',             label: '— Selecciona —' },
  { value: 'ofensiva',     label: 'Ofensiva' },
  { value: 'defensiva',    label: 'Defensiva' },
  { value: 'transicion',   label: 'Transición' },
  { value: 'balon-parado', label: 'Balón parado' },
];

const OBJETIVOS_TACTICOS = [
  'Presión alta', 'Salida limpia', 'Repliegue', 'Amplitud',
  'Marca al hombre', 'Bloque medio', 'Contraataque', 'Línea de 4',
];

const TRAZO_COLORS = ['#FBBF24', '#22D3EE', '#EF4444', '#FFFFFF'];

const PizarraTactiva = () => {
  const { tacticas } = useTacticas();

  // ===== Estado principal =====
  const [formacion, setFormacion] = useState('4-3-3');
  const [home, setHome]           = useState(() => [...FORMACIONES_HOME['4-3-3'], BALL]);
  const [away, setAway]           = useState([]);
  const [awayVisible, setAwayVisible] = useState(true);

  // ===== Drawing =====
  const [tool, setTool]                   = useState('move'); // move | line | arrow | free | asignar
  const [trazoColor, setTrazoColor]       = useState(TRAZO_COLORS[0]);
  const [strokes, setStrokes]             = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);

  // ===== Metadata =====
  const [titulo, setTitulo]   = useState('');
  const [meta, setMeta]       = useState({ categoria: '', tipo: '', objetivo: '', notas: '' });
  const [metaOpen, setMetaOpen] = useState(false);

  // ===== UI =====
  const [guardando, setGuardando]       = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draggingId, setDraggingId]     = useState(null);
  const [asignarTarget, setAsignarTarget] = useState(null); // ficha clicada en modo asignar

  const containerRef = useRef(null);
  const fullscreenWrapperRef = useRef(null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ===== Helpers =====
  const toFieldCoords = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top)  / rect.height) * 100)),
    };
  };

  // ===== Drag fichas =====
  const onFichaPointerDown = (e, id, team) => {
    if (tool === 'asignar') {
      const arr = team === 'away' ? away : home;
      const ficha = arr.find((f) => f.id === id);
      if (ficha && !ficha.isBall) setAsignarTarget({ ...ficha, team });
      return;
    }
    if (tool !== 'move') return;
    e.target.setPointerCapture?.(e.pointerId);
    setDraggingId({ id, team });
  };
  const onFichaPointerMove = (e) => {
    if (!draggingId || tool !== 'move') return;
    const { x, y } = toFieldCoords(e);
    if (draggingId.team === 'away') {
      setAway((prev) => prev.map((f) => f.id === draggingId.id ? { ...f, x, y } : f));
    } else {
      setHome((prev) => prev.map((f) => f.id === draggingId.id ? { ...f, x, y } : f));
    }
  };
  const onFichaPointerUp = (e) => {
    try { e.target.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    setDraggingId(null);
  };

  // ===== Dibujo =====
  const isDrawMode = tool === 'line' || tool === 'arrow' || tool === 'free';
  const onDrawPointerDown = (e) => {
    if (!isDrawMode) return;
    e.preventDefault();
    const { x, y } = toFieldCoords(e);
    setCurrentStroke({
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: tool, color: trazoColor, points: [{ x, y }],
    });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDrawPointerMove = (e) => {
    if (!currentStroke) return;
    const { x, y } = toFieldCoords(e);
    setCurrentStroke((prev) => {
      if (!prev) return prev;
      if (prev.type === 'line' || prev.type === 'arrow') {
        return { ...prev, points: [prev.points[0], { x, y }] };
      }
      return { ...prev, points: [...prev.points, { x, y }] };
    });
  };
  const onDrawPointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    if (currentStroke && currentStroke.points.length > 1) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  };

  const undoStroke   = () => setStrokes((prev) => prev.slice(0, -1));
  const clearStrokes = () => setStrokes([]);

  // ===== Plantilla / formaciones =====
  const aplicarFormacion = (k) => {
    setFormacion(k);
    const ball = home.find((f) => f.isBall) ?? BALL;
    // Preserva los datos de vínculo (playerId/nombre/dorsal/iniciales) por índice de id base.
    const linked = {};
    home.forEach((f) => {
      if (f.playerId || f.dorsal || f.iniciales || f.nombre) {
        linked[f.id] = { playerId: f.playerId, nombre: f.nombre, dorsal: f.dorsal, iniciales: f.iniciales };
      }
    });
    const nueva = FORMACIONES_HOME[k].map((f) => ({ ...f, ...(linked[f.id] ?? {}) }));
    setHome([...nueva, ball]);
  };

  const agregarRival11 = () => {
    setAway(buildRival(formacion));
    setAwayVisible(true);
    toast.info('Equipo rival cargado (11).');
  };
  const limpiarRival = () => setAway([]);
  const limpiarTodo = () => {
    setHome([...FORMACIONES_HOME[formacion], BALL]);
    setAway([]); setStrokes([]); setCurrentStroke(null);
  };

  // ===== Pantalla completa =====
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      fullscreenWrapperRef.current?.requestFullscreen?.()
        .catch((err) => toast.error(`No se pudo entrar a pantalla completa: ${err.message}`));
    } else {
      document.exitFullscreen?.();
    }
  };

  // ===== Asignación de jugador =====
  const aplicarAsignacion = (datos) => {
    if (!asignarTarget) return;
    const apply = (arr) => arr.map((f) =>
      f.id === asignarTarget.id ? { ...f, ...datos } : f
    );
    if (asignarTarget.team === 'away') setAway(apply); else setHome(apply);
    setAsignarTarget(null);
    toast.success(datos.playerId ? 'Ficha vinculada al jugador.' : 'Vínculo eliminado.');
  };

  // ===== Guardar / cargar =====
  const guardar = async () => {
    if (!titulo.trim()) return toast.error('Pon un título a la táctica.');
    setGuardando(true);
    try {
      await mutarTacticas.guardar({
        titulo: titulo.trim(), formacion,
        fichas: home, rivales: away, trazos: strokes, meta,
      });
      toast.success('Táctica guardada.');
      setTitulo('');
    } catch {
      toast.error('No se pudo guardar la táctica.');
    } finally { setGuardando(false); }
  };

  const cargarTactica = (t) => {
    const ballPresente = (t.fichas ?? []).some((f) => f.isBall);
    setHome(ballPresente ? t.fichas : [...(t.fichas ?? []), BALL]);
    setAway(t.rivales ?? []);
    setStrokes(t.trazos ?? []);
    if (t.formacion) setFormacion(t.formacion);
    if (t.meta) setMeta({ ...meta, ...t.meta });
    setTitulo(t.titulo);
    toast.info(`Cargada: ${t.titulo}`);
  };

  const fieldCursor = useMemo(() => {
    if (tool === 'move')    return draggingId ? 'grabbing' : 'default';
    if (tool === 'asignar') return 'pointer';
    return 'crosshair';
  }, [tool, draggingId]);

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        {/* === Cabecera compacta === */}
        <header style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <span style={eyebrowStyle}>DEPORTIVO · ESTRATEGIA</span>
            <h1 style={titleStyle}>Pizarra táctica</h1>
          </div>
          <Button variant="ghost" size="sm" icon={<ResetIcon />} onClick={limpiarTodo}>
            Resetear
          </Button>
        </header>

        <div className="sn-pizarra-layout">
          {/* === LADO PRINCIPAL: TOOLBAR + CANCHA === */}
          <div className="sn-pizarra-canvas-wrap">
            <ToolbarPizarra
              tool={tool} setTool={setTool}
              trazoColor={trazoColor} setTrazoColor={setTrazoColor}
              strokes={strokes} onUndo={undoStroke} onClear={clearStrokes}
              awayVisible={awayVisible} hasAway={away.length > 0}
              onToggleAway={() => setAwayVisible((v) => !v)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />

            <div ref={fullscreenWrapperRef} style={{
              ...lienzoWrapStyle,
              ...(isFullscreen ? { background: 'var(--sn-bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--sn-space-3)' } : {}),
            }}>
              {isFullscreen && (
                <div className="sn-pizarra-fs-toolbar">
                  <div className="sn-pizarra-toolbar-group">
                    <ToolBtn icon={<HandIcon />}  label="Mover"   active={tool === 'move'}    onClick={() => setTool('move')} />
                    <ToolBtn icon={<LineIcon />}  label="Línea"   active={tool === 'line'}    onClick={() => setTool('line')} />
                    <ToolBtn icon={<ArrowIcon />} label="Flecha"  active={tool === 'arrow'}   onClick={() => setTool('arrow')} />
                    <ToolBtn icon={<PenIcon />}   label="Libre"   active={tool === 'free'}    onClick={() => setTool('free')} />
                    <ToolBtn icon={<LinkIcon />}  label="Asignar" active={tool === 'asignar'} onClick={() => setTool('asignar')} />
                  </div>

                  <div className="sn-pizarra-toolbar-divider" />

                  <div className="sn-pizarra-toolbar-group" aria-label="Color de trazo">
                    {TRAZO_COLORS.map((c) => (
                      <button
                        key={c} type="button"
                        aria-label={`Color ${c}`}
                        onClick={() => setTrazoColor(c)}
                        className={`sn-pizarra-color-swatch sn-focusable ${trazoColor === c ? 'is-active' : ''}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>

                  <div className="sn-pizarra-toolbar-divider" />

                  <div className="sn-pizarra-toolbar-group">
                    <ToolBtn icon={<UndoIcon />}  label="Deshacer" onClick={undoStroke}   disabled={strokes.length === 0} iconOnly />
                    <ToolBtn icon={<TrashIcon />} label="Limpiar"  onClick={clearStrokes} disabled={strokes.length === 0} iconOnly />
                  </div>

                  <div className="sn-pizarra-toolbar-divider" />

                  <div className="sn-pizarra-toolbar-group">
                    <ToolBtn
                      icon={awayVisible ? <EyeOffIcon /> : <EyeIcon />}
                      label={awayVisible ? 'Ocultar rival' : 'Mostrar rival'}
                      onClick={() => setAwayVisible((v) => !v)} disabled={away.length === 0}
                    />
                  </div>

                  <div style={{ marginLeft: 'auto' }} />

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="sn-pizarra-fs-close sn-focusable"
                    title="Salir de pantalla completa (ESC)"
                    aria-label="Salir de pantalla completa"
                  >
                    <ExitFsIcon />
                    <span className="label">Salir</span>
                  </button>
                </div>
              )}

              <div
                ref={containerRef}
                className="sn-pizarra-field"
                style={{
                  width: '100%',
                  maxWidth: isFullscreen
                    ? 'min(100vh, 820px)'
                    : 'min(620px, calc((100vh - 280px) * 0.667))',
                  aspectRatio: '2/3',
                  background: 'linear-gradient(to bottom, #166534 0%, #14532d 100%)',
                  border: '4px solid rgba(255,255,255,0.85)',
                  borderRadius: 'var(--sn-radius-md)',
                  position: 'relative',
                  overflow: 'hidden',
                  touchAction: 'none',
                  boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.25)',
                  cursor: fieldCursor,
                  margin: '0 auto',
                }}
                onPointerMove={onFichaPointerMove}
                onPointerUp={onFichaPointerUp}
                onPointerLeave={onFichaPointerUp}
              >
                <CanchaLineas />

                {/* SVG dibujo */}
                <svg
                  viewBox="0 0 100 100" preserveAspectRatio="none"
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    pointerEvents: isDrawMode ? 'auto' : 'none', zIndex: 5,
                  }}
                  onPointerDown={onDrawPointerDown}
                  onPointerMove={onDrawPointerMove}
                  onPointerUp={onDrawPointerUp}
                  onPointerLeave={onDrawPointerUp}
                >
                  <defs>
                    {[...new Set([...strokes.map((s) => s.color), trazoColor])].map((c) => (
                      <marker key={c} id={`arrowhead-${c.replace('#', '')}`}
                              markerWidth="6" markerHeight="6" refX="5" refY="3"
                              orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L6,3 z" fill={c} />
                      </marker>
                    ))}
                  </defs>
                  {isDrawMode && (
                    <rect x={0} y={0} width={100} height={100} fill="transparent" pointerEvents="all" />
                  )}
                  {strokes.map((s) => <Stroke key={s.id} stroke={s} />)}
                  {currentStroke && <Stroke stroke={currentStroke} />}
                </svg>

                {/* Fichas */}
                {home.map((f) => (
                  <FichaDOM
                    key={f.id} ficha={f} isFullscreen={isFullscreen}
                    isDragging={draggingId?.id === f.id && draggingId?.team === f.team}
                    onPointerDown={(e) => onFichaPointerDown(e, f.id, f.team)}
                    interactive={tool === 'move' || tool === 'asignar'}
                    asignarMode={tool === 'asignar'}
                  />
                ))}
                {awayVisible && away.map((f) => (
                  <FichaDOM
                    key={f.id} ficha={f} isFullscreen={isFullscreen}
                    isDragging={draggingId?.id === f.id && draggingId?.team === f.team}
                    onPointerDown={(e) => onFichaPointerDown(e, f.id, f.team)}
                    interactive={tool === 'move' || tool === 'asignar'}
                    asignarMode={tool === 'asignar'}
                  />
                ))}
              </div>
            </div>

            <p style={tipStyle}>
              {tool === 'move'    && 'Toca y arrastra las fichas. Cambia de modo para dibujar.'}
              {tool === 'asignar' && 'Toca una ficha para vincularla a un jugador real.'}
              {isDrawMode         && 'Dibuja sobre la cancha. Vuelve a "Mover" para reordenar.'}
            </p>
          </div>

          {/* === LADO SECUNDARIO: AJUSTES === */}
          <aside className="sn-pizarra-side sn-scroll">
            <Card>
              <CardBody>
                <span style={subLabelStyle}>Formación local</span>
                <div style={gridButtonsStyle(3)}>
                  {Object.keys(FORMACIONES_HOME).map((k) => (
                    <Button
                      key={k} size="sm"
                      variant={formacion === k ? 'primary' : 'secondary'}
                      onClick={() => aplicarFormacion(k)}
                      style={{ minWidth: 0 }}
                    >
                      {k}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <span style={subLabelStyle}>Equipo rival</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <Button variant="secondary" size="sm" onClick={agregarRival11} icon={<UsersIcon />}>
                    Cargar 11 rival
                  </Button>
                  <Button variant="ghost" size="sm" onClick={limpiarRival} disabled={away.length === 0} icon={<TrashIcon />}>
                    Quitar rival
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <span style={subLabelStyle}>Guardar jugada</span>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: Salida 4-3-3 vs presión"
                  className="sn-focusable"
                  style={{ ...inputStyle, marginTop: 8 }}
                />

                <button
                  type="button"
                  onClick={() => setMetaOpen((v) => !v)}
                  className="sn-focusable"
                  aria-expanded={metaOpen}
                  style={metaToggleStyle}
                >
                  <span>Metadata de la jugada</span>
                  <span style={{ transition: 'transform var(--sn-dur-fast)', transform: metaOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                </button>

                {metaOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <input
                      value={meta.categoria}
                      onChange={(e) => setMeta((m) => ({ ...m, categoria: e.target.value }))}
                      placeholder="Categoría (sub-12, 1er equipo…)"
                      className="sn-focusable" style={inputStyle}
                    />
                    <select
                      value={meta.tipo}
                      onChange={(e) => setMeta((m) => ({ ...m, tipo: e.target.value }))}
                      className="sn-focusable" style={selectStyle}
                    >
                      {TIPOS_JUGADA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select
                      value={meta.objetivo}
                      onChange={(e) => setMeta((m) => ({ ...m, objetivo: e.target.value }))}
                      className="sn-focusable" style={selectStyle}
                    >
                      <option value="">— Objetivo táctico —</option>
                      {OBJETIVOS_TACTICOS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <textarea
                      value={meta.notas}
                      onChange={(e) => setMeta((m) => ({ ...m, notas: e.target.value }))}
                      placeholder="Notas del entrenador…"
                      rows={3}
                      className="sn-focusable" style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                    />
                  </div>
                )}

                <Button variant="success" loading={guardando} onClick={guardar} style={{ width: '100%', marginTop: 10 }}>
                  Guardar en nube
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardBody style={{ padding: 0 }}>
                <div style={{ padding: 'var(--sn-space-3) var(--sn-space-4)', borderBottom: '1px solid var(--sn-border-faint)' }}>
                  <span style={subLabelStyle}>Archivo táctico</span>
                </div>
                <div className="sn-scroll" style={{ maxHeight: 240, overflow: 'auto', padding: 'var(--sn-space-2)' }}>
                  {tacticas.length === 0 ? (
                    <EmptyState title="Sin tácticas" description="Cuando guardes una jugada aparecerá aquí." />
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {tacticas.map((t) => (
                        <li key={t.id} style={tacticaRowStyle}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.titulo}>
                              {t.titulo}
                            </div>
                            {(t.meta?.tipo || t.formacion) && (
                              <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                                {[t.formacion, t.meta?.tipo].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => cargarTactica(t)}>Cargar</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>

      {/* === MODAL ASIGNAR JUGADOR === */}
      <AsignarJugadorModal
        ficha={asignarTarget}
        onClose={() => setAsignarTarget(null)}
        onApply={aplicarAsignacion}
      />

      <style>{`
        /* ====== LAYOUT PIZARRA ====== */
        .sn-pizarra-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: var(--sn-space-5);
          align-items: start;
        }
        .sn-pizarra-canvas-wrap {
          display: flex; flex-direction: column;
          gap: var(--sn-space-3);
          min-width: 0;
        }
        .sn-pizarra-side {
          display: flex; flex-direction: column;
          gap: var(--sn-space-3);
          position: sticky; top: 80px;
          max-height: calc(100vh - 100px);
          overflow-y: auto; overflow-x: hidden;
          padding-right: 4px;
        }
        @media (max-width: 991.98px) {
          .sn-pizarra-layout {
            grid-template-columns: 1fr !important;
          }
          .sn-pizarra-side {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
            padding-right: 0;
          }
        }

        /* ====== TOOLBAR STICKY ====== */
        .sn-pizarra-toolbar {
          display: flex; align-items: center; gap: 6px;
          padding: 6px;
          background: var(--sn-bg-surface);
          border: 1px solid var(--sn-border-soft);
          border-radius: var(--sn-radius-md);
          box-shadow: var(--sn-shadow-sm);
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
        }
        .sn-pizarra-toolbar-group {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px;
          flex-shrink: 0;
        }
        .sn-pizarra-toolbar-divider {
          width: 1px; height: 26px;
          background: var(--sn-border-faint);
          flex-shrink: 0;
        }
        .sn-pizarra-tool-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 12px; min-height: 40px;
          border-radius: var(--sn-radius-sm);
          background: transparent;
          border: 1px solid transparent;
          color: var(--sn-text-secondary);
          font-family: var(--sn-font-ui); font-weight: 700;
          font-size: var(--sn-fs-xs);
          letter-spacing: 0.04em;
          cursor: pointer;
          white-space: nowrap;
          transition: background var(--sn-dur-fast) var(--sn-ease), color var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-pizarra-tool-btn:hover { background: var(--sn-row-soft); }
        .sn-pizarra-tool-btn.is-active {
          background: var(--sn-brand-gradient);
          color: #06121A;
          border-color: transparent;
        }
        .sn-pizarra-tool-btn.is-icon { padding: 8px; width: 40px; justify-content: center; }
        .sn-pizarra-tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .sn-pizarra-color-swatch {
          width: 26px; height: 26px;
          border-radius: 50%;
          border: 2px solid var(--sn-border-soft);
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
        }
        .sn-pizarra-color-swatch.is-active {
          border-color: var(--sn-text-primary);
          box-shadow: 0 0 0 2px var(--sn-bg-surface), 0 0 0 4px var(--sn-text-primary);
        }

        /* ====== FULLSCREEN TOOLBAR ====== */
        .sn-pizarra-fs-toolbar {
          display: flex; align-items: center; gap: 6px;
          padding: 6px;
          background: color-mix(in srgb, var(--sn-bg-surface) 92%, transparent);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--sn-border-soft);
          border-radius: var(--sn-radius-md);
          box-shadow: var(--sn-shadow-lg);
          width: 100%;
          max-width: 820px;
          margin-bottom: var(--sn-space-3);
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          -webkit-overflow-scrolling: touch;
          z-index: 9999;
          flex-shrink: 0;
        }
        .sn-pizarra-fs-close {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; min-height: 40px;
          border-radius: var(--sn-radius-sm);
          background: var(--sn-crit);
          border: none;
          color: white;
          font-family: var(--sn-font-ui); font-weight: 700;
          font-size: var(--sn-fs-xs);
          letter-spacing: 0.04em;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background var(--sn-dur-fast) var(--sn-ease), transform var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-pizarra-fs-close:hover { filter: brightness(1.15); }
        .sn-pizarra-fs-close:active { transform: scale(0.96); }

        @media (max-width: 640px) {
          .sn-pizarra-tool-btn span.label { display: none; }
          .sn-pizarra-tool-btn { padding: 8px; min-width: 40px; justify-content: center; }
          .sn-pizarra-fs-close span.label { display: none; }
          .sn-pizarra-fs-close { padding: 8px; }
        }
      `}</style>
    </div>
  );
};

/* =============================================================
   TOOLBAR (sticky / siempre visible junto al canvas)
   ============================================================= */
const ToolbarPizarra = ({
  tool, setTool, trazoColor, setTrazoColor,
  strokes, onUndo, onClear,
  awayVisible, hasAway, onToggleAway,
  isFullscreen, onToggleFullscreen,
}) => (
  <div className="sn-pizarra-toolbar">
    <div className="sn-pizarra-toolbar-group">
      <ToolBtn icon={<HandIcon />}  label="Mover"   active={tool === 'move'}    onClick={() => setTool('move')} />
      <ToolBtn icon={<LineIcon />}  label="Línea"   active={tool === 'line'}    onClick={() => setTool('line')} />
      <ToolBtn icon={<ArrowIcon />} label="Flecha"  active={tool === 'arrow'}   onClick={() => setTool('arrow')} />
      <ToolBtn icon={<PenIcon />}   label="Libre"   active={tool === 'free'}    onClick={() => setTool('free')} />
      <ToolBtn icon={<LinkIcon />}  label="Asignar" active={tool === 'asignar'} onClick={() => setTool('asignar')} />
    </div>

    <div className="sn-pizarra-toolbar-divider" />

    <div className="sn-pizarra-toolbar-group" aria-label="Color de trazo">
      {TRAZO_COLORS.map((c) => (
        <button
          key={c} type="button"
          aria-label={`Color ${c}`}
          onClick={() => setTrazoColor(c)}
          className={`sn-pizarra-color-swatch sn-focusable ${trazoColor === c ? 'is-active' : ''}`}
          style={{ background: c }}
        />
      ))}
    </div>

    <div className="sn-pizarra-toolbar-divider" />

    <div className="sn-pizarra-toolbar-group">
      <ToolBtn icon={<UndoIcon />}  label="Deshacer" onClick={onUndo}  disabled={strokes.length === 0} iconOnly />
      <ToolBtn icon={<TrashIcon />} label="Limpiar"  onClick={onClear} disabled={strokes.length === 0} iconOnly />
    </div>

    <div className="sn-pizarra-toolbar-divider" />

    <div className="sn-pizarra-toolbar-group">
      <ToolBtn
        icon={awayVisible ? <EyeOffIcon /> : <EyeIcon />}
        label={awayVisible ? 'Ocultar rival' : 'Mostrar rival'}
        onClick={onToggleAway} disabled={!hasAway}
      />
    </div>

    <div style={{ marginLeft: 'auto' }} />

    <ToolBtn
      icon={<ExpandIcon />}
      label={isFullscreen ? 'Salir' : 'Pantalla completa'}
      onClick={onToggleFullscreen}
    />
  </div>
);

const ToolBtn = ({ icon, label, active, onClick, disabled, iconOnly }) => (
  <button
    type="button"
    className={`sn-pizarra-tool-btn sn-focusable ${active ? 'is-active' : ''} ${iconOnly ? 'is-icon' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
  >
    {icon}
    {!iconOnly && <span className="label">{label}</span>}
  </button>
);

/* =============================================================
   FICHA — render visual
   ============================================================= */
const FichaDOM = ({ ficha, isFullscreen, isDragging, onPointerDown, interactive, asignarMode }) => {
  const f = ficha;
  const linked = !!f.playerId || !!f.nombre || !!f.dorsal || !!f.iniciales;
  const labelInside = f.dorsal ?? f.iniciales ?? f.label;
  const tip = f.nombre ? `${f.nombre}${f.dorsal ? ' · #' + f.dorsal : ''}` : f.label;

  return (
    <div
      onPointerDown={onPointerDown}
      title={tip}
      style={{
        position: 'absolute',
        left: `${f.x}%`, top: `${f.y}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        cursor: interactive ? (asignarMode ? 'pointer' : (isDragging ? 'grabbing' : 'grab')) : 'default',
        pointerEvents: interactive ? 'auto' : 'none',
        zIndex: isDragging ? 100 : 10,
        userSelect: 'none',
        transition: isDragging ? 'none' : 'transform var(--sn-dur-fast) var(--sn-ease)',
      }}
    >
      <div style={{
        width:  f.isBall ? (isFullscreen ? 38 : 26) : (isFullscreen ? 58 : 42),
        height: f.isBall ? (isFullscreen ? 38 : 26) : (isFullscreen ? 58 : 42),
        background: f.color,
        color: f.isBall ? 'black' : (f.team === 'away' ? '#1A1408' : 'white'),
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900,
        fontSize: f.isBall ? (isFullscreen ? 22 : 16) : (isFullscreen ? 14 : 11),
        border: f.isBall
          ? '2px solid black'
          : (linked
              ? '3px solid #FACC15'
              : (f.team === 'away' ? '3px dashed rgba(0,0,0,0.55)' : '3px solid rgba(255,255,255,0.95)')),
        boxShadow: isDragging
          ? '0 18px 40px rgba(0,0,0,0.5)'
          : (asignarMode && interactive ? '0 0 0 3px rgba(59,130,246,0.55)' : '0 8px 20px rgba(0,0,0,0.35)'),
      }}>
        {labelInside}
      </div>
      {linked && f.nombre && !f.isBall && (
        <div style={{
          fontSize: isFullscreen ? 10 : 8,
          fontWeight: 700,
          color: 'white',
          background: 'rgba(0,0,0,0.55)',
          padding: '1px 5px',
          borderRadius: 4,
          maxWidth: isFullscreen ? 96 : 64,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.1,
        }}>
          {f.nombre.split(' ')[0]}
        </div>
      )}
    </div>
  );
};

const Stroke = ({ stroke }) => {
  if (!stroke || stroke.points.length === 0) return null;
  const colorId = `arrowhead-${stroke.color.replace('#', '')}`;
  const strokeProps = {
    stroke: stroke.color, fill: 'none',
    strokeLinecap: 'round', strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
    style: { strokeWidth: 3 },
  };
  if (stroke.type === 'line' || stroke.type === 'arrow') {
    const [p1, p2] = stroke.points;
    if (!p2) return null;
    return (
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            {...strokeProps}
            markerEnd={stroke.type === 'arrow' ? `url(#${colorId})` : undefined} />
    );
  }
  const d = stroke.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return <path d={d} {...strokeProps} />;
};

const CanchaLineas = () => (
  <>
    <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 2, background: 'rgba(255,255,255,0.6)' }} />
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '20%', aspectRatio: '1/1', border: '2px solid rgba(255,255,255,0.6)', borderRadius: '50%' }} />
    <div style={{ position: 'absolute', top: 0, left: '20%', width: '60%', height: '15%', border: '2px solid rgba(255,255,255,0.6)', borderTop: 'none' }} />
    <div style={{ position: 'absolute', top: 0, left: '35%', width: '30%', height: '6%', border: '2px solid rgba(255,255,255,0.6)', borderTop: 'none' }} />
    <div style={{ position: 'absolute', bottom: 0, left: '20%', width: '60%', height: '15%', border: '2px solid rgba(255,255,255,0.6)', borderBottom: 'none' }} />
    <div style={{ position: 'absolute', bottom: 0, left: '35%', width: '30%', height: '6%', border: '2px solid rgba(255,255,255,0.6)', borderBottom: 'none' }} />
  </>
);

/* =============================================================
   MODAL: Asignar jugador real a una ficha
   ============================================================= */
const AsignarJugadorModal = ({ ficha, onClose, onApply }) => (
  <Modal
    open={!!ficha}
    onClose={onClose}
    title="Asignar jugador a la ficha"
    description={ficha ? `Posición ${ficha.label}${ficha.team === 'away' ? ' (rival)' : ''}` : ''}
    size="md"
    footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        {ficha?.playerId && (
          <Button variant="danger" onClick={() => onApply({ playerId: null, nombre: null, iniciales: null, dorsal: null })}>
            Quitar vínculo
          </Button>
        )}
      </>
    }
  >
    {ficha && <AsignarJugadorForm key={ficha.id} ficha={ficha} onApply={onApply} />}
  </Modal>
);

const AsignarJugadorForm = ({ ficha, onApply }) => {
  const { alumnos, loading } = useAlumnos();
  const [busqueda, setBusqueda] = useState('');
  const [dorsal, setDorsal] = useState(() => ficha.dorsal ?? '');

  const resultados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return alumnos.slice(0, 8);
    return alumnos
      .filter((a) => `${a.nombre} ${a.apellido} ${a.dni}`.toLowerCase().includes(term))
      .slice(0, 12);
  }, [alumnos, busqueda]);

  const asignar = (a) => {
    const nombre = `${a.nombre ?? ''} ${a.apellido ?? ''}`.trim();
    const ini = ((a.nombre ?? '?').charAt(0) + (a.apellido ?? '').charAt(0)).toUpperCase();
    onApply({
      playerId:  a.id,
      nombre,
      iniciales: ini,
      dorsal:    dorsal ? String(dorsal) : null,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
      {ficha.nombre && (
        <div style={{
          padding: 'var(--sn-space-3) var(--sn-space-4)',
          background: 'color-mix(in srgb, var(--sn-success) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--sn-success) 35%, transparent)',
          borderRadius: 'var(--sn-radius-md)',
          color: 'var(--sn-text-primary)',
        }}>
          Actualmente vinculada a <strong>{ficha.nombre}</strong>{ficha.dorsal ? ` · dorsal ${ficha.dorsal}` : ''}.
        </div>
      )}

      <label style={fieldLabelStyle}>
        <span style={subLabelStyle}>Dorsal (opcional)</span>
        <input
          type="text" inputMode="numeric"
          value={dorsal} onChange={(e) => setDorsal(e.target.value)}
          placeholder="Ej: 10"
          className="sn-focusable" style={inputStyle}
          maxLength={3}
        />
      </label>

      <label style={fieldLabelStyle}>
        <span style={subLabelStyle}>Buscar jugador</span>
        <input
          type="text" autoFocus
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder={loading ? 'Cargando alumnos…' : 'Nombre, apellido o DNI'}
          className="sn-focusable" style={inputStyle}
        />
      </label>

      <div style={{
        marginTop: 4, border: '1px solid var(--sn-border-faint)',
        borderRadius: 'var(--sn-radius-md)', background: 'var(--sn-bg-surface)',
        maxHeight: 280, overflow: 'auto',
      }}>
        {resultados.length === 0 ? (
          <div style={{ padding: 'var(--sn-space-3)', color: 'var(--sn-text-muted)' }}>
            Sin coincidencias.
          </div>
        ) : (
          resultados.map((a) => (
            <button
              key={a.id} type="button"
              onClick={() => asignar(a)}
              className="sn-focusable"
              style={resultadoBtnStyle}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--sn-brand-gradient)', color: '#06121A',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 13, flexShrink: 0,
              }}>
                {(a.nombre?.[0] ?? '?').toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)' }}>
                  {a.nombre} {a.apellido}
                </div>
                <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                  Cat. {a.categoria ?? '—'} · DNI {a.dni ?? '—'}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

/* =============================================================
   Iconos
   ============================================================= */
const ExpandIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/></svg>);
const TrashIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>);
const UndoIcon   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 1 1 0 10h-4"/></svg>);
const EyeIcon    = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>);
const EyeOffIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.1 10.1 0 0 1 12 20c-6 0-10-8-10-8a18.6 18.6 0 0 1 4.06-5.06"/><path d="M1 1l22 22"/><path d="M9.9 4.24A10.3 10.3 0 0 1 12 4c6 0 10 8 10 8a18.6 18.6 0 0 1-3.06 4.1"/></svg>);
const UsersIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const HandIcon   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-4 0v6"/><path d="M14 10V4a2 2 0 0 0-4 0v8"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8.5a6 6 0 0 0 12 0V8a2 2 0 0 0-4 0"/></svg>);
const LineIcon   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20 20 4"/></svg>);
const ArrowIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19 19 5"/><path d="M9 5h10v10"/></svg>);
const PenIcon    = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>);
const LinkIcon   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>);
const ResetIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>);
const ExitFsIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v4a1 1 0 0 1-1 1H3M21 8h-4a1 1 0 0 1-1-1V3M3 16h4a1 1 0 0 1 1 1v4M16 21v-4a1 1 0 0 1 1-1h4"/></svg>);

/* =============================================================
   Estilos
   ============================================================= */
const pageBg = { minHeight: 'calc(100vh - var(--sn-navbar-h))', background: 'var(--sn-bg-base)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
const contentWrap = { maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-4) var(--sn-space-4) var(--sn-space-6)' };
const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sn-space-3)', flexWrap: 'wrap', marginBottom: 'var(--sn-space-4)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.2rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };

const tipStyle = {
  margin: 0, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)',
  textAlign: 'center', minHeight: '1rem',
};

const subLabelStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-text-muted)', textTransform: 'uppercase' };

const fieldLabelStyle = { display: 'flex', flexDirection: 'column', gap: 4 };

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
  ...inputStyle, appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2.5\'><path d=\'m6 9 6 6 6-6\'/></svg>")',
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center',
  paddingRight: '2rem',
};

const gridButtonsStyle = (cols) => ({
  display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  gap: 6, marginTop: 8,
});

const metaToggleStyle = {
  marginTop: 10, width: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0.55rem 0.85rem',
  background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-secondary)',
  cursor: 'pointer', fontWeight: 700,
  fontSize: 'var(--sn-fs-sm)', minHeight: 44,
};

const lienzoWrapStyle = {
  position: 'relative',
  background: 'var(--sn-bg-surface)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-lg)',
  padding: 'var(--sn-space-3)',
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  boxShadow: 'var(--sn-shadow-md)',
  overflow: 'hidden',
};

const tacticaRowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 'var(--sn-space-2)',
  padding: '0.45rem 0.55rem',
  background: 'var(--sn-row-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-sm)',
};

const resultadoBtnStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
  padding: '0.55rem 0.75rem',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--sn-border-faint)',
  cursor: 'pointer', textAlign: 'left',
};

export default PizarraTactiva;
