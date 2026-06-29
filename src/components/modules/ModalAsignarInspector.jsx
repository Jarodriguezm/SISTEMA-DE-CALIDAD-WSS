import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

// ─── helpers ─────────────────────────────────────────────────────────────────
function waLink(tel, mensaje) {
  const num = (tel || '').replace(/[^0-9]/g, '')
  if (!num) return null
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`
}

function buildWAMensaje({ otNumero, cliente, fechaInspeccion, hora, descripcion, supervisorNombre }) {
  return (
    `Hola, te informamos que has sido asignado/a a una actividad de inspección.\n\n` +
    `*OT:* ${otNumero}\n` +
    `*Cliente:* ${cliente}\n` +
    `*Fecha:* ${fechaInspeccion || 'Por confirmar'}\n` +
    `*Hora:* ${hora || 'Por confirmar'}\n` +
    `*Descripción:* ${descripcion || '—'}\n` +
    `*Supervisor:* ${supervisorNombre}\n\n` +
    `Por favor confirma recepción. — WSS División Inspección Industrial`
  )
}

const TIPOS = [
  { cod: 'VT', desc: 'Insp. visual' },
  { cod: 'CD', desc: 'Control dim.' },
  { cod: 'PT', desc: 'Líq. penetrantes' },
  { cod: 'MT', desc: 'Part. magnéticas' },
  { cod: 'UT', desc: 'Ultrasonido' },
  { cod: 'UTT', desc: 'Med. espesores' },
  { cod: 'T', desc: 'Termografía' },
  { cod: 'CG', desc: 'Cert. grúas' },
  { cod: 'CTK', desc: 'Cert. tanques' },
  { cod: 'CS', desc: 'Calif. soldador' },
  { cod: 'PH', desc: 'Prueba hidrost.' },
  { cod: 'PN', desc: 'Prueba neumática' },
  { cod: 'CV', desc: 'Cámara vacío' },
  { cod: 'O', desc: 'Otros' },
]

export default function ModalAsignarInspector({ ot, onClose, onAsignada }) {
  const { usuario } = useAuth()
  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ')

  const SUPABASE_URL = 'https://labxvesmcfbrdtftkwtg.supabase.co'
  const SUPABASE_ANON_KEY = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_SUPABASE_ANON_KEY || '')
    : ''

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(null)

  const [inspectores, setInspectores] = useState([])
  const [procedimientos, setProcedimientos] = useState([])
  const [equipos, setEquipos] = useState([])

  const [form, setForm] = useState({
    supervisor: '',
    inspectoresSeleccionados: [],
    procedimientosSeleccionados: [],
    equiposSeleccionados: [],
    tiposInspeccion: [],
    fechaInspeccion: '',
    hora: '',
    tiempoEstimado: '',
    vehiculo: '',
    normaEjecucion: '',
    normaEvaluacion: '',
    descripcionActividad: '',
  })

  const cargarCatalogos = useCallback(async () => {
    try {
      const [{ data: eq }, { data: proc }, { data: insp }] = await Promise.all([
        supabase.from('equipos').select('id, equipo_instrumento, codigo').eq('activo', true).order('equipo_instrumento'),
        supabase.from('catalogo_procedimientos').select('id, nombre, codigo').eq('activo', true).order('codigo'),
        supabase.from('v_usuarios_portal').select('nombre_completo, email, telefono_whatsapp, rol').in('rol', ['INSPECTOR', 'SUPERVISOR', 'ADMIN']).order('nombre_completo'),
      ])
      setEquipos(eq || [])
      setProcedimientos(proc || [])
      setInspectores(insp || [])
    } catch (e) {
      console.error('Error cargando catálogos:', e)
    }
  }, [])

  useEffect(() => {
    cargarCatalogos()
    if (ot?.supervisor) setForm(f => ({ ...f, supervisor: ot.supervisor }))
  }, [ot, cargarCatalogos])

  function toggleInspector(inspector) {
    setForm(f => {
      const existe = f.inspectoresSeleccionados.find(i => i.email === inspector.email)
      return {
        ...f,
        inspectoresSeleccionados: existe
          ? f.inspectoresSeleccionados.filter(i => i.email !== inspector.email)
          : [...f.inspectoresSeleccionados, inspector],
      }
    })
  }

  function toggleEquipo(equipo) {
    const val = `${equipo.codigo} — ${equipo.equipo_instrumento}`
    setForm(f => ({
      ...f,
      equiposSeleccionados: f.equiposSeleccionados.includes(val)
        ? f.equiposSeleccionados.filter(v => v !== val)
        : [...f.equiposSeleccionados, val],
    }))
  }

  function toggleProcedimiento(proc) {
    const val = `${proc.codigo} — ${proc.nombre}`
    setForm(f => ({
      ...f,
      procedimientosSeleccionados: f.procedimientosSeleccionados.includes(val)
        ? f.procedimientosSeleccionados.filter(v => v !== val)
        : [...f.procedimientosSeleccionados, val],
    }))
  }

  function toggleTipo(cod) {
    setForm(f => ({
      ...f,
      tiposInspeccion: f.tiposInspeccion.includes(cod)
        ? f.tiposInspeccion.filter(t => t !== cod)
        : [...f.tiposInspeccion, cod],
    }))
  }

  async function guardar() {
    if (form.inspectoresSeleccionados.length === 0) {
      setError('Selecciona al menos un inspector.')
      return
    }
    if (!form.descripcionActividad.trim()) {
      setError('La descripción de actividades es obligatoria.')
      return
    }

    setGuardando(true)
    setError('')

    try {
      const inspectoresStr = form.inspectoresSeleccionados.map(i => i.nombre_completo).join(', ')
      const procedimientosStr = form.procedimientosSeleccionados.join(', ')
      const tiposStr = form.tiposInspeccion.join(', ')
      const equiposStr = form.equiposSeleccionados.join(', ')

      const mensajeWA = buildWAMensaje({
        otNumero: ot.ot_numero,
        cliente: ot.cliente,
        fechaInspeccion: form.fechaInspeccion,
        hora: form.hora,
        descripcion: form.descripcionActividad,
        supervisorNombre: form.supervisor || nombreCompleto,
      })

      const primerConTel = form.inspectoresSeleccionados.find(i => i.telefono_whatsapp)
      const waUrl = primerConTel ? waLink(primerConTel.telefono_whatsapp, mensajeWA) : null

      const descripcionFinal = equiposStr
        ? `${form.descripcionActividad}\n\nEquipos/instrumentos: ${equiposStr}`
        : form.descripcionActividad

      const { error: err } = await supabase.rpc('crear_asignacion_portal', {
        p_email_usuario: usuario?.email || '',
        p_ot_numero: ot.ot_numero,
        p_supervisor: form.supervisor || nombreCompleto,
        p_inspectores_asignados: inspectoresStr,
        p_fecha_inspeccion: form.fechaInspeccion || null,
        p_hora: form.hora || null,
        p_tiempo_estimado: form.tiempoEstimado || null,
        p_vehiculo: form.vehiculo || null,
        p_norma_ejecucion: form.normaEjecucion || null,
        p_norma_evaluacion: form.normaEvaluacion || null,
        p_procedimientos: procedimientosStr || null,
        p_tipos_inspeccion: tiposStr || null,
        p_descripcion_actividad: descripcionFinal,
        p_drive_url: null,
        p_whatsapp_inspectores_url: waUrl,
      })

      if (err) throw err

      // ── Enviar email a cada inspector vía Edge Function ──────────────────
      let emailsEnviados = 0
      let emailError = null
      try {
        const supabaseUrl = 'https://labxvesmcfbrdtftkwtg.supabase.co'
        const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || ''
        const edgeRes = await fetch(
          `${supabaseUrl}/functions/v1/send-assignment-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
            },
            body: JSON.stringify({
              inspectores: form.inspectoresSeleccionados.map(i => ({
                nombre_completo: i.nombre_completo,
                email: i.email,
              })),
              ot_numero: ot.ot_numero,
              cliente: ot.cliente,
              fecha_inspeccion: form.fechaInspeccion,
              hora: form.hora,
              supervisor: form.supervisor || nombreCompleto,
              descripcion_actividad: form.descripcionActividad,
              tipos_inspeccion: tiposStr || null,
              procedimientos: procedimientosStr || null,
              vehiculo: form.vehiculo || null,
            }),
          }
        )
        const edgeData = await edgeRes.json()
        emailsEnviados = edgeData.enviados || 0
        if (!edgeData.ok) emailError = edgeData.error
      } catch (e) {
        emailError = e.message
      }

      setExito({
        inspectores: form.inspectoresSeleccionados,
        emailsEnviados,
        emailError,
        waLinks: form.inspectoresSeleccionados
          .filter(i => i.telefono_whatsapp)
          .map(i => ({ nombre: i.nombre_completo, url: waLink(i.telefono_whatsapp, mensajeWA) })),
      })

      onAsignada && onAsignada()

    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!ot) return null

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.box}>
        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 18 }}>
              Asignar Inspector — {ot.ot_numero}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
              {ot.cliente}
            </p>
          </div>
          <button onClick={onClose} style={S.btnCerrar} disabled={guardando}>✕</button>
        </div>

        {/* ── Body ── */}
        <div style={S.body}>
          {exito ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1A3A5C', marginBottom: 8 }}>
                Asignación guardada correctamente
              </div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                Inspector(es): <b>{exito.inspectores.map(i => i.nombre_completo).join(', ')}</b>
              </div>
              {/* Estado emails */}
              {exito.emailsEnviados > 0 && (
                <div style={{ background: '#E6F9EF', border: '1px solid #6EBF8B', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#1A6B3A', marginBottom: 12 }}>
                  ✉️ Correo enviado a {exito.emailsEnviados} inspector(es) correctamente.
                </div>
              )}
              {exito.emailError && (
                <div style={{ background: '#FFF8E6', border: '1px solid #F0C040', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#7A5A00', marginBottom: 12 }}>
                  ⚠️ No se pudo enviar el email automático: {exito.emailError}.<br />
                  Usa WhatsApp para notificar manualmente.
                </div>
              )}
              {exito.waLinks.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                    📱 Enviar notificación por WhatsApp:
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {exito.waLinks.map(l => (
                      <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 13, padding: '8px 16px', borderRadius: 20,
                          background: '#25D366', color: '#fff', fontWeight: 'bold',
                          textDecoration: 'none',
                        }}>
                        💬 Notificar a {l.nombre}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={onClose} style={{ ...S.btnPrimary, background: '#1A3A5C' }}>
                Cerrar
              </button>
            </div>
          ) : (
            <div>
              {error && (
                <div style={{ background: '#FCEBEB', border: '1px solid #E57373', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#A32D2D', marginBottom: 16 }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Inspectores */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>
                  Inspector(es) asignado(s) *
                  <span style={{ fontSize: 10, color: '#185FA5', fontWeight: 'normal', marginLeft: 6 }}>selección múltiple</span>
                </label>
                <div style={S.checkList}>
                  {inspectores.filter(i => i.rol === 'INSPECTOR').length === 0 && (
                    <p style={{ margin: 8, fontSize: 13, color: '#aaa' }}>No hay inspectores activos</p>
                  )}
                  {inspectores.filter(i => i.rol === 'INSPECTOR').map(insp => {
                    const sel = !!form.inspectoresSeleccionados.find(i => i.email === insp.email)
                    return (
                      <label key={insp.email} style={S.checkRow(sel)}>
                        <input type="checkbox" checked={sel} onChange={() => toggleInspector(insp)} style={{ width: 'auto', cursor: 'pointer' }} />
                        <span style={{ flex: 1, fontSize: 13 }}>{insp.nombre_completo}</span>
                        <span style={{ fontSize: 10, color: '#aaa' }}>{insp.telefono_whatsapp || ''}</span>
                      </label>
                    )
                  })}
                </div>
                {form.inspectoresSeleccionados.length > 0 && (
                  <div style={{ fontSize: 11, color: '#185FA5', marginTop: 5 }}>
                    ✅ {form.inspectoresSeleccionados.map(i => i.nombre_completo).join(', ')}
                  </div>
                )}
              </div>

              {/* Supervisor + Fecha + Hora */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>Supervisor</label>
                  <input value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))} placeholder={nombreCompleto} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Fecha inspección</label>
                  <input type="date" value={form.fechaInspeccion} onChange={e => setForm(f => ({ ...f, fechaInspeccion: e.target.value }))} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Hora</label>
                  <input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} style={S.input} />
                </div>
              </div>

              {/* Tiempo / Vehículo / Normas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>Tiempo estimado</label>
                  <input value={form.tiempoEstimado} onChange={e => setForm(f => ({ ...f, tiempoEstimado: e.target.value }))} placeholder="Ej: 6 horas" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Vehículo</label>
                  <input value={form.vehiculo} onChange={e => setForm(f => ({ ...f, vehiculo: e.target.value }))} placeholder="Ej: SKHP-59" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Norma ejecución</label>
                  <input value={form.normaEjecucion} onChange={e => setForm(f => ({ ...f, normaEjecucion: e.target.value }))} placeholder="Ej: ASME V" style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Norma evaluación</label>
                  <input value={form.normaEvaluacion} onChange={e => setForm(f => ({ ...f, normaEvaluacion: e.target.value }))} placeholder="Ej: AWS D1.1" style={S.input} />
                </div>
              </div>

              {/* Procedimientos */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>
                  Procedimientos WSS
                  <span style={{ fontSize: 10, color: '#185FA5', fontWeight: 'normal', marginLeft: 6 }}>selección múltiple</span>
                </label>
                <div style={S.checkList}>
                  {procedimientos.length === 0 && (
                    <p style={{ margin: 8, fontSize: 13, color: '#aaa' }}>No hay procedimientos registrados</p>
                  )}
                  {procedimientos.map(proc => {
                    const val = `${proc.codigo} — ${proc.nombre}`
                    const sel = form.procedimientosSeleccionados.includes(val)
                    return (
                      <label key={proc.id} style={S.checkRow(sel)}>
                        <input type="checkbox" checked={sel} onChange={() => toggleProcedimiento(proc)} style={{ width: 'auto', cursor: 'pointer' }} />
                        <span style={{ fontSize: 12, flex: 1 }}><b>{proc.codigo}</b> — {proc.nombre}</span>
                      </label>
                    )
                  })}
                </div>
                {form.procedimientosSeleccionados.length > 0 && (
                  <div style={{ fontSize: 11, color: '#185FA5', marginTop: 5 }}>
                    ✅ {form.procedimientosSeleccionados.join(' · ')}
                  </div>
                )}
              </div>

              {/* Equipos */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>
                  Equipos / instrumentos a utilizar
                  <span style={{ fontSize: 10, color: '#185FA5', fontWeight: 'normal', marginLeft: 6 }}>selección múltiple</span>
                </label>
                <div style={{ ...S.checkList, maxHeight: 160 }}>
                  {equipos.length === 0 && (
                    <p style={{ margin: 8, fontSize: 13, color: '#aaa' }}>No hay equipos registrados</p>
                  )}
                  {equipos.map(eq => {
                    const val = `${eq.codigo} — ${eq.equipo_instrumento}`
                    const sel = form.equiposSeleccionados.includes(val)
                    return (
                      <label key={eq.id} style={S.checkRow(sel)}>
                        <input type="checkbox" checked={sel} onChange={() => toggleEquipo(eq)} style={{ width: 'auto', cursor: 'pointer' }} />
                        <span style={{ flex: 1, fontSize: 12 }}>{eq.equipo_instrumento}</span>
                        <span style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace' }}>{eq.codigo}</span>
                      </label>
                    )
                  })}
                </div>
                {form.equiposSeleccionados.length > 0 && (
                  <div style={{ fontSize: 11, color: '#185FA5', marginTop: 5 }}>
                    ✅ {form.equiposSeleccionados.length} equipo(s) seleccionado(s)
                  </div>
                )}
              </div>

              {/* Tipos de inspección */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Tipos de inspección</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {TIPOS.map(t => {
                    const sel = form.tiposInspeccion.includes(t.cod)
                    return (
                      <button key={t.cod} onClick={() => toggleTipo(t.cod)}
                        style={{
                          padding: '6px 10px', borderRadius: 8,
                          border: `1.5px solid ${sel ? '#185FA5' : '#ddd'}`,
                          background: sel ? '#E6F1FB' : '#fff',
                          cursor: 'pointer', fontSize: 11,
                          fontWeight: sel ? 'bold' : 'normal',
                          color: sel ? '#185FA5' : '#555',
                        }}>
                        <span style={{ display: 'block', fontWeight: 900, fontSize: 13 }}>{t.cod}</span>
                        <span style={{ display: 'block', fontSize: 9, color: sel ? '#185FA5' : '#aaa' }}>{t.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Descripción de actividades / Alcance *</label>
                <textarea
                  value={form.descripcionActividad}
                  onChange={e => setForm(f => ({ ...f, descripcionActividad: e.target.value }))}
                  placeholder="Detallar las actividades a realizar, alcance, elementos a inspeccionar..."
                  rows={4}
                  style={{ ...S.input, resize: 'vertical', minHeight: 90 }}
                />
              </div>

              {/* Info notificaciones */}
              <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#185FA5', marginBottom: 16 }}>
                ✉️ Al guardar se enviará un <b>correo automático</b> a cada inspector y se generarán los <b>links de WhatsApp</b>.
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
                <button onClick={onClose} disabled={guardando} style={S.btnOutline}>Cancelar</button>
                <button onClick={guardar} disabled={guardando}
                  style={{ ...S.btnPrimary, opacity: guardando ? 0.7 : 1, cursor: guardando ? 'not-allowed' : 'pointer' }}>
                  {guardando ? 'Guardando...' : '👥 Guardar y generar links WA →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── estilos ─────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)',
    zIndex: 300, display: 'flex', alignItems: 'flex-start',
    justifyContent: 'center', padding: '24px 16px', overflowY: 'auto',
  },
  box: {
    width: '100%', maxWidth: 860, background: '#fff',
    borderRadius: 18, boxShadow: '0 24px 80px rgba(0,0,0,.3)',
    overflow: 'hidden', marginBottom: 24,
  },
  header: {
    background: 'linear-gradient(135deg, #B45309, #92400E)',
    padding: '18px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  btnCerrar: {
    background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
    width: 32, height: 32, borderRadius: 8, fontSize: 14, cursor: 'pointer',
  },
  body: {
    padding: 24, maxHeight: '80vh', overflowY: 'auto',
  },
  label: {
    display: 'block', fontSize: 11, color: '#666',
    fontWeight: 'bold', marginBottom: 4,
  },
  input: {
    width: '100%', padding: '8px 10px',
    border: '1.5px solid #ddd', borderRadius: 8,
    fontSize: 13, fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box',
  },
  checkList: {
    border: '1.5px solid #ddd', borderRadius: 8, padding: 8,
    maxHeight: 180, overflowY: 'auto', background: '#fff',
  },
  checkRow: (selected) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 4px', cursor: 'pointer', borderRadius: 6,
    fontWeight: 'normal', margin: 0,
    background: selected ? '#EEF5FF' : 'transparent',
  }),
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#B45309', color: '#fff', cursor: 'pointer',
    fontSize: 13, fontWeight: 'bold',
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '9px 18px', borderRadius: 8,
    border: '1.5px solid #1A3A5C', background: '#fff',
    color: '#1A3A5C', cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
  },
}
