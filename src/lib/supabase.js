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
  
  const msg = error.message || error.toString()
  
  if (msg.includes('permission') || msg.includes('policy')) {
    return 'No tiene permisos para realizar esta acción'
  }
  if (msg.includes('not found') || msg.includes('no rows')) {
    return 'No se encontró el registro solicitado'
  }
  if (msg.includes('duplicate') || msg.includes('unique')) {
    return 'Ya existe un registro con esos datos'
  }
  
  return msg
}
