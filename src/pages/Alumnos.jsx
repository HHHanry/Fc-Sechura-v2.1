import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlumnos, mutarAlumnos } from '../hooks/useAlumnos';
import { CATEGORIAS, ESTADOS_ALUMNO, formatDateLima } from '../config/businessRules';
import { withDefaults } from '../helpers/alumnoDefaults';
import {
  puedeRegistrarAlumno, puedeEditarAlumno, puedeDarBajaAlumno,
  puedeVerExpediente, puedeVerCarnet,
} from '../helpers/permisosHelper';
import { useAuth } from '../context/useAuth';
import { Card, CardBody, Button, Badge, DataTable, Modal, EmptyState, StatusBadge, FilterBar } from '../components/ui';
import { toast } from '../hooks/useToast';
import { AlumnoForm } from './alumnos/AlumnoForm';
import { CarnetModal } from './alumnos/CarnetModal';

const ORDENES = [
  { value: 'reciente',  label: 'Nuevos ingresos' },
  { value: 'az',        label: 'Nombre A → Z' },
  { value: 'za',        label: 'Nombre Z → A' },
  { value: 'edad_asc',  label: 'Edad ascendente' },
  { value: 'edad_desc', label: 'Edad descendente' },
];

const Alumnos = () => {
  const { alumnos, loading } = useAlumnos();
  const { user } = useAuth();
  const { iso: hoy } = formatDateLima();

  // === Permisos finos por rol ===
  const perms = useMemo(() => ({
    crear:       puedeRegistrarAlumno(user),
    editar:      puedeEditarAlumno(user),
    darBaja:     puedeDarBajaAlumno(user),
    expediente:  puedeVerExpediente(user),
    carnet:      puedeVerCarnet(user),
  }), [user]);

  // === UI state ===
  const [modoForm, setModoForm] = useState({ open: false, modoEdicion: false, alumno: null });
  const [alumnoCarnet, setAlumnoCarnet]       = useState(null);
  const [alumnoAEliminar, setAlumnoAEliminar] = useState(null);
  const [busqueda, setBusqueda]               = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroDistrito, setFiltroDistrito]   = useState('Todos');
  const [filtroEstado, setFiltroEstado]       = useState('Todos');
  const [orden, setOrden]                     = useState('reciente');
  const [guardando, setGuardando]             = useState(false);
  const [eliminando, setEliminando]           = useState(false);

  const distritosExistentes = useMemo(
    () => ['Todos', ...new Set(alumnos.map((a) => a.distrito).filter((d) => d && d !== 'No aplica'))],
    [alumnos],
  );

  const alumnosConDefaults = useMemo(() => alumnos.map(withDefaults), [alumnos]);

  const alumnosVisibles = useMemo(() => {
    const term = busqueda.toLowerCase();
    return alumnosConDefaults
      .filter((a) => {
        const matchTexto = !term
          || a.nombre?.toLowerCase().includes(term)
          || a.apellido?.toLowerCase().includes(term)
          || a.dni?.includes(term)
          || (a.etiquetas ?? []).some((t) => t.toLowerCase().includes(term));
        const matchCat = filtroCategoria === 'Todas' || a.categoria === filtroCategoria;
        const matchDist = filtroDistrito === 'Todos' || a.distrito === filtroDistrito;
        const matchEstado = filtroEstado === 'Todos' || a.estado === filtroEstado;
        return matchTexto && matchCat && matchDist && matchEstado;
      })
      .sort((a, b) => {
        if (orden === 'az')         return (a.nombre ?? '').localeCompare(b.nombre ?? '');
        if (orden === 'za')         return (b.nombre ?? '').localeCompare(a.nombre ?? '');
        if (orden === 'edad_asc')   return (parseInt(a.edad) || 0) - (parseInt(b.edad) || 0);
        if (orden === 'edad_desc')  return (parseInt(b.edad) || 0) - (parseInt(a.edad) || 0);
        return 0;
      });
  }, [alumnosConDefaults, busqueda, filtroCategoria, filtroDistrito, filtroEstado, orden]);

  const handleSubmit = async (datos) => {
    setGuardando(true);
    try {
      if (modoForm.modoEdicion) {
        const { id, ...payload } = datos;
        await mutarAlumnos.actualizar(id, payload);
        toast.success(`Ficha de ${datos.nombre} actualizada.`);
      } else {
        // Reservar ID para que el QR pueda enlazar al perfil público antes de existir el doc.
        const reservedId = mutarAlumnos.reservarId();
        const urlPerfil = `${window.location.origin}/jugador/${reservedId}`;
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlPerfil)}`;
        await mutarAlumnos.crearConId(reservedId, { ...datos, qr });
        toast.success(`Alumno ${datos.nombre} registrado.`);
      }
      setModoForm({ open: false, modoEdicion: false, alumno: null });
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar el registro. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const hayFiltrosActivos = busqueda || filtroCategoria !== 'Todas' || filtroDistrito !== 'Todos' || filtroEstado !== 'Todos' || orden !== 'reciente';
  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroCategoria('Todas'); setFiltroDistrito('Todos'); setFiltroEstado('Todos'); setOrden('reciente');
  };

  const handleEliminar = async () => {
    if (!alumnoAEliminar) return;
    setEliminando(true);
    try {
      await mutarAlumnos.eliminar(alumnoAEliminar.id);
      toast.success(`${alumnoAEliminar.nombre} dado de baja.`);
      setAlumnoAEliminar(null);
    } catch {
      toast.error('No se pudo eliminar el registro.');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        {/* === HEADER === */}
        <header style={headerStyle}>
          <div>
            <span style={eyebrowStyle}>DIRECTORIO DEPORTIVO</span>
            <h1 style={titleStyle}>Alumnos</h1>
            <p style={leadStyle}>Ficha técnica y administrativa de cada jugador del club.</p>
          </div>
          {perms.crear && (
            <Button
              variant="primary"
              size="lg"
              icon={<PlusIcon />}
              onClick={() => setModoForm({ open: true, modoEdicion: false, alumno: null })}
            >
              Registrar alumno
            </Button>
          )}
        </header>

        {/* === FILTROS === */}
        <div style={{ marginBottom: 'var(--sn-space-5)' }}>
          <FilterBar
            search={{ value: busqueda, onChange: setBusqueda, placeholder: 'Buscar por nombre, apellido o DNI...', ariaLabel: 'Buscar alumno' }}
            filters={[
              { id: 'categoria', ariaLabel: 'Filtrar por categoría', value: filtroCategoria, onChange: setFiltroCategoria,
                options: [{ value: 'Todas', label: 'Todas las categorías' }, ...CATEGORIAS.map((c) => ({ value: c, label: `Cat. ${c}` }))] },
              { id: 'distrito', ariaLabel: 'Filtrar por distrito', value: filtroDistrito, onChange: setFiltroDistrito,
                options: distritosExistentes.map((d) => ({ value: d, label: d === 'Todos' ? 'Todos los distritos' : d })) },
              { id: 'estado', ariaLabel: 'Filtrar por estado', value: filtroEstado, onChange: setFiltroEstado,
                options: [{ value: 'Todos', label: 'Todos los estados' }, ...ESTADOS_ALUMNO.map((e) => ({ value: e.value, label: e.label }))] },
              { id: 'orden', ariaLabel: 'Ordenar resultados', value: orden, onChange: setOrden, options: ORDENES },
            ]}
            meta={loading ? 'Cargando...' : `${alumnosVisibles.length} de ${alumnos.length} alumnos`}
            onReset={hayFiltrosActivos ? limpiarFiltros : undefined}
          />
        </div>

        {/* === TABLA === */}
        <Card>
          <CardBody style={{ padding: 0 }}>
            <DataTable
              loading={loading}
              rows={alumnosVisibles}
              empty={<EmptyState icon="∅" title="Sin coincidencias" description="No hay alumnos que cumplan con los filtros aplicados." />}
              columns={[
                {
                  key: 'jugador', header: 'Jugador',
                  render: (a) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <Avatar alumno={a} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: 'var(--sn-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.nombre} {a.apellido}
                        </div>
                        <div style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                          DNI {a.dni}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'ubicacion', header: 'Ubicación',
                  render: (a) => (
                    <div>
                      <div style={{ fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-secondary)' }}>{a.distrito || 'N/R'}</div>
                      <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>{a.provincia || a.ciudad || 'N/R'}</div>
                    </div>
                  ),
                },
                {
                  key: 'categoria', header: 'Cat.', align: 'center', width: 100,
                  render: (a) => <Badge tone="brand">Cat. {a.categoria}</Badge>,
                },
                {
                  key: 'estado', header: 'Estado', align: 'center', width: 140,
                  render: (a) => <StatusBadge value={a.estado} />,
                },
                {
                  key: 'acciones', header: 'Acciones', align: 'right', width: 220,
                  render: (a) => <RowActions a={a} perms={perms} onCarnet={setAlumnoCarnet} onEditar={(al) => setModoForm({ open: true, modoEdicion: true, alumno: al })} onEliminar={setAlumnoAEliminar} />,
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {/* === MODALS === */}
      <AlumnoForm
        open={modoForm.open}
        modoEdicion={modoForm.modoEdicion}
        alumno={modoForm.alumno}
        hoy={hoy}
        cargando={guardando}
        alumnosExistentes={alumnos}
        onClose={() => setModoForm({ open: false, modoEdicion: false, alumno: null })}
        onSubmit={handleSubmit}
      />

      <CarnetModal alumno={alumnoCarnet} onClose={() => setAlumnoCarnet(null)} />

      <Modal
        open={!!alumnoAEliminar}
        onClose={() => setAlumnoAEliminar(null)}
        size="sm"
        title="¿Dar de baja al alumno?"
        description={alumnoAEliminar
          ? `Eliminarás permanentemente el registro de ${alumnoAEliminar.nombre} ${alumnoAEliminar.apellido}. Sus datos financieros podrían perder contexto histórico.`
          : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAlumnoAEliminar(null)} disabled={eliminando}>Cancelar</Button>
            <Button variant="danger" onClick={handleEliminar} loading={eliminando}>Sí, eliminar</Button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--sn-space-4) 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.40)',
            color: 'var(--sn-crit)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>!</div>
        </div>
      </Modal>
    </div>
  );
};

/* ========== sub-componentes ========== */

const Avatar = ({ alumno }) => alumno.foto
  ? <img src={alumno.foto} alt="" style={avatarStyle} />
  : (
    <div style={{ ...avatarStyle, background: 'var(--sn-brand-gradient)', color: '#06121A', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
      {(alumno.nombre ?? '?').charAt(0).toUpperCase()}
    </div>
  );

const RowActions = ({ a, perms, onCarnet, onEditar, onEliminar }) => (
  <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
    {/* Tarjeta pública (FIFA): es información pública vía QR, visible para todo rol con acceso al directorio */}
    <IconBtn as={Link} to={`/jugador/${a.id}`} target="_blank" title="Tarjeta pública (FIFA)" tone="elite"><ExternalIcon /></IconBtn>
    {perms.expediente && (
      <IconBtn as={Link} to={`/perfil-alumno/${a.id}`} state={{ alumno: a }} title="Ver expediente" tone="success"><ChartIcon /></IconBtn>
    )}
    {perms.carnet && (
      <IconBtn onClick={() => onCarnet(a)}    title="Carnet PVC"   tone="brand"><CardIcon /></IconBtn>
    )}
    {perms.editar && (
      <IconBtn onClick={() => onEditar(a)}    title="Editar"       tone="warn"><EditIcon /></IconBtn>
    )}
    {perms.darBaja && (
      <IconBtn onClick={() => onEliminar(a)}  title="Dar de baja"  tone="crit"><TrashIcon /></IconBtn>
    )}
  </div>
);

const IconBtn = ({ as = 'button', tone = 'brand', children, ...rest }) => {
  const rel = rest.target === '_blank' && !rest.rel ? 'noreferrer' : rest.rel;
  // Cada acción se tiñe con su propio color (no gris): el fondo lleva la marca de su tono.
  const colors = {
    brand:   { c: 'var(--sn-brand-glow)', bg: 'color-mix(in srgb, var(--sn-brand-glow) 14%, transparent)', b: 'color-mix(in srgb, var(--sn-brand-glow) 40%, transparent)' },
    success: { c: 'var(--sn-success)',    bg: 'color-mix(in srgb, var(--sn-success) 14%, transparent)',    b: 'color-mix(in srgb, var(--sn-success) 40%, transparent)' },
    warn:    { c: 'var(--sn-warn)',       bg: 'color-mix(in srgb, var(--sn-warn) 14%, transparent)',       b: 'color-mix(in srgb, var(--sn-warn) 40%, transparent)' },
    crit:    { c: 'var(--sn-crit)',       bg: 'color-mix(in srgb, var(--sn-crit) 14%, transparent)',       b: 'color-mix(in srgb, var(--sn-crit) 40%, transparent)' },
    elite:   { c: 'var(--sn-tier-elite)', bg: 'color-mix(in srgb, var(--sn-tier-elite) 16%, transparent)', b: 'color-mix(in srgb, var(--sn-tier-elite) 42%, transparent)' },
  }[tone];
  return React.createElement(
    as,
    {
      ...rest,
      rel,
      className: 'sn-focusable',
      style: {
        width: 36, height: 36,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--sn-radius-sm)',
        background: colors.bg,
        color: colors.c,
        border: `1px solid ${colors.b}`,
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'background var(--sn-dur-fast) var(--sn-ease), transform var(--sn-dur-fast) var(--sn-ease), box-shadow var(--sn-dur-fast) var(--sn-ease)',
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.background = `color-mix(in srgb, ${colors.c} 28%, transparent)`;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = `0 4px 12px -4px ${colors.c}`;
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.background = colors.bg;
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = 'none';
      },
    },
    children,
  );
};

/* ========== iconos ========== */
const PlusIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>);
const ExternalIcon = () =>(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M21 3l-7 7M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>);
const ChartIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>);
const CardIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M7 16h2"/></svg>);
const EditIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>);
const TrashIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>);

/* ========== estilos ========== */
const pageBg = {
  minHeight: 'calc(100vh - var(--sn-navbar-h))',
  background: 'var(--sn-bg-mesh)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
};

const contentWrap = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)',
};

const headerStyle = {
  display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
  gap: 'var(--sn-space-4)', flexWrap: 'wrap',
  marginBottom: 'var(--sn-space-5)',
};

const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const leadStyle  = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' };

const avatarStyle = {
  width: 38, height: 38, borderRadius: '50%',
  objectFit: 'cover',
  border: '1px solid var(--sn-border-glow)',
  flexShrink: 0,
};

export default Alumnos;
