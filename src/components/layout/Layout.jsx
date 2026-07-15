import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

// Iconos simples SVG inline
const iconos = {
  dashboard:       '▣',
  ots:             '📋',
  documentos:      '📄',
  asignaciones:    '👥',
  actas:           '✍️',
  reservas:        '🔢',
  calendario:      '📅',
  clientes:        '🏢',
  auditoria:       '🔍',
  admin:           '⚙️',
  usuarios:        '👤',
  procedimientos:  '📐',
  acreditaciones:  '🏆',
  informes:        '📋',
  supervisor:      '🔍',
  menu:            '☰',
  salir:           '⏻',
}

const RUTAS_MENU = {
  dashboard:    '/dashboard',
  ots:          '/ots',
  asignaciones: '/asignaciones',
  actas:        '/actas',
  reservas:     '/reservas',
  calendario:   '/calendario',
  auditoria:    '/auditoria',
  admin:        '/admin',
  usuarios:     '/admin/usuarios',
}

export default function Layout({ children }) {
  const { usuario, menu, logout, esAdmin, esSupervisor, esInspector } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarAbierto, setSidebarAbierto] = useState(true)
  const [cargandoLogout, setCargandoLogout] = useState(false)

  // Modal cambiar contraseña
  const [mostrarClave, setMostrarClave]     = useState(false)
  const [nuevaClave, setNuevaClave]         = useState('')
  const [confirmarClave, setConfirmarClave] = useState('')
  const [guardandoClave, setGuardandoClave] = useState(false)
  const [msgClave, setMsgClave]             = useState('')

  async function handleCambiarClave() {
    if (nuevaClave.length < 8) { setMsgClave('❌ Mínimo 8 caracteres'); return }
    if (nuevaClave !== confirmarClave) { setMsgClave('❌ Las contraseñas no coinciden'); return }
    setGuardandoClave(true)
    setMsgClave('')
    const { error } = await supabase.auth.updateUser({ password: nuevaClave })
    if (error) {
      setMsgClave('❌ Error: ' + error.message)
    } else {
      setMsgClave('✅ Contraseña actualizada correctamente')
      setTimeout(() => { setMostrarClave(false); setNuevaClave(''); setConfirmarClave(''); setMsgClave('') }, 2000)
    }
    setGuardandoClave(false)
  }

  async function handleLogout() {
    if (!confirm('¿Cerrar sesión?')) return
    setCargandoLogout(true)
    await logout()
    navigate('/login')
  }

  function esRutaActiva(ruta) {
    return location.pathname.startsWith(ruta)
  }

  const rolColor = {
    'ADMIN':        'badge-gold',
    'ADMINISTRADOR':'badge-gold',
    'SUPERVISOR':   'badge-blue',
    'COMERCIAL':    'badge-green',
    'INSPECTOR':    'badge-amber',
    'FACTURACION':  'badge-gray',
    'AUDITOR':      'badge-purple',
  }

  const rol      = (usuario?.rol || '').toUpperCase()
  const badgeRol = rolColor[rol] || 'badge-gray'

  return (
    <div style={styles.shell}>

      {/* ─── Modal Cambiar Contraseña ────────────────────────────────── */}
      {mostrarClave && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:'28px 32px', width:340, boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin:'0 0 20px', fontSize:17, fontWeight:700, color:'var(--texto)' }}>🔑 Cambiar contraseña</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:12, color:'var(--gris)', display:'block', marginBottom:4 }}>Nueva contraseña</label>
                <input type="password" value={nuevaClave} onChange={e => setNuevaClave(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid #D0D5DD', borderRadius:6, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:'var(--gris)', display:'block', marginBottom:4 }}>Confirmar contraseña</label>
                <input type="password" value={confirmarClave} onChange={e => setConfirmarClave(e.target.value)}
                  placeholder="Repite la contraseña"
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid #D0D5DD', borderRadius:6, fontSize:13, boxSizing:'border-box' }}
                  onKeyDown={e => e.key === 'Enter' && handleCambiarClave()} />
              </div>
              {msgClave && <p style={{ margin:0, fontSize:12, color: msgClave.startsWith('✅') ? '#16A34A' : '#DC2626' }}>{msgClave}</p>}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button onClick={() => { setMostrarClave(false); setNuevaClave(''); setConfirmarClave(''); setMsgClave('') }}
                style={{ flex:1, padding:'8px', border:'1px solid #D0D5DD', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:13 }}>
                Cancelar
              </button>
              <button onClick={handleCambiarClave} disabled={guardandoClave}
                style={{ flex:1, padding:'8px', border:'none', borderRadius:6, background:'var(--azul)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {guardandoClave ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{ ...styles.sidebar, width: sidebarAbierto ? 240 : 64, minWidth: sidebarAbierto ? 240 : 64 }}>

        {/* Logo + toggle */}
        <div style={styles.sidebarHeader}>
          {sidebarAbierto && (
            <div style={styles.brandWrap}>
              <img
                src="/assets/wss-logo-horizontal-white.png"
                alt="WSS"
                style={styles.sidebarLogo}
                onError={e => {
                  if (e.target.src.includes('white')) {
                    e.target.src = '/assets/wss-logo-horizontal-transparent.png'
                    e.target.style.filter = 'brightness(0) invert(1)'
                  } else {
                    e.target.style.display = 'none'
                  }
                }}
              />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>
                Sistema de Calidad
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarAbierto(!sidebarAbierto)}
            style={styles.toggleBtn}
            title="Colapsar menú"
          >
            {iconos.menu}
          </button>
        </div>

        {/* Perfil usuario */}
        {sidebarAbierto && usuario && (
          <div style={styles.perfilBox}>
            <div style={styles.perfilAvatar}>
              {(usuario.nombre || usuario.email || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.perfilNombre}>{usuario.nombre || usuario.email}</div>
              <span className={`badge ${badgeRol}`} style={{ fontSize: 10 }}>
                {usuario.rol} · {usuario.sede}
              </span>
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav style={styles.nav}>
          <NavItem
            icono={iconos.dashboard}
            label="Dashboard"
            ruta="/dashboard"
            activo={esRutaActiva('/dashboard')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/dashboard')}
          />
          <NavItem
            icono={iconos.ots}
            label="Órdenes de Trabajo"
            ruta="/ots"
            activo={esRutaActiva('/ots')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/ots')}
          />
          <NavItem
            icono={iconos.asignaciones}
            label="Asignaciones"
            ruta="/asignaciones"
            activo={esRutaActiva('/asignaciones')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/asignaciones')}
          />
          <NavItem
            icono={iconos.actas}
            label="Actas"
            ruta="/actas"
            activo={esRutaActiva('/actas')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/actas')}
          />
          <NavItem
            icono={iconos.reservas}
            label="Reserva Informes"
            ruta="/reservas"
            activo={esRutaActiva('/reservas')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/reservas')}
          />
          <NavItem
            icono={iconos.calendario}
            label="Calendario"
            ruta="/calendario"
            activo={esRutaActiva('/calendario')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/calendario')}
          />
          {!esInspector() && (
            <NavItem
              icono={iconos.clientes}
              label="Clientes"
              ruta="/clientes"
              activo={esRutaActiva('/clientes')}
              abierto={sidebarAbierto}
              onClick={() => navigate('/clientes')}
            />
          )}
          <NavItem
            icono={iconos.procedimientos}
            label="Procedimientos"
            ruta="/procedimientos"
            activo={esRutaActiva('/procedimientos')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/procedimientos')}
          />
          <NavItem
            icono={iconos.acreditaciones}
            label="Acreditaciones"
            ruta="/acreditaciones"
            activo={esRutaActiva('/acreditaciones')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/acreditaciones')}
          />
          <NavItem
            icono={iconos.informes}
            label="Informes DII"
            ruta="/informes"
            activo={esRutaActiva('/informes')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/informes')}
          />
          {(esAdmin() || esSupervisor()) && (
            <NavItem
              icono={iconos.supervisor}
              label="Panel Supervisor"
              ruta="/supervisor"
              activo={esRutaActiva('/supervisor')}
              abierto={sidebarAbierto}
              onClick={() => navigate('/supervisor')}
            />
          )}
          <NavItem
            icono={iconos.auditoria}
            label="Auditoría"
            ruta="/auditoria"
            activo={esRutaActiva('/auditoria')}
            abierto={sidebarAbierto}
            onClick={() => navigate('/auditoria')}
          />

          {esAdmin() && (
            <>
              <div style={styles.navSeparador}>
                {sidebarAbierto && <span>Administración</span>}
              </div>
              <NavItem
                icono={iconos.usuarios}
                label="Usuarios"
                ruta="/usuarios"
                activo={esRutaActiva('/usuarios')}
                abierto={sidebarAbierto}
                onClick={() => navigate('/usuarios')}
              />
              <NavItem
                icono={iconos.admin}
                label="Configuración"
                ruta="/admin"
                activo={location.pathname === '/admin'}
                abierto={sidebarAbierto}
                onClick={() => navigate('/admin')}
              />
            </>
          )}
        </nav>

        {/* Cambiar contraseña */}
        <button
          onClick={() => setMostrarClave(true)}
          style={{ ...styles.logoutBtn, background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.7)', borderTop:'none' }}
          title="Cambiar contraseña"
        >
          <span>🔑</span>
          {sidebarAbierto && <span>Cambiar contraseña</span>}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={cargandoLogout}
          style={styles.logoutBtn}
          title="Cerrar sesión"
        >
          <span>{iconos.salir}</span>
          {sidebarAbierto && <span>Cerrar sesión</span>}
        </button>
      </aside>

      {/* ─── Contenido principal ─────────────────────────────────────── */}
      <div style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
              WSS · División Inspección Industrial
            </h2>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', background: 'rgba(255,255,255,.1)', padding: '2px 8px', borderRadius: 999 }}>
              PRODUCTION
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {usuario && (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
                {usuario.nombre || usuario.email}
              </span>
            )}
          </div>
        </header>

        {/* Página */}
        <main style={styles.content}>
          {children}
        </main>
      </div>
    </div>
  )
}

function NavItem({ icono, label, activo, abierto, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.navItem,
        background:  activo ? 'rgba(255,255,255,.15)' : 'transparent',
        borderLeft:  activo ? '3px solid #fff' : '3px solid transparent',
        justifyContent: abierto ? 'flex-start' : 'center',
      }}
      title={!abierto ? label : undefined}
    >
      <span style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>{icono}</span>
      {abierto && <span style={{ fontSize: 13, fontWeight: activo ? 700 : 400 }}>{label}</span>}
    </button>
  )
}

const styles = {
  shell: {
    display:    'flex',
    minHeight:  '100vh',
  },
  sidebar: {
    background: 'linear-gradient(180deg, #0E2A45 0%, #17395C 100%)',
    display:        'flex',
    flexDirection:  'column',
    transition:     'width .2s ease, min-width .2s ease',
    position:       'sticky',
    top:            0,
    height:         '100vh',
    flexShrink:     0,
    overflow:       'hidden',
    zIndex:         10,
  },
  sidebarHeader: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '16px 14px',
    borderBottom:   '1px solid rgba(255,255,255,.1)',
    minHeight:      70,
  },
  brandWrap: {
    flex: 1,
  },
  sidebarLogo: {
    maxWidth:    160,
    maxHeight:   44,
    width:       'auto',
    height:      'auto',
    objectFit:   'contain',
    display:     'block',
  },
  toggleBtn: {
    background:    'rgba(255,255,255,.1)',
    border:        'none',
    color:         '#fff',
    width:         32,
    height:        32,
    borderRadius:  8,
    fontSize:      16,
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    flexShrink:    0,
  },
  perfilBox: {
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    padding:     '12px 14px',
    borderBottom:'1px solid rgba(255,255,255,.1)',
  },
  perfilAvatar: {
    width:         34,
    height:        34,
    borderRadius:  '50%',
    background:    'rgba(255,255,255,.2)',
    color:         '#fff',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    fontWeight:    700,
    fontSize:      15,
    flexShrink:    0,
  },
  perfilNombre: {
    fontSize:     12,
    fontWeight:   600,
    color:        '#fff',
    whiteSpace:   'nowrap',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
  },
  nav: {
    flex:      1,
    overflowY: 'auto',
    padding:   '8px 0',
  },
  navItem: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    width:      '100%',
    padding:    '10px 14px',
    border:     'none',
    color:      'rgba(255,255,255,.85)',
    textAlign:  'left',
    transition: 'all .15s',
    borderRadius: 0,
  },
  navSeparador: {
    padding:       '12px 14px 4px',
    fontSize:      10,
    color:         'rgba(255,255,255,.4)',
    textTransform: 'uppercase',
    letterSpacing: '.6px',
    borderTop:     '1px solid rgba(255,255,255,.1)',
    marginTop:     4,
  },
  logoutBtn: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    padding:    '14px',
    background: 'rgba(180,35,24,.2)',
    border:     'none',
    borderTop:  '1px solid rgba(255,255,255,.1)',
    color:      '#FDA29B',
    width:      '100%',
    fontSize:   13,
    fontWeight: 600,
    cursor:     'pointer',
  },
  main: {
    flex:         1,
    display:      'flex',
    flexDirection:'column',
    minWidth:     0,
  },
  header: {
    background:    'var(--azul)',
    padding:       '0 24px',
    height:        'var(--header-h)',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'space-between',
    boxShadow:     '0 2px 8px rgba(0,0,0,.15)',
    flexShrink:    0,
    position:      'sticky',
    top:           0,
    zIndex:        9,
  },
  content: {
    flex:     1,
    padding:  '24px',
    overflow: 'auto',
  },
}
