// api/drive/proxy-pdf.js
// GET /api/drive/proxy-pdf?fileId=XXX
// Sirve el archivo desde Drive via Service Account (evita restricciones de iframe de Google)

import { createSign } from 'node:crypto'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { fileId } = req.query
  if (!fileId) return res.status(400).json({ error: 'fileId requerido' })

  try {
    const token = await getGoogleToken()

    // Obtener metadatos
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const meta = await metaRes.json()
    if (meta.error) throw new Error(meta.error.message)

    const mimeType = meta.mimeType || 'application/pdf'
    let downloadUrl

    // Google Workspace files → exportar como PDF
    if (mimeType.includes('google-apps')) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    }

    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!fileRes.ok) throw new Error(`Drive download failed: ${fileRes.status}`)

    const buffer = await fileRes.arrayBuffer()

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.status(200).send(Buffer.from(buffer))

  } catch (err) {
    console.error('[proxy-pdf]', err)
    res.status(500).json({ error: err.message })
  }
}

// ── Google Service Account Auth ────────────────────────────────────────────────

async function getGoogleToken() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY')

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
