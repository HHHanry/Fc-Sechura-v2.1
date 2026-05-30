import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import FifaRadar from '../components/FifaRadar';
import { useAlumno } from '../hooks/useAlumnos';
import { toast } from '../hooks/useToast';
import { calculateOVR, getPlayerTier, STAT_KEYS } from '../config/businessRules';

const PortalJugador = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { alumno, loading } = useAlumno(id);
  const [revealed, setRevealed] = useState(false);

  // Lanzar animación de revelación cuando cargue el alumno
  useEffect(() => {
    if (alumno && !revealed) {
      const t = setTimeout(() => setRevealed(true), 250);
      return () => clearTimeout(t);
    }
  }, [alumno, revealed]);

  // === Datos derivados ===
  const stats = useMemo(() => {
    if (!alumno) return {};
    const out = {};
    STAT_KEYS.forEach((k) => { out[k] = Number(alumno[k]) || 0; });
    return out;
  }, [alumno]);

  const ovr = alumno?.ovr ?? calculateOVR(stats);
  const tier = getPlayerTier(ovr);
  const tieneStats = ovr > 0;

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/login');
  };

  const compartirPerfil = async () => {
    const url = window.location.href;
    const text = `¡Mira la tarjeta oficial de ${alumno.nombre} ${alumno.apellido} en FC Sechura! ⚽`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'FC Sechura · Player Card', text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace copiado al portapapeles.');
      }
    } catch {
      // user cancelled share
    }
  };

  if (loading) {
    return (
      <div style={portalShell}>
        <div style={loadingHaloStyle}>
          <div style={spinnerRingStyle} />
          <p style={{ marginTop: 24, color: 'var(--sn-text-muted)', letterSpacing: 'var(--sn-tracking-mega)', fontSize: 'var(--sn-fs-xs)', fontWeight: 800 }}>
            CARGANDO PLAYER CARD
          </p>
        </div>
      </div>
    );
  }

  if (!alumno) {
    return (
      <div style={portalShell}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: 80, opacity: 0.3 }}>?</div>
          <h2 style={{ fontFamily: 'var(--sn-font-display)', margin: '0 0 8px' }}>Tarjeta no encontrada</h2>
          <p style={{ color: 'var(--sn-text-muted)', marginBottom: 32 }}>El código de scouting es inválido o expiró.</p>
          <button onClick={() => navigate('/login')} style={shareButtonStyle}>Ir a FC Sechura</button>
        </div>
      </div>
    );
  }

  const inicial = (alumno.nombre ?? '?').charAt(0) + (alumno.apellido ?? '').charAt(0);
  const piernaCorta = (alumno.piernaHabil ?? 'DER').substring(0, 3).toUpperCase();

  return (
    <div style={portalShell}>
      {/* Fondo dinámico */}
      <BackgroundFx tier={tier} />

      {/* Botón Regresar */}
      <button onClick={handleBack} style={backButtonStyle} className="sn-focusable" aria-label="Regresar">
        <BackIcon /> Regresar
      </button>

      <div style={containerStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--sn-space-5)', animation: revealed ? 'sn-fade-in 0.8s var(--sn-ease)' : 'none', opacity: revealed ? 1 : 0 }}>
          <img src={logo} alt="" style={{ width: 56, filter: 'drop-shadow(0 0 14px var(--sn-border-glow))', marginBottom: 8 }} />
          <h6 style={{ color: 'var(--sn-brand-glow)', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', fontSize: 'var(--sn-fs-xs)', margin: 0 }}>
            REPORTE OFICIAL · PLAYER CARD
          </h6>
        </div>

        {/* === CARTA FIFA con animación pack-opening === */}
        <div
          style={{
            ...cardWrapStyle,
            transform: revealed ? 'rotateY(0deg) scale(1)' : 'rotateY(180deg) scale(0.8)',
            opacity: revealed ? 1 : 0,
          }}
        >
          <div style={{
            ...cardStyle,
            borderColor: tier.color,
            boxShadow: `0 0 0 1px ${tier.color}, 0 30px 80px -20px ${tier.glow}, 0 0 80px ${tier.glow}`,
          }}>
            <HoloShine />

            {/* Header de la carta: OVR + posición / bandera + categoría */}
            <div style={cardHeaderStyle}>
              <div>
                <div style={{
                  fontFamily: 'var(--sn-font-display)',
                  fontSize: 'clamp(3rem, 12vw, 4rem)',
                  fontWeight: 800,
                  color: tier.color,
                  textShadow: `0 0 24px ${tier.glow}`,
                  lineHeight: 1,
                }}>
                  {tieneStats ? ovr : '—'}
                </div>
                <div style={{ fontWeight: 800, color: 'white', marginTop: 4, letterSpacing: 'var(--sn-tracking-wide)' }}>
                  {alumno.posicion ?? 'PRO'}
                </div>
                <div style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, color: tier.color, letterSpacing: 'var(--sn-tracking-mega)', marginTop: 4 }}>
                  {tier.label}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <img src="https://flagcdn.com/w40/pe.png" alt="Perú" style={{ width: 30, borderRadius: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
                <div style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 900, color: 'white', textTransform: 'uppercase', marginTop: 8, letterSpacing: 'var(--sn-tracking-wide)' }}>
                  Cat. {alumno.categoria}
                </div>
              </div>
            </div>

            {/* Foto del jugador — centrada al medio */}
            <div style={photoBlockStyle}>
              <div style={photoWrapStyle}>
                {alumno.foto ? (
                  <img src={alumno.foto} alt="" style={{ ...avatarStyle, borderColor: tier.color, boxShadow: `0 12px 40px ${tier.glow}` }} />
                ) : (
                  <div style={{ ...avatarStyle, borderColor: tier.color, boxShadow: `0 12px 40px ${tier.glow}`, background: 'linear-gradient(135deg, #1A1038, #0A0617)', color: 'rgba(255,255,255,0.7)', fontSize: 64, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {inicial}
                  </div>
                )}

                {/* Sparkles si es élite/oro */}
                {tieneStats && ovr >= 75 && <Sparkles tier={tier} />}
              </div>

              <h2 style={{
                margin: 'var(--sn-space-3) 0 0',
                fontFamily: 'var(--sn-font-display)',
                fontWeight: 900,
                color: 'white',
                textTransform: 'uppercase',
                letterSpacing: '-1px',
                fontSize: 'clamp(1.4rem, 5vw, 1.8rem)',
                lineHeight: 1.05,
                textAlign: 'center',
              }}>
                {alumno.nombre}<br />
                <span style={{ color: tier.color, textShadow: `0 0 12px ${tier.glow}` }}>{alumno.apellido}</span>
              </h2>

              {alumno.distrito && (
                <div style={{ marginTop: 8, fontSize: 'var(--sn-fs-xs)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: 'var(--sn-tracking-wide)', textAlign: 'center' }}>
                  📍 {alumno.distrito}{alumno.provincia ? ` · ${alumno.provincia}` : ''}
                </div>
              )}
            </div>

            {/* Stats físicos */}
            <div style={statsRowStyle}>
              <StatBox label="Altura" value={alumno.estatura ? `${alumno.estatura}m` : '—'} />
              <StatBox label="Peso"   value={alumno.peso     ? `${alumno.peso}kg`  : '—'} />
              <StatBox label="Pierna" value={piernaCorta} />
            </div>

            {/* Radar */}
            {tieneStats ? (
              <div style={{ marginTop: 'var(--sn-space-5)', paddingTop: 'var(--sn-space-4)', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                <h6 style={{ textAlign: 'center', fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontSize: 'var(--sn-fs-xs)', letterSpacing: 'var(--sn-tracking-mega)', marginBottom: 'var(--sn-space-3)' }}>
                  Análisis táctico
                </h6>
                <div style={{ margin: '0 auto', maxWidth: 280 }}>
                  <FifaRadar stats={stats} themeColor="#f8fafc" />
                </div>
              </div>
            ) : (
              <div style={{
                marginTop: 'var(--sn-space-5)', padding: 'var(--sn-space-4)',
                background: 'rgba(0,0,0,0.30)', border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 'var(--sn-radius-md)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--sn-fs-xs)', fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 'var(--sn-tracking-mega)' }}>
                  EVALUACIÓN PENDIENTE
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 'var(--sn-fs-sm)', color: 'rgba(255,255,255,0.55)' }}>
                  Esta tarjeta se actualizará cuando el cuerpo técnico complete la evaluación.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botón viral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)', marginTop: 'var(--sn-space-5)', opacity: revealed ? 1 : 0, transform: revealed ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.8s var(--sn-ease) 0.4s' }}>
          <button onClick={compartirPerfil} style={shareButtonStyle} className="sn-focusable">
            <ShareIcon /> Compartir tarjeta
          </button>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 'var(--sn-fs-xs)', margin: '8px 0 0' }}>
            Plataforma gestionada por el área técnica de FC Sechura.
            <br />
            <Link to="/login" style={{ color: 'var(--sn-brand-glow)', fontWeight: 700, textDecoration: 'none' }}>Acceso administrativo</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

/* =====================================================
   Sub-componentes visuales
   ===================================================== */

const BackgroundFx = ({ tier }) => (
  <>
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: `
        radial-gradient(900px 600px at 50% -10%, ${tier.color}1F, transparent 55%),
        radial-gradient(800px 500px at 80% 100%, rgba(167,139,250,0.18), transparent 60%),
        radial-gradient(700px 600px at 0% 50%, rgba(124,58,237,0.30), transparent 60%),
        var(--sn-bg-base)
      `,
    }} />
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.5,
      backgroundImage: `linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)`,
      backgroundSize: '52px 52px',
      maskImage: 'radial-gradient(circle at center, black, transparent 75%)',
    }} />
  </>
);

const HoloShine = () => (
  <span aria-hidden style={{
    position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%',
    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)',
    transform: 'skewX(-22deg)',
    animation: 'sn-holo-shine 5.5s infinite',
    pointerEvents: 'none',
  }} />
);

const StatBox = ({ label, value }) => (
  <div style={statBoxStyle}>
    <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)', color: 'rgba(167,139,250,0.92)', textTransform: 'uppercase' }}>
      {label}
    </div>
    <div style={{ fontFamily: 'var(--sn-font-display)', fontWeight: 900, color: 'white', fontSize: 'var(--sn-fs-md)', lineHeight: 1, marginTop: 4 }}>
      {value}
    </div>
  </div>
);

const Sparkles = ({ tier }) => {
  // 8 partículas posicionadas alrededor de la foto
  const positions = [
    { top: '5%',  left: '10%' }, { top: '0%',   left: '40%' }, { top: '8%',  right: '12%' },
    { top: '40%', right: '0%' }, { bottom: '5%', right: '18%' },
    { bottom: '0%', left: '38%' }, { bottom: '10%', left: '6%' }, { top: '38%', left: '0%' },
  ];
  return (
    <>
      {positions.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute', ...pos, pointerEvents: 'none',
            width: 6, height: 6, borderRadius: '50%',
            background: tier.color,
            boxShadow: `0 0 12px ${tier.color}, 0 0 24px ${tier.color}`,
            animation: `sn-sparkle 2.5s ${i * 0.18}s infinite ease-in-out`,
            opacity: 0.0,
          }}
        />
      ))}
    </>
  );
};

const ShareIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>);
const BackIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>);

/* =====================================================
   Estilos
   ===================================================== */
const portalShell = {
  minHeight: '100vh',
  background: 'var(--sn-bg-mesh)',
  fontFamily: 'var(--sn-font-ui)',
  position: 'relative',
  overflowX: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--sn-space-5) var(--sn-space-4)',
};

const containerStyle = {
  position: 'relative', zIndex: 1,
  width: '100%',
  maxWidth: 480,
  margin: '0 auto',
};

const cardWrapStyle = {
  perspective: 1200,
  transformStyle: 'preserve-3d',
  transition: 'transform 1.1s cubic-bezier(.22, 1.20, .36, 1), opacity 0.9s var(--sn-ease)',
};

const cardStyle = {
  position: 'relative',
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  border: '2px solid',
  borderRadius: 'var(--sn-radius-xl)',
  padding: 'var(--sn-space-5)',
  overflow: 'hidden',
  transition: 'box-shadow 0.6s var(--sn-ease)',
};

const cardHeaderStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  position: 'relative', zIndex: 1,
};

const avatarStyle = {
  width: 190, height: 190, borderRadius: '50%',
  border: '4px solid', objectFit: 'cover', position: 'relative', zIndex: 1,
  display: 'block',
};

const photoBlockStyle = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 'var(--sn-space-4) 0',
  width: '100%',
};

const photoWrapStyle = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
};

const backButtonStyle = {
  position: 'absolute',
  top: 'var(--sn-space-4)',
  left: 'var(--sn-space-4)',
  zIndex: 10,
  padding: '0.55rem 1rem',
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 'var(--sn-radius-pill)',
  color: 'rgba(255,255,255,0.92)',
  fontFamily: 'var(--sn-font-ui)',
  fontWeight: 700,
  fontSize: 'var(--sn-fs-sm)',
  letterSpacing: 'var(--sn-tracking-wide)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all 0.2s var(--sn-ease)',
};

const statsRowStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
  marginTop: 'var(--sn-space-3)',
};

const statBoxStyle = {
  background: 'rgba(0,0,0,0.40)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 'var(--sn-radius-md)',
  padding: 'var(--sn-space-2) var(--sn-space-2)',
  textAlign: 'center',
};

const shareButtonStyle = {
  width: '100%',
  padding: '0.95rem 1.4rem',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'linear-gradient(135deg, #7C3AED 0%, #C026D3 100%)',
  color: 'white',
  border: '1px solid var(--sn-border-glow)',
  boxShadow: '0 0 28px var(--sn-border-glow), 0 12px 30px -10px rgba(0,0,0,0.6)',
  fontFamily: 'var(--sn-font-ui)',
  fontWeight: 800,
  fontSize: 'var(--sn-fs-base)',
  letterSpacing: 'var(--sn-tracking-wide)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

const loadingHaloStyle = {
  textAlign: 'center', color: 'white',
};

const spinnerRingStyle = {
  width: 60, height: 60,
  border: '3px solid color-mix(in srgb, var(--sn-brand-glow) 22%, transparent)',
  borderTopColor: 'var(--sn-brand-glow)',
  borderRadius: '50%',
  margin: '0 auto',
  animation: 'sn-spin 0.9s linear infinite',
};

export default PortalJugador;
