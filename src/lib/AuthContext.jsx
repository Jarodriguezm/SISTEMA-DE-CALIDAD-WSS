// ============================================================
// AuthContext.jsx — Autenticación WSS
// SEGURIDAD: Requiere sesión Supabase Auth válida.
// No existe fallback sin contraseña. Cualquier fallo
// de auth.signInWithPassword es un error de login.
// ============================================================
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, rpc, mensajeError } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario]   = useState(null)
  const [menu, setMenu]         = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    // Verificar sesión al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        cargarDatosUsuario(session.user.email)
      } else {
        setCargando(false)
      }
    })

    // Escuchar cambios de sesión (login / logout / expiración)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED ocurre al volver a la pestaña — no recargamos datos
      // porque eso pone cargando:true y desmonta los modales abiertos
      if (event === 'TOKEN_REFRESHED') return
      if (session?.user) {
        cargarDatosUsuario(session.user.email)
      } else {
        // Sesión cerrada o expirada → limpiar estado
        setUsuario(null)
        setMenu([])
        setCargando(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function cargarDatosUsuario(email) {
    try {
      setCargando(true)

      // Obtener perfil del usuario desde tabla usuarios
      const perfil = await rpc('obtener_usuario_por_email', { p_email: email })

      if (!perfil || perfil.length === 0) {
        // Usuario autenticado en Auth pero no registrado en el sistema → cerrar sesión
        await supabase.auth.signOut()
        throw new Error('Usuario no encontrado en el sistema. Contacte al administrador.')
      }

      const userData = perfil[0] || perfil

      // Obtener menú según rol
      const menuData = await rpc('obtener_menu_por_email', { p_email: email })

      setUsuario(userData)
      setMenu(menuData || [])
      setError(null)
    } catch (err) {
      setError(mensajeError(err))
      setUsuario(null)
      setMenu([])
    } finally {
      setCargando(false)
    }
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  // SEGURIDAD: Solo acepta credenciales válidas de Supabase Auth.
  // No existe fallback sin contraseña.
  async function login(email, password) {
    try {
      setCargando(true)
      setError(null)

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        // Credenciales inválidas → error inmediato, sin bypass
        throw new Error('Correo o contraseña incorrectos.')
      }

      // Si llegamos aquí, signInWithPassword fue exitoso.
      // onAuthStateChange disparará cargarDatosUsuario automáticamente.
      return { ok: true }

    } catch (err) {
      const msg = mensajeError(err)
      setError(msg)
      setCargando(false)
      throw new Error(msg)
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async function logout() {
    // Limpiar estado local primero para UI inmediata
    setUsuario(null)
    setMenu([])
    // Luego cerrar sesión en Supabase (invalida el token)
    await supabase.auth.signOut()
  }

  // ── Verificación de permisos ──────────────────────────────────────────────
  async function verificarPermiso(modulo, accion) {
    if (!usuario?.email) return false
    try {
      const resultado = await rpc('usuario_tiene_permiso', {
        p_email:  usuario.email,
        p_modulo: modulo,
        p_accion: accion,
      })
      return !!resultado
    } catch {
      return false
    }
  }

  // ── Helpers de rol ────────────────────────────────────────────────────────
  const esAdmin       = () => { const r = (usuario?.rol || '').toUpperCase(); return r === 'ADMIN' || r === 'ADMINISTRADOR' }
  const esSupervisor  = () => (usuario?.rol || '').toUpperCase() === 'SUPERVISOR'
  const esComercial   = () => (usuario?.rol || '').toUpperCase() === 'COMERCIAL'
  const esInspector   = () => (usuario?.rol || '').toUpperCase() === 'INSPECTOR'
  const esFacturacion = () => (usuario?.rol || '').toUpperCase() === 'FACTURACION'
  const esAuditor     = () => (usuario?.rol || '').toUpperCase() === 'AUDITOR'

  return (
    <AuthContext.Provider value={{
      usuario,
      menu,
      cargando,
      error,
      login,
      logout,
      verificarPermiso,
      esAdmin,
      esSupervisor,
      esComercial,
      esInspector,
      esFacturacion,
      esAuditor,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
