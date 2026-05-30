import React from 'react';

const TONES = {
  neutral: { dot: 'var(--sn-text-muted)',   line: 'var(--sn-border-faint)' },
  brand:   { dot: 'var(--sn-brand-glow)',    line: 'var(--sn-border-glow)' },
  success: { dot: 'var(--sn-success)',       line: 'color-mix(in srgb, var(--sn-success) 30%, transparent)' },
  warn:    { dot: 'var(--sn-warn)',          line: 'color-mix(in srgb, var(--sn-warn) 30%, transparent)' },
  crit:    { dot: 'var(--sn-crit)',          line: 'color-mix(in srgb, var(--sn-crit) 30%, transparent)' },
  elite:   { dot: 'var(--sn-tier-elite)',    line: 'color-mix(in srgb, var(--sn-tier-elite) 30%, transparent)' },
  info:    { dot: 'var(--sn-info)',          line: 'color-mix(in srgb, var(--sn-info) 30%, transparent)' },
};

export const Timeline = ({ items = [], emptyText = 'Sin eventos registrados.' }) => {
  if (items.length === 0) {
    return (
      <div style={emptyStyle}>{emptyText}</div>
    );
  }

  return (
    <div style={wrapStyle}>
      {items.map((item, i) => {
        const t = TONES[item.tone] ?? TONES.neutral;
        const isLast = i === items.length - 1;
        return (
          <div key={item.id ?? i} style={rowStyle}>
            {/* Dot + line */}
            <div style={railStyle}>
              <div style={{ ...dotStyle, background: t.dot, boxShadow: `0 0 0 3px color-mix(in srgb, ${t.dot} 20%, transparent)` }} />
              {!isLast && <div style={{ ...lineStyle, background: t.line }} />}
            </div>
            {/* Content */}
            <div style={contentStyle}>
              <div style={headerRowStyle}>
                <span style={{ fontWeight: 700, fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-primary)' }}>
                  {item.title}
                </span>
                {item.date && (
                  <span style={dateStyle}>{item.date}</span>
                )}
              </div>
              {item.description && (
                <div style={descStyle}>{item.description}</div>
              )}
              {item.badge && (
                <div style={{ marginTop: 4 }}>{item.badge}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const wrapStyle = {
  display: 'flex', flexDirection: 'column',
};

const rowStyle = {
  display: 'flex', gap: 12, minHeight: 48,
};

const railStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  width: 20, flexShrink: 0,
  paddingTop: 3,
};

const dotStyle = {
  width: 10, height: 10, borderRadius: '50%',
  flexShrink: 0,
};

const lineStyle = {
  flex: 1, width: 2, marginTop: 4,
  borderRadius: 1,
};

const contentStyle = {
  flex: 1, minWidth: 0,
  paddingBottom: 'var(--sn-space-3)',
};

const headerRowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 8, flexWrap: 'wrap',
};

const dateStyle = {
  fontSize: 'var(--sn-fs-xs)',
  fontFamily: 'var(--sn-font-mono)',
  color: 'var(--sn-text-muted)',
  fontWeight: 600,
  flexShrink: 0,
};

const descStyle = {
  marginTop: 2,
  fontSize: 'var(--sn-fs-xs)',
  color: 'var(--sn-text-muted)',
  lineHeight: 1.4,
};

const emptyStyle = {
  padding: 'var(--sn-space-4)',
  textAlign: 'center',
  color: 'var(--sn-text-muted)',
  fontSize: 'var(--sn-fs-sm)',
  fontStyle: 'italic',
};
