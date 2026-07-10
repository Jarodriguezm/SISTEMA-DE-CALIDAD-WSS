// api/drive/leer-template.js
// GET /api/drive/leer-template?fileId=XXX
// Descarga un .docx de Drive con Service Account y extrae su texto/campos
// USO DIAGNÓSTICO para ver estructura de plantillas

import { createSign } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { fileId } = req.query
  if (!fileId) return res.status(400).json({ error: 'fileId requerido' })

  try {
    const token = await getGoogleToken()

    // Metadata
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const meta = await metaRes.json()
    if (meta.error) throw new Error(meta.error.message)

    // Descargar binario
    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status} al descargar`)

    const buffer = Buffer.from(await dlRes.arrayBuffer())

    // Extraer word/document.xml del ZIP
    const docXml = extraerArchivoDeZip(buffer, 'word/document.xml')
    if (!docXml) throw new Error('No se encontró word/document.xml en el ZIP')

    // Parsear campos del formulario
    const campos = parsearCampos(docXml)

    return res.status(200).json({
      ok: true,
      nombre: meta.name,
      totalBytes: buffer.length,
      xmlBytes: docXml.length,
      campos,
    })
  } catch (err) {
    console.error('[leer-template]', err)
    return res.status(500).json({ error: err.message })
  }
}

// ── Extrae el texto estructurado del XML ──────────────────────────────────────

function parsearCampos(xml) {
  const resultado = {
    filas_tabla: [],
    parrafos: [],
    labels_detectados: [],
  }

  // 1. Extraer filas de tabla
  const filas = xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []
  for (const fila of filas) {
    const celdas = []
    const celdasXml = fila.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || []
    for (const celda of celdasXml) {
      const texto = (celda.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
        .map(t => t.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .join(' ')
      celdas.push(texto || '')
    }
    if (celdas.some(c => c.trim())) {
      resultado.filas_tabla.push(celdas)
    }
  }

  // 2. Extraer párrafos fuera de tablas
  const xmlSinTablas = xml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, '[TABLA]')
  const parrafos = xmlSinTablas.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []
  for (const p of parrafos) {
    const texto = (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
      .map(t => t.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join(' ')
    if (texto && texto !== '[TABLA]') resultado.parrafos.push(texto)
  }

  // 3. Detectar labels tipo "Solicitante :", "OT :", etc.
  const todosLosTextos = [
    ...resultado.filas_tabla.flat(),
    ...resultado.parrafos,
  ]
  const patronLabel = /^([A-Za-záéíóúÁÉÍÓÚñÑ][^:]{2,50})\s*:?\s*$/
  resultado.labels_detectados = [...new Set(
    todosLosTextos
      .filter(t => patronLabel.test(t.trim()) && t.length < 80)
      .map(t => t.trim())
  )]

  return resultado
}

// ── Descompresor ZIP mínimo ────────────────────────────────────────────────────

function extraerArchivoDeZip(buffer, targetFile) {
  let i = 0
  while (i < buffer.length - 30) {
    // Signature: 0x04034b50
    if (buffer[i]   === 0x50 && buffer[i+1] === 0x4B &&
        buffer[i+2] === 0x03 && buffer[i+3] === 0x04) {

      const compression    = buffer.readUInt16LE(i + 8)
      const compressedSize = buffer.readUInt32LE(i + 18)
      const fileNameLen    = buffer.readUInt16LE(i + 26)
      const extraLen       = buffer.readUInt16LE(i + 28)
      const fileName       = buffer.slice(i + 30, i + 30 + fileNameLen).toString('utf8')
      const dataStart      = i + 30 + fileNameLen + extraLen

      if (fileName === targetFile) {
        const compressedData = buffer.slice(dataStart, dataStart + compressedSize)
        try {
          if (compression === 0) return compressedData.toString('utf8')
          if (compression === 8) return inflateRawSync(compressedData).toString('utf8')
        } catch { return null }
      }

      i = dataStart + compressedSize
    } else {
      i++
    }
  }
  return null
}

// ── Google Service Account Auth ───────────────────────────────────────────────

async function getGoogleToken() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY')

  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const header  = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
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
