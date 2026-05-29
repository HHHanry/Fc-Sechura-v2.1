import React from 'react';

/**
 * FilterBar — toolbar de filtros reutilizable para páginas de lista.
 * Unifica la UX de filtrado en todo el sistema (Alumnos, Caja, Historial, …).
 *
 * API declarativa:
 *   search   = { value, onChange, placeholder, ariaLabel }            // opcional
 *   filters  = [{ value, onChange, options: [{value,label}], ariaLabel }]  // opcional
 *   meta     = string mostrado a la izquierda (ej. "12 de 80 alumnos")  // opcional
 *   onReset  = () => void   // si se pasa, muestra "Limpiar filtros"
 *   children = controles extra que se colocan junto a los filtros        // opcional
 *
 * Es autocontenido: renderiza su propia superficie (no necesita envolver en Card).
 * Responsive: flex-wrap → 1 col en móvil, 2-3 por fila en tablet/iPad.
 */
export const FilterBar = ({ search, filters = [], meta, onReset, children }) => {
  const showMetaRow = meta != null || typeof onReset === 'function';

  return (
    <section className="sn-filterbar hide-on-print" aria-label="Filtros">
      <div className="sn-fb-row">
        {search && (
          <div className="sn-fb-search">
            <SearchIcon />
            <input
              className="sn-focusable sn-fb-input"
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Buscar...'}
              aria-label={search.ariaLabel ?? search.placeholder ?? 'Buscar'}
            />
            {search.value && (
              <button
                type="button"
                className="sn-focusable sn-fb-clear"
                onClick={() => search.onChange('')}
                aria-label="Limpiar búsqueda"
              >
                <XIcon />
              </button>
            )}
          </div>
        )}

        {filters.map((f, i) => (
          <select
            key={f.id ?? f.ariaLabel ?? i}
            className="sn-focusable sn-fb-select"
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            aria-label={f.ariaLabel ?? 'Filtro'}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}

        {children}
      </div>

      {showMetaRow && (
        <div className="sn-fb-meta">
          {meta != null && <span className="sn-fb-count">{meta}</span>}
          {typeof onReset === 'function' && (
            <button type="button" className="sn-focusable sn-fb-reset" onClick={onReset}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      <style>{`
        .sn-filterbar {
          background: var(--sn-bg-surface);
          border: 1px solid var(--sn-border-faint);
          border-radius: var(--sn-radius-lg);
          box-shadow: var(--sn-shadow-sm);
          padding: var(--sn-space-4);
        }
        .sn-fb-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--sn-space-3);
          align-items: center;
        }
        .sn-fb-search {
          display: flex; align-items: center; gap: 8px;
          flex: 2 1 240px; min-width: 0;
          background: var(--sn-input-bg);
          border: 1px solid var(--sn-border-soft);
          border-radius: var(--sn-radius-md);
          padding: 0 0.5rem 0 0.85rem;
          color: var(--sn-text-muted);
          transition: border-color var(--sn-dur-fast) var(--sn-ease), box-shadow var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-fb-search:focus-within {
          border-color: var(--sn-border-glow);
          box-shadow: 0 0 0 3px var(--sn-focus-ring);
        }
        .sn-fb-input {
          flex: 1; min-width: 0;
          background: transparent; border: none; outline: none;
          color: var(--sn-text-primary);
          font-family: var(--sn-font-ui); font-size: var(--sn-fs-sm);
          min-height: 44px; padding: 0;
        }
        .sn-fb-input::placeholder { color: var(--sn-text-dim); }
        .sn-fb-clear {
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; flex-shrink: 0;
          border: none; background: transparent; cursor: pointer;
          color: var(--sn-text-muted); border-radius: var(--sn-radius-sm);
          transition: color var(--sn-dur-fast) var(--sn-ease), background var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-fb-clear:hover { color: var(--sn-text-primary); background: var(--sn-row-strong); }
        .sn-fb-select {
          flex: 1 1 150px; min-width: 0;
          background: var(--sn-input-bg);
          border: 1px solid var(--sn-border-soft);
          border-radius: var(--sn-radius-md);
          color: var(--sn-text-secondary);
          font-family: var(--sn-font-ui); font-size: var(--sn-fs-sm);
          min-height: 44px; padding: 0 0.85rem;
          outline: none; cursor: pointer;
          transition: border-color var(--sn-dur-fast) var(--sn-ease), box-shadow var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-fb-select:focus-visible {
          border-color: var(--sn-border-glow);
          box-shadow: 0 0 0 3px var(--sn-focus-ring);
        }
        .sn-fb-meta {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--sn-space-3); flex-wrap: wrap;
          margin-top: var(--sn-space-3);
        }
        .sn-fb-count {
          font-size: var(--sn-fs-xs); color: var(--sn-text-muted);
          letter-spacing: var(--sn-tracking-wide); font-weight: 600;
        }
        .sn-fb-reset {
          background: transparent; border: none; cursor: pointer;
          color: var(--sn-brand-glow); font-weight: 700;
          font-size: var(--sn-fs-xs); letter-spacing: var(--sn-tracking-wide);
          font-family: var(--sn-font-ui);
          padding: 4px 6px; border-radius: var(--sn-radius-sm);
          transition: background var(--sn-dur-fast) var(--sn-ease);
        }
        .sn-fb-reset:hover { background: color-mix(in srgb, var(--sn-brand-glow) 12%, transparent); }
        @media (max-width: 575.98px) {
          .sn-fb-search, .sn-fb-select { flex-basis: 100%; }
        }
      `}</style>
    </section>
  );
};

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <path d="M6 6 18 18M18 6 6 18" />
  </svg>
);
