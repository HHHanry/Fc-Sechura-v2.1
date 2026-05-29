import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

const Login              = lazy(() => import('./pages/Login'));
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const Alumnos            = lazy(() => import('./pages/Alumnos'));
const DetalleAlumno      = lazy(() => import('./pages/DetalleAlumno'));
const Asistencia         = lazy(() => import('./pages/Asistencia'));
const Historial          = lazy(() => import('./pages/Historial'));
const RegistrarPagos     = lazy(() => import('./pages/RegistrarPagos'));
const VerPagos           = lazy(() => import('./pages/VerPagos'));
const GestionUsuarios    = lazy(() => import('./pages/GestionUsuarios'));
const PerformanceStats   = lazy(() => import('./pages/PerformanceStats'));
const PizarraTactiva     = lazy(() => import('./pages/PizarraTactiva'));
const ScoutingPartidos   = lazy(() => import('./pages/ScoutingPartidos'));
const PortalJugador      = lazy(() => import('./pages/PortalJugador'));
const Convocatoria       = lazy(() => import('./pages/Convocatoria'));
const MisionesJugador    = lazy(() => import('./pages/MisionesJugador'));
const CompetenciasJugador = lazy(() => import('./pages/CompetenciasJugador'));
const CateraProyeccion   = lazy(() => import('./pages/CateraProyeccion'));
const CargaMasivaSechura = lazy(() => import('./pages/cargamasiva_sechura'));

const RouteFallback = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 'calc(100vh - var(--sn-navbar-h))', background: 'var(--sn-bg-base)',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      border: '3px solid var(--sn-border-soft)',
      borderTopColor: 'var(--sn-brand-glow)',
      animation: 'sn-spin 0.7s linear infinite',
    }} />
  </div>
);

const AppContent = () => {
  const location = useLocation();
  const mostrarNavbar = location.pathname !== '/login' && !location.pathname.startsWith('/jugador');
  const mostrarCredito = !location.pathname.startsWith('/jugador');

  return (
    <div className={`sn-app-shell${mostrarNavbar ? ' sn-with-bottom-nav' : ''}`}>
      <main className="sn-app-main">
        {mostrarNavbar && <Navbar />}

        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/jugador/:id" element={<PortalJugador />} />

            <Route path="/" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador', 'tesorero']}>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/alumnos" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador', 'tesorero']}>
                <Alumnos />
              </ProtectedRoute>
            } />

            <Route path="/perfil-alumno" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador', 'tesorero']}>
                <DetalleAlumno />
              </ProtectedRoute>
            } />
            <Route path="/perfil-alumno/:id" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador', 'tesorero']}>
                <DetalleAlumno />
              </ProtectedRoute>
            } />

            <Route path="/asistencia" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador']}>
                <Asistencia />
              </ProtectedRoute>
            } />

            <Route path="/performance" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador']}>
                <PerformanceStats />
              </ProtectedRoute>
            } />

            <Route path="/pizarra" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador']}>
                <PizarraTactiva />
              </ProtectedRoute>
            } />

            <Route path="/scouting" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador']}>
                <ScoutingPartidos />
              </ProtectedRoute>
            } />

            <Route path="/historial" element={
              <ProtectedRoute allowedRoles={['admin', 'tesorero']}>
                <Historial />
              </ProtectedRoute>
            } />

            <Route path="/registrar-pago" element={
              <ProtectedRoute allowedRoles={['admin', 'tesorero']}>
                <RegistrarPagos />
              </ProtectedRoute>
            } />

            <Route path="/ver-pagos" element={
              <ProtectedRoute allowedRoles={['admin', 'tesorero']}>
                <VerPagos />
              </ProtectedRoute>
            } />

            <Route path="/usuarios" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <GestionUsuarios />
              </ProtectedRoute>
            } />

            <Route path="/convocatoria" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador']}>
                <Convocatoria />
              </ProtectedRoute>
            } />

            <Route path="/misiones" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador']}>
                <MisionesJugador />
              </ProtectedRoute>
            } />

            <Route path="/competencias" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador']}>
                <CompetenciasJugador />
              </ProtectedRoute>
            } />

            <Route path="/cantera" element={
              <ProtectedRoute allowedRoles={['admin', 'entrenador']}>
                <CateraProyeccion />
              </ProtectedRoute>
            } />

            <Route path="/carga-masiva-sechura" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CargaMasivaSechura />
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </main>

      {mostrarCredito && (
        <footer className="sn-app-credit hide-on-print">
          Sistema creado por Hanry Zapata Fiestas
        </footer>
      )}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
