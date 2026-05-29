import React from 'react';
import { EmptyState } from '../../components/ui';

const trackStyle = {
  height: 8,
  borderRadius: 'var(--sn-radius-pill)',
  background: 'var(--sn-track-bg, rgba(148,163,184,0.12))',
  overflow: 'hidden',
};

/* ─── Donut: distribución por estado ─── */

export const EstadoDonut = ({ segments, size = 180 }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <EmptyState title="Sin datos" description="No hay alumnos para graficar." />;

  const r = 62;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const arcs = segments.filter(s => s.value > 0).reduce((acc, seg) => {
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dashLen : 0;
    const dashLen = (seg.value / total) * circumference;
    acc.push({ ...seg, dashLen, offset });
    return acc;
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sn-space-5)', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sn-border-faint)" strokeWidth={18} />
        {arcs.map((arc, i) => (
          <circle
            key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color} strokeWidth={18}
            strokeDasharray={`${arc.dashLen} ${circumference - arc.dashLen}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '2rem', fontWeight: 800, fill: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-display)' }}>
          {total}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '0.65rem', fontWeight: 700, fill: 'var(--sn-text-muted)', letterSpacing: '0.1em' }}>
          ALUMNOS
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 110 }}>
        {arcs.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sn-fs-sm)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--sn-text-secondary)', flex: 1 }}>{seg.label}</span>
            <span style={{ fontWeight: 800, fontFamily: 'var(--sn-font-mono)', color: 'var(--sn-text-primary)' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Barras: última convocatoria ─── */

export const ConvocatoriaChart = ({ convocatoria }) => {
  if (!convocatoria) return <EmptyState title="Sin convocatorias" description="No hay convocatorias recientes." />;

  const convocados = convocatoria.convocados || [];
  if (convocados.length === 0 || typeof convocados[0] === 'string') {
    return <EmptyState title="Sin detalles" description="Convocatoria sin datos de disponibilidad." />;
  }

  const groups = [
    { label: 'Confirmados', key: 'confirmado', color: 'var(--sn-success)' },
    { label: 'Disponibles', key: 'disponible', color: 'var(--sn-brand-glow)' },
    { label: 'Pendientes', key: 'pendiente', color: 'var(--sn-warn)' },
    { label: 'No disponibles', key: 'no_disponible', color: 'var(--sn-crit)' },
  ];

  const total = convocados.length;
  const bars = groups.map(g => ({ ...g, value: convocados.filter(c => c.disponibilidad === g.key).length }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
      <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontWeight: 700, letterSpacing: 'var(--sn-tracking-wide)' }}>
        {convocatoria.titulo || 'Convocatoria'} — {total} convocados
      </div>
      {bars.map((bar, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-secondary)', fontWeight: 600 }}>{bar.label}</span>
            <span style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-sm)', fontWeight: 800, color: bar.color }}>{bar.value}</span>
          </div>
          <div style={trackStyle}>
            <div style={{
              height: '100%', borderRadius: 'var(--sn-radius-pill)',
              background: bar.color,
              width: total > 0 ? `${(bar.value / total) * 100}%` : '0%',
              transition: 'width var(--sn-dur-slow) var(--sn-ease)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Pipeline: potencial cantera ─── */

export const CanteraPipeline = ({ registros }) => {
  const levels = [
    { key: 'elite', label: 'Elite', color: 'var(--sn-tier-elite)' },
    { key: 'alto', label: 'Alto', color: 'var(--sn-success)' },
    { key: 'medio', label: 'Medio', color: 'var(--sn-info)' },
    { key: 'bajo', label: 'Bajo', color: 'var(--sn-text-dim)' },
  ];

  const counts = {};
  levels.forEach(l => { counts[l.key] = 0; });
  (registros || []).forEach(r => { if (counts[r.potencial] !== undefined) counts[r.potencial]++; });

  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) return <EmptyState title="Sin evaluaciones" description="No hay evaluaciones de cantera." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
      {levels.map((item, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-secondary)', fontWeight: 600 }}>{item.label}</span>
            <span style={{ fontFamily: 'var(--sn-font-mono)', fontSize: 'var(--sn-fs-sm)', fontWeight: 800 }}>{counts[item.key]}</span>
          </div>
          <div style={trackStyle}>
            <div style={{
              height: '100%', borderRadius: 'var(--sn-radius-pill)',
              background: item.color,
              width: total > 0 ? `${(counts[item.key] / total) * 100}%` : '0%',
              transition: 'width var(--sn-dur-slow) var(--sn-ease)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};
