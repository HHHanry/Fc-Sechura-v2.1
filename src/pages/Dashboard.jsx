import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useAlumnos } from '../hooks/useAlumnos';
import { useUltimosPagos, usePagosDelMes } from '../hooks/usePagos';
import { useAsistenciaHoy } from '../hooks/useAsistencia';
import { useDeudores } from '../hooks/useDeudores';
import { useConvocatorias } from '../hooks/useConvocatorias';
import { useUsuarios } from '../hooks/useUsuarios';
import { useCanteraAll } from '../hooks/useCantera';
import { withDefaults } from '../helpers/alumnoDefaults';
import {
  ROLES_FINANCIEROS, ROLES_DEPORTIVOS,
  ESTADOS_ALUMNO, formatMoney, formatDateLima,
} from '../config/businessRules';
import { Card, CardBody, KpiCard, Badge, DataTable, EmptyState, Skeleton, FilterBar } from '../components/ui';
import { EstadoDonut, ConvocatoriaChart, CanteraPipeline } from './dashboard/DashCharts';
import imagenPortada from '../assets/dashboard-cover.jpg';

const puedeVerFinanzas  = (rol) => ROLES_FINANCIEROS.includes(rol);
const puedeVerDeportivo = (rol) => ROLES_DEPORTIVOS.includes(rol);

/* ===========================================================
   Alertas: cómputo puro
   =========================================================== */
const computeAlerts = (alumnos, convocatorias, usuarios, rol) => {
  const alerts = [];
  const isFin  = ROLES_FINANCIEROS.includes(rol);
  const isDep  = ROLES_DEPORTIVOS.includes(rol);
  const isAdm  = rol === 'admin';

  if (isFin) {
    const n = alumnos.filter(a => a.estado === 'moroso').length;
    if (n > 0) alerts.push({ severity: 'alta', title: `${n} moroso${n > 1 ? 's' : ''}`, description: 'Alumnos con pagos pendientes.', link: '/alumnos', action: 'Ver alumnos' });
  }

  if (isDep) {
    const n = alumnos.filter(a => a.estado === 'lesionado').length;
    if (n > 0) alerts.push({ severity: 'alta', title: `${n} lesionado${n > 1 ? 's' : ''}`, description: 'Alumnos con lesión activa en plantilla.', link: '/alumnos', action: 'Ver alumnos' });
  }

  if (isDep) {
    const n = alumnos.filter(a => a.estado === 'suspendido' || a.estado === 'inactivo').length;
    if (n > 0) alerts.push({ severity: 'media', title: `${n} suspendido${n > 1 ? 's' : ''}/inactivo${n > 1 ? 's' : ''}`, description: 'Requieren seguimiento o reactivación.', link: '/alumnos', action: 'Revisar' });
  }

  if (isAdm) {
    const n = alumnos.filter(a => !a.contactosFamiliares || a.contactosFamiliares.length === 0).length;
    if (n > 0) alerts.push({ severity: 'media', title: `${n} sin contacto familiar`, description: 'Expedientes sin información de emergencia.', link: '/alumnos', action: 'Completar' });
  }

  if (isDep && convocatorias.length > 0) {
    const ult = convocatorias[0];
    const pend = (ult.convocados || []).filter(c => c.disponibilidad === 'pendiente').length;
    if (pend > 0) alerts.push({ severity: 'alta', title: `${pend} convocado${pend > 1 ? 's' : ''} pendiente${pend > 1 ? 's' : ''}`, description: `En "${ult.titulo || 'Última convocatoria'}"`, link: '/convocatoria', action: 'Ver convocatoria' });
  }

  if (isAdm) {
    const n = usuarios.filter(u => u.estado === 'suspendido' || u.estado === 'inactivo').length;
    if (n > 0) alerts.push({ severity: 'media', title: `${n} usuario${n > 1 ? 's' : ''} del staff`, description: 'Usuarios suspendidos o inactivos.', link: '/usuarios', action: 'Gestionar' });
  }

  const order = { alta: 0, media: 1, baja: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  return alerts;
};

/* ===========================================================
   Dashboard
   =========================================================== */
const Dashboard = () => {
  const { user } = useAuth();
  const rol = user?.rol ?? 'invitado';

  const { iso: hoyIso, dmy: hoyDmy } = useMemo(() => formatDateLima(), []);
  const yyyymm = hoyIso.slice(0, 7);

  /* --- filtros --- */
  const [filtroCat, setFiltroCat]       = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  /* --- data hooks (siempre incondicionales) --- */
  const { alumnos: alumnosRaw, loading: loadingAlumnos } = useAlumnos();
  const { pagos: ultimosPagos, loading: loadingPagos }   = useUltimosPagos(8);
  const { pagos: pagosDelMes, loading: loadingPagosMes } = usePagosDelMes(yyyymm);
  const { asistencias, loading: loadingAsist }           = useAsistenciaHoy(hoyDmy);
  const { resumen: resumenDeudas, loading: loadingDeudas } = useDeudores();
  const { convocatorias, loading: loadingConv }          = useConvocatorias(5);
  const { usuarios, loading: loadingUsuarios }           = useUsuarios();
  const { registros: canteraRegistros, loading: loadingCantera } = useCanteraAll();

  const verFinanzas  = puedeVerFinanzas(rol);
  const verDeportivo = puedeVerDeportivo(rol);
  const notInvitado  = rol !== 'invitado';

  /* --- defaults + filtro --- */
  const alumnos = useMemo(() => alumnosRaw.map(withDefaults), [alumnosRaw]);

  const alumnosFiltrados = useMemo(() => {
    let f = alumnos;
    if (filtroCat)    f = f.filter(a => a.categoria === filtroCat);
    if (filtroEstado) f = f.filter(a => a.estado === filtroEstado);
    return f;
  }, [alumnos, filtroCat, filtroEstado]);

  const categoriasDisponibles = useMemo(() =>
    [...new Set(alumnos.map(a => a.categoria).filter(Boolean))].sort(),
  [alumnos]);

  /* --- métricas derivadas --- */
  const totalAlumnos = alumnosFiltrados.length;
  const activos     = useMemo(() => alumnosFiltrados.filter(a => a.estado === 'activo').length, [alumnosFiltrados]);
  const lesionados  = useMemo(() => alumnosFiltrados.filter(a => a.estado === 'lesionado').length, [alumnosFiltrados]);
  const morosos     = useMemo(() => alumnosFiltrados.filter(a => a.estado === 'moroso').length, [alumnosFiltrados]);
  const becados     = useMemo(() => alumnosFiltrados.filter(a => a.estado === 'becado').length, [alumnosFiltrados]);
  const suspInact   = useMemo(() => alumnosFiltrados.filter(a => a.estado === 'suspendido' || a.estado === 'inactivo').length, [alumnosFiltrados]);

  const presentesHoy = asistencias.filter(a => a.estado !== 'Faltó').length;
  const porcentajeAsistencia = totalAlumnos > 0 ? Math.round((presentesHoy / totalAlumnos) * 100) : 0;

  const ingresosMes = useMemo(() =>
    pagosDelMes.reduce((sum, p) => sum + (Number(p.total) || 0), 0),
  [pagosDelMes]);

  const staffActivo = useMemo(() =>
    usuarios.filter(u => u.estado !== 'suspendido' && u.estado !== 'inactivo').length,
  [usuarios]);

  const promesas = useMemo(() =>
    canteraRegistros.filter(r => r.potencial === 'alto' || r.potencial === 'elite').length,
  [canteraRegistros]);

  /* --- distribuciones --- */
  const estadoDistribucion = useMemo(() => {
    const counts = {};
    ESTADOS_ALUMNO.forEach(e => { counts[e.value] = 0; });
    alumnosFiltrados.forEach(a => { counts[a.estado || 'activo'] = (counts[a.estado || 'activo'] || 0) + 1; });
    return ESTADOS_ALUMNO.filter(e => counts[e.value] > 0).map(e => ({ label: e.label, value: counts[e.value], color: e.color }));
  }, [alumnosFiltrados]);

  const distribucion = useMemo(() => {
    const map = {};
    alumnosFiltrados.forEach(a => { const cat = a.categoria || 'Sin Cat'; map[cat] = (map[cat] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => Number(b[1]) - Number(a[1]));
  }, [alumnosFiltrados]);

  const cumpleanieros = useMemo(() => {
    const mes = hoyIso.slice(5, 7);
    return alumnosFiltrados.filter(a => a.fechaNacimiento?.split('-')[1] === mes);
  }, [alumnosFiltrados, hoyIso]);

  const totalCategorias  = distribucion.length || 7;
  const maxAlumnosPorCat = Math.max(...distribucion.map(([, c]) => c), 1);

  /* --- alertas --- */
  const alertas = useMemo(() =>
    computeAlerts(alumnosFiltrados, convocatorias, usuarios, rol),
  [alumnosFiltrados, convocatorias, usuarios, rol]);

  /* --- resumen ejecutivo --- */
  const resumenItems = useMemo(() => {
    const items = [];
    if (verFinanzas && morosos > 0)
      items.push({ text: `${morosos} alumno${morosos > 1 ? 's' : ''} moroso${morosos > 1 ? 's' : ''} por revisar`, link: '/alumnos', tone: 'crit' });
    if (verDeportivo && lesionados > 0)
      items.push({ text: `${lesionados} lesionado${lesionados > 1 ? 's' : ''} activo${lesionados > 1 ? 's' : ''} en plantilla`, link: '/alumnos', tone: 'crit' });
    if (verDeportivo && convocatorias.length > 0) {
      const pend = (convocatorias[0].convocados || []).filter(c => c.disponibilidad === 'pendiente').length;
      if (pend > 0) items.push({ text: `${pend} convocado${pend > 1 ? 's' : ''} pendiente${pend > 1 ? 's' : ''} de confirmar`, link: '/convocatoria', tone: 'warn' });
    }
    if (rol === 'admin') {
      const sinC = alumnosFiltrados.filter(a => !a.contactosFamiliares || a.contactosFamiliares.length === 0).length;
      if (sinC > 0) items.push({ text: `${sinC} alumno${sinC > 1 ? 's' : ''} sin contacto familiar completo`, link: '/alumnos', tone: 'warn' });
    }
    if (verDeportivo && suspInact > 0)
      items.push({ text: `${suspInact} alumno${suspInact > 1 ? 's' : ''} suspendido${suspInact > 1 ? 's' : ''}/inactivo${suspInact > 1 ? 's' : ''}`, link: '/alumnos', tone: 'info' });
    return items;
  }, [morosos, lesionados, suspInact, alumnosFiltrados, convocatorias, rol, verFinanzas, verDeportivo]);

  /* =========== RENDER =========== */
  return (
    <div style={pageBg}>
      <BackgroundFx />
      <div style={contentWrap}>
        {/* === HERO === */}
        <Hero user={user} hoyDmy={hoyDmy} />

        {/* === FILTROS === */}
        <section style={{ marginTop: 'var(--sn-space-5)' }}>
          <FilterBar
            filters={[
              { id: 'cat', ariaLabel: 'Filtrar por categoría', value: filtroCat, onChange: setFiltroCat,
                options: [{ value: '', label: 'Todas las categorías' }, ...categoriasDisponibles.map(c => ({ value: c, label: `Cat. ${c}` }))] },
              { id: 'estado', ariaLabel: 'Filtrar por estado', value: filtroEstado, onChange: setFiltroEstado,
                options: [{ value: '', label: 'Todos los estados' }, ...ESTADOS_ALUMNO.map(e => ({ value: e.value, label: e.label }))] },
            ]}
            meta={loadingAlumnos ? 'Cargando…' : `${totalAlumnos} alumno${totalAlumnos === 1 ? '' : 's'} en vista`}
            onReset={(filtroCat || filtroEstado) ? () => { setFiltroCat(''); setFiltroEstado(''); } : undefined}
          />
        </section>

        {/* === KPIs === */}
        <section style={{ marginTop: 'var(--sn-space-6)' }}>
          <SectionHeader eyebrow="Vista rápida" title="Indicadores clave" />
          <div style={kpiGrid}>
            <KpiCard label="Alumnos" value={totalAlumnos} loading={loadingAlumnos}
              icon={<UsersIcon />} hint={filtroCat ? `Cat. ${filtroCat}` : 'Registrados'} accent="brand" />

            {(rol === 'admin' || rol === 'entrenador') && (
              <KpiCard label="Activos" value={activos} loading={loadingAlumnos}
                icon={<ActiveIcon />} hint={`${totalAlumnos > 0 ? Math.round((activos / totalAlumnos) * 100) : 0}% del total`} accent="success" />
            )}

            {verDeportivo && (
              <KpiCard label="Lesionados" value={lesionados} loading={loadingAlumnos}
                icon={<HeartIcon />} hint={lesionados > 0 ? 'Requieren seguimiento' : 'Ninguno'} accent="crit" />
            )}

            {verFinanzas && (
              <KpiCard label="Morosos" value={morosos} loading={loadingAlumnos}
                icon={<AlertIcon />} hint={morosos > 0 ? 'Pagos pendientes' : 'Al día'} accent="warn" />
            )}

            {verFinanzas && (
              <KpiCard label="Becados" value={becados} loading={loadingAlumnos}
                icon={<StarIcon />} hint="Con beca activa" accent="elite" />
            )}

            <KpiCard label="Asistencia hoy" value={porcentajeAsistencia} suffix="%"
              loading={loadingAsist || loadingAlumnos} icon={<CheckIcon />}
              hint={`${presentesHoy} / ${totalAlumnos} presentes`} accent="success" />

            {verFinanzas && (
              <KpiCard label="Deudas activas" value={resumenDeudas?.facturas ?? 0} loading={loadingDeudas}
                icon={<AlertTriangleIcon />} hint={resumenDeudas ? formatMoney(resumenDeudas.total) : '—'} accent="crit" />
            )}

            {verFinanzas && (
              <KpiCard label="Ingresos del mes" value={ingresosMes} loading={loadingPagosMes}
                icon={<MoneyIcon />} hint="Mes actual" accent="success" format={formatMoney} />
            )}

            {verDeportivo && (
              <KpiCard label="Convocatorias" value={convocatorias.length} loading={loadingConv}
                icon={<ClipboardIcon />} hint="Registradas" accent="brand" />
            )}

            {verDeportivo && (
              <KpiCard label="Promesas" value={promesas} loading={loadingCantera}
                icon={<TrophyIcon />} hint="Alto + Élite potencial" accent="elite" />
            )}

            {rol === 'admin' && (
              <KpiCard label="Staff activo" value={staffActivo} loading={loadingUsuarios}
                icon={<StaffIcon />} hint={`${usuarios.length} total`} accent="brand" />
            )}

            {rol === 'invitado' && (
              <KpiCard label="Categorías" value={totalCategorias} loading={loadingAlumnos}
                icon={<TrophyIcon />} hint="Activas en sistema" accent="elite" />
            )}
          </div>
        </section>

        {/* === RESUMEN EJECUTIVO === */}
        {notInvitado && resumenItems.length > 0 && (
          <section style={{ marginTop: 'var(--sn-space-5)' }}>
            <ResumenEjecutivo items={resumenItems} />
          </section>
        )}

        {/* === INTELIGENCIA: ALERTAS + GRÁFICOS === */}
        {notInvitado && (
          <section style={{ marginTop: 'var(--sn-space-7)' }}>
            <SectionHeader eyebrow="Inteligencia operativa" title="Análisis y alertas" />
            <div style={intelGridStyle} className="sn-dash-intel-grid">
              {/* ALERTAS */}
              <Card>
                <CardBody style={{ padding: 0 }}>
                  <div style={panelHeaderStyle}>
                    <div>
                      <h3 style={panelTitleStyle}>Alertas del sistema</h3>
                      <p style={panelSubtitleStyle}>{alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''}</p>
                    </div>
                    {alertas.length > 0 && <Badge tone="crit" size="lg">{alertas.length}</Badge>}
                  </div>
                  <div style={{ padding: 'var(--sn-space-4)' }}>
                    <AlertsPanel alerts={alertas} />
                  </div>
                </CardBody>
              </Card>

              {/* GRÁFICOS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-5)' }}>
                <Card>
                  <CardBody style={{ padding: 0 }}>
                    <div style={panelHeaderStyle}>
                      <div>
                        <h3 style={panelTitleStyle}>Distribución por estado</h3>
                        <p style={panelSubtitleStyle}>Estado actual de los alumnos</p>
                      </div>
                    </div>
                    <div style={{ padding: 'var(--sn-space-5)' }}>
                      {loadingAlumnos ? <Skeleton height={180} /> : <EstadoDonut segments={estadoDistribucion} />}
                    </div>
                  </CardBody>
                </Card>

                {verDeportivo && (
                  <Card>
                    <CardBody style={{ padding: 0 }}>
                      <div style={panelHeaderStyle}>
                        <div>
                          <h3 style={panelTitleStyle}>Última convocatoria</h3>
                          <p style={panelSubtitleStyle}>Estado de disponibilidad</p>
                        </div>
                      </div>
                      <div style={{ padding: 'var(--sn-space-5)' }}>
                        {loadingConv ? <Skeleton height={120} /> : <ConvocatoriaChart convocatoria={convocatorias[0]} />}
                      </div>
                      <div style={panelFooterStyle}>
                        <Link to="/convocatoria" style={panelLinkStyle}>Ir a convocatorias <ArrowRightIcon /></Link>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {verDeportivo && (
                  <Card>
                    <CardBody style={{ padding: 0 }}>
                      <div style={panelHeaderStyle}>
                        <div>
                          <h3 style={panelTitleStyle}>Pipeline de cantera</h3>
                          <p style={panelSubtitleStyle}>Evaluaciones de potencial</p>
                        </div>
                      </div>
                      <div style={{ padding: 'var(--sn-space-5)' }}>
                        {loadingCantera ? <Skeleton height={120} /> : <CanteraPipeline registros={canteraRegistros} />}
                      </div>
                      <div style={panelFooterStyle}>
                        <Link to="/cantera" style={panelLinkStyle}>Ir a cantera <ArrowRightIcon /></Link>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            </div>
          </section>
        )}

        {/* === DETALLE OPERATIVO === */}
        <section style={{ marginTop: 'var(--sn-space-7)' }}>
          <SectionHeader eyebrow="Operaciones" title="Detalle operativo" />
          <div style={mainGridStyle} className="sn-dashboard-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-5)' }}>
              <CategoriaPanel distribucion={distribucion} maxAlumnos={maxAlumnosPorCat} loading={loadingAlumnos} />

              {verFinanzas && (
                <Card>
                  <CardBody style={{ padding: 0 }}>
                    <div style={panelHeaderStyle}>
                      <div>
                        <h3 style={panelTitleStyle}>Últimos ingresos a caja</h3>
                        <p style={panelSubtitleStyle}>Movimientos recientes registrados en el libro mayor.</p>
                      </div>
                      <Badge tone="success" size="lg">Mes: {formatMoney(ingresosMes)}</Badge>
                    </div>

                    <DataTable
                      loading={loadingPagos}
                      rows={ultimosPagos}
                      columns={[
                        { key: 'fecha', header: 'Fecha', muted: true, width: 120, render: (r) => r.fecha ?? '—' },
                        { key: 'alumno', header: 'Alumno', render: (r) => (
                          <span style={{ fontWeight: 700 }}>{r.alumnoNombre}</span>
                        ) },
                        { key: 'monto', header: 'Monto', align: 'right', width: 140, render: (r) => (
                          <span style={{ fontFamily: 'var(--sn-font-mono)', color: 'var(--sn-success)', fontWeight: 800 }}>
                            {formatMoney(r.total)}
                          </span>
                        ) },
                        { key: 'estado', header: 'Estado', align: 'center', width: 130, render: (r) => (
                          <Badge tone={r.estado === 'Completado' ? 'success' : r.estado === 'Anulado' ? 'crit' : 'warn'}>
                            {r.estado}
                          </Badge>
                        ) },
                      ]}
                      empty={<EmptyState title="Sin transacciones" description="Aún no se ha registrado ningún ingreso." />}
                    />

                    <div style={panelFooterStyle}>
                      <Link to="/ver-pagos" style={panelLinkStyle}>Ir al libro mayor <ArrowRightIcon /></Link>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>

            {/* SIDEBAR */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-5)' }}>
              <CumpleaniosPanel lista={cumpleanieros} loading={loadingAlumnos} />
              {verFinanzas && <DeudoresPanel resumen={resumenDeudas} loading={loadingDeudas} />}
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
};

/* ===========================================================
   Sub-componentes
   =========================================================== */

const SectionHeader = ({ eyebrow, title }) => (
  <header style={{ marginBottom: 'var(--sn-space-5)' }}>
    <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' }}>
      {eyebrow}
    </span>
    <h2 style={{ margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-xl)', fontWeight: 700, color: 'var(--sn-text-primary)' }}>
      {title}
    </h2>
  </header>
);

const Hero = ({ user, hoyDmy }) => (
  <div className="sn-dashboard-hero" style={heroStyle}>
    <div style={heroBgStyle} aria-hidden />
    <div style={heroOverlayStyle} aria-hidden />
    <div className="sn-dashboard-hero-content" style={heroContentStyle}>
      <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' }}>
        CENTRO DE MANDO · {hoyDmy}
      </span>
      <h1 style={heroTitleStyle}>
        {greet()},<br /><span style={{ color: 'var(--sn-brand-glow)' }}>{user?.nombre ?? 'Staff'}</span>.
      </h1>
      <p style={heroLeadStyle}>
        Radiografía operativa de la academia: alumnos, asistencia, finanzas, rendimiento y alertas. Un solo lugar para tomar decisiones rápidas.
      </p>
    </div>
    <div className="sn-dashboard-hero-quote" style={heroQuoteStyle}>
      &ldquo;Nuestra pasión marca la diferencia.&rdquo;
      <span style={heroQuoteAuthorStyle}>— FC Sechura</span>
    </div>
  </div>
);

const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

/* --- Resumen ejecutivo --- */
const ResumenEjecutivo = ({ items }) => (
  <Card>
    <CardBody style={{ padding: 0 }}>
      <div style={panelHeaderStyle}>
        <div>
          <h3 style={panelTitleStyle}>Hoy debes revisar…</h3>
          <p style={panelSubtitleStyle}>Acciones recomendadas según datos actuales</p>
        </div>
        <BulbIcon />
      </div>
      <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5)' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-2)' }}>
          {items.map((item, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)', padding: '0.5rem 0' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: item.tone === 'crit' ? 'var(--sn-crit)' : item.tone === 'warn' ? 'var(--sn-warn)' : 'var(--sn-info)',
              }} />
              <span style={{ flex: 1, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)', fontWeight: 600 }}>
                {item.text}
              </span>
              {item.link && (
                <Link to={item.link} style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 700, color: 'var(--sn-brand-glow)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Ver →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </CardBody>
  </Card>
);

/* --- Alertas panel --- */
const AlertsPanel = ({ alerts }) => {
  if (alerts.length === 0) return <EmptyState title="Todo en orden" description="No hay alertas que requieran atención." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
      {alerts.map((alert, i) => {
        const tone = alert.severity === 'alta' ? 'crit' : alert.severity === 'media' ? 'warn' : 'info';
        const borderColor = alert.severity === 'alta' ? 'var(--sn-crit)' : alert.severity === 'media' ? 'var(--sn-warn)' : 'var(--sn-info)';
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--sn-space-3)',
            padding: 'var(--sn-space-3) var(--sn-space-4)',
            borderRadius: 'var(--sn-radius-md)',
            background: 'var(--sn-row-soft)',
            border: '1px solid var(--sn-border-faint)',
            borderLeft: `4px solid ${borderColor}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sn-space-2)', marginBottom: 4, flexWrap: 'wrap' }}>
                <Badge tone={tone}>{alert.severity.toUpperCase()}</Badge>
                <span style={{ fontWeight: 700, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)' }}>
                  {alert.title}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                {alert.description}
              </p>
            </div>
            {alert.link && (
              <Link to={alert.link} style={alertActionStyle}>
                {alert.action || 'Ver'} <ArrowRightIcon />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* --- Paneles existentes --- */
const CategoriaPanel = ({ distribucion, maxAlumnos, loading }) => (
  <Card>
    <CardBody style={{ padding: 0 }}>
      <div style={panelHeaderStyle}>
        <div>
          <h3 style={panelTitleStyle}>Población por categoría</h3>
          <p style={panelSubtitleStyle}>Distribución de alumnos según rango etario.</p>
        </div>
      </div>
      <div style={{ padding: 'var(--sn-space-5)' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sn-space-4)' }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={48} />)}
          </div>
        ) : distribucion.length === 0 ? (
          <EmptyState title="Sin alumnos" description="No hay alumnos asignados a categorías todavía." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sn-space-5) var(--sn-space-6)' }}>
            {distribucion.map(([cat, count]) => (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 'var(--sn-fs-sm)', fontWeight: 700, color: 'var(--sn-text-secondary)' }}>Cat. {cat}</span>
                  <span style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-sm)', fontWeight: 800, color: 'var(--sn-text-primary)' }}>
                    {count} <span style={{ color: 'var(--sn-text-muted)', fontWeight: 600 }}>alum.</span>
                  </span>
                </div>
                <div style={progressTrackStyle}>
                  <div style={{ ...progressBarStyle, width: `${(count / maxAlumnos) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CardBody>
  </Card>
);

const CumpleaniosPanel = ({ lista, loading }) => (
  <Card>
    <CardBody style={{ padding: 0 }}>
      <div style={panelHeaderStyle}>
        <div>
          <h3 style={panelTitleStyle}>Cumpleaños del mes</h3>
          <p style={panelSubtitleStyle}>{loading ? 'Calculando...' : `${lista.length} festejados`}</p>
        </div>
        <CakeIcon />
      </div>
      <div style={{ padding: 'var(--sn-space-3) var(--sn-space-5) var(--sn-space-5)' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={36} />)}
          </div>
        ) : lista.length === 0 ? (
          <EmptyState title="Sin festejados" description="Ningún alumno cumple años este mes." />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-2)' }}>
            {lista.slice(0, 6).map((c) => {
              const parts = (c.fechaNacimiento ?? '').split('-');
              return (
                <li key={c.id} style={listRowStyle}>
                  <span style={listDateChipStyle}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--sn-text-muted)', lineHeight: 1 }}>{parts[1] ?? '--'}</span>
                    <span style={{ fontSize: 'var(--sn-fs-sm)', fontWeight: 800, lineHeight: 1, color: 'var(--sn-text-primary)' }}>{parts[2] ?? '--'}</span>
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--sn-text-primary)' }}>
                    {c.nombre} {c.apellido}
                  </span>
                </li>
              );
            })}
            {lista.length > 6 && (
              <li style={{ marginTop: 4, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', textAlign: 'center' }}>
                + {lista.length - 6} más
              </li>
            )}
          </ul>
        )}
      </div>
    </CardBody>
  </Card>
);

const DeudoresPanel = ({ resumen, loading }) => (
  <Card variant="surface">
    <CardBody style={{ padding: 0 }}>
      <div style={panelHeaderStyle}>
        <div>
          <h3 style={panelTitleStyle}>Deudores críticos</h3>
          <p style={panelSubtitleStyle}>{loading ? 'Calculando...' : `${resumen?.facturas ?? 0} facturas vencidas`}</p>
        </div>
        <Badge tone="crit" size="lg">{resumen ? formatMoney(resumen.total) : '—'}</Badge>
      </div>
      <div style={{ padding: 'var(--sn-space-3) var(--sn-space-5) var(--sn-space-5)' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={36} />)}
          </div>
        ) : !resumen || resumen.top5.length === 0 ? (
          <EmptyState title="Todo en orden" description="No hay deudas en el sistema." />
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-2)' }}>
            {resumen.top5.map((d, i) => (
              <li key={d.nombre} style={{ ...listRowStyle, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={rankBadgeStyle}>{i + 1}</span>
                  <span style={{ fontWeight: 700, color: 'var(--sn-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.nombre}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 800, color: 'var(--sn-crit)' }}>
                  {formatMoney(d.monto)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </CardBody>
  </Card>
);

/* ===========================================================
   Iconos
   =========================================================== */
const UsersIcon       = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 19a5.5 5.5 0 0 1 5.5-5.5"/></svg>);
const CheckIcon       = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m8 15 3 3 5-5"/></svg>);
const AlertIcon       = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>);
const AlertTriangleIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.7a2 2 0 0 1 3.4 0l8.4 14.6A2 2 0 0 1 20.4 21H3.6a2 2 0 0 1-1.7-2.7L10.3 3.7Z"/></svg>);
const TrophyIcon      = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M5 4H3v3a3 3 0 0 0 3 3M19 4h2v3a3 3 0 0 1-3 3"/></svg>);
const CakeIcon        = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sn-tier-elite)" strokeWidth="2"><path d="M12 6V3M9 6h6"/><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M4 14c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2"/></svg>);
const ArrowRightIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
const HeartIcon       = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>);
const StarIcon        = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
const MoneyIcon       = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
const ClipboardIcon   = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>);
const StaffIcon       = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const ActiveIcon      = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>);
const BulbIcon        = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sn-warn)" strokeWidth="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg>);
const BackgroundFx = () => (
  <div aria-hidden style={{
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: `
      radial-gradient(800px 500px at 0% 0%, color-mix(in srgb, var(--sn-brand-glow) 10%, transparent), transparent 60%),
      radial-gradient(700px 600px at 100% 30%, rgba(30,58,138,0.20), transparent 55%)
    `,
  }} />
);

/* ===========================================================
   Estilos
   =========================================================== */
const pageBg = {
  minHeight: 'calc(100vh - 73px)',
  background: 'var(--sn-bg-base)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
  position: 'relative',
};

const contentWrap = {
  position: 'relative',
  maxWidth: 1280,
  margin: '0 auto',
  padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)',
};

const heroStyle = {
  position: 'relative',
  borderRadius: 'var(--sn-radius-xl)',
  overflow: 'hidden',
  border: '1px solid var(--sn-border-soft)',
  boxShadow: 'var(--sn-shadow-lg)',
  minHeight: 320,
  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
};

const heroBgStyle = {
  position: 'absolute', inset: 0,
  backgroundImage: `url(${imagenPortada})`,
  backgroundSize: 'cover', backgroundPosition: 'center',
  filter: 'saturate(0.85)',
};

const heroOverlayStyle = {
  position: 'absolute', inset: 0,
  background: `
    linear-gradient(135deg, rgba(7,9,15,0.92) 0%, rgba(15,20,34,0.65) 60%, color-mix(in srgb, var(--sn-brand-glow) 12%, transparent) 100%)
  `,
};

const heroContentStyle = {
  position: 'relative',
  padding: 'var(--sn-space-7) var(--sn-space-6)',
  maxWidth: 720,
};

const heroTitleStyle = {
  margin: '0.6rem 0 0.6rem',
  fontFamily: 'var(--sn-font-display)',
  fontSize: 'clamp(1.8rem, 3.6vw, 3.2rem)',
  fontWeight: 800,
  letterSpacing: 'var(--sn-tracking-tight)',
  color: 'var(--sn-text-primary)',
  textShadow: '0 6px 30px rgba(0,0,0,0.55)',
  lineHeight: 1.05,
};

const heroLeadStyle = {
  margin: 0,
  color: 'var(--sn-text-secondary)',
  fontSize: 'var(--sn-fs-md)',
  maxWidth: 600,
  lineHeight: 1.5,
};

const heroQuoteStyle = {
  position: 'relative',
  alignSelf: 'flex-end',
  margin: 'var(--sn-space-5)',
  padding: '0.75rem 1.1rem',
  background: 'var(--sn-overlay-strong)',
  border: '1px solid var(--sn-border-glow)',
  borderRadius: 'var(--sn-radius-md)',
  backdropFilter: 'blur(8px)',
  fontStyle: 'italic',
  color: 'var(--sn-text-secondary)',
  fontSize: 'var(--sn-fs-sm)',
  maxWidth: 360,
  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
};

const heroQuoteAuthorStyle = {
  fontStyle: 'normal', fontWeight: 800,
  fontSize: 'var(--sn-fs-xs)',
  letterSpacing: 'var(--sn-tracking-wide)',
  color: 'var(--sn-brand-glow)',
};

const kpiGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 'var(--sn-space-4)',
};

const intelGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 'var(--sn-space-5)',
  alignItems: 'start',
};

const mainGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
  gap: 'var(--sn-space-5)',
};

const panelHeaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sn-space-4)',
  padding: 'var(--sn-space-5)',
  borderBottom: '1px solid var(--sn-border-faint)',
};

const panelTitleStyle = {
  margin: 0, fontFamily: 'var(--sn-font-display)',
  fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)',
  letterSpacing: 'var(--sn-tracking-tight)',
};

const panelSubtitleStyle = {
  margin: '0.2rem 0 0',
  fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-muted)',
};

const panelFooterStyle = {
  display: 'flex', justifyContent: 'flex-end',
  padding: 'var(--sn-space-4) var(--sn-space-5)',
  borderTop: '1px solid var(--sn-border-faint)',
};

const panelLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '0.5rem 0.9rem',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'color-mix(in srgb, var(--sn-brand-glow) 12%, transparent)',
  border: '1px solid var(--sn-border-glow)',
  color: 'var(--sn-brand-glow)',
  fontSize: 'var(--sn-fs-sm)', fontWeight: 700,
  textDecoration: 'none',
  letterSpacing: 'var(--sn-tracking-wide)',
};

const alertActionStyle = {
  fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  color: 'var(--sn-brand-glow)', textDecoration: 'none',
  whiteSpace: 'nowrap', padding: '4px 8px',
  borderRadius: 'var(--sn-radius-sm)',
  background: 'color-mix(in srgb, var(--sn-brand-glow) 10%, transparent)',
  border: '1px solid color-mix(in srgb, var(--sn-brand-glow) 25%, transparent)',
  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
};

const progressTrackStyle = {
  height: 8,
  borderRadius: 'var(--sn-radius-pill)',
  background: 'var(--sn-track-bg)',
  overflow: 'hidden',
};

const progressBarStyle = {
  height: '100%',
  background: 'var(--sn-brand-gradient)',
  borderRadius: 'var(--sn-radius-pill)',
  boxShadow: '0 0 12px var(--sn-border-glow)',
  transition: 'width var(--sn-dur-slow) var(--sn-ease)',
};

const listRowStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '0.55rem 0.7rem',
  borderRadius: 'var(--sn-radius-md)',
  background: 'var(--sn-row-soft)',
  border: '1px solid var(--sn-border-faint)',
  fontSize: 'var(--sn-fs-sm)',
};

const listDateChipStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  width: 38, height: 38, borderRadius: 'var(--sn-radius-sm)',
  background: 'rgba(251,191,36,0.10)',
  border: '1px solid rgba(251,191,36,0.30)',
  justifyContent: 'center',
};

const rankBadgeStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24, borderRadius: '50%',
  background: 'var(--sn-crit)', color: 'white',
  fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
  flexShrink: 0,
};

/* ===========================================================
   Responsive
   =========================================================== */
const styleSheet = `
  @media (max-width: 991.98px) {
    .sn-dashboard-grid   { grid-template-columns: 1fr !important; }
    .sn-dash-intel-grid  { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 640px) {
    .sn-dashboard-hero        { min-height: 240px !important; }
    .sn-dashboard-hero-content { padding: var(--sn-space-5) var(--sn-space-4) !important; }
    .sn-dashboard-hero-quote  {
      max-width: calc(100% - 1.5rem) !important;
      margin: var(--sn-space-3) !important;
      font-size: var(--sn-fs-xs) !important;
      align-self: stretch !important;
      align-items: flex-start !important;
    }
  }
`;

export default function DashboardWrapper() {
  return (
    <>
      <style>{styleSheet}</style>
      <Dashboard />
    </>
  );
}
