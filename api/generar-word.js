// api/generar-word.js
// POST /api/generar-word  { informeId }
// Genera certificado .docx estilo WSS REG-DII-059

import { createClient } from '@supabase/supabase-js'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} from 'docx'

export const config = { maxDuration: 30 }

const SUPABASE_URL   = 'https://labxvesmcfbrdtftkwtg.supabase.co'
const PORTAL_URL     = 'https://sistema-de-calidad-wss.vercel.app'
const WSS_AZUL       = '1E3A5F'
const WSS_GRIS       = '64748B'
const BLANCO         = 'FFFFFF'
const GRIS_CLARO     = 'F1F5F9'

// ── Helpers de construcción ──────────────────────────────────────────────────

const borde = (color = 'CBD5E1') => ({ style: BorderStyle.SINGLE, size: 1, color })
const borderSet = (c) => ({ top: borde(c), bottom: borde(c), left: borde(c), right: borde(c) })
const sinBorde = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' })
const sinBordes = () => ({ top: sinBorde(), bottom: sinBorde(), left: sinBorde(), right: sinBorde() })

function cel(text, { bold, center, bg, color, size = 20, span, topBorderColor } = {}) {
  const borders = topBorderColor
    ? { top: borde(topBorderColor), bottom: borde(), left: borde(), right: borde() }
    : borderSet()
  return new TableCell({
    columnSpan: span,
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders,
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text ?? ''),
        bold: !!bold,
        size,
        font: 'Arial',
        color: color ?? (bg === WSS_AZUL ? BLANCO : '1E293B'),
      })],
    })],
  })
}

function infoRow(l1, v1, l2 = null, v2 = null, widths = [1400, 3400, 1400, 3400]) {
  const cells = [
    cel(l1, { bold: true, bg: GRIS_CLARO, size: 18 }),
    cel(v1, { size: 18 }),
  ]
  if (l2 !== null) {
    cells.push(cel(l2, { bold: true, bg: GRIS_CLARO, size: 18 }))
    cells.push(cel(v2, { size: 18 }))
  }
  return new TableRow({ children: cells })
}

function seccion(n, texto) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text: `${n}. ${texto.toUpperCase()}`, bold: true, size: 22, font: 'Arial', color: WSS_AZUL })],
  })
}

function subtitulo(texto) {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text: texto, bold: true, size: 20, font: 'Arial', color: WSS_AZUL })],
  })
}

function parrafo(texto, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text: String(texto ?? ''),
      size: opts.size || 20,
      font: 'Arial',
      bold: !!opts.bold,
      color: opts.color || '1E293B',
    })],
  })
}

function espaciador(pts = 100) {
  return new Paragraph({ spacing: { before: pts }, children: [] })
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { informeId } = req.body || {}
  if (!informeId) return res.status(400).json({ error: 'informeId requerido' })

  // Fetch informe
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: inf, error } = await supabase.from('informes').select('*').eq('id', informeId).single()
  if (error || !inf) return res.status(404).json({ error: 'Informe no encontrado' })

  // Fetch WSS logo
  let logoBuffer = null
  try {
    const r = await fetch(`${PORTAL_URL}/assets/wss-logo-horizontal-color.png`)
    if (r.ok) logoBuffer = Buffer.from(await r.arrayBuffer())
  } catch {}

  // Parse datos
  const datos      = inf.datos_equipo || {}
  const textoIA    = inf.texto_ia || {}
  const hallazgos  = inf.hallazgos || []
  const elementos  = datos.elementos_izaje || []
  const equipos    = datos.equipos_izaje_adicionales || []
  const endApl     = inf.end_aplicados || []
  const docNum     = inf.reg_dii_numero || `INF-${String(inf.id).substring(0, 8).toUpperCase()}`
  const fechaInsp  = inf.fecha_inspeccion
    ? new Date(inf.fecha_inspeccion + 'T12:00:00').toLocaleDateString('es-CL')
    : '—'
  const fechaEmis  = new Date().toLocaleDateString('es-CL')

  const tipoLabel = {
    IZAJE: 'EQUIPOS DE IZAJE Y LEVANTE',
    TANQUE: 'INSPECCIÓN DE TANQUES',
    TUBERIA: 'INSPECCIÓN DE TUBERÍAS',
    ESTRUCTURA: 'INSPECCIÓN ESTRUCTURAL',
  }[inf.tipo_equipo] || inf.tipo_equipo || 'INSPECCIÓN TÉCNICA'

  const resultColor = { ACEPTADO: '16A34A', RECHAZADO: 'DC2626', CONFORME: '16A34A', 'NO CONFORME': 'DC2626', CONDICIONADO: 'D97706' }[inf.resultado] || '1E3A5F'

  // ── Construir secciones del documento ─────────────────────────────────────
  const children = []

  // ── ENCABEZADO: Logo | Título + N° ──────────────────────────────────────
  const celdaLogo = new TableCell({
    width: { size: 3200, type: WidthType.DXA },
    borders: { ...sinBordes(), bottom: borde(WSS_AZUL) },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 0, right: 200 },
    children: [logoBuffer
      ? new Paragraph({ children: [new ImageRun({ type: 'png', data: logoBuffer, transformation: { width: 170, height: 58 }, altText: { title: 'WSS', description: 'WSS logo', name: 'wss' } })] })
      : new Paragraph({ children: [new TextRun({ text: 'WORLD SURVEY SERVICES S.A.', bold: true, size: 22, font: 'Arial', color: WSS_AZUL })] })
    ],
  })

  const celdaTitulo = new TableCell({
    width: { size: 6400, type: WidthType.DXA },
    shading: { fill: WSS_AZUL, type: ShadingType.CLEAR },
    borders: sinBordes(),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 180, right: 180 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CERTIFICADO DE EVALUACIÓN', bold: true, size: 28, font: 'Arial', color: BLANCO })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tipoLabel, bold: false, size: 20, font: 'Arial', color: 'BFD4F2' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: docNum, bold: true, size: 26, font: 'Arial Narrow', color: BLANCO })] }),
    ],
  })

  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [3200, 6400],
    rows: [new TableRow({ children: [celdaLogo, celdaTitulo] })],
  }))

  children.push(espaciador(100))

  // ── Datos cliente / OT ───────────────────────────────────────────────────
  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [1500, 3300, 1500, 3300],
    rows: [
      infoRow('Solicitante', inf.cliente_nombre || '—', 'Orden de Trabajo (OT)', inf.ot_numero || '—'),
      infoRow('Lugar / Instalación', inf.lugar || '—', 'Fecha Emisión', fechaEmis),
      infoRow('Atención', inf.supervisor_nombre || '—', 'Fecha Inspección', fechaInsp),
    ],
  }))

  children.push(espaciador(120))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'División Inspección Industrial — Sede Santiago', bold: true, size: 20, font: 'Arial', color: WSS_AZUL })],
  }))

  // ── 1. ALCANCES GENERALES ────────────────────────────────────────────────
  children.push(seccion('1', 'Alcances Generales'))
  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [2600, 7000],
    rows: [
      new TableRow({ children: [cel('Inspector(es)', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.inspector_nombre || '—', { size: 18 })] }),
      new TableRow({ children: [cel('Certificación SNT TC-1A', { bold: true, bg: GRIS_CLARO, size: 18 }), cel('Nivel II / Nivel III según corresponde', { size: 18 })] }),
      new TableRow({ children: [cel('Fecha ejecución servicio', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(fechaInsp, { size: 18 })] }),
      new TableRow({ children: [cel('Descripción muestra(s)', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(
        elementos.length > 0
          ? elementos.map(e => `${e.tipo}${e.n_sello ? ` N°Sello: ${e.n_sello}` : ''}`).join(' / ')
          : (inf.tipo_equipo || '—'),
        { size: 18 }
      )] }),
      new TableRow({ children: [cel('Norma(s) Ejecución', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.norma_ejecucion || '—', { size: 18 })] }),
      new TableRow({ children: [cel('Norma(s) Evaluación', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.norma_evaluacion || '—', { size: 18 })] }),
      new TableRow({ children: [cel('Métodos END Aplicados', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(endApl.join(', ') || '—', { size: 18 })] }),
      new TableRow({ children: [cel('Procedimientos WSS', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.procedimientos || '—', { size: 18 })] }),
    ],
  }))

  // ── 2. PROCEDIMIENTO ─────────────────────────────────────────────────────
  children.push(seccion('2', 'Procedimiento'))
  children.push(parrafo(
    textoIA.introduccion ||
    'El producto descrito en el presente certificado ha sido inspeccionado por World Survey Services S.A. (WSS), organismo de inspección acreditado por el INN (OI 376 — Ensayos No Destructivos / OI 377 — Equipos de Izaje y Levante), según NCh-ISO 17020:2012 Tipo A, con reconocimiento internacional ILAC-MRA. De acuerdo a los resultados obtenidos, se emite el presente certificado según se detalla a continuación.'
  ))

  // ── 3. ANTECEDENTES DEL EQUIPO ───────────────────────────────────────────
  children.push(seccion('3', 'Antecedentes del Equipo'))
  const eq = (equipos.length > 0 && equipos[0]) ? equipos[0] : datos
  const tieneEquipoMayor = Object.keys(eq).some(k =>
    ['tipo_equipo_izaje','marca','modelo','numero_serie','capacidad_ton'].includes(k) && eq[k]
  )
  if (tieneEquipoMayor) {
    children.push(new Table({
      width: { size: 9600, type: WidthType.DXA },
      columnWidths: [1600, 3200, 1600, 3200],
      rows: [
        infoRow('Nombre del Equipo', eq.tipo_equipo_izaje || datos.tipo_equipo_izaje || '—', 'N° Serie', eq.numero_serie || datos.numero_serie || '—'),
        infoRow('Marca', eq.marca || datos.marca || '—', 'Año Fabricación', eq.año_fabricacion || datos.año_fabricacion || '—'),
        infoRow('Modelo', eq.modelo || datos.modelo || '—', 'Capacidad (ton)', eq.capacidad_ton || datos.capacidad_ton || '—'),
        infoRow('Prueba de Carga', eq.prueba_carga || datos.prueba_carga || '—', 'Ubicación', inf.lugar || '—'),
        infoRow('Estado Estructura', eq.estado_estructura || datos.estado_estructura || '—', 'Estado Componentes', eq.estado_componentes || datos.estado_componentes || '—'),
      ],
    }))
  } else {
    children.push(parrafo('Inspección realizada sobre los elementos individuales detallados en la sección 4.'))
  }

  // ── 4. ELEMENTOS INSPECCIONADOS (IZAJE) ──────────────────────────────────
  if (elementos.length > 0) {
    children.push(seccion('4', 'Elementos de Izaje Inspeccionados'))
    const hdrRow = new TableRow({
      tableHeader: true,
      children: [
        cel('N°',          { bold: true, bg: WSS_AZUL, color: BLANCO, center: true, size: 18 }),
        cel('Tipo',        { bold: true, bg: WSS_AZUL, color: BLANCO, size: 18 }),
        cel('N° Sello',    { bold: true, bg: WSS_AZUL, color: BLANCO, center: true, size: 18 }),
        cel('Descripción', { bold: true, bg: WSS_AZUL, color: BLANCO, size: 18 }),
        cel('Resultado',   { bold: true, bg: WSS_AZUL, color: BLANCO, center: true, size: 18 }),
      ],
    })
    const dataRows = elementos.map((el, i) => {
      const cumple = el.resultado === 'CUMPLE'
      return new TableRow({
        children: [
          cel(String(i + 1),                                { center: true, size: 18 }),
          cel(el.tipo        || '—',                        { size: 18 }),
          cel(el.n_sello     || 'S/I',                      { center: true, size: 18 }),
          cel(el.descripcion || '—',                        { size: 18 }),
          cel(cumple ? 'CUMPLE' : 'NO CUMPLE',             { bold: true, center: true, size: 18, color: cumple ? '16A34A' : 'DC2626' }),
        ],
      })
    })
    children.push(new Table({
      width: { size: 9600, type: WidthType.DXA },
      columnWidths: [500, 2200, 1300, 3400, 2200],
      rows: [hdrRow, ...dataRows],
    }))

    // Observaciones de rechazados
    const rechazados = elementos.filter(e => e.resultado === 'NO_CUMPLE' && e.observacion)
    if (rechazados.length > 0) {
      children.push(espaciador(100))
      children.push(subtitulo('Observaciones de elementos no conformes:'))
      rechazados.forEach(el => {
        children.push(parrafo(
          `• ${el.tipo}${el.n_sello ? ` (Sello: ${el.n_sello})` : ''}: ${el.observacion}`,
          { color: '991B1B' }
        ))
      })
    }
  } else {
    // Para tipos no IZAJE: tabla de alcance de inspección estándar
    children.push(seccion('4', 'Alcance de Inspección, Normas y Especificaciones'))
    children.push(parrafo(textoIA.end_realizados || 'Los alcances de inspección se describen en los resultados adjuntos.'))
  }

  // ── 5. RESULTADOS ────────────────────────────────────────────────────────
  children.push(seccion('5', 'Resultados'))
  if (textoIA.end_realizados) {
    children.push(subtitulo('5.1 Métodos de Ensayo No Destructivos Realizados'))
    children.push(parrafo(textoIA.end_realizados))
  }
  if (textoIA.hallazgos) {
    children.push(subtitulo('5.2 Hallazgos'))
    children.push(parrafo(textoIA.hallazgos))
  }
  if (textoIA.evaluacion) {
    children.push(subtitulo('5.3 Evaluación Técnica'))
    children.push(parrafo(textoIA.evaluacion))
  }

  // ── 6. OBSERVACIONES DETECTADAS ─────────────────────────────────────────
  children.push(seccion('6', 'Observaciones Detectadas'))
  if (hallazgos.length > 0) {
    hallazgos.forEach((h, i) => {
      children.push(new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({ text: `${i + 1}. [${h.criticidad || 'Menor'}]  `, bold: true, size: 20, font: 'Arial', color: 'DC2626' }),
          new TextRun({ text: h.descripcion || '', size: 20, font: 'Arial' }),
          h.ubicacion ? new TextRun({ text: `  —  Ubicación: ${h.ubicacion}`, size: 18, font: 'Arial', color: WSS_GRIS }) : new TextRun({ text: '' }),
          h.norma     ? new TextRun({ text: `  (${h.norma})`, size: 18, font: 'Arial', color: WSS_GRIS })                 : new TextRun({ text: '' }),
        ],
      }))
    })
  } else {
    children.push(parrafo('Sin observaciones significativas detectadas durante la inspección.'))
  }

  // ── 7. ENTIDAD CERTIFICADORA ─────────────────────────────────────────────
  children.push(seccion('7', 'Entidad Certificadora'))
  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [2600, 7000],
    rows: [
      new TableRow({ children: [cel('Razón Social',        { bold: true, bg: GRIS_CLARO, size: 18 }), cel('World Survey Services S.A.',              { size: 18 })] }),
      new TableRow({ children: [cel('Acreditación',        { bold: true, bg: GRIS_CLARO, size: 18 }), cel('INN — NCh-ISO 17020:2012 Tipo A | OI 376 (END) / OI 377 (Izaje) | ILAC-MRA', { size: 18 })] }),
      new TableRow({ children: [cel('Orden de Trabajo',    { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.ot_numero || '—',                      { size: 18 })] }),
      new TableRow({ children: [cel('Fecha Inspección',    { bold: true, bg: GRIS_CLARO, size: 18 }), cel(fechaInsp,                                 { size: 18 })] }),
      new TableRow({ children: [cel('Fecha Emisión',       { bold: true, bg: GRIS_CLARO, size: 18 }), cel(fechaEmis,                                 { size: 18 })] }),
      new TableRow({ children: [cel('Lugar Inspección',    { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.lugar || '—',                          { size: 18 })] }),
      new TableRow({ children: [cel('Inspector',           { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.inspector_nombre || '—',               { size: 18 })] }),
      new TableRow({ children: [cel('Supervisor',          { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.supervisor_nombre || '—',              { size: 18 })] }),
    ],
  }))

  // ── 8. CONCLUSIÓN ────────────────────────────────────────────────────────
  children.push(seccion('8', 'Conclusión'))
  children.push(parrafo(
    textoIA.conclusion ||
    `De acuerdo a los resultados obtenidos en la inspección realizada, el equipo / elementos inspeccionados presentan un resultado: ${inf.resultado || '—'}.`
  ))
  children.push(espaciador(80))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: `RESULTADO:  ${(inf.resultado || '—').toUpperCase()}`, bold: true, size: 32, font: 'Arial', color: resultColor })],
  }))

  // ── 9. RECOMENDACIONES ───────────────────────────────────────────────────
  children.push(seccion('9', 'Recomendaciones'))
  children.push(parrafo(
    textoIA.recomendaciones ||
    'Se recomienda mantener el programa de mantenimiento preventivo e inspección periódica conforme a las normas aplicables.'
  ))

  // ── BLOQUE DE FIRMAS ─────────────────────────────────────────────────────
  children.push(espaciador(320))
  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [4800, 4800],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: { top: borde('475569'), bottom: sinBorde(), left: sinBorde(), right: sinBorde() },
          margins: { top: 80, left: 200, right: 200 },
          children: [
            parrafo(inf.inspector_nombre || '___________________________', { bold: true }),
            parrafo('Inspector END', { color: WSS_GRIS, size: 18 }),
            parrafo('División Inspección Industrial', { color: WSS_GRIS, size: 18 }),
            parrafo('World Survey Services S.A.', { color: WSS_GRIS, size: 16 }),
          ],
        }),
        new TableCell({
          borders: { top: borde('475569'), bottom: sinBorde(), left: sinBorde(), right: sinBorde() },
          margins: { top: 80, left: 200, right: 200 },
          children: [
            parrafo(inf.supervisor_nombre || '___________________________', { bold: true }),
            parrafo('Jefe División Inspección Industrial', { color: WSS_GRIS, size: 18 }),
            parrafo('World Survey Services S.A.', { color: WSS_GRIS, size: 16 }),
          ],
        }),
      ],
    })],
  }))

  // ── PIE DE PÁGINA ACREDITACIÓN ───────────────────────────────────────────
  children.push(espaciador(200))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: WSS_AZUL } },
    children: [new TextRun({
      text: 'Organismo de Inspección Acreditado INN — OI 376 (Ensayos No Destructivos) / OI 377 (Equipos de Izaje y Levante) | NCh-ISO 17020:2012 Tipo A | ILAC-MRA',
      size: 14, font: 'Arial', color: WSS_GRIS,
    })],
  }))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Documento N° ${docNum} · Generado: ${fechaEmis}`, size: 14, font: 'Arial', color: 'CBD5E1' })],
  }))

  // ── Build ────────────────────────────────────────────────────────────────
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const safe   = (s) => String(s || '').replace(/[^A-Z0-9_\-]/gi, '')
  const fname  = `WSS_${safe(inf.tipo_equipo)}_${safe(inf.ot_numero)}_${safe(docNum)}.docx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
  res.end(buffer)
}
