import React from 'react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

/**
 * Tabla declarativa con definición de columnas.
 * columns: [{ key, header, align, width, render?: (row) => node }]
 * rows:    array de objetos
 */
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
