import React from 'react';

const tones = {
  neutral: { bg: 'var(--sn-row-strong)', fg: 'var(--sn-text-secondary)', border: 'var(--sn-border-soft)' },
  brand:   { bg: 'color-mix(in srgb, var(--sn-brand-glow) 14%, transparent)',  fg: 'var(--sn-brand-glow)',     border: 'color-mix(in srgb, var(--sn-brand-glow) 40%, transparent)' },
  success: { bg: 'var(--sn-success-soft)', fg: 'var(--sn-success)',        border: 'color-mix(in srgb, var(--sn-success) 40%, transparent)' },
  warn:    { bg: 'var(--sn-warn-soft)',    fg: 'var(--sn-warn)',           border: 'color-mix(in srgb, var(--sn-warn) 40%, transparent)' },
  crit:    { bg: 'var(--sn-crit-soft)',    fg: 'var(--sn-crit)',           border: 'color-mix(in srgb, var(--sn-crit) 40%, transparent)' },
  elite:   { bg: 'color-mix(in srgb, var(--sn-tier-elite) 16%, transparent)',  fg: 'var(--sn-tier-elite)',     border: 'color-mix(in srgb, var(--sn-tier-elite) 42%, transparent)' },
  info:    { bg: 'var(--sn-info-soft)',    fg: 'var(--sn-info)',           border: 'color-mix(in srgb, var(--sn-info) 40%, transparent)' },
};

export const Badge = ({ tone = 'neutral', size = 'sm', icon, children, style, ...rest }) => {
  const t = tones[tone] ?? tones.neutral;
  const fontSize = size === 'lg' ? 'var(--sn-fs-sm)' : 'var(--sn-fs-xs)';
  const padding  = size === 'lg' ? '0.35rem 0.8rem' : '0.22rem 0.6rem';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding,
        borderRadius: 'var(--sn-radius-pill)',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        fontFamily: 'var(--sn-font-ui)',
        fontWeight: 700,
        fontSize,
        letterSpacing: 'var(--sn-tracking-wide)',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
};
