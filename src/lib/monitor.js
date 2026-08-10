// ============================================================
// monitor.js — Captura de errores del navegador
// Envía las fallas a la tabla errores_app de Supabase.
// Sin servicios de terceros y sin costo.
// ============================================================
import { supabase } from './supabase'

let usuarioActual = null
let activo        = false

// Evita inundar la base si un error se dispara en bucle
const enviados   = new Map()
const LIMITE_MIN = 5   // máximo 5 envíos del mismo error por minuto

function permitido(clave) {
  const ahora = Date.now()
  const reg   = enviados.get(clave)
  if (!reg || ahora - reg.desde > 60000) {
    enviados.set(clave, { desde: ahora, n: 1 })
    return true
  }
  if (reg.n >= LIMITE_MIN) return false
  reg.n++
  return true
}

export function setUsuarioMonitor(u) {
  usuarioActual = u?.email || null
}

export async function registrarError(tipo, mensaje, detalle) {
  try {
    if (!mensaje) return
    const msg = String(mensaje).slice(0, 500)
    const ruta = window.location?.pathname || ''
    if (!permitido(`${tipo}|${msg}|${ruta}`)) return

    await supabase.rpc('fn_registrar_error', {
      p_tipo:      tipo,
      p_mensaje:   msg,
      p_detalle:   detalle ? String(detalle).slice(0, 3000) : null,
      p_ruta:      ruta,
      p_usuario:   usuarioActual,
      p_navegador: navigator.userAgent?.slice(0, 200) || null,
    })
  } catch {
    // Si el registro falla, no hacemos nada: nunca debe romper la app
  }
}

// Envuelve una consulta de Supabase para que sus errores no pasen inadvertidos.
// Uso:  const { data } = await vigilar(supabase.from('x').select('*'), 'cargar x')
export async function vigilar(promesa, contexto = '') {
  const res = await promesa
  if (res?.error) {
    console.warn(`[${contexto}]`, res.error.message)
    registrarError('supabase', `${contexto}: ${res.error.message}`,
      JSON.stringify({ code: res.error.code, details: res.error.details }))
  }
  return res
}

export function iniciarMonitor() {
  if (activo) return
  activo = true

  // Errores de JavaScript no capturados
  window.addEventListener('error', e => {
    if (e?.message) {
      registrarError('js', e.message,
        `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}\n${e.error?.stack || ''}`)
    }
  })

  // Promesas rechazadas sin catch
  window.addEventListener('unhandledrejection', e => {
    const r = e?.reason
    registrarError('promesa', r?.message || String(r), r?.stack || null)
  })

  // Recursos que no cargan (imágenes, scripts, iframes bloqueados por CSP)
  window.addEventListener('error', e => {
    const t = e?.target
    if (t && t !== window && (t.tagName === 'IMG' || t.tagName === 'SCRIPT' || t.tagName === 'IFRAME')) {
      registrarError('recurso', `No cargó ${t.tagName}: ${t.src || t.href || 'sin origen'}`)
    }
  }, true)
}
