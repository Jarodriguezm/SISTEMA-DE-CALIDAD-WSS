// ============================================================
// Layout.jsx — Estructura principal WSS
// Sidebar colapsable + header + contenido
// Iconos: SVG inline (sin emojis)
// ============================================================
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import ChatWidget from '../chat/ChatWidget'

// ── Iconos SVG inline ─────────────────────────────────────────────────────
// Basado en Heroicons (MIT). Trazo consistente strokeWidth=1.5.
const Icon = {
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  OTs: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
    </svg>
  ),
  Asignaciones: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  Actas: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"/>
      <path d="M17.586 3.586a2 2 0 112.828 2.828L12 14.828l-4 1 1-4 8.586-8.242z"/>
    </svg>
  ),
  Reservas: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
    </svg>
  ),
  Calendario: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  ),
  Clientes: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>
      <path d="M4 21V6a2 2 0 012-2h12a2 2 0 012 2v15"/>
    </svg>
  ),
  Procedimientos: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
    </svg>
  ),
  Acreditaciones: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
    </svg>
  ),
  Informes: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  ),
  Supervisor: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  Auditoria: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
    </svg>
  ),
  Usuarios: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
    </svg>
  ),
  Config: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  ),
  Menu: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  ),
  MenuClose: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 6h10M11 12h10M11 18h10M4 6l4 6-4 6"/>
    </svg>
  ),
  Logout: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
    </svg>
  ),
  Key: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 7a2 2 0 012 2m4-2a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
    </svg>
  ),
}

// ── Mapa de navegación ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard',     icon: 'Dashboard',     label: 'Dashboard',          ruta: '/dashboard',        rol: null },
  { id: 'ots',           icon: 'OTs',           label: 'Órdenes de Trabajo', ruta: '/ots',              rol: null },
  { id: 'asignaciones',  icon: 'Asignaciones',  label: 'Asignaciones',       ruta: '/asignaciones',     rol: null },
  { id: 'actas',         icon: 'Actas',         label: 'Actas',              ruta: '/actas',            rol: null },
  { id: 'reservas',      icon: 'Reservas',      label: 'Reserva Informes',   ruta: '/reservas',         rol: null },
  { id: 'calendario',    icon: 'Calendario',    label: 'Calendario',         ruta: '/calendario',       rol: null },
  { id: 'clientes',      icon: 'Clientes',      label: 'Clientes',           ruta: '/clientes',         rol: 'noInspector' },
  { id: 'procedimientos',icon: 'Procedimientos',label: 'Procedimientos',     ruta: '/procedimientos',   rol: null },
  { id: 'acreditaciones',icon: 'Acreditaciones',label: 'Acreditaciones',     ruta: '/acreditaciones',   rol: null },
  { id: 'informes',      icon: 'Informes',      label: 'Informes DII',       ruta: '/informes',         rol: null },
  { id: 'supervisor',    icon: 'Supervisor',    label: 'Panel Supervisor',   ruta: '/supervisor',       rol: 'adminOSup' },
  { id: 'auditoria',     icon: 'Auditoria',     label: 'Auditoría',          ruta: '/auditoria',        rol: null },
]

const NAV_ADMIN = [
  { id: 'usuarios', icon: 'Usuarios', label: 'Usuarios', ruta: '/usuarios' },
  { id: 'config',   icon: 'Config',   label: 'Configuración', ruta: '/admin' },
]

const ROL_COLOR = {
  'ADMIN':         'badge-gold',
  'ADMINISTRADOR': 'badge-gold',
  'SUPERVISOR':    'badge-blue',
  'COMERCIAL':     'badge-green',
  'INSPECTOR':     'badge-amber',
  'FACTURACION':   'badge-gray',
  'AUDITOR':       'badge-purple',
}

// ═══════════════════════════════════════════════════════════════════════════
export default function Layout({ children }) {
  const { usuario, logout, esAdmin, esSupervisor, esInspector } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [abierto, setAbierto]           = useState(true)
  const [cargandoLogout, setCargando]   = useState(false)
  const [mostrarClave, setMostrarClave] = useState(false)
  const [nuevaClave, setNuevaClave]     = useState('')
  const [confirmarClave, setConfirmar]  = useState('')
  const [guardando, setGuardando]       = useState(false)
  const [msgClave, setMsgClave]         = useState('')

  const rol      = (usuario?.rol || '').toUpperCase()
  const badgeRol = ROL_COLOR[rol] || 'badge-gray'
  const iniciales = (usuario?.nombre || usuario?.email || 'U')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  async function handleCambiarClave() {
    if (nuevaClave.length < 8) { setMsgClave('Mínimo 8 caracteres'); return }
    if (nuevaClave !== confirmarClave) { setMsgClave('Las contraseñas no coinciden'); return }
    setGuardando(true); setMsgClave('')
    const { error } = await supabase.auth.updateUser({ password: nuevaClave })
    if (error) {
      setMsgClave('Error: ' + error.message)
    } else {
      setMsgClave('Contraseña actualizada')
      setTimeout(() => { setMostrarClave(false); setNuevaClave(''); setConfirmar(''); setMsgClave('') }, 1800)
    }
    setGuardando(false)
  }

  async function handleLogout() {
    if (!confirm('¿Cerrar sesión?')) return
    setCargando(true)
    await logout()
    navigate('/login')
  }

  function activo(ruta) {
    if (ruta === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(ruta)
  }

  function visible(item) {
    if (item.rol === 'noInspector') return !esInspector()
    if (item.rol === 'adminOSup')   return esAdmin() || esSupervisor()
    return true
  }

  return (
    <div style={S.shell}>

      {/* ── Modal contraseña ─────────────────────────────────────────── */}
      {mostrarClave && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>Cambiar contraseña</span>
              <button onClick={() => setMostrarClave(false)} style={S.closeBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="field-group">
                <label className="field-label">Nueva contraseña</label>
                <input type="password" value={nuevaClave}
                  onChange={e => setNuevaClave(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  style={S.modalInput} />
              </div>
              <div className="field-group">
                <label className="field-label">Confirmar contraseña</label>
                <input type="password" value={confirmarClave}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repite la contraseña"
                  style={S.modalInput}
                  onKeyDown={e => e.key === 'Enter' && handleCambiarClave()} />
              </div>
              {msgClave && (
                <div className={msgClave.startsWith('Error') ? 'alert alert-error' : (msgClave === 'Contraseña actualizada' ? 'alert alert-success' : 'alert alert-warning')}>
                  {msgClave}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:18 }}>
              <button onClick={() => setMostrarClave(false)} className="btn btn-secondary" style={{ flex:1 }}>
                Cancelar
              </button>
              <button onClick={handleCambiarClave} disabled={guardando} className="btn btn-primary" style={{ flex:1 }}>
                {guardando ? <><span className="spinner spinner-sm"/>Guardando…</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside style={{ ...S.sidebar, width: abierto ? 232 : 56, minWidth: abierto ? 232 : 56 }}>

        {/* Logo + toggle */}
        <div style={S.sidebarTop}>
          {abierto && (
            <div style={S.brandArea}>
              <img
                src="/assets/wss-logo-horizontal-white.png"
                alt="WSS"
                style={S.logo}
                onError={e => {
                  if (!e.target.dataset.tried) {
                    e.target.dataset.tried = '1'
                    e.target.src = '/assets/wss-logo-horizontal-transparent.png'
                    e.target.style.filter = 'brightness(0) invert(1)'
                  } else {
                    e.target.replaceWith(Object.assign(document.createElement('div'), {
                      textContent: 'WSS', style: 'font-size:16px;font-weight:800;color:#fff;letter-spacing:2px'
                    }))
                  }
                }}
              />
              <div style={S.brandSub}>Sistema de Calidad</div>
            </div>
          )}
          <button
            onClick={() => setAbierto(!abierto)}
            style={S.toggleBtn}
            title={abierto ? 'Colapsar menú' : 'Expandir menú'}
          >
            {abierto ? <Icon.MenuClose /> : <Icon.Menu />}
          </button>
        </div>

        {/* Perfil */}
        {abierto && usuario && (
          <div style={S.perfil}>
            <div style={S.avatar}>{iniciales}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={S.nombrePerfil}>{usuario.nombre || usuario.email}</div>
              <div style={{ marginTop:3 }}>
                <span className={`badge ${badgeRol}`} style={{ fontSize:10 }}>
                  {usuario.rol}
                  {usuario.sede ? ` · ${usuario.sede}` : ''}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav style={S.nav} aria-label="Navegación principal">
          {NAV_ITEMS.filter(visible).map(item => {
            const Ic = Icon[item.icon]
            return (
              <NavItem
                key={item.id}
                icon={<Ic />}
                label={item.label}
                active={activo(item.ruta)}
                expanded={abierto}
                onClick={() => navigate(item.ruta)}
              />
            )
          })}

          {esAdmin() && (
            <>
              {abierto && (
                <div style={S.separator}>
                  <span>Administración</span>
                </div>
              )}
              {NAV_ADMIN.map(item => {
                const Ic = Icon[item.icon]
                return (
                  <NavItem
                    key={item.id}
                    icon={<Ic />}
                    label={item.label}
                    active={activo(item.ruta)}
                    expanded={abierto}
                    onClick={() => navigate(item.ruta)}
                  />
                )
              })}
            </>
          )}
        </nav>

        {/* Pie del sidebar */}
        <div style={S.sidebarFoot}>
          <button
            onClick={() => setMostrarClave(true)}
            style={S.footBtn}
            title="Cambiar contraseña"
          >
            <Icon.Key />
            {abierto && <span>Cambiar contraseña</span>}
          </button>
          <button
            onClick={handleLogout}
            disabled={cargandoLogout}
            style={{ ...S.footBtn, ...S.logoutBtn }}
            title="Cerrar sesión"
          >
            {cargandoLogout ? <span className="spinner spinner-sm" style={{ borderTopColor:'#FDA29B' }}/> : <Icon.Logout />}
            {abierto && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── Área principal ───────────────────────────────────────────── */}
      <div style={S.main}>
        {/* Header */}
        <header style={S.header} role="banner">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={S.headerTitle}>WSS · División Inspección Industrial</span>
            <span style={S.envBadge}>PRODUCTION</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {usuario && (
              <span style={{ fontSize:13, color:'rgba(255,255,255,.8)', fontWeight:500 }}>
                {usuario.nombre || usuario.email}
              </span>
            )}
          </div>
        </header>

        {/* Contenido de la página */}
        <main style={S.content} role="main">
          {children}
        </main>
      </div>

      {/* Asistente IA flotante — disponible en toda la app */}
      <ChatWidget />
    </div>
  )
}

// ── NavItem ────────────────────────────────────────────────────────────────
function NavItem({ icon, label, active, expanded, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        width:          '100%',
        padding:        expanded ? '9px 14px' : '9px 0',
        justifyContent: expanded ? 'flex-start' : 'center',
        border:         'none',
        borderLeft:     active ? '3px solid #fff' : '3px solid transparent',
        background:     active ? 'rgba(255,255,255,.13)' : 'transparent',
        color:          active ? '#fff' : 'rgba(255,255,255,.72)',
        borderRadius:   0,
        transition:     'background .12s, color .12s',
        cursor:         'pointer',
        textAlign:      'left',
        fontSize:       13,
        fontWeight:     active ? 600 : 400,
      }}
      title={!expanded ? label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <span style={{ flexShrink:0, display:'flex' }}>{icon}</span>
      {expanded && <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>}
    </button>
  )
}

// ── Estilos ────────────────────────────────────────────────────────────────
const S = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--fondo)',
  },
  sidebar: {
    background: 'linear-gradient(180deg, #0B1E33 0%, #0E2A45 60%, #122F4F 100%)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width .2s ease, min-width .2s ease',
    position: 'sticky',
    top: 0,
    height: '100vh',
    flexShrink: 0,
    overflow: 'hidden',
    zIndex: 20,
    borderRight: '1px solid rgba(255,255,255,.06)',
  },
  sidebarTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    height: 60,
    borderBottom: '1px solid rgba(255,255,255,.08)',
    flexShrink: 0,
  },
  brandArea: { flex: 1, minWidth: 0 },
  logo: {
    maxWidth: 150,
    maxHeight: 38,
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
  },
  brandSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,.45)',
    letterSpacing: '.5px',
    textTransform: 'uppercase',
    marginTop: 3,
  },
  toggleBtn: {
    background: 'rgba(255,255,255,.08)',
    border: 'none',
    color: 'rgba(255,255,255,.8)',
    width: 32,
    height: 32,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background .12s',
  },
  perfil: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,.08)',
    flexShrink: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(255,255,255,.15)',
    border: '1.5px solid rgba(255,255,255,.25)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
    letterSpacing: '.5px',
  },
  nombrePerfil: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,.92)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 0',
  },
  separator: {
    padding: '12px 14px 4px',
    fontSize: 10,
    color: 'rgba(255,255,255,.35)',
    textTransform: 'uppercase',
    letterSpacing: '.7px',
    borderTop: '1px solid rgba(255,255,255,.07)',
    marginTop: 4,
  },
  sidebarFoot: {
    flexShrink: 0,
    borderTop: '1px solid rgba(255,255,255,.07)',
  },
  footBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 14px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,.55)',
    width: '100%',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background .12s, color .12s',
    textAlign: 'left',
  },
  logoutBtn: {
    color: '#FDA29B',
    background: 'rgba(180,35,24,.15)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },
  header: {
    background: 'var(--azul)',
    padding: '0 24px',
    height: 'var(--header-h)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 1px 4px rgba(0,0,0,.18)',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,.95)',
    letterSpacing: '.2px',
  },
  envBadge: {
    fontSize: 9,
    color: 'rgba(255,255,255,.55)',
    background: 'rgba(255,255,255,.1)',
    padding: '2px 7px',
    borderRadius: 99,
    letterSpacing: '.5px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,.55)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#fff',
    borderRadius: 10,
    padding: '24px 28px',
    width: 360,
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--texto)',
  },
  closeBtn: {
    background: 'var(--surface-2)',
    border: 'none',
    borderRadius: 6,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--gris)',
  },
  modalInput: {
    width: '100%',
    padding: '8px 11px',
    fontSize: 13,
    borderRadius: 6,
    border: '1.5px solid var(--borde-2)',
    color: 'var(--texto)',
    background: '#fff',
  },
}
