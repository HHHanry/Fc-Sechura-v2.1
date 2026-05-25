import React, { useState, useMemo } from 'react';

export const TagInput = ({
  value = [],
  onChange,
  suggestions = [],
  placeholder = 'Agregar etiqueta…',
  max = 10,
}) => {
  const [input, setInput] = useState('');

  const filtered = useMemo(() => {
    const term = input.trim().toLowerCase();
    if (!term) return suggestions.filter((s) => !value.includes(s)).slice(0, 5);
    return suggestions
      .filter((s) => s.toLowerCase().includes(term) && !value.includes(s))
      .slice(0, 6);
  }, [input, suggestions, value]);

  const add = (tag) => {
    const t = tag.trim();
    if (!t || value.includes(t) || value.length >= max) return;
    onChange([...value, t]);
    setInput('');
  };

  const remove = (tag) => onChange(value.filter((t) => t !== tag));

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); add(input); }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div style={wrapStyle}>
      <div style={tagsRowStyle}>
        {value.map((tag) => (
          <span key={tag} style={chipStyle}>
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              style={chipRemoveStyle}
              aria-label={`Quitar ${tag}`}
            >×</button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length >= max ? `Máximo ${max}` : placeholder}
          disabled={value.length >= max}
          className="sn-focusable"
          style={inputStyle}
        />
      </div>
      {input.trim() && filtered.length > 0 && (
        <div style={dropdownStyle}>
          {filtered.map((s) => (
            <button
              key={s} type="button"
              onClick={() => add(s)}
              className="sn-focusable"
              style={suggestionStyle}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {!input.trim() && filtered.length > 0 && value.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {filtered.slice(0, 4).map((s) => (
            <button
              key={s} type="button"
              onClick={() => add(s)}
              style={hintChipStyle}
              className="sn-focusable"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const wrapStyle = { position: 'relative' };

const tagsRowStyle = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
  padding: '6px 8px',
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  minHeight: 44,
};

const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 8px 3px 10px',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'color-mix(in srgb, var(--sn-brand-glow) 14%, transparent)',
  border: '1px solid color-mix(in srgb, var(--sn-brand-glow) 35%, transparent)',
  color: 'var(--sn-brand-glow)',
  fontSize: 'var(--sn-fs-xs)',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const chipRemoveStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 18, height: 18, borderRadius: '50%',
  background: 'transparent', border: 'none',
  color: 'inherit', cursor: 'pointer',
  fontSize: 14, fontWeight: 700, lineHeight: 1,
  padding: 0,
};

const inputStyle = {
  flex: 1, minWidth: 100,
  border: 'none', background: 'transparent',
  outline: 'none',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)',
  padding: '4px 2px',
};

const dropdownStyle = {
  position: 'absolute', left: 0, right: 0, top: '100%',
  marginTop: 4, zIndex: 10,
  background: 'var(--sn-bg-elevated)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  boxShadow: 'var(--sn-shadow-md)',
  maxHeight: 200, overflow: 'auto',
};

const suggestionStyle = {
  width: '100%', textAlign: 'left',
  padding: '8px 12px',
  background: 'transparent', border: 'none',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  borderBottom: '1px solid var(--sn-border-faint)',
};

const hintChipStyle = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'var(--sn-bg-soft)',
  border: '1px solid var(--sn-border-faint)',
  color: 'var(--sn-text-muted)',
  fontSize: 'var(--sn-fs-xs)',
  fontWeight: 600,
  cursor: 'pointer',
};
