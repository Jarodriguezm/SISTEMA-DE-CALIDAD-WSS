// api/drive/proxy-pdf.js
//
// DOS MODOS:
//   POST /api/drive/proxy-pdf   { fileId }  + Authorization: Bearer <jwt de Supabase>
//        → valida la sesión y el rol, devuelve { url } con un permiso firmado
//          que vence en 10 minutos.
//
//   GET  /api/drive/proxy-pdf?fileId=XXX&exp=...&sig=...
//        → verifica la firma y sirve el archivo.
//
// POR QUÉ ASÍ
//   Antes este endpoint servía cualquier archivo a cualquiera que tuviera el
//   fileId, sin sesión y desde cualquier origen. Como los fileId están en
//   documentos_ot y esa tabla es legible por todo usuario autenticado, en la
//   práctica cualquiera podía descargar todos los expedientes.
//   Las etiquetas <object>/<iframe> no pueden mandar encabezados, por eso el
//   permiso viaja firmado en la URL y con vencimiento corto.

import { createSign, createHmac, timingSafeEqual } from 'node:crypto'

export const config = { maxDuration: 30 }

// Etapas que un inspector NO puede ver: información comercial
const ETAPAS_VEDADAS_INSPECTOR = new Set([
  'correo_cotizacion', 'cotizacion', 'envio_cotizacion',
  'orden_compra', 'correo_oc', 'envio_informes', 'sdf', 'factura',
])

const VIGENCIA_MS = 10 * 60 * 1000   // 10 minutos

function secretoFirma() {
  const s = process.env.WSS_SIGN_SECRET || process.env.WSS_MAIL_TOKEN
  if (!s) throw new Error('Falta WSS_SIGN_SECRET (o WSS_MAIL_TOKEN) para firmar accesos')
  return s
}

function firmar(fileId, exp) {
  return createHmac('sha256', secretoFirma()).update(`${fileId}.${exp}`).digest('hex')
}

function firmaValida(fileId, exp, sig) {
  if (!fileId || !exp || !sig) return false
  if (Number(exp) < Date.now()) return false
  const esperada = Buffer.from(firmar(fileId, exp))
  const recibida = Buffer.from(String(sig))
  if (esperada.length !== recibida.length) return false
  return timingSafeEqual(esperada, recibida)
}

// ── Valida el JWT del usuario contra Supabase y devuelve su email ────────────
async function usuarioDeLaSesion(req) {
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return null

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: key },
  })
  if (!r.ok) return null
  const u = await r.json()
  return u?.email ? String(u.email).toLowerCase() : null
}

// ── ¿Este usuario puede ver este archivo? ────────────────────────────────────
async function puedeVer(email, fileId) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  const cab = { apikey: key, Authorization: `Bearer ${key}` }

  // Rol del usuario
  const rRol = await fetch(
    `${url}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=rol`,
    { headers: cab }
  )
  const filas = rRol.ok ? await rRol.json() : []
  const rol = String(filas?.[0]?.rol || '').toUpperCase()

  if (rol !== 'INSPECTOR') return true   // el resto ve todo

  // Si el archivo pertenece a una etapa comercial, se le niega
  const rDoc = await fetch(
    `${url}/rest/v1/documentos_ot?drive_file_id=eq.${encodeURIComponent(fileId)}&select=tipo`,
    { headers: cab }
  )
  const docs = rDoc.ok ? await rDoc.json() : []
  const tipos = docs.map(d => String(d.tipo || ''))

  return !tipos.some(t => ETAPAS_VEDADAS_INSPECTOR.has(t))
}

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
  // Solo el propio portal: se acabó el Access-Control-Allow-Origin: *
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── MODO 1: pedir permiso (requiere sesión) ───────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
      const fileId = body.fileId
      if (!fileId) return res.status(400).json({ error: 'fileId requerido' })

      const email = await usuarioDeLaSesion(req)
      if (!email) return res.status(401).json({ error: 'Sesión no válida' })

      if (!(await puedeVer(email, fileId))) {
        console.warn(`[proxy-pdf] ${email} intentó abrir ${fileId} sin permiso`)
        return res.status(403).json({ error: 'No tienes acceso a este documento' })
      }

      const exp = Date.now() + VIGENCIA_MS
      const sig = firmar(fileId, exp)
      return res.status(200).json({
        url: `/api/drive/proxy-pdf?fileId=${encodeURIComponent(fileId)}&exp=${exp}&sig=${sig}`,
        expira_en: VIGENCIA_MS / 1000,
      })
    } catch (e) {
      console.error('[proxy-pdf] permiso:', e)
      return res.status(500).json({ error: e.message })
    }
  }

  // ── MODO 2: servir el archivo (requiere permiso firmado) ──────────────────
  const { fileId, exp, sig } = req.query
  if (!fileId) return res.status(400).json({ error: 'fileId requerido' })

  try {
    if (!firmaValida(fileId, exp, sig)) {
      return res.status(403).json({ error: 'Permiso inválido o vencido' })
    }
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

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
