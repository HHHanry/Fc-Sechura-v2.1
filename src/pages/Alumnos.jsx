import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlumnos, mutarAlumnos } from '../hooks/useAlumnos';
import { CATEGORIAS, ESTADOS_ALUMNO, formatDateLima } from '../config/businessRules';
import { withDefaults } from '../helpers/alumnoDefaults';
import { Card, CardBody, Button, Badge, DataTable, Modal, EmptyState, StatusBadge } from '../components/ui';
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
  const { iso: hoy } = formatDateLima();

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
          <Button
            variant="primary"
            size="lg"
            icon={<PlusIcon />}
            onClick={() => setModoForm({ open: true, modoEdicion: false, alumno: null })}
          >
            Registrar alumno
          </Button>
        </header>

        {/* === FILTROS === */}
        <Card style={{ marginBottom: 'var(--sn-space-5)' }}>
          <CardBody>
            <div style={filtersGridStyle} className="sn-alumnos-filters">
              <div style={searchWrapStyle}>
                <SearchIcon />
                <input
                  className="sn-focusable"
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, apellido o DNI..."
                  style={searchInputStyle}
                />
              </div>
              <SelectFilter value={filtroCategoria} onChange={setFiltroCategoria}
                options={[{ value: 'Todas', label: 'Todas las categorías' }, ...CATEGORIAS.map((c) => ({ value: c, label: `Cat. ${c}` }))]} />
              <SelectFilter value={filtroDistrito} onChange={setFiltroDistrito}
                options={distritosExistentes.map((d) => ({ value: d, label: d === 'Todos' ? 'Todos los distritos' : d }))} />
              <SelectFilter value={filtroEstado} onChange={setFiltroEstado}
                options={[{ value: 'Todos', label: 'Todos los estados' }, ...ESTADOS_ALUMNO.map((e) => ({ value: e.value, label: e.label }))]} />
              <SelectFilter value={orden} onChange={setOrden} options={ORDENES} />
            </div>
            <div style={{ marginTop: 'var(--sn-space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', letterSpacing: 'var(--sn-tracking-wide)' }}>
                {loading ? 'Cargando...' : `${alumnosVisibles.length} de ${alumnos.length} alumnos`}
              </span>
              {(busqueda || filtroCategoria !== 'Todas' || filtroDistrito !== 'Todos' || filtroEstado !== 'Todos' || orden !== 'reciente') && (
                <button onClick={() => { setBusqueda(''); setFiltroCategoria('Todas'); setFiltroDistrito('Todos'); setFiltroEstado('Todos'); setOrden('reciente'); }}
                  style={resetBtnStyle} className="sn-focusable">
                  Limpiar filtros
                </button>
              )}
            </div>
          </CardBody>
        </Card>

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
                  render: (a) => <RowActions a={a} onCarnet={setAlumnoCarnet} onEditar={(al) => setModoForm({ open: true, modoEdicion: true, alumno: al })} onEliminar={setAlumnoAEliminar} />,
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

      <style>{`
        @media (max-width: 767.98px) {
          .sn-alumnos-filters {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1099.98px) {
          .sn-alumnos-filters {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>

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

const RowActions = ({ a, onCarnet, onEditar, onEliminar }) => (
  <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
    <IconBtn as={Link} to={`/jugador/${a.id}`} target="_blank" title="Tarjeta pública (FIFA)" tone="elite"><ExternalIcon /></IconBtn>
    <IconBtn as={Link} to={`/perfil-alumno/${a.id}`} state={{ alumno: a }} title="Ver expediente" tone="success"><ChartIcon /></IconBtn>
    <IconBtn onClick={() => onCarnet(a)}    title="Carnet PVC"   tone="brand"><CardIcon /></IconBtn>
    <IconBtn onClick={() => onEditar(a)}    title="Editar"       tone="warn"><EditIcon /></IconBtn>
    <IconBtn onClick={() => onEliminar(a)}  title="Dar de baja"  tone="crit"><TrashIcon /></IconBtn>
  </div>
);

const IconBtn = ({ as = 'button', tone = 'brand', children, ...rest }) => {
  const rel = rest.target === '_blank' && !rest.rel ? 'noreferrer' : rest.rel;
  const colors = {
    brand:   { c: 'var(--sn-brand-glow)', b: 'color-mix(in srgb, var(--sn-brand-glow) 32%, transparent)' },
    success: { c: 'var(--sn-success)',    b: 'rgba(16,185,129,0.30)' },
    warn:    { c: 'var(--sn-warn)',       b: 'rgba(245,158,11,0.30)' },
    crit:    { c: 'var(--sn-crit)',       b: 'rgba(239,68,68,0.30)'  },
    elite:   { c: 'var(--sn-tier-elite)', b: 'rgba(251,191,36,0.30)' },
  }[tone];
  return React.createElement(
    as,
    {
      ...rest,
      rel,
      className: 'sn-focusable',
      style: {
        width: 34, height: 34,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--sn-radius-sm)',
        background: 'rgba(15,20,34,0.65)',
        color: colors.c,
        border: `1px solid ${colors.b}`,
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'background var(--sn-dur-fast) var(--sn-ease), transform var(--sn-dur-fast) var(--sn-ease)',
      },
      onMouseEnter: (e) => { e.currentTarget.style.background = `${colors.c}22`; },
      onMouseLeave: (e) => { e.currentTarget.style.background = 'rgba(15,20,34,0.65)'; },
    },
    children,
  );
};

const SelectFilter = ({ value, onChange, options }) => (
  <select className="sn-focusable" value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

/* ========== iconos ========== */
const PlusIcon  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>);
const SearchIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>);
const ExternalIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M21 3l-7 7M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>);
const ChartIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>);
const CardIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M7 16h2"/></svg>);
const EditIcon  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>);
const TrashIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>);

/* ========== estilos ========== */
const pageBg = {
  minHeight: 'calc(100vh - 73px)',
  background: 'var(--sn-bg-base)',
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

const filtersGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(200px, 2fr) repeat(4, minmax(140px, 1fr))',
  gap: 'var(--sn-space-3)',
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
  flex: 1,
  background: 'transparent',
  border: 'none', outline: 'none',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)',
  padding: '0.7rem 0',
};

const selectStyle = {
  width: '100%',
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-secondary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)',
  padding: '0.7rem 0.85rem',
  outline: 'none',
};

const resetBtnStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--sn-brand-glow)', fontWeight: 700,
  fontSize: 'var(--sn-fs-xs)', letterSpacing: 'var(--sn-tracking-wide)',
};

const avatarStyle = {
  width: 38, height: 38, borderRadius: '50%',
  objectFit: 'cover',
  border: '1px solid var(--sn-border-glow)',
  flexShrink: 0,
};

export default Alumnos;
