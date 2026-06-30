// ============================================================
// TabInformes.jsx — Reserva + Carga de Informes REG-DII-055
// ESI/EAI (Evaluación) | IVS/IVA (Verificación)
// Santiago → ESI/IVS | Antofagasta → EAI/IVA
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

// ── Helper: subir archivo a Drive via Vercel Function ────────────────────────
async function subirArchivoADrive(folderId, file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const res = await fetch('/api/drive/subir-archivo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId, file_name: file.name, file_content_base64: base64, mime_type: file.type }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Error al subir a Drive')
  return data
}

const AREAS = [
  { key: 'END', label: 'END', desc: 'Ensayos No Destructivos' },
  { key: 'IZL', label: 'Izaje y Levante', desc: 'Informes de izaje y levante' },
  { key: 'TRZ', label: 'Trazabilidad', desc: 'Informes de trazabilidad' },
  { key: 'VER', label: 'Verificación', desc: 'IVS (Santiago) o IVA (Antofagasta)' },
]

const SELLOS = ['N/A', 'Sin sello', 'WSS SCL-DII', 'WSS ANF-DII']

const inp = {
  width: '100%', padding: '7px 10px', border: '1px solid #CBD5E1',
  borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}
const inpRO = { ...inp, background: '#F8FAFC', color: '#475569', fontWeight: 600 }

function isAntofagasta(sede) {
  return (sede || '').toLowerCase().includes('antofagasta')
}
function getSerie(area, sede) {
  if (area === 'VER') return isAntofagasta(sede) ? 'IVA' : 'IVS'
  return isAntofagasta(sede) ? 'EAI' : 'ESI'
}
function formatCodigo(serie, num) {
  return `${serie}-${String(num).padStart(4, '0')}`
}

function Lbl({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>{children}</div>
}
function G2({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>{children}</div> }
function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 18, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg,#1A3A5C,#185FA5)', color: '#fff', padding: '7px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase' }}>{titulo}</div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

function ContadorArea({ area, value, onChange, serie }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: value > 0 ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${value > 0 ? '#93C5FD' : '#E2E8F0'}`, borderRadius: 8, transition: 'all .15s' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>{area.label}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>{area.desc} · <span style={{ color: '#185FA5', fontWeight: 700 }}>{serie}</span></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <div style={{ minWidth: 32, textAlign: 'center', fontSize: 18, fontWeight: 900, color: value > 0 ? '#1A3A5C' : '#CBD5E1' }}>{value}</div>
        <button type="button" onClick={() => onChange(Math.min(99, value + 1))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>
    </div>
  )
}

function FormReserva({ ot, onReservada, onCancel }) {
  const { usuario } = useAuth()
  const sede = ot.sede || ''
  const [cantidades, setCantidades] = useState({ END: 0, IZL: 0, TRZ: 0, VER: 0 })
  const [sello, setSello] = useState('N/A')
  const [selloPersonalizado, setSelloPersonalizado] = useState('')
  const [acta, setActa] = useState('')
  const [fechaInspeccion, setFechaInspeccion] = useState(new Date().toISOString().split('T')[0])
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [inspector, setInspector] = useState('')
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const total = Object.values(cantidades).reduce((a, b) => a + b, 0)

  async function reservar() {
    if (total === 0) { setError('Debes indicar al menos 1 informe a reservar'); return }
    setGuardando(true); setError('')
    try {
      const registros = []
      for (const area of ['END', 'IZL', 'TRZ', 'VER']) {
        const qty = cantidades[area]
        if (qty === 0) continue
        const serie = getSerie(area, sede)
        // Obtener número inicial para esta serie
        const { data: numInicio, error: numErr } = await supabase.rpc('siguiente_numero_informe', { p_serie: serie })
        if (numErr) throw numErr
        for (let i = 0; i < qty; i++) {
          const num = numInicio + i
          registros.push({
            serie,
            numero_correlativo: num,
            codigo_informe: formatCodigo(serie, num),
            ot_numero: ot.ot_numero,
            sede,
            area,
            producto: ot.descripcion_servicio || ot.tipo_servicio || null,
            sello: sello === 'N/A' ? 'N/A' : (selloPersonalizado || sello),
            acta_asociada: acta || null,
            fecha_inspeccion: fechaInspeccion || null,
            fecha_entrega_informe: fechaEntrega || null,
            inspector: inspector || null,
            observacion: observacion || null,
            created_by: usuario?.email || '',
          })
        }
      }
      const { error: insErr } = await supabase.from('numeros_informe').insert(registros)
      if (insErr) throw insErr
      onReservada(registros.map(r => r.codigo_informe))
    } catch (e) {
      setError(e.message || 'Error al reservar los números de informe')
    } finally { setGuardando(false) }
  }

  const serieLabel = isAntofagasta(sede) ? 'EAI / IVA' : 'ESI / IVS'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 16px', marginBottom: 18 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17, color: '#1A3A5C' }}>RESERVA DE NÚMEROS DE INFORME</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>World Survey Services S.A. · REG-DII-055 Rev.02</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#64748B', lineHeight: 1.8 }}>
          <div><b>OT:</b> {ot.ot_numero}</div>
          <div><b>Serie:</b> <span style={{ color: '#185FA5', fontWeight: 700 }}>{serieLabel}</span></div>
          <div><b>Sede:</b> {sede || 'No definida'}</div>
        </div>
      </div>

      {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>⚠️ {error}</div>}

      {/* Distribución por área */}
      <Seccion titulo="Distribución por área — Cantidad de informes a reservar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AREAS.map(area => (
            <ContadorArea
              key={area.key}
              area={area}
              value={cantidades[area.key]}
              onChange={v => setCantidades(c => ({ ...c, [area.key]: v }))}
              serie={getSerie(area.key, sede)}
            />
          ))}
        </div>
        {total > 0 && (
          <div style={{ marginTop: 12, padding: '8px 14px', background: '#1A3A5C', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700 }}>
            Total a reservar: {total} número{total > 1 ? 's' : ''}
          </div>
        )}
      </Seccion>

      {/* Sello */}
      <Seccion titulo="Sello">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: sello !== 'N/A' && !SELLOS.includes(sello) ? 10 : 0 }}>
          {SELLOS.map(s => (
            <button key={s} type="button" onClick={() => { setSello(s); setSelloPersonalizado('') }}
              style={{ padding: '6px 14px', borderRadius: 20, border: '2px solid', borderColor: sello === s ? '#1A3A5C' : '#CBD5E1', background: sello === s ? '#1A3A5C' : '#fff', color: sello === s ? '#fff' : '#64748B', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {s}
            </button>
          ))}
          <button type="button" onClick={() => setSello('CUSTOM')}
            style={{ padding: '6px 14px', borderRadius: 20, border: '2px solid', borderColor: sello === 'CUSTOM' ? '#1A3A5C' : '#CBD5E1', background: sello === 'CUSTOM' ? '#1A3A5C' : '#fff', color: sello === 'CUSTOM' ? '#fff' : '#64748B', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Otro...
          </button>
        </div>
        {sello === 'CUSTOM' && (
          <div style={{ marginTop: 8 }}>
            <input style={inp} value={selloPersonalizado} onChange={e => setSelloPersonalizado(e.target.value)} placeholder="Ej: WSS AI-0005752" />
          </div>
        )}
      </Seccion>

      {/* Datos del trabajo */}
      <Seccion titulo="Datos del trabajo">
        <G2>
          <div><Lbl>Acta asociada</Lbl><input style={inp} value={acta} onChange={e => setActa(e.target.value)} placeholder="Ej: D-3852 o N/A" /></div>
          <div><Lbl>Inspector(es)</Lbl><input style={inp} value={inspector} onChange={e => setInspector(e.target.value)} placeholder="Nombre(s) del inspector" /></div>
          <div><Lbl>Fecha de inspección</Lbl><input type="date" style={inp} value={fechaInspeccion} onChange={e => setFechaInspeccion(e.target.value)} /></div>
          <div><Lbl>Fecha estimada entrega informe</Lbl><input type="date" style={inp} value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} /></div>
        </G2>
      </Seccion>

      {/* Observación */}
      <Seccion titulo="Observación (opcional)">
        <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', lineHeight: 1.6 }} value={observacion} onChange={e => setObservacion(e.target.value)} placeholder="Observación adicional relevante para este lote de informes..." />
      </Seccion>

      {/* Secuencia de registro */}
      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '8px 14px', fontSize: 11, color: '#0369A1', marginBottom: 16 }}>
        <b>Secuencia de registro:</b> {serieLabel.split(' / ')[0]} | PRODUCTO | SELLOS | OT | ÁREA | CLIENTE | ACTA | FECHA ASIGNACIÓN | FECHA INSPECCIÓN / INSPECTOR | FECHA ENTREGA INFORMES
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={guardando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={reservar} disabled={guardando || total === 0} style={{ minWidth: 200 }}>
          {guardando ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Reservando...</> : `🔢 Reservar ${total > 0 ? total : ''} número${total !== 1 ? 's' : ''} de informe`}
        </button>
      </div>
    </div>
  )
}

function VisorInforme({ informe }) {
  const areaLabels = { END: 'END', IZL: 'Izaje y Levante', TRZ: 'Trazabilidad', VER: 'Verificación' }
  const serieBg = { ESI: '#DBEAFE', EAI: '#FEF9C3', IVS: '#D1FAE5', IVA: '#FCE7F3' }
  const serieColor = { ESI: '#1E40AF', EAI: '#854D0E', IVS: '#065F46', IVA: '#9D174D' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 6 }}>
      <div style={{ background: serieBg[informe.serie] || '#F1F5F9', color: serieColor[informe.serie] || '#475569', fontFamily: 'monospace', fontWeight: 900, fontSize: 15, padding: '4px 10px', borderRadius: 6, minWidth: 100, textAlign: 'center', letterSpacing: '.5px' }}>
        {informe.codigo_informe}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {informe.area && <span className="badge badge-blue" style={{ fontSize: 10 }}>{areaLabels[informe.area] || informe.area}</span>}
          {informe.sello && informe.sello !== 'N/A' && <span className="badge badge-amber" style={{ fontSize: 10 }}>🔒 {informe.sello}</span>}
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
          {informe.fecha_inspeccion && <>📅 {informe.fecha_inspeccion}</>}
          {informe.inspector && <> · 👤 {informe.inspector}</>}
          {informe.acta_asociada && <> · 📋 Acta {informe.acta_asociada}</>}
        </div>
        {informe.observacion && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, fontStyle: 'italic' }}>{informe.observacion}</div>}
      </div>
      <div style={{ fontSize: 10, color: '#CBD5E1', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {informe.created_at && new Date(informe.created_at).toLocaleDateString('es-CL')}
      </div>
    </div>
  )
}

function PantallaExito({ codigos, onVolver }) {
  const grouped = codigos.reduce((acc, c) => {
    const prefix = c.split('-')[0]
    acc[prefix] = acc[prefix] || []
    acc[prefix].push(c)
    return acc
  }, {})
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <h2 style={{ color: '#1A3A5C', marginBottom: 8 }}>{codigos.length} número{codigos.length > 1 ? 's' : ''} reservado{codigos.length > 1 ? 's' : ''}</h2>
      <p style={{ color: '#64748B', marginBottom: 24 }}>Los números han sido registrados con trazabilidad completa</p>
      <div style={{ display: 'inline-block', textAlign: 'left', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 28px', marginBottom: 24, minWidth: 260 }}>
        {Object.entries(grouped).map(([serie, nums]) => (
          <div key={serie} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>{serie}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {nums.map(c => (
                <span key={c} style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 14, color: '#1A3A5C', background: '#DBEAFE', padding: '3px 10px', borderRadius: 6 }}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div>
        <button className="btn btn-primary" onClick={onVolver}>Ver todos los informes</button>
      </div>
    </div>
  )
}

// ── Sección Inspector: Cargar archivos + Notificar supervisor ─────────────────
function SeccionCargaInforme({ ot }) {
  const { usuario } = useAuth()
  const fileRef = useRef(null)
  const [archivos, setArchivos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [notificando, setNotificando] = useState(false)
  const [mensajeObs, setMensajeObs] = useState('')
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  // La carpeta 09 del OT
  const carpeta09Id = ot.carpetas_drive?.['09']?.id
  const carpeta09Url = ot.carpetas_drive?.['09']?.url

  // Documentos ya subidos
  const [docsSubidos, setDocsSubidos] = useState([])
  useEffect(() => { cargarDocs() }, [ot.ot_numero])
  async function cargarDocs() {
    const { data } = await supabase.from('documentos_ot').select('*').eq('ot_numero', ot.ot_numero).eq('tipo', 'informe').order('created_at', { ascending: false })
    setDocsSubidos(data || [])
  }

  function onFileChange(e) {
    setArchivos(Array.from(e.target.files))
    setError(''); setExito('')
  }

  async function subirInformes() {
    if (archivos.length === 0) { setError('Selecciona al menos un archivo'); return }
    if (!carpeta09Id) { setError('Esta OT no tiene carpeta Drive configurada (09 - Informes)'); return }
    setSubiendo(true); setError(''); setResultados([])
    try {
      const nuevosResultados = []
      for (const file of archivos) {
        const driveData = await subirArchivoADrive(carpeta09Id, file)
        // Guardar en DB
        await supabase.from('documentos_ot').insert({
          ot_numero: ot.ot_numero, tipo: 'informe',
          nombre_archivo: file.name, drive_file_id: driveData.file_id,
          drive_url: driveData.file_url, subido_por: usuario?.email || '',
        })
        nuevosResultados.push({ nombre: file.name, url: driveData.file_url })
      }
      setResultados(nuevosResultados)
      setArchivos([])
      if (fileRef.current) fileRef.current.value = ''
      setExito(`✓ ${nuevosResultados.length} archivo${nuevosResultados.length > 1 ? 's subidos' : ' subido'} correctamente`)
      cargarDocs()
    } catch (e) { setError(e.message) } finally { setSubiendo(false) }
  }

  async function notificarSupervisor() {
    setNotificando(true); setError('')
    try {
      const { data: informesOT } = await supabase.from('numeros_informe').select('codigo_informe').eq('ot_numero', ot.ot_numero).order('created_at')
      const codigos = informesOT?.map(i => i.codigo_informe) || []
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notificar-supervisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ot_numero: ot.ot_numero, inspector_nombre: usuario?.nombre || usuario?.email, informes_codigos: codigos, mensaje_adicional: mensajeObs }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setExito(`✉️ Supervisor notificado correctamente (${data.supervisor_email})`)
      setMensajeObs('')
    } catch (e) { setError('Error al notificar: ' + e.message) } finally { setNotificando(false) }
  }

  return (
    <div style={{ marginTop: 24, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg,#065F46,#059669)', color: '#fff', padding: '7px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase' }}>
        Inspector — Cargar informes y notificar supervisor
      </div>
      <div style={{ padding: '16px' }}>
        {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#991B1B', marginBottom: 12 }}>⚠️ {error}</div>}
        {exito && <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#065F46', marginBottom: 12 }}>{exito}</div>}

        {/* Carpeta Drive */}
        {carpeta09Url && (
          <div style={{ marginBottom: 14, fontSize: 12, color: '#64748B' }}>
            📁 Carpeta Drive:&nbsp;
            <a href={carpeta09Url} target="_blank" rel="noreferrer" style={{ color: '#185FA5', fontWeight: 600 }}>09 - Informe(s)</a>
          </div>
        )}

        {/* Upload */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Seleccionar archivos de informe (PDF)</div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.zip" multiple onChange={onFileChange}
            style={{ width: '100%', padding: '8px 10px', border: '1px dashed #CBD5E1', borderRadius: 6, fontSize: 13, background: '#F8FAFC', cursor: 'pointer' }} />
          {archivos.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {archivos.map((f, i) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', background: '#DBEAFE', borderRadius: 4, color: '#1E40AF' }}>📄 {f.name}</span>)}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={subirInformes} disabled={subiendo || archivos.length === 0} style={{ marginBottom: 16, background: '#059669', borderColor: '#059669' }}>
          {subiendo ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Subiendo...</> : `📤 Subir ${archivos.length > 0 ? archivos.length + ' archivo' + (archivos.length > 1 ? 's' : '') : 'informes'} a Drive`}
        </button>

        {/* Documentos ya subidos */}
        {docsSubidos.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Archivos subidos ({docsSubidos.length})</div>
            {docsSubidos.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                <span style={{ color: '#22C55E' }}>✓</span>
                <a href={d.drive_url} target="_blank" rel="noreferrer" style={{ color: '#185FA5', flex: 1 }}>{d.nombre_archivo}</a>
                <span style={{ color: '#94A3B8' }}>{new Date(d.created_at).toLocaleDateString('es-CL')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notificar supervisor */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Mensaje adicional al supervisor (opcional)</div>
          <textarea value={mensajeObs} onChange={e => setMensajeObs(e.target.value)} placeholder="Observaciones, instrucciones o comentarios para el supervisor..."
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 13, minHeight: 70, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }} />
          <button className="btn btn-primary" onClick={notificarSupervisor} disabled={notificando} style={{ background: '#7C3AED', borderColor: '#7C3AED' }}>
            {notificando ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Notificando...</> : '📧 Notificar al Supervisor'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TabInformes({ ot, onInformeCreado }) {
  const [pantalla, setPantalla] = useState('lista')
  const [informes, setInformes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [exito, setExito] = useState(null)
  const [filtreSerie, setFiltreSerie] = useState('todos')

  useEffect(() => { cargarInformes() }, [ot.ot_numero])

  async function cargarInformes() {
    setCargando(true)
    try {
      const { data } = await supabase
        .from('numeros_informe')
        .select('*')
        .eq('ot_numero', ot.ot_numero)
        .order('created_at', { ascending: false })
      setInformes(data || [])
    } catch { } finally { setCargando(false) }
  }

  function handleReservada(codigos) {
    setExito(codigos)
    setPantalla('lista')
    cargarInformes()
    onInformeCreado && onInformeCreado()
  }

  if (cargando) return <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Cargando informes…</div>

  if (exito) return <PantallaExito codigos={exito} onVolver={() => setExito(null)} />

  if (pantalla === 'reservar') {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPantalla('lista')} style={{ marginBottom: 16 }}>← Volver</button>
        <FormReserva ot={ot} onReservada={handleReservada} onCancel={() => setPantalla('lista')} />
      </div>
    )
  }

  // Vista lista
  const series = [...new Set(informes.map(i => i.serie))].sort()
  const informesFiltrados = filtreSerie === 'todos' ? informes : informes.filter(i => i.serie === filtreSerie)

  return (
    <div>
      {/* Botón principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-primary" onClick={() => setPantalla('reservar')}>
          🔢 Reservar números de informe
        </button>
        {/* Resumen rápido */}
        {informes.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {series.map(s => {
              const cnt = informes.filter(i => i.serie === s).length
              return <span key={s} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', background: '#F1F5F9', borderRadius: 6, color: '#475569' }}>{s}: {cnt}</span>
            })}
          </div>
        )}
      </div>

      {/* Filtros por serie */}
      {informes.length > 0 && series.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {['todos', ...series].map(s => (
            <button key={s} type="button" onClick={() => setFiltreSerie(s)}
              style={{ padding: '4px 12px', borderRadius: 16, border: '2px solid', borderColor: filtreSerie === s ? '#1A3A5C' : '#E2E8F0', background: filtreSerie === s ? '#1A3A5C' : '#fff', color: filtreSerie === s ? '#fff' : '#64748B', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {s === 'todos' ? `Todos (${informes.length})` : `${s} (${informes.filter(i => i.serie === s).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Lista de informes */}
      {/* Sección carga de archivos + notificar supervisor */}
      <SeccionCargaInforme ot={ot} />

      <div style={{ marginTop: 24, marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>Números reservados</div>
      {informesFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', border: '2px dashed #E2E8F0', borderRadius: 12, color: '#94A3B8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontWeight: 700, color: '#64748B', marginBottom: 6 }}>Sin informes reservados</div>
          <div style={{ fontSize: 13 }}>Usa el botón de arriba para reservar números de informe para esta OT</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>{informesFiltrados.length} informe{informesFiltrados.length > 1 ? 's' : ''} registrado{informesFiltrados.length > 1 ? 's' : ''}</div>
          {informesFiltrados.map(inf => <VisorInforme key={inf.id} informe={inf} />)}
        </div>
      )}
    </div>
  )
}
