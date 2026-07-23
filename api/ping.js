// api/ping.js — Diagnóstico rápido del asistente María
// Visitar: https://sistema-de-calidad-wss.vercel.app/api/ping
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(200).json({
      ok: false,
      problema: 'ANTHROPIC_API_KEY no está configurada en Vercel',
      solucion: 'Ir a Vercel → Settings → Environment Variables → agregar ANTHROPIC_API_KEY'
    })
  }

  // Test mínimo a Anthropic
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages:   [{ role: 'user', content: 'di ok' }]
      })
    })

    if (!resp.ok) {
      const txt = await resp.text()
      return res.status(200).json({
        ok: false,
        problema: `Anthropic rechazó la API key (${resp.status})`,
        detalle: txt.slice(0, 200)
      })
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'API key OK — Anthropic responde correctamente',
      keyPrefix: apiKey.slice(0, 20) + '...'
    })

  } catch (e) {
    return res.status(200).json({
      ok: false,
      problema: 'Error de red al conectar con Anthropic',
      detalle: e.message
    })
  }
}
