// ============================================================
// Calendario.jsx — Módulo de Actividades WSS
// Vistas: mes / semana / día
// Muestra actividades manuales + OTs del sistema (sin duplicar)
// ============================================================
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ── Constantes ───────────────────────────────────────────────
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const SEDES  = ['Santiago','Antofagasta','Valparaíso','Concepción','Otras']
const ESTADOS = ['Programada','En proceso','Completada','Cancelada','Postergada']

const ESTADO_COLOR = {
  'Programada':   '#3B82F6',
  'En proceso':   '#F59E0B',
  'Completada':   '#10B981',
  'Cancelada':    '#EF4444',
  'Postergada':   '#8B5CF6',
  // OT states
  'Pendiente':    '#6B7280',
  'Asignado':     '#F59E0B',
  'Inspeccionado':'#3B82F6',
  'Cerrado':      '#10B981',
  'OT':           '#1E4D7B',
}

// Map de estados OT → color del calendario
const OT_ESTADO_MAP = {
  'Pendiente de asignación': 'Programada',
  'Pendiente':               'Programada',
  'Sin inspector':           'Programada',
  'Asignado':                'En proceso',
  'En proceso':              'En proceso',
  'Acta cargada':            'En proceso',
  'Informe cargado':         'Completada',
  'Cerrada documentalmente': 'Completada',
  'Cancelada':               'Cancelada',
}

// ── Helpers ──────────────────────────────────────────────────
function toISO(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? iso : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function fmtHora(t) {
  if (!t) return ''
  return t.slice(0, 5)
}

function mismaFecha(isoA, dateB) {
  return isoA && isoA.slice(0, 10) === dateB.toISOString().slice(0, 10)
}

// ── Componente principal ──────────────────────────────────────
export default function Calendario() {
  const { usuario, esAdmin, esSupervisor, esComercial } = useAuth()
  const puedeEditar = esAdmin() || esSupervisor() || esComercial()

  const [actividades, setActividades] = useState([])
  const [ots, setOts]                 = useState([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState('')

  const [vista, setVista]           = useState('mes')
  const [fechaRef, setFechaRef]     = useState(new Date())
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroTexto, setFiltroTexto] = useState('')

  const [modalAbierto, setModalAbierto]   = useState(false)
  const [detalleAbierto, setDetalleAbierto] = useState(false)
  const [actDetalle, setActDetalle]       = useState(null)
  const [actEditar, setActEditar]         = useState(null)
  const [fechaInicial, setFechaInicial]   = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      setCargando(true)
      setError('')

      const [{ data: acts, error: e1 }, { data: otsData, error: e2 }] = await Promise.all([
        supabase.from('actividades_calendario').select('*').order('fecha_inicio'),
        supabase.from('v_portal_ots_listado').select('*').limit(500),
      ])

      if (e1) console.warn('actividades_calendario:', e1.message)
      if (e2) console.warn('v_portal_ots_listado:', e2.message)

      setActividades(acts || [])

      // OTs → pseudo-actividades
      // Excluir OTs que ya tienen actividad manual creada
      const otNumerosConAct = new Set(
        (acts || []).filter(a => a.ot_numero).map(a => a.ot_numero)
      )

      const pseudoOTs = (otsData || [])
        .filter(ot => !otNumerosConAct.has(ot.ot_numero))
        .map(ot => {
          const fechaEfectiva = toISO(
            ot.fecha_programacion || ot.fecha_inspeccion || ot.fecha_ejecucion ||
            ot.fecha_inicio || ot.fecha_termino || ot.fecha_cierre || ot.fecha_creacion
          )
          if (!fechaEfectiva) return null
          return {
            id:                `ot-${ot.ot_numero}`,
            es_ot:             true,
            ot_numero:         ot.ot_numero,
            titulo:            `OT ${ot.ot_numero} — ${ot.cliente || ''}`,
            fecha_inicio:      fechaEfectiva,
            fecha_termino:     fechaEfectiva,
            estado:            OT_ESTADO_MAP[ot.estado] || 'Programada',
            cliente:           ot.cliente,
            sede:              ot.sede,
            area_servicio:     ot.tipo_servicio || ot.producto_servicio_contratado,
            tipo_servicio:     ot.tipo_servicio || ot.producto_servicio_contratado,
            responsable_nombre: ot.inspector || ot.supervisor,
            inspector_nombre:   ot.inspector,
          }
        })
        .filter(Boolean)

      setOts(pseudoOTs)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  // Combinar actividades manuales + OTs
  const todasLasActs = useMemo(() => {
    return [...actividades, ...ots]
  }, [actividades, ots])

  // Filtrar
  const actsFiltradas = useMemo(() => {
    return todasLasActs.filter(a => {
      if (filtroSede  && a.sede !== filtroSede)               return false
      if (filtroTexto && !`${a.titulo} ${a.cliente || ''}`.toLowerCase().includes(filtroTexto.toLowerCase())) return false
      return true
    })
  }, [todasLasActs, filtroSede, filtroTexto])

  // Navegar entre períodos
  function navegar(delta) {
    setFechaRef(prev => {
      const d = new Date(prev)
      if (vista === 'mes')    d.setMonth(d.getMonth() + delta)
      if (vista === 'semana') d.setDate(d.getDate() + delta * 7)
      if (vista === 'dia')    d.setDate(d.getDate() + delta)
      return d
    })
  }

  function irHoy() { setFechaRef(new Date()) }

  function getRango(v, ref) {
    const d = new Date(ref)
    if (v === 'mes') return {
      inicio: new Date(d.getFullYear(), d.getMonth(), 1),
      fin:    new Date(d.getFullYear(), d.getMonth() + 1, 0),
    }
    if (v === 'semana') {
      const ini = new Date(d); ini.setDate(d.getDate() - d.getDay())
      const fin = new Date(ini); fin.setDate(ini.getDate() + 6)
      return { inicio: ini, fin }
    }
    return { inicio: d, fin: d }
  }

  function getLabelFecha() {
    if (vista === 'mes') return `${MESES[fechaRef.getMonth()]} ${fechaRef.getFullYear()}`
    if (vista === 'semana') {
      const { inicio, fin } = getRango('semana', fechaRef)
      return `${inicio.getDate()}/${inicio.getMonth()+1} – ${fin.getDate()}/${fin.getMonth()+1}/${fin.getFullYear()}`
    }
    return `${DIAS[fechaRef.getDay()]} ${fechaRef.getDate()} de ${MESES[fechaRef.getMonth()]} ${fechaRef.getFullYear()}`
  }

  function actsEnFecha(fecha) {
    const iso = fecha.toISOString().slice(0, 10)
    return actsFiltradas.filter(a => a.fecha_inicio && a.fecha_inicio.slice(0,10) === iso)
  }

  function abrirNueva(fecha) {
    if (!puedeEditar) return
    setActEditar(null)
    setFechaInicial(fecha ? fecha.toISOString().slice(0, 10) : '')
    setModalAbierto(true)
  }

  function abrirEditar(act) {
    if (!puedeEditar || act.es_ot) return
    setActEditar(act)
    setFechaInicial(act.fecha_inicio || '')
    setModalAbierto(true)
  }

  function abrirDetalle(act) {
    setActDetalle(act)
    setDetalleAbierto(true)
  }

  async function eliminarAct(act) {
    if (!act || act.es_ot) return
    if (!confirm('¿Eliminar esta actividad?')) return
    await supabase.from('actividades_calendario').delete().eq('id', act.id)
    await cargarDatos()
  }

  if (cargando) return (
    <div style={{ padding: 32 }}>
      <div className="loading-bar" />
      <p style={{ color: 'var(--gris)', marginTop: 16 }}>Cargando calendario…</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={s.topBar}>
        {/* Controles de vista */}
        <div style={s.vistaBtns}>
          {['mes','semana','dia'].map(v => (
            <button key={v} style={{...s.vBtn, ...(vista===v ? s.vBtnActive : {})}}
              onClick={() => setVista(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Navegación fecha */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button style={s.navBtn} onClick={() => navegar(-1)}>‹</button>
          <span style={{ fontWeight:700, fontSize:16, minWidth:220, textAlign:'center' }}>
            {getLabelFecha()}
          </span>
          <button style={s.navBtn} onClick={() => navegar(1)}>›</button>
          <button style={s.hoyBtn} onClick={irHoy}>Hoy</button>
        </div>

        {/* Nueva actividad */}
        {puedeEditar && (
          <button style={s.newBtn} onClick={() => abrirNueva(null)}>+ Nueva actividad</button>
        )}
      </div>

      {/* Filtros */}
      <div style={s.filtros}>
        <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} style={s.filtroSelect}>
          <option value="">Todas las sedes</option>
          {SEDES.map(se => <option key={se} value={se}>{se}</option>)}
        </select>
        <input
          placeholder="Buscar actividad, cliente…"
          value={filtroTexto}
          onChange={e => setFiltroTexto(e.target.value)}
          style={s.filtroInput}
        />
        {(filtroSede || filtroTexto) && (
          <button style={s.hoyBtn} onClick={() => { setFiltroSede(''); setFiltroTexto('') }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Error */}
      {error && <div style={s.errorBox}>⚠ {error}</div>}

      {/* Leyenda */}
      <div style={s.leyenda}>
        {ESTADOS.map(et => (
          <div key={et} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:10, height:10, borderRadius:3, background: ESTADO_COLOR[et] || '#888' }} />
            <span style={{ fontSize:11, color:'#6B7380' }}>{et}</span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:10, height:10, borderRadius:3, background: '#1E4D7B' }} />
          <span style={{ fontSize:11, color:'#6B7380' }}>OT del sistema</span>
        </div>
      </div>

      {/* Vista calendario */}
      {vista === 'mes'    && <VistaMes    fechaRef={fechaRef} acts={actsFiltradas} onClickFecha={abrirNueva} onClickAct={abrirDetalle} />}
      {vista === 'semana' && <VistaSemana fechaRef={fechaRef} acts={actsFiltradas} onClickFecha={abrirNueva} onClickAct={abrirDetalle} />}
      {vista === 'dia'    && <VistaDia    fechaRef={fechaRef} acts={actsFiltradas} onClickAct={abrirDetalle} />}

      {/* Modal editar/crear */}
      {modalAbierto && (
        <ModalEditar
          act={actEditar}
          fechaInicial={fechaInicial}
          usuario={usuario}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => { setModalAbierto(false); cargarDatos() }}
        />
      )}

      {/* Modal detalle */}
      {detalleAbierto && actDetalle && (
        <ModalDetalle
          act={actDetalle}
          puedeEditar={puedeEditar}
          onCerrar={() => setDetalleAbierto(false)}
          onEditar={() => { setDetalleAbierto(false); abrirEditar(actDetalle) }}
          onEliminar={() => { setDetalleAbierto(false); eliminarAct(actDetalle) }}
        />
      )}
    </div>
  )
}

// ── Vista Mes ─────────────────────────────────────────────────
function VistaMes({ fechaRef, acts, onClickFecha, onClickAct }) {
  const year  = fechaRef.getFullYear()
  const month = fechaRef.getMonth()
  const primerDia = new Date(year, month, 1).getDay()
  const diasMes   = new Date(year, month + 1, 0).getDate()

  const celdas = []
  for (let i = 0; i < primerDia; i++) celdas.push(null)
  for (let d = 1; d <= diasMes; d++) celdas.push(new Date(year, month, d))

  const semanas = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))

  return (
    <div style={{ overflowX:'auto' }}>
      <table style={s.mesTable}>
        <thead>
          <tr>
            {DIAS.map(d => <th key={d} style={s.mesTh}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {semanas.map((sem, si) => (
            <tr key={si}>
              {sem.map((fecha, di) => {
                if (!fecha) return <td key={di} style={s.mesTdVacio} />
                const esHoy = fecha.toDateString() === new Date().toDateString()
                const actsDelDia = acts.filter(a => a.fecha_inicio && a.fecha_inicio.slice(0,10) === fecha.toISOString().slice(0,10))
                return (
                  <td key={di} style={s.mesTd} onClick={() => onClickFecha(fecha)}>
                    <div style={{
                      ...s.mesDiaNum,
                      color: esHoy ? '#fff' : '#6B7380',
                      background: esHoy ? '#1E4D7B' : 'transparent',
                      borderRadius: '50%',
                      width: 22, height: 22,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      marginLeft:'auto',
                    }}>
                      {fecha.getDate()}
                    </div>
                    <div style={s.mesCeldaActs}>
                      {actsDelDia.slice(0, 3).map(a => (
                        <span
                          key={a.id}
                          style={{
                            ...s.chip,
                            background: a.es_ot ? '#1E4D7B' : (ESTADO_COLOR[a.estado] || '#888'),
                          }}
                          onClick={ev => { ev.stopPropagation(); onClickAct(a) }}
                          title={a.titulo}
                        >
                          {a.es_ot ? `OT ${a.ot_numero}` : a.titulo}
                        </span>
                      ))}
                      {actsDelDia.length > 3 && (
                        <span style={{ ...s.chip, background:'#9CA3AF' }}>
                          +{actsDelDia.length - 3} más
                        </span>
                      )}
                    </div>
                  </td>
                )
              })}
              {sem.length < 7 && Array(7 - sem.length).fill(null).map((_, i) => (
                <td key={`empty-${i}`} style={s.mesTdVacio} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Vista Semana ──────────────────────────────────────────────
function VistaSemana({ fechaRef, acts, onClickFecha, onClickAct }) {
  const inicio = new Date(fechaRef)
  inicio.setDate(fechaRef.getDate() - fechaRef.getDay())

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    return d
  })

  return (
    <div style={{ display:'grid', gap:8, marginTop:12 }}>
      {dias.map((fecha, i) => {
        const esHoy = fecha.toDateString() === new Date().toDateString()
        const actsDelDia = acts.filter(a => a.fecha_inicio && a.fecha_inicio.slice(0,10) === fecha.toISOString().slice(0,10))
        return (
          <div key={i} style={s.diaSemanaRow}>
            <div
              style={{
                ...s.diaSemanaHeader,
                background: esHoy ? '#1E4D7B' : '#F9FAFB',
                color: esHoy ? '#fff' : '#1F2937',
                cursor:'pointer',
              }}
              onClick={() => onClickFecha(fecha)}
            >
              {DIAS[fecha.getDay()]} {fecha.getDate()} de {MESES[fecha.getMonth()]}
            </div>
            <div style={s.diaSemanaCelda}>
              {actsDelDia.length === 0
                ? <span style={s.vacio}>Sin actividades</span>
                : actsDelDia.map(a => (
                    <span
                      key={a.id}
                      style={{
                        ...s.chip,
                        background: a.es_ot ? '#1E4D7B' : (ESTADO_COLOR[a.estado] || '#888'),
                        fontSize:12, padding:'4px 10px',
                      }}
                      onClick={() => onClickAct(a)}
                    >
                      {a.hora_inicio ? fmtHora(a.hora_inicio) + ' ' : ''}{a.es_ot ? `OT ${a.ot_numero} — ${a.cliente || ''}` : a.titulo}
                    </span>
                  ))
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Vista Día ─────────────────────────────────────────────────
function VistaDia({ fechaRef, acts, onClickAct }) {
  const iso = fechaRef.toISOString().slice(0, 10)
  const actsDelDia = acts.filter(a => a.fecha_inicio && a.fecha_inicio.slice(0,10) === iso)

  return (
    <div style={{ ...s.diaContainer, marginTop:16 }}>
      <div style={s.diaTitulo}>
        {DIAS[fechaRef.getDay()]}, {fechaRef.getDate()} de {MESES[fechaRef.getMonth()]} {fechaRef.getFullYear()}
      </div>
      {actsDelDia.length === 0
        ? <div style={s.vacio}>Sin actividades para este día</div>
        : actsDelDia.map(a => (
            <div
              key={a.id}
              style={{
                ...s.card,
                background: a.es_ot ? '#1E4D7B' : (ESTADO_COLOR[a.estado] || '#888'),
              }}
              onClick={() => onClickAct(a)}
            >
              <div style={s.cardTitulo}>{a.es_ot ? `OT ${a.ot_numero} — ${a.cliente}` : a.titulo}</div>
              {(a.hora_inicio || a.hora_termino) && (
                <div style={s.cardHora}>
                  {fmtHora(a.hora_inicio)}{a.hora_termino ? ` – ${fmtHora(a.hora_termino)}` : ''}
                </div>
              )}
              {a.responsable_nombre && (
                <div style={s.cardResp}>👤 {a.responsable_nombre}</div>
              )}
            </div>
          ))
      }
    </div>
  )
}

// ── Modal Crear / Editar ──────────────────────────────────────
function ModalEditar({ act, fechaInicial, usuario, onCerrar, onGuardado }) {
  const esNueva = !act

  const [form, setForm] = useState({
    titulo:              act?.titulo || '',
    fecha_inicio:        act?.fecha_inicio?.slice(0,10) || fechaInicial || '',
    fecha_termino:       act?.fecha_termino?.slice(0,10) || '',
    hora_inicio:         act?.hora_inicio || '',
    hora_termino:        act?.hora_termino || '',
    estado:              act?.estado || 'Programada',
    sede:                act?.sede || '',
    cliente:             act?.cliente || '',
    area_servicio:       act?.area_servicio || '',
    tipo_servicio:       act?.tipo_servicio || '',
    ubicacion:           act?.ubicacion || '',
    responsable_nombre:  act?.responsable_nombre || (usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() : ''),
    observaciones:       act?.observaciones || '',
  })

  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function guardar() {
    if (!form.titulo.trim())     return setErr('El título es obligatorio')
    if (!form.fecha_inicio)      return setErr('La fecha de inicio es obligatoria')
    setErr('')
    setGuardando(true)
    try {
      const payload = { ...form }
      if (esNueva) {
        const { error } = await supabase.from('actividades_calendario').insert([payload])
        if (error) throw error
      } else {
        const { error } = await supabase.from('actividades_calendario').update(payload).eq('id', act.id)
        if (error) throw error
      }
      onGuardado()
    } catch (e) {
      setErr(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={s.modalOverlay}>
      <div style={s.modalBox}>
        <div style={s.modalHeader}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>
            {esNueva ? 'Nueva actividad' : 'Editar actividad'}
          </h3>
          <button style={s.closeBtn} onClick={onCerrar}>✕</button>
        </div>
        <div style={{ ...s.modalBody, overflowY:'auto', maxHeight:'70vh' }}>
          {err && <div style={s.errorBox}>{err}</div>}

          <div style={s.fila}>
            <label style={s.label}>Título *</label>
            <input value={form.titulo} onChange={e => setF('titulo', e.target.value)} style={s.input} placeholder="Ej: Inspección cliente X" />
          </div>

          <div style={{ ...s.fila, display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={s.label}>Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} style={s.input} />
            </div>
            <div style={{ flex:1 }}>
              <label style={s.label}>Fecha término</label>
              <input type="date" value={form.fecha_termino} onChange={e => setF('fecha_termino', e.target.value)} style={s.input} />
            </div>
          </div>

          <div style={{ ...s.fila, display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={s.label}>Hora inicio</label>
              <input type="time" value={form.hora_inicio} onChange={e => setF('hora_inicio', e.target.value)} style={s.input} />
            </div>
            <div style={{ flex:1 }}>
              <label style={s.label}>Hora término</label>
              <input type="time" value={form.hora_termino} onChange={e => setF('hora_termino', e.target.value)} style={s.input} />
            </div>
          </div>

          <div style={s.fila}>
            <label style={s.label}>Estado</label>
            <select value={form.estado} onChange={e => setF('estado', e.target.value)} style={s.input}>
              {ESTADOS.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          </div>

          <div style={s.fila}>
            <label style={s.label}>Sede</label>
            <select value={form.sede} onChange={e => setF('sede', e.target.value)} style={s.input}>
              <option value="">— seleccionar —</option>
              {SEDES.map(se => <option key={se} value={se}>{se}</option>)}
            </select>
          </div>

          <div style={s.fila}>
            <label style={s.label}>Cliente</label>
            <input value={form.cliente} onChange={e => setF('cliente', e.target.value)} style={s.input} />
          </div>

          <div style={s.fila}>
            <label style={s.label}>Tipo de servicio</label>
            <input value={form.tipo_servicio} onChange={e => setF('tipo_servicio', e.target.value)} style={s.input} />
          </div>

          <div style={s.fila}>
            <label style={s.label}>Ubicación</label>
            <input value={form.ubicacion} onChange={e => setF('ubicacion', e.target.value)} style={s.input} />
          </div>

          <div style={s.fila}>
            <label style={s.label}>Responsable</label>
            <input value={form.responsable_nombre} onChange={e => setF('responsable_nombre', e.target.value)} style={s.input} />
          </div>

          <div style={s.fila}>
            <label style={s.label}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setF('observaciones', e.target.value)}
              style={{ ...s.input, height:80, resize:'vertical' }} />
          </div>
        </div>
        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onCerrar}>Cancelar</button>
          <button style={s.saveBtn} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : esNueva ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Detalle ─────────────────────────────────────────────
function ModalDetalle({ act, puedeEditar, onCerrar, onEditar, onEliminar }) {
  return (
    <div style={s.modalOverlay}>
      <div style={{ ...s.modalBox, maxWidth:500 }}>
        <div style={s.modalHeader}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>
            {act.es_ot ? `OT ${act.ot_numero}` : act.titulo}
          </h3>
          <button style={s.closeBtn} onClick={onCerrar}>✕</button>
        </div>
        <div style={s.modalBody}>
          {act.es_ot && <Fila label="N° OT" value={act.ot_numero} />}
          <Fila label="Estado"       value={act.estado} color={ESTADO_COLOR[act.estado]} />
          <Fila label="Cliente"      value={act.cliente} />
          <Fila label="Sede"         value={act.sede} />
          <Fila label="Servicio"     value={act.tipo_servicio} />
          <Fila label="Ubicación"    value={act.ubicacion} />
          <Fila label="Fecha"        value={fmtFecha(act.fecha_inicio)} />
          {act.fecha_termino && act.fecha_termino !== act.fecha_inicio && (
            <Fila label="Término" value={fmtFecha(act.fecha_termino)} />
          )}
          {act.hora_inicio && (
            <Fila label="Horario" value={`${fmtHora(act.hora_inicio)}${act.hora_termino ? ' – ' + fmtHora(act.hora_termino) : ''}`} />
          )}
          <Fila label="Responsable"  value={act.responsable_nombre} />
          {act.inspector_nombre && <Fila label="Inspector" value={act.inspector_nombre} />}
          {act.observaciones && <Fila label="Observaciones" value={act.observaciones} />}
          {act.es_ot && (
            <a href={`/ots/${act.ot_numero}`} style={{ display:'inline-block', marginTop:12 }}>
              <button style={s.saveBtn}>Ver OT completa →</button>
            </a>
          )}
        </div>
        {!act.es_ot && puedeEditar && (
          <div style={s.modalFooter}>
            <button style={{ ...s.cancelBtn, color:'#DC2626' }} onClick={onEliminar}>Eliminar</button>
            <button style={s.saveBtn} onClick={onEditar}>Editar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Auxiliares ────────────────────────────────────────────────
function Fila({ label, value, color }) {
  if (!value) return null
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.5 }}>{label}</div>
      <div style={{ fontSize:14, color: color || 'var(--texto, #1F2937)', marginTop:2 }}>
        {color ? <span style={{ display:'inline-block', width:10, height:10, borderRadius:3, background:color, marginRight:6 }} /> : null}
        {value}
      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────
const s = {
  topBar:       { display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:12 },
  vistaBtns:    { display:'flex', gap:4 },
  vBtn:         { background:'#F3F4F6', color:'#1F2937', border:'1px solid #E5E7EB', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:14 },
  vBtnActive:   { background:'#1E4D7B', color:'#fff', border:'1px solid #1E4D7B' },
  navBtn:       { background:'#1E4D7B', color:'#fff', border:'none', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:16 },
  hoyBtn:       { background:'#F3F4F6', color:'#1F2937', border:'1px solid #E5E7EB', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:14 },
  newBtn:       { background:'#10B981', color:'#fff', border:'none', borderRadius:6, padding:'8px 16px', cursor:'pointer', fontSize:14, fontWeight:600 },
  filtros:      { display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:12 },
  filtroSelect: { border:'1px solid #E5E7EB', borderRadius:6, padding:'6px 10px', fontSize:13, cursor:'pointer' },
  filtroInput:  { border:'1px solid #E5E7EB', borderRadius:6, padding:'6px 10px', fontSize:13, width:200 },
  leyenda:      { display:'flex', flexWrap:'wrap', gap:'6px 16px', marginBottom:12 },
  errorBox:     { background:'#FEF2F2', color:'#991B1B', padding:10, borderRadius:6, marginBottom:12, fontSize:13 },
  mesTable:     { width:'100%', borderCollapse:'collapse' },
  mesTh:        { textAlign:'center', padding:'10px 6px', fontSize:13, fontWeight:600, color:'#6B7380', borderBottom:'1px solid #E5E7EB' },
  mesTd:        { verticalAlign:'top', minHeight:90, height:90, padding:4, border:'1px solid #F5F5F5', cursor:'pointer' },
  mesTdVacio:   { background:'#F9FAFB', border:'1px solid #F5F5F5' },
  mesDiaNum:    { fontSize:12, color:'#6B7380', marginBottom:2, textAlign:'right' },
  mesCeldaActs: { display:'flex', flexDirection:'column', gap:2 },
  chip:         { fontSize:10, color:'#fff', borderRadius:4, padding:'2px 6px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor:'pointer', display:'block' },
  diaSemanaRow: { border:'1px solid #F5F5F5', borderRadius:6, overflow:'hidden', marginBottom:4 },
  diaSemanaHeader: { padding:'8px 12px', fontWeight:600, fontSize:13 },
  diaSemanaCelda:  { padding:'8px 12px', display:'flex', flexWrap:'wrap', gap:6 },
  card:         { borderRadius:6, padding:'8px 10px', marginBottom:6, cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' },
  cardTitulo:   { fontWeight:600, fontSize:13, color:'#fff', marginBottom:2 },
  cardHora:     { fontSize:11, color:'rgba(255,255,255,0.85)' },
  cardResp:     { fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:2 },
  diaContainer: { maxWidth:640 },
  diaTitulo:    { fontSize:16, fontWeight:600, marginBottom:12 },
  vacio:        { color:'#9CA3AF', fontStyle:'italic', padding:'12px 0' },
  modalOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' },
  modalBox:     { background:'#fff', borderRadius:12, width:'90%', maxWidth:640, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' },
  modalHeader:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid #F3F4F6' },
  modalBody:    { padding:'16px 24px', overflowY:'auto' },
  modalFooter:  { display:'flex', gap:8, justifyContent:'flex-end', padding:'16px 24px', borderTop:'1px solid #F3F4F6' },
  closeBtn:     { background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#6B7380', padding:'0 4px' },
  fila:         { marginBottom:12 },
  label:        { display:'block', fontSize:13, fontWeight:500, color:'#4B5563', marginBottom:4 },
  input:        { width:'100%', padding:10, border:'1px solid #E5E7EB', borderRadius:6, fontSize:14, boxSizing:'border-box' },
  saveBtn:      { background:'#1E4D7B', color:'#fff', border:'none', borderRadius:6, padding:'8px 20px', cursor:'pointer', fontSize:14 },
  cancelBtn:    { background:'#F3F4F6', color:'#1F2937', border:'1px solid #E5E7EB', borderRadius:6, padding:'8px 20px', cursor:'pointer', fontSize:14 },
}
