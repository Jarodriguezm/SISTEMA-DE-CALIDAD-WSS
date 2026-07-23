// ============================================================
// api/chat.js — Vercel Serverless Function
// Asistente "María" de WSS — powered by Anthropic Claude
// Migrado desde GPT-4o: usa ANTHROPIC_API_KEY (ya configurado en Vercel)
// ============================================================

const SYSTEM_PROMPT = `Eres María, la asistente de inteligencia artificial de WSS Testing & Certification Chile, empresa especializada en inspección industrial y ensayos no destructivos (END).

Tu nombre es María. Si alguien te pregunta cómo te llamas, dices que eres María, la asistente IA de WSS. Ayudas a los usuarios del Sistema de Calidad WSS con:
- Técnicas END: VT (visual), MT (partículas magnéticas), PT (líquidos penetrantes), UT (ultrasonido), RT (radiografía), TOFD, Phased Array, PAUT
- Normas técnicas: ISO 17020, ISO 9712, AWS D1.1, ASME B30 (completo), ASME B31.1/B31.3, API 570/580/653, NCh 2369, DS 43/2015, INN OI376/OI377
- Gestión de OTs (órdenes de trabajo), asignaciones de inspectores, generación de informes
- Análisis de actas de terreno, certificados e informes técnicos
- Criterios de aceptación y rechazo según normativa aplicable (ASME B30.9 eslingas, B30.10 ganchos, ISO 4309 cables, etc.)
- Orientación sobre el flujo de trabajo en el sistema
- Cálculos técnicos: pérdida de espesor, cargas, factores de seguridad

Contexto operacional: minería e industria chilena. Responde siempre en español técnico y claro.
Sé concreto y orientado a la acción. Cuando el usuario mencione una OT o asignaciones, usa las herramientas para buscar datos reales del sistema antes de responder.
Si el usuario sube una imagen de un documento técnico, analiza en detalle: condición del equipo, indicaciones, medidas, estado general.
Cuando no tengas certeza de un criterio normativo, indícalo claramente.`

const TOOLS = [
  {
    name: 'buscar_ots',
    description: 'Busca órdenes de trabajo (OTs) en el sistema WSS. Usa esta herramienta cuando el usuario pregunte por una OT específica, quiera ver sus órdenes activas, o consulte el estado de algún trabajo de inspección.',
    input_schema: {
      type: 'object',
      properties: {
        busqueda: {
          type: 'string',
          description: 'Número de OT o texto para buscar (cliente, descripción). Puede omitirse para listar todas.'
        },
        estado: {
          type: 'string',
          description: 'Filtrar por estado específico de la OT',
          enum: ['Pendiente de asignacion', 'En proceso', 'Asignada', 'Informe enviado', 'Cerrada documentalmente']
        },
        limite: {
          type: 'integer',
          description: 'Número máximo de resultados a retornar. Default: 5, máximo: 20'
        }
      },
      required: []
    }
  },
  {
    name: 'obtener_asignaciones',
    description: 'Obtiene asignaciones de inspección del sistema. Útil cuando el usuario pregunta por inspecciones programadas, trabajos en campo o asignaciones pendientes.',
    input_schema: {
      type: 'object',
      properties: {
        dias: {
          type: 'integer',
          description: 'Número de días hacia adelante para consultar. Default: 7'
        },
        estado: {
          type: 'string',
          description: 'Estado de la asignación',
          enum: ['Programada', 'Realizada', 'Cancelada', 'Pendiente']
        }
      },
      required: []
    }
  }
]

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY no configurada en Vercel')
    return res.status(500).json({ error: 'API key no configurada. Contacte a administración.' })
  }

  const { messages = [], contexto = '' } = req.body

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Campo "messages" debe ser un arreglo' })
  }

  // System prompt con contexto del usuario
  const systemContent = contexto
    ? `${SYSTEM_PROMPT}\n\nINFORMACIÓN DEL USUARIO ACTUAL:\n${contexto}`
    : SYSTEM_PROMPT

  // Convertir mensajes: Anthropic no acepta mensajes de sistema en el array
  // Solo roles 'user' y 'assistant'
  const anthropicMessages = messages.filter(m => m.role !== 'system')

  // Anthropic requiere que el primer mensaje sea 'user'
  if (anthropicMessages.length === 0 || anthropicMessages[0].role !== 'user') {
    return res.status(400).json({ error: 'Se requiere al menos un mensaje de usuario' })
  }

  try {
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemContent,
        messages: anthropicMessages,
        tools: TOOLS,
        tool_choice: { type: 'auto' },
      })
    })

    if (!anthropicResp.ok) {
      const errBody = await anthropicResp.text()
      console.error('Anthropic error:', anthropicResp.status, errBody)
      if (anthropicResp.status === 429) {
        return res.status(429).json({ error: 'Límite de uso alcanzado. Intente en unos segundos.' })
      }
      return res.status(502).json({ error: 'Error al contactar el modelo de IA.' })
    }

    const data = await anthropicResp.json()

    // Anthropic devuelve content como array de bloques
    const textBlock = data.content?.find(b => b.type === 'text')
    const toolBlock = data.content?.find(b => b.type === 'tool_use')

    // María quiere llamar una herramienta
    if (data.stop_reason === 'tool_use' && toolBlock) {
      return res.json({
        tipo: 'tool_calls',
        message: {
          role: 'assistant',
          content: data.content,
        },
        tool_calls: [{
          id: toolBlock.id,
          type: 'function',
          function: {
            name: toolBlock.name,
            arguments: JSON.stringify(toolBlock.input),
          }
        }]
      })
    }

    // Respuesta de texto normal
    return res.json({
      tipo: 'respuesta',
      contenido: textBlock?.text || data.content?.[0]?.text || 'Sin respuesta.'
    })

  } catch (e) {
    console.error('Error handler chat:', e)
    return res.status(500).json({ error: 'Error interno del servidor.' })
  }
}
