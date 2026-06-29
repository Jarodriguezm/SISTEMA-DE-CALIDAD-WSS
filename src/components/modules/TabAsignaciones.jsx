import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

// ─── helpers ────────────────────────────────────────────────────────────────
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

// ─── subcomponente: tarjeta de asignación existente ─────────────────────────
function TarjetaAsignacion({ asig }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8e8e8',
      borderLeft: '4px solid #1A3A5C',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            REG-DII-036
          </div>
          <div style={{ fontSize: 15, fontWeight: 'bold', color: '#1A3A5C', marginTop: 2 }}>
            {asig.inspectores_asignados}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            Supervisor: {asig.supervisor}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 'bold',
            padding: '3px 10px',
            borderRadius: 20,
            background: '#EAF3DE',
            color: '#3B6D11',
          }}>
            ✅ {asig.estado}
          </span>
          {asig.fecha_inspeccion && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              📅 {asig.fecha_inspeccion} {asig.hora ? `· ${asig.hora}` : ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12, color: '#555', marginBottom: 10 }}>
        {asig.vehiculo && <div>🚗 Vehículo: <b>{asig.vehiculo}</b></div>}
        {asig.tiempo_estimado && <div>⏱ Tiempo: <b>{asig.tiempo_estimado}</b></div>}
        {asig.norma_ejecucion && <div>📐 Ejec.: <b>{asig.norma_ejecucion}</b></div>}
        {asig.norma_evaluacion && <div>📋 Eval.: <b>{asig.norma_evaluacion}</b></div>}
      </div>

      {asig.procedimientos && (
        <div style={{ fontSize: 11, background: '#F7F8FA', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
          <span style={{ color: '#888', fontWeight: 'bold' }}>Procedimientos: </span>
          {asig.procedimientos}
        </div>
      )}

      {asig.tipos_inspeccion && (
        <div style={{ fontSize: 11, background: '#F7F8FA', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
          <span style={{ color: '#888', fontWeight: 'bold' }}>Tipos: </span>
          {asig.tipos_inspeccion}
        </div>
      )}

      {asig.descripcion_actividad && (
        <div style={{ fontSize: 12, color: '#444', background: '#f9f9f9', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
          {asig.descripcion_actividad}
        </div>
      )}

      {asig.whatsapp_inspectores_url && (
        <a href={asig.whatsapp_inspectores_url} target="_blank" rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, padding: '5px 12px', borderRadius: 20,
            background: '#25D366', color: '#fff', fontWeight: 'bold',
            textDecoration: 'none',
          }}>
          💬 Reenviar WhatsApp
        </a>
      )}
    </div>
  )
}

// ─── componente principal ────────────────────────────────────────────────────
export default function TabAsignaciones({ ot }) {
  const { usuario } = useAuth()
  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ')

  const [asignaciones, setAsignaciones] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [mostrarForm, setMostrarForm]   = useState(false)
  const [guardando, setGuardando]       = useState(false)
  const [exito, setExito]               = useState(null)

  // catálogos
  const [equipos, setEquipos]           = useState([])
  const [procedimientos, setProcedimientos] = useState([])
  const [inspectores, setInspectores]   = useState([])

  // form state
  const [form, setForm] = useState({
    supervisor: '',
    inspectoresSeleccionados: [],   // array de objetos {nombre_completo, email, telefono_whatsapp}
    equiposSeleccionados: [],       // array de strings "codigo — nombre"
    procedimientosSeleccionados: [],// array de strings "codigo — nombre"
    tiposInspeccion: [],            // array de strings
    fechaInspeccion: '',
    hora: '',
    tiempoEstimado: '',
    vehiculo: '',
    normaEjecucion: '',
    normaEvaluacion: '',
    descripcionActividad: '',
  })

  const TIPOS = [
    { cod: 'VT',  desc: 'Insp. visual' },
    { cod: 'CD',  desc: 'Control dim.' },
    { cod: 'PT',  desc: 'Líq. penetrantes' },
    { cod: 'MT',  desc: 'Part. magnéticas' },
    { cod: 'UT',  desc: 'Ultrasonido' },
    { cod: 'UTT', desc: 'Med. espesores' },
    { cod: 'T',   desc: 'Termografía' },
    { cod: 'CG',  desc: 'Cert. grúas' },
    { cod: 'CTK', desc: 'Cert. tanques' },
    { cod: 'CS',  desc: 'Calif. soldador' },
    { cod: 'PH',  desc: 'Prueba hidrost.' },
    { cod: 'PN',  desc: 'Prueba neumática' },
    { cod: 'CV',  desc: 'Cámara vacío' },
    { cod: 'O',   desc: 'Otros' },
  ]

  // ── cargar asignaciones existentes ──────────────────────────────────────
  const cargarAsignaciones = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('obtener_asignaciones_por_ot', {
        p_ot_numero: ot.ot_numero,
      })
      if (err) throw err
      setAsignaciones(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [ot.ot_numero])

  // ── cargar catálogos ─────────────────────────────────────────────────────
  const cargarCatalogos = useCallback(async () => {
    try {
      const [{ data: eq }, { data: proc }, { data: insp }] = await Promise.all([
        supabase
          .from('equipos')
          .select('id, equipo_instrumento, codigo')
          .eq('activo', true)
          .order('equipo_instrumento'),
        supabase
          .from('catalogo_procedimientos')
          .select('id, nombre, codigo')
          .eq('activo', true)
          .order('codigo'),
        supabase
          .from('v_usuarios_portal')
          .select('nombre_completo, email, telefono_whatsapp, rol')
          .in('rol', ['INSPECTOR', 'SUPERVISOR', 'ADMIN'])
          .order('nombre_completo'),
      ])
      setEquipos(eq || [])
      setProcedimientos(proc || [])
      setInspectores(insp || [])
    } catch (e) {
      console.error('Error cargando catálogos:', e)
    }
  }, [])

  useEffect(() => {
    cargarAsignaciones()
    cargarCatalogos()
  }, [cargarAsignaciones, cargarCatalogos])

  // ── toggle helpers ───────────────────────────────────────────────────────
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

  // ── guardar ──────────────────────────────────────────────────────────────
  async function guardarAsignacion() {
    if (form.inspectoresSeleccionados.length === 0) {
      alert('Selecciona al menos un inspector.')
      return
    }
    if (!form.descripcionActividad.trim()) {
      alert('La descripción de actividades es obligatoria.')
      return
    }

    setGuardando(true)
    setExito(null)
    setError(null)

    try {
      const inspectoresStr = form.inspectoresSeleccionados.map(i => i.nombre_completo).join(', ')
      const procedimientosStr = form.procedimientosSeleccionados.join(', ')
      const tiposStr = form.tiposInspeccion.join(', ')
      const equiposStr = form.equiposSeleccionados.join(', ')

      // Construir link WA (todos los inspectores)
      const mensajeWA = buildWAMensaje({
        otNumero: ot.ot_numero,
        cliente: ot.cliente,
        fechaInspeccion: form.fechaInspeccion,
        hora: form.hora,
        descripcion: form.descripcionActividad,
        supervisorNombre: form.supervisor || nombreCompleto,
      })

      // Primer inspector con teléfono para el link (link único al primero con tel)
      const primerConTel = form.inspectoresSeleccionados.find(i => i.telefono_whatsapp)
      const waUrl = primerConTel ? waLink(primerConTel.telefono_whatsapp, mensajeWA) : null

      // Descripción enriquecida con equipos si hay seleccionados
      const descripcionFinal = equiposStr
        ? `${form.descripcionActividad}\n\nEquipos/instrumentos: ${equiposStr}`
        : form.descripcionActividad

      const { data, error: err } = await supabase.rpc('crear_asignacion_portal', {
        p_email_usuario:          usuario?.email || '',
        p_ot_numero:              ot.ot_numero,
        p_supervisor:             form.supervisor || nombreCompleto,
        p_inspectores_asignados:  inspectoresStr,
        p_fecha_inspeccion:       form.fechaInspeccion || null,
        p_hora:                   form.hora || null,
        p_tiempo_estimado:        form.tiempoEstimado || null,
        p_vehiculo:               form.vehiculo || null,
        p_norma_ejecucion:        form.normaEjecucion || null,
        p_norma_evaluacion:       form.normaEvaluacion || null,
        p_procedimientos:         procedimientosStr || null,
        p_tipos_inspeccion:       tiposStr || null,
        p_descripcion_actividad:  descripcionFinal,
        p_drive_url:              null,
        p_whatsapp_inspectores_url: waUrl,
      })

      if (err) throw err

      setExito({
        inspectores: form.inspectoresSeleccionados,
        mensajeWA,
        waLinks: form.inspectoresSeleccionados
          .filter(i => i.telefono_whatsapp)
          .map(i => ({ nombre: i.nombre_completo, url: waLink(i.telefono_whatsapp, mensajeWA) })),
      })

      setMostrarForm(false)
      setForm({
        supervisor: '',
        inspectoresSeleccionados: [],
        equiposSeleccionados: [],
        procedimientosSeleccionados: [],
        tiposInspeccion: [],
        fechaInspeccion: '',
        hora: '',
        tiempoEstimado: '',
        vehiculo: '',
        normaEjecucion: '',
        normaEvaluacion: '',
        descripcionActividad: '',
      })
      await cargarAsignaciones()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  // ── render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>
      Cargando asignaciones...
    </div>
  )

  return (
    <div>
      {/* ── encabezado ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#1A3A5C' }}>
            Asignaciones de Actividades
          </div>
          <div style={{ fontSize: 11, color: '#999' }}>REG-DII-036 Rev.04</div>
        </div>
        {!mostrarForm && (
          <button
            onClick={() => { setMostrarForm(true); setExito(null) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '8px 16px', borderRadius: 8,
              background: '#1A3A5C', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
            }}
          >
            + Nueva asignación
          </button>
        )}
      </div>

      {/* ── error global ── */}
      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E57373', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#A32D2D', marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── éxito + links WA ── */}
      {exito && (
        <div style={{ background: '#EAF3DE', border: '1px solid #97C459', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ fontWeight: 'bold', color: '#3B6D11', marginBottom: 8 }}>
            ✅ Asignación guardada correctamente
          </div>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
            Inspector(es): <b>{exito.inspectores.map(i => i.nombre_completo).join(', ')}</b>
          </div>
          {exito.waLinks.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#666', fontWeight: 'bold', marginBottom: 6 }}>
                📱 Enviar notificación por WhatsApp:
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {exito.waLinks.map(l => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12, padding: '6px 14px', borderRadius: 20,
                      background: '#25D366', color: '#fff', fontWeight: 'bold',
                      textDecoration: 'none',
                    }}>
                    💬 Notificar a {l.nombre}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── formulario nueva asignación ── */}
      {mostrarForm && (
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#1A3A5C', marginBottom: 16 }}>
            Nueva Asignación — {ot.ot_numero} · {ot.cliente}
          </div>

          {/* Inspectores */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              Inspector(es) asignado(s) *
              <span style={{ fontSize: 10, color: '#185FA5', fontWeight: 'normal', marginLeft: 6 }}>selección múltiple</span>
            </label>
            <div style={checkboxListStyle}>
              {inspectores.filter(i => i.rol === 'INSPECTOR').map(insp => {
                const sel = form.inspectoresSeleccionados.find(i => i.email === insp.email)
                return (
                  <label key={insp.email} style={checkRowStyle(!!sel)}>
                    <input
                      type="checkbox"
                      checked={!!sel}
                      onChange={() => toggleInspector(insp)}
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontSize: 13 }}>{insp.nombre_completo}</span>
                    <span style={{ fontSize: 10, color: '#aaa' }}>{insp.telefono_whatsapp || ''}</span>
                  </label>
                )
              })}
            </div>
            {form.inspectoresSeleccionados.length > 0 && (
              <div style={{ fontSize: 11, color: '#185FA5', marginTop: 5 }}>
                ✅ {form.inspectoresSeleccionados.length} inspector(es): {form.inspectoresSeleccionados.map(i => i.nombre_completo).join(', ')}
              </div>
            )}
          </div>

          {/* Supervisor + Fecha/Hora */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Supervisor</label>
              <input
                value={form.supervisor}
                onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))}
                placeholder={nombreCompleto}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Fecha inspección *</label>
              <input
                type="date"
                value={form.fechaInspeccion}
                onChange={e => setForm(f => ({ ...f, fechaInspeccion: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input
                type="time"
                value={form.hora}
                onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Tiempo / Vehículo / Normas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Tiempo estimado</label>
              <input value={form.tiempoEstimado} onChange={e => setForm(f => ({ ...f, tiempoEstimado: e.target.value }))} placeholder="Ej: 6 horas" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Vehículo</label>
              <input value={form.vehiculo} onChange={e => setForm(f => ({ ...f, vehiculo: e.target.value }))} placeholder="Ej: SKHP-59" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Norma ejecución</label>
              <input value={form.normaEjecucion} onChange={e => setForm(f => ({ ...f, normaEjecucion: e.target.value }))} placeholder="Ej: ASME V" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Norma evaluación</label>
              <input value={form.normaEvaluacion} onChange={e => setForm(f => ({ ...f, normaEvaluacion: e.target.value }))} placeholder="Ej: AWS D1.1" style={inputStyle} />
            </div>
          </div>

          {/* Procedimientos */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              Procedimientos WSS *
              <span style={{ fontSize: 10, color: '#185FA5', fontWeight: 'normal', marginLeft: 6 }}>selección múltiple</span>
            </label>
            <div style={checkboxListStyle}>
              {procedimientos.map(proc => {
                const val = `${proc.codigo} — ${proc.nombre}`
                const sel = form.procedimientosSeleccionados.includes(val)
                return (
                  <label key={proc.id} style={checkRowStyle(sel)}>
                    <input type="checkbox" checked={sel} onChange={() => toggleProcedimiento(proc)} style={{ width: 'auto', cursor: 'pointer' }} />
                    <span style={{ fontSize: 12 }}><b>{proc.codigo}</b> — {proc.nombre}</span>
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
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              Equipos / instrumentos a utilizar
              <span style={{ fontSize: 10, color: '#185FA5', fontWeight: 'normal', marginLeft: 6 }}>selección múltiple</span>
            </label>
            <div style={{ ...checkboxListStyle, maxHeight: 200 }}>
              {equipos.map(eq => {
                const val = `${eq.codigo} — ${eq.equipo_instrumento}`
                const sel = form.equiposSeleccionados.includes(val)
                return (
                  <label key={eq.id} style={checkRowStyle(sel)}>
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
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Tipos de inspección</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {TIPOS.map(t => {
                const sel = form.tiposInspeccion.includes(t.cod)
                return (
                  <button
                    key={t.cod}
                    onClick={() => toggleTipo(t.cod)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: `1.5px solid ${sel ? '#185FA5' : '#ddd'}`,
                      background: sel ? '#E6F1FB' : '#fff',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: sel ? 'bold' : 'normal',
                      color: sel ? '#185FA5' : '#555',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 900, fontSize: 13 }}>{t.cod}</span>
                    <span style={{ display: 'block', fontSize: 9, color: sel ? '#185FA5' : '#aaa' }}>{t.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Descripción de actividades / Alcance *</label>
            <textarea
              value={form.descripcionActividad}
              onChange={e => setForm(f => ({ ...f, descripcionActividad: e.target.value }))}
              placeholder="Detallar las actividades a realizar, alcance, elementos a inspeccionar..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
            />
          </div>

          {/* Info WA */}
          <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#185FA5', marginBottom: 14 }}>
            💬 Al guardar se generarán los <b>links de WhatsApp</b> para notificar a cada inspector seleccionado.
          </div>

          {error && (
            <div style={{ background: '#FCEBEB', border: '1px solid #E57373', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#A32D2D', marginBottom: 12 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setMostrarForm(false); setError(null) }}
              style={btnOutline}
            >
              Cancelar
            </button>
            <button
              onClick={guardarAsignacion}
              disabled={guardando}
              style={{
                ...btnPrimary,
                opacity: guardando ? 0.7 : 1,
                cursor: guardando ? 'not-allowed' : 'pointer',
              }}
            >
              {guardando ? 'Guardando...' : 'Guardar y generar links WA →'}
            </button>
          </div>
        </div>
      )}

      {/* ── lista de asignaciones existentes ── */}
      {asignaciones.length === 0 && !mostrarForm ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#aaa', background: '#fff', borderRadius: 10, border: '1px dashed #ddd' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#999' }}>Sin asignaciones</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Crea la primera asignación para esta OT</div>
        </div>
      ) : (
        <div>
          {asignaciones.length > 0 && (
            <div style={{ fontSize: 11, color: '#999', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              {asignaciones.length} asignación(es) registrada(s)
            </div>
          )}
          {asignaciones.map((a, i) => (
            <TarjetaAsignacion key={i} asig={a} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── estilos reutilizables ───────────────────────────────────────────────────
const labelStyle = {
  display: 'block',
  fontSize: 11,
  color: '#666',
  fontWeight: 'bold',
  marginBottom: 4,
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1.5px solid #ddd',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'Arial, sans-serif',
  boxSizing: 'border-box',
}

const checkboxListStyle = {
  border: '1.5px solid #ddd',
  borderRadius: 8,
  padding: 8,
  maxHeight: 160,
  overflowY: 'auto',
  background: '#fff',
}

const checkRowStyle = (selected) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 4px',
  cursor: 'pointer',
  borderRadius: 6,
  fontWeight: 'normal',
  margin: 0,
  background: selected ? '#EEF5FF' : 'transparent',
  transition: 'background 0.1s',
})

const btnPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '9px 18px',
  borderRadius: 8,
  border: 'none',
  background: '#1A3A5C',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 'bold',
}

const btnOutline = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '9px 18px',
  borderRadius: 8,
  border: '1.5px solid #1A3A5C',
  background: '#fff',
  color: '#1A3A5C',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 'bold',
}
