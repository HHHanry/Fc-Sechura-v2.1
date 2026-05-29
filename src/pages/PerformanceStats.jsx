import React, { useEffect, useMemo, useState } from 'react';
import FifaRadar from '../components/FifaRadar';
import { useAlumnos } from '../hooks/useAlumnos';
import { invalidate } from '../hooks/useFirestoreCache';
import { performanceService } from '../services/performanceService';
import { toast } from '../hooks/useToast';
import {
  CATEGORIAS, STAT_KEYS, calculateOVR, getPlayerTier,
} from '../config/businessRules';
import { Card, CardBody, Button, Badge, EmptyState } from '../components/ui';

const ATRIBUTOS = [
  { key: 'ritmo',   label: 'Ritmo / Explosividad',   short: 'PAC' },
  { key: 'tiro',    label: 'Tiro / Definición',      short: 'SHO' },
  { key: 'pase',    label: 'Pase / Visión',          short: 'PAS' },
  { key: 'regate',  label: 'Regate / Control',       short: 'DRI' },
  { key: 'defensa', label: 'Defensa / Anticipación', short: 'DEF' },
  { key: 'fisico',  label: 'Físico / Stamina',       short: 'PHY' },
];

const POSICIONES = ['Portero', 'Defensa', 'Mediocampista', 'Delantero'];
const PIERNAS    = ['Derecha', 'Izquierda', 'Ambas'];

const STATS_INICIALES = STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: 50 }), {});
const FISICOS_INICIALES = { estatura: '', peso: '', piernaHabil: 'Derecha', posicion: 'Delantero' };

const PerformanceStats = () => {
  const { alumnos } = useAlumnos();

  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [alumnoSelId, setAlumnoSelId]         = useState('');
  const [stats, setStats]                     = useState(STATS_INICIALES);
  const [datosFisicos, setDatosFisicos]       = useState(FISICOS_INICIALES);
  const [guardando, setGuardando]             = useState(false);

  const alumnosFiltrados = useMemo(
    () => alumnos
      .filter((a) => filtroCategoria === 'Todas' || a.categoria === filtroCategoria)
      .sort((a, b) => (a.apellido ?? '').localeCompare(b.apellido ?? '')),
    [alumnos, filtroCategoria],
  );

  const alumnoSel = useMemo(
    () => alumnos.find((a) => a.id === alumnoSelId) ?? null,
    [alumnos, alumnoSelId],
  );

  // Sincronizar stats/físicos al cambiar de alumno
  useEffect(() => {
    if (!alumnoSel) {
      setStats(STATS_INICIALES);
      setDatosFisicos(FISICOS_INICIALES);
      return;
    }
    const s = STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: Number(alumnoSel[k]) || 50 }), {});
    setStats(s);
    setDatosFisicos({
      estatura:    alumnoSel.estatura    ?? '',
      peso:        alumnoSel.peso        ?? '',
      piernaHabil: alumnoSel.piernaHabil ?? 'Derecha',
      posicion:    alumnoSel.posicion    ?? 'Delantero',
    });
  }, [alumnoSel]);

  const ovr  = calculateOVR(stats);
  const tier = getPlayerTier(ovr);

  const guardar = async () => {
    if (!alumnoSel) return toast.error('Selecciona un alumno primero.');
    setGuardando(true);
    try {
      await performanceService.registrarEvaluacion({
        alumnoId: alumnoSel.id,
        alumnoNombre: `${alumnoSel.apellido}, ${alumnoSel.nombre}`,
        stats,
        datosFisicos,
      });
      // Invalidar caché de alumnos para que el portal y otros refresquen
      invalidate('alumnos');
      invalidate(`alumnos:${alumnoSel.id}`);
      toast.success(`Evaluación guardada · OVR ${ovr} · ${tier.label}`);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar la evaluación.');
    } finally { setGuardando(false); }
  };

  return (
    <div style={pageBg}>
      <div style={contentWrap}>
        <header style={headerStyle}>
          <div>
            <span style={eyebrowStyle}>DEPORTIVO · LABORATORIO</span>
            <h1 style={titleStyle}>Estudio de rendimiento</h1>
            <p style={leadStyle}>
              Sliders en vivo: cada cambio se refleja al instante en la tarjeta del jugador.
            </p>
          </div>
        </header>

        <div style={mainGridStyle} className="sn-perf-grid">
          {/* === COLUMNA IZQUIERDA: PREVIEW + SELECTOR === */}
          <div style={{ position: 'sticky', top: 88, alignSelf: 'start' }}>
            <Card>
              <CardBody style={{ padding: 0 }}>
                <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5)', borderBottom: '1px solid var(--sn-border-faint)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--sn-space-3)' }}>
                    <select value={filtroCategoria} onChange={(e) => { setFiltroCategoria(e.target.value); setAlumnoSelId(''); }}
                      className="sn-focusable" style={selectStyle}>
                      <option value="Todas">Todas las cat.</option>
                      {CATEGORIAS.map((c) => <option key={c} value={c}>Cat. {c}</option>)}
                    </select>
                    <select value={alumnoSelId} onChange={(e) => setAlumnoSelId(e.target.value)}
                      className="sn-focusable" style={selectStyle}>
                      <option value="" disabled>Buscar jugador...</option>
                      {alumnosFiltrados.map((a) => <option key={a.id} value={a.id}>{a.apellido}, {a.nombre}</option>)}
                    </select>
                  </div>
                </div>

                {!alumnoSel ? (
                  <EmptyState
                    icon={<RadarIcon />}
                    title="Sin jugador"
                    description="Selecciona un alumno para iniciar la evaluación. La tarjeta se renderiza en vivo."
                  />
                ) : (
                  <div style={{ padding: 'var(--sn-space-5)' }}>
                    {/* Cabecera del jugador */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sn-space-3)' }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-lg)', fontWeight: 800, color: 'var(--sn-text-primary)', lineHeight: 1.05 }}>
                          {alumnoSel.apellido}
                        </h3>
                        <div style={{ fontSize: 'var(--sn-fs-sm)', color: 'var(--sn-text-muted)', fontWeight: 600 }}>{alumnoSel.nombre}</div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Badge tone="brand">Cat. {alumnoSel.categoria}</Badge>
                          <Badge tone="neutral">{alumnoSel.edad ?? '—'} años</Badge>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontFamily: 'var(--sn-font-display)',
                          fontSize: 'var(--sn-fs-3xl)',
                          fontWeight: 800,
                          color: tier.color,
                          textShadow: `0 0 20px ${tier.glow}`,
                          lineHeight: 1,
                        }}>{ovr}</div>
                        <Badge tone="elite" style={{ background: `${tier.color}1A`, color: tier.color, borderColor: tier.color }}>
                          {tier.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Radar en vivo */}
                    <div style={{
                      marginTop: 'var(--sn-space-4)',
                      padding: 'var(--sn-space-4)',
                      background: 'var(--sn-overlay-strong)',
                      border: `1px solid ${tier.color}33`,
                      boxShadow: `inset 0 0 60px ${tier.color}10`,
                      borderRadius: 'var(--sn-radius-lg)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      <div style={{ transform: 'scale(0.92)', transformOrigin: 'center' }}>
                        <FifaRadar stats={stats} themeColor="#f8fafc" />
                      </div>
                      <span style={{
                        position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
                        letterSpacing: 'var(--sn-tracking-mega)',
                        color: 'rgba(255,255,255,0.40)',
                      }}>
                        VISTA PREVIA · LIVE
                      </span>
                    </div>

                    {alumnoSel.ultimaEvaluacion && (
                      <div style={{ marginTop: 'var(--sn-space-3)', fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', textAlign: 'center', letterSpacing: 'var(--sn-tracking-wide)' }}>
                        Última evaluación · {alumnoSel.ultimaEvaluacion}
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* === COLUMNA DERECHA: PARÁMETROS === */}
          <Card style={{ opacity: alumnoSel ? 1 : 0.45, pointerEvents: alumnoSel ? 'auto' : 'none', transition: 'opacity var(--sn-dur-base) var(--sn-ease)' }}>
            <CardBody>
              {/* Sección 1: biometría */}
              <Section title="1. Biometría y posición">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sn-space-3)' }}>
                  <Field label="Estatura (m)">
                    <input type="number" step="0.01" name="estatura" value={datosFisicos.estatura}
                      onChange={(e) => setDatosFisicos({ ...datosFisicos, estatura: e.target.value })}
                      placeholder="1.65" className="sn-focusable" style={inputStyle} />
                  </Field>
                  <Field label="Peso (kg)">
                    <input type="number" step="0.1" name="peso" value={datosFisicos.peso}
                      onChange={(e) => setDatosFisicos({ ...datosFisicos, peso: e.target.value })}
                      placeholder="55.5" className="sn-focusable" style={inputStyle} />
                  </Field>
                  <Field label="Perfil fuerte">
                    <select value={datosFisicos.piernaHabil} onChange={(e) => setDatosFisicos({ ...datosFisicos, piernaHabil: e.target.value })}
                      className="sn-focusable" style={selectStyle}>
                      {PIERNAS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Rol táctico">
                    <select value={datosFisicos.posicion} onChange={(e) => setDatosFisicos({ ...datosFisicos, posicion: e.target.value })}
                      className="sn-focusable" style={{ ...selectStyle, color: 'var(--sn-brand-glow)', fontWeight: 700 }}>
                      {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                </div>
              </Section>

              {/* Sección 2: motor de atributos */}
              <Section
                title="2. Motor de atributos"
                action={<Badge tone="elite">OVR {ovr} · {tier.label}</Badge>}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--sn-space-4)' }}>
                  {ATRIBUTOS.map((attr) => (
                    <SliderRow
                      key={attr.key}
                      attr={attr}
                      value={stats[attr.key]}
                      onChange={(v) => setStats((prev) => ({ ...prev, [attr.key]: v }))}
                    />
                  ))}
                </div>
              </Section>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--sn-border-faint)', paddingTop: 'var(--sn-space-4)' }}>
                <Button variant="primary" size="lg" loading={guardando} disabled={!alumnoSel}
                  icon={<UploadIcon />} onClick={guardar}>
                  Publicar stats en perfil
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <style>{`
        @media (max-width: 991.98px) {
          .sn-perf-grid { grid-template-columns: 1fr !important; }
          .sn-perf-grid > div:first-child { position: static !important; }
        }
        input[type="range"].sn-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; border-radius: 999px;
          background: linear-gradient(90deg,
            var(--sn-tier-bronze) 0%,
            var(--sn-tier-silver) 35%,
            var(--sn-success)     65%,
            var(--sn-tier-elite)  100%);
          outline: none; cursor: pointer;
        }
        input[type="range"].sn-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--sn-bg-elevated);
          border: 2px solid var(--sn-brand-glow);
          box-shadow: 0 0 16px rgba(34,211,238,0.55);
          cursor: pointer; transition: transform var(--sn-dur-fast) var(--sn-ease);
        }
        input[type="range"].sn-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
        input[type="range"].sn-slider::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--sn-bg-elevated);
          border: 2px solid var(--sn-brand-glow);
          box-shadow: 0 0 16px rgba(34,211,238,0.55);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

/* ===================================================
   Sub-componentes
   =================================================== */

const Section = ({ title, action, children }) => (
  <section style={{ marginBottom: 'var(--sn-space-6)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sn-space-4)' }}>
      <h4 style={{ margin: 0, fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-text-muted)' }}>
        {title}
      </h4>
      {action}
    </div>
    {children}
  </section>
);

const Field = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <span style={fieldLabelStyle}>{label}</span>
    {children}
  </label>
);

const SliderRow = ({ attr, value, onChange }) => {
  const tone = value >= 80 ? 'success' : value >= 60 ? 'brand' : value >= 40 ? 'warn' : 'crit';
  const c = { success: 'var(--sn-success)', brand: 'var(--sn-brand-glow)', warn: 'var(--sn-warn)', crit: 'var(--sn-crit)' }[tone];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-wide)', textTransform: 'uppercase', color: 'var(--sn-text-secondary)' }}>
          <span style={{ color: 'var(--sn-text-muted)', marginRight: 8, fontFamily: 'var(--sn-font-mono)' }}>{attr.short}</span>
          {attr.label}
        </span>
        <span style={{
          minWidth: 48, padding: '2px 10px', borderRadius: 'var(--sn-radius-pill)',
          fontFamily: 'var(--sn-font-mono)', fontWeight: 800, fontSize: 'var(--sn-fs-sm)',
          background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, border: `1px solid color-mix(in srgb, ${c} 33%, transparent)`,
          textAlign: 'center',
        }}>{value}</span>
      </div>
      <input type="range" min="1" max="99" value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="sn-slider sn-focusable" />
    </div>
  );
};

const RadarIcon = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v18M3 12h18"/></svg>);
const UploadIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/></svg>);

/* === estilos === */
const pageBg = { minHeight: 'calc(100vh - var(--sn-navbar-h))', background: 'var(--sn-bg-base)', color: 'var(--sn-text-primary)', fontFamily: 'var(--sn-font-ui)' };
const contentWrap = { maxWidth: 1280, margin: '0 auto', padding: 'var(--sn-space-6) var(--sn-space-5) var(--sn-space-8)' };
const headerStyle = { marginBottom: 'var(--sn-space-5)' };
const eyebrowStyle = { fontSize: 'var(--sn-fs-xs)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'var(--sn-brand-glow)' };
const titleStyle = { margin: '0.3rem 0 0', fontFamily: 'var(--sn-font-display)', fontSize: 'var(--sn-fs-2xl)', fontWeight: 700, color: 'var(--sn-text-primary)', letterSpacing: 'var(--sn-tracking-tight)' };
const leadStyle = { margin: '0.3rem 0 0', color: 'var(--sn-text-muted)', fontSize: 'var(--sn-fs-sm)' };

const mainGridStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: 'var(--sn-space-5)', alignItems: 'start' };

const fieldLabelStyle = {
  display: 'block', marginBottom: 6,
  fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  letterSpacing: 'var(--sn-tracking-wide)',
  color: 'var(--sn-text-secondary)',
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%', background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)', fontSize: 'var(--sn-fs-sm)',
  padding: '0.55rem 0.85rem', outline: 'none',
};

const selectStyle = { ...inputStyle };

export default PerformanceStats;
