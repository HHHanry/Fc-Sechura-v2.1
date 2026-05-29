import React from 'react';

const variants = {
  primary: {
    background: 'var(--sn-brand-gradient)',
    color: 'white',
    border: '1px solid transparent',
    boxShadow: '0 8px 24px -8px var(--sn-border-glow)',
  },
  secondary: {
    background: 'var(--sn-bg-elevated)',
    color: 'var(--sn-text-primary)',
    border: '1px solid var(--sn-border-soft)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--sn-text-secondary)',
    border: '1px solid var(--sn-border-faint)',
  },
  danger: {
    background: 'var(--sn-crit)',
    color: 'var(--sn-text-on-crit)',
    border: '1px solid transparent',
    boxShadow: 'var(--sn-shadow-crit)',
  },
  success: {
    background: 'var(--sn-success)',
    color: 'var(--sn-text-on-success)',
    border: '1px solid transparent',
    boxShadow: '0 8px 24px -8px color-mix(in srgb, var(--sn-success) 50%, transparent)',
  },
};

const sizes = {
  sm: { padding: '0.4rem 0.9rem', fontSize: 'var(--sn-fs-sm)', borderRadius: 'var(--sn-radius-pill)' },
  md: { padding: '0.65rem 1.4rem', fontSize: 'var(--sn-fs-base)', borderRadius: 'var(--sn-radius-pill)' },
  lg: { padding: '0.9rem 1.8rem', fontSize: 'var(--sn-fs-md)', borderRadius: 'var(--sn-radius-pill)' },
};

export const Button = React.forwardRef(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, disabled, children, style, className = '', ...rest },
  ref,
) {
  const merged = {
    ...variants[variant],
    ...sizes[size],
    fontFamily: 'var(--sn-font-ui)',
    fontWeight: 700,
    letterSpacing: 'var(--sn-tracking-wide)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'transform var(--sn-dur-fast) var(--sn-ease), box-shadow var(--sn-dur-base) var(--sn-ease), filter var(--sn-dur-fast) var(--sn-ease)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.55rem',
    whiteSpace: 'nowrap',
    ...style,
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`sn-focusable ${className}`}
      style={merged}
      onMouseDown={(e) => { if (!disabled && !loading) e.currentTarget.style.transform = 'translateY(1px) scale(0.98)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
      {...rest}
    >
      {loading ? (
        <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'sn-spin 0.7s linear infinite' }} />
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});
