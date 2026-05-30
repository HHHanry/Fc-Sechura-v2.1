import React from 'react';

/**
 * Card — superficie base del Stadium Noir.
 * Variantes:
 *  - "surface"  (default): glass card sobre fondo oscuro.
 *  - "elevated": modales, popovers (un nivel más arriba).
 *  - "glow":     borde animado cian (para destacar).
 *  - "tier":     fondo dorado tipo "tarjeta élite FIFA".
 */
const ACCENTS = {
  brand:   'var(--sn-brand-glow)',
  success: 'var(--sn-success)',
  warn:    'var(--sn-warn)',
  crit:    'var(--sn-crit)',
  info:    'var(--sn-info)',
  elite:   'var(--sn-tier-elite)',
  team:    'var(--sn-team)',
  rival:   'var(--sn-rival)',
};

export const Card = React.forwardRef(function Card(
  { variant = 'surface', as = 'div', children, style, className = '', interactive = false, accent, ...rest },
  ref,
) {
  const base = {
    borderRadius: 'var(--sn-radius-lg)',
    color: 'var(--sn-text-primary)',
    transition: 'transform var(--sn-dur-base) var(--sn-ease), box-shadow var(--sn-dur-base) var(--sn-ease), border-color var(--sn-dur-base) var(--sn-ease)',
  };
  const accentColor = accent ? (ACCENTS[accent] ?? accent) : null;
  const accentStyle = accentColor ? { borderLeft: `3px solid ${accentColor}` } : null;
  const variants = {
    surface: {
      background: 'var(--sn-surface-gradient)',
      border: '1px solid var(--sn-border-faint)',
      boxShadow: 'var(--sn-shadow-sm)',
    },
    elevated: {
      background: 'var(--sn-bg-elevated)',
      border: '1px solid var(--sn-border-soft)',
      boxShadow: 'var(--sn-shadow-md)',
    },
    glow: {
      background: 'var(--sn-bg-surface)',
      border: '1px solid var(--sn-border-glow)',
      boxShadow: 'var(--sn-shadow-glow)',
    },
    tier: {
      background: 'linear-gradient(135deg, color-mix(in srgb, var(--sn-tier-elite) 16%, var(--sn-bg-surface)) 0%, var(--sn-bg-surface) 65%)',
      border: '1px solid color-mix(in srgb, var(--sn-tier-elite) 50%, transparent)',
      boxShadow: 'var(--sn-shadow-elite)',
    },
  };
  const merged = { ...base, ...variants[variant], ...accentStyle, ...style };
  return React.createElement(
    as,
    {
      ref,
      className: `${interactive ? 'sn-focusable' : ''} ${className}`,
      style: merged,
      onMouseEnter: interactive ? (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--sn-border-glow)'; } : undefined,
      onMouseLeave: interactive ? (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; } : undefined,
      ...rest,
    },
    children,
  );
});

export const CardBody = ({ children, style, className = '', ...rest }) => (
  <div className={className} style={{ padding: 'var(--sn-space-5)', ...style }} {...rest}>{children}</div>
);

export const CardHeader = ({ title, subtitle, action, style, className = '' }) => (
  <div
    className={className}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--sn-space-4)',
      padding: 'var(--sn-space-5) var(--sn-space-5) var(--sn-space-3)',
      borderBottom: '1px solid var(--sn-border-faint)',
      ...style,
    }}
  >
    <div>
      {title && (
        <h3 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-md)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' }}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p style={{ margin: '0.2rem 0 0', fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </div>
);
