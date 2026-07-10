import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const CARDS = [
  { key: 'total_ots',             label: 'Total OTs',           color: 'var(--azul)',   to: '/ots' },
  { key: 'ots_pendientes',        label: 'OTs Pendientes',      color: 'var(--rojo)',   to: '/ots?estados=Pendiente de asignación,Sin inspector&label=Pendientes' },
  { key: 'ots_asignadas',         label: 'OTs Asignadas',       color: 'var(--ambar)',  to: '/ots?estados=Asignado,Asignada,En proceso,Acta cargada,Informe enviado,Factura cargada&label=Asignadas' },
  { key: 'ots_cerradas',          label: 'OTs Cerradas',        color: 'var(--verde)',  to: '/ots?estados=Informe cargado,Cerrada documentalmente&label=Cerradas' },
  { key: 'documentos_pendientes', label: 'Docs Pendientes',     color: '#7C3AED',       to: '/ots?docs=pendientes' },
  { key: 'documentos_cargados',   label: 'Docs Cargados',       color: '#0891B2',       to: '/ots?docs=cargados' },
  { key: 'total_asignaciones',    label: 'Asignaciones',        color: 'var(--azul)',   to: '/asignaciones' },
  { key: 'total_actas',           label: 'Actas',               color: 'var(--verde)',  to: '/actas' },
  { key: 'total_reservas',        label: 'Reservas Informes',   color: 'var(--dorado)', to: '/reservas' },
  { key: 'total_auditoria',       label: 'Registros Auditoría', color: 'var(--gris)',   to: '/auditoria' },
]

const ROLES_ADMIN = ['administrador', 'admin', 'jefe', 'supervisor', 'gerente', 'coordinador']

export default function Dashboard() {
  const { usuario } = useAuth()
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [syncState, setSyncState] = useState({ loading: false, resultado: null, error: null })

  useEffect(() => {
    cargarDashboard()
    const interval = setInterval(cargarDashboard, 60000)
    return () => clearInterval(interval)
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

  async function sincronizarDrive() {
    setSyncState({ loading: true, resultado: null, error: null })
    try {
      const res = await fetch('/api/drive/sincronizar-todas', { method: 'POST' })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`)
      setSyncState({ loading: false, resultado: d, error: null })
      // Recargar KPIs para reflejar el nuevo progreso
      cargarDashboard()
    } catch (err) {
      setSyncState({ loading: false, resultado: null, error: err.message })
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
            to={card.to}
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

      {/* Panel Sincronización Drive — solo roles admin/supervisor */}
      {ROLES_ADMIN.includes((usuario?.rol || '').toLowerCase()) && (
        <div className="card" style={{ marginTop: 32, borderLeft: '4px solid var(--azul)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, marginBottom: 4 }}>Sincronización Drive</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--gris)' }}>
                Escanea todas las OTs activas, registra carpetas y documentos desde Google Drive.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={sincronizarDrive}
              disabled={syncState.loading}
              style={{ whiteSpace: 'nowrap' }}
            >
              {syncState.loading ? 'Sincronizando...' : 'Sincronizar todas las OTs'}
            </button>
          </div>

          {/* Resultado */}
          {syncState.resultado && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#F0FDF4', borderRadius: 8, fontSize: 13 }}>
              <strong style={{ color: '#166534' }}>
                Sincronización completada: {syncState.resultado.total_ots} OTs procesadas,{' '}
                {syncState.resultado.ots_con_documentos_nuevos} con documentos nuevos detectados.
              </strong>
              {syncState.resultado.ots_con_error > 0 && (
                <span style={{ color: '#B45309', marginLeft: 8 }}>
                  ({syncState.resultado.ots_con_error} con errores — revisa consola)
                </span>
              )}
            </div>
          )}
          {syncState.error && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#FEF2F2', borderRadius: 8, fontSize: 13, color: '#991B1B' }}>
              Error: {syncState.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KPICard({ label, valor, color, to }) {
  const inner = (
    <div
      className="card"
      style={{
        borderTop: `4px solid ${color}`,
        cursor: to ? 'pointer' : 'default',
        transition: 'box-shadow .15s, transform .15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (to) { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
    >
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>
        {Number(valor).toLocaleString('es-CL')}
      </div>
      <div style={{ fontSize: 13, color: 'var(--gris)', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
  return to
    ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link>
    : inner
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
