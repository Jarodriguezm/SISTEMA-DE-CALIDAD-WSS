// api/drive/proxy-msg.js
// Convierte archivos .msg (Outlook) a HTML legible en el navegador
// Usa la librería 'cfb' (SheetJS) cargada con dynamic import ESM-compatible

import { createSign } from 'node:crypto'
import CFB from 'cfb'

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

    const buf = Buffer.from(await fileRes.arrayBuffer())

    // 3. Google Docs: mostrar texto exportado
    if (isGoogleDoc) {
      const texto = buf.toString('utf8').trim()
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(
        texto ? htmlTextoPlano(nombre, texto)
              : htmlAviso(nombre, 'Google Drive convirtió este archivo a un formato incompatible.')
      )
    }

    // 4. Parsear como MSG
    let emailHtml
    try {
      const email = parseMsgCfbf(buf, CFB)
      emailHtml   = renderEmailHtml(email, nombre)
    } catch (parseErr) {
      console.error('[proxy-msg] parse:', parseErr.message)
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
// Parser MSG usando librería cfb (SheetJS)
// ══════════════════════════════════════════════════════════════════════════════

function parseMsgCfbf(buf, CFB) {
  const cfb = CFB.read(buf, { type: 'buffer' })

  function readStream(name) {
    const entry = cfb.FileIndex.find(f => f.name === name)
    if (!entry?.content?.length) return null
    return Buffer.from(entry.content)
  }

  // Auto-detectar encoding: UTF-16 LE (estándar MAPI) o UTF-8/latin1
  function smartStr(d) {
    if (!d || d.length === 0) return null
    // Strip BOM UTF-16 LE
    if (d[0] === 0xFF && d[1] === 0xFE) d = d.slice(2)
    // Strip BOM UTF-8
    else if (d[0] === 0xEF && d[1] === 0xBB && d[2] === 0xBF) return d.slice(3).toString('utf8').replace(/\0+$/, '')
    // Detectar UTF-16 LE: bytes impares = 0x00 para texto ASCII/Latin
    const n = Math.min(d.length, 20)
    let nullOdd = 0, tot = 0
    for (let i = 1; i < n; i += 2) { tot++; if (d[i] === 0) nullOdd++ }
    if (tot > 0 && nullOdd / tot >= 0.7) return d.toString('utf16le').replace(/\0+$/, '')
    const utf8 = d.toString('utf8').replace(/\0+$/, '')
    if (!utf8.includes('�')) return utf8
    return d.toString('latin1').replace(/\0+$/, '')
  }

  const uStr  = n => { const d = readStream(n); return d ? smartStr(d) : null }
  const aStr  = n => { const d = readStream(n); return d ? d.toString('latin1').replace(/\0+$/, '') : null }
  const prop  = (tag, type) => uStr(`__substg1.0_${tag}${type}`)
  const propA = (tag, type) => aStr(`__substg1.0_${tag}${type}`)

  function getDate() {
    const d = readStream('__substg1.0_00390040')
    if (!d || d.length < 8) return null
    try {
      const ft = BigInt(d.readUInt32LE(4)) * 0x100000000n + BigInt(d.readUInt32LE(0))
      return new Date(Number((ft - 116444736000000000n) / 10000n)).toLocaleString('es-CL')
    } catch { return null }
  }

  function getBody() {
    // HTML body (prop 0x1013, tipo 0102 = binary)
    const htmlBuf = readStream('__substg1.0_10130102')
    if (htmlBuf?.length) {
      for (const enc of ['utf8', 'utf16le', 'latin1']) {
        const s = htmlBuf.toString(enc)
        if (/<html|<body|<div/i.test(s)) return { tipo: 'html', content: s }
      }
    }
    // RTF body (prop 0x1009)
    const rtfBuf = readStream('__substg1.0_10090102')
    if (rtfBuf?.length) {
      const texto = rtfBuf.toString('latin1')
        .replace(/\{\\[^}]*\}/g, '').replace(/\\[a-z]+\d* ?/g, '').replace(/[{}\\]/g, '').trim()
      if (texto.length > 10) return { tipo: 'text', content: texto }
    }
    // Texto plano (prop 0x1000)
    const txt = prop('1000', '001F') || propA('1000', '001E')
    return { tipo: 'text', content: txt || '(sin cuerpo)' }
  }

  return {
    subject:     prop('0037', '001F') || propA('0037', '001E') || '(sin asunto)',
    senderName:  prop('0C1A', '001F') || propA('0C1A', '001E') || '',
    senderEmail: prop('0C1F', '001F') || propA('0C1F', '001E') || '',
    displayTo:   prop('0E04', '001F') || propA('0E04', '001E') || '',
    displayCc:   prop('0E03', '001F') || propA('0E03', '001E') || '',
    date:        getDate(),
    body:        getBody(),
  }
}

// ── HTML renderers ─────────────────────────────────────────────────────────────

function renderEmailHtml(email, filename) {
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  let bodyHtml
  if (email.body.tipo === 'html') {
    bodyHtml = email.body.content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, 'blocked:')
  } else {
    bodyHtml = `<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px">${esc(email.body.content)}</pre>`
  }

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(email.subject)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Arial,sans-serif;font-size:14px;color:#111827;background:#F9FAFB}
.top{background:#1A3A5C;color:#fff;padding:8px 16px;font-size:11px;display:flex;align-items:center;gap:8px}
.meta{background:#fff;border-bottom:2px solid #E5E7EB;padding:14px 20px}
.subj{font-size:18px;font-weight:700;color:#1A3A5C;margin-bottom:10px}
table{border-collapse:collapse;font-size:12.5px;width:100%}
td{padding:2px 8px 2px 0;vertical-align:top}
td.lbl{color:#6B7280;font-weight:600;width:60px;white-space:nowrap}
.body-wrap{background:#fff;padding:20px;margin-top:2px;min-height:200px}
</style></head>
<body>
<div class="top">📧 Correo Outlook &nbsp;·&nbsp; <span style="opacity:.7">${esc(filename)}</span></div>
<div class="meta">
  <div class="subj">${esc(email.subject)}</div>
  <table>
    <tr><td class="lbl">De:</td><td>${esc(email.senderName)}${email.senderEmail ? ' &lt;'+esc(email.senderEmail)+'&gt;' : ''}</td></tr>
    <tr><td class="lbl">Para:</td><td>${esc(email.displayTo)}</td></tr>
    ${email.displayCc ? `<tr><td class="lbl">CC:</td><td>${esc(email.displayCc)}</td></tr>` : ''}
    ${email.date      ? `<tr><td class="lbl">Fecha:</td><td>${esc(email.date)}</td></tr>` : ''}
  </table>
</div>
<div class="body-wrap">${bodyHtml}</div>
</body></html>`
}

function htmlTextoPlano(nombre, texto) {
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:monospace;font-size:13px;padding:20px;white-space:pre-wrap;background:#fff}</style>
</head><body>${esc(texto)}</body></html>`
}

function htmlAviso(nombre, msg) {
  const esc = s => String(s||'').replace(/&/g,'&amp;')
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial;display:flex;flex-direction:column;align-items:center;justify-content:center;
min-height:100vh;background:#F9FAFB;color:#374151;gap:12px;padding:30px;text-align:center}
.ico{font-size:56px}.titulo{font-size:16px;font-weight:700;color:#1A3A5C}
.msg{font-size:13px;max-width:420px;line-height:1.6;color:#6B7280}</style></head>
<body><div class="ico">📧</div><div class="titulo">${esc(nombre)}</div>
<div class="msg">${esc(msg)}</div></body></html>`
}

function htmlError(msg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial;padding:30px;color:#991B1B}</style></head>
<body><h3>⚠️ Error</h3><p style="margin-top:10px;font-size:13px">${msg}</p></body></html>`
}

// ── Auth OAuth2 + Service Account ─────────────────────────────────────────────

async function getToken() {
  const { GOOGLE_OAUTH_CLIENT_ID: id, GOOGLE_OAUTH_CLIENT_SECRET: sec, GOOGLE_OAUTH_REFRESH_TOKEN: ref } = process.env
  if (id && sec && ref) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id:id, client_secret:sec, refresh_token:ref, grant_type:'refresh_token' }).toString(),
    })
    const d = await r.json()
    if (d.access_token) return d.access_token
  }
  return getServiceAccountToken()
}

async function getServiceAccountToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) throw new Error('Faltan credenciales Google')
  const pk = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const h = b64url(JSON.stringify({ alg:'RS256', typ:'JWT' }))
  const p = b64url(JSON.stringify({ iss:email, scope:'https://www.googleapis.com/auth/drive.readonly', aud:'https://oauth2.googleapis.com/token', iat:now, exp:now+3600 }))
  const sig = createSign('RSA-SHA256').update(`${h}.${p}`).sign(pk, 'base64url')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${h}.${p}.${sig}`,
  })
  const d = await r.json()
  if (!d.access_token) throw new Error('Token SA: ' + JSON.stringify(d))
  return d.access_token
}

function b64url(s) {
  return Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}
