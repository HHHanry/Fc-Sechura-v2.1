import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { usuariosService } from '../services/usuariosService';
import { serverTimestamp } from '../services/firestoreClient';
import { toast } from '../hooks/useToast';
import { audit } from '../helpers/auditHelper';
import { Card, CardBody, Button, Badge, EmptyState, Modal, Skeleton } from '../components/ui';
import {
  ESTADOS_USUARIO, PERMISOS_FINOS, ROLES,
} from '../config/businessRules';

/* ========================================================
   FASE 8 — Gestión de Usuarios / Staff
   Panel profesional de administración de roles, estados,
   permisos finos y auditoría.
   ======================================================== */

const ROLES_LIST = [
  { value: ROLES.ADMIN,      label: 'Administrador' },
  { value: ROLES.ENTRENADOR,  label: 'Entrenador' },
  { value: ROLES.TESORERO,    label: 'Tesorero' },
  { value: ROLES.INVITADO,    label: 'Invitado' },
];

const FILTROS_ROL = [
  { value: 'todos', label: 'Todos los roles' },
  ...ROLES_LIST,
];

const FILTROS_ESTADO = [
  { value: 'todos', label: 'Todos los estados' },
  ...ESTADOS_USUARIO,
];

const ESTADOS_SENSIBLES = ['suspendido', 'inactivo'];

const rolLabel = (rol) => ROLES_LIST.find((r) => r.value === rol)?.label ?? rol ?? 'Sin rol';
const estadoInfo = (est) => ESTADOS_USUARIO.find((e) => e.value === est) ?? ESTADOS_USUARIO[0];

const GestionUsuarios = () => {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Form: crear/invitar
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ email: '', nombre: '', rol: ROLES.ENTRENADOR });
  const [guardando, setGuardando] = useState(false);

  // Detalle/edición
  const [detalle, setDetalle] = useState(null);
  const [editRol, setEditRol] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [editPermisos, setEditPermisos] = useState([]);
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);

  // Confirmaciones
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const lista = await usuariosService.listar();
      setUsuarios(lista);
    } catch {
      toast.error('No se pudo cargar la lista de staff.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const adminsActivos = useMemo(
    () => usuarios.filter((u) => u.rol === ROLES.ADMIN && (u.estado ?? 'activo') !== 'suspendido' && (u.estado ?? 'activo') !== 'inactivo'),
    [usuarios],
  );

  const filtrados = useMemo(() => {
    const term = busqueda.toLowerCase();
    return usuarios
      .filter((u) => {
        const matchTexto = !term
          || u.nombre?.toLowerCase().includes(term)
          || u.email?.toLowerCase().includes(term);
        const matchRol = filtroRol === 'todos' || u.rol === filtroRol;
        const est = u.estado ?? 'activo';
        const matchEstado = filtroEstado === 'todos' || est === filtroEstado;
        return matchTexto && matchRol && matchEstado;
      })
      .sort((a, b) => (a.nombre ?? a.email ?? '').localeCompare(b.nombre ?? b.email ?? ''));
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  /* === Crear usuario === */
  const handleCrear = async () => {
    const email = form.email.toLowerCase().trim();
    const nombre = form.nombre.trim();
    if (!email || !nombre) return toast.error('Nombre y correo son obligatorios.');
    if (usuarios.some((u) => u.email === email || u.id === email)) {
      return toast.error('Ese correo ya está autorizado.');
    }
    setGuardando(true);
    try {
      await usuariosService.upsert(email, {
        nombre, rol: form.rol, email,
        estado: 'pendiente',
        permisos: [],
        fechaCreacion: serverTimestamp(),
      });
      await audit('crear_usuario', { email, rol: form.rol }, currentUser);
      toast.success(`${nombre} autorizado como ${rolLabel(form.rol)}.`);
      setForm({ email: '', nombre: '', rol: ROLES.ENTRENADOR });
      setFormOpen(false);
      fetchUsuarios();
    } catch {
      toast.error('Error al autorizar usuario.');
    } finally {
      setGuardando(false);
    }
  };

  /* === Abrir detalle === */
  const abrirDetalle = (u) => {
    setDetalle(u);
    setEditRol(u.rol ?? ROLES.INVITADO);
    setEditEstado(u.estado ?? 'activo');
    setEditPermisos([...(u.permisos ?? [])]);
  };

  /* === Guardar detalle === */
  const guardarDetalle = async () => {
    if (!detalle) return;
    const esUltimoAdmin = detalle.rol === ROLES.ADMIN && adminsActivos.length <= 1;

    if (esUltimoAdmin && editRol !== ROLES.ADMIN) {
      return toast.error('No puedes quitar el rol de administrador al único admin activo.');
    }
    if (esUltimoAdmin && ESTADOS_SENSIBLES.includes(editEstado)) {
      return toast.error('No puedes suspender/desactivar al único administrador activo.');
    }

    setGuardandoDetalle(true);
    const cambios = {};
    const cambiosAudit = {};

    if (editRol !== (detalle.rol ?? ROLES.INVITADO)) {
      cambios.rol = editRol;
      cambiosAudit.rol = { de: detalle.rol, a: editRol };
    }
    if (editEstado !== (detalle.estado ?? 'activo')) {
      cambios.estado = editEstado;
      cambiosAudit.estado = { de: detalle.estado ?? 'activo', a: editEstado };
    }
    const permisosAntes = detalle.permisos ?? [];
    const cambioPermisos = JSON.stringify(editPermisos.sort()) !== JSON.stringify([...permisosAntes].sort());
    if (cambioPermisos) {
      cambios.permisos = editPermisos;
      cambiosAudit.permisos = { de: permisosAntes, a: editPermisos };
    }

    if (Object.keys(cambios).length === 0) {
      toast.info('No hay cambios por guardar.');
      setGuardandoDetalle(false);
      return;
    }

    try {
      await usuariosService.upsert(detalle.id, cambios);
      await audit('editar_usuario', { usuarioId: detalle.id, email: detalle.email, cambios: cambiosAudit }, currentUser);
      toast.success('Usuario actualizado.');
      setDetalle(null);
      fetchUsuarios();
    } catch {
      toast.error('No se pudo actualizar el usuario.');
    } finally {
      setGuardandoDetalle(false);
    }
  };

  /* === Suspender/reactivar rápido === */
  const accionRapida = (u, accion) => {
    const esUltimoAdmin = u.rol === ROLES.ADMIN && adminsActivos.length <= 1;
    if (accion === 'suspender' && esUltimoAdmin) {
      return toast.error('No puedes suspender al único administrador activo.');
    }
    setConfirmAction({ usuario: u, accion });
  };

  const ejecutarConfirm = async () => {
    if (!confirmAction) return;
    const { usuario, accion } = confirmAction;
    const nuevoEstado = accion === 'suspender' ? 'suspendido' : 'activo';
    setGuardando(true);
    try {
      await usuariosService.upsert(usuario.id, { estado: nuevoEstado });
      await audit(accion === 'suspender' ? 'suspender_usuario' : 'reactivar_usuario',
        { usuarioId: usuario.id, email: usuario.email }, currentUser);
      toast.success(accion === 'suspender' ? 'Usuario suspendido.' : 'Usuario reactivado.');
      setConfirmAction(null);
      fetchUsuarios();
    } catch {
      toast.error('No se pudo completar la acción.');
    } finally {
      setGuardando(false);
    }
  };

  /* === Toggle permiso === */
  const togglePermiso = (valor) => {
    setEditPermisos((prev) =>
      prev.includes(valor) ? prev.filter((p) => p !== valor) : [...prev, valor],
    );
  };

  /* === Grupos de permisos === */
  const gruposPermisos = useMemo(() => {
    const map = {};
    PERMISOS_FINOS.forEach((p) => {
      const g = p.grupo ?? 'General';
      if (!map[g]) map[g] = [];
      map[g].push(p);
    });
    return Object.entries(map);
  }, []);

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        {/* === HEADER === */}
        <header style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <span style={eyebrowStyle}>SISTEMA · ADMINISTRACIÓN</span>
            <h1 style={titleStyle}>Gestión de staff</h1>
            <p style={leadStyle}>Controla el acceso, los roles y los permisos del equipo técnico y administrativo.</p>
          </div>
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setFormOpen(true)}>
            Autorizar acceso
          </Button>
        </header>

        {/* === FILTROS === */}
        <Card style={{ marginBottom: 'var(--sn-space-4)' }}>
          <CardBody>
            <div className="sn-staff-filters" style={filtersGridStyle}>
              <div style={searchWrapStyle}>
                <SearchIcon />
                <input
                  className="sn-focusable"
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o correo…"
                  style={searchInputStyle}
                />
              </div>
              <select className="sn-focusable" value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} style={selectStyle}>
                {FILTROS_ROL.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select className="sn-focusable" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={selectStyle}>
                {FILTROS_ESTADO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 'var(--sn-space-2)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
              {loading ? 'Cargando…' : `${filtrados.length} de ${usuarios.length} miembros`}
            </div>
          </CardBody>
        </Card>

        {/* === LISTA === */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 88 }} />)}
          </div>
        ) : filtrados.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState title="Sin resultados" description="No hay miembros de staff que coincidan con los filtros." />
            </CardBody>
          </Card>
        ) : (
          <div className="sn-staff-grid" style={staffGridStyle}>
            {filtrados.map((u) => (
              <UserCard
                key={u.id} u={u}
                isCurrentUser={u.email === currentUser?.email || u.id === currentUser?.uid}
                onDetalle={() => abrirDetalle(u)}
                onSuspender={() => accionRapida(u, 'suspender')}
                onReactivar={() => accionRapida(u, 'reactivar')}
              />
            ))}
          </div>
        )}
      </div>

      {/* === MODAL: Crear usuario === */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Autorizar nuevo miembro"
        description="El correo registrado podrá iniciar sesión con Google y accederá según el rol asignado."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={guardando}>Cancelar</Button>
            <Button variant="primary" onClick={handleCrear} loading={guardando}>Autorizar acceso</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
          <label style={labelWrapStyle}>
            <span style={subLabelStyle}>Nombre completo *</span>
            <input type="text" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Juan Pérez" className="sn-focusable" style={inputStyle} />
          </label>
          <label style={labelWrapStyle}>
            <span style={subLabelStyle}>Correo electrónico *</span>
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="profesor@fcsechura.com" className="sn-focusable" style={inputStyle} />
          </label>
          <label style={labelWrapStyle}>
            <span style={subLabelStyle}>Rol de acceso</span>
            <select value={form.rol} onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value }))}
              className="sn-focusable" style={inputStyle}>
              {ROLES_LIST.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        </div>
      </Modal>

      {/* === MODAL: Detalle/edición === */}
      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title="Editar miembro de staff"
        description={detalle ? `${detalle.nombre ?? detalle.email}` : ''}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetalle(null)} disabled={guardandoDetalle}>Cerrar</Button>
            <Button variant="primary" onClick={guardarDetalle} loading={guardandoDetalle}>Guardar cambios</Button>
          </>
        }
      >
        {detalle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)' }}>
            {/* Info */}
            <div style={detalleInfoStyle}>
              <div style={detalleAvatarStyle}>{(detalle.nombre?.[0] ?? detalle.email?.[0] ?? '?').toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)' }}>{detalle.nombre ?? '—'}</div>
                <div style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>{detalle.email}</div>
              </div>
              <EstadoBadge value={detalle.estado ?? 'activo'} />
            </div>

            {/* Rol + Estado */}
            <div className="sn-staff-edit-row" style={editRowStyle}>
              <label style={labelWrapStyle}>
                <span style={subLabelStyle}>Rol</span>
                <select value={editRol} onChange={(e) => setEditRol(e.target.value)}
                  className="sn-focusable" style={inputStyle}>
                  {ROLES_LIST.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label style={labelWrapStyle}>
                <span style={subLabelStyle}>Estado</span>
                <select value={editEstado} onChange={(e) => setEditEstado(e.target.value)}
                  className="sn-focusable" style={inputStyle}>
                  {ESTADOS_USUARIO.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </label>
            </div>

            {/* Permisos finos */}
            <div>
              <span style={subLabelStyle}>Permisos finos</span>
              <p style={{ margin: '4px 0 var(--sn-space-3)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                Los permisos complementan el rol base. Un administrador tiene acceso total sin importar estos checkboxes.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
                {gruposPermisos.map(([grupo, permisos]) => (
                  <div key={grupo}>
                    <div style={permisoGrupoStyle}>{grupo}</div>
                    <div style={permisosWrapStyle}>
                      {permisos.map((p) => (
                        <label key={p.value} style={permisoLabelStyle} className="sn-focusable">
                          <input
                            type="checkbox"
                            checked={editPermisos.includes(p.value)}
                            onChange={() => togglePermiso(p.value)}
                            style={checkboxStyle}
                          />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Meta */}
            {(detalle.fechaCreacion || detalle.ultimoAcceso) && (
              <div style={metaRowStyle}>
                {detalle.fechaCreacion && (
                  <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                    Creado: {formatTs(detalle.fechaCreacion)}
                  </div>
                )}
                {detalle.ultimoAcceso && (
                  <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                    Último acceso: {formatTs(detalle.ultimoAcceso)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* === MODAL: Confirmar suspender/reactivar === */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.accion === 'suspender' ? 'Suspender usuario' : 'Reactivar usuario'}
        description={confirmAction
          ? `¿Confirmas que deseas ${confirmAction.accion === 'suspender' ? 'suspender' : 'reactivar'} a ${confirmAction.usuario.nombre ?? confirmAction.usuario.email}?`
          : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmAction(null)} disabled={guardando}>Cancelar</Button>
            <Button
              variant={confirmAction?.accion === 'suspender' ? 'danger' : 'primary'}
              onClick={ejecutarConfirm}
              loading={guardando}
            >
              {confirmAction?.accion === 'suspender' ? 'Suspender' : 'Reactivar'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--sn-text-muted)', margin: 0 }}>
          {confirmAction?.accion === 'suspender'
            ? 'El usuario perderá acceso al sistema inmediatamente. Podrás reactivarlo después.'
            : 'El usuario recuperará su acceso previo con el mismo rol y permisos.'}
        </p>
      </Modal>

      <style>{`
        @media (max-width: 767.98px) {
          .sn-staff-filters { grid-template-columns: 1fr !important; }
          .sn-staff-grid { grid-template-columns: 1fr !important; }
          .sn-staff-edit-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

/* =============================================================
   UserCard
   ============================================================= */
const UserCard = ({ u, isCurrentUser, onDetalle, onSuspender, onReactivar }) => {
  const est = u.estado ?? 'activo';
  const isSuspended = est === 'suspendido' || est === 'inactivo';
  const permCount = (u.permisos ?? []).length;

  return (
    <Card style={isSuspended ? { opacity: 0.65 } : undefined}>
      <CardBody style={{ padding: 'var(--sn-space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={cardAvatarStyle}>{(u.nombre?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-md)' }}>
                {u.nombre ?? '—'}
              </span>
              {isCurrentUser && <Badge tone="brand" size="sm">Tú</Badge>}
            </div>
            <div style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', marginTop: 2 }}>
              {u.email}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <RolBadge rol={u.rol} />
              <EstadoBadge value={est} />
              {permCount > 0 && <Badge tone="neutral" size="sm">{permCount} permisos</Badge>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sn-space-3)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button size="sm" variant="secondary" onClick={onDetalle}>Editar</Button>
          {!isSuspended ? (
            <Button size="sm" variant="ghost" onClick={onSuspender} style={{ color: 'var(--sn-crit)' }}>Suspender</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onReactivar} style={{ color: 'var(--sn-success)' }}>Reactivar</Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

/* =============================================================
   Badges
   ============================================================= */
const RolBadge = ({ rol }) => {
  const tone = {
    [ROLES.ADMIN]: 'elite',
    [ROLES.ENTRENADOR]: 'brand',
    [ROLES.TESORERO]: 'success',
    [ROLES.INVITADO]: 'neutral',
  }[rol] ?? 'neutral';
  return <Badge tone={tone} size="sm">{rolLabel(rol)}</Badge>;
};

const EstadoBadge = ({ value }) => {
  const info = estadoInfo(value);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '0.2rem 0.6rem',
      borderRadius: 'var(--sn-radius-pill)',
      background: `color-mix(in srgb, ${info.color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${info.color} 35%, transparent)`,
      color: info.color,
      fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 'var(--sn-tracking-wide)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: info.color }} />
      {info.label}
    </span>
  );
};

/* =============================================================
   Helpers
   ============================================================= */
const formatTs = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* =============================================================
   Iconos
   ============================================================= */
const PlusIcon   = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>);
const SearchIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>);

/* =============================================================
   Estilos
   ============================================================= */
const pageBg = { minHeight: 'calc(100vh - var(--sn-navbar-h))', background: 'var(--sn-bg-base)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
const contentWrap = { maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)' };

const headerStyle = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--sn-space-4)', flexWrap: 'wrap', marginBottom: 'var(--sn-space-5)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const leadStyle = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' };

const subLabelStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-wide)', textTransform: 'uppercase', color: 'var(--sn-text-muted)' };
const labelWrapStyle = { display: 'flex', flexDirection: 'column', gap: 6 };

const inputStyle = {
  width: '100%', background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)', borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0.85rem', outline: 'none', minHeight: 44,
};

const selectStyle = { ...inputStyle };

const filtersGridStyle = {
  display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr 1fr',
  gap: 'var(--sn-space-3)',
};

const searchWrapStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'var(--sn-input-bg)', border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)', padding: '0 0.85rem', color: 'var(--sn-text-muted)',
};

const searchInputStyle = {
  flex: 1, background: 'transparent', border: 'none', outline: 'none',
  color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)', padding: '0.7rem 0',
};

const staffGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
  gap: 'var(--sn-space-3)',
};

const cardAvatarStyle = {
  width: 44, height: 44, borderRadius: '50%',
  background: 'var(--sn-brand-gradient)', color: '#06121A',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 900, fontSize: 16, flexShrink: 0,
};

const detalleInfoStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: 'var(--sn-space-3) var(--sn-space-4)',
  background: 'var(--sn-bg-soft)', borderRadius: 'var(--sn-radius-md)',
  border: '1px solid var(--sn-border-faint)',
};

const detalleAvatarStyle = {
  width: 48, height: 48, borderRadius: '50%',
  background: 'var(--sn-brand-gradient)', color: '#06121A',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 900, fontSize: 18, flexShrink: 0,
};

const editRowStyle = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sn-space-3)',
};

const permisoGrupoStyle = {
  fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
  letterSpacing: 'var(--sn-tracking-mega)', textTransform: 'uppercase',
  color: 'var(--sn-text-muted)', marginBottom: 6,
  paddingBottom: 4, borderBottom: '1px solid var(--sn-border-faint)',
};

const permisosWrapStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '4px 12px',
};

const permisoLabelStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 4px', cursor: 'pointer',
  fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-secondary)',
  fontWeight: 600, minHeight: 36,
};

const checkboxStyle = {
  width: 18, height: 18, accentColor: 'var(--sn-brand-glow)',
  cursor: 'pointer', flexShrink: 0,
};

const metaRowStyle = {
  display: 'flex', gap: 'var(--sn-space-4)', flexWrap: 'wrap',
  padding: 'var(--sn-space-3) 0', borderTop: '1px solid var(--sn-border-faint)',
};

export default GestionUsuarios;
