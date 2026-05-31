import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Bottom-nav tipo app (móvil/tablet ≤991px).
 * Role-aware: cada slot apunta a una ruta permitida para ese rol.
 * El slot "Más" abre el drawer existente (onMore) — no duplica navegación.
 * Desktop: oculto por CSS (la navbar superior toma el control).
 */

const buildItems = (rol) => {
  const resumen = { to: '/', label: 'Resumen', icon: <HomeIcon /> };
  const alumnos = { to: '/alumnos', label: 'Alumnos', icon: <UsersIcon /> };

  if (rol === 'admin') {
    return [resumen, alumnos,
      { to: '/asistencia', label: 'Asistencia', icon: <ScanIcon /> },
      { to: '/ver-pagos', label: 'Caja', icon: <WalletIcon /> }];
  }
  if (rol === 'entrenador') {
    return [resumen, alumnos,
      { to: '/asistencia', label: 'Asistencia', icon: <ScanIcon /> },
      { to: '/convocatoria', label: 'Deportivo', icon: <WhistleIcon /> }];
  }
  if (rol === 'tesorero') {
    return [resumen, alumnos,
      { to: '/ver-pagos', label: 'Caja', icon: <WalletIcon /> },
      { to: '/registrar-pago', label: 'Cobrar', icon: <CashIcon /> }];
  }
  return [resumen, alumnos]; // invitado / otros
};

const BottomNav = ({ user, onMore, moreActive }) => {
  const { pathname } = useLocation();
  if (!user) return null;

  const items = buildItems(user.rol);
  const isActive = (to) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`));

  return (
    <nav className="sn-bottom-nav hide-on-print" aria-label="Navegación rápida">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          className={`sn-bn-item sn-focusable ${isActive(it.to) ? 'is-active' : ''}`}
          aria-current={isActive(it.to) ? 'page' : undefined}
        >
          <span className="sn-bn-icon">{it.icon}</span>
          <span className="sn-bn-label">{it.label}</span>
        </Link>
      ))}

      <button
        type="button"
        onClick={onMore}
        className={`sn-bn-item sn-focusable ${moreActive ? 'is-active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={!!moreActive}
        aria-label="Más opciones"
      >
        <span className="sn-bn-icon"><MoreIcon /></span>
        <span className="sn-bn-label">Más</span>
      </button>

      <style>{`
        .sn-bottom-nav { display: none; }
        @media (max-width: 991.98px) {
          .sn-bottom-nav {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: 1fr;
            position: fixed; left: 0; right: 0; bottom: 0;
            z-index: var(--sn-z-navbar);
            background: var(--sn-nav-bg);
            -webkit-backdrop-filter: blur(16px) saturate(160%);
            backdrop-filter: blur(16px) saturate(160%);
            border-top: 1px solid var(--sn-nav-border);
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -10px 28px -16px rgba(0,0,0,0.35);
            animation: sn-bn-rise var(--sn-dur-slow) var(--sn-ease-out) both;
          }
        }
        @keyframes sn-bn-rise {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sn-bn-item {
          position: relative;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px;
          min-height: 56px;
          padding: 6px 4px;
          text-decoration: none;
          color: var(--sn-text-muted);
          background: transparent; border: none; cursor: pointer;
          transition: color var(--sn-dur-fast) var(--sn-ease);
          -webkit-tap-highlight-color: transparent;
          animation: sn-bn-item-in var(--sn-dur-base) var(--sn-ease-out) both;
        }
        .sn-bn-item:nth-child(1) { animation-delay: 70ms; }
        .sn-bn-item:nth-child(2) { animation-delay: 120ms; }
        .sn-bn-item:nth-child(3) { animation-delay: 170ms; }
        .sn-bn-item:nth-child(4) { animation-delay: 220ms; }
        .sn-bn-item:nth-child(5) { animation-delay: 270ms; }
        @keyframes sn-bn-item-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sn-bn-item:hover { color: var(--sn-text-secondary); }
        .sn-bn-item.is-active { color: var(--sn-nav-active); }
        .sn-bn-item.is-active::before {
          content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
          width: 30px; height: 3px; border-radius: 0 0 999px 999px;
          background: var(--sn-nav-active);
        }
        .sn-bn-icon { display: inline-flex; transition: transform var(--sn-dur-fast) var(--sn-ease); }
        .sn-bn-item:active .sn-bn-icon { transform: scale(0.9); }
        .sn-bn-label {
          font-size: 0.66rem; font-weight: 700; letter-spacing: 0.01em;
          max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
      `}</style>
    </nav>
  );
};

/* === Iconos === */
const HomeIcon    = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>);
const UsersIcon   = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16.5 19a5.5 5.5 0 0 1 5-5.4"/></svg>);
const ScanIcon    = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M4 12h16"/></svg>);
const WalletIcon  = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M16 12.5h2.5"/><path d="M3 9h13a2 2 0 0 1 2 2"/></svg>);
const WhistleIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 12a5 5 0 1 1-5-5h11l3-2v6a4 4 0 0 1-4 4"/><circle cx="6" cy="12" r="1.4"/></svg>);
const CashIcon    = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5h.01M18 14.5h.01"/></svg>);
const MoreIcon    = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>);

export default BottomNav;
