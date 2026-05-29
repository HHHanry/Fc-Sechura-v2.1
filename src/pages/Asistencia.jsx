import React, { useMemo, useRef, useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useAlumnos } from '../hooks/useAlumnos';
import { useAsistenciaHoy, mutarAsistencia } from '../hooks/useAsistencia';
import { toast } from '../hooks/useToast';
import { ANTI_REBOTE_QR_MS, ESTADOS_ASISTENCIA, CATEGORIAS, formatDateLima, formatMoney } from '../config/businessRules';
import { Card, CardBody, Button, Badge, Modal, EmptyState, Skeleton } from '../components/ui';
import { serverTimestamp } from 'firebase/firestore';

const PRECIO_CANCHA = 3;
const HORA_TARDE = 21;

const Asistencia = () => {
  const { alumnos } = useAlumnos();
  const { dmy: fechaHoyDmy } = formatDateLima();
  const { asistencias } = useAsistenciaHoy(fechaHoyDmy);

  const [camaraActiva, setCamaraActiva]   = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [aEliminar, setAEliminar]         = useState(null);
  const [eliminando, setEliminando]       = useState(false);
  const [manualOpen, setManualOpen]       = useState(false);
  const [busquedaManual, setBusquedaManual] = useState('');
  const [filtroCatManual, setFiltroCatManual] = useState('Todas');
  const [ultimoEvento, setUltimoEvento]   = useState(null);

  const bloqueosQR = useRef({});

  const reproducirBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880; gain.gain.value = 0.05;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
    } catch { /* ignore */ }
  };

  const procesarRegistro = async (dni, esManual = false) => {
    if (!dni) return;
    const ahora = Date.now();

    if (!esManual) {
      const ultimo = bloqueosQR.current[dni] || 0;
      if (ahora - ultimo < ANTI_REBOTE_QR_MS) return;
      bloqueosQR.current[dni] = ahora;
    }

    const horaActual = new Date().getHours();
    const horaExacta = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const yaRegistrado = asistencias.find((a) => a.dni === dni);
    const alumno = alumnos.find((a) => a.dni === dni);

    if (!yaRegistrado) {
      const estado = horaActual >= HORA_TARDE ? ESTADOS_ASISTENCIA.TARDE : ESTADOS_ASISTENCIA.ASISTIO;
      const datos = {
        alumnoId: alumno?.id ?? null,
        nombre:   alumno ? `${alumno.nombre} ${alumno.apellido}` : 'Desconocido',
        dni,
        categoria: alumno?.categoria ?? '-',
        fecha: fechaHoyDmy,
        horaIngreso: horaExacta,
        horaSalida: '--:--',
        estado,
        pagoCancha: false,
        montoCancha: 0,
        createdAt: serverTimestamp(),
      };
      try {
        await mutarAsistencia.registrar(datos);
        reproducirBeep();
        setUltimoEvento({ tipo: estado === ESTADOS_ASISTENCIA.TARDE ? 'warn' : 'success', titulo: esManual ? 'Ingreso manual OK' : 'Ingreso registrado', nombre: datos.nombre });
        toast.success(`${datos.nombre} → ${estado}`);
      } catch {
        toast.error('No se pudo registrar el ingreso.');
      }
    } else {
      const teniaSalida = yaRegistrado.horaSalida && yaRegistrado.horaSalida !== '--:--';
      try {
        await mutarAsistencia.actualizar(yaRegistrado.id, { horaSalida: horaExacta });
        reproducirBeep();
        setUltimoEvento({
          tipo: teniaSalida ? 'warn' : 'brand',
          titulo: teniaSalida ? 'Salida actualizada' : (esManual ? 'Salida manual OK' : 'Salida registrada'),
          nombre: yaRegistrado.nombre,
        });
        toast.info(`${yaRegistrado.nombre} → salida ${horaExacta}`);
      } catch {
        toast.error('No se pudo actualizar la salida.');
      }
    }
    setTimeout(() => setUltimoEvento(null), 3500);
  };

  const handleScan = (resultadoLib) => {
    if (!resultadoLib) return;
    let texto = '';
    if (typeof resultadoLib === 'string') texto = resultadoLib;
    else if (Array.isArray(resultadoLib) && resultadoLib.length > 0) texto = resultadoLib[0].rawValue;
    procesarRegistro((texto ?? '').trim(), false);
  };

  const togglePagoCancha = async (asis) => {
    const nuevoEstado = !asis.pagoCancha;
    try {
      await mutarAsistencia.actualizar(asis.id, { pagoCancha: nuevoEstado, montoCancha: nuevoEstado ? PRECIO_CANCHA : 0 });
    } catch {
      toast.error('No se pudo actualizar el pago de cancha.');
    }
  };

  const eliminar = async () => {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      await mutarAsistencia.eliminar(aEliminar.id);
      toast.success('Registro eliminado.');
      setAEliminar(null);
    } catch {
      toast.error('No se pudo eliminar.');
    } finally { setEliminando(false); }
  };

  const visibles = useMemo(
    () => asistencias.filter((a) => filtroCategoria === 'Todas' ? true : a.categoria === filtroCategoria),
    [asistencias, filtroCategoria],
  );

  const cajaChica = asistencias.filter((a) => a.pagoCancha).length * PRECIO_CANCHA;

  const alumnosManual = useMemo(() => {
    const term = busquedaManual.toLowerCase();
    return alumnos
      .filter((a) => {
        const ok = !term
          || a.nombre?.toLowerCase().includes(term)
          || a.apellido?.toLowerCase().includes(term)
          || a.dni?.includes(term);
        const cat = filtroCatManual === 'Todas' || a.categoria === filtroCatManual;
        return ok && cat;
      })
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));
  }, [alumnos, busquedaManual, filtroCatManual]);

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        {/* === HEADER === */}
        <header style={headerStyle}>
          <div>
            <span style={eyebrowStyle}>OPERACIONES · TIEMPO REAL</span>
            <h1 style={titleStyle}>Asistencia</h1>
            <p style={leadStyle}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--sn-success)', marginRight: 8, animation: 'sn-pulse-glow 2s var(--sn-ease) infinite' }} />
              Sincronización automática con Firebase · {fechaHoyDmy}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sn-space-3)', flexWrap: 'wrap' }}>
            <Button variant="ghost" icon={<KeyboardIcon />} onClick={() => setManualOpen(true)}>Registro manual</Button>
            <Button
              variant={camaraActiva ? 'danger' : 'primary'}
              icon={camaraActiva ? <CameraOffIcon /> : <CameraIcon />}
              onClick={() => setCamaraActiva((v) => !v)}
            >
              {camaraActiva ? 'Cerrar lector' : 'Abrir lector'}
            </Button>
          </div>
        </header>

        <div style={mainGridStyle} className="sn-asistencia-grid">
          {/* === SCANNER === */}
          <Card>
            <CardBody style={{ padding: 0 }}>
              <div style={panelHeaderStyle}>
                <h3 style={panelTitleStyle}>Escáner de identidad</h3>
                <Badge tone={camaraActiva ? 'success' : 'neutral'}>{camaraActiva ? 'En vivo' : 'Pausado'}</Badge>
              </div>
              <div style={scannerWrapStyle}>
                {camaraActiva ? (
                  <>
                    <Scanner onScan={handleScan} onResult={handleScan} options={{ delayBetweenScanAttempts: 2000 }} />
                    <div style={scanLineStyle} aria-hidden />
                  </>
                ) : (
                  <div style={scannerEmptyStyle}>
                    <QrIcon size={64} />
                    <p style={{ margin: 'var(--sn-space-3) 0 0', color: 'var(--sn-text-muted)' }}>Cámara desactivada</p>
                  </div>
                )}

                {ultimoEvento && (
                  <div style={{ ...feedbackOverlayStyle, ...feedbackTone(ultimoEvento.tipo) }}>
                    <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', opacity: 0.85 }}>
                      {ultimoEvento.titulo}
                    </span>
                    <span style={{ fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-md)', fontWeight: 700 }}>
                      {ultimoEvento.nombre}
                    </span>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* === TABLA === */}
          <Card>
            <CardBody style={{ padding: 0 }}>
              <div style={panelHeaderStyle}>
                <div>
                  <h3 style={panelTitleStyle}>Tránsito del día</h3>
                  <span style={subLabelStyle}>{visibles.length} registros visibles</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={selectStyle} className="sn-focusable">
                    <option value="Todas">Todas las cat.</option>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>Cat. {c}</option>)}
                  </select>
                  <Badge tone="success" size="lg">Caja chica · {formatMoney(cajaChica)}</Badge>
                </div>
              </div>

              {visibles.length === 0 ? (
                <EmptyState
                  title={asistencias.length === 0 ? 'Sin registros hoy' : 'Sin coincidencias'}
                  description={asistencias.length === 0
                    ? 'Cuando alguien escanee su QR aparecerá aquí en tiempo real.'
                    : 'No hay registros de esta categoría.'}
                />
              ) : (
                <ul style={{ listStyle: 'none', padding: 'var(--sn-space-3)', margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-2)' }}>
                  {visibles.map((a) => (
                    <li key={a.id} style={rowStyle}>
                      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</div>
                        <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontFamily: 'var(--sn-font-mono)' }}>
                          DNI {a.dni} · Cat. {a.categoria}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-sm)' }}>
                        <span style={{ color: 'var(--sn-success)' }}>{a.horaIngreso}</span>
                        <span style={{ color: 'var(--sn-text-dim)', margin: '0 6px' }}>→</span>
                        <span style={{ color: a.horaSalida === '--:--' ? 'var(--sn-text-dim)' : 'var(--sn-crit)' }}>{a.horaSalida}</span>
                      </div>
                      <button onClick={() => togglePagoCancha(a)} style={canchaBtnStyle(a.pagoCancha)} className="sn-focusable">
                        {a.pagoCancha ? `Pagó ${formatMoney(PRECIO_CANCHA)}` : `Cancha ${formatMoney(PRECIO_CANCHA)}`}
                      </button>
                      <Badge tone={a.estado === 'Asistió' ? 'success' : a.estado === 'Tarde' ? 'warn' : 'crit'}>
                        {a.estado}
                      </Badge>
                      <button onClick={() => setAEliminar(a)} style={iconBtnStyle} title="Eliminar registro" className="sn-focusable">
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* === Modal: registro manual === */}
      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        size="lg"
        title="Registro manual"
        description="Busca al alumno y márcale ingreso o salida sin pasar por el QR."
      >
        <div style={{ display: 'flex', gap: 'var(--sn-space-3)', marginBottom: 'var(--sn-space-4)', flexWrap: 'wrap' }}>
          <input
            type="text" value={busquedaManual} onChange={(e) => setBusquedaManual(e.target.value)}
            placeholder="Buscar por nombre o DNI..."
            className="sn-focusable" style={{ ...inputStyle, flex: '2 1 240px' }}
          />
          <select value={filtroCatManual} onChange={(e) => setFiltroCatManual(e.target.value)} style={{ ...inputStyle, flex: '1 1 140px' }} className="sn-focusable">
            <option value="Todas">Todas las cat.</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>Cat. {c}</option>)}
          </select>
        </div>

        <div className="sn-scroll" style={{ maxHeight: 380, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alumnosManual.length === 0 ? (
            <EmptyState title="Sin coincidencias" description="No encontré alumnos con ese filtro." />
          ) : (
            alumnosManual.map((al) => {
              const reg = asistencias.find((a) => a.dni === al.dni);
              const yaIngreso = !!reg;
              const yaSalio = yaIngreso && reg.horaSalida !== '--:--';
              return (
                <div key={al.id} style={manualRowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {al.nombre} {al.apellido}
                    </div>
                    <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontFamily: 'var(--sn-font-mono)' }}>
                      DNI {al.dni} · Cat. {al.categoria}
                    </div>
                  </div>
                  {!yaIngreso ? (
                    <Button size="sm" variant="primary" onClick={() => procesarRegistro(al.dni, true)}>Ingresó</Button>
                  ) : !yaSalio ? (
                    <Button size="sm" variant="ghost" onClick={() => procesarRegistro(al.dni, true)}>Marcar salida</Button>
                  ) : (
                    <Badge tone="success">Completado</Badge>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* === Modal: eliminar === */}
      <Modal
        open={!!aEliminar}
        onClose={() => setAEliminar(null)}
        size="sm"
        title="¿Eliminar registro?"
        description={aEliminar ? `Vas a borrar la asistencia de ${aEliminar.nombre}. Esta acción se sincroniza al instante.` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAEliminar(null)} disabled={eliminando}>Cancelar</Button>
            <Button variant="danger" onClick={eliminar} loading={eliminando}>Sí, eliminar</Button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--sn-space-3) 0' }}>
          <span style={dangerCircleStyle}>!</span>
        </div>
      </Modal>

      <style>{`
        @media (max-width: 991.98px) {
          .sn-asistencia-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes scan { 0% { top: 0 } 50% { top: 100% } 100% { top: 0 } }
      `}</style>
    </div>
  );
};

/* ============= iconos ============= */
const KeyboardIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/></svg>);
const CameraIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>);
const CameraOffIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1l22 22M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l3-3h6"/></svg>);
const QrIcon = ({ size = 24 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14h1v1h-1zM14 20h3v1h-3zM20 17h1v4"/></svg>);
const TrashIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>);

/* ============= estilos ============= */
const pageBg = {
  minHeight: 'calc(100vh - 73px)',
  background: 'var(--sn-bg-base)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
};

const contentWrap = {
  maxWidth: 1280, margin: '0 auto',
  padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)',
};

const headerStyle = {
  display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
  gap: 'var(--sn-space-4)', flexWrap: 'wrap', marginBottom: 'var(--sn-space-5)',
};

const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const leadStyle = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)', display: 'flex', alignItems: 'center' };

const mainGridStyle = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.7fr)', gap: 'var(--sn-space-5)',
};

const panelHeaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 'var(--sn-space-3)', flexWrap: 'wrap',
  padding: 'var(--sn-space-4) var(--sn-space-5)',
  borderBottom: '1px solid var(--sn-border-faint)',
};

const panelTitleStyle = { margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)' };
const subLabelStyle = { fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' };

const scannerWrapStyle = {
  position: 'relative',
  background: '#06080F',
  minHeight: 360,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  overflow: 'hidden',
  borderBottomLeftRadius: 'var(--sn-radius-lg)',
  borderBottomRightRadius: 'var(--sn-radius-lg)',
};

const scannerEmptyStyle = {
  textAlign: 'center', color: 'var(--sn-text-dim)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};

const scanLineStyle = {
  position: 'absolute', top: 0, left: 0, width: '100%', height: 3,
  background: 'rgba(34,211,238,0.65)',
  boxShadow: '0 0 14px var(--sn-brand-glow)',
  animation: 'scan 2.5s infinite linear',
};

const feedbackOverlayStyle = {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  padding: 'var(--sn-space-3) var(--sn-space-4)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: 4,
  textAlign: 'center',
  animation: 'sn-slide-up var(--sn-dur-base) var(--sn-ease)',
  borderTop: '1px solid currentColor',
};

const feedbackTone = (tone) => {
  const c = { success: 'var(--sn-success)', warn: 'var(--sn-warn)', brand: 'var(--sn-brand-glow)', crit: 'var(--sn-crit)' }[tone];
  return { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c };
};

const selectStyle = {
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-secondary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)',
  padding: '0.45rem 0.85rem', outline: 'none',
};

const inputStyle = {
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0.85rem', outline: 'none',
};

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  padding: '0.7rem 0.9rem',
  background: 'var(--sn-row-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const canchaBtnStyle = (pagado) => ({
  padding: '0.35rem 0.7rem',
  borderRadius: 'var(--sn-radius-pill)',
  fontWeight: 700,
  fontSize: 'var(--sn-fs-xs)',
  border: pagado ? '1px solid rgba(16,185,129,0.40)' : '1px solid var(--sn-border-soft)',
  background: pagado ? 'rgba(16,185,129,0.12)' : 'var(--sn-input-bg)',
  color: pagado ? 'var(--sn-success)' : 'var(--sn-text-muted)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: 'var(--sn-tracking-wide)',
});

const iconBtnStyle = {
  width: 32, height: 32, borderRadius: 'var(--sn-radius-sm)',
  background: 'transparent',
  color: 'var(--sn-text-muted)',
  border: '1px solid var(--sn-border-faint)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

const manualRowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '0.65rem 0.9rem',
  borderRadius: 'var(--sn-radius-md)',
  background: 'var(--sn-overlay-soft)',
  border: '1px solid var(--sn-border-faint)',
};

const dangerCircleStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 64, height: 64, borderRadius: '50%',
  background: 'rgba(239,68,68,0.10)',
  border: '1px solid rgba(239,68,68,0.40)',
  color: 'var(--sn-crit)', fontSize: 28, fontWeight: 900,
};

export default Asistencia;
