// ============================================================
// Dashboard.jsx — Panel principal WSS
// ============================================================
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ── Iconos SVG inline ─────────────────────────────────────────────────────
const Ic = {
  OTs:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  Alerta:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>,
  Proceso:  () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>,
  Check:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>,
  Etapas:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  Docs:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>,
  Personas: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Acta:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"/><path d="M17.586 3.586a2 2 0 112.828 2.828L12 14.828l-4 1 1-4z"/></svg>,
  Hash:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>,
  Inf:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  Audit:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
  Cal:      () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  Drive:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  Refresh:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  Arrow:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
}

const CARDS = [
  { key: 'total_ots',             label: 'Total OTs',           ic: 'OTs',     color: '#1E3A5F', bg: '#EFF6FF', to: '/ots' },
  { key: 'ots_pendientes',        label: 'OTs Pendientes',      ic: 'Alerta',  color: '#DC2626', bg: '#FEF2F2', to: '/ots?estados=Pendiente de asignación,Sin inspector&label=Pendientes' },
  { key: 'ots_asignadas',         label: 'OTs en Proceso',      ic: 'Proceso', color: '#B45309', bg: '#FFFBEB', to: '/ots?estados=Asignado,Asignada,En proceso,Acta cargada,Informe enviado,Factura cargada&label=Asignadas' },
  { key: 'ots_cerradas',          label: 'OTs Cerradas',        ic: 'Check',   color: '#166534', bg: '#F0FDF4', to: '/documentos?filtro=completas' },
  { key: 'documentos_pendientes', label: 'Etapas Pendientes',   ic: 'Etapas',  color: '#991B1B', bg: '#FEF2F2', to: '/documentos?filtro=pendientes' },
  { key: 'documentos_cargados',   label: 'Etapas Cargadas',     ic: 'Docs',    color: '#0E7490', bg: '#ECFEFF', to: '/documentos' },
  { key: 'total_asignaciones',    label: 'Asignaciones',        ic: 'Personas',color: '#1D4ED8', bg: '#EFF6FF', to: '/asignaciones' },
  { key: 'total_actas',           label: 'Actas',               ic: 'Acta',    color: '#166534', bg: '#F0FDF4', to: '/actas' },
  { key: 'total_informes',        label: 'Informes DII',        ic: 'Inf',     color: '#6D28D9', bg: '#F5F3FF', to: '/informes' },
  { key: 'total_reservas',        label: 'Reserva Informes',    ic: 'Hash',    color: '#92400E', bg: '#FEF3C7', to: '/reservas' },
  { key: 'total_auditoria',       label: 'Registros Auditoría', ic: 'Audit',   color: '#374151', bg: '#F9FAFB', to: '/auditoria' },
]

const ACCESOS = [
  { titulo: 'Órdenes de Trabajo', desc: 'Listado completo y seguimiento de OTs',    ic: 'OTs',      to: '/ots' },
  { titulo: 'Asignaciones',       desc: 'Calendario y asignación de inspecciones',  ic: 'Cal',      to: '/asignaciones' },
  { titulo: 'Actas',              desc: 'Actas de trabajo generadas',                ic: 'Acta',     to: '/actas' },
  { titulo: 'Informes DII',       desc: 'Generación y gestión de informes',          ic: 'Inf',      to: '/informes' },
  { titulo: 'Reserva Informes',   desc: 'Números de series ESI / EAI / IVS',        ic: 'Hash',     to: '/reservas' },
  { titulo: 'Auditoría',          desc: 'Registro completo de actividad del sistema',ic: 'Audit',    to: '/auditoria' },
]

const ROLES_ADMIN = ['administrador', 'admin', 'jefe', 'supervisor', 'gerente', 'coordinador']
const SYNC_MS = 10 * 60 * 1000

export default function Dashboard() {
  const { usuario } = useAuth()
  const [data, setData]           = useState(null)
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [syncState, setSyncState] = useState({ loading: false, resultado: null, error: null })
  const [ultimaSync, setUltimaSync] = useState(null)
  const [proxSync, setProxSync]   = useState(null)
  const esAdmin = ROLES_ADMIN.includes((usuario?.rol || '').toLowerCase())

  useEffect(() => {
    cargarDashboard()
    const iv = setInterval(cargarDashboard, 60000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!esAdmin) return
    sincronizarDrive()
    const iv = setInterval(sincronizarDrive, SYNC_MS)
    return () => clearInterval(iv)
  }, [esAdmin])

  useEffect(() => {
    if (!ultimaSync) return
    const iv = setInterval(() => {
      setProxSync(Math.max(0, Math.round((SYNC_MS - (Date.now() - ultimaSync.getTime())) / 1000)))
    }, 1000)
    return () => clearInterval(iv)
  }, [ultimaSync])

  async function cargarDashboard() {
    try { setCargando(true); setError('')
      const { data, error } = await supabase.from('v_dashboard_portal').select('*').single()
      if (error) throw error
      setData(data)
    } catch (e) { setError(mensajeError(e)) }
    finally     { setCargando(false) }
  }

  async function sincronizarDrive() {
    setSyncState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/drive/sincronizar-todas', { method: 'POST' })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`)
      setSyncState({ loading: false, resultado: d, error: null })
      setUltimaSync(new Date())
      setProxSync(SYNC_MS / 1000)
      cargarDashboard()
    } catch (e) { setSyncState({ loading: false, resultado: null, error: e.message }) }
  }

  const nombre = usuario?.nombre?.split(' ')[0] || 'Usuario'
  const hoy    = new Date().toLocaleDateString('es-CL', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  const hora   = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  if (cargando && !data) return <Skeleton />
  if (error && !data)    return (
    <div className="alert alert-error">
      <strong>Error cargando dashboard:</strong> {error}
      <button className="btn btn-secondary btn-sm" onClick={cargarDashboard} style={{ marginLeft:12 }}>Reintentar</button>
    </div>
  )

  return (
    <div style={{ maxWidth:1280 }}>

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div style={S.welcome}>
        <div>
          <h1 style={S.h1}>{saludo}, {nombre}</h1>
          <p style={S.sub}>
            <span className={`badge badge-${rolColor(usuario?.rol)}`} style={{ fontSize:11, marginRight:6 }}>
              {usuario?.rol}
            </span>
            {usuario?.sede && <span style={{ color:'var(--gris)', fontSize:13 }}>Sede {usuario.sede} · </span>}
            <span style={{ color:'var(--gris)', fontSize:13 }}>{capitalizar(hoy)}</span>
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={cargarDashboard}
          disabled={cargando}
          style={{ display:'flex', alignItems:'center', gap:6 }}
        >
          {cargando
            ? <><span className="spinner spinner-sm"/>Actualizando…</>
            : <><Ic.Refresh />Actualizar</>}
        </button>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div style={S.kpiGrid}>
        {CARDS.map(card => {
          const IconC = Ic[card.ic]
          return (
            <KPICard
              key={card.key}
              label={card.label}
              valor={data?.[card.key] ?? 0}
              color={card.color}
              bg={card.bg}
              to={card.to}
              icon={<IconC />}
            />
          )
        })}
      </div>

      {/* ── Acceso rápido ──────────────────────────────────────────── */}
      <div style={{ marginTop:32 }}>
        <h2 style={S.secTitle}>Acceso rápido</h2>
        <div style={S.accionGrid}>
          {ACCESOS.map(a => {
            const IconC = Ic[a.ic]
            return (
              <AccionCard key={a.to} titulo={a.titulo} desc={a.desc} icon={<IconC />} to={a.to} />
            )
          })}
        </div>
      </div>

      {/* ── Drive sync (solo admins) ───────────────────────────────── */}
      {esAdmin && (
        <div style={{ marginTop:32 }}>
          <h2 style={S.secTitle}>Sincronización Google Drive</h2>
          <div style={S.syncCard}>
            <div style={S.syncLeft}>
              <div style={S.syncIcon}><Ic.Drive /></div>
              <div>
                <div style={S.syncTitle}>Auto-sync activo · cada 10 min</div>
                <div style={S.syncSub}>
                  {ultimaSync
                    ? <>Última sync: <strong>{ultimaSync.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</strong>
                        {proxSync > 0 && <> · Próxima en <strong>{Math.floor(proxSync/60)}:{String(proxSync%60).padStart(2,'0')}</strong></>}
                      </>
                    : syncState.loading ? 'Primera sincronización en curso…' : 'Esperando primera sync…'}
                </div>
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={sincronizarDrive}
              disabled={syncState.loading}
              style={{ display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}
            >
              {syncState.loading
                ? <><span className="spinner spinner-sm"/>Sincronizando…</>
                : <><Ic.Refresh />Sync manual</>}
            </button>
          </div>

          {syncState.resultado && (
            <div className="alert alert-success" style={{ marginTop:8 }}>
              <strong>{syncState.resultado.total_ots} OTs procesadas</strong>
              {' · '}{syncState.resultado.ots_con_documentos_nuevos} con docs nuevos
              {syncState.resultado.ots_con_error > 0 && (
                <span style={{ color:'#B45309', marginLeft:8 }}>({syncState.resultado.ots_con_error} con errores)</span>
              )}
            </div>
          )}
          {syncState.error && (
            <div className="alert alert-error" style={{ marginTop:8 }}>{syncState.error}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────
function KPICard({ label, valor, color, bg, to, icon }) {
  const inner = (
    <div style={{ ...S.kpiCard, borderTop:`3px solid ${color}`, background:'#fff' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ ...S.kpiIconBox, background:bg, color }}>
          {icon}
        </div>
        <Ic.Arrow />
      </div>
      <div style={{ ...S.kpiVal, color }}>{Number(valor).toLocaleString('es-CL')}</div>
      <div style={S.kpiLabel}>{label}</div>
    </div>
  )
  return to
    ? <Link to={to} style={{ textDecoration:'none' }}>{inner}</Link>
    : inner
}

function AccionCard({ titulo, desc, icon, to }) {
  return (
    <Link to={to} style={{ textDecoration:'none' }}>
      <div style={S.accionCard}>
        <div style={S.accionIcon}>{icon}</div>
        <div style={S.accionTitle}>{titulo}</div>
        <div style={S.accionDesc}>{desc}</div>
        <div style={S.accionArrow}><Ic.Arrow /></div>
      </div>
    </Link>
  )
}

function Skeleton() {
  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <div style={S.skel(180,24,8)} />
        <div style={{ ...S.skel(280,14,6), marginTop:8 }} />
      </div>
      <div style={S.kpiGrid}>
        {Array(11).fill(0).map((_,i) => <div key={i} style={S.skelCard} className="shimmer" />)}
      </div>
    </div>
  )
}

function rolColor(rol) {
  const m = { ADMIN:'gold', ADMINISTRADOR:'gold', SUPERVISOR:'blue', INSPECTOR:'amber', COMERCIAL:'green', FACTURACION:'gray', AUDITOR:'purple' }
  return m[(rol||'').toUpperCase()] || 'gray'
}
function capitalizar(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : '' }

// ── Estilos ────────────────────────────────────────────────────────────────
const S = {
  welcome: {
    display:'flex', alignItems:'flex-start', justifyContent:'space-between',
    gap:16, marginBottom:28, flexWrap:'wrap',
  },
  h1: { fontSize:22, fontWeight:800, color:'var(--texto)', margin:0, lineHeight:1.2 },
  sub: { margin:'6px 0 0', display:'flex', alignItems:'center', flexWrap:'wrap', gap:4 },
  secTitle: { fontSize:15, fontWeight:700, color:'var(--texto)', marginBottom:14 },

  kpiGrid: {
    display:'grid',
    gridTemplateColumns:'repeat(auto-fill, minmax(170px, 1fr))',
    gap:14,
  },
  kpiCard: {
    padding:'16px 18px', borderRadius:8,
    boxShadow:'0 1px 3px rgba(0,0,0,.08)',
    border:'1px solid var(--borde)',
    cursor:'pointer',
    transition:'box-shadow .15s, transform .12s',
  },
  kpiIconBox: {
    width:36, height:36, borderRadius:8,
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0,
  },
  kpiVal: {
    fontSize:28, fontWeight:800, lineHeight:1, marginBottom:5,
  },
  kpiLabel: {
    fontSize:12, color:'var(--gris)', fontWeight:500, lineHeight:1.3,
  },

  accionGrid: {
    display:'grid',
    gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',
    gap:14,
  },
  accionCard: {
    background:'#fff',
    border:'1px solid var(--borde)',
    borderRadius:8,
    padding:'18px 20px',
    cursor:'pointer',
    transition:'box-shadow .15s, transform .12s',
    display:'flex', flexDirection:'column', gap:6,
    boxShadow:'0 1px 3px rgba(0,0,0,.06)',
    position:'relative', overflow:'hidden',
  },
  accionIcon: {
    width:36, height:36, borderRadius:8,
    background:'var(--fondo)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--azul)', marginBottom:4,
  },
  accionTitle: { fontSize:14, fontWeight:700, color:'var(--texto)' },
  accionDesc:  { fontSize:12, color:'var(--gris)', lineHeight:1.5 },
  accionArrow: { position:'absolute', top:16, right:16, color:'var(--gris)', opacity:.5 },

  syncCard: {
    background:'#fff',
    border:'1px solid var(--borde)',
    borderLeft:'4px solid var(--azul)',
    borderRadius:8,
    padding:'16px 20px',
    display:'flex', alignItems:'center', justifyContent:'space-between',
    gap:16, flexWrap:'wrap',
    boxShadow:'0 1px 3px rgba(0,0,0,.06)',
  },
  syncLeft: { display:'flex', alignItems:'center', gap:12 },
  syncIcon: {
    width:36, height:36, borderRadius:8,
    background:'#EFF6FF', color:'var(--azul)',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0,
  },
  syncTitle: { fontSize:13, fontWeight:700, color:'var(--texto)', marginBottom:3 },
  syncSub:   { fontSize:12, color:'var(--gris)' },

  skel:    (w,h,r=6) => ({ width:w, height:h, borderRadius:r, background:'var(--fondo)' }),
  skelCard: { height:100, borderRadius:8, background:'var(--fondo)' },
}
