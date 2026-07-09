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

function buildWAMensaje({ otNumero, cliente, fechaInspeccion, hora, descripcion, supervisorNombre }) {
  return (
    `Hola, te informamos que has sido asignado/a a una actividad de inspección.\n\n` +
    `*OT:* ${otNumero}\n*Cliente:* ${cliente}\n*Fecha:* ${fechaInspeccion || 'Por confirmar'}\n` +
    `*Hora:* ${hora || 'Por confirmar'}\n*Descripción:* ${descripcion || '—'}\n` +
    `*Supervisor:* ${supervisorNombre}\n\nPor favor confirma recepción. — WSS División Inspección Industrial`
  )
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
function ModalPDF({ html, asig, ot, onCerrar }) {
  const iframeRef   = useRef(null)
  const [pdfState, setPdfState] = useState(null)
  // pdfState: null | 'generando' | 'subiendo' | { url } | { error: string }

  const tituloArchivo = `REG-DII-036_${ot.ot_numero}_${new Date().toISOString().slice(0,10)}.pdf`
  const tituloModal   = `REG-DII-036 · ${ot.ot_numero}`

  async function handleGuardarPDF() {
    try {
      setPdfState('generando')
      const base64 = await generatePDFBase64(asig, ot)
      setPdfState('subiendo')
      const url = await subirPDFaSupabase(base64, tituloArchivo, ot.ot_numero)
      setPdfState({ url })
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
          {pdfState?.url && (
            <a href={pdfState.url} target="_blank" rel="noreferrer"
              style={{ ...btnModal, background:'#059669', textDecoration:'none' }}>
              ✅ Ver / Descargar
            </a>
          )}
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
          <span style={{ color:'#888', fontWeight:'bold' }}>Tipos: </span>{asig.tipos_inspeccion}
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
export default function TabAsignaciones({ ot }) {
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

  const [form, setForm] = useState({
    supervisor:'', inspectoresSeleccionados:[], equiposSeleccionados:[],
    procedimientosSeleccionados:[], tiposInspeccion:[],
    fechaInspeccion:'', hora:'', tiempoEstimado:'', vehiculo:'',
    normaEjecucion:'', normaEvaluacion:'', descripcionActividad:'',
  })

  const TIPOS = [
    {cod:'VT', desc:'Insp. visual'},{cod:'CD', desc:'Control dim.'},{cod:'PT', desc:'Líq. penetrantes'},
    {cod:'MT', desc:'Part. magnéticas'},{cod:'UT', desc:'Ultrasonido'},{cod:'UTT', desc:'Med. espesores'},
    {cod:'T', desc:'Termografía'},{cod:'CG', desc:'Cert. grúas'},{cod:'CTK', desc:'Cert. tanques'},
    {cod:'CS', desc:'Calif. soldador'},{cod:'PH', desc:'Prueba hidrost.'},{cod:'PN', desc:'Prueba neumática'},
    {cod:'CV', desc:'Cámara vacío'},{cod:'O', desc:'Otros'},
  ]

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
      const [{ data: eq }, { data: proc }, { data: insp }] = await Promise.all([
        supabase.from('equipos').select('id,equipo_instrumento,codigo').eq('activo',true).order('equipo_instrumento'),
        supabase.from('catalogo_procedimientos').select('id,nombre,codigo').eq('activo',true).order('codigo'),
        supabase.from('v_usuarios_portal').select('nombre_completo,email,telefono_whatsapp,rol')
          .in('rol',['INSPECTOR','SUPERVISOR','ADMIN']).order('nombre_completo'),
      ])
      setEquipos(eq||[]); setProcedimientos(proc||[]); setInspectores(insp||[])
    } catch(e) { console.error('Catálogos:', e) }
  }, [])

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

      const mensajeWA = buildWAMensaje({ otNumero:ot.ot_numero, cliente:ot.cliente,
        fechaInspeccion:form.fechaInspeccion, hora:form.hora,
        descripcion:form.descripcionActividad, supervisorNombre:supNombre })

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
        p_norma_ejecucion: form.normaEjecucion||null, p_norma_evaluacion: form.normaEvaluacion||null,
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
      setForm({ supervisor:'', inspectoresSeleccionados:[], equiposSeleccionados:[],
        procedimientosSeleccionados:[], tiposInspeccion:[],
        fechaInspeccion:'', hora:'', tiempoEstimado:'', vehiculo:'',
        normaEjecucion:'', normaEvaluacion:'', descripcionActividad:'' })
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
              {inspectores.filter(i => i.rol==='INSPECTOR').map(insp => {
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
              <input value={form.supervisor} onChange={e=>setForm(f=>({...f,supervisor:e.target.value}))} placeholder={nombreCompleto} style={inputStyle} /></div>
            <div><label style={labelStyle}>Fecha inspección *</label>
              <input type="date" value={form.fechaInspeccion} onChange={e=>setForm(f=>({...f,fechaInspeccion:e.target.value}))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Hora</label>
              <input type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} style={inputStyle} /></div>
          </div>

          {/* Condiciones */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:14 }}>
            <div><label style={labelStyle}>Tiempo estimado</label><input value={form.tiempoEstimado} onChange={e=>setForm(f=>({...f,tiempoEstimado:e.target.value}))} placeholder="Ej: 6 horas" style={inputStyle} /></div>
            <div><label style={labelStyle}>Vehículo</label><input value={form.vehiculo} onChange={e=>setForm(f=>({...f,vehiculo:e.target.value}))} placeholder="Ej: SKHP-59" style={inputStyle} /></div>
            <div><label style={labelStyle}>Norma ejecución</label><input value={form.normaEjecucion} onChange={e=>setForm(f=>({...f,normaEjecucion:e.target.value}))} placeholder="Ej: ASME V" style={inputStyle} /></div>
            <div><label style={labelStyle}>Norma evaluación</label><input value={form.normaEvaluacion} onChange={e=>setForm(f=>({...f,normaEvaluacion:e.target.value}))} placeholder="Ej: AWS D1.1" style={inputStyle} /></div>
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

          {/* Tipos */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Tipos de inspección</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
              {TIPOS.map(t => {
                const sel = form.tiposInspeccion.includes(t.cod)
                return (
                  <button key={t.cod} onClick={()=>toggle('tiposInspeccion',t.cod)} style={{
                    padding:'6px 10px',borderRadius:8,cursor:'pointer',fontSize:11,
                    border:`1.5px solid ${sel?'#185FA5':'#ddd'}`,
                    background:sel?'#E6F1FB':'#fff',fontWeight:sel?'bold':'normal',
                    color:sel?'#185FA5':'#555',transition:'all 0.15s',
                  }}>
                    <span style={{display:'block',fontWeight:900,fontSize:13}}>{t.cod}</span>
                    <span style={{display:'block',fontSize:9,color:sel?'#185FA5':'#aaa'}}>{t.desc}</span>
                  </button>
                )
              })}
            </div>
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
