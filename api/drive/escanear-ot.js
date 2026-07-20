// api/drive/escanear-ot.js
// Escanea las carpetas de Google Drive asociadas a una OT,
// registra/actualiza documentos_ot en Supabase.
// Si carpetas_drive está vacío, lo descubre automáticamente.
//
// POST /api/drive/escanear-ot  { ot_numero: "OT062628781" }

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ot_numero } = req.body || {}
  if (!ot_numero) return res.status(400).json({ error: 'ot_numero es requerido' })

  try {
    const { data: ot, error: otErr } = await supabase
      .from('ots')
      .select('ot_numero, carpeta_drive_url, carpetas_drive')
      .eq('ot_numero', ot_numero)
      .single()

    if (otErr || !ot) return res.status(404).json({ error: `OT ${ot_numero} no encontrada` })

    let carpetas = typeof ot.carpetas_drive === 'string'
      ? JSON.parse(ot.carpetas_drive)
      : (ot.carpetas_drive || {})

    const token = await getGoogleToken()

    // Si no hay carpetas_drive, descubrirlas desde la carpeta principal
    if (!Object.keys(carpetas).length && ot.carpeta_drive_url) {
      const mainFolderId = ot.carpeta_drive_url.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1]
      if (mainFolderId) {
        const subfolders = await listarSubcarpetas(token, mainFolderId)
        for (const folder of subfolders) {
          const match = folder.name.match(/^(\d{2})\s*[-–]/)
          if (match) {
            carpetas[match[1]] = {
              id:     folder.id,
              nombre: folder.name,
              url:    `https://drive.google.com/drive/folders/${folder.id}`,
            }
          }
        }
        if (Object.keys(carpetas).length > 0) {
          await supabase.from('ots').update({ carpetas_drive: carpetas }).eq('ot_numero', ot_numero)
        }
      }
    }

    if (!Object.keys(carpetas).length) {
      return res.status(400).json({ error: 'Esta OT no tiene carpetas Drive configuradas ni detectables' })
    }

    const resultados = []
    const upserts    = []

    for (const [numEtapa, info] of Object.entries(carpetas)) {
      const tipoDoc = ETAPA_NUM_A_TIPO[numEtapa]
      if (!tipoDoc) {
        resultados.push({ etapa: numEtapa, omitida: true })
        continue
      }

      const folderId = info?.id || info?.url?.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1]
      if (!folderId) {
        resultados.push({ etapa: numEtapa, tipo: tipoDoc, archivos: 0, error: 'Sin folder ID' })
        continue
      }

      try {
        const files = await listarArchivos(token, folderId)
        resultados.push({ etapa: numEtapa, tipo: tipoDoc, archivos: files.length })

        if (files.length > 0) {
          const archivo = files[0]
          upserts.push({
            ot_numero,
            tipo:           tipoDoc,
            nombre_archivo: archivo.name,
            drive_file_id:  archivo.id || null,
            drive_url:      archivo.webViewLink || info?.url || null,
            observacion:    `Archivos detectados: ${files.length}. ${files.map(f => f.name).join(', ')}`,
            subido_por:     'Sincronización Drive',
          })
        }
      } catch (driveErr) {
        resultados.push({ etapa: numEtapa, tipo: tipoDoc, archivos: 0, error: driveErr.message })
      }
    }

    if (upserts.length > 0) {
      for (const u of upserts) {
        // Buscar si ya existe por drive_file_id (si está disponible) o por ot_numero+tipo+nombre
        let existente = null
        if (u.drive_file_id) {
          const { data } = await supabase.from('documentos_ot')
            .select('id').eq('ot_numero', u.ot_numero).eq('drive_file_id', u.drive_file_id).maybeSingle()
          existente = data
        }
        if (!existente) {
          const { data } = await supabase.from('documentos_ot')
            .select('id').eq('ot_numero', u.ot_numero).eq('tipo', u.tipo).eq('nombre_archivo', u.nombre_archivo).maybeSingle()
          existente = data
        }
        if (existente) {
          const { error: updErr } = await supabase.from('documentos_ot').update(u).eq('id', existente.id)
          if (updErr) return res.status(500).json({ error: `Error actualizando en DB: ${updErr.message}`, detalle: resultados })
        } else {
          const { error: insErr } = await supabase.from('documentos_ot').insert(u)
          if (insErr) return res.status(500).json({ error: `Error guardando en DB: ${insErr.message}`, detalle: resultados })
        }
      }
    }

    return res.status(200).json({
      ok:                      true,
      ot_numero,
      etapas_escaneadas:       resultados.filter(r => !r.omitida).length,
      etapas_con_documentos:   resultados.filter(r => r.archivos > 0).length,
      total_archivos:          resultados.reduce((s, r) => s + (r.archivos || 0), 0),
      detalle:                 resultados,
    })

  } catch (err) {
    console.error('escanear-ot error:', err)
    return res.status(500).json({ error: err.message })
  }
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
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`,
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
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey, 'base64url')
  const jwt = `${header}.${payload}.${signature}`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await tokenRes.json()
  if (!data.access_token) throw new Error('No se pudo obtener token: ' + JSON.stringify(data))
  return data.access_token
}

function toBase64Url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
                                                 }
