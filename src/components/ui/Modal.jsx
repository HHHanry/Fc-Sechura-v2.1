import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal accesible con focus trap, ESC y click-outside.
 * Reemplaza window.confirm() y los modales sueltos con position:fixed que abundan en el código actual.
 */
export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
}) => {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEsc) {
      e.stopPropagation();
      onClose?.();
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusables = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }, [onClose, closeOnEsc]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => dialogRef.current?.querySelector('button, [href], input, select, textarea')?.focus());
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      previousFocus.current?.focus?.();
    };
  }, [open, handleKey]);

  if (!open) return null;

  const widths = { sm: 420, md: 560, lg: 760, xl: 980 };

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--sn-bg-overlay)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 'var(--sn-z-modal)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--sn-space-4)',
        animation: 'sn-fade-in var(--sn-dur-base) var(--sn-ease)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'sn-modal-title' : undefined}
        aria-describedby={description ? 'sn-modal-desc' : undefined}
        style={{
          width: '100%',
          maxWidth: widths[size] ?? widths.md,
          maxHeight: 'calc(100dvh - 2rem)',
          background: 'var(--sn-bg-elevated)',
          color: 'var(--sn-text-primary)',
          border: '1px solid var(--sn-border-soft)',
          borderRadius: 'var(--sn-radius-xl)',
          boxShadow: 'var(--sn-shadow-lg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'sn-pop var(--sn-dur-slow) var(--sn-ease-snap)',
        }}
      >
        {(title || description) && (
          <header style={{ padding: 'var(--sn-space-5)', borderBottom: '1px solid var(--sn-border-faint)' }}>
            {title && (
              <h2 id="sn-modal-title" style={{
                margin: 0, fontFamily: 'var(--sn-font-display)',
                fontSize: 'var(--sn-fs-xl)', fontWeight: 700, letterSpacing: 'var(--sn-tracking-tight)',
                color: 'var(--sn-text-primary)',
              }}>{title}</h2>
            )}
            {description && (
              <p id="sn-modal-desc" style={{ margin: '0.4rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' }}>
                {description}
              </p>
            )}
          </header>
        )}
        <div className="sn-scroll" style={{ padding: 'var(--sn-space-5)', overflow: 'auto', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <footer style={{
            padding: 'var(--sn-space-4) var(--sn-space-5)',
            borderTop: '1px solid var(--sn-border-faint)',
            display: 'flex', justifyContent: 'flex-end', gap: 'var(--sn-space-3)',
            background: 'var(--sn-overlay-soft)',
          }}>{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
};
