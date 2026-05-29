import React, { useEffect, useMemo, useState } from 'react';
import { useAlumnos } from '../hooks/useAlumnos';
import { useAsistenciaPorFecha, mutarAsistencia } from '../hooks/useAsistencia';
import { toast } from '../hooks/useToast';
import { CATEGORIAS, ESTADOS_ASISTENCIA, formatDateLima, formatMoney } from '../config/businessRules';
import { Card, CardBody, Button, Badge, DataTable, Modal, EmptyState, KpiCard } from '../components/ui';

const PRECIO_CANCHA = 3;

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const Historial = () => {
  const { iso: hoyIso } = formatDateLima();
  const [fecha, setFecha]                   = useState(hoyIso);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroAlumnoId, setFiltroAlumnoId]   = useState('Todos');
  const [filtroEstado, setFiltroEstado]       = useState('Todos');
  const [aEditar, setAEditar]                 = useState(null);
  const [aEliminar, setAEliminar]             = useState(null);
  const [guardando, setGuardando]             = useState(false);
  const [eliminando, setEliminando]           = useState(false);

  const { alumnos } = useAlumnos();
  const { asistencias, loading } = useAsistenciaPorFecha(fecha);

  // Reset del filtro alumno al cambiar categoría
  useEffect(() => { setFiltroAlumnoId('Todos'); }, [filtroCategoria]);

  const opcionesAlumnos = useMemo(
    () => alumnos
      .filter((a) => filtroCategoria === 'Todas' || a.categoria === filtroCategoria)
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')),
    [alumnos, filtroCategoria],
  );

  const visibles = useMemo(() => asistencias.filter((r) => {
    const cat = filtroCategoria === 'Todas' || r.categoria === filtroCategoria;
    const est = filtroEstado === 'Todos'    || r.estado === filtroEstado;
    const al  = filtroAlumnoId === 'Todos'  || r.alumnoId === filtroAlumnoId;
    return cat && est && al;
  }), [asistencias, filtroCategoria, filtroEstado, filtroAlumnoId]);

  const totalAsistencias = visibles.filter((r) => r.estado === ESTADOS_ASISTENCIA.ASISTIO).length;
  const totalTardanzas   = visibles.filter((r) => r.estado === ESTADOS_ASISTENCIA.TARDE).length;
  const totalFaltas      = visibles.filter((r) => r.estado === ESTADOS_ASISTENCIA.FALTO).length;
  const totalCajaChica   = visibles.filter((r) => r.pagoCancha).length * PRECIO_CANCHA;

  const hayFiltros = fecha !== hoyIso || filtroCategoria !== 'Todas' || filtroAlumnoId !== 'Todos' || filtroEstado !== 'Todos';
  const limpiarFiltros = () => {
    setFecha(hoyIso); setFiltroCategoria('Todas'); setFiltroAlumnoId('Todos'); setFiltroEstado('Todos');
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = {
        estado: aEditar.estado,
        pagoCancha: aEditar.estado === ESTADOS_ASISTENCIA.FALTO ? false : aEditar.pagoCancha,
        montoCancha: (aEditar.estado !== ESTADOS_ASISTENCIA.FALTO && aEditar.pagoCancha) ? PRECIO_CANCHA : 0,
      };
      await mutarAsistencia.actualizar(aEditar.id, payload);
      toast.success('Registro actualizado.');
      setAEditar(null);
    } catch {
      toast.error('No se pudo guardar el cambio.');
    } finally { setGuardando(false); }
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

  const exportarPDF = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    const filas = visibles.length === 0
      ? `<tr><td colspan="7" style="padding:20px;text-align:center;color:#64748b">No hay registros para mostrar.</td></tr>`
      : visibles.map((r) => {
          const tono = r.estado === 'Asistió' ? 'text-success' : r.estado === 'Tarde' ? 'text-warning' : 'text-danger';
          const cancha = r.estado === 'Faltó' ? '—' : (r.pagoCancha ? 'Pagó' : 'No pagó');
          return `<tr>
            <td><strong>${escapeHtml(r.nombre)}</strong></td>
            <td class="c">${escapeHtml(r.dni)}</td>
            <td class="c">Cat. ${escapeHtml(r.categoria)}</td>
            <td class="c">${escapeHtml(r.horaIngreso)}</td>
            <td class="c">${escapeHtml(r.horaSalida)}</td>
            <td class="c">${cancha}</td>
            <td class="c ${tono}">${escapeHtml(r.estado)}</td>
          </tr>`;
        }).join('');
    w.document.write(`
      <html><head><title>Reporte de Asistencia · FC Sechura</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Inter', system-ui, sans-serif; padding: 20px; }
        .h { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1e3a8a; padding-bottom:10px; margin-bottom:20px; }
        .h h1 { color:#1e3a8a; margin:0; font-size:24px; text-transform:uppercase; }
        .resumen { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
        .box { padding:10px 16px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; flex:1; text-align:center; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        th { background:#1e3a8a; color:white; padding:8px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        td { border:1px solid #cbd5e1; padding:8px; }
        .c { text-align:center; }
        .text-success { color:#10b981; font-weight:bold; }
        .text-warning { color:#d97706; font-weight:bold; }
        .text-danger  { color:#ef4444; font-weight:bold; }
      </style></head><body>
        <div class="h">
          <div><h1>Reporte de Asistencia</h1>
            <p style="margin:4px 0 0;color:#64748b">Fecha: <strong>${escapeHtml(fecha)}</strong> · Categoría: ${escapeHtml(filtroCategoria)}</p>
          </div>
          <div style="text-align:right">
            <h3 style="color:#1e3a8a;margin:0">${formatMoney(totalCajaChica)}</h3>
            <p style="margin:0;color:#64748b;font-size:12px">Caja chica (cancha)</p>
          </div>
        </div>
        <div class="resumen">
          <div class="box"><strong class="text-success">Presentes:</strong> ${totalAsistencias}</div>
          <div class="box"><strong class="text-warning">Tardanzas:</strong> ${totalTardanzas}</div>
          <div class="box"><strong class="text-danger">Faltas:</strong> ${totalFaltas}</div>
        </div>
        <table>
          <thead><tr><th>Alumno</th><th>DNI</th><th>Categoría</th><th>Ingreso</th><th>Salida</th><th>Cancha</th><th>Estado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <p style="text-align:center;color:#94a3b8;font-size:10px;margin-top:30px">FC Sechura · Sistema de gestión administrativa</p>
        <script>window.onload = () => { window.print(); window.close(); };</script>
      </body></html>
    `);
    w.document.close();
  };

  const exportarExcel = () => {
    const filas = visibles.map((r) => `
      <tr><td>${escapeHtml(r.nombre)}</td><td>${escapeHtml(r.dni)}</td><td>Cat. ${escapeHtml(r.categoria)}</td>
      <td>${escapeHtml(r.horaIngreso)}</td><td>${escapeHtml(r.horaSalida)}</td>
      <td>${r.pagoCancha ? `Pagó S/${PRECIO_CANCHA}` : 'No pagó'}</td><td>${escapeHtml(r.estado)}</td></tr>
    `).join('');
    const html = `<html><body><h2>Reporte de Asistencia · FC Sechura · ${escapeHtml(fecha)}</h2>
      <table border="1"><thead><tr><th>ALUMNO</th><th>DNI</th><th>CATEGORÍA</th><th>INGRESO</th><th>SALIDA</th><th>CANCHA</th><th>ESTADO</th></tr></thead>
      <tbody>${filas}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Asistencia_FCSechura_${fecha}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        {/* === Header === */}
        <header style={headerStyle}>
          <div>
            <span style={eyebrowStyle}>HISTÓRICO · CONSULTA</span>
            <h1 style={titleStyle}>Asistencias por fecha</h1>
            <p style={leadStyle}>Consulta, edita y exporta los registros guardados en la nube.</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sn-space-3)', flexWrap: 'wrap' }}>
            <Button variant="ghost" icon={<PdfIcon />} onClick={exportarPDF}>Exportar PDF</Button>
            <Button variant="primary" icon={<XlsIcon />} onClick={exportarExcel}>Exportar Excel</Button>
          </div>
        </header>

        {/* === KPIs === */}
        <div style={kpiGridStyle}>
          <KpiCard label="Presentes" value={totalAsistencias} loading={loading} icon={<CheckIcon />} accent="success" hint="Estado: Asistió" />
          <KpiCard label="Tardanzas" value={totalTardanzas}   loading={loading} icon={<ClockIcon />} accent="warn"    hint="Estado: Tarde" />
          <KpiCard label="Faltas"    value={totalFaltas}      loading={loading} icon={<XIcon />}     accent="crit"    hint="Estado: Faltó" />
          <KpiCard label="Caja chica" value={totalCajaChica}  loading={loading} icon={<CoinIcon />}  accent="brand"   hint="Cancha S/3" format={(n) => formatMoney(n)} />
        </div>

        {/* === Filtros === */}
        <Card style={{ marginTop: 'var(--sn-space-5)', marginBottom: 'var(--sn-space-5)' }}>
          <CardBody>
            <div style={filtrosGridStyle}>
              <FilterField label="Fecha de consulta">
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="sn-focusable" style={inputStyle} />
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
              <FilterField label="Estado">
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="sn-focusable" style={inputStyle}>
                  <option value="Todos">Todos los estados</option>
                  <option value="Asistió">Asistió</option>
                  <option value="Tarde">Tardanza</option>
                  <option value="Faltó">Falta</option>
                </select>
              </FilterField>
            </div>
            <div style={filterMetaStyle}>
              <span style={filterCountStyle}>
                {loading ? 'Cargando…' : `${visibles.length} de ${asistencias.length} registros`}
              </span>
              {hayFiltros && (
                <button type="button" onClick={limpiarFiltros} className="sn-focusable" style={filterResetStyle}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </CardBody>
        </Card>

        {/* === Tabla === */}
        <Card>
          <CardBody style={{ padding: 0 }}>
            <DataTable
              loading={loading}
              rows={visibles}
              empty={<EmptyState title="Sin registros" description="No se encontraron registros para los filtros aplicados." />}
              columns={[
                {
                  key: 'alumno', header: 'Alumno',
                  render: (r) => (
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)' }}>{r.nombre}</div>
                      <div style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>DNI {r.dni}</div>
                    </div>
                  ),
                },
                { key: 'categoria', header: 'Categoría', align: 'center', width: 110, render: (r) => <Badge tone="brand">Cat. {r.categoria}</Badge> },
                {
                  key: 'horarios', header: 'Ingreso / Salida', width: 180,
                  render: (r) => (
                    <div style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-sm)' }}>
                      <span style={{ color: 'var(--sn-success)' }}>{r.horaIngreso}</span>
                      <span style={{ color: 'var(--sn-text-dim)', margin: '0 6px' }}>→</span>
                      <span style={{ color: r.horaSalida === '--:--' ? 'var(--sn-text-dim)' : 'var(--sn-crit)' }}>{r.horaSalida}</span>
                    </div>
                  ),
                },
                {
                  key: 'cancha', header: 'Cancha', align: 'center', width: 120,
                  render: (r) => r.pagoCancha
                    ? <Badge tone="success">Pagó {formatMoney(PRECIO_CANCHA)}</Badge>
                    : <Badge tone="neutral">No pagó</Badge>,
                },
                {
                  key: 'estado', header: 'Estado', align: 'center', width: 130,
                  render: (r) => <Badge tone={r.estado === 'Asistió' ? 'success' : r.estado === 'Tarde' ? 'warn' : 'crit'}>{r.estado}</Badge>,
                },
                {
                  key: 'acciones', header: 'Acciones', align: 'right', width: 110,
                  render: (r) => (
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setAEditar({ ...r })} title="Editar" className="sn-focusable" style={iconBtn('warn')}><EditIcon /></button>
                      <button onClick={() => setAEliminar(r)}     title="Eliminar" className="sn-focusable" style={iconBtn('crit')}><TrashIcon /></button>
                    </div>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {/* === Modal: editar === */}
      <Modal
        open={!!aEditar}
        onClose={() => setAEditar(null)}
        size="sm"
        title="Corregir registro"
        description={aEditar ? `${aEditar.nombre} · ${aEditar.fecha}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAEditar(null)} disabled={guardando}>Cancelar</Button>
            <Button form="sn-edit-form" type="submit" variant="primary" loading={guardando}>Guardar cambios</Button>
          </>
        }
      >
        {aEditar && (
          <form id="sn-edit-form" onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
            <FilterField label="Estado">
              <select value={aEditar.estado} onChange={(e) => setAEditar({ ...aEditar, estado: e.target.value })} className="sn-focusable" style={inputStyle}>
                <option value="Asistió">Asistió</option>
                <option value="Tarde">Tarde</option>
                <option value="Faltó">Faltó</option>
              </select>
            </FilterField>
            {aEditar.estado !== 'Faltó' && (
              <FilterField label="Caja chica (S/3)">
                <select value={aEditar.pagoCancha ? 'true' : 'false'} onChange={(e) => setAEditar({ ...aEditar, pagoCancha: e.target.value === 'true' })} className="sn-focusable" style={inputStyle}>
                  <option value="true">Sí pagó · {formatMoney(PRECIO_CANCHA)}</option>
                  <option value="false">No pagó</option>
                </select>
              </FilterField>
            )}
          </form>
        )}
      </Modal>

      {/* === Modal: eliminar === */}
      <Modal
        open={!!aEliminar}
        onClose={() => setAEliminar(null)}
        size="sm"
        title="¿Eliminar registro?"
        description={aEliminar ? `Vas a borrar la asistencia de ${aEliminar.nombre}.` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAEliminar(null)} disabled={eliminando}>Cancelar</Button>
            <Button variant="danger" onClick={eliminar} loading={eliminando}>Sí, borrar</Button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--sn-space-3) 0' }}>
          <span style={dangerCircleStyle}>!</span>
        </div>
      </Modal>
    </div>
  );
};

const FilterField = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <span style={fieldLabelStyle}>{label}</span>
    {children}
  </label>
);

/* === iconos === */
const PdfIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 13v5M12 13v5M15 13v5"/></svg>);
const XlsIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 13 6 6m-6 0 6-6"/></svg>);
const CheckIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>);
const ClockIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
const XIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>);
const CoinIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9h4.5a2.5 2.5 0 0 1 0 5H9m0 0v-5m0 5h6"/></svg>);
const EditIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>);
const TrashIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>);

/* === estilos === */
const pageBg = {
  minHeight: 'calc(100vh - var(--sn-navbar-h))',
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
const leadStyle = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' };

const kpiGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sn-space-4)',
};

const filtrosGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sn-space-3)',
};

const filterMetaStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 'var(--sn-space-3)', flexWrap: 'wrap', marginTop: 'var(--sn-space-3)',
};
const filterCountStyle = {
  fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)',
  letterSpacing: 'var(--sn-tracking-wide)', fontWeight: 600,
};
const filterResetStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--sn-brand-glow)', fontWeight: 700,
  fontSize: 'var(--sn-fs-xs)', letterSpacing: 'var(--sn-tracking-wide)',
  fontFamily: 'var(--sn-font-ui)', padding: '4px 6px', borderRadius: 'var(--sn-radius-sm)',
};

const fieldLabelStyle = {
  display: 'block', marginBottom: 6,
  fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  letterSpacing: 'var(--sn-tracking-wide)',
  color: 'var(--sn-text-secondary)',
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%',
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0.85rem', outline: 'none',
};

const iconBtn = (tone) => {
  const c = { warn: 'var(--sn-warn)', crit: 'var(--sn-crit)', brand: 'var(--sn-brand-glow)' }[tone];
  return {
    width: 36, height: 36, borderRadius: 'var(--sn-radius-sm)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c,
    border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`,
    cursor: 'pointer',
    transition: 'background var(--sn-dur-fast) var(--sn-ease), transform var(--sn-dur-fast) var(--sn-ease)',
  };
};

const dangerCircleStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 64, height: 64, borderRadius: '50%',
  background: 'rgba(239,68,68,0.10)',
  border: '1px solid rgba(239,68,68,0.40)',
  color: 'var(--sn-crit)', fontSize: 28, fontWeight: 900,
};

export default Historial;
