// api/drive/listar-carpeta.js
// GET /api/drive/listar-carpeta?folderId=XXX
// Lista archivos y subcarpetas de una carpeta de Drive usando Service Account

import { createSign } from 'node:crypto'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { folderId } = req.query
  if (!folderId) return res.status(400).json({ error: 'folderId requerido' })

  try {
    const token = await getGoogleToken()

    // 1. Listar subcarpetas (categorías)
    const subcarpetas = await listarSubcarpetas(token, folderId)

    // 2. Para cada subcarpeta, listar sus archivos
    const categorias = await Promise.all(
      subcarpetas.map(async (sub) => {
        const archivos = await listarArchivos(token, sub.id)
        return { id: sub.id, nombre: sub.name, archivos }
      })
    )

    // 3. También listar archivos directamente en la raíz (sin subcarpeta)
    const archivosRaiz = await listarArchivos(token, folderId)

    return res.status(200).json({
      ok: true,
      raiz: archivosRaiz,
      categorias: categorias.filter(c => c.archivos.length > 0),
    })
  } catch (err) {
    console.error('[listar-carpeta]', err)
    return res.status(500).json({ error: err.message })
  }
}

async function listarSubcarpetas(token, folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  if (d.error) throw new Error(`Drive subfolders: ${d.error.message}`)
  return d.files || []
}

async function listarArchivos(token, folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`
  )
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&orderBy=name&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  if (d.error) throw new Error(`Drive files: ${d.error.message}`)
  return d.files || []
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
