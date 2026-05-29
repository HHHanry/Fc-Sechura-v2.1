import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import logo from '../assets/logonegro.png';
import { toast } from '../hooks/useToast';
import { useTheme } from '../hooks/useTheme';

/**
 * Navbar Stadium Noir — glass dark, jerarquía por grupos.
 * Desktop: pills + dropdowns por rol.
 * Mobile: drawer slide-in desde la derecha, con backdrop blur + scroll lock.
 */

const ROLES = {
  ADMIN: 'admin', ENTRENADOR: 'entrenador', TESORERO: 'tesorero',
};

const buildNavGroups = (rol) => {
  const grupos = [];

  if (rol === ROLES.ADMIN || rol === ROLES.ENTRENADOR) {
    grupos.push({
      label: 'Operaciones',
      items: [
        { to: '/asistencia', label: 'Scanner QR',  hint: 'Registrar asistencia en vivo' },
        { to: '/historial',  label: 'Asistencias', hint: 'Histórico y reportes' },
      ],
    });
  }
  if (rol === ROLES.ADMIN || rol === ROLES.TESORERO) {
    grupos.push({
      label: 'Finanzas',
      items: [
        { to: '/registrar-pago', label: 'Registrar pago', hint: 'Cobrar mensualidad' },
        { to: '/ver-pagos',      label: 'Caja',           hint: 'Libro mayor' },
      ],
    });
  }
  if (rol === ROLES.ADMIN || rol === ROLES.ENTRENADOR) {
    grupos.push({
      label: 'Deportivo',
      items: [
        { to: '/performance',  label: 'Stats',        hint: 'Evaluación FIFA' },
        { to: '/pizarra',      label: 'Pizarra',      hint: 'Tactica táctil' },
        { to: '/convocatoria', label: 'Convocatoria', hint: 'Alineación' },
        { to: '/scouting',     label: 'Scouting',     hint: 'Próximos partidos' },
        { to: '/misiones',      label: 'Plan vivo',      hint: 'Misiones del jugador' },
        { to: '/competencias', label: 'Competencias', hint: 'Mapa por posición' },
        { to: '/cantera',      label: 'Cantera',      hint: 'Proyección y potencial' },
      ],
    });
  }
  if (rol === ROLES.ADMIN) {
    grupos.push({
      label: 'Sistema',
      items: [
        { to: '/usuarios', label: 'Staff', hint: 'Gestión de usuarios' },
      ],
    });
  }
  return grupos;
};

const DRAWER_MS = 320;

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  // mobileState: 'closed' | 'opening' | 'open' | 'closing'
  const [mobileState, setMobileState] = useState('closed');
  const [openGroup, setOpenGroup] = useState(null);
  const navRef = useRef(null);
  const closeTimerRef = useRef(null);

  const isMobileOpen = mobileState === 'opening' || mobileState === 'open';

  const openMobile = useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setMobileState('opening');
    requestAnimationFrame(() => requestAnimationFrame(() => setMobileState('open')));
  }, []);

  const closeMobile = useCallback(() => {
    setMobileState((cur) => (cur === 'closed' || cur === 'closing' ? cur : 'closing'));
    closeTimerRef.current = setTimeout(() => {
      setMobileState('closed');
      closeTimerRef.current = null;
    }, DRAWER_MS);
  }, []);

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  // Cierra dropdown desktop si haces click fuera
  useEffect(() => {
    const onClickOut = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', onClickOut);
    return () => document.removeEventListener('mousedown', onClickOut);
  }, []);

  // Cierra menús al cambiar de ruta
  useEffect(() => {
    setOpenGroup(null);
    closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Scroll lock + ESC cuando el drawer está visible
  useEffect(() => {
    if (mobileState === 'closed') return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;

    const onKey = (e) => { if (e.key === 'Escape') closeMobile(); };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileState, closeMobile]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info('Sesión cerrada.');
      navigate('/login');
    } catch {
      toast.error('No se pudo cerrar la sesión.');
    }
  };

  if (!user) return null;

  const grupos = buildNavGroups(user.rol);
  const isActive = (path) => location.pathname === path;
  const groupHasActive = (g) => g.items.some((i) => isActive(i.to));

  const userLabel = user.nombre ?? user.email ?? 'Usuario';
  const userInitial = (user.nombre?.[0] ?? user.email?.[0] ?? '?').toUpperCase();

  return (
    <>
      <nav ref={navRef} className="hide-on-print" style={navStyle}>
        <div style={glowStripeStyle} aria-hidden />
        <div style={containerStyle}>
          {/* === BRAND === */}
          <Link to="/" style={brandStyle} aria-label="FC Sechura — inicio">
            <span style={logoBoxStyle}>
              <img src={logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            </span>
            <span className="sn-brand-text" style={brandTextStyle}>
              FC <span style={{ color: 'var(--sn-brand-glow)' }}>SECHURA</span>
            </span>
          </Link>

          {/* === DESKTOP NAV === */}
          <ul className="sn-nav-desktop" style={desktopUlStyle}>
            <NavPill to="/"        label="Resumen" isActive={isActive('/')} />
            <NavPill to="/alumnos" label="Alumnos" isActive={isActive('/alumnos')} />

            {grupos.map((g) => {
              const active = groupHasActive(g);
              const open = openGroup === g.label;
              return (
                <li key={g.label} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : g.label)}
                    className="sn-focusable"
                    aria-haspopup="true"
                    aria-expanded={open}
                    style={{ ...pillStyle(active || open), display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {g.label}
                    <Chevron open={open} />
                  </button>
                  {open && (
                    <div role="menu" style={menuStyle}>
                      {g.items.map((it) => (
                        <Link
                          key={it.to}
                          to={it.to}
                          role="menuitem"
                          className="sn-focusable"
                          style={{ ...menuItemStyle, ...(isActive(it.to) ? menuItemActiveStyle : null) }}
                        >
                          <span style={menuItemLabelStyle}>{it.label}</span>
                          <span style={menuItemHintStyle}>{it.hint}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* === USER + LOGOUT (desktop) === */}
          <div style={rightSlotStyle} className="sn-nav-user">
            <UserChip user={user} />
            <button
              type="button"
              onClick={toggleTheme}
              className="sn-focusable"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label="Alternar modo claro/oscuro"
              style={themeBtnStyle}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="sn-focusable"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={logoutBtnStyle}
            >
              <LogoutIcon />
            </button>
          </div>

          {/* === HAMBURGER (mobile) — pegado al borde derecho === */}
          <button
            type="button"
            onClick={() => (isMobileOpen ? closeMobile() : openMobile())}
            aria-label={isMobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMobileOpen}
            aria-controls="sn-mobile-drawer"
            className="sn-focusable sn-nav-burger"
            style={burgerStyle}
          >
            {isMobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      {/* === MOBILE DRAWER + BACKDROP === */}
      {mobileState !== 'closed' && (
        <div
          className="hide-on-print sn-mobile-shell"
          aria-hidden={!isMobileOpen}
        >
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={closeMobile}
            className={`sn-mobile-backdrop ${isMobileOpen ? 'is-open' : 'is-closing'}`}
          />
          <aside
            id="sn-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className={`sn-mobile-drawer ${isMobileOpen ? 'is-open' : 'is-closing'}`}
          >
            {/* === HERO: brand + cerrar === */}
            <header className="sn-md-hero">
              <div className="sn-md-brand">
                <span className="sn-md-logo-box">
                  <img src={logo} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                </span>
                <span className="sn-md-brand-text">
                  FC <span style={{ color: 'var(--sn-brand-glow)' }}>SECHURA</span>
                </span>
              </div>
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Cerrar menú"
                className="sn-focusable sn-md-close"
              >
                <CloseIcon />
              </button>
            </header>

            {/* === USER CARD === */}
            <section className="sn-md-user-card">
              <div className="sn-md-avatar" aria-hidden>{userInitial}</div>
              <div className="sn-md-user-meta">
                <div className="sn-md-user-name" title={userLabel}>{userLabel}</div>
                <div className="sn-md-user-role">
                  <UserBadgeIcon /> {user.rol}
                </div>
              </div>
              <div className="sn-md-user-actions">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="sn-focusable sn-md-icon-btn"
                  title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                  aria-label="Alternar modo claro/oscuro"
                >
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
              </div>
            </section>

            {/* === NAV === */}
            <nav className="sn-md-nav sn-scroll">
              <NavMobileLink to="/"        label="Resumen" active={isActive('/')} onClick={closeMobile} />
              <NavMobileLink to="/alumnos" label="Alumnos" active={isActive('/alumnos')} onClick={closeMobile} />
              {grupos.map((g) => (
                <div key={g.label} className="sn-md-group">
                  <div className="sn-md-group-head">{g.label}</div>
                  {g.items.map((it) => (
                    <NavMobileLink
                      key={it.to}
                      to={it.to}
                      label={it.label}
                      hint={it.hint}
                      active={isActive(it.to)}
                      onClick={closeMobile}
                    />
                  ))}
                </div>
              ))}
            </nav>

            {/* === FOOTER: logout === */}
            <footer className="sn-md-footer">
              <button
                type="button"
                onClick={handleLogout}
                className="sn-focusable sn-md-logout"
              >
                <LogoutIcon /> Cerrar sesión
              </button>
            </footer>
          </aside>
        </div>
      )}

      <style>{`
        @media (max-width: 991.98px) {
          .sn-nav-desktop { display: none !important; }
          .sn-nav-user    { display: none !important; }
          .sn-nav-burger  { display: inline-flex !important; }
        }
        @media (min-width: 992px) {
          .sn-nav-burger  { display: none !important; }
          .sn-mobile-shell { display: none !important; }
        }
        /* Anti-amontonamiento: en pantallas medianas comprimimos el chip y el brand text */
        @media (max-width: 1199.98px) and (min-width: 992px) {
          .sn-user-chip-meta { display: none !important; }
          .sn-brand-text     { display: none !important; }
        }

        .sn-mobile-shell {
          position: fixed; inset: 0;
          z-index: var(--sn-z-modal);
          pointer-events: auto;
        }
        .sn-mobile-backdrop {
          position: absolute; inset: 0;
          border: 0; padding: 0; margin: 0;
          background: rgba(7, 12, 22, 0.42);
          -webkit-backdrop-filter: blur(4px) saturate(140%);
          backdrop-filter: blur(4px) saturate(140%);
          opacity: 0;
          transition: opacity ${DRAWER_MS}ms var(--sn-ease);
          cursor: pointer;
        }
        .sn-mobile-backdrop.is-open    { opacity: 1; }
        .sn-mobile-backdrop.is-closing { opacity: 0; }

        .sn-mobile-drawer {
          position: absolute;
          top: 0; right: 0; bottom: 0;
          width: min(82vw, 380px);
          max-width: 100%;
          background: var(--sn-bg-elevated);
          border-left: 1px solid var(--sn-border-soft);
          box-shadow: -24px 0 60px -20px rgba(0,0,0,0.45);
          display: flex; flex-direction: column;
          transform: translateX(100%);
          transition: transform ${DRAWER_MS}ms var(--sn-ease-out);
          padding-top: env(safe-area-inset-top, 0);
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .sn-mobile-drawer.is-open    { transform: translateX(0); }
        .sn-mobile-drawer.is-closing { transform: translateX(100%); }

        /* ===== HERO ===== */
        .sn-md-hero {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--sn-border-faint);
          background: linear-gradient(180deg, color-mix(in srgb, var(--sn-brand-glow) 6%, transparent) 0%, transparent 100%);
        }
        .sn-md-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
        .sn-md-logo-box {
          width: 34px; height: 34px; border-radius: var(--sn-radius-md);
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--sn-brand-deep);
          border: 1px solid var(--sn-brand-deep);
          box-shadow: var(--sn-shadow-sm);
          flex-shrink: 0;
        }
        .sn-md-brand-text {
          font-family: var(--sn-font-display);
          font-weight: 800; font-size: var(--sn-fs-md);
          letter-spacing: 0.06em;
          color: var(--sn-text-primary);
          white-space: nowrap;
        }
        .sn-md-close {
          width: 40px; height: 40px; border-radius: var(--sn-radius-md);
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--sn-bg-surface);
          color: var(--sn-text-primary);
          border: 1px solid var(--sn-border-soft);
          cursor: pointer; flex-shrink: 0;
        }

        /* ===== USER CARD ===== */
        .sn-md-user-card {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px;
          margin: 12px;
          background: var(--sn-bg-surface);
          border: 1px solid var(--sn-border-faint);
          border-radius: var(--sn-radius-lg);
          box-shadow: var(--sn-shadow-sm);
        }
        .sn-md-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--sn-brand-gradient);
          color: #06121A; font-weight: 900; font-size: 16px;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--sn-brand-glow) 22%, transparent);
          flex-shrink: 0;
        }
        .sn-md-user-meta { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
        .sn-md-user-name {
          font-weight: 700; font-size: var(--sn-fs-sm);
          color: var(--sn-text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sn-md-user-role {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.7rem; font-weight: 800;
          color: var(--sn-brand-glow);
          text-transform: uppercase; letter-spacing: var(--sn-tracking-mega);
        }
        .sn-md-user-actions { display: inline-flex; gap: 6px; flex-shrink: 0; }
        .sn-md-icon-btn {
          width: 40px; height: 40px; border-radius: var(--sn-radius-md);
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--sn-bg-elevated);
          color: var(--sn-text-secondary);
          border: 1px solid var(--sn-border-soft);
          cursor: pointer;
          transition: background var(--sn-dur-fast) var(--sn-ease), color var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-md-icon-btn:hover { background: var(--sn-row-soft); color: var(--sn-text-primary); }

        /* ===== NAV ===== */
        .sn-md-nav {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          padding: 4px 12px 12px;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .sn-md-group { margin-top: 14px; }
        .sn-md-group-head {
          font-size: 0.68rem; font-weight: 800;
          letter-spacing: var(--sn-tracking-mega);
          color: var(--sn-text-muted);
          text-transform: uppercase;
          padding: 0 12px 6px;
          margin-bottom: 2px;
          border-bottom: 1px solid var(--sn-border-faint);
        }
        .sn-md-link {
          position: relative;
          display: flex; flex-direction: column;
          padding: 11px 14px;
          margin-top: 8px;
          border-radius: var(--sn-radius-md);
          background: var(--sn-bg-surface);
          border: 1px solid var(--sn-border-soft);
          box-shadow: var(--sn-shadow-sm);
          color: var(--sn-text-secondary);
          text-decoration: none;
          min-height: 50px; justify-content: center;
          transition: background var(--sn-dur-fast) var(--sn-ease), color var(--sn-dur-fast) var(--sn-ease),
                      border-color var(--sn-dur-fast) var(--sn-ease), transform var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-md-link:hover {
          background: var(--sn-row-strong);
          color: var(--sn-text-primary);
          border-color: var(--sn-border-strong);
        }
        .sn-md-link:active { transform: scale(0.985); }
        .sn-md-link.is-active {
          color: var(--sn-text-primary);
          background: color-mix(in srgb, var(--sn-brand-glow) 12%, transparent);
          border-color: var(--sn-border-glow);
        }
        .sn-md-link-bar {
          position: absolute; left: 6px; top: 10px; bottom: 10px;
          width: 3px; border-radius: 999px;
          background: var(--sn-brand-glow);
        }
        .sn-md-link-label { font-weight: 700; font-size: 0.95rem; }
        .sn-md-link-hint { font-size: 0.72rem; color: var(--sn-text-muted); margin-top: 2px; }
        .sn-md-link.is-active .sn-md-link-hint { color: var(--sn-text-secondary); }

        /* ===== FOOTER ===== */
        .sn-md-footer {
          padding: 12px 16px 16px;
          border-top: 1px solid var(--sn-border-faint);
        }
        .sn-md-logout {
          width: 100%; min-height: 48px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border-radius: var(--sn-radius-md);
          background: rgba(220,38,38,0.08);
          color: var(--sn-crit);
          border: 1px solid rgba(220,38,38,0.30);
          cursor: pointer;
          font-family: var(--sn-font-ui); font-weight: 700;
          font-size: var(--sn-fs-sm);
        }
        .sn-md-logout:hover { background: rgba(220,38,38,0.14); }

        @media (prefers-reduced-motion: reduce) {
          .sn-mobile-backdrop, .sn-mobile-drawer { transition: none !important; }
        }
      `}</style>
    </>
  );
};

/* =============================
   Sub-componentes
   ============================= */

const NavPill = ({ to, label, isActive }) => (
  <li>
    <Link to={to} className="sn-focusable" style={pillStyle(isActive)}>
      {label}
    </Link>
  </li>
);

const NavMobileLink = ({ to, label, hint, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`sn-md-link sn-focusable ${active ? 'is-active' : ''}`}
  >
    <span className="sn-md-link-label">{label}</span>
    {hint && <span className="sn-md-link-hint">{hint}</span>}
    {active && <span className="sn-md-link-bar" aria-hidden />}
  </Link>
);

const UserChip = ({ user }) => {
  const full = `${user.nombre ?? user.email} · ${user.rol}`;
  return (
    <div style={chipStyle} title={full} aria-label={full}>
      <div style={chipAvatarStyle} aria-hidden>
        {(user.nombre?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
      </div>
      <div className="sn-user-chip-meta" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={chipNameStyle}>{user.nombre ?? user.email}</span>
        <span style={chipRoleStyle}>{user.rol}</span>
      </div>
    </div>
  );
};

const Chevron = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
       style={{ transition: 'transform var(--sn-dur-fast) var(--sn-ease)', transform: open ? 'rotate(180deg)' : 'none' }}>
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const MenuIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>);
const CloseIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6 18 18M18 6 6 18"/></svg>);
const LogoutIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>);
const SunIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>);
const MoonIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>);
const UserBadgeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

/* =============================
   Estilos
   ============================= */

const navStyle = {
  position: 'sticky', top: 0, zIndex: 'var(--sn-z-navbar)',
  background: 'color-mix(in srgb, var(--sn-bg-base) 78%, transparent)',
  backdropFilter: 'blur(14px) saturate(160%)', WebkitBackdropFilter: 'blur(14px) saturate(160%)',
  borderBottom: '1px solid var(--sn-border-faint)',
  fontFamily: 'var(--sn-font-ui)',
};

const glowStripeStyle = {
  position: 'absolute', inset: '0 0 auto 0', height: 1,
  background: 'linear-gradient(90deg, transparent, var(--sn-border-glow), transparent)',
};

const containerStyle = {
  display: 'flex', alignItems: 'center', gap: 'var(--sn-space-3)',
  maxWidth: 1280, margin: '0 auto',
  padding: '0.65rem var(--sn-space-4)',
};

const brandStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 10,
  textDecoration: 'none', color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-display)',
  fontWeight: 800, letterSpacing: '0.04em',
  fontSize: 'var(--sn-fs-md)',
  marginRight: 'auto',
};

const logoBoxStyle = {
  width: 36, height: 36, borderRadius: 'var(--sn-radius-md)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--sn-brand-deep)',
  border: '1px solid var(--sn-brand-deep)',
  boxShadow: 'var(--sn-shadow-sm)',
};

const brandTextStyle = { letterSpacing: '0.06em' };

const desktopUlStyle = {
  display: 'flex', alignItems: 'center', gap: 2,
  margin: 0, padding: 0, listStyle: 'none',
  flex: 1, justifyContent: 'center',
};

const pillStyle = (active) => ({
  display: 'inline-block',
  padding: '0.4rem 0.75rem',
  borderRadius: 'var(--sn-radius-pill)',
  textDecoration: 'none',
  fontSize: 'var(--sn-fs-sm)', fontWeight: 600,
  color: active ? 'var(--sn-text-primary)' : 'var(--sn-text-muted)',
  background: active ? 'color-mix(in srgb, var(--sn-brand-glow) 14%, transparent)' : 'transparent',
  border: active ? '1px solid var(--sn-border-glow)' : '1px solid transparent',
  boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--sn-brand-glow) 22%, transparent)' : 'none',
  transition: 'all var(--sn-dur-fast) var(--sn-ease)',
  cursor: 'pointer',
});

const menuStyle = {
  position: 'absolute', top: 'calc(100% + 8px)', left: 0,
  minWidth: 240,
  padding: 'var(--sn-space-2)',
  background: 'var(--sn-bg-elevated)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  boxShadow: 'var(--sn-shadow-md)',
  display: 'flex', flexDirection: 'column', gap: 2,
  animation: 'sn-slide-down var(--sn-dur-fast) var(--sn-ease-out)',
  zIndex: 'var(--sn-z-overlay)',
};

const menuItemStyle = {
  display: 'flex', flexDirection: 'column',
  padding: '0.55rem 0.75rem',
  borderRadius: 'var(--sn-radius-sm)',
  textDecoration: 'none',
  color: 'var(--sn-text-secondary)',
  border: '1px solid transparent',
  transition: 'background var(--sn-dur-fast) var(--sn-ease)',
};

const menuItemActiveStyle = {
  background: 'color-mix(in srgb, var(--sn-brand-glow) 14%, transparent)',
  border: '1px solid var(--sn-border-glow)',
  color: 'var(--sn-text-primary)',
};

const menuItemLabelStyle = { fontWeight: 700, fontSize: 'var(--sn-fs-sm)' };
const menuItemHintStyle  = { fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' };

const rightSlotStyle = { display: 'flex', alignItems: 'center', gap: 8 };

const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '0.3rem 0.6rem 0.3rem 0.35rem',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'var(--sn-bg-surface)',
  border: '1px solid var(--sn-border-soft)',
  boxShadow: 'var(--sn-shadow-sm)',
};

const chipAvatarStyle = {
  width: 30, height: 30, borderRadius: '50%',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--sn-brand-gradient)',
  color: '#06121A', fontWeight: 900, fontSize: 13,
  boxShadow: '0 0 0 2px color-mix(in srgb, var(--sn-brand-glow) 22%, transparent)',
};

const chipNameStyle = {
  fontSize: 'var(--sn-fs-sm)', fontWeight: 700,
  color: 'var(--sn-text-primary)', lineHeight: 1.1,
  maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const chipRoleStyle = {
  fontSize: '0.62rem', fontWeight: 800,
  color: 'var(--sn-brand-deep)',
  textTransform: 'uppercase', letterSpacing: 'var(--sn-tracking-mega)',
  lineHeight: 1.2,
};

const logoutBtnStyle = {
  width: 36, height: 36, borderRadius: 'var(--sn-radius-md)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(220,38,38,0.08)',
  color: 'var(--sn-crit)',
  border: '1px solid rgba(220,38,38,0.30)',
  cursor: 'pointer',
  transition: 'background var(--sn-dur-fast) var(--sn-ease), color var(--sn-dur-fast) var(--sn-ease)',
};

const themeBtnStyle = {
  width: 36, height: 36, borderRadius: 'var(--sn-radius-md)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent',
  color: 'var(--sn-text-secondary)',
  border: '1px solid var(--sn-border-soft)',
  cursor: 'pointer',
  transition: 'background var(--sn-dur-fast) var(--sn-ease), color var(--sn-dur-fast) var(--sn-ease)',
};

const burgerStyle = {
  display: 'none',
  width: 48, height: 48, borderRadius: 'var(--sn-radius-md)',
  alignItems: 'center', justifyContent: 'center',
  background: 'var(--sn-bg-surface)',
  color: 'var(--sn-text-primary)',
  border: '1px solid var(--sn-border-soft)',
  cursor: 'pointer',
  boxShadow: 'var(--sn-shadow-sm)',
  marginLeft: 'auto',
};

/* Drawer móvil — todos los estilos viven en el <style> tag dentro del componente. */

export default Navbar;
