import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import FifaRadar from '../components/FifaRadar';
import { Card, CardBody, Button, Badge, DataTable, EmptyState, Skeleton, StatusBadge } from '../components/ui';
import { usePagosDeAlumno } from '../hooks/usePagos';
import { useAsistenciaDeAlumno } from '../hooks/useAsistencia';
import { useDeudasDeAlumno } from '../hooks/useDeudores';
import { useAlumno, mutarAlumnos } from '../hooks/useAlumnos';
import { toast } from '../hooks/useToast';
import { PlanVivoCard, CompetenciasCard, CanteraCard } from './detalle-alumno/SidebarCards';
import { TabResumen } from './detalle-alumno/TabResumen';
import { TabTimeline } from './detalle-alumno/TabTimeline';
import {
  PRECIO_MENSUALIDAD, formatMoney, formatDateLima, getPlayerTier, calculateOVR, STAT_KEYS,
} from '../config/businessRules';
import { withDefaults } from '../helpers/alumnoDefaults';
import { useAuth } from '../context/useAuth';
import { puedeEditarAlumno } from '../helpers/permisosHelper';

// function declarations para los iconos usados antes de su definición textual (TDZ-safe)
function DocIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></svg>); }
function RunIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13" cy="4" r="2"/><path d="m4 22 5-9 4 4 4-5 4 5"/></svg>); }
function WalletIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2"/></svg>); }
function CalendarIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>); }
function ClipboardIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>); }
function TimelineIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>); }

const TABS = [
  { id: 'resumen',    label: 'Resumen',  icon: <ClipboardIcon /> },
  { id: 'general',    label: 'Datos',    icon: <DocIcon /> },
  { id: 'deportivo',  label: 'Físico',   icon: <RunIcon /> },
  { id: 'finanzas',   label: 'Finanzas', icon: <WalletIcon /> },
  { id: 'asistencia', label: 'Asist.',   icon: <CalendarIcon /> },
  { id: 'timeline',   label: 'Historial',icon: <TimelineIcon /> },
];

const resolveAlumnoId = (params, searchParams, state) =>
  params.id || searchParams.get('id') || state?.alumno?.id || null;

const DetalleAlumno = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const puedeEditar = puedeEditarAlumno(user);

  const alumnoId = resolveAlumnoId(params, searchParams, location.state);
  const stateAlumno = location.state?.alumno ?? null;
  const alumnoInicial = (stateAlumno?.id === alumnoId) ? stateAlumno : null;

  // Siempre intenta cargar de Firestore si hay ID (para F5 / deep-link / state stale)
  const { alumno: alumnoRemoto, loading: loadingRemoto } = useAlumno(alumnoId);

  const [alumnoLocal, setAlumnoLocal] = useState(alumnoInicial);

  // Sincroniza: state si existe, sino remote. Aplica defaults seguros.
  const alumnoRaw = alumnoLocal ?? alumnoRemoto ?? null;
  const alumno = useMemo(() => withDefaults(alumnoRaw), [alumnoRaw]);

  // Cuando llega el remote, sincroniza local (cache rápido o F5)
  useEffect(() => {
    if (alumnoRemoto) setAlumnoLocal(alumnoRemoto);
  }, [alumnoRemoto]);

  // Alias para ediciones locales (mantiene compatibilidad con guardarMedico etc.)
  const setAlumno = setAlumnoLocal;

  const [tab, setTab] = useState('resumen');
  const [filtroMes, setFiltroMes] = useState('Todos');
  const [editandoMedico, setEditandoMedico] = useState(false);
  const [datosMedicos, setDatosMedicos] = useState({
    tipoSangre: 'No especificado', alergias: '', lesionesPrevias: '', seguro: '',
  });
  const [guardandoMedico, setGuardandoMedico] = useState(false);

  const { pagos, loading: loadingPagos } = usePagosDeAlumno(alumno?.id);
  const { asistencias, loading: loadingAsist } = useAsistenciaDeAlumno(alumno?.id);
  const { deudas, loading: loadingDeudas } = useDeudasDeAlumno(alumno?.id);

  useEffect(() => {
    if (alumno?.medico) setDatosMedicos((prev) => ({ ...prev, ...alumno.medico }));
  }, [alumno?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Variables derivadas ===
  const inicial = (alumno?.nombre ?? '?').charAt(0).toUpperCase() + (alumno?.apellido ?? '').charAt(0).toUpperCase();
  const celular = String(alumno?.celular ?? '').replace(/\D/g, '');
  const linkWhatsApp = celular.length >= 9 ? `https://wa.me/51${celular}` : null;

  const { iso: hoyIso } = formatDateLima();
  const vencimiento = String(alumno?.vencimientoMensualidad ?? '2000-01-01');
  const debeMes = hoyIso >= vencimiento;
  const diasAtraso = useMemo(() => {
    if (!debeMes) return 0;
    const v = new Date(vencimiento);
    if (isNaN(v.getTime())) return 0;
    return Math.ceil(Math.abs(new Date() - v) / (1000 * 60 * 60 * 24));
  }, [debeMes, vencimiento]);

  const deudasPendientes = deudas.filter((d) => d.estado === 'Pendiente');
  const totalDeudasExtras = deudasPendientes.reduce((s, d) => s + (Number(d.monto) || 0), 0);
  const estaMoroso = debeMes || totalDeudasExtras > 0;

  const pagosCompletados = pagos.filter((p) => p.estado === 'Completado');
  const totalPagado = pagosCompletados.reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
  const deudaTotal = (debeMes ? PRECIO_MENSUALIDAD : 0) + totalDeudasExtras;
  const totalFacturado = totalPagado + deudaTotal;
  const cumplimiento = totalFacturado === 0 ? 100 : Math.round((totalPagado / totalFacturado) * 100);

  const lineaTiempo = useMemo(() => {
    const items = [
      ...pagosCompletados.map((p) => ({ ...p, _tipo: 'Pago' })),
      ...deudas.map((d) => ({ ...d, _tipo: 'Deuda' })),
    ];
    const time = (o) => o.createdAt?.toMillis?.() ?? 0;
    return items.sort((a, b) => time(b) - time(a));
  }, [pagosCompletados, deudas]);

  const asistFiltradas = useMemo(() => {
    if (filtroMes === 'Todos') return asistencias;
    return asistencias.filter((a) => String(a.fecha ?? '').includes(filtroMes));
  }, [asistencias, filtroMes]);

  const totalClases = asistFiltradas.length;
  const asistenciasOK = asistFiltradas.filter((a) => a.estado === 'Asistió').length;
  const tardanzas    = asistFiltradas.filter((a) => a.estado === 'Tarde').length;
  const faltas       = asistFiltradas.filter((a) => a.estado === 'Faltó').length;
  const tasaAsist    = totalClases === 0 ? 0 : Math.round(((asistenciasOK + tardanzas) / totalClases) * 100);

  // === Stats reales del alumno (no hardcoded) ===
  const stats = useMemo(() => {
    const out = {};
    STAT_KEYS.forEach((k) => { out[k] = Number(alumno?.[k]) || 0; });
    return out;
  }, [alumno]);
  const ovr = alumno ? (alumno.ovr ?? calculateOVR(stats)) : 0;
  const tier = getPlayerTier(ovr);

  // === Estado de carga (F5 sin state, esperando Firestore) ===
  if (loadingRemoto && !alumno) {
    return (
      <div style={pageBg}>
        <div style={contentWrap}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
            <Skeleton style={{ height: 48, maxWidth: 200 }} />
            <div style={mainGridStyle} className="sn-detalle-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
                <Skeleton style={{ height: 300 }} />
                <Skeleton style={{ height: 80 }} />
              </div>
              <Skeleton style={{ height: 400 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === Pantalla de rescate (ID no encontrado o no proporcionado) ===
  if (!alumno || !alumno.id) {
    return (
      <div style={pageBg}>
        <div style={contentWrap}>
          <Card>
            <CardBody style={{ padding: 'var(--sn-space-7)', textAlign: 'center' }}>
              <div style={rescateIconStyle}>?</div>
              <h2 style={{ margin: '0 0 var(--sn-space-2)', fontFamily: 'var(--sn-font-display)', color: 'var(--sn-text-primary)' }}>
                {alumnoId ? 'Alumno no encontrado' : 'Sesión no encontrada'}
              </h2>
              <p style={{ color: 'var(--sn-text-muted)', marginBottom: 'var(--sn-space-5)' }}>
                {alumnoId
                  ? 'El ID proporcionado no corresponde a ningún alumno registrado.'
                  : 'Recargaste la página y los datos temporales se limpiaron. Usa el directorio para navegar.'}
              </p>
              <Button onClick={() => navigate('/alumnos')} icon={<ArrowLeftIcon />}>Volver al directorio</Button>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  const guardarMedico = async () => {
    setGuardandoMedico(true);
    try {
      await mutarAlumnos.actualizar(alumno.id, { medico: datosMedicos });
      setAlumno((prev) => ({ ...prev, medico: datosMedicos }));
      setEditandoMedico(false);
      toast.success('Ficha médica actualizada.');
    } catch {
      toast.error('No se pudo guardar la ficha médica.');
    } finally {
      setGuardandoMedico(false);
    }
  };

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        {/* === Top bar === */}
        <div style={topBarStyle}>
          <Button variant="ghost" icon={<ArrowLeftIcon />} onClick={() => navigate(-1)}>Volver al directorio</Button>
          {estaMoroso && (
            <Button variant="danger" icon={<CashIcon />} onClick={() => navigate('/registrar-pago')}>
              Realizar cobro
            </Button>
          )}
        </div>

        <div style={mainGridStyle} className="sn-detalle-grid">
          {/* === Columna lateral: perfil === */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
            <PerfilCard alumno={alumno} inicial={inicial} ovr={ovr} tier={tier} linkWhatsApp={linkWhatsApp} celular={String(alumno.celular ?? '')} />

            <Card>
              <CardBody style={{ display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)' }}>
                <div style={medalStyle}><MedalIcon /></div>
                <div>
                  <div style={subLabelStyle}>Inscripción oficial</div>
                  <div style={{ fontFamily: 'var(--sn-font-display)', fontWeight: 700, color: 'var(--sn-text-primary)' }}>
                    {alumno.fechaInscripcion ?? 'Sin registro'}
                  </div>
                </div>
              </CardBody>
            </Card>

            <PlanVivoCard alumnoId={alumno.id} />
            <CompetenciasCard alumnoId={alumno.id} />
            <CanteraCard alumnoId={alumno.id} />
          </aside>

          {/* === Columna principal: tabs === */}
          <section>
            <div style={tabsBarStyle}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="sn-focusable"
                  style={tabBtnStyle(tab === t.id)}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {tab === 'resumen' && (
              <TabResumen alumno={alumno} setAlumno={setAlumno} puedeEditar={puedeEditar} />
            )}

            {tab === 'general' && (
              <TabGeneral
                alumno={alumno}
                puedeEditar={puedeEditar}
                editandoMedico={editandoMedico} setEditandoMedico={setEditandoMedico}
                datosMedicos={datosMedicos} setDatosMedicos={setDatosMedicos}
                guardandoMedico={guardandoMedico} guardarMedico={guardarMedico}
              />
            )}

            {tab === 'deportivo' && (
              <TabDeportivo alumno={alumno} stats={stats} ovr={ovr} tier={tier} />
            )}

            {tab === 'finanzas' && (
              <TabFinanzas
                estaMoroso={estaMoroso} debeMes={debeMes} diasAtraso={diasAtraso}
                vencimiento={vencimiento} totalPagado={totalPagado} cumplimiento={cumplimiento}
                lineaTiempo={lineaTiempo} loading={loadingPagos || loadingDeudas}
              />
            )}

            {tab === 'asistencia' && (
              <TabAsistencia
                asistencias={asistFiltradas} totalClases={totalClases}
                tasaAsist={tasaAsist} tardanzas={tardanzas} faltas={faltas}
                filtroMes={filtroMes} setFiltroMes={setFiltroMes}
                loading={loadingAsist}
              />
            )}

            {tab === 'timeline' && (
              <TabTimeline alumno={alumno} setAlumno={setAlumno} puedeEditar={puedeEditar} />
            )}
          </section>
        </div>
      </div>

      <style>{`
        @media (max-width: 991.98px) {
          .sn-detalle-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

/* =====================================================
   PERFIL CARD lateral
   ===================================================== */

const PerfilCard = ({ alumno, inicial, ovr, tier, linkWhatsApp, celular }) => (
  <Card variant={ovr >= 75 ? 'tier' : 'surface'}>
    <CardBody style={{ padding: 0 }}>
      <div style={perfilHeroStyle}>
        <div style={perfilHeroGlowStyle} aria-hidden />
        {alumno.foto ? (
          <img src={alumno.foto} alt="" style={perfilFotoStyle} />
        ) : (
          <div style={{ ...perfilFotoStyle, background: 'var(--sn-brand-gradient)', color: '#06121A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 36 }}>
            {inicial}
          </div>
        )}

        {/* Tier badge si tiene OVR */}
        {ovr > 0 && (
          <div style={{ ...tierChipStyle, color: tier.color, borderColor: tier.color, boxShadow: `0 0 18px ${tier.glow}` }}>
            <span style={{ fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-lg)', fontWeight: 800 }}>{ovr}</span>
            <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)' }}>{tier.label}</span>
          </div>
        )}
      </div>

      <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5) var(--sn-space-5)', textAlign: 'center' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontWeight: 800, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' }}>
          {alumno.nombre} {alumno.apellido}
        </h3>
        <p style={{ margin: '0.3rem 0 var(--sn-space-3)', fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
          DNI · {alumno.dni}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--sn-space-4)' }}>
          <StatusBadge value={alumno.estado} />
          <Badge tone="brand">Cat. {alumno.categoria}</Badge>
          <Badge tone="neutral">{alumno.edad ?? '—'} años</Badge>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {linkWhatsApp ? (
            <a href={linkWhatsApp} target="_blank" rel="noreferrer" style={contactBtnStyle('success')} className="sn-focusable">
              <WhatsappIcon /> Mensaje
            </a>
          ) : <DisabledContact label="WhatsApp" />}
          {celular ? (
            <a href={`tel:${celular}`} style={contactBtnStyle('brand')} className="sn-focusable">
              <PhoneIcon /> Llamar
            </a>
          ) : <DisabledContact label="Llamar" />}
        </div>
      </div>
    </CardBody>
  </Card>
);

const DisabledContact = ({ label }) => (
  <button disabled style={{ ...contactBtnStyle('neutral'), opacity: 0.4, cursor: 'not-allowed' }}>
    <i style={{ fontSize: 12 }}>—</i> {label}
  </button>
);

/* =====================================================
   TAB: GENERAL (datos + médico)
   ===================================================== */

const TabGeneral = ({ alumno, puedeEditar, editandoMedico, setEditandoMedico, datosMedicos, setDatosMedicos, guardandoMedico, guardarMedico }) => (
  <div style={tabGridStyle}>
    <Card>
      <CardBody style={{ padding: 0 }}>
        <PanelHeader title="Contacto y residencia" icon={<PinIcon />} />
        <div style={{ padding: 'var(--sn-space-5)' }}>
          <DataRow label="Apoderado responsable" value={alumno.apoderado || 'No registrado'} />
          <DataRow label="Celular" value={alumno.celular || 'No registrado'} accent />
          <DataRow label="Dirección" value={`${alumno.direccion || 'No registrada'}${alumno.distrito ? ' · ' + alumno.distrito : ''}`} />
          <DataRow label="Colegio" value={alumno.colegio || 'No registrado'} last />
        </div>
      </CardBody>
    </Card>

    <Card>
      <CardBody style={{ padding: 0 }}>
        <PanelHeader
          title="Ficha médica"
          icon={<HeartIcon />}
          tone="crit"
          action={puedeEditar && !editandoMedico && (
            <button onClick={() => setEditandoMedico(true)} style={editLinkStyle} className="sn-focusable">Editar</button>
          )}
        />
        <div style={{ padding: 'var(--sn-space-5)' }}>
          {!editandoMedico && alumno.medico?.alergias && (
            <div style={alergiaBannerStyle}>
              <strong>Alerta:</strong> {alumno.medico.alergias}
            </div>
          )}

          {editandoMedico ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
              <FormSelect label="Grupo sanguíneo" name="tipoSangre" value={datosMedicos.tipoSangre}
                onChange={(e) => setDatosMedicos({ ...datosMedicos, tipoSangre: e.target.value })}
                options={['No especificado', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']} />
              <FormInput label="Alergias" name="alergias" value={datosMedicos.alergias}
                onChange={(e) => setDatosMedicos({ ...datosMedicos, alergias: e.target.value })}
                placeholder="Ej: Asma, penicilina..." critical />
              <FormTextarea label="Lesiones previas" name="lesionesPrevias" value={datosMedicos.lesionesPrevias}
                onChange={(e) => setDatosMedicos({ ...datosMedicos, lesionesPrevias: e.target.value })}
                placeholder="Ej: Esguince derecho" />
              <FormInput label="Seguro de salud" name="seguro" value={datosMedicos.seguro}
                onChange={(e) => setDatosMedicos({ ...datosMedicos, seguro: e.target.value })}
                placeholder="Ej: EsSalud, Sanna" />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Button variant="ghost" onClick={() => setEditandoMedico(false)} disabled={guardandoMedico}>Cancelar</Button>
                <Button variant="danger" onClick={guardarMedico} loading={guardandoMedico}>Guardar ficha</Button>
              </div>
            </div>
          ) : (
            <>
              <DataRow label="Tipo de sangre" value={alumno.medico?.tipoSangre || 'N/R'} accent="crit" />
              <DataRow label="Seguro médico"  value={alumno.medico?.seguro       || 'N/R'} />
              <DataRow label="Lesiones previas" value={alumno.medico?.lesionesPrevias || 'Ninguna registrada.'} last />
            </>
          )}
        </div>
      </CardBody>
    </Card>
  </div>
);

/* =====================================================
   TAB: DEPORTIVO
   ===================================================== */

const TabDeportivo = ({ alumno, stats, ovr, tier }) => {
  const tieneStats = ovr > 0;
  return (
    <Card variant={tieneStats ? 'tier' : 'surface'}>
      <CardBody style={{ padding: 0 }}>
        <PanelHeader title="Performance Card · estilo FIFA" icon={<BallIcon />} tone="elite" />
        <div style={{ padding: 'var(--sn-space-5)' }}>
          {!tieneStats ? (
            <EmptyState
              icon={<BallIcon />}
              title="Sin evaluación deportiva"
              description="Este alumno aún no tiene una evaluación FIFA registrada. Completa una desde la sección Stats."
            />
          ) : (
            <div style={performanceGridStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
                <div style={ovrCardStyle}>
                  <span style={{ fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-4xl)', color: tier.color, lineHeight: 1, fontWeight: 800 }}>{ovr}</span>
                  <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: tier.color }}>{tier.label}</span>
                  <span style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', letterSpacing: 'var(--sn-tracking-wide)', marginTop: 4 }}>OVERALL</span>
                </div>
                <div style={atributosStyle}>
                  <h6 style={panelTitleSmall}>Atributos base</h6>
                  <DataRow label="Estatura" value={alumno.estatura ? `${alumno.estatura} m` : 'N/R'} compact />
                  <DataRow label="Peso" value={alumno.peso ? `${alumno.peso} kg` : 'N/R'} compact />
                  <DataRow label="Pierna hábil" value={alumno.piernaHabil || 'N/R'} compact />
                  <DataRow label="Posición" value={alumno.posicion || 'Polifuncional'} compact accent="brand" last />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FifaRadar stats={stats} />
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

/* =====================================================
   TAB: FINANZAS
   ===================================================== */

const TabFinanzas = ({ estaMoroso, debeMes, diasAtraso, vencimiento, totalPagado, cumplimiento, lineaTiempo, loading }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
    <Card variant={estaMoroso ? 'surface' : 'glow'}
      style={{
        borderColor: estaMoroso ? 'rgba(239,68,68,0.45)' : 'var(--sn-border-glow)',
        boxShadow: estaMoroso ? 'var(--sn-shadow-crit)' : 'var(--sn-shadow-glow)',
      }}>
      <CardBody style={{ textAlign: 'center', padding: 'var(--sn-space-7) var(--sn-space-5)' }}>
        <div style={{ ...estadoIconStyle, color: estaMoroso ? 'var(--sn-crit)' : 'var(--sn-success)', borderColor: estaMoroso ? 'rgba(239,68,68,0.45)' : 'rgba(16,185,129,0.45)' }}>
          {estaMoroso ? '!' : '✓'}
        </div>
        <h2 style={{ margin: 'var(--sn-space-3) 0 var(--sn-space-2)', fontFamily: 'var(--sn-font-display)', color: estaMoroso ? 'var(--sn-crit)' : 'var(--sn-success)' }}>
          {estaMoroso ? 'Estado moroso' : 'Alumno al día'}
        </h2>
        <p style={{ margin: 0, color: 'var(--sn-text-muted)' }}>
          {estaMoroso && debeMes
            ? `Mensualidad vencida hace ${diasAtraso} días (corte ${vencimiento}).`
            : estaMoroso
              ? 'Existen saldos de tienda o servicios pendientes.'
              : `Próximo corte mensual: ${vencimiento}`}
        </p>
      </CardBody>
    </Card>

    <Card>
      <CardBody>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--sn-space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={subLabelStyle}>Cumplimiento de pagos (LTV)</div>
            <div style={{ color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' }}>Total facturado vs pagado desde su inscripción.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 800, color: 'var(--sn-brand-glow)' }}>
              {formatMoney(totalPagado)}
            </div>
            <div style={subLabelStyle}>Pagado histórico</div>
          </div>
        </div>
        <div style={progressTrackStyle}>
          <div style={{ ...progressBarStyle, width: `${cumplimiento}%` }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', letterSpacing: 'var(--sn-tracking-wide)', textAlign: 'right' }}>
          {cumplimiento}% de cumplimiento
        </div>
      </CardBody>
    </Card>

    <Card>
      <CardBody style={{ padding: 0 }}>
        <PanelHeader title="Movimientos y recibos" icon={<ReceiptIcon />} />
        <DataTable
          loading={loading}
          rows={lineaTiempo}
          columns={[
            { key: 'fecha', header: 'Fecha', muted: true, width: 120, render: (m) => m.fecha ?? m.fechaGeneracion ?? m.fechaPago ?? '—' },
            { key: 'tipo',  header: 'Tipo',  width: 130, render: (m) => (
              <Badge tone={m._tipo === 'Pago' ? 'success' : 'crit'}>{m._tipo === 'Pago' ? 'Ingreso' : 'Cargo'}</Badge>
            ) },
            { key: 'concepto', header: 'Concepto', render: (m) => (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--sn-text-primary)' }}>{m.conceptoResumen ?? m.concepto ?? '—'}</div>
                {m.idRecibo && <div style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>Ref: {m.idRecibo}</div>}
              </div>
            ) },
            { key: 'monto', header: 'Monto', align: 'right', width: 140, render: (m) => (
              <span style={{ fontFamily: 'var(--sn-font-mono)', fontWeight: 800, color: m._tipo === 'Pago' ? 'var(--sn-success)' : 'var(--sn-crit)' }}>
                {m._tipo === 'Pago' ? '+' : '−'} {formatMoney(m.total ?? m.monto)}
              </span>
            ) },
            { key: 'estado', header: 'Estado', align: 'center', width: 130, render: (m) => (
              <Badge tone={m.estado === 'Completado' || m.estado === 'Pagada' ? 'success' : m.estado === 'Anulado' ? 'crit' : 'warn'}>
                {m.estado ?? '—'}
              </Badge>
            ) },
          ]}
          empty={<EmptyState title="Sin movimientos" description="Este alumno aún no registra transacciones." />}
        />
      </CardBody>
    </Card>
  </div>
);

/* =====================================================
   TAB: ASISTENCIA
   ===================================================== */

const TabAsistencia = ({ asistencias, totalClases, tasaAsist, tardanzas, faltas, filtroMes, setFiltroMes, loading }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
    <div style={statsGridStyle}>
      <MiniStat label="Tasa asistencia" value={`${tasaAsist}%`} tone="success" />
      <MiniStat label="Tardanzas" value={tardanzas} tone="warn" />
      <MiniStat label="Faltas acumuladas" value={faltas} tone="crit" />
    </div>

    <Card>
      <CardBody style={{ padding: 0 }}>
        <PanelHeader
          title="Kárdex de asistencia"
          subtitle={`${totalClases} sesiones registradas`}
          action={
            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} style={selectStyle} className="sn-focusable">
              <option value="Todos">Historial completo</option>
              <option value="01/2026">Enero 2026</option>
              <option value="02/2026">Febrero 2026</option>
              <option value="03/2026">Marzo 2026</option>
              <option value="04/2026">Abril 2026</option>
              <option value="05/2026">Mayo 2026</option>
            </select>
          }
        />
        <DataTable
          loading={loading}
          rows={asistencias}
          columns={[
            { key: 'fecha', header: 'Fecha', render: (a) => <span style={{ fontWeight: 700 }}>{a.fecha ?? '—'}</span> },
            { key: 'horaIngreso', header: 'Ingreso', muted: true, render: (a) => <span style={{ fontFamily: 'var(--sn-font-mono)' }}>{a.horaIngreso ?? '--:--'}</span> },
            { key: 'estado', header: 'Estado', align: 'center', width: 140, render: (a) => (
              <Badge tone={a.estado === 'Asistió' ? 'success' : a.estado === 'Tarde' ? 'warn' : 'crit'}>
                {(a.estado ?? '—').toUpperCase()}
              </Badge>
            ) },
          ]}
          empty={<EmptyState title="Sin registros" description="No hay asistencias registradas en este periodo." />}
        />
      </CardBody>
    </Card>
  </div>
);

/* =====================================================
   Helpers de UI
   ===================================================== */

const PanelHeader = ({ title, subtitle, icon, action, tone = 'brand' }) => {
  const c = { brand: 'var(--sn-brand-glow)', crit: 'var(--sn-crit)', elite: 'var(--sn-tier-elite)' }[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sn-space-4)', padding: 'var(--sn-space-5)', borderBottom: '1px solid var(--sn-border-faint)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 32, height: 32, borderRadius: 'var(--sn-radius-sm)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid color-mix(in srgb, ${c} 25%, transparent)` }}>
          {icon}
        </span>
        <div>
          <h3 style={panelTitleStyle}>{title}</h3>
          {subtitle && <div style={subLabelStyle}>{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
};

const DataRow = ({ label, value, accent, last, compact }) => (
  <div style={{
    paddingTop: compact ? 6 : 'var(--sn-space-2)',
    paddingBottom: last ? 0 : (compact ? 6 : 'var(--sn-space-3)'),
    borderBottom: last ? 'none' : '1px solid var(--sn-border-faint)',
  }}>
    <div style={subLabelStyle}>{label}</div>
    <div style={{
      marginTop: 2,
      fontFamily: 'var(--sn-font-ui)',
      fontWeight: 700,
      color: accent === 'crit' ? 'var(--sn-crit)' : accent === 'brand' || accent ? 'var(--sn-brand-glow)' : 'var(--sn-text-primary)',
    }}>
      {value}
    </div>
  </div>
);

const FormInput = ({ label, critical, ...rest }) => (
  <label>
    <span style={subLabelStyle}>{label}</span>
    <input {...rest} className="sn-focusable" style={{
      ...inputStyle,
      borderColor: critical ? 'rgba(239,68,68,0.50)' : 'var(--sn-border-soft)',
      color: critical ? 'var(--sn-crit)' : 'var(--sn-text-primary)',
      fontWeight: critical ? 700 : 500,
    }} />
  </label>
);

const FormTextarea = ({ label, ...rest }) => (
  <label>
    <span style={subLabelStyle}>{label}</span>
    <textarea {...rest} rows={2} className="sn-focusable" style={{ ...inputStyle, fontFamily: 'var(--sn-font-ui)' }} />
  </label>
);

const FormSelect = ({ label, options, ...rest }) => (
  <label>
    <span style={subLabelStyle}>{label}</span>
    <select {...rest} className="sn-focusable" style={inputStyle}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </label>
);

const MiniStat = ({ label, value, tone }) => {
  const c = { success: 'var(--sn-success)', warn: 'var(--sn-warn)', crit: 'var(--sn-crit)' }[tone];
  return (
    <Card>
      <CardBody style={{ textAlign: 'center', padding: 'var(--sn-space-5)' }}>
        <div style={{ fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-3xl)', fontWeight: 800, color: c, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ marginTop: 8, fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-text-muted)' }}>
          {label}
        </div>
      </CardBody>
    </Card>
  );
};

/* === Iconos === */
const ArrowLeftIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>);
const CashIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/></svg>);
const PinIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>);
const HeartIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg>);
const BallIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6"/></svg>);
const MedalIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sn-brand-glow)" strokeWidth="2"><path d="m7 4 2 5 3-2 3 2 2-5"/><circle cx="12" cy="15" r="6"/></svg>);
const WhatsappIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01ZM12.05 20.15h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.41 8.16 8.16 0 0 1 2.41 5.83 8.25 8.25 0 0 1-8.25 8.24Z"/></svg>);
const PhoneIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.71 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.71A2 2 0 0 1 22 16.92Z"/></svg>);
const ReceiptIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 21V3h14v18l-3-2-3 2-3-2-3 2-2-2Z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>);

/* =====================================================
   Estilos
   ===================================================== */
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

const topBarStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 'var(--sn-space-5)', gap: 'var(--sn-space-3)',
};

const mainGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2.2fr)',
  gap: 'var(--sn-space-5)',
};

const tabsBarStyle = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: 4,
  background: 'var(--sn-bg-surface)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-pill)',
  marginBottom: 'var(--sn-space-5)',
  overflowX: 'auto',
};

const tabBtnStyle = (active) => ({
  flex: 1,
  minWidth: 80,
  padding: '0.6rem 1rem',
  borderRadius: 'var(--sn-radius-pill)',
  background: active ? 'var(--sn-brand-gradient)' : 'transparent',
  color: active ? '#06121A' : 'var(--sn-text-muted)',
  border: 'none', cursor: 'pointer',
  fontFamily: 'var(--sn-font-ui)',
  fontWeight: 700,
  fontSize: 'var(--sn-fs-sm)',
  letterSpacing: 'var(--sn-tracking-wide)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  transition: 'background var(--sn-dur-fast) var(--sn-ease)',
  whiteSpace: 'nowrap',
});

const tabGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 'var(--sn-space-4)',
};

const perfilHeroStyle = {
  position: 'relative', height: 200,
  background: 'linear-gradient(135deg, #0F1422 0%, #1E3A8A 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  overflow: 'hidden',
};

const perfilHeroGlowStyle = {
  position: 'absolute', inset: 0,
  background: 'radial-gradient(280px 200px at 50% 30%, color-mix(in srgb, var(--sn-brand-glow) 32%, transparent), transparent 60%)',
};

const perfilFotoStyle = {
  width: 130, height: 130, borderRadius: '50%',
  border: '4px solid var(--sn-bg-surface)',
  boxShadow: '0 0 0 1px var(--sn-border-glow), 0 12px 40px rgba(0,0,0,0.4)',
  position: 'relative', zIndex: 1,
  objectFit: 'cover',
};

const tierChipStyle = {
  position: 'absolute', bottom: 12, right: 12,
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '0.4rem 0.7rem',
  borderRadius: 'var(--sn-radius-md)',
  background: 'var(--sn-bg-elevated)',
  border: '1px solid currentColor',
  zIndex: 2,
};

const subLabelStyle = {
  fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
  letterSpacing: 'var(--sn-tracking-wide)', textTransform: 'uppercase',
  color: 'var(--sn-text-muted)',
};

const panelTitleStyle = {
  margin: 0, fontFamily: 'var(--sn-font-display)',
  fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)',
  letterSpacing: 'var(--sn-tracking-tight)',
};

const panelTitleSmall = {
  margin: '0 0 var(--sn-space-3)', fontSize: 'var(--sn-fs-xs)',
  fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)',
  color: 'var(--sn-text-muted)',
};

const medalStyle = {
  width: 44, height: 44, borderRadius: 'var(--sn-radius-md)',
  background: 'color-mix(in srgb, var(--sn-brand-glow) 12%, transparent)',
  border: '1px solid var(--sn-border-glow)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
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

const selectStyle = { ...inputStyle, width: 180 };

const editLinkStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--sn-crit)', fontWeight: 800,
  fontSize: 'var(--sn-fs-xs)', letterSpacing: 'var(--sn-tracking-wide)',
};

const alergiaBannerStyle = {
  background: 'rgba(239,68,68,0.10)',
  border: '1px solid rgba(239,68,68,0.45)',
  borderRadius: 'var(--sn-radius-md)',
  padding: '0.7rem 0.9rem',
  color: 'var(--sn-crit)',
  fontSize: 'var(--sn-fs-sm)',
  marginBottom: 'var(--sn-space-3)',
};

const performanceGridStyle = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: 'var(--sn-space-5)',
};

const ovrCardStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 'var(--sn-space-5) var(--sn-space-3)',
  borderRadius: 'var(--sn-radius-lg)',
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
};

const atributosStyle = {
  padding: 'var(--sn-space-4)',
  borderRadius: 'var(--sn-radius-md)',
  background: 'var(--sn-overlay-soft)',
  border: '1px solid var(--sn-border-faint)',
};

const estadoIconStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 72, height: 72, borderRadius: '50%',
  background: 'var(--sn-input-bg)',
  border: '1px solid', fontSize: 36, fontWeight: 900,
};

const progressTrackStyle = {
  marginTop: 'var(--sn-space-3)',
  height: 14,
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

const statsGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sn-space-3)',
};

const contactBtnStyle = (tone) => {
  const c = { success: 'var(--sn-success)', brand: 'var(--sn-brand-glow)', neutral: 'var(--sn-text-muted)' }[tone];
  return {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '0.6rem 0.9rem', borderRadius: 'var(--sn-radius-pill)',
    background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, border: `1px solid color-mix(in srgb, ${c} 33%, transparent)`,
    fontFamily: 'var(--sn-font-ui)', fontWeight: 700, fontSize: 'var(--sn-fs-sm)',
    textDecoration: 'none', cursor: 'pointer',
  };
};

const rescateIconStyle = {
  width: 80, height: 80, borderRadius: '50%',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--sn-track-bg)',
  border: '1px solid var(--sn-border-soft)',
  color: 'var(--sn-text-muted)',
  fontSize: 36, fontWeight: 800,
  margin: '0 auto var(--sn-space-4)',
};

export default DetalleAlumno;
