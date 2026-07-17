// ============================================================
// api/chat.js — Vercel Serverless Function
// Puente seguro entre la app WSS y OpenAI GPT-4o.
// El API key vive en el servidor — nunca se expone al cliente.
// ============================================================

const SYSTEM_PROMPT = `Eres el asistente de inteligencia artificial de WSS Testing & Certification Chile, empresa especializada en inspeccion industrial y ensayos no destructivos (END).

Tu nombre es "Asistente WSS". Ayudas a los usuarios del Sistema de Calidad WSS con:
- Tecnicas END: VT (visual), MT (particulas magneticas), PT (liquidos penetrantes), UT (ultrasonido), RT (radiografia), TOFD, Phased Array
- Normas tecnicas: ISO 17020, ISO 9712, AWS D1.1, ASME B31.1/B31.3, API 570/580, NCh 2369, EPCRC, DS43
- Gestion de OTs (ordenes de trabajo), asignaciones de inspectores, generacion de informes
- Analisis de actas de terreno, certificados e informes tecnicos
- Criterios de aceptacion y rechazo segun normativa aplicable
- Orientacion sobre el flujo de trabajo en el sistema

Contexto operacional: mineria e industria chilena. Responde siempre en espanol tecnico y claro.
Se concreto y orientado a la accion. Cuando el usuario mencione una OT o asignaciones, usa las herramientas para buscar datos reales del sistema antes de responder.
Si el usuario sube una imagen de un documento tecnico, analiza en detalle: condicion del equipo, indicaciones, medidas, estado general.
Cuando no tengas certeza de un criterio normativo, indicalo claramente.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_ots',
      description: 'Busca ordenes de trabajo (OTs) en el sistema WSS. Usa esta herramienta cuando el usuario pregunte por una OT especifica, quiera ver sus ordenes activas, o consulte el estado de algun trabajo de inspeccion.',
      parameters: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Numero de OT o texto para buscar (cliente, descripcion). Puede omitirse para listar todas.'
          },
          estado: {
            type: 'string',
            description: 'Filtrar por estado especifico de la OT',
            enum: ['Pendiente de asignacion', 'En proceso', 'Asignada', 'Informe enviado', 'Cerrada documentalmente']
          },
          limite: {
            type: 'integer',
            description: 'Numero maximo de resultados a retornar. Default: 5, maximo: 20'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'obtener_asignaciones',
      description: 'Obtiene asignaciones de inspeccion del sistema. Util cuando el usuario pregunta por inspecciones programadas, trabajos en campo o asignaciones pendientes.',
      parameters: {
        type: 'object',
        properties: {
          dias: {
            type: 'integer',
            description: 'Numero de dias hacia adelante para consultar. Default: 7'
          },
          estado: {
            type: 'string',
            description: 'Estado de la asignacion',
            enum: ['Programada', 'Realizada', 'Cancelada', 'Pendiente']
          }
        },
        required: []
      }
    }
  }
]

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY no configurada en Vercel')
    return res.status(500).json({ error: 'API key no configurada. Contacte a administracion.' })
  }

  const { messages = [], contexto = '' } = req.body

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Campo "messages" debe ser un arreglo' })
  }

  // System prompt con contexto del usuario inyectado
  const systemContent = contexto
    ? `${SYSTEM_PROMPT}\n\nINFORMACION DEL USUARIO ACTUAL:\n${contexto}`
    : SYSTEM_PROMPT

  const allMessages = [
    { role: 'system', content: systemContent },
    ...messages
  ]

  try {
    const oaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: allMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 2000,
        temperature: 0.4
      })
    })

    if (!oaiResp.ok) {
      const errBody = await oaiResp.text()
      console.error('OpenAI error:', oaiResp.status, errBody)
      if (oaiResp.status === 429) {
        return res.status(429).json({ error: 'Limite de uso alcanzado. Intente en unos segundos.' })
      }
      return res.status(502).json({ error: 'Error al contactar el modelo de IA.' })
    }

    const data = await oaiResp.json()
    const choice = data.choices?.[0]

    if (!choice) {
      return res.status(500).json({ error: 'Respuesta inesperada del modelo.' })
    }

    // GPT quiere llamar una herramienta — devolver al cliente para ejecucion
    if (choice.finish_reason === 'tool_calls') {
      return res.json({
        tipo: 'tool_calls',
        message: choice.message,
        tool_calls: choice.message.tool_calls
      })
    }

    // Respuesta de texto normal
    return res.json({
      tipo: 'respuesta',
      contenido: choice.message.content
    })

  } catch (e) {
    console.error('Error handler chat:', e)
    return res.status(500).json({ error: 'Error interno del servidor.' })
  }
}
