// ============================================================
// api/chat.js — Vercel Serverless Function
// Asistente "María" de WSS — powered by Anthropic Claude Haiku
// Convierte mensajes de formato OpenAI → Anthropic internamente
// ============================================================

const SYSTEM_PROMPT = `Eres María, la asistente de inteligencia artificial de WSS Testing & Certification Chile, empresa especializada en inspección industrial y ensayos no destructivos (END).

Tu nombre es María. Ayudas a los usuarios del Sistema de Calidad WSS con:
- Técnicas END: VT, MT, PT, UT, RT, TOFD, Phased Array (PAUT)
- Normas: ISO 17020, ISO 9712, AWS D1.1, ASME B30 (completo), ASME B31.1/B31.3, API 570/580/653, NCh 2369, DS 43/2015, INN OI376/OI377
- Gestión de OTs, asignaciones de inspectores, generación de informes
- Análisis de documentos técnicos, actas y certificados
- Criterios de aceptación y rechazo según normativa (ASME B30.9 eslingas, B30.10 ganchos, ISO 4309 cables)
- Cálculos técnicos: pérdida de espesor, cargas, factores de seguridad

Contexto: minería e industria chilena. Responde en español técnico y claro. Sé concreto y orientado a la acción.
Cuando el usuario mencione una OT o asignación, usa las herramientas para buscar datos reales antes de responder.
Si recibes una imagen de documento técnico, analízala en detalle.
Cuando no tengas certeza de un criterio normativo, indícalo.`

const TOOLS = [
  {
    name: 'buscar_ots',
    description: 'Busca órdenes de trabajo (OTs) en el sistema WSS.',
    input_schema: {
      type: 'object',
      properties: {
        busqueda: { type: 'string', description: 'Número de OT o texto para buscar.' },
        estado:   { type: 'string', enum: ['Pendiente de asignacion','En proceso','Asignada','Informe enviado','Cerrada documentalmente'] },
        limite:   { type: 'integer', description: 'Máximo de resultados. Default 5.' }
      },
      required: []
    }
  },
  {
    name: 'obtener_asignaciones',
    description: 'Obtiene asignaciones de inspección próximas.',
    input_schema: {
      type: 'object',
      properties: {
        dias:   { type: 'integer', description: 'Días hacia adelante. Default 7.' },
        estado: { type: 'string', enum: ['Programada','Realizada','Cancelada','Pendiente'] }
      },
      required: []
    }
  }
]

// ── Convierte historial OpenAI → Anthropic ────────────────────────────────
// El ChatWidget guarda en formato OpenAI (role: tool, image_url).
// Anthropic requiere: tool_result en mensajes user, imágenes en formato base64 propio.
function toAnthropic(messages) {
  const out = []
  let i = 0

  while (i < messages.length) {
    const m = messages[i]

    if (m.role === 'user') {
      if (Array.isArray(m.content)) {
        // Convertir bloques con image_url → image base64 de Anthropic
        const content = m.content.map(b => {
          if (b.type === 'image_url') {
            const url = b.image_url?.url || ''
            const match = url.match(/^data:([^;]+);base64,(.+)$/)
            if (match) {
              return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }
            }
            return { type: 'text', text: '[imagen no disponible]' }
          }
          return b
        })
        out.push({ role: 'user', content })
      } else {
        out.push({ role: 'user', content: m.content })
      }
      i++

    } else if (m.role === 'assistant') {
      // El asistente puede tener content como string o array (Anthropic)
      out.push({ role: 'assistant', content: m.content })
      i++

    } else if (m.role === 'tool') {
      // Agrupar todos los role:tool consecutivos en un único mensaje user con tool_result
      const toolResults = []
      while (i < messages.length && messages[i].role === 'tool') {
        toolResults.push({
          type:        'tool_result',
          tool_use_id: messages[i].tool_call_id,
          content:     String(messages[i].content),
        })
        i++
      }
      out.push({ role: 'user', content: toolResults })

    } else {
      i++ // ignorar system u otros
    }
  }

  // Anthropic exige alternancia user/assistant y que empiece en user
  // Si hay dos mensajes del mismo rol consecutivos, insertar un spacer
  const fixed = []
  for (const msg of out) {
    if (fixed.length > 0 && fixed[fixed.length - 1].role === msg.role) {
      // Insertar mensaje vacío del otro rol
      const otroRol = msg.role === 'user' ? 'assistant' : 'user'
      fixed.push({ role: otroRol, content: otroRol === 'user' ? 'continúa' : '...' })
    }
    fixed.push(msg)
  }

  return fixed
}

// ── Handler principal ─────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel.' })
  }

  const { messages = [], contexto = '' } = req.body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un mensaje.' })
  }

  const systemContent = contexto
    ? `${SYSTEM_PROMPT}\n\nINFORMACIÓN DEL USUARIO:\n${contexto}`
    : SYSTEM_PROMPT

  const anthropicMessages = toAnthropic(messages)

  // Verificar que el primer mensaje sea user
  if (anthropicMessages[0]?.role !== 'user') {
    return res.status(400).json({ error: 'El primer mensaje debe ser del usuario.' })
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:        'claude-haiku-4-5-20251001',
        max_tokens:   2048,
        system:       systemContent,
        messages:     anthropicMessages,
        tools:        TOOLS,
        tool_choice:  { type: 'auto' },
      })
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('[chat] Anthropic error', resp.status, errText)
      return res.status(502).json({ error: `Error IA (${resp.status}). Intente de nuevo.` })
    }

    const data = await resp.json()

    // Buscar bloques en la respuesta
    const textBlock = (data.content || []).find(b => b.type === 'text')
    const toolBlock = (data.content || []).find(b => b.type === 'tool_use')

    // Claude quiere llamar una herramienta
    if (data.stop_reason === 'tool_use' && toolBlock) {
      return res.json({
        tipo: 'tool_calls',
        message: { role: 'assistant', content: data.content },
        tool_calls: [{
          id:       toolBlock.id,
          type:     'function',
          function: {
            name:      toolBlock.name,
            arguments: JSON.stringify(toolBlock.input || {}),
          }
        }]
      })
    }

    // Respuesta de texto
    return res.json({
      tipo:      'respuesta',
      contenido: textBlock?.text || (data.content || []).map(b => b.text || '').join('') || 'Sin respuesta.'
    })

  } catch (err) {
    console.error('[chat] Error interno:', err)
    return res.status(500).json({ error: 'Error interno del servidor.' })
  }
}
