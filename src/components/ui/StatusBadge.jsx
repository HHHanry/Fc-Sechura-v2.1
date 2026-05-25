import React from 'react';
import { ESTADOS_ALUMNO } from '../../config/businessRules';

const fallback = { label: 'Activo', color: 'var(--sn-success)' };

export const StatusBadge = ({ value, size = 'sm', style, ...rest }) => {
  const info = ESTADOS_ALUMNO.find((e) => e.value === value) ?? fallback;
  const fontSize = size === 'lg' ? 'var(--sn-fs-sm)' : 'var(--sn-fs-xs)';
  const padding = size === 'lg' ? '0.35rem 0.8rem' : '0.22rem 0.6rem';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding,
        borderRadius: 'var(--sn-radius-pill)',
        background: `color-mix(in srgb, ${info.color} 12%, transparent)`,
        color: info.color,
        border: `1px solid color-mix(in srgb, ${info.color} 40%, transparent)`,
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
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: info.color, flexShrink: 0,
      }} />
      {info.label}
    </span>
  );
};
