// supabase/functions/revisar-informe/index.ts
// WSS · Sistema de Calidad
// Analiza un informe con Claude Haiku y retorna score + sugerencias + texto mejorado
// Requiere secret: ANTHROPIC_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY no configurado en Supabase secrets')

    const { informe } = await req.json()
    if (!informe) throw new Error('Falta el campo "informe" en el body')

    const textoIA   = informe.texto_ia   || {}
    const hallazgos = Array.isArray(informe.hallazgos) ? informe.hallazgos : []

    const seccionesResumen = [
      'introduccion', 'descripcion_equipo', 'end_realizados',
      'hallazgos', 'evaluacion', 'conclusion', 'recomendaciones',
    ].map(k => `  • ${k}: ${textoIA[k] ? textoIA[k].slice(0, 250) : '(vacío)'}`)
    .join('\n')

    const prompt = `Eres un experto en inspección de calidad industrial (END, NDT) y redacción de informes técnicos según normas ASME, API, AWS y similares.

Analiza el siguiente informe de inspección y retorna un JSON con:
1. score (0-100): calidad global del informe
2. sugerencias: array de objetos con tipo, campo y mensaje
3. texto_mejorado: objeto con las secciones que requieren mejora o están vacías

DATOS DEL INFORME:
- Tipo equipo: ${informe.tipo_equipo || '—'}
- OT: ${informe.ot_numero || '—'}
- Cliente: ${informe.cliente_nombre || '—'}
- Inspector: ${informe.inspector_nombre || '—'}
- Resultado: ${informe.resultado || '—'}
- Norma/Código: ${informe.norma_codigo || '—'}
- Lugar: ${informe.lugar || '—'}
- Hallazgos: ${hallazgos.length} (${hallazgos.filter(h => h.criticidad === 'CRITICO').length} críticos)
- Secciones de texto:
${seccionesResumen}

CRITERIOS DE EVALUACIÓN:
- Secciones vacías restan puntos (cada sección vacía: -10 pts)
- Texto genérico o sin datos técnicos concretos: -5 pts por sección
- Falta de referencia a norma específica: -8 pts
- Conclusión sin resultado claro: -10 pts
- Recomendaciones concretas y accionables: +5 pts
- Texto profesional y técnico: +5 pts

REGLAS DE RESPUESTA:
- Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional
- Solo incluye en texto_mejorado las secciones que estén vacías o muy pobres
- El texto mejorado debe ser profesional, técnico y coherente con los datos del informe
- Tipos de sugerencia válidos: campo_faltante | inconsistencia | norma | mejora_texto

FORMATO EXACTO:
{
  "score": 72,
  "sugerencias": [
    {"tipo": "campo_faltante", "campo": "conclusion", "mensaje": "La sección conclusión está vacía. Es obligatoria para cualquier informe de inspección."},
    {"tipo": "norma", "campo": "evaluacion", "mensaje": "Citar la cláusula específica de la norma aplicada (ej: API 653 sección 6.4)."},
    {"tipo": "mejora_texto", "campo": "introduccion", "mensaje": "La introducción no menciona el alcance ni los criterios de aceptación utilizados."}
  ],
  "texto_mejorado": {
    "conclusion": "En base a los ensayos realizados y los criterios de la norma ${informe.norma_codigo || 'aplicable'}, el equipo inspeccionado presenta..."
  }
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || `Anthropic API error ${response.status}`)
    }

    const aiData = await response.json()
    const text = aiData.content?.[0]?.text || ''

    // Extraer JSON (por si Haiku agrega algo antes/después)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('La IA no retornó JSON válido: ' + text.slice(0, 200))

    const result = JSON.parse(match[0])

    // Validar estructura mínima
    if (typeof result.score !== 'number') result.score = 50
    if (!Array.isArray(result.sugerencias)) result.sugerencias = []
    if (typeof result.texto_mejorado !== 'object') result.texto_mejorado = {}

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[revisar-informe]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
