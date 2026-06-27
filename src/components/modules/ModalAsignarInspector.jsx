import { useState, useEffect } from 'react'
import { rpc, supabase, mensajeError } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const TIPOS_INSPECCION = ['VT', 'PT', 'MT', 'UT', 'UTT', 'PAUT', 'T', 'CG', 'CTK', 'PH', 'PN', 'CV', 'END']

export default function ModalAsignarInspector({ ot, onClose, onAsignada }) {
  const { usuario } = useAuth()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [inspectores, setInspectores] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [catalogoProcedimientos, setCatalogoProcedimientos] = useState([])
  const [catalogoEquipos, setCatalogoEquipos] = useState([])
  const [tiposSeleccionados, setTiposSeleccionados] = useState([])
  const [inspectoresSeleccionados, setInspectoresSeleccionados] = useState([])
  const [procedimientosSeleccionados, setProcedimientosSeleccionados] = useState([])
  const [equiposSeleccionados, setEquiposSeleccionados] = useState([])

  const [form, setForm] = useState({
    supervisor: '',
    fecha_inspeccion: '',
    hora: '',
    tiempo_estimado: '',
    vehiculo: '',
    norma_ejecucion: '',
    norma_evaluacion: '',
    descripcion_actividad: '',
  })

  useEffect(() => {
    cargarDatos()
    if (ot?.supervisor) setForm(f => ({ ...f, supervisor: ot.supervisor }))
  }, [ot])

  async function cargarDatos() {
    try {
      const [{ data: usuarios }, { data: procs }, { data: equips }] = await Promise.all([
        supabase.from('usuarios').select('id, nombre, apellido, rol, sede').eq('activo', true).order('nombre'),
        supabase.from('catalogo_procedimientos').select('id, nombre, codigo').eq('activo', true).order('codigo'),
        supabase.from('equipos').select('id, equipo_instrumento, codigo').eq('activo', true).order('equipo_instrumento'),
      ])
      const todos = usuarios || []
      setInspectores(todos.filter(u => u.rol === 'INSPECTOR'))
      setSupervisores(todos.filter(u => ['SUPERVISOR', 'ADMIN', 'ADMINISTRADOR'].includes(u.rol)))
      setCatalogoProcedimientos(procs || [])
      setCatalogoEquipos(equips || [])
    } catch { /* no bloquea */ }
  }

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (error) setError('')
  }

  function toggleInspector(nombre) {
    setInspectoresSeleccionados(prev =>
      prev.includes(nombre) ? prev.filter(n => n !== nombre) : [...prev, nombre]
    )
  }

  function toggleTipo(cod) {
    setTiposSeleccionados(prev =>
      prev.includes(cod) ? prev.filter(c => c !== cod) : [...prev, cod]
    )
  }

  function toggleProcedimiento(val) {
    setProcedimientosSeleccionados(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  function toggleEquipo(val) {
    setEquiposSeleccionados(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!inspectoresSeleccionados.length) { setError('Selecciona al menos un inspector'); return }
    if (!form.fecha_inspeccion) { setError('La fecha de inspección es obligatoria'); return }

    try {
      setGuardando(true)
      setError('')

      const procedimientosStr = procedimientosSeleccionados.join(', ')
      const equiposStr = equiposSeleccionados.join(', ')
      const descripcionFinal = equiposStr
        ? `${form.descripcion_actividad}\n\nEquipos/instrumentos: ${equiposStr}`
        : form.descripcion_actividad

      await rpc('crear_asignacion_portal', {
        p_email_usuario:          usuario?.email || '',
        p_ot_numero:              ot.ot_numero,
        p_supervisor:             form.supervisor || usuario?.nombre || '',
        p_inspectores_asignados:  inspectoresSeleccionados.join(', '),
        p_fecha_inspeccion:       form.fecha_inspeccion || null,
        p_hora:                   form.hora || null,
        p_tiempo_estimado:        form.tiempo_estimado || null,
        p_vehiculo:               form.vehiculo || null,
        p_norma_ejecucion:        form.norma_ejecucion || null,
        p_norma_evaluacion:       form.norma_evaluacion || null,
        p_procedimientos:         procedimientosStr || null,
        p_tipos_inspeccion:       tiposSeleccionados.join(', ') || null,
        p_descripcion_actividad:  descripcionFinal || null,
      })

      onAsignada && onAsignada()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  if (!ot) return null

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.box}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 18 }}>Asignar Inspector — {ot.ot_numero}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{ot.cliente}</p>
          </div>
          <button onClick={onClose} style={styles.btnCerrar} disabled={guardando}>✕</button>
        </div>

        <div style={styles.body}>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="grid">

              <div className="col-12 field">
                <label>Inspector(es) asignado(s) *</label>
                <div style={styles.checkGrid}>
                  {inspectores.length === 0 && <p className="text-sm">No hay inspectores activos registrados</p>}
                  {inspectores.map(u => {
                    const nombre = `${u.nombre} ${u.apellido}`.trim()
                    const sel = inspectoresSeleccionados.includes(nombre)
                    return (
                      <label key={u.id} style={{ ...styles.pillCheck, background: sel ? '#17395C' : '#fff', color: sel ? '#fff' : '#344054', borderColor: sel ? '#17395C' : '#D0D5DD' }}>
                        <input type="checkbox" style={{ display: 'none' }} checked={sel} onChange={() => toggleInspector(nombre)} disabled={guardando} />
                        <span style={{ fontWeight: 700 }}>{nombre}</span>
                        <span style={{ fontSize: 11, opacity: .8 }}>{u.sede}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="col-6 field">
                <label>Supervisor</label>
                <select className="select" value={form.supervisor} onChange={e => set('supervisor', e.target.value)} disabled={guardando}>
                  <option value="">— Seleccionar —</option>
                  {supervisores.map(u => {
                    const nombre = `${u.nombre} ${u.apellido}`.trim()
                    return <option key={u.id} value={nombre}>{nombre} · {u.sede}</option>
                  })}
                </select>
              </div>

              <div className="col-3 field">
                <label>Fecha inspección *</label>
                <input className="input" type="date" value={form.fecha_inspeccion} onChange={e => set('fecha_inspeccion', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-3 field">
                <label>Hora</label>
                <input className="input" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} disabled={guardando} />
              </div>

              <div className="col-4 field">
                <label>Tiempo estimado</label>
                <input className="input" placeholder="Ej: 6 HRS" value={form.tiempo_estimado} onChange={e => set('tiempo_estimado', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-4 field">
                <label>Vehículo</label>
                <input className="input" placeholder="Patente" value={form.vehiculo} onChange={e => set('vehiculo', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-4 field">
                <label>Norma ejecución</label>
                <input className="input" placeholder="Ej: AWS D1.1" value={form.norma_ejecucion} onChange={e => set('norma_ejecucion', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-4 field">
                <label>Norma evaluación</label>
                <input className="input" placeholder="Ej: ASME V" value={form.norma_evaluacion} onChange={e => set('norma_evaluacion', e.target.value)} disabled={guardando} />
              </div>

              <div className="col-12 field">
                <label>Tipos de inspección</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TIPOS_INSPECCION.map(cod => {
                    const sel = tiposSeleccionados.includes(cod)
                    return (
                      <button key={cod} type="button" onClick={() => toggleTipo(cod)} style={{ padding: '6px 14px', borderRadius: 999, border: '1.5px solid', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: sel ? '#17395C' : '#fff', color: sel ? '#fff' : '#344054', borderColor: sel ? '#17395C' : '#D0D5DD' }}>
                        {cod}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="col-12 field">
                <label>Procedimientos WSS <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400, marginLeft: 6 }}>selección múltiple</span></label>
                <div style={styles.listaSeleccion}>
                  {catalogoProcedimientos.length === 0
                    ? <p style={styles.sinDatos}>No hay procedimientos registrados</p>
                    : catalogoProcedimientos.map(p => {
                        const val = `${p.codigo} — ${p.nombre}`
                        const sel = procedimientosSeleccionados.includes(val)
                        return (
                          <label key={p.id} style={{ ...styles.filaCheck, background: sel ? '#EEF2FF' : 'transparent' }}>
                            <input type="checkbox" checked={sel} onChange={() => toggleProcedimiento(val)} disabled={guardando} style={{ accentColor: '#17395C', width: 15, height: 15, cursor: 'pointer' }} />
                            <span style={{ fontSize: 13, flex: 1 }}><b style={{ color: '#17395C' }}>{p.codigo}</b> — {p.nombre}</span>
                          </label>
                        )
                      })
                  }
                </div>
                {procedimientosSeleccionados.length > 0 && (
                  <div style={styles.resumenSel}>✅ {procedimientosSeleccionados.length} seleccionado(s): {procedimientosSeleccionados.map(v => v.split(' — ')[0]).join(', ')}</div>
                )}
              </div>

              <div className="col-12 field">
                <label>Equipos / Instrumentos <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400, marginLeft: 6 }}>selección múltiple</span></label>
                <div style={styles.listaSeleccion}>
                  {catalogoEquipos.length === 0
                    ? <p style={styles.sinDatos}>No hay equipos registrados</p>
                    : catalogoEquipos.map(eq => {
                        const val = `${eq.codigo} — ${eq.equipo_instrumento}`
                        const sel = equiposSeleccionados.includes(val)
                        return (
                          <label key={eq.id} style={{ ...styles.filaCheck, background: sel ? '#EEF2FF' : 'transparent' }}>
                            <input type="checkbox" checked={sel} onChange={() => toggleEquipo(val)} disabled={guardando} style={{ accentColor: '#17395C', width: 15, height: 15, cursor: 'pointer' }} />
                            <span style={{ fontSize: 13, flex: 1 }}>{eq.equipo_instrumento}</span>
                            <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{eq.codigo}</span>
                          </label>
                        )
                      })
                  }
                </div>
                {equiposSeleccionados.length > 0 && (
                  <div style={styles.resumenSel}>✅ {equiposSeleccionados.length} equipo(s) seleccionado(s)</div>
                )}
              </div>

              <div className="col-12 field">
                <label>Descripción actividades / alcance</label>
                <textarea className="input" rows={4} style={{ resize: 'vertical' }}
                  placeholder="Describir el alcance, elementos a inspeccionar, condiciones especiales..."
                  value={form.descripcion_actividad} onChange={e => set('descripcion_actividad', e.target.value)} disabled={guardando} />
              </div>
            </div>

            <div style={styles.footer}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn btn-warn btn-lg" disabled={guardando}>
                {guardando ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Asignando...</> : '👥 Asignar inspector'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' },
  box: { width: '100%', maxWidth: 860, background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(0,0,0,.3)', overflow: 'hidden', marginBottom: 24 },
  header: { background: 'linear-gradient(135deg, #B45309, #92400E)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  btnCerrar: { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  body: { padding: '24px', maxHeight: '80vh', overflowY: 'auto' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid var(--borde)', marginTop: 8 },
  checkGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, padding: 12, background: '#F9FAFB', borderRadius: 10, border: '1px solid #EAECF0' },
  pillCheck: { display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', border: '1.5px solid', borderRadius: 10, cursor: 'pointer', transition: 'all .15s', userSelect: 'none' },
  listaSeleccion: { border: '1.5px solid #D0D5DD', borderRadius: 10, padding: 8, maxHeight: 200, overflowY: 'auto', background: '#F9FAFB' },
  filaCheck: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', userSelect: 'none', transition: 'background .1s' },
  resumenSel: { marginTop: 6, fontSize: 11, color: '#17395C', fontWeight: 600 },
  sinDatos: { fontSize: 13, color: '#9CA3AF', padding: '8px 4px', margin: 0 },
}
