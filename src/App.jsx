import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OTs from './pages/OTs'
import DetalleOT from './pages/DetalleOT'
import Auditoria from './pages/Auditoria'
import Usuarios from './pages/Usuarios'
import Asignaciones from './pages/Asignaciones'
import Actas from './pages/Actas'
import ReservaInformes from './pages/ReservaInformes'
import Calendario from './pages/Calendario'
import Clientes from './pages/Clientes'
import Procedimientos from './pages/Procedimientos'
import Acreditaciones from './pages/Acreditaciones'
import Informes from './pages/Informes'
import NuevoInforme from './pages/NuevoInforme'
import Documentos from './pages/Documentos'
import Supervisor from './pages/Supervisor'
import './styles/global.css'

// Ruta protegida
function RutaPrivada({ children }) {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--fondo)'
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <p style={{ color: 'var(--gris)' }}>Cargando sistema WSS...</p>
      </div>
    )
  }

  if (!usuario) return <Navigate to="/login" replace />

  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { usuario, cargando } = useAuth()

  if (cargando) return null

  return (
    <Routes>
      <Route
        path="/login"
        element={usuario ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={
        <RutaPrivada><Dashboard /></RutaPrivada>
      } />

      <Route path="/ots" element={<RutaPrivada><OTs /></RutaPrivada>} />
      <Route path="/ots/:numero" element={<RutaPrivada><DetalleOT /></RutaPrivada>} />
      <Route path="/ots/:numero/editar" element={<RutaPrivada><DetalleOT /></RutaPrivada>} />

      <Route path="/asignaciones" element={<RutaPrivada><Asignaciones /></RutaPrivada>} />
      <Route path="/actas" element={<RutaPrivada><Actas /></RutaPrivada>} />
      <Route path="/reservas" element={<RutaPrivada><ReservaInformes /></RutaPrivada>} />
      <Route path="/reservas-informes" element={<RutaPrivada><ReservaInformes /></RutaPrivada>} />

      <Route path="/usuarios" element={<RutaPrivada><Usuarios /></RutaPrivada>} />
      <Route path="/calendario" element={<RutaPrivada><Calendario /></RutaPrivada>} />
      <Route path="/clientes" element={<RutaPrivada><Clientes /></RutaPrivada>} />
      <Route path="/procedimientos" element={<RutaPrivada><Procedimientos /></RutaPrivada>} />
      <Route path="/acreditaciones" element={<RutaPrivada><Acreditaciones /></RutaPrivada>} />
      <Route path="/informes" element={<RutaPrivada><Informes /></RutaPrivada>} />
      <Route path="/informes/nuevo" element={<RutaPrivada><NuevoInforme /></RutaPrivada>} />
      <Route path="/documentos" element={<RutaPrivada><Documentos /></RutaPrivada>} />

      <Route path="/supervisor" element={<RutaPrivada><Supervisor /></RutaPrivada>} />

      <Route path="/auditoria" element={<RutaPrivada><Auditoria /></RutaPrivada>} />
      <Route path="/catalogos" element={<RutaPrivada><Navigate to="/dashboard" replace /></RutaPrivada>} />
      <Route path="/admin" element={<RutaPrivada><Navigate to="/dashboard" replace /></RutaPrivada>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
