// api/drive/sincronizar-todas.js
// Barre TODAS las OTs abiertas que tienen carpeta_drive_url,
// detecta las 12 subcarpetas en Drive, registra carpetas_drive
// y escanea documentos_ot en una sola operación.
//
// POST /api/drive/sincronizar-todas
// (sin body — procesa todo automáticamente)

import { createSign } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Mapping etapa num → tipo en documentos_ot
const ETAPA_NUM_A_TIPO = {
  '01': 'correo_cotizacion',
  '02': 'cotizacion',
  '03': 'envio_cotizacion',
  '04': 'orden_compra',
  '05': 'correo_oc',
  '06': null,             // automática — no genera documento
  '07': 'asignacion',
  '08': 'acta',
  '09': 'informe',
  '10': 'envio_informes',
  '11': 'sdf',
  '12': 'factura',
}

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const token = await getGoogleToken()

    const { data: ots, error: otsErr } = await supabase
      .from('ots')
      .select('ot_numero, carpeta_drive_url, carpetas_drive, estado')
      .not('carpeta_drive_url', 'is', null)
      .order('ot_numero')

    if (otsErr) return res.status(500).json({ error: 'Error consultando OTs: ' + otsErr.message })
    if (!ots?.length) return res.status(200).json({ ok: true, procesadas: 0, message: 'No hay OTs con Drive URL' })

    const resultados = []

    for (const ot of ots) {
      const resultado = { ot_numero: ot.ot_numero, estado: ot.estado }

      const mainFolderId = extraerFolderId(ot.carpeta_drive_url)
      if (!mainFolderId) {
        resultado.error = 'No se pudo extraer folder ID de carpeta_drive_url'
        resultados.push(resultado)
        continue
      }

      try {
        const subfolders = await listarSubcarpetas(token, mainFolderId)

        const carpetasDrive = {}
        for (const folder of subfolders) {
          const match = folder.name.match(/^(\d{2})\s*[-–]/)
          if (match) {
            carpetasDrive[match[1]] = {
              id:     folder.id,
              nombre: folder.name,
              url:    `https://drive.google.com/drive/folders/${folder.id}`,
            }
          }
        }

        resultado.subcarpetas_detectadas = Object.keys(carpetasDrive).length

        if (Object.keys(carpetasDrive).length > 0) {
          const { error: updErr } = await supabase
            .from('ots')
            .update({ carpetas_drive: carpetasDrive })
            .eq('ot_numero', ot.ot_numero)

          if (updErr) resultado.error_carpetas = updErr.message
          else resultado.carpetas_drive_actualizado = true
        }

        const upserts = []
        for (const [num, info] of Object.entries(carpetasDrive)) {
          const tipo = ETAPA_NUM_A_TIPO[num]
          if (!tipo) continue

          const files = await listarArchivos(token, info.id)
          if (files.length > 0) {
            const archivo = files[0]
            upserts.push({
              ot_numero:      ot.ot_numero,
              tipo,
              nombre_archivo: archivo.name,
              drive_file_id:  archivo.id || null,
              drive_url:      archivo.webViewLink || info.url,
              observacion:    `Archivos en Drive: ${files.length}. ${files.map(f => f.name).join(', ')}`,
              subido_por:     'Sincronización Drive automática',
            })
          }
        }

        if (upserts.length > 0) {
          const { error: upsertErr } = await supabase
            .from('documentos_ot')
            .upsert(upserts, { onConflict: 'ot_numero,tipo' })

          if (upsertErr) resultado.error_documentos = upsertErr.message
          else resultado.documentos_sincronizados = upserts.length
        } else {
          resultado.documentos_sincronizados = 0
        }

      } catch (err) {
        resultado.error = err.message
      }

      resultados.push(resultado)
    }

    return res.status(200).json({
      ok: true,
      total_ots: ots.length,
      ots_con_documentos_nuevos: resultados.filter(r => r.documentos_sincronizados > 0).length,
      ots_con_error: resultados.filter(r => r.error).length,
      resultados,
    })

  } catch (err) {
    console.error('[sincronizar-todas] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

function extraerFolderId(url) {
  if (!url) return null
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

async function listarSubcarpetas(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=20&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  if (d.error) throw new Error(`Drive API: ${d.error.message}`)
  return d.files || []
}

async function listarArchivos(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`)
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  if (d.error) throw new Error(`Drive API: ${d.error.message}`)
  return d.files || []
}

async function getGoogleToken() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) throw new Error('Faltan variables GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY en Vercel')
  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const header  = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const { createSign } = await import('node:crypto')
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey, 'base64url')
  const jwt = `${header}.${payload}.${signature}`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}` })
  const data = await tokenRes.json()
  if (!data.access_token) throw new Error('No se pudo obtener token: ' + JSON.stringify(data))
  return data.access_token
}

function toBase64Url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
