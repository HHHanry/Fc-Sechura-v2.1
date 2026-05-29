import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Button } from './ui/Button';

const ShieldIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--sn-crit)" strokeWidth="1.5" style={{ opacity: 0.75 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--sn-bg-base)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid var(--sn-border-soft)',
          borderTopColor: 'var(--sn-brand-glow)',
          animation: 'sn-spin 0.7s linear infinite',
        }} role="status" aria-label="Cargando permisos" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - var(--sn-navbar-h))', padding: 'var(--sn-space-5)',
        background: 'var(--sn-bg-base)',
      }}>
        <div style={{
          maxWidth: 440, width: '100%', textAlign: 'center',
          padding: 'var(--sn-space-7)', borderRadius: 'var(--sn-radius-xl)',
          background: 'var(--sn-bg-surface)',
          border: '1px solid var(--sn-border-soft)',
          boxShadow: 'var(--sn-shadow-md)',
        }}>
          <ShieldIcon />
          <h2 style={{
            margin: 'var(--sn-space-4) 0 var(--sn-space-2)',
            fontFamily: 'var(--sn-font-display)', fontWeight: 800,
            fontSize: 'var(--sn-fs-xl)', color: 'var(--sn-text-primary)',
          }}>Acceso Denegado</h2>
          <p style={{
            margin: '0 0 var(--sn-space-5)',
            color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-md)',
          }}>
            Tu perfil de <strong style={{ color: 'var(--sn-text-primary)' }}>{user.rol}</strong> no tiene permisos para esta sección.
          </p>
          <Button variant="secondary" onClick={() => window.history.back()}>
            ← Volver atrás
          </Button>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
