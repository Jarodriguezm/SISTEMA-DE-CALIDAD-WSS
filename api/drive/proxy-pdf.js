// api/drive/proxy-pdf.js
// GET /api/drive/proxy-pdf?fileId=XXX
// Sirve el archivo desde Drive via OAuth2 (cuenta personal) o Service Account
// Soporta: PDF, imágenes, DOCX, XLSX, MSG, Google Workspace (exporta como PDF)

import { createSign } from 'node:crypto'

export const config = { maxDuration: 30 }

// MIME types que se sirven directamente al browser sin conversión
const MIME_DIRECTO = {
  'application/pdf':  'application/pdf',
  'image/jpeg':       'image/jpeg',
  'image/jpg':        'image/jpeg',
  'image/png':        'image/png',
  'image/gif':        'image/gif',
  'image/webp':       'image/webp',
  'text/plain':       'text/plain',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { fileId } = req.query
  if (!fileId) return res.status(400).json({ error: 'fileId requerido' })

  try {
    const token = await getToken()

    // 1. Obtener metadatos del archivo
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const meta = await metaRes.json()
    if (meta.error) throw new Error(`Drive meta error: ${meta.error.message}`)

    const mimeType = meta.mimeType || 'application/octet-stream'

    // 2. Elegir URL de descarga
    let downloadUrl
    let servirComo

    if (mimeType.startsWith('application/vnd.google-apps')) {
      // Google Workspace → exportar como PDF
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`
      servirComo  = 'application/pdf'
    } else if (MIME_DIRECTO[mimeType]) {
      // PDF, imágenes → servir directo
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
      servirComo  = MIME_DIRECTO[mimeType]
    } else {
      // DOCX, XLSX, MSG, etc. → servir como octet-stream para descarga
      // El iframe no los puede mostrar, pero el browser ofrecerá descarga
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
      servirComo  = mimeType
    }

    // 3. Descargar el archivo
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!fileRes.ok) {
      const errText = await fileRes.text()
      throw new Error(`Drive download ${fileRes.status}: ${errText.slice(0, 200)}`)
    }

    const buffer = await fileRes.arrayBuffer()

    // 4. Devolver con headers apropiados
    const nombreArchivo = encodeURIComponent(meta.name || 'archivo')
    const esInline = servirComo.startsWith('image/') || servirComo === 'application/pdf' || servirComo === 'text/plain'
    res.setHeader('Content-Type', servirComo)
    res.setHeader('Content-Disposition', esInline ? `inline; filename="${nombreArchivo}"` : `attachment; filename="${nombreArchivo}"`)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    return res.status(200).send(Buffer.from(buffer))

  } catch (err) {
    console.error('[proxy-pdf]', err)
    return res.status(500).json({ error: err.message })
  }
}

// ── Auth: OAuth2 (Gmail) con fallback a Service Account ──────────────────────
async function getToken() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (clientId && clientSecret && refreshToken) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }).toString(),
    })
    const data = await res.json()
    if (data.access_token) return data.access_token
    console.warn('[proxy-pdf] OAuth2 falló, usando service account:', data.error)
  }

  return getServiceAccountToken()
}

async function getServiceAccountToken() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) throw new Error('Faltan credenciales Google')

  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const header  = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey, 'base64url')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${payload}.${signature}`,
  })
  const data = await tokenRes.json()
  if (!data.access_token) throw new Error('Token Google fallido: ' + JSON.stringify(data))
  return data.access_token
}

function toBase64Url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
