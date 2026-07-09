// api/drive/sincronizar-todas.js — procesamiento paralelo
// POST /api/drive/sincronizar-todas  (sin body)

import { createSign } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ETAPA_NUM_A_TIPO = {
  '01': 'correo_cotizacion',
  '02': 'cotizacion',
  '03': 'envio_cotizacion',
  '04': 'orden_compra',
  '05': 'correo_oc',
  '06': null,
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
    if (!ots?.length) return res.status(200).json({ ok: true, total_ots: 0, message: 'No hay OTs con Drive URL' })

    // Procesar todas las OTs en paralelo
    const settled = await Promise.allSettled(ots.map(ot => procesarOT(token, ot)))

    const resultados = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      return { ot_numero: ots[i].ot_numero, error: r.reason?.message || 'Error desconocido' }
    })

    const conDocumentos = resultados.filter(r => (r.documentos_sincronizados || 0) > 0)
    const conError      = resultados.filter(r => r.error)

    return res.status(200).json({
      ok: true,
      total_ots: ots.length,
      ots_con_documentos_nuevos: conDocumentos.length,
      ots_con_error: conError.length,
      resultados,
    })

  } catch (err) {
    console.error('[sincronizar-todas] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── Procesar una OT (subcarpetas + archivos en paralelo) ──────────────────────

async function procesarOT(token, ot) {
  const resultado = { ot_numero: ot.ot_numero, estado: ot.estado }

  const mainFolderId = extraerFolderId(ot.carpeta_drive_url)
  if (!mainFolderId) {
    resultado.error = 'No se pudo extraer folder ID'
    return resultado
  }

  // 1. Subcarpetas
  const subfolders = await listarSubcarpetas(token, mainFolderId)
  const carpetasDrive = {}
  for (const folder of subfolders) {
    const match = folder.name.match(/^(\d{2})\s*[-\u2013]/)
    if (match) {
      carpetasDrive[match[1]] = {
        id:     folder.id,
        nombre: folder.name,
        url:    `https://drive.google.com/drive/folders/${folder.id}`,
      }
    }
  }

  resultado.subcarpetas_detectadas = Object.keys(carpetasDrive).length

  // 2. Guardar carpetas_drive si encontramos subcarpetas
  if (Object.keys(carpetasDrive).length > 0) {
    const { error: updErr } = await supabase
      .from('ots')
      .update({ carpetas_drive: carpetasDrive })
      .eq('ot_numero', ot.ot_numero)
    if (updErr) resultado.error_carpetas = updErr.message
    else resultado.carpetas_drive_actualizado = true
  }

  // 3. Escanear archivos de todas las etapas en paralelo
  const etapas = Object.entries(carpetasDrive).filter(([num]) => ETAPA_NUM_A_TIPO[num])
  const archivosSettled = await Promise.allSettled(
    etapas.map(([num, info]) =>
      listarArchivos(token, info.id).then(files => ({ num, info, files }))
    )
  )

  const upserts = []
  for (const r of archivosSettled) {
    if (r.status !== 'fulfilled') continue
    const { num, info, files } = r.value
    const tipo = ETAPA_NUM_A_TIPO[num]
    if (!tipo || files.length === 0) continue
    const archivo = files[0]
    upserts.push({
      ot_numero:      ot.ot_numero,
      tipo,
      nombre_archivo: archivo.name,
      drive_file_id:  archivo.id || null,
      drive_url:      archivo.webViewLink || info.url,
      observacion:    `Archivos en Drive: ${files.length}. ${files.map(f => f.name).join(', ')}`,
      subido_por:     'Sincronizacion Drive automatica',
    })
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

  return resultado
}

// ── Helpers Drive ─────────────────────────────────────────────────────────────

function extraerFolderId(url) {
  if (!url) return null
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

async function listarSubcarpetas(token, folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=20&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  if (d.error) throw new Error(`Drive API subfolders: ${d.error.message}`)
  return d.files || []
}

async function listarArchivos(token, folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`
  )
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  if (d.error) throw new Error(`Drive API files: ${d.error.message}`)
  return d.files || []
}

// ── Google Auth ───────────────────────────────────────────────────────────────

async function getGoogleToken() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error('Faltan variables GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY en Vercel')
  }

  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const header  = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({
    iss:   email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey, 'base64url')

  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const data = await tokenRes.json()
  if (!data.access_token) throw new Error('No se pudo obtener token de Google: ' + JSON.stringify(data))
  return data.access_token
}

function toBase64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
