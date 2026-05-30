import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import logo from '../assets/logo.png';
import { Button } from '../components/ui';
import { toast } from '../hooks/useToast';
import { useAuth } from '../context/useAuth';

const Login = () => {
  const [credenciales, setCredenciales] = useState({ email: '', password: '' });
  const [cargando, setCargando] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-redirect a / cuando AuthProvider termina de cargar el perfil tras login
  // (o cuando ya hay sesión activa al entrar a /login).
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleChange = (e) => setCredenciales({ ...credenciales, [e.target.name]: e.target.value });

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      await signInWithEmailAndPassword(auth, credenciales.email, credenciales.password);
      toast.success('Bienvenido al sistema.');
      // El redirect lo hace el useEffect cuando AuthProvider haya hidratado el user.
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential'
        ? 'Correo o contraseña incorrectos.'
        : 'No se pudo conectar con el servidor. Intenta de nuevo.';
      toast.error(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={pageStyle}>
      <BackgroundFx />

      <div style={cardStyle}>
        {/* === LADO IZQUIERDO: Identidad de marca === */}
        <aside style={brandPanelStyle} className="sn-login-brand">
          <div style={brandGlowStyle} aria-hidden />
          <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
            <div style={logoFrameStyle}>
              <img src={logo} alt="" style={{ width: 110, height: 110, objectFit: 'contain' }} />
            </div>
            <h1 style={{ ...brandTitleStyle, color: '#FFFFFF' }}>FC SECHURA</h1>
            <p style={brandSubtitleStyle}>CENTRO DE MANDO DEPORTIVO</p>
            <div style={brandQuoteStyle}>
              "Nuestra pasión marca la diferencia."
            </div>
          </div>
          <div style={brandFooterStyle}>
            <div style={dotStyle} />
            <span>Acceso restringido al staff</span>
          </div>
        </aside>

        {/* === LADO DERECHO: Formulario === */}
        <section style={formPanelStyle}>
          <div style={mobileLogoStyle} className="sn-login-mobile-logo">
            <div style={{ ...logoFrameStyle, width: 72, height: 72 }}>
              <img src={logo} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
            </div>
            <h2 style={{ ...brandTitleStyle, fontSize: '1.4rem', marginTop: 12 }}>FC SECHURA</h2>
          </div>

          <header style={{ marginBottom: 'var(--sn-space-6)' }}>
            <span style={eyebrowStyle}>ACCESO SEGURO</span>
            <h2 style={titleStyle}>Inicia sesión.</h2>
            <p style={leadStyle}>Ingresa con tus credenciales oficiales para entrar al panel.</p>
          </header>

          <form onSubmit={handleLogin} noValidate>
            <Field
              label="Correo electrónico"
              icon={<EnvelopeIcon />}
              type="email"
              name="email"
              autoComplete="email"
              value={credenciales.email}
              onChange={handleChange}
              placeholder="staff@fcsechura.com"
              required
            />

            <Field
              label="Contraseña"
              icon={<LockIcon />}
              type={verPass ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={credenciales.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              right={
                <button
                  type="button"
                  onClick={() => setVerPass((v) => !v)}
                  aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="sn-focusable"
                  style={togglePassStyle}
                >
                  {verPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={cargando}
              style={{ width: '100%', marginTop: 'var(--sn-space-4)' }}
            >
              {cargando ? 'Verificando...' : 'Entrar al sistema'}
            </Button>
          </form>

          <footer style={footerNoteStyle}>
            <span style={dotStyle} /> Conexión cifrada · Auth.firebase
          </footer>
        </section>
      </div>

      <style>{`
        .sn-login-input::placeholder { color: var(--sn-text-dim); }
        @media (max-width: 768px) {
          .sn-login-brand { display: none !important; }
          .sn-login-mobile-logo { display: flex !important; }
        }
        @media (min-width: 769px) {
          .sn-login-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
};

/* =========================================================
   Sub-componentes y estilos locales
   ========================================================= */

const Field = ({ label, icon, right, ...inputProps }) => (
  <label style={{ display: 'block', marginBottom: 'var(--sn-space-4)' }}>
    <span style={fieldLabelStyle}>{label}</span>
    <div style={inputWrapStyle} className="sn-input-wrap">
      <span style={inputIconStyle} aria-hidden>{icon}</span>
      <input
        {...inputProps}
        className="sn-login-input sn-focusable"
        style={inputStyle}
        onFocus={(e) => { e.target.parentElement.style.borderColor = 'var(--sn-brand-glow)'; e.target.parentElement.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--sn-brand-glow) 22%, transparent)'; }}
        onBlur={(e)  => { e.target.parentElement.style.borderColor = 'var(--sn-border-soft)'; e.target.parentElement.style.boxShadow = 'none'; }}
      />
      {right}
    </div>
  </label>
);

const BackgroundFx = () => (
  <>
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: `
        radial-gradient(800px 500px at 20% 20%, color-mix(in srgb, var(--sn-brand-glow) 14%, transparent), transparent 60%),
        radial-gradient(700px 600px at 85% 80%, rgba(37, 99, 235,0.30), transparent 55%),
        var(--sn-bg-base)
      `,
    }} />
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.40,
      backgroundImage: `linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)`,
      backgroundSize: '48px 48px',
      maskImage: 'radial-gradient(circle at center, black, transparent 75%)',
    }} />
  </>
);

/* === Iconos inline (cero dependencias nuevas) === */
const EnvelopeIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>);
const LockIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>);
const EyeIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>);
const EyeOffIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.6 6.1A10.4 10.4 0 0 1 12 6c6.5 0 10 6 10 6a17.7 17.7 0 0 1-3.1 4.2"/><path d="M6.1 6.1C3.7 7.6 2 10 2 12c0 0 3.5 6 10 6a10.6 10.6 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>);

/* === Estilos === */
const pageStyle = {
  minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'var(--sn-space-5)',
  background: 'var(--sn-bg-mesh)',
  position: 'relative',
  fontFamily: 'var(--sn-font-ui)',
};

const cardStyle = {
  position: 'relative', zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)',
  width: 'min(960px, 100%)',
  borderRadius: 'var(--sn-radius-xl)',
  overflow: 'hidden',
  background: 'var(--sn-bg-surface)',
  border: '1px solid var(--sn-border-soft)',
  boxShadow: 'var(--sn-shadow-lg), 0 0 0 1px color-mix(in srgb, var(--sn-brand-glow) 12%, transparent)',
  animation: 'sn-pop var(--sn-dur-page) var(--sn-ease-snap)',
};

const brandPanelStyle = {
  position: 'relative',
  padding: 'var(--sn-space-7) var(--sn-space-6)',
  background: 'linear-gradient(160deg, #0F1B33 0%, #070C18 50%, #1E3A8A 130%)',
  color: '#EDF2FB',
  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  borderRight: '1px solid var(--sn-border-faint)',
  minHeight: 520,
  overflow: 'hidden',
};

const brandGlowStyle = {
  position: 'absolute', inset: 0,
  background: 'radial-gradient(420px 260px at 30% 30%, rgba(96, 165, 250,0.22), transparent 60%)',
  pointerEvents: 'none',
};

const logoFrameStyle = {
  width: 130, height: 130,
  borderRadius: 'var(--sn-radius-xl)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--sn-border-glow)',
  boxShadow: 'var(--sn-shadow-glow)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  marginBottom: 'var(--sn-space-5)',
  backdropFilter: 'blur(8px)',
};

const brandTitleStyle = {
  margin: 0,
  fontFamily: 'var(--sn-font-display)',
  fontSize: 'var(--sn-fs-3xl)', fontWeight: 800,
  letterSpacing: '0.04em',
  color: 'var(--sn-text-primary)',
  textShadow: '0 6px 24px color-mix(in srgb, var(--sn-brand-glow) 38%, transparent)',
};

const brandSubtitleStyle = {
  marginTop: 'var(--sn-space-2)',
  fontSize: 'var(--sn-fs-xs)',
  fontWeight: 800, letterSpacing: 'var(--sn-tracking-mega)',
  color: '#93C5FD',
};

const brandQuoteStyle = {
  marginTop: 'var(--sn-space-5)',
  padding: 'var(--sn-space-4)',
  borderLeft: '2px solid #60A5FA',
  fontStyle: 'italic',
  color: 'rgba(237, 242, 251,0.84)',
  fontSize: 'var(--sn-fs-sm)',
  background: 'rgba(96, 165, 250,0.10)',
  borderRadius: '0 var(--sn-radius-md) var(--sn-radius-md) 0',
  textAlign: 'left',
};

const brandFooterStyle = {
  position: 'relative', zIndex: 1,
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 'var(--sn-fs-xs)', color: 'rgba(237, 242, 251,0.72)',
  letterSpacing: 'var(--sn-tracking-wide)',
};

const dotStyle = {
  width: 8, height: 8, borderRadius: '50%',
  background: 'var(--sn-success)',
  boxShadow: '0 0 0 4px rgba(16,185,129,0.18)',
  animation: 'sn-pulse-glow 2s var(--sn-ease) infinite',
};

const formPanelStyle = {
  padding: 'var(--sn-space-7) var(--sn-space-6)',
  background: 'var(--sn-bg-surface)',
  display: 'flex', flexDirection: 'column', justifyContent: 'center',
};

const mobileLogoStyle = {
  display: 'none',
  flexDirection: 'column', alignItems: 'center',
  marginBottom: 'var(--sn-space-5)',
  paddingBottom: 'var(--sn-space-5)',
  borderBottom: '1px solid var(--sn-border-faint)',
};

const eyebrowStyle = {
  display: 'inline-block',
  fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
  letterSpacing: 'var(--sn-tracking-mega)',
  color: 'var(--sn-brand-glow)',
};

const titleStyle = {
  margin: '0.4rem 0 0',
  fontFamily: 'var(--sn-font-display)',
  fontSize: 'var(--sn-fs-2xl)', fontWeight: 700,
  color: 'var(--sn-text-primary)',
  letterSpacing: 'var(--sn-tracking-tight)',
};

const leadStyle = {
  margin: '0.4rem 0 0',
  color: 'var(--sn-text-muted)',
  fontSize: 'var(--sn-fs-sm)',
};

const fieldLabelStyle = {
  display: 'block', marginBottom: 6,
  fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  letterSpacing: 'var(--sn-tracking-wide)',
  color: 'var(--sn-text-secondary)',
  textTransform: 'uppercase',
};

const inputWrapStyle = {
  display: 'flex', alignItems: 'center',
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  transition: 'border-color var(--sn-dur-fast) var(--sn-ease), box-shadow var(--sn-dur-fast) var(--sn-ease)',
  overflow: 'hidden',
};

const inputIconStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 0.6rem 0 0.85rem',
  color: 'var(--sn-text-muted)',
};

const inputStyle = {
  flex: 1,
  background: 'transparent',
  border: 'none', outline: 'none',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-base)',
  padding: '0.85rem 0.85rem 0.85rem 0.4rem',
};

const togglePassStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--sn-text-muted)', padding: '0 0.85rem',
  display: 'inline-flex', alignItems: 'center',
};

const footerNoteStyle = {
  marginTop: 'var(--sn-space-6)',
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 'var(--sn-fs-xs)',
  color: 'var(--sn-text-dim)',
  letterSpacing: 'var(--sn-tracking-wide)',
};

export default Login;
