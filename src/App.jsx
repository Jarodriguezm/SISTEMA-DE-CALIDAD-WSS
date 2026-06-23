import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OTs from './pages/OTs'
import DetalleOT from './pages/DetalleOT'
import Auditoria from './pages/Auditoria'
import Usuarios from './pages/Usuarios'
import './styles/global.css'

function Placeholder({ titulo }) {
  return (
    <div>
      <h1>{titulo}</h1>
      <div className="alert alert-info" style={{ marginTop: 16 }}>
        Módulo en construcción — próxima fase
      </div>
    </div>
  )
}

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

      <Route path="/ots" element={
        <RutaPrivada><OTs /></RutaPrivada>
      } />

      <Route path="/ots" element={<RutaPrivada><OTs /></RutaPrivada>} />
      <Route path="/ots/:numero" element={<RutaPrivada><DetalleOT /></RutaPrivada>} />
      <Route path="/ots/:numero/editar" element={<RutaPrivada><DetalleOT /></RutaPrivada>} />
      <Route path="/asignaciones" element={<RutaPrivada><Placeholder titulo="Asignaciones" /></RutaPrivada>} />
      <Route path="/actas" element={<RutaPrivada><Placeholder titulo="Actas" /></RutaPrivada>} />
      <Route path="/reservas-informes" element={<RutaPrivada><Placeholder titulo="Reserva de Informes ESI/EAI" /></RutaPrivada>} />
      <Route path="/catalogos" element={<RutaPrivada><Placeholder titulo="Catálogos" /></RutaPrivada>} />
      <Route path="/usuarios" element={<RutaPrivada><Usuarios /></RutaPrivada>} />
      <Route path="/auditoria" element={<RutaPrivada><Auditoria /></RutaPrivada>} />
      <Route path="/admin" element={<RutaPrivada><Placeholder titulo="Administración" /></RutaPrivada>} />

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
