import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, mensajeError } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [menu, setMenu] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Verificar sesión al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        cargarDatosUsuario(session.user.email)
      } else {
        setCargando(false)
      }
    })

    // Escuchar cambios de sesión
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

      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (userError) {
        throw new Error('Error al cargar perfil de usuario: ' + (userError.message || userError.code))
      }

      if (!userData) {
        await supabase.auth.signOut()
        throw new Error('Tu cuenta no tiene acceso al sistema. Contacta al administrador.')
      }

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

  async function login(email, password) {
    try {
      setCargando(true)
      setError(null)

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        throw new Error('Usuario o contraseña incorrectos')
      }

      return { ok: true }
    } catch (err) {
      const msg = mensajeError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setCargando(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setUsuario(null)
    setMenu([])
  }

  async function verificarPermiso(modulo, accion) {
    if (!usuario?.email) return false
    try {
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

  const esAdmin = () => {
    const rol = (usuario?.rol || '').toUpperCase()
    return rol === 'ADMIN' || rol === 'ADMINISTRADOR'
  }

  const esSupervisor = () => (usuario?.rol || '').toUpperCase() === 'SUPERVISOR'
  const esComercial = () => (usuario?.rol || '').toUpperCase() === 'COMERCIAL'
  const esInspector = () => (usuario?.rol || '').toUpperCase() === 'INSPECTOR'
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
      esFacturacion
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
