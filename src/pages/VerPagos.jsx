import React, { useEffect, useMemo, useState } from 'react';
import logo from '../assets/logonegro.png';
import { useAlumnos } from '../hooks/useAlumnos';
import { usePagos, mutarPagos } from '../hooks/usePagos';
import { useQuery } from '../hooks/useFirestoreCache';
import { deudasService } from '../services/deudasService';
import { mutarAlumnos } from '../hooks/useAlumnos';
import { alumnosService } from '../services/alumnosService';
import { mutarDeudas } from '../hooks/useDeudores';
import { toast } from '../hooks/useToast';
import { CATEGORIAS, METODOS_PAGO, MESES, formatMoney } from '../config/businessRules';
import { Card, CardBody, Button, Badge, Modal, KpiCard, DataTable, EmptyState } from '../components/ui';
import ModalDeudores from '../components/ModalDeudores';

const mesesOptions = [
  { value: 'Todos', label: 'Todo el historial' },
  ...MESES.map((m, i) => ({
    value: `${String(i + 1).padStart(2, '0')}-${new Date().getFullYear()}`,
    label: `${m} ${new Date().getFullYear()}`,
  })),
];

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const VerPagos = () => {
  const { alumnos } = useAlumnos();
  const { pagos: rawPagos, loading } = usePagos();
  const { data: deudasPendientes = [] } = useQuery('deudas:pendientes', deudasService.pendientes);

  const [busqueda, setBusqueda]               = useState('');
  const [filtroMes, setFiltroMes]             = useState('Todos');
  const [filtroMetodo, setFiltroMetodo]       = useState('Todos');
  const [filtroEstado, setFiltroEstado]       = useState('Completado');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroAlumnoId, setFiltroAlumnoId]   = useState('Todos');
  const [orden, setOrden]                     = useState('fecha_desc');

  const [reciboModal, setReciboModal]         = useState(null);
  const [aAnular, setAAnular]                 = useState(null);
  const [anulando, setAnulando]               = useState(false);
  const [deudoresOpen, setDeudoresOpen]       = useState(false);

  useEffect(() => { setFiltroAlumnoId('Todos'); }, [filtroCategoria]);

  // Normalizo los pagos
  const pagos = useMemo(() => rawPagos.map((p) => ({
    firebaseId: p.id,
    id:        p.idRecibo ?? 'REC-XXXXXX',
    alumnoId:  p.alumnoId ?? '',
    alumno:    p.alumnoNombre ?? 'Desconocido',
    dni:       p.alumnoDni ?? '',
    monto:     Number(p.total) || 0,
    concepto:  p.conceptoResumen ?? '',
    fecha:     p.fecha ?? '',
    metodo:    p.metodo ?? 'Efectivo',
    estado:    p.estado ?? 'Completado',
    items:     p.items ?? [],
  })), [rawPagos]);

  const opcionesAlumnos = useMemo(
    () => alumnos.filter((a) => filtroCategoria === 'Todas' || a.categoria === filtroCategoria),
    [alumnos, filtroCategoria],
  );

  const visibles = useMemo(() => pagos.filter((p) => {
    const t = busqueda.toLowerCase();
    const matchTexto = !t
      || p.alumno.toLowerCase().includes(t)
      || p.dni.includes(busqueda)
      || p.id.toLowerCase().includes(t);
    const [mes, anio] = filtroMes.split('-');
    const matchMes = filtroMes === 'Todos' || p.fecha.startsWith(`${anio}-${mes}`);
    const matchMet = filtroMetodo === 'Todos' || p.metodo === filtroMetodo;
    const matchEst = filtroEstado === 'Todos' || p.estado === filtroEstado;
    const al = alumnos.find((a) => a.id === p.alumnoId);
    const matchCat = filtroCategoria === 'Todas' || al?.categoria === filtroCategoria;
    const matchAl  = filtroAlumnoId === 'Todos' || p.alumnoId === filtroAlumnoId;
    return matchTexto && matchMes && matchMet && matchEst && matchCat && matchAl;
  }).sort((a, b) => {
    if (orden === 'fecha_desc') return new Date(b.fecha) - new Date(a.fecha);
    if (orden === 'fecha_asc')  return new Date(a.fecha) - new Date(b.fecha);
    if (orden === 'monto_desc') return b.monto - a.monto;
    if (orden === 'monto_asc')  return a.monto - b.monto;
    return 0;
  }), [pagos, busqueda, filtroMes, filtroMetodo, filtroEstado, filtroCategoria, filtroAlumnoId, orden, alumnos]);

  const completados = visibles.filter((p) => p.estado === 'Completado');
  const totalRecaudado = completados.reduce((s, p) => s + p.monto, 0);
  const totalEfectivo  = completados.filter((p) => p.metodo === 'Efectivo').reduce((s, p) => s + p.monto, 0);
  const totalDigital   = completados.filter((p) => p.metodo === 'Yape/Plin' || p.metodo === 'Transferencia').reduce((s, p) => s + p.monto, 0);

  // Deudores únicos (alumnos con mensualidad vencida o deudas extra)
  const hoyIso = new Date().toISOString().split('T')[0];
  const deudoresCount = useMemo(() => {
    const set = new Set();
    alumnos.forEach((a) => {
      if (hoyIso >= (a.vencimientoMensualidad ?? '2000-01-01')) set.add(a.id);
    });
    deudasPendientes.forEach((d) => set.add(d.alumnoId));
    return set.size;
  }, [alumnos, deudasPendientes, hoyIso]);

  const ejecutarAnulacion = async () => {
    if (!aAnular) return;
    setAnulando(true);
    try {
      // 1. Marcar como anulado
      await mutarPagos.actualizar(aAnular.firebaseId, { estado: 'Anulado' });

      // 2. Revertir efectos (deudas viejas, mensualidad)
      let revirtioMensualidad = false;
      for (const item of aAnular.items ?? []) {
        if (item.isDeudaVieja && item.deudaId) {
          await mutarDeudas.reabrir(item.deudaId);
        }
        if (item.concepto?.includes('Mensualidad')) revirtioMensualidad = true;
      }

      if (revirtioMensualidad && aAnular.alumnoId) {
        const alumno = await alumnosService.obtener(aAnular.alumnoId);
        if (alumno) {
          const v = new Date(alumno.vencimientoMensualidad || aAnular.fecha);
          v.setMonth(v.getMonth() - 1);
          await mutarAlumnos.actualizar(aAnular.alumnoId, { vencimientoMensualidad: v.toISOString().split('T')[0] });
        }
      }

      toast.success('Recibo anulado. Saldos del alumno revertidos.');
      setAAnular(null);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo anular el recibo.');
    } finally { setAnulando(false); }
  };

  const exportarExcel = () => {
    const html = `<html><head><meta charset="utf-8"></head><body>
      <h2>Auditoría de Caja · FC Sechura · ${escapeHtml(filtroMes)}</h2>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead><tr><th>RECIBO</th><th>FECHA</th><th>ALUMNO</th><th>DNI</th><th>CONCEPTO</th><th>MÉTODO</th><th>MONTO</th><th>ESTADO</th></tr></thead>
        <tbody>${visibles.map((p) => `<tr><td>${escapeHtml(p.id)}</td><td>${escapeHtml(p.fecha)}</td><td>${escapeHtml(p.alumno)}</td><td>${escapeHtml(p.dni)}</td><td>${escapeHtml(p.concepto)}</td><td>${escapeHtml(p.metodo)}</td><td>${p.monto.toFixed(2)}</td><td>${escapeHtml(p.estado)}</td></tr>`).join('')}
        <tr><td colspan="6" style="text-align:right;font-weight:bold">TOTAL RECAUDADO</td><td style="font-weight:bold">${totalRecaudado.toFixed(2)}</td><td></td></tr>
        </tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Reporte_Caja_${filtroMes}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    const filas = visibles.map((p) => {
      const tono = p.estado === 'Completado' ? 'success' : p.estado === 'Anulado' ? 'danger' : '';
      const estilo = p.estado === 'Anulado' ? 'style="text-decoration:line-through;opacity:0.6"' : '';
      return `<tr ${estilo}>
        <td><strong>${escapeHtml(p.id)}</strong></td><td>${escapeHtml(p.fecha)}</td><td>${escapeHtml(p.alumno)}</td>
        <td>${escapeHtml(p.dni)}</td><td>${escapeHtml(p.concepto)}</td><td>${escapeHtml(p.metodo)}</td>
        <td class="r"><strong>${formatMoney(p.monto)}</strong></td>
        <td class="c ${tono}">${escapeHtml(p.estado)}</td>
      </tr>`;
    }).join('');
    w.document.write(`<html><head><title>Auditoría · FC Sechura</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        .h { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1e3a8a; padding-bottom:10px; margin-bottom:20px; }
        .h h1 { color:#1e3a8a; margin:0; }
        .resumen { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
        .box { padding:10px 16px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; flex:1; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        th { background:#1e3a8a; color:white; padding:8px; -webkit-print-color-adjust:exact; print-color-adjust:exact; text-align:left; }
        td { border:1px solid #cbd5e1; padding:8px; }
        .r { text-align:right; } .c { text-align:center; }
        .success { color:#10b981; font-weight:bold; } .danger { color:#ef4444; font-weight:bold; }
      </style></head><body>
        <div class="h">
          <div><h1>Auditoría de caja y pagos</h1>
            <p style="margin:4px 0 0;color:#64748b">Periodo: ${escapeHtml(filtroMes)} · Categoría: ${escapeHtml(filtroCategoria)} · Estado: ${escapeHtml(filtroEstado)}</p>
          </div>
          <div style="text-align:right">
            <h2 style="margin:0;color:#1e3a8a">${formatMoney(totalRecaudado)}</h2>
            <p style="margin:0;color:#64748b;font-size:12px">Recaudación líquida</p>
          </div>
        </div>
        <div class="resumen">
          <div class="box"><strong>💵 Efectivo:</strong> ${formatMoney(totalEfectivo)}</div>
          <div class="resumen-box"><strong>📱 Digital:</strong> ${formatMoney(totalDigital)}</div>
        </div>
        <table>
          <thead><tr><th>Recibo</th><th>Fecha</th><th>Alumno</th><th>DNI</th><th>Concepto</th><th>Método</th><th class="r">Monto</th><th class="c">Estado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <script>window.onload = () => { window.print(); window.close(); };</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        <header style={headerStyle}>
          <div>
            <span style={eyebrowStyle}>FINANZAS · AUDITORÍA</span>
            <h1 style={titleStyle}>Caja y recibos</h1>
            <p style={leadStyle}>Control de ingresos, métodos y trazabilidad de comprobantes.</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sn-space-3)', flexWrap: 'wrap' }}>
            <Button variant="ghost" icon={<XlsIcon />} onClick={exportarExcel}>Excel</Button>
            <Button variant="primary" icon={<PdfIcon />} onClick={exportarPDF}>Auditoría PDF</Button>
          </div>
        </header>

        {/* === KPIs === */}
        <div style={kpiGridStyle}>
          <KpiCard label="Ingreso bruto" value={totalRecaudado} loading={loading} icon={<ChartIcon />} accent="brand"   format={formatMoney} hint={`${completados.length} comprobantes`} />
          <KpiCard label="Efectivo"      value={totalEfectivo}  loading={loading} icon={<CashIcon />}  accent="success" format={formatMoney} hint="Caja física" />
          <KpiCard label="Digital"       value={totalDigital}   loading={loading} icon={<PhoneIcon />} accent="elite"   format={formatMoney} hint="Yape · Plin · Transf." />
          <DeudoresKpi count={deudoresCount} onClick={() => setDeudoresOpen(true)} />
        </div>

        {/* === Filtros === */}
        <Card style={{ marginTop: 'var(--sn-space-5)', marginBottom: 'var(--sn-space-5)' }}>
          <CardBody>
            <div style={filtrosGridStyle}>
              <FilterField label="Búsqueda rápida">
                <div style={searchWrapStyle}>
                  <SearchIcon />
                  <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre, DNI o N° de recibo..." className="sn-focusable" style={searchInputStyle} />
                </div>
              </FilterField>
              <FilterField label="Periodo">
                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="sn-focusable" style={inputStyle}>
                  {mesesOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </FilterField>
              <FilterField label="Categoría">
                <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="sn-focusable" style={inputStyle}>
                  <option value="Todas">Todas las categorías</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>Cat. {c}</option>)}
                </select>
              </FilterField>
              <FilterField label="Alumno específico">
                <select value={filtroAlumnoId} onChange={(e) => setFiltroAlumnoId(e.target.value)} className="sn-focusable" style={inputStyle}>
                  <option value="Todos">Todos los alumnos</option>
                  {opcionesAlumnos.map((a) => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                </select>
              </FilterField>
              <FilterField label="Método">
                <select value={filtroMetodo} onChange={(e) => setFiltroMetodo(e.target.value)} className="sn-focusable" style={inputStyle}>
                  <option value="Todos">Todos los métodos</option>
                  {METODOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </FilterField>
              <FilterField label="Estado">
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="sn-focusable" style={inputStyle}>
                  <option value="Todos">Todos los estados</option>
                  <option value="Completado">Completados</option>
                  <option value="Anulado">Anulados</option>
                </select>
              </FilterField>
              <FilterField label="Orden">
                <select value={orden} onChange={(e) => setOrden(e.target.value)} className="sn-focusable" style={inputStyle}>
                  <option value="fecha_desc">Más recientes primero</option>
                  <option value="fecha_asc">Más antiguos primero</option>
                  <option value="monto_desc">Monto: mayor a menor</option>
                  <option value="monto_asc">Monto: menor a mayor</option>
                </select>
              </FilterField>
            </div>
          </CardBody>
        </Card>

        {/* === Tabla === */}
        <Card>
          <CardBody style={{ padding: 0 }}>
            <DataTable
              loading={loading}
              rows={visibles}
              empty={<EmptyState title="Sin comprobantes" description="No se encontraron recibos para los filtros aplicados." />}
              columns={[
                {
                  key: 'recibo', header: 'Recibo / Fecha', width: 160,
                  render: (p) => (
                    <div>
                      <div style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 800, color: p.estado === 'Anulado' ? 'var(--sn-text-muted)' : 'var(--sn-brand-glow)' }}>{p.id}</div>
                      <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>{p.fecha}</div>
                    </div>
                  ),
                },
                {
                  key: 'alumno', header: 'Alumno',
                  render: (p) => (
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', textDecoration: p.estado === 'Anulado' ? 'line-through' : 'none' }}>{p.alumno}</div>
                      <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontFamily: 'var(--sn-font-mono)' }}>DNI {p.dni}</div>
                    </div>
                  ),
                },
                {
                  key: 'concepto', header: 'Concepto',
                  render: (p) => (
                    <div title={p.concepto} style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-secondary)' }}>
                      {p.concepto}
                    </div>
                  ),
                },
                {
                  key: 'metodo', header: 'Vía', align: 'center', width: 130,
                  render: (p) => <Badge tone={p.metodo === 'Efectivo' ? 'success' : p.metodo === 'Aprobación Interna' ? 'elite' : 'info'}>{p.metodo}</Badge>,
                },
                {
                  key: 'monto', header: 'Monto', align: 'right', width: 130,
                  render: (p) => (
                    <span style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 800, color: p.estado === 'Anulado' ? 'var(--sn-text-muted)' : 'var(--sn-brand-glow)' }}>
                      {formatMoney(p.monto)}
                    </span>
                  ),
                },
                {
                  key: 'estado', header: 'Status', align: 'center', width: 130,
                  render: (p) => <Badge tone={p.estado === 'Completado' ? 'success' : 'crit'}>{p.estado}</Badge>,
                },
                {
                  key: 'acciones', header: 'Auditoría', align: 'right', width: 130,
                  render: (p) => (
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setReciboModal(p)} title="Ver boleta" className="sn-focusable" style={iconBtn('brand')}><EyeIcon /></button>
                      {p.estado !== 'Anulado' && (
                        <button onClick={() => setAAnular(p)} title="Anular" className="sn-focusable" style={iconBtn('crit')}><BanIcon /></button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {/* === Modal: anulación === */}
      <Modal
        open={!!aAnular}
        onClose={() => !anulando && setAAnular(null)}
        size="md"
        title="¿Anular recibo?"
        description={aAnular ? `Recibo ${aAnular.id} por ${formatMoney(aAnular.monto)}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAAnular(null)} disabled={anulando}>Conservar</Button>
            <Button variant="danger" onClick={ejecutarAnulacion} loading={anulando} icon={<BanIcon />}>Anular ficha</Button>
          </>
        }
      >
        <div style={efectoDominoStyle}>
          <div style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-crit)', marginBottom: 'var(--sn-space-2)' }}>
            EFECTO DOMINÓ
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--sn-text-secondary)', fontSize: 'var(--sn-fs-sm)', lineHeight: 1.7 }}>
            <li>El monto se restará de la recaudación de caja.</li>
            <li>Si el recibo incluía <strong>mensualidad</strong>, el alumno volverá a estado moroso (se resta el mes).</li>
            <li>Si era cobro de una deuda previa, esa deuda regresa al perfil del alumno.</li>
          </ul>
        </div>
      </Modal>

      {/* === Modal: boleta === */}
      <Modal
        open={!!reciboModal}
        onClose={() => setReciboModal(null)}
        size="md"
        title="Comprobante de caja"
        description={reciboModal ? `${reciboModal.id} · ${reciboModal.fecha}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReciboModal(null)}>Cerrar</Button>
            <Button variant="primary" onClick={() => imprimirRecibo()} disabled={reciboModal?.estado === 'Anulado'} icon={<PrintIcon />}>Imprimir</Button>
          </>
        }
      >
        {reciboModal && <Boleta recibo={reciboModal} />}
      </Modal>

      <ModalDeudores
        isOpen={deudoresOpen}
        onClose={() => setDeudoresOpen(false)}
        alumnos={alumnos}
        deudasExtras={deudasPendientes}
      />
    </div>
  );
};

/* === Imprimir recibo === */
const imprimirRecibo = () => {
  const el = document.getElementById('sn-recibo-print');
  if (!el) return;
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.write(`<html><head><title>Recibo FC Sechura</title>
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: Arial, sans-serif; padding: 30px; background: white; color: #0f172a; }
      * { box-sizing: border-box; }
    </style></head><body>${el.innerHTML}
    <script>window.onload = () => { window.print(); window.close(); };</script>
    </body></html>`);
  w.document.close();
};

/* === Sub-componentes === */

const FilterField = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <span style={fieldLabelStyle}>{label}</span>
    {children}
  </label>
);

const DeudoresKpi = ({ count, onClick }) => (
  <button onClick={onClick} className="sn-focusable" style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', position: 'relative' }}>
    <KpiCard label="Alerta morosidad" value={count} icon={<AlertIcon />} accent="crit" hint="Click para ver lista →" />
  </button>
);

const Boleta = ({ recibo }) => (
  <div id="sn-recibo-print" style={{
    background: 'white', color: '#0f172a',
    padding: 32, borderRadius: 12,
    borderTop: '8px solid #1E3A8A',
    fontFamily: 'Inter, system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {recibo.estado === 'Anulado' && (
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%) rotate(-30deg)',
        fontSize: 80, fontWeight: 900, color: 'rgba(239,68,68,0.20)',
        pointerEvents: 'none', whiteSpace: 'nowrap', letterSpacing: 12,
      }}>ANULADO</div>
    )}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={logo} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        <div>
          <h4 style={{ margin: 0, color: '#1e3a8a', fontWeight: 900 }}>FC SECHURA</h4>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700 }}>Academia de fútbol formativo</p>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Comprobante de caja</span>
        <h4 style={{ margin: 0, fontFamily: 'monospace' }}>{recibo.id}</h4>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cliente / alumno</span>
        <h6 style={{ margin: '4px 0 0', textTransform: 'uppercase', fontSize: 14, fontWeight: 800 }}>{recibo.alumno}</h6>
        <p style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>DNI: {recibo.dni || 'Sin documento'}</p>
      </div>
      <div>
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Fecha de operación</span>
        <h6 style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 13 }}>{recibo.fecha}</h6>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Método de pago</span>
        <h6 style={{ margin: '4px 0 0', fontSize: 13, textTransform: 'uppercase' }}>{recibo.metodo}</h6>
      </div>
    </div>

    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Descripción del servicio</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Importe</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', maxWidth: '70%' }}>{recibo.concepto}</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 13 }}>{formatMoney(recibo.monto)}</span>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px dashed #cbd5e1', paddingTop: 16 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total pagado</span>
      <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 28, color: '#1e3a8a' }}>{formatMoney(recibo.monto)}</span>
    </div>

    <p style={{ textAlign: 'center', marginTop: 32, color: '#64748b', fontSize: 9 }}>
      "Formando talentos para el futuro" · Comprobante de uso interno · Válido sin firma ni sello.
    </p>
  </div>
);

/* === Iconos === */
const SearchIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>);
const ChartIcon  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m6 16 4-4 4 4 6-6"/></svg>);
const CashIcon   = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>);
const PhoneIcon  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>);
const AlertIcon  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.7a2 2 0 0 1 3.4 0l8.4 14.6A2 2 0 0 1 20.4 21H3.6a2 2 0 0 1-1.7-2.7L10.3 3.7Z"/></svg>);
const PdfIcon    = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>);
const XlsIcon    = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 13 6 6m-6 0 6-6"/></svg>);
const PrintIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>);
const EyeIcon    = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>);
const BanIcon    = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>);

/* === estilos === */
const pageBg = { minHeight: 'calc(100vh - 73px)', background: 'var(--sn-bg-base)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
const contentWrap = { maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)' };
const headerStyle = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--sn-space-4)', flexWrap: 'wrap', marginBottom: 'var(--sn-space-5)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const leadStyle = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' };

const kpiGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sn-space-4)' };
const filtrosGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sn-space-3)' };

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
  color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0',
};

const iconBtn = (tone) => {
  const c = { brand: 'var(--sn-brand-glow)', crit: 'var(--sn-crit)' }[tone];
  return {
    width: 32, height: 32, borderRadius: 'var(--sn-radius-sm)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', color: c, border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`, cursor: 'pointer',
  };
};

const efectoDominoStyle = {
  background: 'rgba(239,68,68,0.06)',
  border: '1px solid rgba(239,68,68,0.30)',
  borderRadius: 'var(--sn-radius-md)',
  padding: 'var(--sn-space-4)',
};

export default VerPagos;
