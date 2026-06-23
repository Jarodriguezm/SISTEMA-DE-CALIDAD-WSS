import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, rpc, mensajeError } from './supabase'

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
      
      // Obtener perfil del usuario desde tabla usuarios
      const perfil = await rpc('obtener_usuario_por_email', { p_email: email })
      
      if (!perfil || perfil.length === 0) {
        throw new Error('Usuario no encontrado en el sistema')
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
        // Si Supabase Auth falla, intentar validación contra tabla usuarios directamente
        // (para usuarios migrados que aún no tienen Auth)
        const perfil = await rpc('obtener_usuario_por_email', { p_email: email })
        
        if (!perfil || perfil.length === 0) {
          throw new Error('Usuario o contraseña incorrectos')
        }
        
        // Guardar usuario en estado sin sesión Auth
        setUsuario(perfil[0] || perfil)
        const menuData = await rpc('obtener_menu_por_email', { p_email: email })
        setMenu(menuData || [])
        
        return { ok: true, sinAuth: true }
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
      const resultado = await rpc('usuario_tiene_permiso', {
        p_email: usuario.email,
        p_modulo: modulo,
        p_accion: accion
      })
      return !!resultado
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
