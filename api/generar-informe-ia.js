// api/generar-informe-ia.js
// POST /api/generar-informe-ia
// Recibe datos del formulario y retorna texto técnico generado por Claude

export const config = { maxDuration: 60 }

const NORMAS_POR_TIPO = {
  TANQUE:     'API 650, API 653, ASME, NCh2136, NCh2190',
  TUBERIA:    'API 570, API 574, ASME B31.3, ASME B31.1',
  ESTRUCTURA: 'AWS D1.1, AWS D1.2, ASME BPVC Secc. V',
  IZAJE:      'ASME B30.2, B30.5, B30.9, B30.23, NCh-ISO 17020:2012',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

  const {
    tipo_equipo, ot_numero, cliente_nombre, lugar, fecha_inspeccion,
    inspector_nombre, supervisor_nombre, datos_equipo, end_aplicados, mediciones, hallazgos, resultado,
    norma_ejecucion, norma_evaluacion, procedimientos,
  } = req.body

  // Normas: combinar las definidas en la asignación con las de referencia del tipo
  const normasBase = NORMAS_POR_TIPO[tipo_equipo] || ''
  const normas = [
    norma_ejecucion  ? `Norma de ejecución del ensayo: ${norma_ejecucion}` : null,
    norma_evaluacion ? `Criterios de evaluación / aceptación: ${norma_evaluacion}` : null,
    `Normas de referencia del tipo de equipo: ${normasBase}`,
  ].filter(Boolean).join('\n')

  // Formatear mediciones
  const medicionesTexto = (mediciones || []).length > 0
    ? '\nMEDICIONES DE ESPESORES:\n' + mediciones.map(m =>
        `  - ${m.zona}: Nominal ${m.nominal_mm}mm | Medido ${m.medido_mm}mm | Pérdida: ${(((m.nominal_mm - m.medido_mm) / m.nominal_mm) * 100).toFixed(1)}%`
      ).join('\n')
    : ''

  // Formatear hallazgos
  const hallazgosTexto = (hallazgos || []).length > 0
    ? hallazgos.map((h, i) =>
        `  ${i + 1}. [${h.criticidad}] ${h.descripcion}\n     Ubicación: ${h.ubicacion || 'N/E'} | Norma: ${h.norma || 'N/E'}`
      ).join('\n')
    : '  Sin hallazgos significativos detectados.'

  const prompt = `Eres un ingeniero inspector industrial senior de WSS (World Survey Services S.A., Chile), organismo de inspección acreditado por el INN (OI 376 - Ensayos No Destructivos y OI 377 - Equipos de Izaje y Levante), según NCh-ISO 17020:2012, Tipo A, con reconocimiento internacional ILAC-MRA.

Redacta un informe técnico de inspección en español formal y normativo para:

TIPO DE EQUIPO: ${tipo_equipo}
OT: ${ot_numero || 'N/D'}
CLIENTE: ${cliente_nombre || 'N/D'}
LUGAR / INSTALACIÓN: ${lugar || 'N/D'}
FECHA DE INSPECCIÓN: ${fecha_inspeccion || 'N/D'}
INSPECTOR: ${inspector_nombre || 'N/D'}
SUPERVISOR: ${supervisor_nombre || 'N/D'}

CARACTERÍSTICAS DEL EQUIPO:
${Object.entries(datos_equipo || {}).map(([k, v]) => `  - ${k}: ${v}`).join('\n') || '  N/D'}

MÉTODOS END APLICADOS: ${(end_aplicados || []).join(', ') || 'N/D'}
${medicionesTexto}

HALLAZGOS DETECTADOS:
${hallazgosTexto}

RESULTADO: ${resultado || 'N/D'}

NORMAS Y PROCEDIMIENTOS APLICADOS:
${normas}
${procedimientos ? `\nPROCEDIMIENTOS WSS UTILIZADOS:\n${procedimientos}` : ''}

Genera el informe como JSON con exactamente estas 7 secciones. Cada sección debe ser un párrafo técnico completo (3-5 oraciones mínimo), usando terminología normativa apropiada:

{
  "introduccion": "párrafo introductorio con alcance, cliente, equipo inspeccionado y acreditación WSS",
  "descripcion_equipo": "descripción técnica detallada del equipo con todas sus características relevantes",
  "end_realizados": "descripción de los métodos END aplicados, personal calificado y alcance de cada ensayo",
  "hallazgos": "descripción técnica detallada de cada hallazgo con referencia normativa, ubicación y evaluación",
  "evaluacion": "evaluación técnica del estado general del equipo según las normas aplicables",
  "conclusion": "conclusión con resultado formal de la inspección (CONFORME/NO CONFORME/CONDICIONADO) y justificación técnica",
  "recomendaciones": "recomendaciones técnicas específicas, plazos y acciones correctivas si aplican"
}

Responde ÚNICAMENTE con el JSON, sin texto adicional.`

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await anthropicRes.json()
    if (data.error) throw new Error(data.error.message)

    const texto = data.content?.[0]?.text || ''

    // Extraer JSON de la respuesta
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('IA no retornó JSON válido')

    const resultado_ia = JSON.parse(jsonMatch[0])

    return res.status(200).json({ ok: true, texto_ia: resultado_ia })
  } catch (err) {
    console.error('[generar-informe-ia]', err)
    return res.status(500).json({ error: err.message })
  }
}
