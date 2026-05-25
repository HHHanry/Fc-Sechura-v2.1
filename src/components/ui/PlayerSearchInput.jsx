import React, { useMemo, useState } from 'react';

export const PlayerSearchInput = ({
  alumnos = [],
  loading = false,
  selected = null,
  onSelect,
  onClear,
  placeholder,
}) => {
  const [busqueda, setBusqueda] = useState('');

  const resultados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return [];
    return alumnos
      .filter((a) => `${a.nombre} ${a.apellido} ${a.dni}`.toLowerCase().includes(term))
      .slice(0, 12);
  }, [alumnos, busqueda]);

  if (selected) {
    return (
      <div style={selectedStyle}>
        <div style={avatarStyle}>
          {(selected.nombre?.[0] ?? '?').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)' }}>
            {selected.nombre} {selected.apellido}
          </div>
          <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
            Cat. {selected.categoria ?? '—'} · DNI {selected.dni ?? '—'}
          </div>
        </div>
        <button type="button" onClick={() => { onClear(); setBusqueda(''); }} style={changeBtnStyle} className="sn-focusable">
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        autoFocus
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder={loading ? 'Cargando alumnos…' : (placeholder ?? 'Buscar por nombre, apellido o DNI')}
        className="sn-focusable"
        style={inputStyle}
      />
      {resultados.length > 0 && (
        <div style={dropdownStyle}>
          {resultados.map((a) => (
            <button
              key={a.id} type="button"
              onClick={() => { onSelect(a); setBusqueda(''); }}
              className="sn-focusable"
              style={rowStyle}
            >
              <div style={{ ...avatarStyle, width: 30, height: 30, fontSize: 12 }}>
                {(a.nombre?.[0] ?? '?').toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-sm)' }}>
                  {a.nombre} {a.apellido}
                </div>
                <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>
                  Cat. {a.categoria ?? '—'} · DNI {a.dni ?? '—'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  width: '100%', background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.6rem 0.85rem', outline: 'none',
  minHeight: 44,
};

const selectedStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 12px',
  background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)',
};

const avatarStyle = {
  width: 36, height: 36, borderRadius: '50%',
  background: 'var(--sn-brand-gradient)', color: '#06121A',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 900, fontSize: 14, flexShrink: 0,
};

const changeBtnStyle = {
  padding: '6px 12px',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'transparent',
  border: '1px solid var(--sn-border-soft)',
  color: 'var(--sn-text-secondary)',
  fontSize: 'var(--sn-fs-xs)',
  fontWeight: 700,
  cursor: 'pointer',
  flexShrink: 0,
};

const dropdownStyle = {
  position: 'absolute', left: 0, right: 0, top: '100%',
  marginTop: 4, zIndex: 10,
  border: '1px solid var(--sn-border-faint)',
  borderRadius: 'var(--sn-radius-md)', background: 'var(--sn-bg-surface)',
  maxHeight: 280, overflow: 'auto',
  boxShadow: 'var(--sn-shadow-md)',
};

const rowStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
  padding: '0.55rem 0.75rem',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--sn-border-faint)',
  cursor: 'pointer', textAlign: 'left',
};
