import React, { useState, useEffect } from 'react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

/**
 * Tabla declarativa con definición de columnas.
 * columns: [{ key, header, align, width, render?: (row) => node }]
 * rows:    array de objetos
 *
 * En móvil (≤640px) se transforma en tarjetas apiladas: la primera columna
 * es el encabezado de la tarjeta, las del medio van como pares etiqueta/valor
 * y la columna `acciones` (key que contiene "accion"/"action") va abajo.
 */
const useIsMobile = (bp = 640) => {
  const query = `(max-width: ${bp}px)`;
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatch(e.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
    };
  }, [query]);
  return match;
};

const cell = (c, row) => (c.render ? c.render(row) : row[c.key]);
const isActionCol = (c) => /accion|action/i.test(c.key ?? '');

export const DataTable = ({
  columns,
  rows,
  loading,
  empty,
  rowKey = 'id',
  onRowClick,
  stickyHeader = true,
  zebra = true,
  size = 'md',
}) => {
  const isMobile = useIsMobile();
  const cellPadding = size === 'sm' ? '0.55rem 0.85rem' : '0.85rem 1rem';

  if (loading) {
    return (
      <div style={{ padding: 'var(--sn-space-4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={size === 'sm' ? 28 : 36} />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return empty ?? <EmptyState title="Sin registros" description="No hay datos para mostrar todavía." />;
  }

  /* ===== MÓVIL: tarjetas apiladas ===== */
  if (isMobile) {
    const primary = columns[0];
    const actions = columns.filter(isActionCol);
    const body = columns.filter((c) => c !== primary && !isActionCol(c));

    return (
      <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)', padding: 'var(--sn-space-1)' }}>
        {rows.map((row, idx) => {
          const clickable = !!onRowClick;
          const hasMore = body.length > 0 || actions.length > 0;
          return (
            <div
              key={row[rowKey] ?? idx}
              role="listitem"
              onClick={clickable ? () => onRowClick(row) : undefined}
              style={{
                border: '1px solid var(--sn-border-faint)',
                borderRadius: 'var(--sn-radius-md)',
                background: 'var(--sn-overlay-soft)',
                padding: 'var(--sn-space-4)',
                display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)',
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <div style={{ paddingBottom: hasMore ? 'var(--sn-space-3)' : 0, borderBottom: hasMore ? '1px solid var(--sn-border-faint)' : 'none' }}>
                {cell(primary, row)}
              </div>

              {body.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--sn-space-3)' }}>
                  {body.map((c) => (
                    <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: 'var(--sn-tracking-wide)', textTransform: 'uppercase', color: 'var(--sn-text-dim)' }}>
                        {c.header}
                      </span>
                      <span style={{ minWidth: 0, color: c.muted ? 'var(--sn-text-muted)' : 'var(--sn-text-primary)' }}>
                        {cell(c, row)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {actions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 'var(--sn-space-2)', paddingTop: 'var(--sn-space-3)', borderTop: '1px solid var(--sn-border-faint)' }}>
                  {actions.map((c) => (
                    <React.Fragment key={c.key}>{cell(c, row)}</React.Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ===== DESKTOP / TABLET: tabla ===== */
  return (
    <div className="sn-scroll" style={{ overflow: 'auto', borderRadius: 'var(--sn-radius-md)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontFamily: 'var(--sn-font-ui)',
          color: 'var(--sn-text-primary)',
          fontSize: 'var(--sn-fs-sm)',
        }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  position: stickyHeader ? 'sticky' : 'static',
                  top: 0,
                  background: 'var(--sn-bg-deep, rgba(7,9,15,0.92))',
                  backdropFilter: 'blur(8px)',
                  textAlign: c.align ?? 'left',
                  padding: cellPadding,
                  fontSize: 'var(--sn-fs-xs)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--sn-tracking-mega)',
                  color: 'var(--sn-text-muted)',
                  borderBottom: '1px solid var(--sn-border-soft)',
                  width: c.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row[rowKey] ?? idx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                background: zebra && idx % 2 === 1 ? 'var(--sn-row-soft)' : 'transparent',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background var(--sn-dur-fast) var(--sn-ease)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--sn-brand-glow) 8%, transparent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = zebra && idx % 2 === 1 ? 'var(--sn-row-soft)' : 'transparent'; }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: cellPadding,
                    textAlign: c.align ?? 'left',
                    borderBottom: '1px solid var(--sn-border-faint)',
                    color: c.muted ? 'var(--sn-text-muted)' : 'var(--sn-text-primary)',
                  }}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
