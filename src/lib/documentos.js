// ============================================================
// documentos.js — Acceso seguro a archivos de Drive
//
// El endpoint /api/drive/proxy-pdf ya no sirve archivos a quien
// tenga el fileId: exige un permiso firmado y de corta duración.
// Este helper lo pide con la sesión del usuario y devuelve la URL
// lista para usar en un <iframe>, <object> o enlace.
// ============================================================
import { supabase } from './supabase'

/**
 * Pide permiso para ver un archivo de Drive.
 * @param {string} fileId
 * @returns {Promise<string>} URL firmada (vence en 10 minutos)
 * @throws {Error} si no hay sesión o el rol no tiene acceso
 */
export async function urlFirmadaDrive(fileId) {
  if (!fileId) throw new Error('Falta el identificador del archivo')

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')

  const r = await fetch('/api/drive/proxy-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileId }),
  })

  const data = await r.json().catch(() => ({}))

  if (r.status === 403) throw new Error(data.error || 'No tienes acceso a este documento')
  if (!r.ok || !data.url) throw new Error(data.error || `No se pudo abrir el documento (${r.status})`)

  return data.url
}
