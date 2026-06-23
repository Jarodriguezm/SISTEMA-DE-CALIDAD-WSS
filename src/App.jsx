import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OTs from './pages/OTs'
import './styles/global.css'

// Páginas placeholder mientras se construyen
function Placeholder({ titulo }) {
  return (
    <div>
      <h1>{titulo}</h1>
      <div className="alert alert-info" style={{ marginTop: 16 }}>
        Módulo en construcción — Fase 2 del proyecto
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

      <Route path="/ots/:numero" element={
        <RutaPrivada><Placeholder titulo="Detalle OT" /></RutaPrivada>
      } />

      <Route path="/ots/nueva" element={
        <RutaPrivada><Placeholder titulo="Nueva OT" /></RutaPrivada>
      } />

      <Route path="/asignaciones" element={
        <RutaPrivada><Placeholder titulo="Asignaciones" /></RutaPrivada>
      } />

      <Route path="/actas" element={
        <RutaPrivada><Placeholder titulo="Actas" /></RutaPrivada>
      } />

      <Route path="/reservas" element={
        <RutaPrivada><Placeholder titulo="Reserva de Informes" /></RutaPrivada>
      } />

      <Route path="/auditoria" element={
        <RutaPrivada><Placeholder titulo="Auditoría del Sistema" /></RutaPrivada>
      } />

      <Route path="/admin" element={
        <RutaPrivada><Placeholder titulo="Configuración" /></RutaPrivada>
      } />

      <Route path="/admin/usuarios" element={
        <RutaPrivada><Placeholder titulo="Gestión de Usuarios" /></RutaPrivada>
      } />

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
