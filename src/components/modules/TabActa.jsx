// ============================================================
// TabActa.jsx — Actas de Terreno REG-DII-001
// Modo digital (formulario completo + firmas canvas)
// Modo manual  (subir foto/scan del acta en papel)
// ============================================================
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const ENSAYOS = ['VT','CD','PT','MT','UT','T','CG','CTK','CS','CV','PN','UTT','PH','Otros']

// ── Helpers de estilo ─────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '7px 10px', border: '1px solid #CBD5E1',
  borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
  outline: 'none', transition: 'border .15s',
}
const inpRO = { ...inp, background: '#F8FAFC', color: '#475569', fontWeight: 600 }

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 18, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        background: 'linear-gradient(135deg,#1A3A5C,#185FA5)',
        color: '#fff', padding: '7px 14px',
        fontSize: 11, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase',
      }}>
        {titulo}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

function Lbl({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>
      {children}
    </div>
  )
}

function G2({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>{children}</div> }
function G3({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 16px' }}>{children}</div> }
function G4({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 16px' }}>{children}</div> }

// ── Canvas firma ──────────────────────────────────────────────────────────────
function FirmaCanvas({ label, value, onChange }) {
  const ref = useRef(null)
  const drawing = useRef(false)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#1A3A5C'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function pos(e) {
    const r = ref.current.getBoundingClientRect()
    const t = e.touches?.[0]
    return { x: (t ? t.clientX : e.clientX) - r.left, y: (t ? t.clientY : e.clientY) - r.top }
  }

  function start(e) {
    e.preventDefault()
    drawing.current = true
    const ctx = ref.current.getContext('2d')
    ctx.beginPath()
    const p = pos(e)
    ctx.moveTo(p.x, p.y)
  }

  function draw(e) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = ref.current.getContext('2d')
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    onChange(ref.current.toDataURL('image/png'))
  }

  function stop() { drawing.current = false }

  function clear() {
    const ctx = ref.current.getContext('2d')
    ctx.clearRect(0, 0, ref.current.width, ref.current.height)
    onChange(null)
  }

  return (
    <div>
      <Lbl>{label}</Lbl>
      <canvas
        ref={ref} width={280} height={110}
        style={{
          border: '1px solid #CBD5E1', borderRadius: 6, cursor: 'crosshair',
          display: 'block', touchAction: 'none', background: '#FAFBFF', width: '100%', height: 110,
        }}
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <button type="button" onClick={clear}
          style={{ fontSize: 11, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          Limpiar
        </button>
        {value && <span style={{ fontSize: 10, color: '#22C55E', fontWeight: 700 }}>✓ Firmado</span>}
      </div>
    </div>
  )
}

// ── Formulario digital completo ───────────────────────────────────────────────
function FormActaDigital({ ot, asignacion, onGuardada, onCancel }) {
  const { usuario } = useAuth()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    // Cliente
    solicitante:            ot.cliente || '',
    atencion:               ot.contacto || '',
    direccion:              ot.direccion_faena || '',
    fecha_inspeccion:       asignacion?.fecha_inspeccion?.split('T')[0] || new Date().toISOString().split('T')[0],
    // Técnica
    proyecto:               '',
    procedimientos_wss:     asignacion?.procedimientos || '',
    norma_evaluacion:       asignacion?.norma_evaluacion || '',
    norma_ejecucion:        asignacion?.norma_ejecucion || '',
    material:               '',
    tipo_junta:             '',
    espesor_material:       '',
    proceso_soldadura:      '',
    n_req_calidad:          '',
    // Inspector
    inspectores_nombres:    asignacion?.inspectores_asignados || ot.inspector || '',
    nivel_snt_tc1a:         '',
    condicion_superficial:  '',
    iluminacion:            '',
    temp_material:          '',
    // Ensayos
    ensayos:                asignacion?.tipos_inspeccion
                              ? asignacion.tipos_inspeccion.split(',').map(s => s.trim()).filter(Boolean)
                              : [],
    // Alcances
    alcances_resultados:    '',
    // Equipos
    equipos:                [{ nombre: '', codigo: '' }],
    // Horarios
    horario_terreno_inicio: asignacion?.hora || '',
    horario_terreno_fin:    '',
    horario_viaje_inicio:   '',
    horario_viaje_fin:      '',
    // Firmas
    nombre_cliente:         ot.contacto || '',
    cargo_cliente:          '',
    firma_cliente_b64:      null,
    sede_wss:               ot.sede || '',
    nombre_inspector_firma: asignacion?.inspectores_asignados?.split(',')[0]?.trim() || ot.inspector || '',
    firma_inspector_b64:    null,
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleEnsayo(t) {
    setForm(f => ({
      ...f,
      ensayos: f.ensayos.includes(t) ? f.ensayos.filter(e => e !== t) : [...f.ensayos, t],
    }))
  }

  function addEquipo() { setForm(f => ({ ...f, equipos: [...f.equipos, { nombre: '', codigo: '' }] })) }
  function setEquipo(i, k, v) {
    setForm(f => { const eq = [...f.equipos]; eq[i] = { ...eq[i], [k]: v }; return { ...f, equipos: eq } })
  }
  function removeEquipo(i) { setForm(f => ({ ...f, equipos: f.equipos.filter((_, idx) => idx !== i) })) }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      // Número correlativo por sede
      const sede = form.sede_wss || ot.sede || ''
      const { data: numData, error: numErr } = await supabase.rpc('siguiente_numero_acta', { p_sede: sede })
      if (numErr) throw numErr
      const numero_acta = numData || (sede.toLowerCase().includes('antofagasta') ? 3852 : 4152)
      const codigo_acta = `D-${numero_acta}`

      const payload = {
        numero_acta,
        codigo_acta,
        ot_numero:              ot.ot_numero,
        solicitante:            form.solicitante,
        atencion:               form.atencion,
        direccion:              form.direccion,
        fecha_inspeccion:       form.fecha_inspeccion,
        proyecto:               form.proyecto || null,
        procedimientos_wss:     form.procedimientos_wss || null,
        norma_evaluacion:       form.norma_evaluacion || null,
        norma_ejecucion:        form.norma_ejecucion || null,
        material:               form.material || null,
        tipo_junta:             form.tipo_junta || null,
        espesor_material:       form.espesor_material || null,
        proceso_soldadura:      form.proceso_soldadura || null,
        n_req_calidad:          form.n_req_calidad || null,
        inspectores_nombres:    form.inspectores_nombres,
        nivel_snt_tc1a:         form.nivel_snt_tc1a || null,
        condicion_superficial:  form.condicion_superficial || null,
        iluminacion:            form.iluminacion || null,
        temp_material:          form.temp_material || null,
        ensayos:                form.ensayos,
        alcances_resultados:    form.alcances_resultados || null,
        equipos:                form.equipos.filter(e => e.nombre || e.codigo),
        horario_terreno_inicio: form.horario_terreno_inicio || null,
        horario_terreno_fin:    form.horario_terreno_fin || null,
        horario_viaje_inicio:   form.horario_viaje_inicio || null,
        horario_viaje_fin:      form.horario_viaje_fin || null,
        nombre_cliente:         form.nombre_cliente || null,
        cargo_cliente:          form.cargo_cliente || null,
        firma_cliente_b64:      form.firma_cliente_b64 || null,
        sede_wss:               form.sede_wss,
        nombre_inspector_firma: form.nombre_inspector_firma || null,
        firma_inspector_b64:    form.firma_inspector_b64 || null,
        modo:                   'digital',
        estado:                 'Emitida',
        created_by:             usuario?.email || '',
      }

      const { error: insErr } = await supabase.from('actas_terreno').insert(payload)
      if (insErr) throw insErr

      onGuardada(codigo_acta)
    } catch (e) {
      setError(e.message || 'Error al guardar el acta')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      {/* Cabecera REG-DII-001 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
        padding: '12px 16px', marginBottom: 18,
      }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#1A3A5C', letterSpacing: '.5px' }}>ACTA DE TERRENO</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>World Survey Services S.A. · División Inspección Industrial</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#64748B', lineHeight: 1.8 }}>
          <div><b>REG-DII-001</b></div>
          <div>Revisión: 04 · 08.08.2024</div>
          <div style={{ fontSize: 13, color: '#185FA5', fontWeight: 700 }}>N° se asignará al guardar</div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* 1. Cliente */}
      <Seccion titulo="Solicitante / Cliente">
        <G2>
          <div>
            <Lbl>Solicitante</Lbl>
            <input style={inp} value={form.solicitante} onChange={e => set('solicitante', e.target.value)} />
          </div>
          <div>
            <Lbl>Orden de Trabajo</Lbl>
            <input style={inpRO} value={ot.ot_numero} readOnly />
          </div>
          <div>
            <Lbl>Atención</Lbl>
            <input style={inp} value={form.atencion} onChange={e => set('atencion', e.target.value)} />
          </div>
          <div>
            <Lbl>Fecha(s) de Inspección</Lbl>
            <input type="date" style={inp} value={form.fecha_inspeccion} onChange={e => set('fecha_inspeccion', e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <Lbl>Dirección</Lbl>
            <input style={inp} value={form.direccion} onChange={e => set('direccion', e.target.value)} />
          </div>
        </G2>
      </Seccion>

      {/* 2. Datos técnicos */}
      <Seccion titulo="Datos Técnicos del Trabajo">
        <G2>
          <div>
            <Lbl>Proyecto</Lbl>
            <input style={inp} value={form.proyecto} onChange={e => set('proyecto', e.target.value)} />
          </div>
          <div>
            <Lbl>Procedimiento(s) WSS</Lbl>
            <input style={inp} value={form.procedimientos_wss} onChange={e => set('procedimientos_wss', e.target.value)} placeholder="Pro-DII-002-004-024" />
          </div>
          <div>
            <Lbl>Norma de Evaluación</Lbl>
            <input style={inp} value={form.norma_evaluacion} onChange={e => set('norma_evaluacion', e.target.value)} placeholder="ASME B30.20" />
          </div>
          <div>
            <Lbl>Norma de Ejecución</Lbl>
            <input style={inp} value={form.norma_ejecucion} onChange={e => set('norma_ejecucion', e.target.value)} placeholder="ASME B30.20" />
          </div>
          <div>
            <Lbl>Material</Lbl>
            <input style={inp} value={form.material} onChange={e => set('material', e.target.value)} />
          </div>
          <div>
            <Lbl>Tipo Junta</Lbl>
            <input style={inp} value={form.tipo_junta} onChange={e => set('tipo_junta', e.target.value)} />
          </div>
          <div>
            <Lbl>Espesor del Material</Lbl>
            <input style={inp} value={form.espesor_material} onChange={e => set('espesor_material', e.target.value)} />
          </div>
          <div>
            <Lbl>Proceso de Soldadura</Lbl>
            <input style={inp} value={form.proceso_soldadura} onChange={e => set('proceso_soldadura', e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <Lbl>N° Requerimiento Calidad</Lbl>
            <input style={inp} value={form.n_req_calidad} onChange={e => set('n_req_calidad', e.target.value)} />
          </div>
        </G2>
      </Seccion>

      {/* 3. Inspector */}
      <Seccion titulo="Inspector(es)">
        <div style={{ marginBottom: 14 }}>
          <Lbl>Nombre(s) Inspector(s)</Lbl>
          <input style={inp} value={form.inspectores_nombres} onChange={e => set('inspectores_nombres', e.target.value)} placeholder="Claudio López, Felipe Sandoval" />
        </div>
        <G4>
          <div>
            <Lbl>Nivel SNT-TC-1A</Lbl>
            <input style={inp} value={form.nivel_snt_tc1a} onChange={e => set('nivel_snt_tc1a', e.target.value)} placeholder="II" />
          </div>
          <div>
            <Lbl>Cond. Superficial</Lbl>
            <input style={inp} value={form.condicion_superficial} onChange={e => set('condicion_superficial', e.target.value)} placeholder="SSPC Sp 2" />
          </div>
          <div>
            <Lbl>Iluminación</Lbl>
            <input style={inp} value={form.iluminacion} onChange={e => set('iluminacion', e.target.value)} placeholder="Natural" />
          </div>
          <div>
            <Lbl>T° Material</Lbl>
            <input style={inp} value={form.temp_material} onChange={e => set('temp_material', e.target.value)} placeholder="16°C" />
          </div>
        </G4>
      </Seccion>

      {/* 4. Ensayos */}
      <Seccion titulo="Ensayos (marcar los aplicables)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ENSAYOS.map(tipo => {
            const sel = form.ensayos.includes(tipo)
            return (
              <button key={tipo} type="button" onClick={() => toggleEnsayo(tipo)}
                style={{
                  padding: '7px 16px', borderRadius: 20, border: '2px solid',
                  borderColor: sel ? '#1A3A5C' : '#CBD5E1',
                  background: sel ? '#1A3A5C' : '#fff',
                  color: sel ? '#fff' : '#64748B',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                  boxShadow: sel ? '0 2px 6px rgba(26,58,92,.3)' : 'none',
                }}>
                {tipo}
              </button>
            )
          })}
        </div>
        {form.ensayos.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#185FA5' }}>
            Seleccionados: <b>{form.ensayos.join(', ')}</b>
          </div>
        )}
      </Seccion>

      {/* 5. Alcances */}
      <Seccion titulo="Alcances y Resultados">
        <textarea
          style={{ ...inp, minHeight: 140, resize: 'vertical', lineHeight: 1.6 }}
          value={form.alcances_resultados}
          onChange={e => set('alcances_resultados', e.target.value)}
          placeholder="Descripción detallada de los alcances, elementos inspeccionados, hallazgos y resultados..."
        />
      </Seccion>

      {/* 6. Equipos */}
      <Seccion titulo="Equipos e Instrumentos Utilizados">
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 8px 8px 0', fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', width: '60%' }}>Nombre</th>
              <th style={{ textAlign: 'left', padding: '4px 8px 8px', fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0' }}>Código</th>
              <th style={{ width: 28, borderBottom: '2px solid #E2E8F0' }}></th>
            </tr>
          </thead>
          <tbody>
            {form.equipos.map((eq, i) => (
              <tr key={i}>
                <td style={{ padding: '4px 4px 4px 0' }}>
                  <input style={inp} value={eq.nombre} onChange={e => setEquipo(i, 'nombre', e.target.value)} placeholder="Yugo Electromagnético" />
                </td>
                <td style={{ padding: '4px 4px' }}>
                  <input style={inp} value={eq.codigo} onChange={e => setEquipo(i, 'codigo', e.target.value)} placeholder="WSS-SCL-DII-002" />
                </td>
                <td style={{ textAlign: 'center' }}>
                  {form.equipos.length > 1 && (
                    <button type="button" onClick={() => removeEquipo(i)}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addEquipo}
          style={{
            width: '100%', padding: '8px', fontSize: 13, color: '#185FA5',
            background: 'none', border: '1px dashed #93C5FD', borderRadius: 6,
            cursor: 'pointer', fontWeight: 600,
          }}>
          + Agregar equipo / instrumento
        </button>
      </Seccion>

      {/* 7. Horarios */}
      <Seccion titulo="Horarios Efectivos">
        <G2>
          <div>
            <Lbl>Terreno — Hora inicio</Lbl>
            <input type="time" style={inp} value={form.horario_terreno_inicio} onChange={e => set('horario_terreno_inicio', e.target.value)} />
          </div>
          <div>
            <Lbl>Terreno — Hora fin</Lbl>
            <input type="time" style={inp} value={form.horario_terreno_fin} onChange={e => set('horario_terreno_fin', e.target.value)} />
          </div>
          <div>
            <Lbl>Viaje — Hora inicio</Lbl>
            <input type="time" style={inp} value={form.horario_viaje_inicio} onChange={e => set('horario_viaje_inicio', e.target.value)} />
          </div>
          <div>
            <Lbl>Viaje — Hora fin</Lbl>
            <input type="time" style={inp} value={form.horario_viaje_fin} onChange={e => set('horario_viaje_fin', e.target.value)} />
          </div>
        </G2>
      </Seccion>

      {/* 8. Firmas */}
      <Seccion titulo="Firmas">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Cliente */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A3A5C', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Firma Cliente
            </div>
            <div style={{ marginBottom: 10 }}>
              <Lbl>Nombre</Lbl>
              <input style={inp} value={form.nombre_cliente} onChange={e => set('nombre_cliente', e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Lbl>Cargo</Lbl>
              <input style={inp} value={form.cargo_cliente} onChange={e => set('cargo_cliente', e.target.value)} />
            </div>
            <FirmaCanvas label="Firma cliente" value={form.firma_cliente_b64} onChange={v => set('firma_cliente_b64', v)} />
          </div>

          {/* Inspector */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A3A5C', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Firma Inspector WSS
            </div>
            <div style={{ marginBottom: 10 }}>
              <Lbl>Sede WSS</Lbl>
              <input style={inp} value={form.sede_wss} onChange={e => set('sede_wss', e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Lbl>Nombre Inspector</Lbl>
              <input style={inp} value={form.nombre_inspector_firma} onChange={e => set('nombre_inspector_firma', e.target.value)} />
            </div>
            <FirmaCanvas label="Firma inspector" value={form.firma_inspector_b64} onChange={v => set('firma_inspector_b64', v)} />
          </div>
        </div>
      </Seccion>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}
          style={{ minWidth: 140 }}>
          {guardando ? (
            <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Guardando...</>
          ) : '✓ Emitir Acta REG-DII-001'}
        </button>
      </div>
    </div>
  )
}

// ── Subir acta manual (foto/scan) ─────────────────────────────────────────────
function SubirActaManual({ ot, onGuardada, onCancel }) {
  const { usuario } = useAuth()
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [numeroManual, setNumeroManual] = useState('')

  function onFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setArchivo(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  async function guardar() {
    if (!archivo) { setError('Selecciona una foto o archivo del acta'); return }
    setGuardando(true)
    setError('')
    try {
      // Subir imagen a Supabase Storage
      const ext = archivo.name.split('.').pop()
      const path = `${ot.ot_numero}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('actas-manuales')
        .upload(path, archivo, { upsert: true })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('actas-manuales').getPublicUrl(path)
      const imagen_manual_url = urlData.publicUrl

      // Número correlativo por sede
      const sede = ot.sede || ''
      const { data: numData } = await supabase.rpc('siguiente_numero_acta', { p_sede: sede })
      const numero_acta = numData || (sede.toLowerCase().includes('antofagasta') ? 3852 : 4152)
      const codigo_acta = `D-${numero_acta}`

      const { error: insErr } = await supabase.from('actas_terreno').insert({
        numero_acta,
        codigo_acta,
        ot_numero:       ot.ot_numero,
        solicitante:     ot.cliente || '',
        sede_wss:        sede,
        modo:            'manual',
        imagen_manual_url,
        numero_acta_manual: numeroManual || null,
        estado:          'Emitida',
        created_by:      usuario?.email || '',
      })
      if (insErr) throw insErr

      onGuardada(codigo_acta)
    } catch (e) {
      setError(e.message || 'Error al subir el acta')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <div style={{
        background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8,
        padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400E',
      }}>
        📸 Usa esta opción cuando el acta fue llenada en papel. Toma una foto clara o adjunta el PDF escaneado.
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Lbl>N° del Acta en papel (opcional)</Lbl>
        <input style={{ ...inp, maxWidth: 200 }} value={numeroManual} onChange={e => setNumeroManual(e.target.value)} placeholder="Ej: 4193" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <Lbl>Foto / Scan del Acta (JPG, PNG o PDF)</Lbl>
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          border: '2px dashed #93C5FD', borderRadius: 10, padding: '32px 20px',
          cursor: 'pointer', background: '#F0F9FF', transition: 'background .15s',
        }}>
          <input type="file" accept="image/*,.pdf" onChange={onFile} style={{ display: 'none' }} />
          {preview ? (
            archivo?.type?.startsWith('image') ? (
              <img src={preview} alt="preview" style={{ maxHeight: 300, maxWidth: '100%', borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,.15)' }} />
            ) : (
              <div style={{ fontSize: 40 }}>📄</div>
            )
          ) : (
            <>
              <div style={{ fontSize: 36 }}>📸</div>
              <div style={{ fontSize: 14, color: '#0284C7', fontWeight: 600 }}>Toca aquí para seleccionar o tomar foto</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>JPG · PNG · PDF · hasta 10 MB</div>
            </>
          )}
        </label>
        {archivo && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>
            📎 {archivo.name} ({(archivo.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={guardando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando || !archivo}
          style={{ minWidth: 140 }}>
          {guardando ? (
            <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Subiendo...</>
          ) : '✓ Guardar Acta Manual'}
        </button>
      </div>
    </div>
  )
}

// ── Visor de acta existente ───────────────────────────────────────────────────
function VisorActa({ acta }) {
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--verde)', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 16, color: '#1A3A5C' }}>
            Acta {acta.codigo_acta || `D-${acta.numero_acta}`}
          </span>
          {acta.modo === 'manual' && (
            <span className="badge badge-amber" style={{ marginLeft: 10 }}>Manual</span>
          )}
          <span className="badge badge-green" style={{ marginLeft: 8 }}>{acta.estado}</span>
        </div>
        <div style={{ fontSize: 12, color: '#64748B' }}>
          {acta.fecha_inspeccion ? new Date(acta.fecha_inspeccion).toLocaleDateString('es-CL') : acta.fecha_inspeccion}
          {acta.created_at && ` · Emitida ${new Date(acta.created_at).toLocaleString('es-CL')}`}
        </div>
      </div>

      {acta.modo === 'manual' && acta.imagen_manual_url ? (
        <div>
          <a href={acta.imagen_manual_url} target="_blank" rel="noreferrer">
            <img src={acta.imagen_manual_url} alt="Acta manual" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,.15)', cursor: 'pointer' }} />
          </a>
          <div style={{ marginTop: 8 }}>
            <a href={acta.imagen_manual_url} target="_blank" rel="noreferrer">
              <button className="btn btn-secondary btn-sm">🔗 Ver / Descargar acta</button>
            </a>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '8px 20px', fontSize: 13 }}>
          {acta.solicitante          && <Fila label="Solicitante"         valor={acta.solicitante} />}
          {acta.inspectores_nombres  && <Fila label="Inspector(es)"       valor={acta.inspectores_nombres} />}
          {acta.procedimientos_wss   && <Fila label="Procedimientos"      valor={acta.procedimientos_wss} />}
          {acta.norma_evaluacion     && <Fila label="Norma evaluación"    valor={acta.norma_evaluacion} />}
          {acta.ensayos?.length > 0  && <Fila label="Ensayos"            valor={acta.ensayos.join(', ')} />}
          {acta.horario_terreno_inicio && acta.horario_terreno_fin &&
            <Fila label="Terreno" valor={`${acta.horario_terreno_inicio} – ${acta.horario_terreno_fin}`} />}
          {acta.nombre_inspector_firma && <Fila label="Firma inspector"    valor={acta.nombre_inspector_firma} />}
          {acta.nombre_cliente       && <Fila label="Firma cliente"        valor={`${acta.nombre_cliente}${acta.cargo_cliente ? ` · ${acta.cargo_cliente}` : ''}`} />}
        </div>
      )}

      {acta.alcances_resultados && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Alcances y resultados
          </summary>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {acta.alcances_resultados}
          </p>
        </details>
      )}

      {acta.firma_inspector_b64 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Firma Inspector</div>
            <img src={acta.firma_inspector_b64} alt="firma inspector" style={{ height: 60, border: '1px solid #E2E8F0', borderRadius: 4 }} />
          </div>
          {acta.firma_cliente_b64 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Firma Cliente</div>
              <img src={acta.firma_cliente_b64} alt="firma cliente" style={{ height: 60, border: '1px solid #E2E8F0', borderRadius: 4 }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Fila({ label, valor }) {
  return (
    <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1E293B' }}>{valor}</div>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────
export default function TabActa({ ot, asignaciones = [], onActaCreada }) {
  const [pantalla, setPantalla] = useState('lista')   // 'lista' | 'digital' | 'manual'
  const [actas, setActas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [exito, setExito] = useState(null)             // número acta recién creada

  // Última asignación para pre-llenar campos
  const ultimaAsig = asignaciones[asignaciones.length - 1] || null

  useEffect(() => { cargarActas() }, [ot.ot_numero])

  async function cargarActas() {
    setCargando(true)
    try {
      const { data } = await supabase
        .from('actas_terreno')
        .select('*')
        .eq('ot_numero', ot.ot_numero)
        .order('created_at', { ascending: false })
      setActas(data || [])
    } catch { /* silencioso */ } finally { setCargando(false) }
  }

  function handleGuardada(numero) {
    setExito(numero)
    setPantalla('lista')
    cargarActas()
    onActaCreada && onActaCreada()
  }

  if (cargando) return <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Cargando actas…</div>

  // Pantalla éxito (flash)
  if (exito) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: '#1A3A5C', marginBottom: 8 }}>Acta N° {exito} emitida</h2>
        <p style={{ color: '#64748B', marginBottom: 24 }}>Registrada correctamente para la OT {ot.ot_numero}</p>
        <button className="btn btn-primary" onClick={() => setExito(null)}>Ver actas</button>
      </div>
    )
  }

  // Formulario digital
  if (pantalla === 'digital') {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPantalla('lista')} style={{ marginBottom: 16 }}>
          ← Volver
        </button>
        <FormActaDigital ot={ot} asignacion={ultimaAsig} onGuardada={handleGuardada} onCancel={() => setPantalla('lista')} />
      </div>
    )
  }

  // Subir acta manual
  if (pantalla === 'manual') {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPantalla('lista')} style={{ marginBottom: 16 }}>
          ← Volver
        </button>
        <SubirActaManual ot={ot} onGuardada={handleGuardada} onCancel={() => setPantalla('lista')} />
      </div>
    )
  }

  // Lista + botones
  return (
    <div>
      {/* Botones nueva acta */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setPantalla('digital')}>
          📝 Crear Acta Digital
        </button>
        <button className="btn btn-secondary" onClick={() => setPantalla('manual')}>
          📸 Subir Acta Escaneada
        </button>
      </div>

      {/* Lista de actas */}
      {actas.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', border: '2px dashed #E2E8F0',
          borderRadius: 12, color: '#94A3B8',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700, color: '#64748B', marginBottom: 6 }}>Sin actas emitidas</div>
          <div style={{ fontSize: 13 }}>Crea el acta de terreno cuando finalice la inspección</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
            {actas.length} acta{actas.length > 1 ? 's' : ''} emitida{actas.length > 1 ? 's' : ''}
          </div>
          {actas.map(a => <VisorActa key={a.id} acta={a} />)}
        </div>
      )}
    </div>
  )
}
