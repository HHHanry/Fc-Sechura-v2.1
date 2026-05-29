import React from 'react';
import { createPortal } from 'react-dom';
import { useToasts, toast } from '../../hooks/useToast';

const variantTone = {
  success: { color: 'var(--sn-success)', bg: 'var(--sn-success-soft)', border: 'color-mix(in srgb, var(--sn-success) 45%, transparent)', icon: '✓' },
  error:   { color: 'var(--sn-crit)',    bg: 'var(--sn-crit-soft)',    border: 'color-mix(in srgb, var(--sn-crit) 45%, transparent)',    icon: '✕' },
  warn:    { color: 'var(--sn-warn)',    bg: 'var(--sn-warn-soft)',    border: 'color-mix(in srgb, var(--sn-warn) 45%, transparent)',    icon: '!' },
  info:    { color: 'var(--sn-info)',    bg: 'var(--sn-info-soft)',    border: 'color-mix(in srgb, var(--sn-info) 45%, transparent)',    icon: 'i' },
};

export const ToastProvider = () => {
  const items = useToasts();
  if (!items.length) return null;
  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed', top: 'var(--sn-space-5)', right: 'var(--sn-space-5)',
        zIndex: 'var(--sn-z-toast)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)',
        pointerEvents: 'none',
        maxWidth: 'min(380px, calc(100vw - 32px))',
      }}
    >
      {items.map((t) => {
        const v = variantTone[t.variant] ?? variantTone.info;
        return (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: 'auto',
              background: 'var(--sn-bg-elevated)',
              backgroundImage: `linear-gradient(0deg, ${v.bg}, ${v.bg})`,
              border: `1px solid ${v.border}`,
              borderLeft: `3px solid ${v.color}`,
              borderRadius: 'var(--sn-radius-md)',
              padding: 'var(--sn-space-4)',
              color: 'var(--sn-text-primary)',
              boxShadow: 'var(--sn-shadow-md)',
              display: 'flex', alignItems: 'flex-start', gap: 'var(--sn-space-3)',
              animation: 'sn-slide-down var(--sn-dur-base) var(--sn-ease-out)',
            }}
          >
            <span aria-hidden style={{
              flex: '0 0 auto', width: 26, height: 26, borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: v.color, color: '#06121A', fontWeight: 900, fontSize: 14,
            }}>{v.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {t.title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.title}</div>}
              <div style={{ fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-secondary)', lineHeight: 1.4 }}>
                {t.message}
              </div>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              aria-label="Cerrar notificación"
              className="sn-focusable"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--sn-text-muted)', padding: 4, borderRadius: 6,
              }}
            >✕</button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
};
