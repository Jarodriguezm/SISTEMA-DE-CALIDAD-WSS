// api/drive/proxy-msg.js
// Extrae y renderiza archivos .msg (Outlook) como HTML para el iframe del visor
// Usa el paquete 'cfb' de SheetJS para parsear CFBF/OLE2 correctamente

import { createSign } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const CFB = require('cfb')

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { fileId } = req.query
  if (!fileId) return res.status(400).send(htmlError('fileId requerido'))

  try {
    const token = await getToken()

    // 1. Metadata
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const meta = await metaRes.json()
    if (meta.error) throw new Error(meta.error.message)

    const nombre = meta.name || 'correo.msg'

    // 2. Descargar binario
    const isGoogleDoc = meta.mimeType?.startsWith('application/vnd.google-apps')
    const downloadUrl = isGoogleDoc
      ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`
      : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`

    const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (!fileRes.ok) throw new Error(`Drive descarga ${fileRes.status}`)

    const arrayBuf = await fileRes.arrayBuffer()
    const buf = Buffer.from(arrayBuf)

    // 3. Si fue convertido a Google Docs, mostrar texto exportado
    if (isGoogleDoc) {
      const texto = buf.toString('utf8').trim()
      if (!texto) {
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(
          htmlAviso(nombre, 'Google Drive convirtió este correo a un formato incompatible. Descarga el archivo original desde Drive para verlo en Outlook.')
        )
      }
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(
        htmlTextoPlano(nombre, texto)
      )
    }

    // 4. Parsear como CFBF/MSG usando librería cfb
    let emailHtml
    try {
      const email = parseMsgCfbf(buf)
      emailHtml = renderEmailHtml(email, nombre)
    } catch (parseErr) {
      console.error('[proxy-msg] parse error:', parseErr.message)
      emailHtml = htmlAviso(nombre, `No se pudo leer el archivo MSG. (${parseErr.message})`)
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    return res.status(200).send(emailHtml)

  } catch (err) {
    console.error('[proxy-msg]', err)
    return res.setHeader('Content-Type', 'text/html').status(500).send(htmlError(err.message))
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Parser MSG usando librería 'cfb' (SheetJS) — maneja todos los casos edge de CFBF
// ══════════════════════════════════════════════════════════════════════════════

function parseMsgCfbf(buf) {
  let cfb
  try {
    cfb = CFB.read(buf, { type: 'buffer' })
  } catch (e) {
    throw new Error(`CFBF inválido: ${e.message}`)
  }

  // Buscar stream MAPI por nombre en el FileIndex del CFB
  function readStream(name) {
    // Los streams MAPI están directamente bajo Root Entry (type=2)
    const entry = cfb.FileIndex.find(f =>
      f.name === name && (f.type === 2 || f.type === undefined)
    )
    if (!entry || !entry.content || entry.content.length === 0) return null
    return Buffer.from(entry.content)
  }

  // Detección automática de encoding para strings MAPI
  // PT_UNICODE (001F) = UTF-16 LE, pero algunos clientes guardan UTF-8
  function smartStr(data) {
    if (!data || data.length === 0) return null
    let d = data
    // Strip BOM UTF-16 LE (FF FE)
    if (d.length >= 2 && d[0] === 0xFF && d[1] === 0xFE) d = d.slice(2)
    // Strip BOM UTF-8 (EF BB BF)
    else if (d.length >= 3 && d[0] === 0xEF && d[1] === 0xBB && d[2] === 0xBF) {
      return d.slice(3).toString('utf8').replace(/\0+$/, '')
    }
    // Detectar UTF-16 LE: bytes impares son 0x00 para texto ASCII/Latin
    const checkLen = Math.min(d.length, 20)
    let nullOdd = 0, totalOdd = 0
    for (let i = 1; i < checkLen; i += 2) { totalOdd++; if (d[i] === 0) nullOdd++ }
    if (totalOdd > 0 && nullOdd / totalOdd >= 0.7) {
      return d.toString('utf16le').replace(/\0+$/, '')
    }
    // Intentar UTF-8
    const utf8 = d.toString('utf8').replace(/\0+$/, '')
    if (!utf8.includes('�')) return utf8
    // Fallback latin1
    return d.toString('latin1').replace(/\0+$/, '')
  }

  const uStr = n => { const d = readStream(n); return d ? smartStr(d) : null }
  const aStr = n => { const d = readStream(n); return d ? d.toString('latin1').replace(/\0+$/, '') : null }

  const prop  = (tag, type) => uStr(`__substg1.0_${tag}${type}`)
  const propA = (tag, type) => aStr(`__substg1.0_${tag}${type}`)

  function getFiletime(name) {
    const d = readStream(name)
    if (!d || d.length < 8) return null
    try {
      const lo = d.readUInt32LE(0), hi = d.readUInt32LE(4)
      const ft = BigInt(hi) * 0x100000000n + BigInt(lo)
      const ms = (ft - 116444736000000000n) / 10000n
      return new Date(Number(ms)).toLocaleString('es-CL')
    } catch { return null }
  }

  function getBody() {
    // HTML body (property 0x1013, type 0102 = binary)
    const htmlBuf = readStream('__substg1.0_10130102')
    if (htmlBuf && htmlBuf.length > 0) {
      // Detectar encoding: UTF-8, UTF-16 LE, o latin1
      const s8 = htmlBuf.toString('utf8')
      if (/<html|<body|<div/i.test(s8)) return { tipo: 'html', content: s8 }
      const s16 = htmlBuf.toString('utf16le').replace(/\0+$/, '')
      if (/<html|<body|<div/i.test(s16)) return { tipo: 'html', content: s16 }
      const sL = htmlBuf.toString('latin1')
      if (/<html|<body|<div/i.test(sL)) return { tipo: 'html', content: sL }
    }
    // RTF body (property 0x1009, type 0102) - quitar RTF markup y mostrar texto
    const rtfBuf = readStream('__substg1.0_10090102')
    if (rtfBuf && rtfBuf.length > 0) {
      const rtf = rtfBuf.toString('latin1')
      // Extraer texto plano desde RTF básico
      const texto = rtf
        .replace(/\{[^{}]*\}/g, '')     // quitar grupos RTF anidados
        .replace(/\\[a-z]+[-\d]* ?/g, '') // quitar comandos RTF
        .replace(/[{}\\]/g, '')          // quitar delimitadores restantes
        .replace(/\r\n|\r|\n/g, '\n')
        .trim()
      if (texto.length > 10) return { tipo: 'text', content: texto }
    }
    // Texto plano (property 0x1000)
    const textU = prop('1000', '001F') || propA('1000', '001E')
    if (textU) return { tipo: 'text', content: textU }
    return { tipo: 'text', content: '(sin cuerpo)' }
  }

  return {
    subject:     prop('0037', '001F') || propA('0037', '001E') || '(sin asunto)',
    senderName:  prop('0C1A', '001F') || propA('0C1A', '001E') || '',
    senderEmail: prop('0C1F', '001F') || propA('0C1F', '001E') || '',
    displayTo:   prop('0E04', '001F') || propA('0E04', '001E') || '',
    displayCc:   prop('0E03', '001F') || propA('0E03', '001E') || '',
    date:        getFiletime('__substg1.0_00390040'),
    body:        getBody(),
  }
}

// ── HTML renderers ─────────────────────────────────────────────────────────────

function renderEmailHtml(email, filename) {
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

  let bodyHtml
  if (email.body.tipo === 'html') {
    bodyHtml = email.body.content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, 'blocked:')
  } else {
    bodyHtml = `<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px">${esc(email.body.content)}</pre>`
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(email.subject)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Arial,sans-serif;font-size:14px;color:#111827;background:#F9FAFB}
  .top{background:#1A3A5C;color:#fff;padding:8px 16px;font-size:11px;display:flex;align-items:center;gap:8px}
  .meta{background:#fff;border-bottom:2px solid #E5E7EB;padding:14px 20px}
  .meta .subj{font-size:18px;font-weight:700;color:#1A3A5C;margin-bottom:10px;line-height:1.3}
  table.campos{border-collapse:collapse;font-size:12.5px;width:100%}
  table.campos td{padding:2px 8px 2px 0;vertical-align:top}
  table.campos td.lbl{color:#6B7280;font-weight:600;width:60px;white-space:nowrap}
  .body-wrap{background:#fff;padding:20px;margin-top:2px;min-height:200px}
</style>
</head>
<body>
<div class="top">📧 Correo Outlook &nbsp;·&nbsp; <span style="opacity:.7">${esc(filename)}</span></div>
<div class="meta">
  <div class="subj">${esc(email.subject)}</div>
  <table class="campos">
    <tr>
      <td class="lbl">De:</td>
      <td>${esc(email.senderName)}${email.senderEmail ? ' &lt;' + esc(email.senderEmail) + '&gt;' : ''}</td>
    </tr>
    <tr><td class="lbl">Para:</td><td>${esc(email.displayTo)}</td></tr>
    ${email.displayCc ? `<tr><td class="lbl">CC:</td><td>${esc(email.displayCc)}</td></tr>` : ''}
    ${email.date      ? `<tr><td class="lbl">Fecha:</td><td>${esc(email.date)}</td></tr>` : ''}
  </table>
</div>
<div class="body-wrap">${bodyHtml}</div>
</body>
</html>`
}

function htmlTextoPlano(nombre, texto) {
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(nombre)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
.top{background:#1A3A5C;color:#fff;padding:8px 16px;font-size:11px}
.body{background:#fff;padding:20px;white-space:pre-wrap;font-family:monospace;font-size:13px;line-height:1.6}
</style></head><body>
<div class="top">📄 ${esc(nombre)}</div>
<div class="body">${esc(texto)}</div>
</body></html>`
}

function htmlAviso(nombre, msg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#F9FAFB;color:#374151;gap:12px;padding:30px;text-align:center}
.ico{font-size:56px}.titulo{font-size:16px;font-weight:700;color:#1A3A5C}
.msg{font-size:13px;max-width:420px;line-height:1.6;color:#6B7280}
</style></head><body>
<div class="ico">📧</div>
<div class="titulo">${nombre}</div>
<div class="msg">${msg}</div>
</body></html>`
}

function htmlError(msg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial;padding:30px;color:#991B1B}</style></head>
<body><h3>⚠️ Error</h3><p style="margin-top:10px;font-size:13px">${msg}</p></body></html>`
}

// ── Auth OAuth2 + Service Account ─────────────────────────────────────────────

async function getToken() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (clientId && clientSecret && refreshToken) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
    })
    const d = await res.json()
    if (d.access_token) return d.access_token
  }
  return getServiceAccountToken()
}

async function getServiceAccountToken() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) throw new Error('Faltan credenciales Google')
  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const sig = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url')
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${payload}.${sig}`,
  })
  const d = await tokenRes.json()
  if (!d.access_token) throw new Error('Token SA fallido: ' + JSON.stringify(d))
  return d.access_token
}

function b64url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
