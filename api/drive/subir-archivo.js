// ============================================================
// Vercel Serverless Function: /api/drive/subir-archivo
// Sube un archivo a una carpeta específica de Google Drive
//
// Variables de entorno (mismas que crear-carpetas):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
// ============================================================

import { createSign } from 'node:crypto'

export const config = {
  maxDuration: 30,
  api: { bodyParser: { sizeLimit: '12mb' } },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  try {
    const { folder_id, file_name, file_content_base64, mime_type } = req.body

    if (!folder_id || !file_name || !file_content_base64) {
      return res.status(400).json({ ok: false, error: 'Parámetros requeridos: folder_id, file_name, file_content_base64' })
    }

    const token = await getGoogleToken()

    // Resolver MIME type por extensión si el cliente no lo envió
    const mimeType = resolverMime(mime_type, file_name)

    // Multipart upload a Drive
    // IMPORTANTE: mimeType va TAMBIÉN en el metadata JSON para evitar
    // que Drive haga content-sniffing y clasifique mal el archivo.
    const fileBytes = Buffer.from(file_content_base64, 'base64')
    const boundary  = 'wssBoundary' + Date.now()
    const CRLF      = '\r\n'

    const metadata = JSON.stringify({
      name:     file_name,
      parents:  [folder_id],
      mimeType: mimeType,   // ← clave: fuerza el tipo correcto en Drive
    })

    const body = Buffer.concat([
      Buffer.from(`--${boundary}${CRLF}Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}${metadata}${CRLF}`),
      Buffer.from(`--${boundary}${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`),
      fileBytes,
      Buffer.from(`${CRLF}--${boundary}--`),
    ])

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
          'Content-Length': body.length,
        },
        body,
      }
    )

    const data = await uploadRes.json()

    if (!data.id) {
      const code = data.error?.code || uploadRes.status
      const msg  = data.error?.message || data.error?.errors?.[0]?.reason || JSON.stringify(data)
      throw new Error(`Drive error ${code}: ${msg}`)
    }

    return res.status(200).json({
      ok:        true,
      file_id:   data.id,
      file_name: data.name,
      mime_type: data.mimeType,
      file_url:  data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    })

  } catch (err) {
    console.error('[subir-archivo] Error:', err.message)
    return res.status(500).json({ ok: false, error: err.message })
  }
}

// ── Resolver MIME type por extensión ─────────────────────────────────────────
function resolverMime(clientMime, fileName) {
  // Si el cliente envió un tipo válido (no vacío ni octet-stream), úsalo
  if (clientMime && clientMime !== 'application/octet-stream') return clientMime
  // Fallback: detectar por extensión del nombre de archivo
  const ext = (fileName || '').split('.').pop().toLowerCase()
  const mimes = {
    pdf:  'application/pdf',
    msg:  'application/vnd.ms-outlook',
    eml:  'message/rfc822',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:  'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls:  'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt:  'application/vnd.ms-powerpoint',
    png:  'image/png',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    gif:  'image/gif',
    webp: 'image/webp',
    zip:  'application/zip',
    rar:  'application/x-rar-compressed',
    xml:  'application/xml',
    txt:  'text/plain',
    csv:  'text/csv',
    html: 'text/html',
    json: 'application/json',
  }
  return mimes[ext] || 'application/octet-stream'
}

// ── Google Auth (mismo patrón que crear-carpetas) ─────────────────────────────

async function getGoogleToken() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error('Variables GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY no configuradas')
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
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const td = await tokenRes.json()
  if (!td.access_token) throw new Error('Token Google fallido: ' + JSON.stringify(td))
  return td.access_token
}

function toBase64Url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}
