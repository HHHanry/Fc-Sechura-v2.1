import React, { useMemo, useState } from 'react';
import { useAlumnos } from '../hooks/useAlumnos';
import { useConvocatorias, mutarConvocatorias } from '../hooks/useConvocatorias';
import { useAuth } from '../context/useAuth';
import { toast } from '../hooks/useToast';
import { audit } from '../helpers/auditHelper';
import { withDefaults } from '../helpers/alumnoDefaults';
import {
  Card, CardBody, Button, Badge, EmptyState, Modal, Skeleton, StatusBadge,
} from '../components/ui';
import {
  CATEGORIAS, DISPONIBILIDAD_CONVOCATORIA, MOTIVOS_NO_CONVOCADO,
  CHECKLIST_CONVOCATORIA, formatDateLima,
} from '../config/businessRules';

/* ========================================================
   FASE 7 — Convocatoria Profesional
   ======================================================== */

const ESTADOS_ALERTA = ['lesionado', 'moroso', 'suspendido', 'inactivo', 'retirado'];
const UNIFORMES = ['Titular (Azul)', 'Alterna (Blanco)', 'Chalecos'];
const dispInfo = (v) => DISPONIBILIDAD_CONVOCATORIA.find((d) => d.value === v) ?? DISPONIBILIDAD_CONVOCATORIA[2];

const Convocatoria = () => {
  const { user } = useAuth();
  const { alumnos: alumnosRaw, loading: loadingAlumnos } = useAlumnos();
  const { convocatorias, loading: loadingConv } = useConvocatorias(10);
  const alumnos = useMemo(() => alumnosRaw.map(withDefaults), [alumnosRaw]);

  const [vista, setVista] = useState('crear'); // crear | historial
  const [detalles, setDetalles] = useState({
    titulo: '', rival: '', categoria: '6',
    fecha: formatDateLima().iso, hora: '09:00',
    lugar: 'Estadio Municipal', uniforme: UNIFORMES[0],
    observaciones: '',
  });

  const [convocados, setConvocados] = useState([]);
  const [noConvocados, setNoConvocados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Modal para motivo de no convocado
  const [motivoModal, setMotivoModal] = useState(null); // { alumno, motivo }
  // Modal para ver convocatoria del historial
  const [vistaConv, setVistaConv] = useState(null);

  /* === Alumnos disponibles para la categoría === */
  const alumnosCat = useMemo(
    () => alumnos
      .filter((a) => a.categoria === detalles.categoria)
      .sort((a, b) => (a.apellido ?? '').localeCompare(b.apellido ?? '')),
    [alumnos, detalles.categoria],
  );

  const alumnosFiltrados = useMemo(() => {
    const term = busqueda.toLowerCase();
    if (!term) return alumnosCat;
    return alumnosCat.filter((a) =>
      `${a.nombre} ${a.apellido} ${a.dni}`.toLowerCase().includes(term)
      || (a.etiquetas ?? []).some((t) => t.toLowerCase().includes(term)),
    );
  }, [alumnosCat, busqueda]);

  const yaConvocadoIds = new Set(convocados.map((c) => c.id));
  const yaNoConvIds = new Set(noConvocados.map((c) => c.id));

  /* === Handlers: selección === */
  const convocar = (al) => {
    if (yaConvocadoIds.has(al.id)) return;
    setConvocados((prev) => [...prev, {
      id: al.id, nombre: al.nombre, apellido: al.apellido,
      disponibilidad: 'pendiente',
      checklist: [],
      alertas: getAlertas(al),
    }]);
    setNoConvocados((prev) => prev.filter((n) => n.id !== al.id));
    audit('convocar_jugador', { alumnoId: al.id, nombre: `${al.nombre} ${al.apellido}`, categoria: detalles.categoria }, user);
  };

  const desconvocar = (id) => {
    const c = convocados.find((x) => x.id === id);
    setConvocados((prev) => prev.filter((x) => x.id !== id));
    if (c) audit('desconvocar_jugador', { alumnoId: id, nombre: `${c.nombre} ${c.apellido}` }, user);
  };

  const registrarNoConvocado = (al) => {
    setMotivoModal({ alumno: al, motivo: MOTIVOS_NO_CONVOCADO[0] });
  };

  const confirmarNoConvocado = () => {
    if (!motivoModal) return;
    const { alumno: al, motivo } = motivoModal;
    setNoConvocados((prev) => [...prev.filter((n) => n.id !== al.id), {
      id: al.id, nombre: al.nombre, apellido: al.apellido, motivo,
    }]);
    setConvocados((prev) => prev.filter((c) => c.id !== al.id));
    audit('registrar_no_convocado', { alumnoId: al.id, nombre: `${al.nombre} ${al.apellido}`, motivo }, user);
    setMotivoModal(null);
  };

  const setDisponibilidad = (id, disp) => {
    const prev = convocados.find((c) => c.id === id)?.disponibilidad;
    setConvocados((arr) => arr.map((c) => c.id === id ? { ...c, disponibilidad: disp } : c));
    if (prev !== disp) {
      audit('cambiar_disponibilidad', { alumnoId: id, de: prev, a: disp }, user);
    }
  };

  const toggleChecklist = (id, item) => {
    setConvocados((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const cl = c.checklist.includes(item)
        ? c.checklist.filter((i) => i !== item)
        : [...c.checklist, item];
      return { ...c, checklist: cl };
    }));
    audit('toggle_checklist', { alumnoId: id, item }, user);
  };

  const cambiarCategoria = (cat) => {
    setDetalles((prev) => ({ ...prev, categoria: cat }));
    setConvocados([]); setNoConvocados([]); setBusqueda('');
  };

  /* === Alertas por alumno === */
  const getAlertas = (al) => {
    const alertas = [];
    if (ESTADOS_ALERTA.includes(al.estado)) alertas.push(al.estado);
    if ((al.etiquetas ?? []).includes('Asistencia baja')) alertas.push('baja_asistencia');
    return alertas;
  };

  /* === Métricas === */
  const confirmados = convocados.filter((c) => c.disponibilidad === 'confirmado').length;
  const pendientes = convocados.filter((c) => c.disponibilidad === 'pendiente').length;
  const noDisp = convocados.filter((c) => c.disponibilidad === 'no_disponible').length;
  const conAlertas = convocados.filter((c) => c.alertas.length > 0).length;

  /* === Publicar === */
  const publicar = async () => {
    if (!detalles.rival.trim() && !detalles.titulo.trim()) return toast.error('Ingresa un título o rival.');
    if (convocados.length === 0) return toast.error('Convoca al menos un jugador.');
    setGuardando(true);
    const tituloFinal = detalles.titulo.trim() || `vs ${detalles.rival.trim()}`;
    try {
      await mutarConvocatorias.crear({
        ...detalles, titulo: tituloFinal,
        convocados, noConvocados,
        creador: user?.nombre ?? user?.email ?? 'staff',
        estado: 'Publicada',
      });
      await audit('crear_convocatoria', {
        titulo: tituloFinal, categoria: detalles.categoria,
        totalConvocados: convocados.length, totalNoConvocados: noConvocados.length,
      }, user);

      // WhatsApp
      const msg = buildWhatsApp(detalles, tituloFinal, convocados);
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');

      toast.success('Convocatoria publicada.');
      setConvocados([]); setNoConvocados([]);
      setDetalles((p) => ({ ...p, titulo: '', rival: '', observaciones: '' }));
    } catch {
      toast.error('No se pudo guardar la convocatoria.');
    } finally { setGuardando(false); }
  };

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        <header style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <span style={eyebrowStyle}>DEPORTIVO · LOGÍSTICA</span>
            <h1 style={titleStyle}>Convocatoria</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant={vista === 'crear' ? 'primary' : 'secondary'} onClick={() => setVista('crear')}>
              Nueva
            </Button>
            <Button size="sm" variant={vista === 'historial' ? 'primary' : 'secondary'} onClick={() => setVista('historial')}>
              Historial
            </Button>
          </div>
        </header>

        {vista === 'historial' ? (
          <HistorialPanel convocatorias={convocatorias} loading={loadingConv} onVer={setVistaConv} />
        ) : (
          <>
            {/* === KPIs === */}
            {convocados.length > 0 && (
              <div style={kpiRowStyle} className="sn-conv-kpi">
                <MiniKpi label="Convocados" value={convocados.length} color="var(--sn-brand-glow)" />
                <MiniKpi label="Confirmados" value={confirmados} color="var(--sn-success)" />
                <MiniKpi label="Pendientes" value={pendientes} color="var(--sn-warn)" />
                <MiniKpi label="No disp." value={noDisp} color="var(--sn-crit)" />
                {conAlertas > 0 && <MiniKpi label="Alertas" value={conAlertas} color="var(--sn-crit)" />}
              </div>
            )}

            <div className="sn-conv-grid" style={mainGridStyle}>
              {/* === COL 1: Detalles + selección === */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>

                {/* Detalles del partido */}
                <Card>
                  <CardBody>
                    <SectionHead title="Detalles del encuentro" />
                    <div className="sn-conv-form" style={formGridStyle}>
                      <Field label="Título (opcional)">
                        <input value={detalles.titulo} onChange={(e) => setDetalles((p) => ({ ...p, titulo: e.target.value }))}
                          placeholder="Ej: Amistoso preparatorio" className="sn-focusable" style={inputStyle} />
                      </Field>
                      <Field label="Equipo rival / evento">
                        <input value={detalles.rival} onChange={(e) => setDetalles((p) => ({ ...p, rival: e.target.value }))}
                          placeholder="Ej: ACADEMIA CANTOLAO" className="sn-focusable"
                          style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 700 }} />
                      </Field>
                      <Field label="Categoría">
                        <select value={detalles.categoria} onChange={(e) => cambiarCategoria(e.target.value)}
                          className="sn-focusable" style={inputStyle}>
                          {CATEGORIAS.map((c) => <option key={c} value={c}>Cat. {c}</option>)}
                        </select>
                      </Field>
                      <Field label="Indumentaria">
                        <select value={detalles.uniforme} onChange={(e) => setDetalles((p) => ({ ...p, uniforme: e.target.value }))}
                          className="sn-focusable" style={inputStyle}>
                          {UNIFORMES.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </Field>
                      <Field label="Fecha">
                        <input type="date" value={detalles.fecha} onChange={(e) => setDetalles((p) => ({ ...p, fecha: e.target.value }))}
                          className="sn-focusable" style={inputStyle} />
                      </Field>
                      <Field label="Hora">
                        <input type="time" value={detalles.hora} onChange={(e) => setDetalles((p) => ({ ...p, hora: e.target.value }))}
                          className="sn-focusable" style={inputStyle} />
                      </Field>
                      <Field label="Lugar" full>
                        <input value={detalles.lugar} onChange={(e) => setDetalles((p) => ({ ...p, lugar: e.target.value }))}
                          className="sn-focusable" style={inputStyle} />
                      </Field>
                      <Field label="Observaciones internas" full>
                        <textarea value={detalles.observaciones} onChange={(e) => setDetalles((p) => ({ ...p, observaciones: e.target.value }))}
                          rows={2} placeholder="Solo visible para staff…"
                          className="sn-focusable" style={{ ...inputStyle, fontFamily: 'var(--sn-font-ui)', resize: 'vertical' }} />
                      </Field>
                    </div>
                  </CardBody>
                </Card>

                {/* Plantilla disponible */}
                <Card>
                  <CardBody style={{ padding: 0 }}>
                    <div style={panelHeaderStyle}>
                      <div>
                        <SectionHead title="Plantilla disponible" />
                        <span style={subLabelStyle}>{alumnosCat.length} jugadores en Cat. {detalles.categoria}</span>
                      </div>
                      <div style={searchWrapSmall}>
                        <SearchIcon />
                        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar…" className="sn-focusable" style={searchInputSmall} />
                      </div>
                    </div>

                    <div className="sn-scroll" style={{ padding: 'var(--sn-space-3)', maxHeight: 460, overflow: 'auto' }}>
                      {loadingAlumnos ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 56 }} />)}
                        </div>
                      ) : alumnosFiltrados.length === 0 ? (
                        <EmptyState title={`Sin jugadores${busqueda ? ' con esa búsqueda' : ''}`} description="Cambia la categoría o el filtro." />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {alumnosFiltrados.map((al) => {
                            const isConv = yaConvocadoIds.has(al.id);
                            const isNoConv = yaNoConvIds.has(al.id);
                            const alertas = getAlertas(al);
                            return (
                              <div key={al.id} style={playerRowStyle(isConv)}>
                                <PlayerAvatar al={al} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-sm)' }}>
                                    {al.apellido}, {al.nombre}
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                    <StatusBadge value={al.estado} />
                                    {alertas.length > 0 && <Badge tone="crit" size="sm">Alerta</Badge>}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                  {!isConv && !isNoConv && (
                                    <>
                                      <Button size="sm" variant="primary" onClick={() => convocar(al)}>Convocar</Button>
                                      <Button size="sm" variant="ghost" onClick={() => registrarNoConvocado(al)} style={{ color: 'var(--sn-text-muted)' }}>
                                        No
                                      </Button>
                                    </>
                                  )}
                                  {isConv && <Badge tone="success">Convocado</Badge>}
                                  {isNoConv && <Badge tone="neutral">Excluido</Badge>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* === COL 2: Convocados + no convocados === */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>

                {/* Lista de convocados */}
                <Card>
                  <CardBody style={{ padding: 0 }}>
                    <div style={panelHeaderStyle}>
                      <SectionHead title={`Convocados (${convocados.length})`} />
                    </div>
                    <div style={{ padding: 'var(--sn-space-3)' }}>
                      {convocados.length === 0 ? (
                        <EmptyState title="Sin convocados" description="Selecciona jugadores de la plantilla." />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {convocados.map((c, idx) => (
                            <ConvocadoCard
                              key={c.id} c={c} idx={idx}
                              onChangeDisp={(d) => setDisponibilidad(c.id, d)}
                              onToggleCheck={(item) => toggleChecklist(c.id, item)}
                              onRemove={() => desconvocar(c.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>

                {/* No convocados */}
                {noConvocados.length > 0 && (
                  <Card>
                    <CardBody style={{ padding: 0 }}>
                      <div style={panelHeaderStyle}>
                        <SectionHead title={`No convocados (${noConvocados.length})`} />
                      </div>
                      <div style={{ padding: 'var(--sn-space-3)' }}>
                        {noConvocados.map((nc) => (
                          <div key={nc.id} style={noConvRowStyle}>
                            <span style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-sm)' }}>
                              {nc.apellido}, {nc.nombre}
                            </span>
                            <Badge tone="neutral" size="sm">{nc.motivo}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Botones publicar + imprimir */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="success" size="lg" loading={guardando}
                    disabled={convocados.length === 0 || (!detalles.rival.trim() && !detalles.titulo.trim())}
                    icon={<WhatsappIcon />}
                    onClick={publicar}
                    style={{ flex: 1 }}
                  >
                    Publicar y compartir
                  </Button>
                  <Button
                    variant="secondary" size="lg"
                    disabled={convocados.length === 0}
                    icon={<PrintIcon />}
                    onClick={() => window.print()}
                    title="Imprimir convocatoria"
                    style={{ flexShrink: 0 }}
                  >
                    Imprimir
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* === VISTA IMPRIMIBLE (solo visible al imprimir) === */}
      {convocados.length > 0 && (
        <div className="sn-conv-print-only" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 20 }}>FC SECHURA — CONVOCATORIA OFICIAL</h2>
            <h3 style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 16 }}>
              {detalles.titulo.trim() || `vs ${detalles.rival.trim()}`}
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 13, marginBottom: 16 }}>
            <div><strong>Categoría:</strong> {detalles.categoria}</div>
            <div><strong>Uniforme:</strong> {detalles.uniforme}</div>
            <div><strong>Fecha:</strong> {detalles.fecha?.split('-').reverse().join('/')}</div>
            <div><strong>Hora:</strong> {detalles.hora}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Lugar:</strong> {detalles.lugar}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={printThStyle}>#</th>
                <th style={{ ...printThStyle, textAlign: 'left' }}>Jugador</th>
                <th style={printThStyle}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {convocados.map((c, i) => (
                <tr key={c.id}>
                  <td style={printTdStyle}>{i + 1}</td>
                  <td style={{ ...printTdStyle, textAlign: 'left' }}>{c.apellido}, {c.nombre}</td>
                  <td style={printTdStyle}>{dispInfo(c.disponibilidad).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16, fontSize: 11, color: '#666', textAlign: 'center' }}>
            FC Sechura — Formando campeones · {detalles.fecha?.split('-').reverse().join('/')}
          </div>
        </div>
      )}

      {/* === MODAL: Motivo no convocado === */}
      <Modal
        open={!!motivoModal}
        onClose={() => setMotivoModal(null)}
        title="Registrar motivo"
        description={motivoModal ? `¿Por qué ${motivoModal.alumno.nombre} ${motivoModal.alumno.apellido} no fue convocado?` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMotivoModal(null)}>Cancelar</Button>
            <Button variant="primary" onClick={confirmarNoConvocado}>Registrar</Button>
          </>
        }
      >
        {motivoModal && (
          <select value={motivoModal.motivo} onChange={(e) => setMotivoModal((p) => ({ ...p, motivo: e.target.value }))}
            className="sn-focusable" style={inputStyle}>
            {MOTIVOS_NO_CONVOCADO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </Modal>

      {/* === MODAL: Ver convocatoria del historial === */}
      <Modal
        open={!!vistaConv}
        onClose={() => setVistaConv(null)}
        title={vistaConv?.titulo ?? 'Convocatoria'}
        description={vistaConv ? `Cat. ${vistaConv.categoria} · ${vistaConv.fecha?.split('-').reverse().join('/')}` : ''}
        size="lg"
      >
        {vistaConv && <HistorialDetalle conv={vistaConv} />}
      </Modal>

      <style>{`
        @media (max-width: 991.98px) {
          .sn-conv-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .sn-conv-form { grid-template-columns: 1fr !important; }
          .sn-conv-kpi { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media print {
          .hide-on-print, nav, footer, .sn-app-credit { display: none !important; }
          .sn-conv-print-only { display: block !important; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
};

/* =============================================================
   ConvocadoCard — card con disponibilidad + checklist
   ============================================================= */
const ConvocadoCard = ({ c, idx, onChangeDisp, onToggleCheck, onRemove }) => {
  const [checkOpen, setCheckOpen] = useState(false);
  const di = dispInfo(c.disponibilidad);
  const checkDone = c.checklist.length;
  const checkTotal = CHECKLIST_CONVOCATORIA.length;

  return (
    <div style={convCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={convNumStyle}>{idx + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-sm)' }}>
            {c.apellido}, {c.nombre}
          </div>
          {c.alertas?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              {c.alertas.map((a) => <Badge key={a} tone="crit" size="sm">{a}</Badge>)}
            </div>
          )}
        </div>
        <select value={c.disponibilidad} onChange={(e) => onChangeDisp(e.target.value)}
          className="sn-focusable" style={{ ...inputSmallStyle, color: di.color, fontWeight: 700 }}>
          {DISPONIBILIDAD_CONVOCATORIA.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button type="button" className="sn-focusable" onClick={onRemove} style={removeBtnStyle} title="Quitar">×</button>
      </div>

      {/* Checklist toggle */}
      <div style={{ marginTop: 8 }}>
        <button type="button" className="sn-focusable" onClick={() => setCheckOpen((v) => !v)}
          style={checkToggleStyle}>
          <span>{checkDone}/{checkTotal} completados</span>
          <span style={{ transform: checkOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </button>
        {checkOpen && (
          <div style={checkGridStyle}>
            {CHECKLIST_CONVOCATORIA.map((item) => (
              <label key={item} style={checkLabelStyle} className="sn-focusable">
                <input type="checkbox" checked={c.checklist.includes(item)}
                  onChange={() => onToggleCheck(item)}
                  style={{ width: 16, height: 16, accentColor: 'var(--sn-success)', cursor: 'pointer' }} />
                <span style={{ color: c.checklist.includes(item) ? 'var(--sn-text-primary)' : 'var(--sn-text-muted)' }}>
                  {item}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* =============================================================
   Historial
   ============================================================= */
const HistorialPanel = ({ convocatorias, loading, onVer }) => {
  if (loading) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 80 }} />)}</div>;
  }
  if (convocatorias.length === 0) {
    return <Card><CardBody><EmptyState title="Sin historial" description="Las convocatorias publicadas aparecerán aquí." /></CardBody></Card>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
      {convocatorias.map((c) => (
        <Card key={c.id}>
          <CardBody style={{ display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)' }}>{c.titulo ?? `vs ${c.rival ?? '—'}`}</div>
              <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', marginTop: 2 }}>
                Cat. {c.categoria} · {c.fecha?.split('-').reverse().join('/') ?? '—'} · {c.hora ?? '—'}
              </div>
            </div>
            <Badge tone="brand">{(c.convocados ?? c.jugadoresConvocados)?.length ?? 0} convocados</Badge>
            <Button size="sm" variant="secondary" onClick={() => onVer(c)}>Ver</Button>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};

const HistorialDetalle = ({ conv }) => {
  const lista = conv.convocados ?? conv.jugadoresConvocados ?? [];
  const noConv = conv.noConvocados ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
      <div style={histMetaStyle}>
        <div><strong>Lugar:</strong> {conv.lugar ?? '—'}</div>
        <div><strong>Hora:</strong> {conv.hora ?? '—'}</div>
        <div><strong>Uniforme:</strong> {conv.uniforme ?? '—'}</div>
        <div><strong>Creador:</strong> {conv.creador ?? '—'}</div>
      </div>
      <div>
        <span style={subLabelStyle}>Convocados ({lista.length})</span>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lista.map((j, i) => (
            <div key={j.id ?? i} style={histRowStyle}>
              <span style={convNumStyle}>{i + 1}</span>
              <span style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-sm)' }}>
                {j.apellido ?? ''}, {j.nombre ?? ''}
              </span>
              {j.disponibilidad && <DispBadge value={j.disponibilidad} />}
            </div>
          ))}
        </div>
      </div>
      {noConv.length > 0 && (
        <div>
          <span style={subLabelStyle}>No convocados ({noConv.length})</span>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {noConv.map((nc, i) => (
              <div key={nc.id ?? i} style={histRowStyle}>
                <span style={{ fontWeight: 700, color: 'var(--sn-text-secondary)', fontSize: 'var(--sn-fs-sm)' }}>
                  {nc.apellido ?? ''}, {nc.nombre ?? ''}
                </span>
                <Badge tone="neutral" size="sm">{nc.motivo ?? '—'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* =============================================================
   Helpers / sub-componentes
   ============================================================= */
const SectionHead = ({ title }) => (
  <h4 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' }}>
    {title}
  </h4>
);

const Field = ({ label, children, full }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, ...(full ? { gridColumn: '1 / -1' } : {}) }}>
    <span style={fieldLabelStyle}>{label}</span>
    {children}
  </label>
);

const MiniKpi = ({ label, value, color }) => (
  <div style={kpiBoxStyle}>
    <div style={{ fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-xl)', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 700, color: 'var(--sn-text-muted)', marginTop: 4 }}>{label}</div>
  </div>
);

const PlayerAvatar = ({ al }) => (
  al.foto
    ? <img src={al.foto} alt="" style={avatarStyle} />
    : <div style={{ ...avatarStyle, background: 'var(--sn-brand-gradient)', color: '#06121A', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
        {(al.nombre ?? '?')[0]}{(al.apellido ?? '')[0]}
      </div>
);

const DispBadge = ({ value }) => {
  const d = dispInfo(value);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--sn-fs-xs)', fontWeight: 700, color: d.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color }} />
      {d.label}
    </span>
  );
};

const buildWhatsApp = (detalles, titulo, convocados) => {
  let msg = `🏆 *CONVOCATORIA OFICIAL · FC SECHURA* 🏆\n\n`;
  msg += `📋 *${titulo.toUpperCase()}*\n`;
  if (detalles.rival) msg += `⚽ *VS:* ${detalles.rival.toUpperCase()}\n`;
  msg += `👦 *Cat:* ${detalles.categoria}  ·  👕 *Kit:* ${detalles.uniforme}\n`;
  msg += `📅 *Fecha:* ${detalles.fecha.split('-').reverse().join('/')}  ·  ⏰ *Hora:* ${detalles.hora}\n`;
  msg += `🏟️ *Cancha:* ${detalles.lugar}\n\n`;
  msg += `📋 *LISTA DE CONVOCADOS (${convocados.length}):*\n`;
  convocados.forEach((j, i) => {
    msg += `${i + 1}. ${j.apellido}, ${j.nombre}\n`;
  });
  msg += `\n🔥 ¡A dejarlo todo en la cancha! Se exige puntualidad.\n`;
  msg += `📌 FC Sechura — Formando campeones.`;
  return msg;
};

/* =============================================================
   Iconos
   ============================================================= */
const WhatsappIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01ZM12.05 20.15h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.41 8.16 8.16 0 0 1 2.41 5.83 8.25 8.25 0 0 1-8.25 8.24Z"/></svg>);
const SearchIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>);
const PrintIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>);

/* =============================================================
   Estilos
   ============================================================= */
const pageBg = { minHeight: 'calc(100vh - 73px)', background: 'var(--sn-bg-base)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
const contentWrap = { maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)' };

const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sn-space-3)', flexWrap: 'wrap', marginBottom: 'var(--sn-space-4)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.2rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const subLabelStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-wide)', textTransform: 'uppercase', color: 'var(--sn-text-muted)' };

const fieldLabelStyle = {
  fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  letterSpacing: 'var(--sn-tracking-wide)', textTransform: 'uppercase',
  color: 'var(--sn-text-secondary)',
};

const inputStyle = {
  width: '100%', background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)', borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0.85rem', outline: 'none', minHeight: 44,
};

const inputSmallStyle = {
  background: 'var(--sn-input-bg)', border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-sm)', color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-xs)',
  padding: '4px 8px', outline: 'none', minHeight: 32, width: 'auto',
};

const mainGridStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 'var(--sn-space-5)', alignItems: 'start' };

const formGridStyle = {
  display: 'grid', gridTemplateColumns: '1fr 1fr',
  gap: 'var(--sn-space-3)', marginTop: 'var(--sn-space-3)',
};

const panelHeaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 'var(--sn-space-3)', padding: 'var(--sn-space-4) var(--sn-space-5)',
  borderBottom: '1px solid var(--sn-border-faint)',
  flexWrap: 'wrap',
};

const kpiRowStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 'var(--sn-space-3)', marginBottom: 'var(--sn-space-4)',
};

const kpiBoxStyle = {
  textAlign: 'center', padding: 'var(--sn-space-3)',
  background: 'var(--sn-bg-surface)', border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const playerRowStyle = (sel) => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 10px', borderRadius: 'var(--sn-radius-md)',
  background: sel ? 'color-mix(in srgb, var(--sn-brand-glow) 10%, transparent)' : 'var(--sn-row-soft)',
  border: `1px solid ${sel ? 'var(--sn-border-glow)' : 'var(--sn-border-faint)'}`,
});

const avatarStyle = {
  width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
  border: '1px solid var(--sn-border-faint)', flexShrink: 0,
};

const convCardStyle = {
  padding: 'var(--sn-space-3)',
  background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const convNumStyle = {
  width: 24, height: 24, borderRadius: '50%',
  background: 'var(--sn-brand-gradient)', color: '#06121A',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 900, fontSize: 11, flexShrink: 0,
};

const removeBtnStyle = {
  width: 28, height: 28, borderRadius: '50%',
  background: 'transparent', border: '1px solid var(--sn-border-faint)',
  color: 'var(--sn-crit)', cursor: 'pointer', fontSize: 16,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const checkToggleStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', background: 'transparent', border: 'none',
  color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-xs)',
  fontWeight: 700, cursor: 'pointer', padding: '4px 0',
};

const checkGridStyle = {
  display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4,
};

const checkLabelStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '4px 0', cursor: 'pointer',
  fontSize: 'var(--sn-fs-xs)', fontWeight: 600, minHeight: 28,
};

const noConvRowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 8, padding: '8px 10px',
  borderBottom: '1px solid var(--sn-border-faint)',
};

const searchWrapSmall = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'var(--sn-input-bg)', border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)', padding: '0 8px',
  color: 'var(--sn-text-muted)', maxWidth: 200,
};

const searchInputSmall = {
  flex: 1, background: 'transparent', border: 'none', outline: 'none',
  color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-xs)', padding: '6px 0',
};

const histMetaStyle = {
  display: 'grid', gridTemplateColumns: '1fr 1fr',
  gap: 'var(--sn-space-2)',
  fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-secondary)',
};

const histRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 8px', borderRadius: 'var(--sn-radius-sm)',
  background: 'var(--sn-row-soft)', border: '1px solid var(--sn-border-faint)',
};

const printThStyle = { padding: '6px 8px', borderBottom: '2px solid #333', textAlign: 'center', fontWeight: 800, fontSize: 12 };
const printTdStyle = { padding: '5px 8px', borderBottom: '1px solid #ddd', textAlign: 'center' };

export default Convocatoria;
