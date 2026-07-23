// api/generar-word.js
// POST /api/generar-word  { informeId }
// Genera certificado / informe .docx estilo WSS

import { createClient } from '@supabase/supabase-js'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} from 'docx'

export const config = { maxDuration: 60 }

const SUPABASE_URL = 'https://labxvesmcfbrdtftkwtg.supabase.co'
const PORTAL_URL   = 'https://sistema-de-calidad-wss.vercel.app'
const WSS_AZUL     = '1E3A5F'
const WSS_GRIS     = '64748B'
const BLANCO       = 'FFFFFF'
const GRIS_CLARO   = 'F1F5F9'
const ROJO         = 'DC2626'
const VERDE        = '16A34A'

// ── REG-DII por tipo de END / inspección ─────────────────────────────────────
// Prioridad: endAplicados[0] → tipo_equipo
const REG_MAP = {
  VT:        { reg: 'REG-DII-001', rev: 'REV.04' },
  PT:        { reg: 'REG-DII-003', rev: 'REV.04' },
  LP:        { reg: 'REG-DII-003', rev: 'REV.04' },
  MT:        { reg: 'REG-DII-005', rev: 'REV.04' },
  PM:        { reg: 'REG-DII-005', rev: 'REV.04' },
  UT:        { reg: 'REG-DII-007', rev: 'REV.03' },
  RT:        { reg: 'REG-DII-009', rev: 'REV.02' },
  PAUT:      { reg: 'REG-DII-021', rev: 'REV.01' },
  TOFD:      { reg: 'REG-DII-023', rev: 'REV.01' },
  IZAJE:     { reg: 'REG-DII-011', rev: 'REV.04' },
  TANQUE:    { reg: 'REG-DII-015', rev: 'REV.03' },
  TUBERIA:   { reg: 'REG-DII-013', rev: 'REV.03' },
  ESTRUCTURA:{ reg: 'REG-DII-017', rev: 'REV.02' },
}

// Descripción resumida de la muestra inspeccionada
const MUESTRA_LABEL = {
  IZAJE:      'Elementos de Izaje y Levante',
  TANQUE:     'Recipiente / Tanque de Almacenamiento',
  TUBERIA:    'Sistema de Tuberías en Proceso',
  ESTRUCTURA: 'Estructura Metálica / Civil',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const borde     = (c = 'CBD5E1') => ({ style: BorderStyle.SINGLE, size: 1, color: c })
const borderSet = (c)            => ({ top: borde(c), bottom: borde(c), left: borde(c), right: borde(c) })
const sinBorde  = ()             => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' })
const sinBordes = ()             => ({ top: sinBorde(), bottom: sinBorde(), left: sinBorde(), right: sinBorde() })
const blancoBg  = ()             => ({ fill: BLANCO, type: ShadingType.CLEAR })

function cel(text, { bold, center, bg, color, size = 20, span } = {}) {
  return new TableCell({
    columnSpan:    span,
    shading:       { fill: bg || BLANCO, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 60, bottom: 60, left: 100, right: 100 },
    borders:       borderSet(),
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children:  [new TextRun({
        text:  String(text ?? ''),
        bold:  !!bold,
        size,
        font:  'Arial',
        color: color ?? (bg === WSS_AZUL ? BLANCO : '1E293B'),
      })],
    })],
  })
}

function infoRow(l1, v1, l2 = null, v2 = null) {
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
    spacing: { before: 300, after: 100 },
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
    spacing:   { before: 60, after: 60 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children:  [new TextRun({
      text:  String(texto ?? ''),
      size:  opts.size || 20,
      font:  'Arial',
      bold:  !!opts.bold,
      italic:!!opts.italic,
      color: opts.color || '1E293B',
    })],
  })
}

function espaciador(pts = 100) {
  return new Paragraph({ spacing: { before: pts }, children: [] })
}

async function fetchImg(url) {
  if (!url) return null
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return Buffer.from(await r.arrayBuffer())
  } catch { return null }
}

function tipoImg(url = '') {
  return (url.includes('.jpg') || url.includes('.jpeg')) ? 'jpg' : 'png'
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { informeId } = req.body || {}
  if (!informeId) return res.status(400).json({ error: 'informeId requerido' })

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Fetch informe
  const { data: inf, error } = await supabase.from('informes').select('*').eq('id', informeId).single()
  if (error || !inf) return res.status(404).json({ error: 'Informe no encontrado' })

  // Fetch OT para obtener contacto cliente (campo 'contacto' → Yeric Flores, etc.)
  const { data: ot } = await supabase
    .from('ots')
    .select('contacto, email_cliente, telefono_cliente')
    .eq('ot_numero', inf.ot_numero)
    .maybeSingle()

  // Datos del informe
  const datos       = inf.datos_equipo || {}
  const textoIA     = inf.texto_ia || {}
  const hallazgos   = inf.hallazgos || []
  const elementos   = datos.elementos_izaje || []
  const equiposIzaje= datos.equipos_izaje_adicionales || []
  const endApl      = inf.end_aplicados || []
  const equiposMed  = datos.equipo_medicion || []
  const fotosUrls   = (datos.fotos_inspeccion || []).filter(Boolean).slice(0, 8)

  // Descargar imágenes en paralelo
  const [logoWSSBuf, logoINNBuf, ...fotosBufs] = await Promise.all([
    fetchImg(`${PORTAL_URL}/assets/wss-logo-horizontal-color.png`),
    fetchImg(`${PORTAL_URL}/assets/inn-acreditacion.png`),
    ...fotosUrls.map(u => fetchImg(u)),
  ])

  // ── Campos calculados ─────────────────────────────────────────────────────
  const docNum    = inf.reg_dii_numero || `INF-${String(inf.id).substring(0, 8).toUpperCase()}`
  const fechaInsp = inf.fecha_inspeccion
    ? new Date(inf.fecha_inspeccion + 'T12:00:00').toLocaleDateString('es-CL')
    : '—'
  const fechaEmis = new Date().toLocaleDateString('es-CL')

  // REG-DII según END aplicado o tipo inspección
  const endKey   = (endApl[0] || '').toUpperCase().split(' ')[0]
  const regInfo  = REG_MAP[endKey] || REG_MAP[inf.tipo_equipo] || { reg: 'REG-DII-000', rev: 'REV.01' }
  const regLabel = `${regInfo.reg}   ${regInfo.rev}   ${fechaEmis}`

  // Contacto cliente (Atención): buscar en OT primero
  const atencion = ot?.contacto || ot?.atencion || ot?.contacto_cliente
    || ot?.nombre_contacto || ot?.responsable_cliente
    || inf.supervisor_nombre || '—'

  // Inspectores (puede ser array en datos.inspectores_ot o string)
  const listaInsp    = (datos.inspectores_ot?.length > 0)
    ? datos.inspectores_ot
    : [inf.inspector_nombre || '—']
  const inspectoresStr = listaInsp.join(' / ')

  // Tipo documento según resultado
  const esRechazado     = ['RECHAZADO', 'NO CONFORME', 'NO_CONFORME'].includes((inf.resultado || '').toUpperCase())
  const tituloPrincipal = esRechazado ? 'INFORME DE INSPECCIÓN' : 'CERTIFICADO DE EVALUACIÓN'
  const resultColor     = {
    ACEPTADO: VERDE, CONFORME: VERDE,
    RECHAZADO: ROJO, 'NO CONFORME': ROJO, 'NO_CONFORME': ROJO,
    CONDICIONADO: 'D97706',
  }[(inf.resultado || '').toUpperCase()] || WSS_AZUL

  // Tipo de inspección (label largo)
  const tipoLabel = {
    IZAJE:      'EQUIPOS DE IZAJE Y LEVANTE',
    TANQUE:     'INSPECCIÓN DE TANQUES',
    TUBERIA:    'INSPECCIÓN DE TUBERÍAS',
    ESTRUCTURA: 'INSPECCIÓN ESTRUCTURAL',
  }[inf.tipo_equipo] || inf.tipo_equipo || 'INSPECCIÓN TÉCNICA'

  // Descripción resumida de la muestra
  const muestraLabel = MUESTRA_LABEL[inf.tipo_equipo] || tipoLabel

  // ── Construir documento ────────────────────────────────────────────────────
  const children = []

  // ═══ ENCABEZADO ══════════════════════════════════════════════════════════
  // 3 columnas: [WSS logo + REG code] | [Título azul + N°] | [INN logo]
  // Fondo BLANCO en celdas logo para evitar transparencia tipo parrilla

  const celdaWSS = new TableCell({
    width:         { size: 2800, type: WidthType.DXA },
    shading:       blancoBg(),
    borders:       { ...sinBordes(), bottom: borde(WSS_AZUL) },
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 60, bottom: 40, left: 0, right: 120 },
    children: [
      logoWSSBuf
        ? new Paragraph({ children: [new ImageRun({ type: 'png', data: logoWSSBuf, transformation: { width: 155, height: 52 }, altText: { title: 'WSS', description: 'WSS logo', name: 'wss' } })] })
        : parrafo('WORLD SURVEY SERVICES S.A.', { bold: true, color: WSS_AZUL }),
      new Paragraph({
        spacing: { before: 40 },
        children: [new TextRun({ text: regLabel, size: 13, font: 'Arial', color: WSS_GRIS, italic: true })],
      }),
    ],
  })

  const celdaTitulo = new TableCell({
    width:         { size: 4800, type: WidthType.DXA },
    shading:       { fill: WSS_AZUL, type: ShadingType.CLEAR },
    borders:       sinBordes(),
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 100, bottom: 100, left: 160, right: 160 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tituloPrincipal, bold: true, size: 24, font: 'Arial', color: BLANCO })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tipoLabel,        size: 18, font: 'Arial', color: 'BFD4F2' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: docNum, bold: true, size: 26, font: 'Arial Narrow', color: BLANCO })] }),
    ],
  })

  const celdaINN = new TableCell({
    width:         { size: 2000, type: WidthType.DXA },
    shading:       blancoBg(),
    borders:       { ...sinBordes(), bottom: borde(WSS_AZUL) },
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 60, bottom: 60, left: 120, right: 0 },
    children: [
      logoINNBuf
        ? new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: 'png', data: logoINNBuf, transformation: { width: 105, height: 65 }, altText: { title: 'INN', description: 'INN Acreditación', name: 'inn' } })] })
        : new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'INN OI376/OI377', size: 14, font: 'Arial', color: WSS_GRIS })] }),
    ],
  })

  children.push(new Table({
    width:        { size: 9600, type: WidthType.DXA },
    columnWidths: [2800, 4800, 2000],
    rows:         [new TableRow({ children: [celdaWSS, celdaTitulo, celdaINN] })],
  }))

  children.push(espaciador(100))

  // ═══ TABLA DATOS CLIENTE / OT ═════════════════════════════════════════════
  children.push(new Table({
    width:        { size: 9600, type: WidthType.DXA },
    columnWidths: [1600, 3200, 1600, 3200],
    rows: [
      infoRow('Solicitante',         inf.cliente_nombre || '—',  'Orden de Trabajo (OT)', inf.ot_numero || '—'),
      infoRow('Lugar / Instalación', inf.lugar          || '—',  'Fecha Emisión',         fechaEmis),
      infoRow('Atención',            atencion,                   'Fecha Inspección',      fechaInsp),
    ],
  }))

  children.push(espaciador(80))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'División Inspección Industrial — Sede Santiago', bold: true, size: 20, font: 'Arial', color: WSS_AZUL })],
  }))

  // ═══ INTRODUCCIÓN (sin número — texto normativo de la empresa) ════════════
  children.push(espaciador(120))
  children.push(new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: 'Introducción', bold: true, size: 20, font: 'Arial', color: WSS_AZUL, underline: {} })],
  }))
  children.push(parrafo(
    textoIA.introduccion ||
    'El producto descrito en el presente documento ha sido inspeccionado por World Survey Services S.A. (WSS), organismo de inspección acreditado por el INN (OI 376 — Ensayos No Destructivos / OI 377 — Equipos de Izaje y Levante), según NCh-ISO 17020:2012 Tipo A, con reconocimiento internacional ILAC-MRA. De acuerdo a los resultados obtenidos, se emite el presente documento según se detalla a continuación.',
    { italic: false }
  ))

  // ═══ 1. ALCANCES GENERALES ════════════════════════════════════════════════
  children.push(seccion('1', 'Alcances Generales'))
  children.push(new Table({
    width:        { size: 9600, type: WidthType.DXA },
    columnWidths: [2800, 6800],
    rows: [
      new TableRow({ children: [cel('Inspector(es)',            { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inspectoresStr,                         { size: 18 })] }),
      new TableRow({ children: [cel('Certificación SNT TC-1A', { bold: true, bg: GRIS_CLARO, size: 18 }), cel('Nivel II / Nivel III según corresponda', { size: 18 })] }),
      new TableRow({ children: [cel('Fecha ejecución',         { bold: true, bg: GRIS_CLARO, size: 18 }), cel(fechaInsp,                               { size: 18 })] }),
      new TableRow({ children: [cel('Descripción de muestra',  { bold: true, bg: GRIS_CLARO, size: 18 }), cel(muestraLabel,                            { size: 18 })] }),
      new TableRow({ children: [cel('Norma(s) Ejecución',      { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.norma_ejecucion  || '—',             { size: 18 })] }),
      new TableRow({ children: [cel('Norma(s) Evaluación',     { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.norma_evaluacion || '—',             { size: 18 })] }),
      new TableRow({ children: [cel('Métodos END Aplicados',   { bold: true, bg: GRIS_CLARO, size: 18 }), cel(endApl.join(', ')   || '—',             { size: 18 })] }),
      new TableRow({ children: [cel('Procedimientos WSS',      { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.procedimientos   || '—',             { size: 18 })] }),
    ],
  }))

  // ═══ 2. ANTECEDENTES DEL EQUIPO DE INSPECCIÓN ════════════════════════════
  // (muestra los equipos/instrumentos utilizados por el inspector, con código WSS)
  children.push(seccion('2', 'Antecedentes del Equipo de Inspección'))

  if (textoIA.descripcion_equipo) {
    children.push(parrafo(textoIA.descripcion_equipo))
    children.push(espaciador(60))
  }

  if (equiposMed.length > 0) {
    // Tabla de equipos de medición / instrumentos END utilizados
    const hdrEq = new TableRow({
      tableHeader: true,
      children: [
        cel('Cód. WSS',         { bold: true, bg: WSS_AZUL, color: BLANCO, size: 18, center: true }),
        cel('Equipo / Instrumento', { bold: true, bg: WSS_AZUL, color: BLANCO, size: 18 }),
        cel('Marca / Modelo',   { bold: true, bg: WSS_AZUL, color: BLANCO, size: 18 }),
        cel('N° Serie',         { bold: true, bg: WSS_AZUL, color: BLANCO, size: 18, center: true }),
        cel('Cert. Calibración',{ bold: true, bg: WSS_AZUL, color: BLANCO, size: 18 }),
      ],
    })
    const rowsEq = equiposMed.map(em => new TableRow({
      children: [
        cel(em.codigo_wss         || '—', { center: true, size: 18 }),
        cel(em.equipo_instrumento || '—', { size: 18 }),
        cel([em.marca, em.modelo].filter(Boolean).join(' ') || '—', { size: 18 }),
        cel(em.numero_serie       || '—', { center: true, size: 18 }),
        cel(em.cert_calibracion   || '—', { size: 18 }),
      ],
    }))
    children.push(new Table({
      width:        { size: 9600, type: WidthType.DXA },
      columnWidths: [1200, 2600, 2400, 1600, 1800],
      rows:         [hdrEq, ...rowsEq],
    }))
  } else {
    children.push(parrafo('Los equipos e instrumentos utilizados en la inspección se encuentran debidamente calibrados y vigentes conforme a los registros internos WSS.'))
  }

  // ═══ 3. ELEMENTOS INSPECCIONADOS ══════════════════════════════════════════
  if (elementos.length > 0) {
    children.push(seccion('3', 'Elementos de Izaje Inspeccionados'))
    const hdrEl = new TableRow({
      tableHeader: true,
      children: [
        cel('N°',          { bold: true, bg: WSS_AZUL, color: BLANCO, center: true, size: 18 }),
        cel('Tipo',        { bold: true, bg: WSS_AZUL, color: BLANCO, size: 18 }),
        cel('N° Sello',    { bold: true, bg: WSS_AZUL, color: BLANCO, center: true, size: 18 }),
        cel('Descripción', { bold: true, bg: WSS_AZUL, color: BLANCO, size: 18 }),
        cel('Resultado',   { bold: true, bg: WSS_AZUL, color: BLANCO, center: true, size: 18 }),
      ],
    })
    const rowsEl = elementos.map((el, i) => {
      const cumple = el.resultado === 'CUMPLE'
      return new TableRow({
        children: [
          cel(String(i + 1),                          { center: true, size: 18 }),
          cel(el.tipo        || '—',                  { size: 18 }),
          cel(el.n_sello     || 'S/I',                { center: true, size: 18 }),
          cel(el.descripcion || '—',                  { size: 18 }),
          cel(cumple ? 'CUMPLE' : 'NO CUMPLE',       { bold: true, center: true, size: 18, color: cumple ? VERDE : ROJO }),
        ],
      })
    })
    children.push(new Table({
      width:        { size: 9600, type: WidthType.DXA },
      columnWidths: [500, 2200, 1300, 3400, 2200],
      rows:         [hdrEl, ...rowsEl],
    }))

    const rechazados = elementos.filter(e => e.resultado !== 'CUMPLE' && e.observacion)
    if (rechazados.length > 0) {
      children.push(espaciador(80))
      children.push(subtitulo('Observaciones de elementos no conformes:'))
      rechazados.forEach(el => children.push(
        parrafo(`• ${el.tipo}${el.n_sello ? ` (Sello: ${el.n_sello})` : ''}: ${el.observacion}`, { color: '991B1B' })
      ))
    }
  } else {
    children.push(seccion('3', 'Alcance de Inspección'))
    children.push(parrafo(textoIA.end_realizados || 'Los alcances de inspección se describen en los resultados de la sección 4.'))
  }

  // ═══ 4. RESULTADOS ═══════════════════════════════════════════════════════
  children.push(seccion('4', 'Resultados'))
  if (textoIA.end_realizados) {
    children.push(subtitulo('4.1 Métodos de Ensayo No Destructivos Realizados'))
    children.push(parrafo(textoIA.end_realizados))
  }
  if (textoIA.hallazgos) {
    children.push(subtitulo('4.2 Hallazgos'))
    children.push(parrafo(textoIA.hallazgos))
  }
  if (textoIA.evaluacion) {
    children.push(subtitulo('4.3 Evaluación Técnica'))
    children.push(parrafo(textoIA.evaluacion))
  }

  // ═══ 5. OBSERVACIONES DETECTADAS ══════════════════════════════════════════
  children.push(seccion('5', 'Observaciones Detectadas'))
  if (hallazgos.length > 0) {
    hallazgos.forEach((h, i) => {
      children.push(new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({ text: `${i + 1}. [${h.criticidad || 'Menor'}]  `, bold: true, size: 20, font: 'Arial', color: ROJO }),
          new TextRun({ text: h.descripcion || '',                         size: 20, font: 'Arial' }),
          h.ubicacion ? new TextRun({ text: `  —  Ubicación: ${h.ubicacion}`, size: 18, font: 'Arial', color: WSS_GRIS }) : new TextRun({ text: '' }),
          h.norma     ? new TextRun({ text: `  (${h.norma})`,               size: 18, font: 'Arial', color: WSS_GRIS }) : new TextRun({ text: '' }),
        ],
      }))
    })
  } else {
    children.push(parrafo('Sin observaciones significativas detectadas durante la inspección.'))
  }

  // ═══ 6. CONCLUSIÓN ════════════════════════════════════════════════════════
  children.push(seccion('6', 'Conclusión'))
  children.push(parrafo(
    textoIA.conclusion ||
    `De acuerdo a los resultados obtenidos en la inspección realizada, el equipo / elementos inspeccionados presentan un resultado: ${inf.resultado || '—'}.`
  ))
  children.push(espaciador(80))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { before: 40, after: 40 },
    children:  [new TextRun({ text: `RESULTADO:  ${(inf.resultado || '—').toUpperCase()}`, bold: true, size: 32, font: 'Arial', color: resultColor })],
  }))

  // ═══ 7. RECOMENDACIONES ═══════════════════════════════════════════════════
  children.push(seccion('7', 'Recomendaciones'))
  children.push(parrafo(
    textoIA.recomendaciones ||
    'Se recomienda mantener el programa de mantenimiento preventivo e inspección periódica conforme a las normas aplicables.'
  ))

  // ═══ 8. REGISTRO FOTOGRÁFICO ══════════════════════════════════════════════
  const fotosOk = fotosBufs.map((buf, i) => ({ buf, url: fotosUrls[i] })).filter(f => f.buf)
  if (fotosOk.length > 0) {
    children.push(seccion('8', 'Registro Fotográfico'))
    for (let i = 0; i < fotosOk.length; i += 2) {
      const celdas = []
      for (let j = i; j < Math.min(i + 2, fotosOk.length); j++) {
        const { buf, url } = fotosOk[j]
        celdas.push(new TableCell({
          width:   { size: 4800, type: WidthType.DXA },
          shading: blancoBg(),
          borders: borderSet('E2E8F0'),
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [
              new ImageRun({ type: tipoImg(url), data: buf, transformation: { width: 300, height: 200 }, altText: { title: `Foto ${j+1}`, description: '', name: `f${j+1}` } })
            ]}),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [
              new TextRun({ text: `Foto ${j + 1}`, size: 16, font: 'Arial', color: WSS_GRIS })
            ]}),
          ],
        }))
      }
      if (celdas.length === 1) {
        celdas.push(new TableCell({ width: { size: 4800, type: WidthType.DXA }, shading: blancoBg(), borders: sinBordes(), children: [new Paragraph({ children: [] })] }))
      }
      children.push(new Table({ width: { size: 9600, type: WidthType.DXA }, columnWidths: [4800, 4800], rows: [new TableRow({ children: celdas })] }))
      children.push(espaciador(80))
    }
  }

  // ═══ BLOQUE DE FIRMAS ═════════════════════════════════════════════════════
  children.push(espaciador(280))
  const totalFirmas = listaInsp.length + 1
  const anchoCelda  = Math.floor(9600 / totalFirmas)

  const firmasInsp = listaInsp.map(nombre => new TableCell({
    width:   { size: anchoCelda, type: WidthType.DXA },
    borders: { top: borde('475569'), bottom: sinBorde(), left: sinBorde(), right: sinBorde() },
    margins: { top: 80, left: 200, right: 200 },
    children: [
      parrafo(nombre || '___________________________', { bold: true }),
      parrafo('Inspector END',                         { color: WSS_GRIS, size: 18 }),
      parrafo('División Inspección Industrial',        { color: WSS_GRIS, size: 18 }),
      parrafo('World Survey Services S.A.',            { color: WSS_GRIS, size: 16 }),
    ],
  }))

  const firmaSup = new TableCell({
    width:   { size: anchoCelda, type: WidthType.DXA },
    borders: { top: borde('475569'), bottom: sinBorde(), left: sinBorde(), right: sinBorde() },
    margins: { top: 80, left: 200, right: 200 },
    children: [
      parrafo(inf.supervisor_nombre || '___________________________', { bold: true }),
      parrafo('Jefe División Inspección Industrial',                   { color: WSS_GRIS, size: 18 }),
      parrafo('World Survey Services S.A.',                            { color: WSS_GRIS, size: 16 }),
    ],
  })

  children.push(new Table({
    width:        { size: 9600, type: WidthType.DXA },
    columnWidths: Array(totalFirmas).fill(anchoCelda),
    rows:         [new TableRow({ children: [...firmasInsp, firmaSup] })],
  }))

  // ═══ PIE ACREDITACIÓN ═════════════════════════════════════════════════════
  children.push(espaciador(200))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { before: 120 },
    border:    { top: { style: BorderStyle.SINGLE, size: 4, color: WSS_AZUL } },
    children:  [new TextRun({
      text:  'Organismo de Inspección Acreditado INN — OI 376 (Ensayos No Destructivos) / OI 377 (Equipos de Izaje y Levante) | NCh-ISO 17020:2012 Tipo A | ILAC-MRA',
      size: 14, font: 'Arial', color: WSS_GRIS,
    })],
  }))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children:  [new TextRun({ text: `Documento N° ${docNum}  ·  Emitido: ${fechaEmis}  ·  ${regLabel}`, size: 14, font: 'Arial', color: 'CBD5E1' })],
  }))

  // ═══ Build ════════════════════════════════════════════════════════════════
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size:   { width: 12240, height: 15840 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const safe   = s => String(s || '').replace(/[^A-Z0-9_\-]/gi, '')
  const pfx    = esRechazado ? 'INF' : 'CERT'
  const fname  = `WSS_${pfx}_${safe(inf.tipo_equipo)}_${safe(inf.ot_numero)}_${safe(docNum)}.docx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
  res.end(buffer)
}
