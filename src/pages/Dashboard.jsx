import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const CARDS = [
  { key: 'total_ots',              label: 'Total OTs',              color: 'var(--azul)' },
  { key: 'ots_pendientes',         label: 'OTs Pendientes',         color: 'var(--rojo)' },
  { key: 'ots_asignadas',          label: 'OTs Asignadas',          color: 'var(--ambar)' },
  { key: 'ots_cerradas',           label: 'OTs Cerradas',           color: 'var(--verde)' },
  { key: 'documentos_pendientes',  label: 'Docs Pendientes',        color: '#7C3AED' },
  { key: 'documentos_cargados',    label: 'Docs Cargados',          color: '#0891B2' },
  { key: 'total_asignaciones',     label: 'Asignaciones',           color: 'var(--azul)' },
  { key: 'total_actas',            label: 'Actas',                  color: 'var(--verde)' },
  { key: 'total_reservas',         label: 'Reservas Informes',      color: 'var(--dorado)' },
  { key: 'total_auditoria',        label: 'Registros Auditoría',    color: 'var(--gris)' },
]

export default function Dashboard() {
  const { usuario } = useAuth()
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDashboard()
  }, [])

  async function cargarDashboard() {
    try {
      setCargando(true)
      setError('')
      const { data, error } = await supabase
        .from('v_dashboard_portal')
        .select('*')
        .single()

      if (error) throw error
      setData(data)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  if (cargando) return <EstadoCargando />
  if (error) return <EstadoError error={error} onRetry={cargarDashboard} />

  return (
    <div>
      {/* Bienvenida */}
      <div style={{ marginBottom: 24 }}>
        <h1>Bienvenido, {usuario?.nombre?.split(' ')[0] || 'Usuario'}</h1>
        <p style={{ color: 'var(--gris)', marginTop: 4 }}>
          {usuario?.rol} · Sede {usuario?.sede} · {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        {CARDS.map(card => (
          <KPICard
            key={card.key}
            label={card.label}
            valor={data?.[card.key] ?? 0}
            color={card.color}
          />
        ))}
      </div>

      {/* Acciones rápidas */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 16 }}>Acceso rápido</h2>
        <div style={styles.accionesGrid}>
          <AccionCard titulo="Ver OTs activas"    desc="Listado completo de órdenes de trabajo"       icono="📋" to="/ots" />
          <AccionCard titulo="Auditoría"           desc="Registro de todas las acciones del sistema"   icono="🔍" to="/auditoria" />
          <AccionCard titulo="Asignaciones"        desc="Calendario y asignaciones de inspecciones"    icono="👥" to="/asignaciones" />
          <AccionCard titulo="Actas emitidas"      desc="Consultar actas de trabajo generadas"         icono="✍️" to="/actas" />
          <AccionCard titulo="Reserva Informes"    desc="Gestión de números de informes ESI/EAI/IVS"   icono="🔢" to="/reservas" />
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, valor, color }) {
  return (
    <div className="card" style={{ borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>
        {Number(valor).toLocaleString('es-CL')}
      </div>
      <div style={{ fontSize: 13, color: 'var(--gris)', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

function AccionCard({ titulo, desc, icono, to }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="card" style={styles.accionCard}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>{icono}</div>
        <h3 style={{ marginBottom: 4, color: 'var(--azul)' }}>{titulo}</h3>
        <p style={{ fontSize: 13, color: 'var(--gris)', margin: 0 }}>{desc}</p>
      </div>
    </Link>
  )
}

function EstadoCargando() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ height: 28, width: 200, background: '#EAECF0', borderRadius: 8, marginBottom: 8 }} />
        <div style={{ height: 16, width: 300, background: '#F2F4F7', borderRadius: 6 }} />
      </div>
      <div style={styles.kpiGrid}>
        {Array(10).fill(0).map((_, i) => (
          <div key={i} className="card" style={{ height: 90, background: 'linear-gradient(90deg, #F2F4F7 25%, #EAECF0 50%, #F2F4F7 75%)', backgroundSize: '200% 100%' }} />
        ))}
      </div>
    </div>
  )
}

function EstadoError({ error, onRetry }) {
  return (
    <div className="alert alert-error" style={{ marginTop: 24 }}>
      <strong>Error cargando dashboard:</strong> {error}
      <button className="btn btn-secondary btn-sm" onClick={onRetry} style={{ marginLeft: 12 }}>
        Reintentar
      </button>
    </div>
  )
}

const styles = {
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 14,
  },
  accionesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 14,
  },
  accionCard: {
    cursor: 'pointer',
    transition: 'box-shadow .15s, transform .15s',
  }
}
