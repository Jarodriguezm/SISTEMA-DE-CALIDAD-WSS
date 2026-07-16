// supabase/functions/enviar-email/index.ts
// WSS · Sistema de Calidad
// Envía emails transaccionales mediante Resend API
// Requiere secret: RESEND_API_KEY
// Opcional:        RESEND_FROM (default: "WSS Calidad <noreply@wss.cl>")
//                  ⚠️  El dominio del remitente debe estar verificado en Resend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurado en Supabase secrets')

    const FROM = Deno.env.get('RESEND_FROM') || 'WSS Calidad <noreply@wss.cl>'

    const body = await req.json()
    const { to, subject, html, text, cc, bcc } = body

    if (!to)      throw new Error('Campo "to" requerido')
    if (!subject) throw new Error('Campo "subject" requerido')
    if (!html && !text) throw new Error('Se requiere "html" o "text"')

    const payload: Record<string, unknown> = {
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
    }

    if (html)  payload.html = html
    if (text)  payload.text = text
    if (cc)    payload.cc  = Array.isArray(cc)  ? cc  : [cc]
    if (bcc)   payload.bcc = Array.isArray(bcc) ? bcc : [bcc]

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || data.name || `Resend API error ${response.status}`)
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[enviar-email]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
