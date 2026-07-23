// api/generar-word.js
// POST /api/generar-word  { informeId }
// Genera certificado / informe .docx estilo WSS REG-DII-059

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const borde       = (color = 'CBD5E1') => ({ style: BorderStyle.SINGLE, size: 1, color })
const borderSet   = (c)               => ({ top: borde(c), bottom: borde(c), left: borde(c), right: borde(c) })
const sinBorde    = ()                => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' })
const sinBordes   = ()                => ({ top: sinBorde(), bottom: sinBorde(), left: sinBorde(), right: sinBorde() })

function cel(text, { bold, center, bg, color, size = 20, span } = {}) {
  return new TableCell({
    columnSpan: span,
    shading:        bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    verticalAlign:  VerticalAlign.CENTER,
    margins:        { top: 60, bottom: 60, left: 100, right: 100 },
    borders:        borderSet(),
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
      color: opts.color || '1E293B',
    })],
  })
}

function espaciador(pts = 100) {
  return new Paragraph({ spacing: { before: pts }, children: [] })
}

// Descarga imagen desde URL y retorna Buffer (o null si falla)
async function fetchImagen(url) {
  if (!url) return null
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return Buffer.from(await r.arrayBuffer())
  } catch { return null }
}

// Determina extensión de imagen a partir de URL o buffer (png/jpg/jpeg)
function tipoImg(url = '') {
  if (url.includes('.png') || url.endsWith('png')) return 'png'
  if (url.includes('.jpg') || url.includes('.jpeg')) return 'jpg'
  return 'png' // fallback
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
  const { data: inf, error } = await supabase.from('informes').select('*').eq('id', informeId).single()
  if (error || !inf) return res.status(404).json({ error: 'Informe no encontrado' })

  // ── Descargar logos e imágenes en paralelo ─────────────────────────────────
  const datos        = inf.datos_equipo || {}
  const fotosUrls    = (datos.fotos_inspeccion || []).filter(Boolean).slice(0, 8)

  const [logoWSSBuf, logoINNBuf, ...fotosBufs] = await Promise.all([
    fetchImagen(`${PORTAL_URL}/assets/wss-logo-horizontal-color.png`),
    fetchImagen(`${PORTAL_URL}/assets/inn-acreditacion.png`),
    ...fotosUrls.map(u => fetchImagen(u)),
  ])

  // ── Parseo de datos ────────────────────────────────────────────────────────
  const textoIA   = inf.texto_ia || {}
  const hallazgos = inf.hallazgos || []
  const elementos = datos.elementos_izaje || []
  const equipos   = datos.equipos_izaje_adicionales || []
  const endApl    = inf.end_aplicados || []

  // Inspectores: puede ser array (inspectores_ot) o string (inspector_nombre)
  const listaInspectores = (() => {
    const arr = datos.inspectores_ot || []
    if (arr.length > 0) return arr
    if (inf.inspector_nombre) return [inf.inspector_nombre]
    return ['—']
  })()
  const inspectoresStr = listaInspectores.join(' / ')

  const docNum    = inf.reg_dii_numero || `INF-${String(inf.id).substring(0, 8).toUpperCase()}`
  const fechaInsp = inf.fecha_inspeccion
    ? new Date(inf.fecha_inspeccion + 'T12:00:00').toLocaleDateString('es-CL')
    : '—'
  const fechaEmis = new Date().toLocaleDateString('es-CL')

  const tipoLabel = {
    IZAJE:      'EQUIPOS DE IZAJE Y LEVANTE',
    TANQUE:     'INSPECCIÓN DE TANQUES',
    TUBERIA:    'INSPECCIÓN DE TUBERÍAS',
    ESTRUCTURA: 'INSPECCIÓN ESTRUCTURAL',
  }[inf.tipo_equipo] || inf.tipo_equipo || 'INSPECCIÓN TÉCNICA'

  // Título del documento según resultado
  const esRechazado     = ['RECHAZADO', 'NO CONFORME', 'NO_CONFORME'].includes((inf.resultado || '').toUpperCase())
  const tituloPrincipal = esRechazado ? 'INFORME DE INSPECCIÓN' : 'CERTIFICADO DE EVALUACIÓN'
  const resultColor     = {
    ACEPTADO: VERDE, RECHAZADO: ROJO, CONFORME: VERDE,
    'NO CONFORME': ROJO, 'NO_CONFORME': ROJO, CONDICIONADO: 'D97706',
  }[(inf.resultado || '').toUpperCase()] || WSS_AZUL

  // ── Construir documento ────────────────────────────────────────────────────
  const children = []

  // ─── ENCABEZADO: [WSS logo] | [Título azul + N°] | [INN logo] ─────────────
  const celdaWSS = new TableCell({
    width: { size: 2800, type: WidthType.DXA },
    borders: { ...sinBordes(), bottom: borde(WSS_AZUL) },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 0, right: 120 },
    children: [logoWSSBuf
      ? new Paragraph({ children: [new ImageRun({ type: 'png', data: logoWSSBuf, transformation: { width: 160, height: 54 }, altText: { title: 'WSS', description: 'WSS logo', name: 'wss' } })] })
      : parrafo('WORLD SURVEY SERVICES S.A.', { bold: true, color: WSS_AZUL })
    ],
  })

  const celdaTitulo = new TableCell({
    width: { size: 4800, type: WidthType.DXA },
    shading: { fill: WSS_AZUL, type: ShadingType.CLEAR },
    borders: sinBordes(),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tituloPrincipal, bold: true, size: 24, font: 'Arial', color: BLANCO })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tipoLabel,        bold: false, size: 18, font: 'Arial', color: 'BFD4F2' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: docNum, bold: true, size: 26, font: 'Arial Narrow', color: BLANCO })] }),
    ],
  })

  const celdaINN = new TableCell({
    width: { size: 2000, type: WidthType.DXA },
    borders: { ...sinBordes(), bottom: borde(WSS_AZUL) },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 120, right: 0 },
    children: [logoINNBuf
      ? new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: 'png', data: logoINNBuf, transformation: { width: 100, height: 60 }, altText: { title: 'INN', description: 'INN Acreditación', name: 'inn' } })] })
      : new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'INN OI376/OI377', size: 14, font: 'Arial', color: WSS_GRIS })] })
    ],
  })

  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [2800, 4800, 2000],
    rows: [new TableRow({ children: [celdaWSS, celdaTitulo, celdaINN] })],
  }))

  children.push(espaciador(120))

  // ─── Tabla datos cliente / OT ──────────────────────────────────────────────
  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [1600, 3200, 1600, 3200],
    rows: [
      infoRow('Solicitante',       inf.cliente_nombre    || '—',  'N° Informe',          docNum),
      infoRow('Atención / Contacto', inf.supervisor_nombre || '—',  'Orden de Trabajo',    inf.ot_numero || '—'),
      infoRow('Lugar / Faena',     inf.lugar             || '—',  'Fecha Inspección',    fechaInsp),
      infoRow('Inspector(es)',      inspectoresStr,                 'Fecha Emisión',       fechaEmis),
    ],
  }))

  children.push(espaciador(120))
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'División Inspección Industrial — Sede Santiago', bold: true, size: 20, font: 'Arial', color: WSS_AZUL })],
  }))

  // ─── 1. ALCANCES GENERALES ─────────────────────────────────────────────────
  children.push(seccion('1', 'Alcances Generales'))
  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [2600, 7000],
    rows: [
      new TableRow({ children: [cel('Inspector(es)',          { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inspectoresStr, { size: 18 })] }),
      new TableRow({ children: [cel('Certificación SNT TC-1A',{ bold: true, bg: GRIS_CLARO, size: 18 }), cel('Nivel II / Nivel III según corresponda', { size: 18 })] }),
      new TableRow({ children: [cel('Fecha ejecución',        { bold: true, bg: GRIS_CLARO, size: 18 }), cel(fechaInsp, { size: 18 })] }),
      new TableRow({ children: [cel('Descripción muestra(s)', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(
        elementos.length > 0
          ? elementos.map(e => `${e.tipo}${e.n_sello ? ` N°Sello: ${e.n_sello}` : ''}`).join(' / ')
          : (inf.tipo_equipo || '—'),
        { size: 18 }
      )] }),
      new TableRow({ children: [cel('Norma(s) Ejecución',  { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.norma_ejecucion  || '—', { size: 18 })] }),
      new TableRow({ children: [cel('Norma(s) Evaluación', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.norma_evaluacion || '—', { size: 18 })] }),
      new TableRow({ children: [cel('Métodos END Aplicados',{ bold: true, bg: GRIS_CLARO, size: 18 }), cel(endApl.join(', ')   || '—', { size: 18 })] }),
      new TableRow({ children: [cel('Procedimientos WSS',  { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.procedimientos   || '—', { size: 18 })] }),
    ],
  }))

  // ─── 2. PROCEDIMIENTO ─────────────────────────────────────────────────────
  children.push(seccion('2', 'Procedimiento'))
  children.push(parrafo(
    textoIA.introduccion ||
    'El producto descrito en el presente documento ha sido inspeccionado por World Survey Services S.A. (WSS), organismo de inspección acreditado por el INN (OI 376 — Ensayos No Destructivos / OI 377 — Equipos de Izaje y Levante), según NCh-ISO 17020:2012 Tipo A, con reconocimiento internacional ILAC-MRA. De acuerdo a los resultados obtenidos, se emite el presente documento según se detalla a continuación.'
  ))

  // ─── 3. ANTECEDENTES DEL EQUIPO ───────────────────────────────────────────
  children.push(seccion('3', 'Antecedentes del Equipo'))

  if (textoIA.descripcion_equipo) {
    children.push(parrafo(textoIA.descripcion_equipo))
  }

  const eq = (equipos.length > 0 && equipos[0]) ? equipos[0] : datos
  const tieneEquipoMayor = ['tipo_equipo_izaje','marca','modelo','numero_serie','capacidad_ton'].some(k => eq[k])

  if (tieneEquipoMayor) {
    children.push(new Table({
      width: { size: 9600, type: WidthType.DXA },
      columnWidths: [1600, 3200, 1600, 3200],
      rows: [
        infoRow('Nombre del Equipo', eq.tipo_equipo_izaje || datos.tipo_equipo_izaje || '—', 'N° Serie',          eq.numero_serie    || datos.numero_serie    || '—'),
        infoRow('Marca',             eq.marca             || datos.marca             || '—', 'Año Fabricación',   eq.año_fabricacion || datos.año_fabricacion || '—'),
        infoRow('Modelo',            eq.modelo            || datos.modelo            || '—', 'Capacidad (ton)',   eq.capacidad_ton   || datos.capacidad_ton   || '—'),
        infoRow('Prueba de Carga',   eq.prueba_carga      || datos.prueba_carga      || '—', 'Ubicación',         inf.lugar          || '—'),
        infoRow('Estado Estructura', eq.estado_estructura || datos.estado_estructura || '—', 'Estado Componentes',eq.estado_componentes || datos.estado_componentes || '—'),
      ],
    }))
  } else {
    children.push(parrafo('Inspección realizada sobre los elementos individuales detallados en la sección 4.'))
  }

  // ─── 4. ELEMENTOS INSPECCIONADOS ──────────────────────────────────────────
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
          cel(String(i + 1),                          { center: true, size: 18 }),
          cel(el.tipo        || '—',                  { size: 18 }),
          cel(el.n_sello     || 'S/I',                { center: true, size: 18 }),
          cel(el.descripcion || '—',                  { size: 18 }),
          cel(cumple ? 'CUMPLE' : 'NO CUMPLE',       { bold: true, center: true, size: 18, color: cumple ? VERDE : ROJO }),
        ],
      })
    })
    children.push(new Table({
      width: { size: 9600, type: WidthType.DXA },
      columnWidths: [500, 2200, 1300, 3400, 2200],
      rows: [hdrRow, ...dataRows],
    }))

    // Observaciones de rechazados
    const rechazados = elementos.filter(e => (e.resultado === 'NO_CUMPLE' || e.resultado === 'NO CUMPLE') && e.observacion)
    if (rechazados.length > 0) {
      children.push(espaciador(80))
      children.push(subtitulo('Observaciones de elementos no conformes:'))
      rechazados.forEach(el => {
        children.push(parrafo(
          `• ${el.tipo}${el.n_sello ? ` (Sello: ${el.n_sello})` : ''}: ${el.observacion}`,
          { color: '991B1B' }
        ))
      })
    }
  } else {
    children.push(seccion('4', 'Alcance de Inspección, Normas y Especificaciones'))
    children.push(parrafo(textoIA.end_realizados || 'Los alcances de inspección se describen en los resultados adjuntos.'))
  }

  // ─── 5. RESULTADOS ────────────────────────────────────────────────────────
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

  // ─── 6. OBSERVACIONES DETECTADAS ──────────────────────────────────────────
  children.push(seccion('6', 'Observaciones Detectadas'))
  if (hallazgos.length > 0) {
    hallazgos.forEach((h, i) => {
      children.push(new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({ text: `${i + 1}. [${h.criticidad || 'Menor'}]  `, bold: true, size: 20, font: 'Arial', color: ROJO }),
          new TextRun({ text: h.descripcion || '', size: 20, font: 'Arial' }),
          h.ubicacion ? new TextRun({ text: `  —  Ubicación: ${h.ubicacion}`, size: 18, font: 'Arial', color: WSS_GRIS }) : new TextRun({ text: '' }),
          h.norma     ? new TextRun({ text: `  (${h.norma})`,               size: 18, font: 'Arial', color: WSS_GRIS }) : new TextRun({ text: '' }),
        ],
      }))
    })
  } else {
    children.push(parrafo('Sin observaciones significativas detectadas durante la inspección.'))
  }

  // ─── 7. ENTIDAD CERTIFICADORA ──────────────────────────────────────────────
  children.push(seccion('7', 'Entidad Certificadora'))
  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: [2600, 7000],
    rows: [
      new TableRow({ children: [cel('Razón Social',        { bold: true, bg: GRIS_CLARO, size: 18 }), cel('World Survey Services S.A.',                                                          { size: 18 })] }),
      new TableRow({ children: [cel('Acreditación INN',    { bold: true, bg: GRIS_CLARO, size: 18 }), cel('NCh-ISO 17020:2012 Tipo A | OI 376 (END) / OI 377 (Izaje y Levante) | ILAC-MRA',   { size: 18 })] }),
      new TableRow({ children: [cel('Solicitante',         { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.cliente_nombre    || '—',                                                         { size: 18 })] }),
      new TableRow({ children: [cel('Atención / Contacto', { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.supervisor_nombre || '—',                                                         { size: 18 })] }),
      new TableRow({ children: [cel('Orden de Trabajo',    { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.ot_numero         || '—',                                                         { size: 18 })] }),
      new TableRow({ children: [cel('N° Informe',          { bold: true, bg: GRIS_CLARO, size: 18 }), cel(docNum,                                                                                { size: 18 })] }),
      new TableRow({ children: [cel('Fecha Inspección',    { bold: true, bg: GRIS_CLARO, size: 18 }), cel(fechaInsp,                                                                             { size: 18 })] }),
      new TableRow({ children: [cel('Fecha Emisión',       { bold: true, bg: GRIS_CLARO, size: 18 }), cel(fechaEmis,                                                                             { size: 18 })] }),
      new TableRow({ children: [cel('Lugar Inspección',    { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inf.lugar            || '—',                                                          { size: 18 })] }),
      new TableRow({ children: [cel('Inspector(es)',        { bold: true, bg: GRIS_CLARO, size: 18 }), cel(inspectoresStr,                                                                       { size: 18 })] }),
    ],
  }))

  // ─── 8. CONCLUSIÓN ────────────────────────────────────────────────────────
  children.push(seccion('8', 'Conclusión'))
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

  // ─── 9. RECOMENDACIONES ───────────────────────────────────────────────────
  children.push(seccion('9', 'Recomendaciones'))
  children.push(parrafo(
    textoIA.recomendaciones ||
    'Se recomienda mantener el programa de mantenimiento preventivo e inspección periódica conforme a las normas aplicables.'
  ))

  // ─── 10. REGISTRO FOTOGRÁFICO ─────────────────────────────────────────────
  const fotosDisponibles = fotosBufs.map((buf, i) => ({ buf, url: fotosUrls[i] })).filter(f => f.buf)
  if (fotosDisponibles.length > 0) {
    children.push(seccion('10', 'Registro Fotográfico'))
    // Grilla 2 columnas; cada imagen ~4400 DXA ancho ≈ 7.6 cm
    for (let i = 0; i < fotosDisponibles.length; i += 2) {
      const celdas = []
      for (let j = i; j < Math.min(i + 2, fotosDisponibles.length); j++) {
        const { buf, url } = fotosDisponibles[j]
        const tipo = tipoImg(url)
        celdas.push(new TableCell({
          width: { size: 4800, type: WidthType.DXA },
          borders: borderSet('E2E8F0'),
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children:  [new ImageRun({ type: tipo, data: buf, transformation: { width: 300, height: 200 }, altText: { title: `Foto ${j+1}`, description: '', name: `foto${j+1}` } })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children:  [new TextRun({ text: `Foto ${j + 1}`, size: 16, font: 'Arial', color: WSS_GRIS })],
            }),
          ],
        }))
      }
      // Rellenar segunda celda si número impar
      if (celdas.length === 1) {
        celdas.push(new TableCell({
          width: { size: 4800, type: WidthType.DXA },
          borders: sinBordes(),
          children: [new Paragraph({ children: [] })],
        }))
      }
      children.push(new Table({
        width: { size: 9600, type: WidthType.DXA },
        columnWidths: [4800, 4800],
        rows: [new TableRow({ children: celdas })],
      }))
      children.push(espaciador(80))
    }
  }

  // ─── BLOQUE DE FIRMAS ─────────────────────────────────────────────────────
  children.push(espaciador(280))

  // Construir celdas de firma para cada inspector + supervisor
  const firmasInspectores = listaInspectores.map(nombre => new TableCell({
    borders: { top: borde('475569'), bottom: sinBorde(), left: sinBorde(), right: sinBorde() },
    margins: { top: 80, left: 200, right: 200 },
    children: [
      parrafo(nombre || '___________________________', { bold: true }),
      parrafo('Inspector END', { color: WSS_GRIS, size: 18 }),
      parrafo('División Inspección Industrial', { color: WSS_GRIS, size: 18 }),
      parrafo('World Survey Services S.A.', { color: WSS_GRIS, size: 16 }),
    ],
  }))

  const celdaSupervisor = new TableCell({
    borders: { top: borde('475569'), bottom: sinBorde(), left: sinBorde(), right: sinBorde() },
    margins: { top: 80, left: 200, right: 200 },
    children: [
      parrafo(inf.supervisor_nombre || '___________________________', { bold: true }),
      parrafo('Jefe División Inspección Industrial', { color: WSS_GRIS, size: 18 }),
      parrafo('World Survey Services S.A.', { color: WSS_GRIS, size: 16 }),
    ],
  })

  // Distribuir columnas igualmente
  const totalFirmas  = firmasInspectores.length + 1
  const anchoCelda   = Math.floor(9600 / totalFirmas)
  const colWidths    = Array(totalFirmas).fill(anchoCelda)

  children.push(new Table({
    width: { size: 9600, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [new TableRow({ children: [...firmasInspectores, celdaSupervisor] })],
  }))

  // ─── PIE ACREDITACIÓN ────────────────────────────────────────────────────
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

  // ─── Build ────────────────────────────────────────────────────────────────
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

  const buffer  = await Packer.toBuffer(doc)
  const safe    = s => String(s || '').replace(/[^A-Z0-9_\-]/gi, '')
  const tipo_fn = esRechazado ? 'INF' : 'CERT'
  const fname   = `WSS_${tipo_fn}_${safe(inf.tipo_equipo)}_${safe(inf.ot_numero)}_${safe(docNum)}.docx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
  res.end(buffer)
}
