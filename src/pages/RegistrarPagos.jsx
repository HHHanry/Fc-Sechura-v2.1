import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAlumnos, mutarAlumnos } from '../hooks/useAlumnos';
import { useDeudasDeAlumno, mutarDeudas } from '../hooks/useDeudores';
import { mutarPagos } from '../hooks/usePagos';
import { toast } from '../hooks/useToast';
import {
  CATALOGO_PRECIOS, METODOS_PAGO, MESES, CATEGORIAS, formatMoney, formatDateLima,
} from '../config/businessRules';
import { Card, CardBody, Button, Badge, Modal, EmptyState } from '../components/ui';

const itemInicial = () => ({
  concepto: 'Mensualidad',
  monto: CATALOGO_PRECIOS['Mensualidad'],
  detalle: '',
  mesEspecifico: MESES[new Date().getMonth()],
});

const RegistrarPagos = () => {
  const location = useLocation();
  const { alumnos } = useAlumnos();
  const { iso: hoyIso } = formatDateLima();

  const [busqueda, setBusqueda]               = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [alumnoSel, setAlumnoSel]             = useState(null);
  const [carrito, setCarrito]                 = useState([]);
  const [nuevoItem, setNuevoItem]             = useState(itemInicial);
  const [montoEntregado, setMontoEntregado]   = useState('');
  const [metodoPago, setMetodoPago]           = useState('Efectivo');
  const [fechaOp, setFechaOp]                 = useState(hoyIso);
  const [procesando, setProcesando]           = useState(false);
  const [reciboModal, setReciboModal]         = useState(null);

  const { deudas } = useDeudasDeAlumno(alumnoSel?.id);
  const deudasPendientes = deudas.filter((d) => d.estado === 'Pendiente');

  // === Auto-carga del ModalDeudores ===
  useEffect(() => {
    if (location.state?.prefilledAlumno) {
      setAlumnoSel(location.state.prefilledAlumno);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // === Cálculos ===
  const totalCarrito = useMemo(() => carrito.reduce((s, i) => s + parseFloat(i.monto || 0), 0), [carrito]);
  const entregado    = parseFloat(montoEntregado) || 0;
  const deudaGenerada = Math.max(0, totalCarrito - entregado);
  const vuelto        = Math.max(0, entregado - totalCarrito);
  const ingresoCaja   = Math.min(entregado, totalCarrito);

  // Auto-relleno: cuando se agregan items y no hay monto, sugerir el total
  useEffect(() => {
    if (carrito.length > 0 && montoEntregado === '' && totalCarrito > 0) {
      setMontoEntregado(totalCarrito.toString());
    } else if (totalCarrito === 0 && carrito.length > 0) {
      setMontoEntregado('0');
    } else if (carrito.length === 0) {
      setMontoEntregado('');
    }
  }, [totalCarrito, carrito.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Búsqueda de alumnos ===
  const alumnosFiltrados = useMemo(
    () => alumnos.filter((a) => filtroCategoria === 'Todas' || a.categoria === filtroCategoria),
    [alumnos, filtroCategoria],
  );
  const sugerencias = useMemo(() => {
    if (busqueda.trim().length < 2) return [];
    const t = busqueda.toLowerCase();
    return alumnosFiltrados
      .filter((a) =>
        (a.nombre ?? '').toLowerCase().includes(t)
        || (a.apellido ?? '').toLowerCase().includes(t)
        || (a.dni ?? '').includes(busqueda)
      )
      .slice(0, 6);
  }, [alumnosFiltrados, busqueda]);

  const seleccionarAlumno = (a) => { setAlumnoSel(a); setBusqueda(''); };
  const cancelarSeleccion = () => { setAlumnoSel(null); setCarrito([]); setMontoEntregado(''); };

  const handleConceptoChange = (concepto) => {
    setNuevoItem({
      concepto,
      monto: CATALOGO_PRECIOS[concepto] ?? 0,
      detalle: '',
      mesEspecifico: nuevoItem.mesEspecifico,
    });
    if (concepto.includes('BECADO')) setMetodoPago('Aprobación Interna');
    else if (metodoPago === 'Aprobación Interna') setMetodoPago('Efectivo');
  };

  const agregarAlCarrito = () => {
    if (parseFloat(nuevoItem.monto) < 0) return toast.error('El costo no puede ser negativo.');
    let nombre = nuevoItem.concepto;
    if (nombre.includes('Mensualidad')) nombre = `${nombre} (${nuevoItem.mesEspecifico})`;
    setCarrito((prev) => [...prev, { ...nuevoItem, concepto: nombre, id: Date.now(), isDeudaVieja: false }]);
    setNuevoItem(itemInicial());
  };

  const quitarDelCarrito = (id) => setCarrito((prev) => prev.filter((i) => i.id !== id));

  const sumarDeudaVieja = (deuda) => {
    if (carrito.find((c) => c.deudaId === deuda.id)) return toast.warn('Esa deuda ya está en el ticket.');
    setCarrito((prev) => [...prev, {
      id: Date.now(),
      concepto: `Cobro deuda: ${deuda.concepto}`,
      monto: deuda.monto,
      isDeudaVieja: true,
      deudaId: deuda.id,
    }]);
  };

  // === Procesar caja ===
  const procesarCaja = async () => {
    if (!alumnoSel)             return toast.error('Identifica al alumno primero.');
    if (carrito.length === 0)   return toast.error('El ticket está vacío.');
    if (entregado < 0)          return toast.error('El monto entregado no puede ser negativo.');

    setProcesando(true);
    try {
      const resumen = carrito.map((c) => c.concepto).join(' + ');
      const numeroRecibo = `REC-${Date.now().toString().slice(-6)}`;
      const montoReal = ingresoCaja;

      await mutarPagos.registrar({
        idRecibo: numeroRecibo,
        alumnoId: alumnoSel.id,
        alumnoNombre: `${alumnoSel.nombre} ${alumnoSel.apellido}`,
        alumnoDni: alumnoSel.dni ?? '',
        fecha: fechaOp,
        metodo: metodoPago,
        conceptoResumen: resumen,
        items: carrito,
        total: montoReal,
        estado: 'Completado',
      });

      // Si hay deuda parcial generada, persistirla
      if (deudaGenerada > 0) {
        await mutarDeudas.crear({
          alumnoId: alumnoSel.id,
          alumnoNombre: `${alumnoSel.nombre} ${alumnoSel.apellido}`,
          concepto: `Saldo pendiente de: ${resumen}`,
          monto: deudaGenerada,
          fechaGeneracion: fechaOp,
        });
      }

      // Marcar deudas viejas como pagadas si entregó algo
      for (const item of carrito) {
        if (item.isDeudaVieja && entregado > 0) {
          await mutarDeudas.marcarPagada(item.deudaId);
        }
      }

      // Avanzar mes si pagó mensualidad sin dejar deuda
      const pagaMensualidad = carrito.find((c) => c.concepto.includes('Mensualidad'));
      if (pagaMensualidad && deudaGenerada === 0) {
        const venc = new Date(alumnoSel.vencimientoMensualidad || fechaOp);
        venc.setUTCMonth(venc.getUTCMonth() + 1);
        await mutarAlumnos.actualizar(alumnoSel.id, {
          vencimientoMensualidad: venc.toISOString().split('T')[0],
        });
      }

      setReciboModal({
        numero: numeroRecibo,
        totalPagado: montoReal,
        alumno: `${alumnoSel.nombre} ${alumnoSel.apellido}`,
        dni: alumnoSel.dni ?? '',
        fecha: fechaOp,
        metodo: metodoPago,
        concepto: resumen,
        deudaCreada: deudaGenerada,
      });

      // Reset
      setAlumnoSel(null);
      setCarrito([]);
      setMontoEntregado('');
      toast.success('Transacción registrada.');
    } catch (e) {
      console.error(e);
      toast.error('Falló la conexión al procesar la caja.');
    } finally {
      setProcesando(false);
    }
  };

  // === Boleta descargable como imagen JPG (sin librerías, vía <canvas>) ===
  const descargarBoletaImagen = (recibo) => {
    const W = 760, H = 1040, scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) { toast.error('Tu navegador no permite generar la imagen.'); return; }
    ctx.scale(scale, scale);

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const wrap = (text, maxW) => {
      const words = String(text).split(' ');
      const out = []; let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; }
        else line = test;
      }
      if (line) out.push(line);
      return out;
    };
    const fFecha = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '—');

    // Lienzo
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FCFBFF'; ctx.fillRect(0, 150, W, H - 150);

    // Banda superior violeta
    const grad = ctx.createLinearGradient(0, 0, W, 150);
    grad.addColorStop(0, '#7C3AED'); grad.addColorStop(1, '#C026D3');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 150);
    ctx.fillStyle = '#FFFFFF'; ctx.font = '800 42px Arial, sans-serif';
    ctx.fillText('FC SECHURA', 44, 74);
    ctx.font = '700 15px Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText('COMPROBANTE DE PAGO · BOLETA', 44, 104);
    ctx.textAlign = 'right'; ctx.font = '800 22px monospace'; ctx.fillStyle = '#FFFFFF';
    ctx.fillText(recibo.numero, W - 44, 74);
    ctx.textAlign = 'left';

    // Filas de datos
    let y = 224;
    const drawRow = (label, value) => {
      ctx.font = '700 13px Arial, sans-serif'; ctx.fillStyle = '#6E6589';
      ctx.fillText(label.toUpperCase(), 44, y);
      ctx.font = '700 22px Arial, sans-serif'; ctx.fillStyle = '#1A1330';
      ctx.fillText(String(value), 44, y + 30);
      ctx.strokeStyle = '#E3DEF3'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(44, y + 48); ctx.lineTo(W - 44, y + 48); ctx.stroke();
      y += 70;
    };
    drawRow('Fecha', fFecha(recibo.fecha));
    drawRow('Alumno', recibo.alumno);
    drawRow('DNI', recibo.dni || '—');

    // Concepto (multilínea)
    ctx.font = '700 13px Arial, sans-serif'; ctx.fillStyle = '#6E6589';
    ctx.fillText('CONCEPTO', 44, y);
    ctx.font = '600 18px Arial, sans-serif'; ctx.fillStyle = '#1A1330';
    let cy = y + 28;
    wrap(recibo.concepto || '—', W - 88).slice(0, 3).forEach((ln) => { ctx.fillText(ln, 44, cy); cy += 26; });
    y = cy + 16;
    ctx.strokeStyle = '#E3DEF3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(W - 44, y); ctx.stroke();
    y += 44;

    drawRow('Método de pago', recibo.metodo || '—');

    // Caja TOTAL
    const boxY = y;
    ctx.fillStyle = 'rgba(124,58,237,0.08)'; roundRect(44, boxY, W - 88, 100, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(124,58,237,0.38)'; ctx.lineWidth = 1.5; roundRect(44, boxY, W - 88, 100, 16); ctx.stroke();
    ctx.font = '800 15px Arial, sans-serif'; ctx.fillStyle = '#4C1D95';
    ctx.fillText('TOTAL PAGADO', 68, boxY + 44);
    ctx.textAlign = 'right'; ctx.font = '900 42px monospace'; ctx.fillStyle = '#6D28D9';
    ctx.fillText(formatMoney(recibo.totalPagado), W - 68, boxY + 68);
    ctx.textAlign = 'left';
    y = boxY + 140;

    if (recibo.deudaCreada > 0) {
      ctx.font = '700 16px Arial, sans-serif'; ctx.fillStyle = '#C81E1E';
      ctx.fillText(`Saldo pendiente: ${formatMoney(recibo.deudaCreada)}`, 44, y);
    }

    // Pie
    ctx.textAlign = 'center';
    ctx.font = '700 14px Arial, sans-serif'; ctx.fillStyle = '#3D3358';
    ctx.fillText('¡Gracias por tu pago! · FC Sechura — Formando campeones', W / 2, H - 64);
    ctx.font = '600 12px Arial, sans-serif'; ctx.fillStyle = '#857C9C';
    ctx.fillText('Comprobante generado digitalmente · conserva esta boleta', W / 2, H - 42);
    ctx.textAlign = 'left';

    canvas.toBlob((blob) => {
      if (!blob) { toast.error('No se pudo generar la imagen.'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Boleta_${recibo.numero}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);
  };

  const estaMoroso = alumnoSel ? hoyIso >= (alumnoSel.vencimientoMensualidad || '2000-01-01') : false;
  const ctaTexto = entregado === 0 && totalCarrito > 0 ? 'Registrar solo deuda' : 'Cerrar y aprobar';
  const ctaVariant = entregado === 0 && totalCarrito > 0 ? 'danger' : 'success';

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        <header style={headerStyle}>
          <div>
            <span style={eyebrowStyle}>FINANZAS · POS</span>
            <h1 style={titleStyle}>Terminal de caja</h1>
            <p style={leadStyle}>Registra pagos, abonos parciales y deudas con auditoría automática.</p>
          </div>
        </header>

        <div style={mainGridStyle} className="sn-pos-grid">
          {/* === COLUMNA IZQUIERDA: ALUMNO + CARRITO === */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>

            {/* PASO 1: Alumno */}
            <StepCard num={1} title="Identificar alumno">
              {!alumnoSel ? (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sn-space-3)' }}>
                    <div style={searchWrapStyle}>
                      <SearchIcon />
                      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar nombre, apellido o DNI..."
                        className="sn-focusable" style={searchInputStyle} />
                    </div>
                    <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="sn-focusable" style={selectStyle}>
                      <option value="Todas">Todas las cat.</option>
                      {CATEGORIAS.map((c) => <option key={c} value={c}>Cat. {c}</option>)}
                    </select>
                  </div>

                  {busqueda.length >= 2 && (
                    <div style={dropdownStyle} className="sn-scroll">
                      {sugerencias.length === 0 ? (
                        <div style={{ padding: 'var(--sn-space-4)', textAlign: 'center', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' }}>
                          Sin coincidencias.
                        </div>
                      ) : (
                        sugerencias.map((a) => (
                          <button key={a.id} type="button" onClick={() => seleccionarAlumno(a)} style={dropdownItemStyle} className="sn-focusable">
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.nombre} {a.apellido}
                              </div>
                              <div style={{ fontSize: 'var(--sn-fs-xs)', fontFamily: 'var(--sn-font-mono)', color: 'var(--sn-text-muted)' }}>DNI {a.dni}</div>
                            </div>
                            <Badge tone="brand">Cat. {a.categoria}</Badge>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 'var(--sn-space-4)', paddingTop: 'var(--sn-space-3)', borderTop: '1px solid var(--sn-border-faint)' }}>
                    <span style={subLabelStyle}>O selecciona del directorio</span>
                    <select onChange={(e) => e.target.value && seleccionarAlumno(alumnos.find((a) => a.id === e.target.value))}
                      defaultValue="" className="sn-focusable" style={{ ...selectStyle, marginTop: 6 }}>
                      <option value="" disabled>— Despliega para ver el directorio completo —</option>
                      {alumnosFiltrados.map((a) => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre} (Cat. {a.categoria})</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <AlumnoSeleccionado alumno={alumnoSel} estaMoroso={estaMoroso} deudas={deudasPendientes}
                  onCambiar={cancelarSeleccion} onSumarDeuda={sumarDeudaVieja} />
              )}
            </StepCard>

            {/* PASO 2: Concepto */}
            <StepCard num={2} title="Agregar concepto" disabled={!alumnoSel}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sn-space-3)' }}>
                <Field label="Concepto">
                  <select value={nuevoItem.concepto} onChange={(e) => handleConceptoChange(e.target.value)} className="sn-focusable" style={selectStyle}>
                    {Object.keys(CATALOGO_PRECIOS).map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="Otro">Otro ingreso (libre)</option>
                  </select>
                </Field>

                <Field label={`Costo (${nuevoItem.concepto.includes('BECADO') ? 'gratis' : 'editable'})`}>
                  <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 'var(--sn-radius-md)', border: '1px solid var(--sn-border-soft)', overflow: 'hidden', background: 'var(--sn-input-bg)' }}>
                    <span style={{ padding: '0 0.85rem', display: 'flex', alignItems: 'center', color: 'var(--sn-text-muted)', borderRight: '1px solid var(--sn-border-faint)', fontWeight: 700, fontSize: 'var(--sn-fs-sm)' }}>S/</span>
                    <input type="number" min="0" disabled={nuevoItem.concepto.includes('BECADO')} value={nuevoItem.monto}
                      onChange={(e) => setNuevoItem({ ...nuevoItem, monto: e.target.value })}
                      className="sn-focusable" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: nuevoItem.concepto.includes('BECADO') ? 'var(--sn-success)' : 'var(--sn-text-primary)', padding: '0.6rem 0.85rem', fontFamily: 'var(--sn-font-mono)', fontWeight: 700 }} />
                  </div>
                </Field>

                {nuevoItem.concepto.includes('Mensualidad') && (
                  <Field label="Mes a aplicar">
                    <select value={nuevoItem.mesEspecifico} onChange={(e) => setNuevoItem({ ...nuevoItem, mesEspecifico: e.target.value })}
                      className="sn-focusable" style={{ ...selectStyle, borderColor: nuevoItem.concepto.includes('BECADO') ? 'rgba(16,185,129,0.40)' : 'rgba(239,68,68,0.40)' }}>
                      {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                )}

                <Field label="Nota (opcional)" style={{ gridColumn: 'span 2' }}>
                  <input value={nuevoItem.detalle} onChange={(e) => setNuevoItem({ ...nuevoItem, detalle: e.target.value })}
                    placeholder={nuevoItem.concepto.includes('BECADO') ? 'Ej: Beca por rendimiento deportivo' : 'Ej: Talla M, abono inicial...'}
                    className="sn-focusable" style={inputStyle} />
                </Field>
              </div>

              <div style={{ marginTop: 'var(--sn-space-3)', display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant={nuevoItem.concepto.includes('BECADO') ? 'success' : 'primary'} icon={<PlusIcon />} onClick={agregarAlCarrito} disabled={!alumnoSel}>
                  Añadir al ticket
                </Button>
              </div>
            </StepCard>
          </div>

          {/* === COLUMNA DERECHA: CAJA REGISTRADORA === */}
          <Card>
            <CardBody style={{ padding: 0 }}>
              <div style={cajaHeaderStyle}>
                <span style={stepNumStyle}>3</span>
                <h3 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)' }}>Resumen de facturación</h3>
              </div>

              <div style={{ padding: 'var(--sn-space-5)' }}>
                {/* Ticket */}
                <div style={{ marginBottom: 'var(--sn-space-5)' }}>
                  <span style={{ ...subLabelStyle, marginBottom: 'var(--sn-space-3)', display: 'block' }}>Ticket actual</span>
                  {carrito.length === 0 ? (
                    <EmptyState title="Ticket vacío" description="Agrega un concepto para empezar a cobrar." />
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-2)' }}>
                      {carrito.map((item, i) => (
                        <li key={item.id} style={ticketRowStyle}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 700,
                              color: item.isDeudaVieja ? 'var(--sn-crit)' : item.concepto.includes('BECADO') ? 'var(--sn-success)' : 'var(--sn-text-primary)',
                            }}>
                              {i + 1}. {item.concepto}
                            </div>
                            {item.detalle && <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontFamily: 'var(--sn-font-mono)', marginTop: 2 }}>· {item.detalle}</div>}
                          </div>
                          <span style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 800, fontSize: 'var(--sn-fs-md)', color: parseFloat(item.monto) === 0 ? 'var(--sn-success)' : 'var(--sn-text-primary)' }}>
                            {parseFloat(item.monto) === 0 ? 'GRATIS' : formatMoney(item.monto)}
                          </span>
                          <button onClick={() => quitarDelCarrito(item.id)} style={trashIconStyle} className="sn-focusable" title="Quitar">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Total */}
                <div style={totalCardStyle}>
                  <span style={{ ...subLabelStyle, color: 'var(--sn-text-muted)', display: 'block', marginBottom: 6 }}>Total a pagar</span>
                  <span style={{ fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-3xl)', fontWeight: 800, color: 'var(--sn-brand-glow)', letterSpacing: 'var(--sn-tracking-tight)' }}>
                    {formatMoney(totalCarrito)}
                  </span>
                </div>

                {/* Calculadora */}
                <div style={{ marginBottom: 'var(--sn-space-4)' }}>
                  <Field label="Efectivo / monto entregado">
                    <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 'var(--sn-radius-md)', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.40)' }}>
                      <span style={{ padding: '0 0.9rem', display: 'flex', alignItems: 'center', background: 'rgba(16,185,129,0.10)', color: 'var(--sn-success)', fontWeight: 800 }}>S/</span>
                      <input type="number" min="0" value={montoEntregado} disabled={totalCarrito === 0 && carrito.length > 0}
                        onChange={(e) => setMontoEntregado(e.target.value)}
                        className="sn-focusable"
                        style={{ flex: 1, background: 'var(--sn-input-bg)', border: 'none', outline: 'none', color: 'var(--sn-success)', padding: '0.85rem', fontFamily: 'var(--sn-font-mono)', fontWeight: 800, fontSize: 'var(--sn-fs-xl)', textAlign: 'right' }} />
                    </div>
                  </Field>

                  {totalCarrito > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 'var(--sn-space-3)' }}>
                      <QuickBtn onClick={() => setMontoEntregado(totalCarrito.toString())}>Exacto</QuickBtn>
                      <QuickBtn onClick={() => setMontoEntregado('50')}>{formatMoney(50)}</QuickBtn>
                      <QuickBtn onClick={() => setMontoEntregado('100')}>{formatMoney(100)}</QuickBtn>
                      <QuickBtn onClick={() => setMontoEntregado('200')}>{formatMoney(200)}</QuickBtn>
                    </div>
                  )}

                  {carrito.length > 0 && (
                    <div style={auditoriaCardStyle}>
                      <span style={{ ...subLabelStyle, display: 'block', textAlign: 'center', marginBottom: 'var(--sn-space-3)' }}>Auditoría de operación</span>
                      <AuditoriaRow label="Ingresa a caja" value={`+ ${formatMoney(ingresoCaja)}`} tone="success" />
                      {vuelto > 0 && <AuditoriaRow label="Dar vuelto físico" value={formatMoney(vuelto)} tone="brand" />}
                      {deudaGenerada > 0 && <AuditoriaRow label="Se anota deuda" value={`− ${formatMoney(deudaGenerada)}`} tone="crit" highlight />}
                      {totalCarrito === 0 ? (
                        <div style={{ marginTop: 'var(--sn-space-3)', paddingTop: 'var(--sn-space-3)', borderTop: '1px solid var(--sn-border-faint)', textAlign: 'center', color: 'var(--sn-success)', fontWeight: 700 }}>
                          ✓ Operación bonificada (beca)
                        </div>
                      ) : entregado >= totalCarrito ? (
                        <div style={{ marginTop: 'var(--sn-space-3)', paddingTop: 'var(--sn-space-3)', borderTop: '1px solid var(--sn-border-faint)', textAlign: 'center', color: 'var(--sn-success)', fontWeight: 700 }}>
                          ✓ Cobro completo
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sn-space-3)', marginBottom: 'var(--sn-space-4)' }}>
                  <Field label="Método">
                    <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} disabled={entregado === 0 && totalCarrito > 0}
                      className="sn-focusable" style={selectStyle}>
                      {METODOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Fecha de transacción">
                    <input type="date" value={fechaOp} onChange={(e) => setFechaOp(e.target.value)} className="sn-focusable" style={inputStyle} />
                  </Field>
                </div>

                <Button
                  variant={ctaVariant}
                  size="lg"
                  onClick={procesarCaja}
                  loading={procesando}
                  disabled={!alumnoSel || carrito.length === 0}
                  style={{ width: '100%' }}
                  icon={entregado === 0 && totalCarrito > 0 ? <ListIcon /> : <LockIcon />}
                >
                  {ctaTexto}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* === Modal de éxito === */}
      <Modal
        open={!!reciboModal}
        onClose={() => setReciboModal(null)}
        size="sm"
        title={reciboModal && reciboModal.totalPagado > 0 ? '¡Aquí está tu boleta!' : 'Operación registrada'}
        description={reciboModal ? `Cuenta de ${reciboModal.alumno} actualizada.` : ''}
        footer={
          <div style={{ display: 'flex', gap: 'var(--sn-space-2)', width: '100%' }}>
            {reciboModal && reciboModal.totalPagado > 0 && (
              <Button variant="secondary" icon={<DownloadIcon />} onClick={() => descargarBoletaImagen(reciboModal)} style={{ flex: 1 }}>
                Descargar boleta
              </Button>
            )}
            <Button variant="primary" onClick={() => setReciboModal(null)} style={{ flex: 1 }}>Nueva operación</Button>
          </div>
        }
      >
        {reciboModal && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--sn-space-4)' }}>
              <div style={{ ...successCircleStyle, color: reciboModal.deudaCreada > 0 && reciboModal.totalPagado === 0 ? 'var(--sn-crit)' : 'var(--sn-success)', borderColor: reciboModal.deudaCreada > 0 && reciboModal.totalPagado === 0 ? 'rgba(239,68,68,0.40)' : 'rgba(16,185,129,0.40)' }}>
                {reciboModal.deudaCreada > 0 && reciboModal.totalPagado === 0 ? '!' : '✓'}
              </div>
            </div>
            <div style={reciboBoxStyle}>
              <Linea label="N° Recibo" value={<span style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 700 }}>{reciboModal.numero}</span>} />
              <Linea label="Ingreso a caja" value={<span style={{ color: 'var(--sn-success)', fontWeight: 800, fontFamily: 'var(--sn-font-mono)' }}>{formatMoney(reciboModal.totalPagado)}</span>} />
              {reciboModal.deudaCreada > 0 && (
                <Linea label="Deuda creada" value={<span style={{ color: 'var(--sn-crit)', fontWeight: 800, fontFamily: 'var(--sn-font-mono)' }}>{formatMoney(reciboModal.deudaCreada)}</span>} highlight />
              )}
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @media (max-width: 1099px) {
          .sn-pos-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

/* ========== sub-componentes ========== */

const StepCard = ({ num, title, disabled, children }) => (
  <Card style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', transition: 'opacity var(--sn-dur-base) var(--sn-ease)' }}>
    <CardBody style={{ padding: 0 }}>
      <div style={panelHeaderStyle}>
        <span style={stepNumStyle}>{num}</span>
        <h3 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)' }}>{title}</h3>
      </div>
      <div style={{ padding: 'var(--sn-space-5)' }}>{children}</div>
    </CardBody>
  </Card>
);

const AlumnoSeleccionado = ({ alumno, estaMoroso, deudas, onCambiar, onSumarDeuda }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sn-space-4)', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)' }}>
        <div style={avatarBigStyle}>{(alumno.nombre ?? '?').charAt(0)}{(alumno.apellido ?? '?').charAt(0)}</div>
        <div>
          <h3 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-lg)', fontWeight: 800, color: 'var(--sn-text-primary)' }}>
            {alumno.nombre} {alumno.apellido}
          </h3>
          <div style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', marginTop: 4 }}>
            DNI {alumno.dni} · Cat. {alumno.categoria}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" icon={<RefreshIcon />} onClick={onCambiar}>Cambiar</Button>
    </div>

    <div style={{
      marginTop: 'var(--sn-space-3)',
      padding: 'var(--sn-space-3) var(--sn-space-4)',
      borderRadius: 'var(--sn-radius-md)',
      background: estaMoroso ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)',
      border: `1px solid ${estaMoroso ? 'rgba(239,68,68,0.40)' : 'rgba(16,185,129,0.40)'}`,
      display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)',
    }}>
      <span style={{ fontSize: 24, color: estaMoroso ? 'var(--sn-crit)' : 'var(--sn-success)', fontWeight: 900 }}>{estaMoroso ? '!' : '✓'}</span>
      <div>
        <div style={{ fontWeight: 800, color: estaMoroso ? 'var(--sn-crit)' : 'var(--sn-success)', textTransform: 'uppercase', letterSpacing: 'var(--sn-tracking-wide)' }}>
          {estaMoroso ? 'Alumno moroso' : 'Alumno al día'}
        </div>
        <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
          {estaMoroso ? `Corte: ${alumno.vencimientoMensualidad ?? 'N/A'}` : `Próximo vencimiento: ${alumno.vencimientoMensualidad ?? '—'}`}
        </div>
      </div>
    </div>

    {deudas.length > 0 && (
      <div style={{ marginTop: 'var(--sn-space-3)' }}>
        <span style={{ ...subLabelStyle, display: 'block', marginBottom: 'var(--sn-space-2)' }}>Saldos pendientes en sistema</span>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {deudas.map((d) => (
            <li key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sn-space-3)', padding: '0.55rem 0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 'var(--sn-radius-md)' }}>
              <span style={{ fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)' }}>{d.concepto}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 800, color: 'var(--sn-warn)' }}>{formatMoney(d.monto)}</span>
                <Button size="sm" variant="primary" onClick={() => onSumarDeuda(d)}>Sumar</Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const Field = ({ label, children, style }) => (
  <label style={{ display: 'block', ...style }}>
    <span style={fieldLabelStyle}>{label}</span>
    {children}
  </label>
);

const QuickBtn = ({ children, onClick }) => (
  <button onClick={onClick} className="sn-focusable" style={{
    flex: 1, padding: '0.45rem',
    borderRadius: 'var(--sn-radius-pill)',
    background: 'transparent',
    border: '1px solid var(--sn-border-soft)',
    color: 'var(--sn-text-secondary)',
    fontWeight: 700, fontSize: 'var(--sn-fs-xs)',
    letterSpacing: 'var(--sn-tracking-wide)',
    cursor: 'pointer',
  }}>{children}</button>
);

const AuditoriaRow = ({ label, value, tone, highlight }) => {
  const c = { success: 'var(--sn-success)', brand: 'var(--sn-brand-glow)', crit: 'var(--sn-crit)' }[tone];
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: highlight ? '0.55rem 0.7rem' : '0.3rem 0',
      marginTop: highlight ? 6 : 0,
      borderRadius: highlight ? 'var(--sn-radius-sm)' : 0,
      background: highlight ? `color-mix(in srgb, ${c} 12%, transparent)` : 'transparent',
      border: highlight ? `1px solid color-mix(in srgb, ${c} 33%, transparent)` : 'none',
    }}>
      <span style={{ color: 'var(--sn-text-secondary)', fontSize: 'var(--sn-fs-sm)' }}>{label}</span>
      <span style={{ color: c, fontWeight: 800, fontFamily: 'var(--sn-font-mono)' }}>{value}</span>
    </div>
  );
};

const Linea = ({ label, value, highlight }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: highlight ? '0.6rem 0.75rem' : '0.4rem 0',
    marginTop: highlight ? 6 : 0,
    borderRadius: highlight ? 'var(--sn-radius-sm)' : 0,
    background: highlight ? 'rgba(239,68,68,0.10)' : 'transparent',
    border: highlight ? '1px solid rgba(239,68,68,0.30)' : 'none',
    borderBottom: highlight ? '1px solid rgba(239,68,68,0.30)' : '1px solid var(--sn-border-faint)',
  }}>
    <span style={{ ...subLabelStyle }}>{label}</span>
    {value}
  </div>
);

/* === iconos === */
const SearchIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>);
const PlusIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>);
const RefreshIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>);
const LockIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>);
const ListIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5h11M9 12h11M9 19h11M5 5h.01M5 12h.01M5 19h.01"/></svg>);
const DownloadIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>);

/* === estilos === */
const pageBg = { minHeight: 'calc(100vh - var(--sn-navbar-h))', background: 'var(--sn-bg-base)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
const contentWrap = { maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)' };
const headerStyle = { marginBottom: 'var(--sn-space-5)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const leadStyle = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' };

const mainGridStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 'var(--sn-space-5)' };

const panelHeaderStyle = {
  display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)',
  padding: 'var(--sn-space-4) var(--sn-space-5)',
  borderBottom: '1px solid var(--sn-border-faint)',
};

const cajaHeaderStyle = {
  ...panelHeaderStyle,
  background: 'linear-gradient(135deg, rgba(124,58,237,0.20) 0%, color-mix(in srgb, var(--sn-brand-glow) 12%, transparent) 100%)',
};

const stepNumStyle = {
  width: 28, height: 28, borderRadius: '50%',
  background: 'var(--sn-brand-gradient)',
  color: '#06121A', fontWeight: 900, fontSize: 14,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const subLabelStyle = {
  fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
  letterSpacing: 'var(--sn-tracking-wide)', textTransform: 'uppercase',
  color: 'var(--sn-text-muted)',
};

const fieldLabelStyle = {
  display: 'block', marginBottom: 6,
  fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  letterSpacing: 'var(--sn-tracking-wide)',
  color: 'var(--sn-text-secondary)',
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%', background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0.85rem', outline: 'none',
};

const selectStyle = { ...inputStyle };

const searchWrapStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  padding: '0 0.85rem',
  color: 'var(--sn-text-muted)',
};

const searchInputStyle = {
  flex: 1, background: 'transparent', border: 'none', outline: 'none',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0',
};

const dropdownStyle = {
  position: 'absolute',
  top: 'calc(100% + 6px)', left: 0, right: 0,
  background: 'var(--sn-bg-elevated)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  boxShadow: 'var(--sn-shadow-md)',
  maxHeight: 320, overflow: 'auto',
  zIndex: 'var(--sn-z-overlay)',
};

const dropdownItemStyle = {
  width: '100%', textAlign: 'left',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 'var(--sn-space-3)',
  padding: '0.7rem 0.85rem',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--sn-border-faint)',
  cursor: 'pointer', color: 'var(--sn-text-primary)',
};

const avatarBigStyle = {
  width: 56, height: 56, borderRadius: '50%',
  background: 'var(--sn-brand-gradient)',
  color: '#06121A', fontWeight: 900, fontSize: 20,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const ticketRowStyle = {
  display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)',
  padding: '0.65rem 0.75rem',
  background: 'var(--sn-row-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const trashIconStyle = {
  width: 28, height: 28, borderRadius: '50%',
  background: 'rgba(239,68,68,0.12)',
  border: 'none', color: 'var(--sn-crit)',
  fontSize: 18, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const totalCardStyle = {
  textAlign: 'center',
  padding: 'var(--sn-space-5) var(--sn-space-4)',
  background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, color-mix(in srgb, var(--sn-brand-glow) 10%, transparent) 100%)',
  border: '1px solid var(--sn-border-glow)',
  borderRadius: 'var(--sn-radius-lg)',
  marginBottom: 'var(--sn-space-4)',
};

const auditoriaCardStyle = {
  marginTop: 'var(--sn-space-3)',
  padding: 'var(--sn-space-3)',
  background: 'var(--sn-overlay-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const successCircleStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 72, height: 72, borderRadius: '50%',
  background: 'var(--sn-input-bg)',
  border: '1px solid', fontSize: 36, fontWeight: 900,
};

const reciboBoxStyle = {
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  padding: 'var(--sn-space-4)',
};

export default RegistrarPagos;
