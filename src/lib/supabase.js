import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})

// ─── Helpers de autenticación ───────────────────────────────────────────────

export async function loginConEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function obtenerSesionActual() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ─── Helpers de funciones RPC ───────────────────────────────────────────────

export async function rpc(nombre, params = {}) {
  const { data, error } = await supabase.rpc(nombre, params)
  if (error) throw error
  return data
}

// ─── Manejo centralizado de errores ─────────────────────────────────────────

export function mensajeError(error) {
  if (!error) return 'Error desconocido'

  const raw = typeof error === 'string'
    ? error
    : (error.message || error.toString())

  // Mensajes vacíos o ilegibles que Supabase puede devolver cuando tiene
  // problemas de servicio o la respuesta HTTP es un JSON vacío {}
  const esIlegible = !raw
    || raw === '{}'
    || raw === '[]'
    || raw === '[object Object]'
    || raw.trim() === ''

  if (esIlegible) {
    return 'Error de conexión. Verifica tu red e intenta de nuevo.'
  }

  if (raw.includes('permission') || raw.includes('policy')) {
    return 'No tiene permisos para realizar esta acción'
  }
  if (raw.includes('not found') || raw.includes('no rows')) {
    return 'No se encontró el registro solicitado'
  }
  if (raw.includes('duplicate') || raw.includes('unique')) {
    return 'Ya existe un registro con esos datos'
  }
  if (raw.includes('rate limit') || raw.includes('too many') || raw.includes('429')) {
    return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
  }
  if (raw.includes('Invalid login credentials') || raw.includes('invalid_grant')) {
    return 'Usuario o contraseña incorrectos'
  }

  return raw
}
