// ============================================================
// api/enviar-correo.js — Envío de correos vía Gmail API
//
// Reemplaza a Resend, que solo entregaba al dueño de la cuenta
// por no tener dominio verificado.
//
// Usa el mismo OAuth2 que ya se ocupa para subir a Drive
// (GOOGLE_OAUTH_CLIENT_ID / SECRET / REFRESH_TOKEN), con el
// permiso gmail.send agregado. Los correos salen desde la
// casilla @wss.cl dueña de ese token, así que SPF y DKIM ya
// vienen correctos de Google y no se van a spam.
//
// Protegido con WSS_MAIL_TOKEN: sin ese encabezado no envía.
// ============================================================

const GMAIL_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

// ── Access token a partir del refresh token ──────────────────
async function getAccessToken() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Faltan las variables GOOGLE_OAUTH_*')
  }

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
  if (!data.access_token) throw new Error('OAuth2 fallido: ' + JSON.stringify(data))
  return data.access_token
}

// ── Codificación base64url que exige la API de Gmail ─────────
function base64url(str) {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Asunto con acentos: RFC 2047
function encabezadoUtf8(texto) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(texto)) return texto
  return '=?UTF-8?B?' + Buffer.from(texto, 'utf-8').toString('base64') + '?='
}

function armarMensaje({ from, to, cc, bcc, subject, html }) {
  const lineas = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
  ]
  if (cc?.length)  lineas.push(`Cc: ${cc.join(', ')}`)
  if (bcc?.length) lineas.push(`Bcc: ${bcc.join(', ')}`)
  lineas.push(
    `Subject: ${encabezadoUtf8(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
  )
  return lineas.join('\r\n')
}

// ── Handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Solo POST' })
  }

  // Autorización: token compartido, no la key de Supabase
  const esperado = (process.env.WSS_MAIL_TOKEN || '').trim()
  const recibido = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()

  if (!esperado) {
    // La variable no llegó al build: falta crearla o falta redesplegar
    return res.status(500).json({
      ok: false,
      error: 'WSS_MAIL_TOKEN no esta configurada en el servidor',
    })
  }

  if (recibido !== esperado) {
    // Pistas sin revelar el valor
    return res.status(401).json({
      ok: false,
      error: 'Token incorrecto',
      largo_esperado: esperado.length,
      largo_recibido: recibido.length,
    })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const { to, cc, bcc, subject, html } = body

    const destinos = Array.isArray(to) ? to.filter(Boolean) : (to ? [to] : [])
    if (destinos.length === 0) return res.status(400).json({ ok: false, error: 'Falta "to"' })
    if (!subject)              return res.status(400).json({ ok: false, error: 'Falta "subject"' })
    if (!html)                 return res.status(400).json({ ok: false, error: 'Falta "html"' })

    // Gmail permite hasta 100 destinatarios por mensaje
    if (destinos.length > 100) {
      return res.status(400).json({ ok: false, error: 'Máximo 100 destinatarios por envío' })
    }

    const token  = await getAccessToken()
    const remite = process.env.WSS_MAIL_FROM || 'Sistema de Calidad WSS <me>'

    const raw = base64url(armarMensaje({
      from: remite,
      to: destinos,
      cc: Array.isArray(cc) ? cc : undefined,
      bcc: Array.isArray(bcc) ? bcc : undefined,
      subject,
      html,
    }))

    const envio = await fetch(GMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })

    const data = await envio.json()

    if (!envio.ok) {
      console.error('[enviar-correo] Gmail respondió', envio.status, data)
      return res.status(502).json({
        ok: false,
        error: data?.error?.message || `Gmail HTTP ${envio.status}`,
        detalle: data,
      })
    }

    return res.status(200).json({ ok: true, id: data.id, destinatarios: destinos.length })
  } catch (e) {
    console.error('[enviar-correo]', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
