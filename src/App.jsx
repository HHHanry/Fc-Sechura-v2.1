import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Alumnos from './pages/Alumnos';
import Asistencia from './pages/Asistencia';
import Historial from './pages/Historial';
import RegistrarPagos from './pages/RegistrarPagos';
import VerPagos from './pages/VerPagos';
import DetalleAlumno from './pages/DetalleAlumno';
import GestionUsuarios from './pages/GestionUsuarios';
import PerformanceStats from './pages/PerformanceStats';
import PizarraTactiva from './pages/PizarraTactiva';
import ScoutingPartidos from './pages/ScoutingPartidos';
import PortalJugador from './pages/PortalJugador';
import Convocatoria from './pages/Convocatoria';
import MisionesJugador from './pages/MisionesJugador';
import CompetenciasJugador from './pages/CompetenciasJugador';
import CateraProyeccion from './pages/CateraProyeccion';
import CargaMasivaSechura from './pages/cargamasiva_sechura';

const AppContent = () => {
  const location = useLocation();
  const mostrarNavbar = location.pathname !== '/login' && !location.pathname.startsWith('/jugador');
  const mostrarCredito = !location.pathname.startsWith('/jugador');

  return (
    <div className="sn-app-shell">
      <main className="sn-app-main">
        {mostrarNavbar && <Navbar />}

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
