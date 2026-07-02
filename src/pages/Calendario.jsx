// ============================================================
// Calendario.jsx — Módulo Calendario de Actividades WSS
// Vista día / semana / mes + CRUD de actividades
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ── Constantes ───────────────────────────────────────────────────────────────
const ESTADOS = ['Programada','En ejecución','Ejecutada','Reprogramada','Cancelada','Pendiente de informe','Cerrada']
const ESTADO_COLOR = {
  'Programada':            '#1E4D7B',
  'En ejecución':          '#D97706',
  'Ejecutada':             '#059669',
  'Reprogramada':          '#7C3AED',
  'Cancelada':             '#DC2626',
  'Pendiente de informe':  '#EA580C',
  'Cerrada':               '#64748B',
}
const SEDES = ['ANF','SCL','CCP']
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ── Helpers de fecha ─────────────────────────────────────────────────────────
function isoFecha(d) { return d.toISOString().split('T')[0] }
function fmtFecha(iso) {
  if (!iso) return '—'
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function fmtHora(t) { return t ? t.substring(0,5) : '' }

// ── Componente principal ──────────────────────────────────────────────────────
export default function Calendario() {
  const { usuario, esAdmin, esSupervisor } = useAuth()
  const puedeCrear  = esAdmin() || esSupervisor() || (usuario?.rol || '').toUpperCase() === 'COMERCIAL'
  const puedeEditar = esAdmin() || esSupervisor()

  // Estado general
  const [vista, setVista]               = useState('mes')   // 'dia' | 'semana' | 'mes'
  const [fechaRef, setFechaRef]         = useState(new Date())
  const [actividades, setActividades]   = useState([])
  const [cargando, setCargando]         = useState(false)
  const [error, setError]               = useState('')

  // Filtros
  const [filtroSede, setFiltroSede]         = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('')
  const [filtroResp, setFiltroResp]         = useState('')

  // Modal
  const [modalAbierto, setModalAbierto]   = useState(false)
  const [actSeleccionada, setActSeleccionada] = useState(null)  // null = nueva
  const [fechaInicioModal, setFechaInicioModal] = useState('')  // prefill al crear

  // Detalle
  const [detalleAbierto, setDetalleAbierto] = useState(false)
  const [actDetalle, setActDetalle]         = useState(null)

  // Cargar actividades según rango
  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')
      const { inicio, fin } = getRango(vista, fechaRef)

      const { data, error: err } = await supabase
        .from('actividades_calendario')
        .select('*')
        .is('deleted_at', null)
        .gte('fecha_inicio', isoFecha(inicio))
        .lte('fecha_inicio', isoFecha(fin))
        .order('fecha_inicio')
        .order('hora_inicio')

      if (err) throw err

      let filtradas = data || []
      if (filtroSede)   filtradas = filtradas.filter(a => a.sede   === filtroSede)
      if (filtroEstado) filtradas = filtradas.filter(a => a.estado === filtroEstado)
      if (filtroResp)   filtradas = filtradas.filter(a =>
        (a.responsable_nombre || '').toLowerCase().includes(filtroResp.toLowerCase()) ||
        (a.inspector_nombre   || '').toLowerCase().includes(filtroResp.toLowerCase())
      )
      setActividades(filtradas)
    } catch (e) {
      setError('Error al cargar actividades: ' + e.message)
    } finally {
      setCargando(false)
    }
  }, [vista, fechaRef, filtroSede, filtroEstado, filtroResp])

  useEffect(() => { cargar() }, [cargar])

  // Abrir modal nuevo
  function abrirNuevo(fechaISO) {
    setActSeleccionada(null)
    setFechaInicioModal(fechaISO || isoFecha(new Date()))
    setModalAbierto(true)
  }

  // Abrir modal edición
  function abrirEditar(act) {
    setDetalleAbierto(false)
    setActSeleccionada(act)
    setFechaInicioModal(act.fecha_inicio)
    setModalAbierto(true)
  }

  // Abrir detalle
  function abrirDetalle(act) {
    setActDetalle(act)
    setDetalleAbierto(true)
  }

  async function eliminar(id) {
    if (!confirm('¿Cancelar/eliminar esta actividad?')) return
    const { error } = await supabase
      .from('actividades_calendario')
      .update({ deleted_at: new Date().toISOString(), updated_by: usuario?.email })
      .eq('id', id)
    if (!error) { setDetalleAbierto(false); cargar() }
  }

  // Navegación
  function navAnterior() { setFechaRef(f => moverFecha(f, -1, vista)) }
  function navSiguiente() { setFechaRef(f => moverFecha(f, 1, vista)) }
  function irHoy()        { setFechaRef(new Date()) }

  const labelFechaRef = getLabelFecha(vista, fechaRef)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h1 style={{ margin:0, fontSize:22 }}>📅 Calendario de Actividades</h1>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {puedeCrear && (
            <button className="btn btn-primary btn-sm" onClick={() => abrirNuevo('')}>
              + Nueva actividad
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={cargar}>↻</button>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div style={s.filtrosBar}>
        <select className="select" style={{ minWidth:130 }} value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
          <option value="">Todas las sedes</option>
          {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" style={{ minWidth:160 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          className="input"
          placeholder="Filtrar por responsable..."
          style={{ minWidth:180 }}
          value={filtroResp}
          onChange={e => setFiltroResp(e.target.value)}
        />
      </div>

      {/* ── Navegación y vistas ─────────────────────────────────────────────── */}
      <div style={s.navBar}>
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn btn-ghost btn-sm" onClick={navAnterior}>‹</button>
          <button className="btn btn-ghost btn-sm" onClick={irHoy}>Hoy</button>
          <button className="btn btn-ghost btn-sm" onClick={navSiguiente}>›</button>
        </div>
        <span style={{ fontWeight:700, fontSize:16, color:'var(--azul)' }}>{labelFechaRef}</span>
        <div style={{ display:'flex', gap:4 }}>
          {['dia','semana','mes'].map(v => (
            <button
              key={v}
              className={`btn btn-sm ${vista === v ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setVista(v)}
              style={{ textTransform:'capitalize' }}
            >
              {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ margin:'8px 0' }}>{error}</div>}
      {cargando && <div className="loading-bar" />}

      {/* ── Vista Mes ─────────────────────────────────────────────────────── */}
      {vista === 'mes' && (
        <VistaMes
          fechaRef={fechaRef}
          actividades={actividades}
          onDiaClick={abrirNuevo}
          onActClick={abrirDetalle}
          puedeCrear={puedeCrear}
        />
      )}

      {/* ── Vista Semana ──────────────────────────────────────────────────── */}
      {vista === 'semana' && (
        <VistaSemana
          fechaRef={fechaRef}
          actividades={actividades}
          onDiaClick={abrirNuevo}
          onActClick={abrirDetalle}
          puedeCrear={puedeCrear}
        />
      )}

      {/* ── Vista Día ─────────────────────────────────────────────────────── */}
      {vista === 'dia' && (
        <VistaDia
          fechaRef={fechaRef}
          actividades={actividades}
          onActClick={abrirDetalle}
          onNuevo={() => abrirNuevo(isoFecha(fechaRef))}
          puedeCrear={puedeCrear}
        />
      )}

      {/* ── Panel lateral actividades del periodo ──────────────────────────── */}
      <div style={s.listaPanel}>
        <h3 style={{ marginBottom:12, fontSize:14 }}>
          Actividades del período ({actividades.length})
        </h3>
        {actividades.length === 0 && !cargando && (
          <p style={{ color:'var(--gris)', fontSize:13 }}>No hay actividades en este período.</p>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {actividades.map(a => (
            <CardActividad key={a.id} act={a} onClick={() => abrirDetalle(a)} />
          ))}
        </div>
      </div>

      {/* ── Modal crear/editar ─────────────────────────────────────────────── */}
      {modalAbierto && (
        <ModalActividad
          actividad={actSeleccionada}
          fechaInicio={fechaInicioModal}
          usuario={usuario}
          onGuardado={() => { setModalAbierto(false); cargar() }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {/* ── Modal detalle ──────────────────────────────────────────────────── */}
      {detalleAbierto && actDetalle && (
        <ModalDetalle
          act={actDetalle}
          puedeEditar={puedeEditar}
          onEditar={() => abrirEditar(actDetalle)}
          onEliminar={() => eliminar(actDetalle.id)}
          onCerrar={() => setDetalleAbierto(false)}
        />
      )}
    </div>
  )
}

// ── Vista Mes ─────────────────────────────────────────────────────────────────
function VistaMes({ fechaRef, actividades, onDiaClick, onActClick, puedeCrear }) {
  const hoy = isoFecha(new Date())
  const año  = fechaRef.getFullYear()
  const mes  = fechaRef.getMonth()

  const primerDia  = new Date(año, mes, 1)
  const ultimoDia  = new Date(año, mes + 1, 0)
  const offsetInicio = primerDia.getDay()

  const dias = []
  for (let i = 0; i < offsetInicio; i++) dias.push(null)
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(año, mes, d))

  function actsDia(fecha) {
    const iso = isoFecha(fecha)
    return actividades.filter(a => a.fecha_inicio === iso || (a.fecha_termino && a.fecha_termino >= iso && a.fecha_inicio <= iso))
  }

  return (
    <div style={s.mesGrid}>
      {DIAS.map(d => (
        <div key={d} style={s.mesCabDia}>{d}</div>
      ))}
      {dias.map((fecha, i) => {
        if (!fecha) return <div key={`e${i}`} style={s.mesCeldaVacia} />
        const iso = isoFecha(fecha)
        const acts = actsDia(fecha)
        const esHoy = iso === hoy
        return (
          <div
            key={iso}
            style={{ ...s.mesCelda, background: esHoy ? '#EFF6FF' : '#fff', border: esHoy ? '2px solid var(--azul)' : '1px solid var(--borde)' }}
            onClick={() => puedeCrear && onDiaClick(iso)}
          >
            <div style={{ ...s.mesDiaNum, color: esHoy ? 'var(--azul)' : '#334155', fontWeight: esHoy ? 800 : 400 }}>
              {fecha.getDate()}
            </div>
            {acts.slice(0,3).map(a => (
              <div
                key={a.id}
                onClick={e => { e.stopPropagation(); onActClick(a) }}
                style={{ ...s.mesChip, background: ESTADO_COLOR[a.estado] || '#1E4D7B' }}
                title={`${a.titulo} — ${a.cliente || ''}`}
              >
                {fmtHora(a.hora_inicio)} {a.titulo}
              </div>
            ))}
            {acts.length > 3 && (
              <div style={{ fontSize:10, color:'var(--gris)', marginTop:2 }}>+{acts.length - 3} más</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Vista Semana ──────────────────────────────────────────────────────────────
function VistaSemana({ fechaRef, actividades, onDiaClick, onActClick, puedeCrear }) {
  const hoy = isoFecha(new Date())
  // Obtener lunes de la semana
  const dia  = fechaRef.getDay()
  const lunes = new Date(fechaRef)
  lunes.setDate(lunes.getDate() - (dia === 0 ? 6 : dia - 1))

  const diasSemana = Array.from({ length:7 }, (_, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d
  })

  return (
    <div style={s.semanaGrid}>
      {diasSemana.map(fecha => {
        const iso = isoFecha(fecha)
        const acts = actividades.filter(a => a.fecha_inicio === iso)
        const esHoy = iso === hoy
        return (
          <div key={iso} style={{ ...s.semanaCelda, border: esHoy ? '2px solid var(--azul)' : '1px solid var(--borde)', background: esHoy ? '#EFF6FF' : '#fff' }}>
            <div style={{ ...s.semanaCabDia, color: esHoy ? 'var(--azul)' : '#334155' }}>
              {DIAS[fecha.getDay()]} {fecha.getDate()}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {acts.map(a => (
                <div
                  key={a.id}
                  onClick={() => onActClick(a)}
                  style={{ ...s.semanaChip, background: ESTADO_COLOR[a.estado] || '#1E4D7B' }}
                >
                  <div style={{ fontWeight:700, fontSize:10 }}>{fmtHora(a.hora_inicio)}</div>
                  <div style={{ fontSize:11, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{a.titulo}</div>
                  {a.cliente && <div style={{ fontSize:10, opacity:0.85 }}>{a.cliente}</div>}
                </div>
              ))}
              {puedeCrear && (
                <button
                  onClick={() => onDiaClick(iso)}
                  style={{ fontSize:10, color:'var(--gris)', background:'none', border:'1px dashed var(--borde)', borderRadius:4, padding:'2px 4px', cursor:'pointer', marginTop:2 }}
                >
                  + Agregar
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Vista Día ─────────────────────────────────────────────────────────────────
function VistaDia({ fechaRef, actividades, onActClick, onNuevo, puedeCrear }) {
  const iso  = isoFecha(fechaRef)
  const acts = actividades.filter(a => a.fecha_inicio === iso)

  return (
    <div style={{ padding:'16px 0' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h3 style={{ margin:0 }}>
          {DIAS[fechaRef.getDay()]}, {fechaRef.getDate()} de {MESES[fechaRef.getMonth()]}
        </h3>
        {puedeCrear && (
          <button className="btn btn-secondary btn-sm" onClick={onNuevo}>+ Agregar actividad</button>
        )}
      </div>
      {acts.length === 0 ? (
        <p style={{ color:'var(--gris)', fontSize:13 }}>Sin actividades para este día.</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {acts.map(a => (
            <div
              key={a.id}
              onClick={() => onActClick(a)}
              style={{ ...s.diaCard, borderLeft:`4px solid ${ESTADO_COLOR[a.estado] || '#1E4D7B'}` }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{a.titulo}</div>
                  {a.cliente && <div style={{ color:'var(--gris)', fontSize:12 }}>{a.cliente}</div>}
                </div>
                <span style={{ ...s.estadoBadge, background: ESTADO_COLOR[a.estado] || '#1E4D7B' }}>
                  {a.estado}
                </span>
              </div>
              <div style={{ display:'flex', gap:16, marginTop:6, fontSize:12, color:'#475569' }}>
                {(a.hora_inicio || a.hora_termino) && (
                  <span>🕐 {fmtHora(a.hora_inicio)}{a.hora_termino ? ` – ${fmtHora(a.hora_termino)}` : ''}</span>
                )}
                {a.ubicacion && <span>📍 {a.ubicacion}</span>}
                {a.ot_numero && <span>OT: {a.ot_numero}</span>}
                {a.responsable_nombre && <span>👤 {a.responsable_nombre}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card compacto de actividad ────────────────────────────────────────────────
function CardActividad({ act, onClick }) {
  return (
    <div onClick={onClick} style={{ ...s.diaCard, cursor:'pointer', borderLeft:`4px solid ${ESTADO_COLOR[act.estado] || '#1E4D7B'}`, padding:'8px 12px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:13 }}>{act.titulo}</div>
          <div style={{ fontSize:11, color:'var(--gris)' }}>
            {fmtFecha(act.fecha_inicio)}{act.hora_inicio ? ` ${fmtHora(act.hora_inicio)}` : ''} · {act.cliente || ''}
          </div>
        </div>
        <span style={{ ...s.estadoBadge, fontSize:10, background: ESTADO_COLOR[act.estado] || '#1E4D7B' }}>
          {act.estado}
        </span>
      </div>
    </div>
  )
}

// ── Modal crear / editar actividad ───────────────────────────────────────────
function ModalActividad({ actividad, fechaInicio, usuario, onGuardado, onCerrar }) {
  const esEdicion = !!actividad
  const [form, setForm] = useState({
    titulo:              actividad?.titulo || '',
    descripcion:         actividad?.descripcion || '',
    ot_numero:           actividad?.ot_numero || '',
    cliente:             actividad?.cliente || '',
    sede:                actividad?.sede || '',
    area_servicio:       actividad?.area_servicio || '',
    tipo_servicio:       actividad?.tipo_servicio || '',
    ubicacion:           actividad?.ubicacion || '',
    fecha_inicio:        actividad?.fecha_inicio || fechaInicio,
    fecha_termino:       actividad?.fecha_termino || '',
    hora_inicio:         actividad?.hora_inicio ? actividad.hora_inicio.substring(0,5) : '',
    hora_termino:        actividad?.hora_termino ? actividad.hora_termino.substring(0,5) : '',
    responsable_nombre:  actividad?.responsable_nombre || '',
    responsable_email:   actividad?.responsable_email || '',
    inspector_nombre:    actividad?.inspector_nombre || '',
    inspector_email:     actividad?.inspector_email || '',
    estado:              actividad?.estado || 'Programada',
    observaciones:       actividad?.observaciones || '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const [ots, setOts]             = useState([])

  useEffect(() => {
    // Cargar OTs para selector
    supabase.from('ots').select('ot_numero, cliente, estado').order('fecha_creacion', { ascending:false }).limit(100)
      .then(({ data }) => setOts(data || []))
  }, [])

  // Autocompletar cliente desde OT
  useEffect(() => {
    if (form.ot_numero) {
      const ot = ots.find(o => o.ot_numero === form.ot_numero)
      if (ot) setForm(f => ({ ...f, cliente: ot.cliente || f.cliente }))
    }
  }, [form.ot_numero, ots])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    if (!form.fecha_inicio)  { setError('La fecha de inicio es obligatoria'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        ...form,
        hora_inicio:  form.hora_inicio  || null,
        hora_termino: form.hora_termino || null,
        fecha_termino: form.fecha_termino || null,
        ot_numero:    form.ot_numero    || null,
        updated_by:   usuario?.email,
      }
      if (esEdicion) {
        const { error } = await supabase.from('actividades_calendario').update(payload).eq('id', actividad.id)
        if (error) throw error
      } else {
        payload.created_by = usuario?.email
        const { error } = await supabase.from('actividades_calendario').insert(payload)
        if (error) throw error
      }
      onGuardado()
    } catch (e) { setError(e.message) } finally { setGuardando(false) }
  }

  return (
    <div style={s.overlay} onClick={onCerrar}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={{ margin:0, fontSize:17 }}>{esEdicion ? '✏️ Editar actividad' : '+ Nueva actividad'}</h2>
          <button onClick={onCerrar} style={s.btnX}>✕</button>
        </div>

        {error && <div className="alert alert-error" style={{ margin:'0 0 12px' }}>{error}</div>}

        <div style={s.modalBody}>
          {/* Título */}
          <div className="field">
            <label>Título <span style={{ color:'red' }}>*</span></label>
            <input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Inspección válvulas — Cliente X" />
          </div>

          {/* OT */}
          <div className="field">
            <label>Orden de Trabajo asociada</label>
            <select className="select" value={form.ot_numero} onChange={e => set('ot_numero', e.target.value)}>
              <option value="">Sin OT asociada</option>
              {ots.map(o => <option key={o.ot_numero} value={o.ot_numero}>{o.ot_numero} — {o.cliente}</option>)}
            </select>
          </div>

          <div style={s.grid2}>
            {/* Cliente */}
            <div className="field">
              <label>Cliente</label>
              <input className="input" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
            </div>
            {/* Sede */}
            <div className="field">
              <label>Sede</label>
              <select className="select" value={form.sede} onChange={e => set('sede', e.target.value)}>
                <option value="">— Sede —</option>
                {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={s.grid2}>
            <div className="field">
              <label>Área de servicio</label>
              <input className="input" value={form.area_servicio} onChange={e => set('area_servicio', e.target.value)} placeholder="END, Izaje, Trazabilidad..." />
            </div>
            <div className="field">
              <label>Tipo de servicio</label>
              <input className="input" value={form.tipo_servicio} onChange={e => set('tipo_servicio', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Ubicación / Instalación</label>
            <input className="input" value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} placeholder="Dirección o nombre de instalación" />
          </div>

          <div style={s.grid2}>
            <div className="field">
              <label>Fecha inicio <span style={{ color:'red' }}>*</span></label>
              <input className="input" type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div className="field">
              <label>Fecha término</label>
              <input className="input" type="date" value={form.fecha_termino} onChange={e => set('fecha_termino', e.target.value)} />
            </div>
          </div>

          <div style={s.grid2}>
            <div className="field">
              <label>Hora inicio</label>
              <input className="input" type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} />
            </div>
            <div className="field">
              <label>Hora término</label>
              <input className="input" type="time" value={form.hora_termino} onChange={e => set('hora_termino', e.target.value)} />
            </div>
          </div>

          <div style={s.grid2}>
            <div className="field">
              <label>Responsable</label>
              <input className="input" value={form.responsable_nombre} onChange={e => set('responsable_nombre', e.target.value)} placeholder="Nombre del responsable" />
            </div>
            <div className="field">
              <label>Inspector</label>
              <input className="input" value={form.inspector_nombre} onChange={e => set('inspector_nombre', e.target.value)} placeholder="Nombre del inspector" />
            </div>
          </div>

          <div className="field">
            <label>Estado</label>
            <select className="select" value={form.estado} onChange={e => set('estado', e.target.value)}>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Observaciones</label>
            <textarea
              className="input"
              rows={3}
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              style={{ resize:'vertical', fontFamily:'inherit' }}
            />
          </div>
        </div>

        <div style={s.modalFooter}>
          <button className="btn btn-secondary" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? '⏳ Guardando...' : (esEdicion ? '💾 Guardar cambios' : '✅ Crear actividad')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal detalle ─────────────────────────────────────────────────────────────
function ModalDetalle({ act, puedeEditar, onEditar, onEliminar, onCerrar }) {
  return (
    <div style={s.overlay} onClick={onCerrar}>
      <div style={{ ...s.modal, maxWidth:480 }} onClick={e => e.stopPropagation()}>
        <div style={{ ...s.modalHeader, borderBottom:`3px solid ${ESTADO_COLOR[act.estado] || '#1E4D7B'}` }}>
          <h2 style={{ margin:0, fontSize:16 }}>{act.titulo}</h2>
          <button onClick={onCerrar} style={s.btnX}>✕</button>
        </div>
        <div style={s.modalBody}>
          <span style={{ ...s.estadoBadge, background: ESTADO_COLOR[act.estado] || '#1E4D7B', display:'inline-block', marginBottom:12 }}>
            {act.estado}
          </span>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px', fontSize:13 }}>
            <Fila label="Fecha inicio" val={fmtFecha(act.fecha_inicio)} />
            <Fila label="Fecha término" val={fmtFecha(act.fecha_termino)} />
            <Fila label="Hora" val={`${fmtHora(act.hora_inicio) || '—'} ${act.hora_termino ? '→ ' + fmtHora(act.hora_termino) : ''}`} />
            <Fila label="Sede" val={act.sede} />
            <Fila label="Cliente" val={act.cliente} />
            <Fila label="OT" val={act.ot_numero} />
            <Fila label="Área" val={act.area_servicio} />
            <Fila label="Tipo servicio" val={act.tipo_servicio} />
            <Fila label="Ubicación" val={act.ubicacion} />
            <Fila label="Responsable" val={act.responsable_nombre} />
            <Fila label="Inspector" val={act.inspector_nombre} />
          </div>
          {act.descripcion && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gris)', textTransform:'uppercase', marginBottom:4 }}>Descripción</div>
              <p style={{ fontSize:13, margin:0 }}>{act.descripcion}</p>
            </div>
          )}
          {act.observaciones && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gris)', textTransform:'uppercase', marginBottom:4 }}>Observaciones</div>
              <p style={{ fontSize:13, margin:0 }}>{act.observaciones}</p>
            </div>
          )}
          <div style={{ fontSize:10, color:'var(--gris)', marginTop:12 }}>
            Creado: {act.created_at ? new Date(act.created_at).toLocaleString('es-CL') : '—'} · {act.created_by || ''}
          </div>
        </div>
        {puedeEditar && (
          <div style={s.modalFooter}>
            <button className="btn btn-danger btn-sm" onClick={onEliminar}>🗑 Cancelar actividad</button>
            <button className="btn btn-primary btn-sm" onClick={onEditar}>✏️ Editar</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Fila({ label, val }) {
  if (!val) return null
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--gris)', textTransform:'uppercase' }}>{label}</div>
      <div style={{ marginTop:2 }}>{val}</div>
    </div>
  )
}

// ── Helpers de rango ──────────────────────────────────────────────────────────
function getRango(vista, ref) {
  const d = new Date(ref)
  if (vista === 'dia') {
    return { inicio: d, fin: d }
  } else if (vista === 'semana') {
    const dow = d.getDay()
    const lun = new Date(d); lun.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const dom = new Date(lun); dom.setDate(lun.getDate() + 6)
    return { inicio: lun, fin: dom }
  } else {
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
    const fin    = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { inicio, fin }
  }
}

function moverFecha(fecha, delta, vista) {
  const d = new Date(fecha)
  if (vista === 'dia')    d.setDate(d.getDate() + delta)
  if (vista === 'semana') d.setDate(d.getDate() + delta * 7)
  if (vista === 'mes')    d.setMonth(d.getMonth() + delta)
  return d
}

function getLabelFecha(vista, ref) {
  if (vista === 'dia')
    return `${DIAS[ref.getDay()]} ${ref.getDate()} de ${MESES[ref.getMonth()]} ${ref.getFullYear()}`
  if (vista === 'semana') {
    const dow = ref.getDay()
    const lun = new Date(ref); lun.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1))
    const dom = new Date(lun); dom.setDate(lun.getDate() + 6)
    return `${lun.getDate()} ${MESES[lun.getMonth()].substring(0,3)} – ${dom.getDate()} ${MESES[dom.getMonth()].substring(0,3)} ${dom.getFullYear()}`
  }
  return `${MESES[ref.getMonth()]} ${ref.getFullYear()}`
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = {
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 },
  filtrosBar: { display:'flex', gap:8, flexWrap:'wrap', marginBottom:8, padding:'10px 0' },
  navBar: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderTop:'1px solid var(--borde)', borderBottom:'1px solid var(--borde)', marginBottom:8 },

  mesGrid: { display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:16 },
  mesCabDia: { textAlign:'center', fontSize:11, fontWeight:700, color:'var(--gris)', padding:'4px 0', textTransform:'uppercase' },
  mesCeldaVacia: { minHeight:90, background:'#F8FAFC', borderRadius:4 },
  mesCelda: { minHeight:90, borderRadius:4, padding:4, cursor:'pointer', transition:'box-shadow .15s' },
  mesDiaNum: { fontSize:12, marginBottom:3 },
  mesChip: { fontSize:10, color:'#fff', borderRadius:3, padding:'1px 4px', marginBottom:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' },

  semanaGrid: { display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:16 },
  semanaCelda: { borderRadius:6, padding:6, minHeight:120 },
  semanaCabDia: { fontSize:12, fontWeight:700, marginBottom:6, textAlign:'center' },
  semanaChip: { color:'#fff', borderRadius:4, padding:'4px 6px', cursor:'pointer', marginBottom:3 },

  diaCard: { background:'#fff', border:'1px solid var(--borde)', borderRadius:6, padding:'10px 14px', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,.05)' },

  listaPanel: { background:'#F8FAFC', borderRadius:8, padding:'14px 16px', marginTop:12 },

  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
  modal: { background:'#fff', borderRadius:12, maxWidth:640, width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.3)' },
  modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid var(--borde)' },
  modalBody: { padding:'16px 20px', overflowY:'auto', flex:1 },
  modalFooter: { padding:'12px 20px', borderTop:'1px solid var(--borde)', display:'flex', justifyContent:'flex-end', gap:8 },
  btnX: { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--gris)', padding:4 },
  estadoBadge: { color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' },
}
