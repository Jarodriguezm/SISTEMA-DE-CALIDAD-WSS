// ============================================================
// AuthContext.jsx — Autenticación WSS
// SEGURIDAD: Requiere sesión Supabase Auth válida.
// No existe fallback sin contraseña. Cualquier fallo
// de auth.signInWithPassword es un error de login.
// v2: usa query directa a tabla usuarios (sin RPCs).
// ============================================================
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, mensajeError } from './supabase'

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        cargarDatosUsuario(session.user.email)
      } else {
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
      setError(null)

      // Consulta directa a tabla usuarios — NO usa funciones RPC.
      // Las funciones obtener_usuario_por_email / obtener_menu_por_email
      // no existen en Supabase y causaban un error 404 que bloqueaba el login.
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (userError) {
        // Error técnico (RLS, red, etc.) — no cerrar sesión automáticamente
        throw new Error('Error al cargar perfil de usuario: ' + (userError.message || userError.code))
      }

      if (!userData) {
        // Usuario autenticado en Auth pero sin registro en tabla usuarios
        await supabase.auth.signOut()
        throw new Error('Tu cuenta no tiene acceso al sistema. Contacta al administrador.')
      }

      // Layout.jsx construye la navegación directamente desde el rol del usuario.
      // No se necesita una tabla de menú separada.
      setUsuario(userData)
      setMenu([])
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
    setUsuario(null)
    setMenu([])
    await supabase.auth.signOut()
  }

  // ── Verificación de permisos ──────────────────────────────────────────────
  async function verificarPermiso(modulo, accion) {
    if (!usuario?.email) return false
    try {
      // Consulta directa — si la tabla permisos_roles no existe, retorna false
      const { data } = await supabase
        .from('permisos_roles')
        .select('permitido')
        .eq('rol', usuario.rol)
        .eq('modulo', modulo)
        .eq('accion', accion)
        .maybeSingle()
      return data?.permitido === true
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
