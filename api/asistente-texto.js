// api/asistente-texto.js
// POST /api/asistente-texto  { accion, texto, seccion, contexto }
// accion: 'resumir' | 'ampliar'
// Retorna { texto } procesado por Claude Haiku

const NOMBRES_SECCION = {
  introduccion:       'Procedimiento / Introducción',
  descripcion_equipo: 'Descripción del Equipo',
  end_realizados:     'Ensayos No Destructivos Realizados',
  hallazgos:          'Hallazgos de Inspección',
  evaluacion:         'Evaluación Técnica',
  conclusion:         'Conclusión',
  recomendaciones:    'Recomendaciones',
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

  const { accion = 'resumir', texto = '', seccion = '', contexto = {} } = req.body

  const nombreSec = NOMBRES_SECCION[seccion] || seccion.replace(/_/g, ' ')

  const ctxLineas = Object.entries(contexto)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const base = `Eres un redactor técnico especialista en informes de inspección industrial para WSS Testing & Certification Chile.
El documento es un informe de inspección técnica. Escribe en español técnico, normativo y profesional.
Jamás incluyas explicaciones, etiquetas, comillas ni texto fuera del cuerpo del informe.`

  const ctxBloque = ctxLineas
    ? `\nContexto del informe:\n${ctxLineas}\n`
    : ''

  const prompt = accion === 'resumir'
    ? `${base}${ctxBloque}
Sección: "${nombreSec}"

Texto actual:
${texto}

Tarea: Resume y compacta el texto anterior. Mantén el lenguaje normativo, elimina redundancias y hazlo más conciso sin perder información técnica clave.
Devuelve ÚNICAMENTE el texto resumido.`
    : `${base}${ctxBloque}
Sección: "${nombreSec}"
${texto ? `\nTexto actual:\n${texto}\n\nTarea: Amplía y enriquece este texto con mayor detalle técnico y referencias normativas relevantes (ASME B30, ISO 17020, DS 43/2015, NCh, API según corresponda).` : `\nTarea: Redacta el texto completo para esta sección con lenguaje técnico normativo. Referencia normas relevantes del contexto.`}
Devuelve ÚNICAMENTE el texto mejorado.`

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
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      console.error('[asistente-texto]', resp.status, err)
      return res.status(502).json({ error: `Error IA (${resp.status}). Intente de nuevo.` })
    }

    const data = await resp.json()
    const textoResult = (data.content || []).find(b => b.type === 'text')?.text || ''
    return res.json({ texto: textoResult.trim() })

  } catch (e) {
    console.error('[asistente-texto]', e)
    return res.status(500).json({ error: 'Error interno: ' + e.message })
  }
}
