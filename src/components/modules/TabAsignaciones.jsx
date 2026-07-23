import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// ─── helpers generales ───────────────────────────────────────────────────────
function waLink(tel, mensaje) {
  const num = (tel || '').replace(/[^0-9]/g, '')
  if (!num) return null
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
}

// Métodos END → número de informe REG-DII que debe emitir el inspector
// Fuente: carpeta Drive 1S38DuO2oXU5L92vjlcksLnxhkSuh4ADH (verificado 10-Jul-2026)
const END_METHODS = [
  // ── END clásicos (OI-376) ──────────────────────────────────────────────
  { cod:'VT',   desc:'Insp. Visual',       reg:'REG-DII-003' },
  { cod:'PT',   desc:'Líq. Penetrantes',   reg:'REG-DII-004' },
  { cod:'MT',   desc:'Part. Magnéticas',   reg:'REG-DII-005' },
  { cod:'UTT',  desc:'Med. Espesores',     reg:'REG-DII-006' },
  { cod:'UT',   desc:'Ultrasonido',        reg:'REG-DII-007' },
  { cod:'UTPA', desc:'Phased Array',       reg:'REG-DII-039' },
  { cod:'T',    desc:'Termografía',        reg:'REG-DII-057' },
  // ── Dimensional / Recubrimiento ────────────────────────────────────────
  { cod:'CD',   desc:'Control Dim.',       reg:'REG-DII-002' },
  { cod:'RC',   desc:'Med. Recubrimiento', reg:'REG-DII-008' },
  // ── Pruebas ────────────────────────────────────────────────────────────
  { cod:'PH',   desc:'P. Hermeticidad',    reg:'REG-DII-026' },
  // ── Izaje y Levante (OI-377) ───────────────────────────────────────────
  { cod:'PL',   desc:'Prueba de Carga',    reg:'REG-DII-011' },
  { cod:'GM',   desc:'Grúas Móviles',      reg:'REG-DII-032' },
  { cod:'PG',   desc:'Puentes Grúa',       reg:'REG-DII-059' },
  // ── Soldadura / Tanques / Otros ────────────────────────────────────────
  { cod:'CTK',  desc:'Integ. Tanques',     reg:'REG-DII-049' },
  { cod:'CS',   desc:'Calif. Soldador',    reg:'REG-DII-019' },
  { cod:'O',    desc:'Otros',             reg:null },
]

const PORTAL_URL = 'https://sistema-de-calidad-wss.vercel.app'

const TIEMPOS_EST = [
  '1 hora', '2 horas', '3 horas', '4 horas',
  'Medio día (4h)', '6 horas', '7 horas', 'Día completo (8h)',
  '2 días (16h)', '3 días (24h)',
]

const NORMAS_EJECUCION_BASE = [
  // ASME V — Exámenes No Destructivos
  'ASME V Art. 1 (2021)',   'ASME V Art. 2 (2021)',   'ASME V Art. 4 (2021)',
  'ASME V Art. 5 (2021)',   'ASME V Art. 6 (2021)',   'ASME V Art. 7 (2021)',
  'ASME V Art. 8 (2021)',   'ASME V Art. 9 (2021)',   'ASME V Art. 10 (2021)',
  // ASTM — Métodos END
  'ASTM E94 (2017)',        'ASTM E114 (2015)',        'ASTM E165 (2018)',
  'ASTM E317 (2019)',       'ASTM E428 (2022)',        'ASTM E587 (2015)',
  'ASTM E709 (2021)',       'ASTM E747 (2020)',        'ASTM E1444 (2022)',
  'ASTM A435 (2019)',       'ASTM A578 (2017)',
  // AWS
  'AWS B1.10 (2016)',       'AWS B1.11 (2000)',
  // ISO
  'ISO 3452-1 (2021)',      'ISO 9712 (2021)',         'ISO 17637 (2016)',
  'ISO 17638 (2016)',       'ISO 17640 (2018)',        'ISO 23277 (2022)',
  'ISO 23278 (2015)',
  // SNT / ACCP
  'SNT-TC-1A (2020)',       'CP-189 (2016)',
  // NCh (Normas Chilenas)
  'NCh 2619 (2004)',        'NCh 2620 (2004)',
]

const NORMAS_EVALUACION_BASE = [
  // API — Recipientes, tuberías y tanques
  'API 510 (2022)',          'API 570 (2023)',          'API 579-1 (2021)',
  'API 620 (2021)',          'API 650 (2023)',          'API 653 (2023)',
  'API RP 571 (2020)',       'API RP 574 (2022)',       'API RP 577 (2022)',
  'API RP 578 (2021)',       'API RP 580 (2016)',       'API RP 581 (2016)',
  'API RP 582 (2022)',       'API RP 591 (2012)',
  // ASME — Recipientes y tuberías
  'ASME VIII Div. 1 (2023)', 'ASME VIII Div. 2 (2023)', 'ASME VIII Div. 3 (2023)',
  'ASME B31.1 (2022)',       'ASME B31.3 (2022)',        'ASME B31.4 (2022)',
  'ASME B31.8 (2022)',       'ASME B31.9 (2022)',        'ASME IX (2023)',
  // AWS — Soldadura
  'AWS D1.1 (2020)',         'AWS D1.2 (2021)',          'AWS D1.3 (2018)',
  'AWS D1.4 (2018)',         'AWS D1.5 (2020)',          'AWS D1.6 (2017)',
  // NACE / AMPP
  'NACE MR0175 (2021)',      'NACE SP0169 (2013)',       'NACE SP0188 (2006)',
  'NACE SP0472 (2020)',
  // ISO
  'ISO 5817 (2023)',         'ISO 10042 (2018)',         'ISO 13847 (2013)',
  // NCh
  'NCh 432 Of.1971',        'NCh 2369 (2003)',
  // Grúas e izaje
  'ASME B30.2 (2022)',       'ASME B30.5 (2021)',        'ASME B30.9 (2022)',
  'ASME B30.20 (2021)',      'FEM 1.001 (2022)',
]

function buildWAMensaje({ otNumero, cliente, contacto, telefonoCliente, fechaInspeccion, hora, sede,
  descripcion, tipos, procedimientos, normaEjecucion, vehiculo, supervisorNombre, pdfUrl }) {
  const portalLink = `${PORTAL_URL}/ots/${otNumero}`
  const lineas = []
  lineas.push(`Hola, has sido asignado/a a una actividad de inspección WSS.\n`)
  lineas.push(`📋 *ORDEN DE TRABAJO*`)
  lineas.push(`*N° OT:* ${otNumero}`)
  if (cliente)         lineas.push(`*Cliente:* ${cliente}`)
  if (contacto)        lineas.push(`*Contacto cliente:* ${contacto}`)
  if (telefonoCliente) lineas.push(`*Teléfono cliente:* ${telefonoCliente}`)
  if (sede)            lineas.push(`*Sede / Faena:* ${sede}`)
  lineas.push(``)
  lineas.push(`🗓️ *PROGRAMACIÓN`)
  lineas.push(`*Fecha:* ${fechaInspeccion || 'Por confirmar'}`)
  lineas.push(`*Hora:* ${hora || 'Por confirmar'}`)
  if (vehiculo)        lineas.push(`*Vehículo:* ${vehiculo}`)
  lineas.push(`*Supervisor:* ${supervisorNombre}`)
  lineas.push(``)
  lineas.push(`🔧 *ACTIVIDAD A REALIZAR*`)
  if (tipos)           lineas.push(`*Técnicas:* ${tipos}`)
  if (procedimientos)  lineas.push(`*Procedimientos:* ${procedimientos}`)
  if (normaEjecucion)  lineas.push(`*Norma:* ${normaEjecucion}`)
  if (descripcion)     lineas.push(`*Descripción:* ${descripcion}`)
  lineas.push(``)
  if (pdfUrl)          lineas.push(`📄 *Asignación REG-DII-036:* ${pdfUrl}\n`)
  lineas.push(`🔗 *Para ver todos los detalles ingresa al portal:*\n${portalLink}`)
  lineas.push(`\nPor favor confirma recepción. — WSS División Inspección Industrial`)
  return lineas.join('\n')
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// ─── PDF helpers ─────────────────────────────────────────────────────────────
const SEDE_NOMBRE = { SCL: 'Santiago (SCL)', ANF: 'Antofagasta (ANF)', CCP: 'Concepción (CCP)' }

function htmlDesc(text) {
  if (!text) return '—'
  return text.split('\n').map(l => {
    const t = l.trim()
    if (!t) return '<br>'
    if (t.startsWith('*')) return `<div style="margin:2px 0 2px 14px">• ${escHtml(t.slice(1).trim())}</div>`
    return `<div style="margin:2px 0">${escHtml(t)}</div>`
  }).join('')
}

function htmlEquipos(text) {
  if (!text) return '—'
  return text.split(',').map(e => e.trim()).filter(Boolean)
    .map(e => `<div style="margin:2px 0">• ${escHtml(e)}</div>`).join('')
}

/** Devuelve solo el contenido interior del documento (sin html/head/body) */
function buildBodyContent(asig, ot) {
  const hoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fechaInsp = asig.fecha_inspeccion
    ? new Date(asig.fecha_inspeccion + 'T00:00:00').toLocaleDateString('es-CL') : '—'
  const sedeLabel = SEDE_NOMBRE[ot.sede] || ot.sede || '—'

  const rawDesc = asig.descripcion_actividad || ''
  const SEP = '\n\nEquipos/instrumentos:'
  let descActividad = rawDesc, descEquipos = null
  if (rawDesc.includes(SEP)) {
    const idx = rawDesc.indexOf(SEP)
    descActividad = rawDesc.slice(0, idx).trim()
    descEquipos = rawDesc.slice(idx + SEP.length).trim()
  }

  const sec = (titulo, contenido) => `
    <div style="margin-bottom:10px">
      <div style="background:#1A3A5C;color:#fff;font-weight:bold;font-size:11px;
                  padding:5px 10px;border-radius:4px 4px 0 0">${titulo}</div>
      <div style="border:1px solid #c5cfe0;border-top:none;border-radius:0 0 4px 4px;
                  padding:10px 12px;font-size:10.5px;line-height:1.6;color:#333">${contenido}</div>
    </div>`

  return `
  <div style="border:2px solid #1A3A5C;border-radius:4px;margin-bottom:14px;display:flex;overflow:hidden">
    <div style="padding:10px 14px;border-right:2px solid #1A3A5C;display:flex;align-items:center;min-width:110px">
      <div>
        <div style="font-size:26px;font-weight:900;color:#1A3A5C;letter-spacing:-1px;line-height:1">WSS</div>
        <div style="font-size:6.5px;color:#185FA5;font-style:italic;margin-top:2px">Testing &amp; Certification CHILE</div>
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px">
      <div style="font-size:15px;font-weight:900;color:#1A3A5C;text-align:center">
        Asignación de Actividades — REG-DII-036
      </div>
    </div>
    <div style="padding:8px 14px;border-left:2px solid #1A3A5C;text-align:right;
                font-size:10px;color:#444;display:flex;flex-direction:column;
                justify-content:center;gap:2px;min-width:180px">
      <div><strong style="color:#1A3A5C">World Survey Services SA</strong></div>
      <div>División Inspección Industrial</div>
      <div>Revisión: 04 &nbsp;|&nbsp; Fecha: ${hoy}</div>
    </div>
  </div>

  ${sec('Datos generales de la OT', `
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9;width:130px;white-space:nowrap">N° OT</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(ot.ot_numero)}</td>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9;width:130px;white-space:nowrap">Cliente</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(ot.cliente || '—')}</td>
      </tr>
      <tr>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9">Sede</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(sedeLabel)}</td>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9">Supervisor</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(asig.supervisor || '—')}</td>
      </tr>
      <tr>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9">Fecha inspección</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(fechaInsp)}</td>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9">Hora</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(asig.hora || '—')}</td>
      </tr>
      <tr>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9">Inspector(es)</th>
        <td colspan="3" style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(asig.inspectores_asignados || '—')}</td>
      </tr>
    </table>
  `)}

  ${(asig.tiempo_estimado || asig.vehiculo || asig.norma_ejecucion || asig.norma_evaluacion) ? sec('Condiciones de ejecución', `
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9;width:130px">Tiempo estimado</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(asig.tiempo_estimado || '—')}</td>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9;width:130px">Vehículo</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(asig.vehiculo || '—')}</td>
      </tr>
      <tr>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9">Norma ejecución</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(asig.norma_ejecucion || '—')}</td>
        <th style="background:#EEF4FB;color:#1A3A5C;font-weight:bold;padding:6px 10px;border:1px solid #d0dce9">Norma evaluación</th>
        <td style="padding:6px 10px;border:1px solid #d0dce9">${escHtml(asig.norma_evaluacion || '—')}</td>
      </tr>
    </table>
  `) : ''}

  ${asig.procedimientos ? sec('Procedimientos definidos por supervisor', escHtml(asig.procedimientos)) : ''}
  ${asig.tipos_inspeccion ? sec('Tipos de inspección', escHtml(asig.tipos_inspeccion)) : ''}
  ${descEquipos ? sec('Equipos / instrumentos a utilizar', htmlEquipos(descEquipos)) : ''}
  ${descActividad ? sec('Descripción de actividades / alcance', htmlDesc(descActividad)) : ''}

  <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:8px;
              font-size:9px;color:#999;text-align:center;font-style:italic">
    Documento generado automáticamente por el Portal WSS — División Inspección Industrial.
  </div>`
}

/** HTML completo para el iframe de previsualización */
function buildPDFHtml(asig, ot) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>REG-DII-036 · ${escHtml(ot.ot_numero)}</title>
<style>
  @page { margin: 14mm 18mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; padding: 24px; background: #fff; }
  @media print { body { padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body>${buildBodyContent(asig, ot)}</body></html>`
}

/** Genera PDF como string base64 usando html2canvas + jsPDF (bundled via npm) */
async function generatePDFBase64(asig, ot) {
  // Contenedor temporal para renderizar
  const container = document.createElement('div')
  Object.assign(container.style, {
    position: 'absolute', left: '-9999px', top: '0',
    width: '794px', background: '#fff',
    fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#222',
    padding: '28px', boxSizing: 'border-box',
  })
  container.innerHTML = buildBodyContent(asig, ot)
  document.body.appendChild(container)

  // Pequeño delay para que el browser termine de renderizar
  await new Promise(r => setTimeout(r, 400))

  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: 794,
    windowWidth: 794,
  })
  document.body.removeChild(container)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()   // 210
  const pageH = pdf.internal.pageSize.getHeight()  // 297

  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  const imgW = pageW
  const imgH = (canvas.height * pageW) / canvas.width

  pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH)
  let remaining = imgH - pageH
  let yOffset = -pageH
  while (remaining > 0) {
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, yOffset, imgW, imgH)
    yOffset -= pageH
    remaining -= pageH
  }

  // Retornar base64 puro usando arraybuffer (más confiable que datauristring)
  const arrayBuffer = pdf.output('arraybuffer')
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Sube PDF a Supabase Storage y retorna una URL firmada */
async function subirPDFaSupabase(base64, nombre, otNumero) {
  if (!base64 || base64.length < 100) throw new Error('El PDF generado está vacío o es inválido')
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const blob  = new Blob([bytes], { type: 'application/pdf' })
  const ruta  = `asignaciones/${otNumero}/${nombre}`

  const { error: upErr } = await supabase.storage
    .from('documentos-ot')
    .upload(ruta, blob, { contentType: 'application/pdf', upsert: true })
  if (upErr) throw new Error(upErr.message)

  const { data, error: signErr } = await supabase.storage
    .from('documentos-ot')
    .createSignedUrl(ruta, 60 * 60 * 24 * 365) // URL válida 1 año
  if (signErr) throw new Error(signErr.message)
  return data.signedUrl
}

// ─── Modal visor PDF ──────────────────────────────────────────────────────────
function ModalPDF({ html, asig, ot, onCerrar, onGuardado }) {
  const iframeRef   = useRef(null)
  const { usuario } = useAuth()
  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ')

  const [pdfState, setPdfState] = useState(null)
  // pdfState: null | 'generando' | 'subiendo' | { url, contactos[] } | { error: string }

  const tituloArchivo = `REG-DII-036_${ot.ot_numero}_${new Date().toISOString().slice(0,10)}.pdf`
  const tituloModal   = `REG-DII-036 · ${ot.ot_numero}`

  async function handleGuardarPDF() {
    try {
      setPdfState('generando')
      const base64 = await generatePDFBase64(asig, ot)
      setPdfState('subiendo')
      const url = await subirPDFaSupabase(base64, tituloArchivo, ot.ot_numero)

      // Registrar en documentos_ot como etapa 07 completada (insert/update manual)
      const { data: docExist } = await supabase.from('documentos_ot')
        .select('id').eq('ot_numero', ot.ot_numero).eq('tipo', 'asignacion').maybeSingle()
      const docPayload = {
        ot_numero: ot.ot_numero, tipo: 'asignacion',
        nombre_archivo: tituloArchivo, drive_url: url,
        subido_por: nombreCompleto || 'Sistema',
      }
      if (docExist) {
        const { error: updDocErr } = await supabase.from('documentos_ot').update(docPayload).eq('id', docExist.id)
        if (updDocErr) throw new Error('Error actualizando registro: ' + updDocErr.message)
      } else {
        const { error: insDocErr } = await supabase.from('documentos_ot').insert(docPayload)
        if (insDocErr) throw new Error('Error registrando documento: ' + insDocErr.message)
      }

      // Buscar email y teléfono de los inspectores asignados
      const nombres = (asig.inspectores_asignados || '')
        .split(',').map(n => n.trim()).filter(Boolean)
      const { data: contactos } = await supabase
        .from('v_usuarios_portal')
        .select('nombre_completo,email,telefono_whatsapp')
        .in('nombre_completo', nombres)

      setPdfState({ url, contactos: contactos || [] })
      onGuardado?.()   // notifica a DetalleOT para refrescar documentos
    } catch (e) {
      setPdfState({ error: e.message })
    }
  }

  function descargar() {
    iframeRef.current?.contentWindow?.print()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:9999, display:'flex', flexDirection:'column' }}>
      {/* Barra superior */}
      <div style={{ background:'#1A3A5C', color:'#fff', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, gap:8, flexWrap:'wrap' }}>
        <span style={{ fontSize:13, fontWeight:'bold' }}>{tituloModal}</span>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>

          {/* Guardar PDF en sistema */}
          {pdfState === null && (
            <button onClick={handleGuardarPDF} style={{ ...btnModal, background:'#059669' }}>
              💾 Guardar PDF
            </button>
          )}
          {(pdfState === 'generando' || pdfState === 'subiendo') && (
            <span style={{ fontSize:12, color:'#93C5FD', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⏳</span>
              {pdfState === 'generando' ? 'Generando PDF...' : 'Guardando PDF...'}
            </span>
          )}
          {pdfState?.url && (() => {
            const contactos  = pdfState.contactos || []
            const conTel     = contactos.find(c => c.telefono_whatsapp)
            const emailsStr  = contactos.map(c => c.email).filter(Boolean).join(',')
            const msgWA      = buildWAMensaje({
              otNumero:        ot.ot_numero,
              cliente:         ot.cliente,
              contacto:        ot.contacto,
              telefonoCliente: ot.telefono_cliente,
              sede:            ot.direccion_faena || ot.sede,
              fechaInspeccion: asig.fecha_inspeccion,
              hora:            asig.hora,
              vehiculo:        asig.vehiculo,
              tipos:           asig.tipos_inspeccion,
              procedimientos:  asig.procedimientos,
              normaEjecucion:  asig.norma_ejecucion,
              descripcion:     asig.descripcion_actividad,
              supervisorNombre: asig.supervisor,
              pdfUrl:          pdfState.url,
            })
            const urlWA = conTel ? waLink(conTel.telefono_whatsapp, msgWA) : null
            const asunto = encodeURIComponent(`Asignación OT ${ot.ot_numero} — WSS División Inspección Industrial`)
            const cuerpo = encodeURIComponent(
              `Estimado/a inspector/a,\n\nHas sido asignado/a a la siguiente actividad de inspección:\n\n` +
              `OT: ${ot.ot_numero}\nCliente: ${ot.cliente || '—'}\nFecha: ${asig.fecha_inspeccion || 'Por confirmar'}\n` +
              `Hora: ${asig.hora || 'Por confirmar'}\nSupervisor: ${asig.supervisor || '—'}\n` +
              `Descripción: ${asig.descripcion_actividad || '—'}\n\n` +
              `Documento REG-DII-036: ${pdfState.url}\n\nPor favor confirma recepción.\n\nWSS División Inspección Industrial`
            )
            const urlEmail = emailsStr ? `mailto:${emailsStr}?subject=${asunto}&body=${cuerpo}` : null
            return (
              <>
                <a href={pdfState.url} target="_blank" rel="noreferrer"
                  style={{ ...btnModal, background:'#059669', textDecoration:'none' }}>
                  ✅ Ver / Descargar
                </a>
                {urlWA && (
                  <a href={urlWA} target="_blank" rel="noreferrer"
                    style={{ ...btnModal, background:'#16a34a', textDecoration:'none' }}>
                    📱 WhatsApp inspector
                  </a>
                )}
                {urlEmail && (
                  <a href={urlEmail}
                    style={{ ...btnModal, background:'#7c3aed', textDecoration:'none' }}>
                    📧 Email inspector
                  </a>
                )}
              </>
            )
          })()}
          {pdfState?.error && (
            <span style={{ fontSize:11, color:'#FCA5A5', maxWidth:260 }} title={pdfState.error}>
              ⚠️ {pdfState.error.length > 50 ? pdfState.error.slice(0,50)+'…' : pdfState.error}
              &nbsp;<button onClick={() => setPdfState(null)} style={{ background:'none', border:'none', color:'#FCA5A5', cursor:'pointer', fontSize:11 }}>Reintentar</button>
            </span>
          )}

          <button onClick={descargar} style={{ ...btnModal, background:'#2563EB' }}>
            📥 Imprimir / PDF
          </button>
          <button onClick={onCerrar} style={{ ...btnModal, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)' }}>
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* Visor */}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ flex:1, border:'none', background:'#f0f0f0', width:'100%' }}
        title="Vista previa REG-DII-036"
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const btnModal = {
  display:'inline-flex', alignItems:'center', gap:5,
  padding:'6px 14px', borderRadius:6,
  color:'#fff', fontWeight:'bold', fontSize:12,
  border:'none', cursor:'pointer',
}

// ─── Tarjeta de asignación ────────────────────────────────────────────────────
function TarjetaAsignacion({ asig, ot, onVerPDF }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderLeft:'4px solid #1A3A5C', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:10 }}>
        <div>
          <div style={{ fontSize:11, color:'#999', fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.05em' }}>REG-DII-036</div>
          <div style={{ fontSize:15, fontWeight:'bold', color:'#1A3A5C', marginTop:2 }}>{asig.inspectores_asignados}</div>
          <div style={{ fontSize:12, color:'#666', marginTop:2 }}>Supervisor: {asig.supervisor}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <span style={{ display:'inline-block', fontSize:10, fontWeight:'bold', padding:'3px 10px', borderRadius:20, background:'#EAF3DE', color:'#3B6D11' }}>
            ✅ {asig.estado}
          </span>
          {asig.fecha_inspeccion && (
            <div style={{ fontSize:11, color:'#888', marginTop:4 }}>
              📅 {asig.fecha_inspeccion}{asig.hora ? ` · ${asig.hora}` : ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px', fontSize:12, color:'#555', marginBottom:10 }}>
        {asig.vehiculo       && <div>🚗 Vehículo: <b>{asig.vehiculo}</b></div>}
        {asig.tiempo_estimado&& <div>⏱ Tiempo: <b>{asig.tiempo_estimado}</b></div>}
        {asig.norma_ejecucion&& <div>📐 Ejec.: <b>{asig.norma_ejecucion}</b></div>}
        {asig.norma_evaluacion&&<div>📋 Eval.: <b>{asig.norma_evaluacion}</b></div>}
      </div>

      {asig.procedimientos && (
        <div style={{ fontSize:11, background:'#F7F8FA', borderRadius:6, padding:'6px 10px', marginBottom:6 }}>
          <span style={{ color:'#888', fontWeight:'bold' }}>Procedimientos: </span>{asig.procedimientos}
        </div>
      )}
      {asig.tipos_inspeccion && (
        <div style={{ fontSize:11, background:'#F7F8FA', borderRadius:6, padding:'6px 10px', marginBottom:6 }}>
          <span style={{ color:'#888', fontWeight:'bold' }}>Informes a emitir: </span>
          {asig.tipos_inspeccion.toUpperCase().split(/[,\s]+/).filter(Boolean).map(cod => {
            const m = END_METHODS.find(e => e.cod === cod)
            return m ? (
              <span key={cod} style={{ display:'inline-block', fontSize:9, fontWeight:'bold', padding:'2px 7px', borderRadius:10, background: m.reg ? '#E6F1FB' : '#F1F5F9', color: m.reg ? '#185FA5' : '#888', marginLeft:4, fontFamily:'monospace' }}>
                {m.reg || cod}
              </span>
            ) : <span key={cod} style={{ marginLeft:4, color:'#aaa' }}>{cod}</span>
          })}
        </div>
      )}
      {asig.descripcion_actividad && (
        <div style={{ fontSize:12, color:'#444', background:'#f9f9f9', borderRadius:6, padding:'8px 10px', marginBottom:8 }}>
          {asig.descripcion_actividad}
        </div>
      )}

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
        {asig.whatsapp_inspectores_url && (
          <a href={asig.whatsapp_inspectores_url} target="_blank" rel="noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, padding:'5px 12px', borderRadius:20, background:'#25D366', color:'#fff', fontWeight:'bold', textDecoration:'none' }}>
            💬 Reenviar WhatsApp
          </a>
        )}
        <button onClick={() => onVerPDF(asig)}
          style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, padding:'5px 14px', borderRadius:20, background:'#1A3A5C', color:'#fff', fontWeight:'bold', border:'none', cursor:'pointer' }}>
          📄 Ver documento
        </button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TabAsignaciones({ ot, onActualizar }) {
  const { usuario } = useAuth()
  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ')

  const [asignaciones, setAsignaciones]   = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [mostrarForm, setMostrarForm]     = useState(false)
  const [guardando, setGuardando]         = useState(false)
  const [exito, setExito]                 = useState(null)
  const [pdfModal, setPdfModal]           = useState(null) // asig object

  const [equipos, setEquipos]               = useState([])
  const [procedimientos, setProcedimientos] = useState([])
  const [inspectores, setInspectores]       = useState([])
  const [vehiculos, setVehiculos]           = useState([])
  const [normasCustomEj, setNormasCustomEj] = useState([])
  const [normasCustomEv, setNormasCustomEv] = useState([])
  const [inputNormaEj, setInputNormaEj]     = useState('')
  const [inputNormaEv, setInputNormaEv]     = useState('')

  const FORM_INIT = {
    supervisor:'', inspectoresSeleccionados:[], equiposSeleccionados:[],
    procedimientosSeleccionados:[], tiposInspeccion:[],
    fechaInspeccion:'', hora:'', tiempoEstimado:'', vehiculo:'',
    normasEjecucion:[], normasEvaluacion:[], descripcionActividad:'',
  }
  const [form, setForm] = useState(FORM_INIT)

  const cargarAsignaciones = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase.rpc('obtener_asignaciones_por_ot', { p_ot_numero: ot.ot_numero })
      if (err) throw err
      setAsignaciones(data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [ot.ot_numero])

  const cargarCatalogos = useCallback(async () => {
    try {
      const [{ data: eq }, { data: proc }, { data: insp }, { data: veh }, { data: nc }] = await Promise.all([
        supabase.from('equipos').select('id,equipo_instrumento,codigo').eq('activo',true).order('equipo_instrumento'),
        supabase.from('catalogo_procedimientos').select('id,nombre,codigo').eq('activo',true).order('codigo'),
        supabase.from('v_usuarios_portal').select('nombre_completo,email,telefono_whatsapp,rol,activo')
          .in('rol',['INSPECTOR','SUPERVISOR','ADMIN']).eq('activo', true).order('nombre_completo'),
        supabase.from('vehiculos').select('id,patente,descripcion').eq('activo',true).order('patente'),
        supabase.from('normas_custom').select('tipo,norma').order('norma'),
      ])
      setEquipos(eq||[]); setProcedimientos(proc||[]); setInspectores(insp||[]); setVehiculos(veh||[])
      setNormasCustomEj((nc||[]).filter(n=>n.tipo==='ejecucion').map(n=>n.norma))
      setNormasCustomEv((nc||[]).filter(n=>n.tipo==='evaluacion').map(n=>n.norma))
    } catch(e) { console.error('Catálogos:', e) }
  }, [])

  async function agregarNormaCustom(tipo, valor, setInput) {
    const norma = valor.trim()
    if (!norma) return
    const yaExiste = tipo === 'ejecucion'
      ? [...NORMAS_EJECUCION_BASE, ...normasCustomEj].some(n => n.toLowerCase() === norma.toLowerCase())
      : [...NORMAS_EVALUACION_BASE, ...normasCustomEv].some(n => n.toLowerCase() === norma.toLowerCase())
    if (yaExiste) { setInput(''); return }
    await supabase.from('normas_custom').upsert({ tipo, norma }, { onConflict: 'tipo,norma' })
    if (tipo === 'ejecucion') {
      setNormasCustomEj(prev => [...prev, norma].sort())
      setForm(f => ({ ...f, normasEjecucion: [...f.normasEjecucion, norma] }))
    } else {
      setNormasCustomEv(prev => [...prev, norma].sort())
      setForm(f => ({ ...f, normasEvaluacion: [...f.normasEvaluacion, norma] }))
    }
    setInput('')
  }

  useEffect(() => { cargarAsignaciones(); cargarCatalogos() }, [cargarAsignaciones, cargarCatalogos])

  const toggle = (field, val, keyFn) => setForm(f => {
    const list = f[field]
    const key = keyFn ? keyFn(val) : val
    const exists = keyFn ? list.find(i => keyFn(i) === key) : list.includes(val)
    return { ...f, [field]: exists ? list.filter(i => (keyFn ? keyFn(i) : i) !== key) : [...list, val] }
  })

  async function guardarAsignacion() {
    if (!form.inspectoresSeleccionados.length) { alert('Selecciona al menos un inspector.'); return }
    if (!form.descripcionActividad.trim()) { alert('La descripción de actividades es obligatoria.'); return }
    setGuardando(true); setExito(null); setError(null)
    try {
      const inspStr  = form.inspectoresSeleccionados.map(i => i.nombre_completo).join(', ')
      const procStr  = form.procedimientosSeleccionados.join(', ')
      const tiposStr = form.tiposInspeccion.join(', ')
      const eqStr    = form.equiposSeleccionados.join(', ')
      const supNombre = form.supervisor || nombreCompleto

      const normaEjStr  = form.normasEjecucion.join(', ')
      const normaEvStr  = form.normasEvaluacion.join(', ')

      const mensajeWA = buildWAMensaje({
        otNumero:        ot.ot_numero,
        cliente:         ot.cliente,
        contacto:        ot.contacto,
        telefonoCliente: ot.telefono_cliente,
        sede:            ot.direccion_faena || ot.sede,
        fechaInspeccion: form.fechaInspeccion,
        hora:            form.hora,
        vehiculo:        form.vehiculo,
        tipos:           tiposStr,
        procedimientos:  procStr,
        normaEjecucion:  normaEjStr,
        descripcion:     form.descripcionActividad,
        supervisorNombre: supNombre,
      })

      const primerConTel = form.inspectoresSeleccionados.find(i => i.telefono_whatsapp)
      const waUrl = primerConTel ? waLink(primerConTel.telefono_whatsapp, mensajeWA) : null

      const descFinal = eqStr
        ? `${form.descripcionActividad}\n\nEquipos/instrumentos: ${eqStr}`
        : form.descripcionActividad

      const { error: err } = await supabase.rpc('crear_asignacion_portal', {
        p_email_usuario: usuario?.email||'', p_ot_numero: ot.ot_numero,
        p_supervisor: supNombre, p_inspectores_asignados: inspStr,
        p_fecha_inspeccion: form.fechaInspeccion||null, p_hora: form.hora||null,
        p_tiempo_estimado: form.tiempoEstimado||null, p_vehiculo: form.vehiculo||null,
        p_norma_ejecucion: normaEjStr||null, p_norma_evaluacion: normaEvStr||null,
        p_procedimientos: procStr||null, p_tipos_inspeccion: tiposStr||null,
        p_descripcion_actividad: descFinal, p_drive_url: null,
        p_whatsapp_inspectores_url: waUrl,
      })
      if (err) throw err

      setExito({
        inspectores: form.inspectoresSeleccionados,
        waLinks: form.inspectoresSeleccionados.filter(i => i.telefono_whatsapp)
          .map(i => ({ nombre:i.nombre_completo, url:waLink(i.telefono_whatsapp, mensajeWA) })),
      })
      setMostrarForm(false)
      setForm(FORM_INIT)
      await cargarAsignaciones()
    } catch(e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  if (loading) return <div style={{ textAlign:'center', padding:32, color:'#aaa' }}>Cargando asignaciones...</div>

  return (
    <div>
      {/* Modal PDF */}
      {pdfModal && (
        <ModalPDF
          html={buildPDFHtml(pdfModal, ot)}
          asig={pdfModal}
          ot={ot}
          onCerrar={() => setPdfModal(null)}
          onGuardado={onActualizar}
        />
      )}

      {/* Encabezado */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:'bold', color:'#1A3A5C' }}>Asignaciones de Actividades</div>
          <div style={{ fontSize:11, color:'#999' }}>REG-DII-036 Rev.04</div>
        </div>
        {!mostrarForm && (
          <button onClick={() => { setMostrarForm(true); setExito(null) }}
            style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'8px 16px', borderRadius:8, background:'#1A3A5C', color:'#fff', border:'none', cursor:'pointer', fontSize:13, fontWeight:'bold' }}>
            + Nueva asignación
          </button>
        )}
      </div>

      {error && <div style={{ background:'#FCEBEB', border:'1px solid #E57373', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#A32D2D', marginBottom:12 }}>⚠️ {error}</div>}

      {exito && (
        <div style={{ background:'#EAF3DE', border:'1px solid #97C459', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:'bold', color:'#3B6D11', marginBottom:8 }}>✅ Asignación guardada correctamente</div>
          <div style={{ fontSize:12, color:'#555', marginBottom:8 }}>Inspector(es): <b>{exito.inspectores.map(i=>i.nombre_completo).join(', ')}</b></div>
          {exito.waLinks.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:'#666', fontWeight:'bold', marginBottom:6 }}>📱 Enviar notificación por WhatsApp:</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {exito.waLinks.map(l => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, padding:'6px 14px', borderRadius:20, background:'#25D366', color:'#fff', fontWeight:'bold', textDecoration:'none' }}>
                    💬 Notificar a {l.nombre}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulario nueva asignación */}
      {mostrarForm && (
        <div style={{ background:'#fff', border:'1px solid #e8e8e8', borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:'bold', color:'#1A3A5C', marginBottom:16 }}>
            Nueva Asignación — {ot.ot_numero} · {ot.cliente}
          </div>

          {/* Inspectores */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Inspector(es) asignado(s) * <span style={{ fontSize:10, color:'#185FA5', fontWeight:'normal', marginLeft:6 }}>selección múltiple</span></label>
            <div style={checkboxListStyle}>
              {inspectores.map(insp => {
                const sel = !!form.inspectoresSeleccionados.find(i => i.email===insp.email)
                return (
                  <label key={insp.email} style={checkRowStyle(sel)}>
                    <input type="checkbox" checked={sel} onChange={() => toggle('inspectoresSeleccionados', insp, i => i.email)} style={{ width:'auto', cursor:'pointer' }} />
                    <span style={{ flex:1, fontSize:13 }}>{insp.nombre_completo}</span>
                    <span style={{ fontSize:10, color:'#aaa' }}>{insp.telefono_whatsapp||''}</span>
                  </label>
                )
              })}
            </div>
            {form.inspectoresSeleccionados.length > 0 && (
              <div style={{ fontSize:11, color:'#185FA5', marginTop:5 }}>
                ✅ {form.inspectoresSeleccionados.length} inspector(es): {form.inspectoresSeleccionados.map(i=>i.nombre_completo).join(', ')}
              </div>
            )}
          </div>

          {/* Supervisor + Fecha/Hora */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
            <div><label style={labelStyle}>Supervisor</label>
              <select value={form.supervisor} onChange={e=>setForm(f=>({...f,supervisor:e.target.value}))} style={inputStyle}>
                <option value="">— {nombreCompleto || 'Seleccionar'} —</option>
                {inspectores
                  .filter(i => ['SUPERVISOR','ADMIN'].includes(i.rol))
                  .map(i => <option key={i.email} value={i.nombre_completo}>{i.nombre_completo}</option>)
                }
              </select>
            </div>
            <div><label style={labelStyle}>Fecha inspección *</label>
              <input type="date" value={form.fechaInspeccion} onChange={e=>setForm(f=>({...f,fechaInspeccion:e.target.value}))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Hora</label>
              <input type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} style={inputStyle} /></div>
          </div>

          {/* Condiciones */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {/* Tiempo estimado */}
            <div>
              <label style={labelStyle}>Tiempo estimado</label>
              <select value={form.tiempoEstimado} onChange={e=>setForm(f=>({...f,tiempoEstimado:e.target.value}))} style={inputStyle}>
                <option value="">— Seleccionar —</option>
                {TIEMPOS_EST.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* Vehículo */}
            <div>
              <label style={labelStyle}>Vehículo</label>
              <select value={form.vehiculo} onChange={e=>setForm(f=>({...f,vehiculo:e.target.value}))} style={inputStyle}>
                <option value="">— Seleccionar —</option>
                {vehiculos.length > 0
                  ? vehiculos.map(v => <option key={v.id} value={`${v.patente}${v.descripcion ? ' — '+v.descripcion : ''}`}>{v.patente}{v.descripcion ? ` — ${v.descripcion}` : ''}</option>)
                  : <option disabled>Sin vehículos registrados</option>
                }
              </select>
            </div>
          </div>

          {/* Normas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {/* Norma ejecución */}
            <div>
              <label style={labelStyle}>
                Norma ejecución
                <span style={{ fontSize:10, color:'#185FA5', fontWeight:'normal', marginLeft:6 }}>selección múltiple</span>
              </label>
              <div style={checkboxListStyle}>
                {[...NORMAS_EJECUCION_BASE, ...normasCustomEj].map(n => {
                  const sel = form.normasEjecucion.includes(n)
                  return (
                    <label key={n} style={checkRowStyle(sel)}>
                      <input type="checkbox" checked={sel} onChange={()=>toggle('normasEjecucion', n)} style={{width:'auto',cursor:'pointer'}} />
                      <span style={{fontSize:11}}>{n}</span>
                    </label>
                  )
                })}
              </div>
              {/* Campo para agregar norma manual */}
              <div style={{ display:'flex', gap:5, marginTop:6 }}>
                <input
                  value={inputNormaEj}
                  onChange={e=>setInputNormaEj(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); agregarNormaCustom('ejecucion', inputNormaEj, setInputNormaEj) }}}
                  placeholder="Agregar norma no listada…"
                  style={{ ...inputStyle, fontSize:11, height:30, flex:1 }}
                />
                <button
                  type="button"
                  onClick={()=>agregarNormaCustom('ejecucion', inputNormaEj, setInputNormaEj)}
                  style={{ height:30, padding:'0 10px', background:'#1A3A5C', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', flexShrink:0 }}
                >+ Agregar</button>
              </div>
              {form.normasEjecucion.length > 0 && (
                <div style={{ marginTop:4, fontSize:11, color:'#185FA5' }}>
                  ✓ {form.normasEjecucion.join(' · ')}
                </div>
              )}
            </div>
            {/* Norma evaluación */}
            <div>
              <label style={labelStyle}>
                Norma evaluación
                <span style={{ fontSize:10, color:'#185FA5', fontWeight:'normal', marginLeft:6 }}>selección múltiple</span>
              </label>
              <div style={checkboxListStyle}>
                {[...NORMAS_EVALUACION_BASE, ...normasCustomEv].map(n => {
                  const sel = form.normasEvaluacion.includes(n)
                  return (
                    <label key={n} style={checkRowStyle(sel)}>
                      <input type="checkbox" checked={sel} onChange={()=>toggle('normasEvaluacion', n)} style={{width:'auto',cursor:'pointer'}} />
                      <span style={{fontSize:11}}>{n}</span>
                    </label>
                  )
                })}
              </div>
              {/* Campo para agregar norma manual */}
              <div style={{ display:'flex', gap:5, marginTop:6 }}>
                <input
                  value={inputNormaEv}
                  onChange={e=>setInputNormaEv(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); agregarNormaCustom('evaluacion', inputNormaEv, setInputNormaEv) }}}
                  placeholder="Agregar norma no listada…"
                  style={{ ...inputStyle, fontSize:11, height:30, flex:1 }}
                />
                <button
                  type="button"
                  onClick={()=>agregarNormaCustom('evaluacion', inputNormaEv, setInputNormaEv)}
                  style={{ height:30, padding:'0 10px', background:'#1A3A5C', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', flexShrink:0 }}
                >+ Agregar</button>
              </div>
              {form.normasEvaluacion.length > 0 && (
                <div style={{ marginTop:4, fontSize:11, color:'#185FA5' }}>
                  ✓ {form.normasEvaluacion.join(' · ')}
                </div>
              )}
            </div>
          </div>

          {/* Procedimientos */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Procedimientos WSS * <span style={{ fontSize:10, color:'#185FA5', fontWeight:'normal', marginLeft:6 }}>selección múltiple</span></label>
            <div style={checkboxListStyle}>
              {procedimientos.map(proc => {
                const val = `${proc.codigo} — ${proc.nombre}`, sel = form.procedimientosSeleccionados.includes(val)
                return (
                  <label key={proc.id} style={checkRowStyle(sel)}>
                    <input type="checkbox" checked={sel} onChange={()=>toggle('procedimientosSeleccionados',val)} style={{width:'auto',cursor:'pointer'}} />
                    <span style={{fontSize:12}}><b>{proc.codigo}</b> — {proc.nombre}</span>
                  </label>
                )
              })}
            </div>
            {form.procedimientosSeleccionados.length > 0 && (
              <div style={{fontSize:11,color:'#185FA5',marginTop:5}}>✅ {form.procedimientosSeleccionados.join(' · ')}</div>
            )}
          </div>

          {/* Equipos */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Equipos / instrumentos <span style={{fontSize:10,color:'#185FA5',fontWeight:'normal',marginLeft:6}}>selección múltiple</span></label>
            <div style={{...checkboxListStyle, maxHeight:200}}>
              {equipos.map(eq => {
                const val = `${eq.codigo} — ${eq.equipo_instrumento}`, sel = form.equiposSeleccionados.includes(val)
                return (
                  <label key={eq.id} style={checkRowStyle(sel)}>
                    <input type="checkbox" checked={sel} onChange={()=>toggle('equiposSeleccionados',val)} style={{width:'auto',cursor:'pointer'}} />
                    <span style={{flex:1,fontSize:12}}>{eq.equipo_instrumento}</span>
                    <span style={{fontSize:10,color:'#aaa',fontFamily:'monospace'}}>{eq.codigo}</span>
                  </label>
                )
              })}
            </div>
            {form.equiposSeleccionados.length > 0 && (
              <div style={{fontSize:11,color:'#185FA5',marginTop:5}}>✅ {form.equiposSeleccionados.length} equipo(s)</div>
            )}
          </div>

          {/* Métodos END / Informes a generar */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>
              Métodos END aplicados{' '}
              <span style={{fontSize:10,color:'#185FA5',fontWeight:'normal'}}>→ define los informes REG-DII que emitirá el inspector</span>
            </label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
              {END_METHODS.map(m => {
                const sel = form.tiposInspeccion.includes(m.cod)
                return (
                  <button key={m.cod} onClick={()=>toggle('tiposInspeccion',m.cod)} style={{
                    padding:'7px 10px',borderRadius:8,cursor:'pointer',textAlign:'center',minWidth:82,
                    border:`1.5px solid ${sel?'#185FA5':'#ddd'}`,
                    background:sel?'#E6F1FB':'#fff',
                    color:sel?'#185FA5':'#555',transition:'all 0.15s',
                  }}>
                    <span style={{display:'block',fontWeight:900,fontSize:13}}>{m.cod}</span>
                    <span style={{display:'block',fontSize:9,color:sel?'#185FA5':'#aaa',marginTop:1}}>{m.desc}</span>
                    {m.reg && <span style={{display:'block',fontSize:9,fontWeight:'bold',color:sel?'#3B72B5':'#ccc',marginTop:2,fontFamily:'monospace'}}>{m.reg}</span>}
                  </button>
                )
              })}
            </div>
            {form.tiposInspeccion.length > 0 && (
              <div style={{marginTop:8,padding:'8px 12px',background:'#EAF3DE',borderRadius:8,fontSize:12,color:'#3B6D11',border:'1px solid #97C459'}}>
                📋 <b>El inspector debe emitir:</b>{' '}
                {form.tiposInspeccion.map(cod => {
                  const m = END_METHODS.find(e => e.cod === cod)
                  return m?.reg ? `${m.reg} (${cod})` : cod
                }).join(' · ')}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div style={{marginBottom:16}}>
            <label style={labelStyle}>Descripción de actividades / Alcance *</label>
            <textarea value={form.descripcionActividad} onChange={e=>setForm(f=>({...f,descripcionActividad:e.target.value}))}
              placeholder="Detallar las actividades a realizar..." rows={4}
              style={{...inputStyle,resize:'vertical',minHeight:90}} />
          </div>

          <div style={{background:'#E6F1FB',border:'1px solid #85B7EB',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#185FA5',marginBottom:14}}>
            💬 Al guardar se generarán los <b>links de WhatsApp</b> para notificar a cada inspector.
          </div>

          {error && <div style={{background:'#FCEBEB',border:'1px solid #E57373',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#A32D2D',marginBottom:12}}>⚠️ {error}</div>}

          <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
            <button onClick={()=>{setMostrarForm(false);setError(null)}} style={btnOutline}>Cancelar</button>
            <button onClick={guardarAsignacion} disabled={guardando}
              style={{...btnPrimary,opacity:guardando?0.7:1,cursor:guardando?'not-allowed':'pointer'}}>
              {guardando?'Guardando...':'Guardar y generar links WA →'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {asignaciones.length === 0 && !mostrarForm ? (
        <div style={{textAlign:'center',padding:'32px 16px',color:'#aaa',background:'#fff',borderRadius:10,border:'1px dashed #ddd'}}>
          <div style={{fontSize:32,marginBottom:8}}>📋</div>
          <div style={{fontSize:14,fontWeight:'bold',color:'#999'}}>Sin asignaciones</div>
          <div style={{fontSize:12,marginTop:4}}>Crea la primera asignación para esta OT</div>
        </div>
      ) : (
        <div>
          {asignaciones.length > 0 && (
            <div style={{fontSize:11,color:'#999',fontWeight:'bold',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>
              {asignaciones.length} asignación(es) registrada(s)
            </div>
          )}
          {asignaciones.map((a,i) => (
            <TarjetaAsignacion key={i} asig={a} ot={ot} onVerPDF={setPdfModal} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const labelStyle       = {display:'block',fontSize:11,color:'#666',fontWeight:'bold',marginBottom:4}
const inputStyle       = {width:'100%',padding:'8px 10px',border:'1.5px solid #ddd',borderRadius:8,fontSize:13,fontFamily:'Arial,sans-serif',boxSizing:'border-box'}
const checkboxListStyle= {border:'1.5px solid #ddd',borderRadius:8,padding:8,maxHeight:160,overflowY:'auto',background:'#fff'}
const checkRowStyle    = sel => ({display:'flex',alignItems:'center',gap:8,padding:'5px 4px',cursor:'pointer',borderRadius:6,fontWeight:'normal',margin:0,background:sel?'#EEF5FF':'transparent',transition:'background 0.1s'})
const btnPrimary       = {display:'inline-flex',alignItems:'center',gap:5,padding:'9px 18px',borderRadius:8,border:'none',background:'#1A3A5C',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:'bold'}
const btnOutline       = {display:'inline-flex',alignItems:'center',gap:5,padding:'9px 18px',borderRadius:8,border:'1.5px solid #1A3A5C',background:'#fff',color:'#1A3A5C',cursor:'pointer',fontSize:13,fontWeight:'bold'}
