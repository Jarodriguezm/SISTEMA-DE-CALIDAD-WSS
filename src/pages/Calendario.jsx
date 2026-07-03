// ============================================================
// Calendario.jsx — Módulo Calendario de Actividades WSS
// Fuentes de datos:
//   1. actividades_calendario (tabla propia)
//   2. v_portal_ots_listado   (OTs existentes con fechas reales)
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
const OT_ESTADO_MAP = {
  'Pendiente':                 'Programada',
  'Sin inspector':             'Programada',
  'Asignado':                  'Programada',
  'En proceso':                'En ejecución',
  'Acta cargada':              'Pendiente de informe',
  'Informe cargado':           'Ejecutada',
  'Factura cargada':           'Ejecutada',
  'Cerrada documentalmente':   'Cerrada',
}
const SEDES  = ['ANF','SCL','CCP']
const DIAS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ── Helpers de fecha ─────────────────────────────────────────────────────────
function isoFecha(d) { return d.toISOString().split('T')[0] }
function fmtFecha(iso) {
  if (!iso) return '—'
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function fmtHora(t) { return t ? t.substring(0,5) : '' }

// Convierte cualquier string de fecha a YYYY-MM-DD
function toISO(val) {
  if (!val) return null
  return String(val).split('T')[0]
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Calendario() {
  const { usuario, esAdmin, esSupervisor } = useAuth()
  const puedeCrear  = esAdmin() || esSupervisor() || (usuario?.rol || '').toUpperCase() === 'COMERCIAL'
  const puedeEditar = esAdmin() || esSupervisor()

  const [vista, setVista]               = useState('mes')
  const [fechaRef, setFechaRef]         = useState(new Date())
  const [actividades, setActividades]   = useState([])
  const [cargando, setCargando]         = useState(false)
  const [error, setError]               = useState('')
  const [fuenteInfo, setFuenteInfo]     = useState({ cal: 0, ots: 0 })

  // Filtros
  const [filtroSede, setFiltroSede]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroResp, setFiltroResp]     = useState('')

  // Modal crear/editar
  const [modalAbierto, setModalAbierto]         = useState(false)
  const [actSeleccionada, setActSeleccionada]   = useState(null)
  const [fechaInicioModal, setFechaInicioModal] = useState('')

  // Detalle
  const [detalleAbierto, setDetalleAbierto] = useState(false)
  const [actDetalle, setActDetalle]         = useState(null)

  // ── Carga de datos (actividades + OTs) ─────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')
      const { inicio, fin } = getRango(vista, fechaRef)
      const isoInicio = isoFecha(inicio)
      const isoFin    = isoFecha(fin)

      // ─── 1. Actividades propias del calendario ────────────────────────────
      let actsCal = []
      try {
        const { data, error: err } = await supabase
          .from('actividades_calendario')
          .select('*')
          .is('deleted_at', null)
          .gte('fecha_inicio', isoInicio)
          .lte('fecha_inicio', isoFin)
          .order('fecha_inicio')
          .order('hora_inicio')
        if (!err && data) actsCal = data
      } catch (e) {
        // Tabla puede no existir aún si el SQL no se ejecutó en Supabase
        console.warn('actividades_calendario no disponible:', e.message)
      }

      // ─── 2. OTs desde la vista de listado ────────────────────────────────
      // Prioridad de fecha operacional:
      //   fecha_programacion > fecha_inspeccion > fecha_ejecucion
      //   > fecha_inicio > fecha_termino > fecha_cierre > fecha_creacion
      let actsOTs = []
      try {
        // SELECT * para capturar todos los campos de fecha disponibles en la vista
        // Sin filtro de fecha en BD — se filtra en JS por fecha operacional efectiva
        const { data: otsData, error: errOT } = await supabase
          .from('v_portal_ots_listado')
          .select('*')
          .order('fecha_creacion', { ascending: false })
          .limit(500)

        if (!errOT && otsData && otsData.length > 0) {
          actsOTs = otsData
            .map(ot => {
              // Fecha operacional: primera no-nula según prioridad
              const fechaEfectiva = toISO(
                ot.fecha_programacion ||
                ot.fecha_inspeccion   ||
                ot.fecha_ejecucion    ||
                ot.fecha_inicio       ||
                ot.fecha_termino      ||
                ot.fecha_cierre       ||
                ot.fecha_creacion
              )
              const tipeFecha =
                ot.fecha_programacion ? 'programación' :
                ot.fecha_inspeccion   ? 'inspección'   :
                ot.fecha_ejecucion    ? 'ejecución'    :
                ot.fecha_inicio       ? 'inicio'       :
                ot.fecha_termino      ? 'término'      :
                ot.fecha_cierre       ? 'cierre'       : 'creación'

              return {
                id:                 `ot-${ot.ot_numero}`,
                titulo:             `OT ${ot.ot_numero}`,
                descripcion:        ot.tipo_servicio || '',
                cliente:            ot.cliente || '',
                sede:               ot.sede || '',
                area_servicio:      ot.tipo_servicio || '',
                tipo_servicio:      ot.tipo_servicio || '',
                ubicacion:          '',
                fecha_inicio:       fechaEfectiva,
                fecha_termino:      null,
                hora_inicio:        null,
                hora_termino:       null,
                responsable_nombre: ot.supervisor || '',
                inspector_nombre:   ot.inspector  || '',
                estado:             OT_ESTADO_MAP[ot.estado] || 'Programada',
                observaciones:      `Estado OT: ${ot.estado || ''} · Fecha: ${tipeFecha}`,
                ot_numero:          ot.ot_numero,
                es_ot:              true,
              }
            })
            // Filtrar por el rango de fechas del período actual
            .filter(a => a.fecha_inicio && a.fecha_inicio >= isoInicio && a.fecha_inicio <= isoFin)
        }
      } catch (e) {
        console.warn('Error cargando OTs para calendario:', e.message)
      }

      // ─── 3. Combinar y filtrar ────────────────────────────────────────────
      // OTs van primero solo si no hay actividades propias del mismo día
      // para evitar duplicados visuales: si una OT ya tiene actividad asociada
      // en actividades_calendario, ocultamos el OT
      const otsConActividad = new Set(
        actsCal.filter(a => a.ot_numero).map(a => a.ot_numero)
      )
      const otsFiltradas = actsOTs.filter(o => !otsConActividad.has(o.ot_numero))

      let todas = [...actsCal, ...otsFiltradas]
      setFuenteInfo({ cal: actsCal.length, ots: otsFiltradas.length })

      if (filtroSede)   todas = todas.filter(a => a.sede   === filtroSede)
      if (filtroEstado) todas = todas.filter(a => a.estado === filtroEstado)
      if (filtroResp)   todas = todas.filter(a =>
        (a.responsable_nombre || '').toLowerCase().includes(filtroResp.toLowerCase()) ||
        (a.inspector_nombre   || '').toLowerCase().includes(filtroResp.toLowerCase())
      )
      setActividades(todas)

    } catch (e) {
      setError('Error al cargar actividades: ' + e.message)
    } finally {
      setCargando(false)
    }
  }, [vista, fechaRef, filtroSede, filtroEstado, filtroResp])

  useEffect(() => { cargar() }, [cargar])

  function abrirNuevo(fechaISO) {
    if (!puedeCrear) return
    setActSeleccionada(null)
    setFechaInicioModal(fechaISO || isoFecha(new Date()))
    setModalAbierto(true)
  }

  function abrirEditar(act) {
    if (act.es_ot) return  // OTs solo se editan desde el módulo OTs
    setDetalleAbierto(false)
    setActSeleccionada(act)
    setFechaInicioModal(act.fecha_inicio || '')
    setModalAbierto(true)
  }

  function abrirDetalle(act) {
    setActDetalle(act)
    setDetalleAbierto(true)
  }

  async function eliminarAct(act) {
    if (act.es_ot) return
    if (!window.confirm(`¡Eliminar "${act.titulo}"?`)) return
    const { error } = await supabase
      .from('actividades_calendario')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', act.id)
    if (!error) cargar()
  }

  function navegar(delta) {
    setFechaRef(prev => {
      const d = new Date(prev)
      if (vista === 'mes')    d.setMonth(d    .getMonth() + delta)
      if (vista === 'semana') d.setDate(d.getDate()   + delta * 7)
      if (vista === 'dia')    d.setDate(d.getDate()   + delta)
      return d
    })
  }

  function irAHoy() { setFechaRef(new Date()) }

  const actsFiltradas = actividades

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrap}>
      {/* Barra superior con filtros */}
      <div style={s.topBar}>
        {/* Controles de vista */}
        <div style={s.vistaBtns}>
          {'semana mes dia'.split(' ').map(v => (
            <button key={v} style={{...s.vBtn, ...(vista===v ? s.vBtnActive : {})}}
              onClick={()=>setVista(v)}>{v.charAt(0).toUpperCase()+v
+.slice(1)}</button>
          ))}
        </div>
        {/* Filtros */}
        <div style={s.filtros}>
          <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
            style={s.filtroSelect}>
            <option value="">Todas las sedes</option>
            {SEDES.map(se => <option key={se} value={se}>{se}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            style={s.filtroSelect}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
          <input
            type="text" placeholder="Responsable / Inspector"
            value={filtroResp} onChange={e => setFiltroResp(e.target.value)}
            style={s.filtroInput}
          />
        </div>
      </div>

      {/* Barra de navegación */}  >
              <div style={s.navBar}>
                <button style={s.navBtn} onClick={() => navegar(-1)}>▰</button>
                <span style={s.navTitle}>{getLabelFecha(vista, fechaRef)}</span>
                <button style={s.navBtn} onClick={() => navegar(1)}>▲</button>
                <button style={s.hoyBtn} onClick={irAHoy}>Hoy</button>
              </div>

      { /* Stats */}
      <div style={{fontSize:'12px', opacity:0.6, margin:'0 0 8px 0'}}>
        {cargando ? 'Cargando...' : `${actividades.length} eventos (${fuenteInfo.cal} actividades + ${fuenteInfo.ots} OTs)`}
      </div>

      { /* Botón crear */}
      {puedeCrear && (
        <button style={s.addBtn} onClick={() => abrirNuevo(null)}>
          + Nueva actividad
        </button>
      )}

      { /* Error */}
      {error && <div style={s.errorBox}>{error}</div>}

      {/* Contenido principal */}
      {vista === 'mes'    && <VirstaMes   acts={actsFiltradas} fechaRef={fechaRef} abrirEditar={abrirEditar} abrirNuevo={abrirNuevo} abrirDetalle={abrirDetalle} />}
      {vista === 'semana' && <VirstaSemana acts={actsFiltradas} fechaRef={fechaRef} abrirEditar={abrirEditar} abrirNuevo={abrirNuevo} abrirDetalle={abrirDetalle} />}
      {vista === 'dia'    && <VirstaDia   acts={actsFiltradas} fechaRef={fechaRef} abrirEditar={abrirEditar} abrirNuevo={abrirNuevo} abrirDetalle={abrirDetalle} />}

      {/* Leyenda */}
      <div style={s.leyenda}>
        {Object.entries(ESTADO_COLOR).map(([est, col]) => (
          <span key={est} style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px'}}>
            <span style={{background:col, width:'12px', height:'12px', borderRadius:'2px'}}/>
            {est}
          </span>
        ))}
      </div>

      {/* Modal editar/crear */}
      {modalAbierto && (
        <ModalActividad
          act={actSeleccionada}
          fechaDefault={fechaInicioModal}
          onCerrar={()=>{setModalAbierto(false); setActSeleccionada(null)}}
          onGuardado={cargar}
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
  >
                        <button style={{...s.vBtn, ...(vista===v ? s.vBtnActive : {})}}
                          onClick={()=>setVista(v)}>{v.charAt(0).toUpperCase()+v+%2Bsemana mes dia'.split(' ').map(v => (
                      <button key={v} style={{...s.vBtn, ...(vista===v ? s.vBtnActive : {})}}
                        onClick={()=>setVisSemana
                                                      style={{...s.chip, background: ESTADO_COLOR[a.estado] || '#64748B'}}
                                                      onClick={(ev) => {
                                                        ev.stopPropagation()
                                                        abrirDetalle(a)
                                                      }
                                                    }>
                                                      {a.es_ot ? `“ OT ${a.ot_numero}` : a.titulo}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                            );
                                          })
                                        }
                                      </tr>
                                    ))
                                  }
                                </tbody>
                              </table>
                            </div>
                          )
                        }
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        )
      }
    </div>
  )
}

// ── VistaSemana ────────────────────────────────────────────────────────────
function VirstaSemana({ acts, fechaRef, abrirEditar, abrirNuevo, abrirDetalle }) {
  const inicio = new Date(fechaRef)
  inicio.setDate(inicio.getDate() - inicio.getDay())
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(d-getDate() + i)
    return d
  })
  const hoy = isoFecha(new Date())
  return (
    <div>
      {dias.map(dia => {
        const fechaISO = isoFecha(dia)
        const actsDia = acts.filter(a => a.fecha_inicio === fechaISO)
        const esHoy = fechaISO === hoy
        return (
          <div key={fechaISO} style={{s.diaSemanaRow}}>
            <div style={{...s.diaSemanaHeader, ...(esHoy ? {background:'#EFF6FF', color:'#1E4D7B'} : {})}}>
odalAbierto && (
        <ModalActividad
          act={actSeleccionada}
          fechaDefault={fechaInicioModal}
          onCerrar={()=>{setModalAbierto(false); setActSeleccionada(null)}}
          onGuardado={cargar}
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

// ── VistaMes ───────────────────────────────────────────────────────────
function VirstaMes({ acts, fechaRef, abrirEditar, abrirNuevo, abrirDetalle }) {
  const año  = fechaRef.getFullYear()
  const mes   = fechaRef.getMonth()
  const hoy   = isoFecha(new Date())
  const primerDia  = new Date(año, mes, 1)
  const diasEnMes  = new Date(año, mes + 1, 0).getDate()
  const inicioSemana = primerDia.getDay()

  const celdas = []
  for (let i = 0; i < inicioSemana; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(new Date(año, mes, d))

  const semanas = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))

  return (
    <div>
      <table style={s.mesTable}>
        <thead><tr>{DIAS.map(d => <th key={d} style={s.mesTh}>{d}</th>)}</tr></thead>
        <tbody>
          {semanas.map((sem, si) => (
            <tr key={si}>
              {sem.map((dia, di) => {
                if (!dia) return <td key={di} style={s.mesTdVacio}/>
                const fechaISO = isoFecha(dia)
                const actsDia  = acts.filter(a => a.fecha_inicio === fechaISO)
                const esHoy    = fechaISO === hoy
                return (
                  <td key={di} style={{...s.mesTd, ...(esHoy ? {background:'#EFF6FF'} : {})}}
                    onClick={() => abrirNuevo(fechaISO)}
                  >
                    <div style={{...s.mesDiaNum, ...(esHoy ? {color:'#E144C6', fontWeight:'bold'} : {})}}>
  var(--azul-500, #1E4D7B);}
                                                <div style={{...s.mesDiaNum, ...(esHoy ? {color:'#E144C6', fontWeight:'bold'} : {})}}>
                                                  {dia.getDate()}
                                                </div>
                                                <div style={s.mesCeldaActs}>
                                                  {actsDia.map((a, i) => (
                                                    <span key={i.id || i}
(a => a.fecha_inicio === fechaISO)
        return (
          <div key={fechaISO} style={{...s.diaSemanaRow}}>
            <div style={{...s.diaSemanaHeader, ...(esHoy ? {background:'#EFF6FF', color:'#1E4D7B'} : {})}}>
              {DAAS[ddia.getDayWAy()]} {dia.getDate()}
            </div>
            <div style={s.diaSemanaCelda}>
              {actsDia.map(a => (
                <CardActividad key={a.id} act={a} abrirDetalle={abrirDetalle} abrirEditar={abrirEditar} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── VistaDia ───────────────────────────────────────────────────────────
function VirstaDia({ acts, fechaRef, abrirEditar, abrirNuevo, abrirDetalle }) {
  const fechaISO = isoFecha(fechaRef)
  const actsDia  = acts.filter(a => a.fecha_inicio === fechaISO)
  return (
    <div style={s.diaContainer}>
      <div style={s.diaTitulo}>
        {DIAS[fechaRef.getDay()]} {fechaRef.getDate()} de {MESES[fechaRef.getMonth()]}
      </div>
      { actsDia.length === 0 ? (
        <div style={s.vacio}>Sin actividades para este día</div>
      ) : actsDia.map(a => (
        <CardActividad key={a.id} act={a} abrirDetalle={abrirDetalle} abrirEditar={abrirEditar} />
      ))}
      <button style={s.addBtn} onClick={() => abrirNuevo(fechaISO)}>
        + Agregar actividad
      </button>
    </div>
  )
}

         )
        })}
      </tbody>
      </table>
      </div>
      )
    }
  }

  return (
    <div>
      {dias.map(dia => {
        const fechaISO = isoFecha(dia)
        const actsDia = acts.filter(a => a.fecha_inicio === fechaISO)
        const esHoy = fechaISO === isoFecha(new Date())
        return (
          <div key={fechaISO} style={s.diaSemanaRow}>
            <div style={{...s.diaSemanaHeader, ...(esHoy ? {background:'#EFF6FF', color:'#1E4D7B'} : {})}}>
              {DIAS[dia.getDay()]} {dia.getDate()}
            </div>
            <div style={s.diaSemanaCelda}>
              {actsDia.map(a => (
                <CardActividad key={a.id} act={a} abrirDetalle={abrirDetalle} abrirEditar={abrirEditar} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
 ESTADO_COLOR[a.estado] || '#64748B'}}>
                      <div style={s.cardTitulo}>
                        {a.es_ot ? `⍜ OT ${a.ot_numero}` : a.titulo}
                      </div>
                      {a.hora_inicio && <div style={s.cardHora}>{fmtHora(a.hora_inicio)}</div>}
                      {a.responsable_nombre && 
                        <div style={s.cardResp}>{a.responsable_nombre.split(' ')[0]}</div>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </td>
        </tr>
      ))
      }
    </tbody>
  </table>
  </div>
  )
}

// ── DiaCard (semana/dia vista) ────────────────────────────────────────────────

function DiaCard({ dia, acts, abrirEditar, abrirNuevo, abrirDetalle, esHoy }) {
  return (
    <div style={{...s.diaCard, ...(esHoy ? s.diaCardHoy : {})}}>
      <div style={{...s.diaNum, ...(esHoy ? s.diaNumHoy : {})}}>
        {dia.getDate()}
      </div>
      <div style={s.diaActs}>
        {acts.map(a => (
          <CardActividad key={a.id} act={a} abrirDetalle={abrirDetalle} abrirEditar={abrirEditar} />
        ))}
      </div>
    </div>
  )
}
)}{act.horm_inicio && <div style={s.cardHora}>{fmtHora(act.hora_inicio)}</div>}
                {act.responsable_nombre && <div style={s.cardResp}>{act.responsable_nombre.split(' ')[0]}</div>}
              </div>
            </div>
          )
}

// ── ModalActividad ──────────────────────────────────────────────────────
function ModalActividad({ act, fechaDefault, onCerrar, onGuardado }) {
  const esNueva = !act
  const [form, setForm] = useState(act ? { ...act } : {
    titulo: '', descripcion: '', cliente: '', sede: '',
    area_servicio: '', tipo_servicio: '', ubicacion: '',
    fecha_inicio: fechaDefault || '', fecha_termino: '',
    hora_inicio: '', hora_termino: '',
    responsable_nombre: '', inspector_nombre: '',
    estado: 'Programada', observaciones: '',
    ot_numero: null,
  })
  const [otsDisp,  setOtsDisp]  = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    supabase.from('v_portal_ots_listado').select('ot_numero,cliente').limit(200).then(({data}) => {
      if (data) setOtsDisp(data)
    })
  }, [])

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  async function guardar() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    if (!form.fecha_inicio)   { setError('La fecha es obligatoria');  return }
    setGuardando(true); setError('')
    try {
      const payload = {
        titulo:               form.titulo.trim(),
        descripcion:          form.descripcion.trim(),
        cliente:              form.cliente.trim(),
        sede:                 form.sede,
        area_servicio:        form.area_servicio.trim(),
        tipo_servicio:        form.tipo_servicio.trim(),
        ubicacion:            form.ubicacion.trim(),
        fecha_inicio:         form.fecha_inicio || null,
        fecha_termino:        form.fecha_termino || null,
        hora_inicio:          form.hora_inicio || null,
        hora_termino:         form.hora_termino || null,
        responsable_nombre:   form.responsable_nombre.trim(),
        inspector_nombre:     form.inspector_nombre.trim(),
        estado:               form.estado,
        observaciones:        form.observaciones.trim(),
        ot_numero:            form.ot_numero || null,
      }ando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.from('v_portal_ots_listado').select('ot_numero,cliente').limit(200).then(({ data }) => {
      if (data) setOtsDisp(data)
    })
  }, [])
  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  async function guardar() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    if (!form.fecha_inicio)   { setError('La fecha es obligatoria');  return }
    setGuardando(true); setError('')
    try {
      const payload = {
        titulo:               form.titulo.trim(),
        descripcion:          form.descripcion.trim(),
        cliente:              form.cliente.trim(),
        sede:                 form.sede,
        area_servicio:        form.area_servicio.trim(),
        tipo_servicio:        form.tipo_servicio.trim(),
        ubicacion:            form.ubicacion.trim(),
        fecha_inicio:         form.fecha_inicio || null,
        fecha_termino:        form.fecha_termino || null,
        hora_inicio:          form.hora_inicio || null,
        hora_termino:         form.hora_termino || null,
        responsable_nombre:   form.responsable_nombre.trim(),
        inspector_nombre:     form.inspector_nombre.trim(),
        estado:               form.estado,
        observaciones:        form.observaciones.trim(),
        ot_numero:            form.ot_numero || null,
      }
style={s.modalOverlay}>
      <div style={s.modalBox}>
        <div style={s.modalHeader}>
          <h3 style={{.margin:0}}>{esNueva ? 'Nueva actividad' : 'Editar actividad'}</h3>
          <button style={s.closeBtn} onClick={onCerrar}>×</button>
        </div>
        <div style={s.modalBody}>
          {error && <div style={s.errorBox}>{error}</div>}

          {/* OT vinculada */}
          <div style={s.fila}>
            <label style={s.label}>OT vinculada (opcional)</label>
            <select value={form.ot_numero || ''} onChange={e => setF('ot_numero', e.target.value || null)}
              style={s.input}>
              <option value="">Sin OT</option>
              {otsDisp.map(o => (
                <option key={o.ot_numero} value={o.ot_numero}>
                  OT ${o.ot_numero} {o.cliente ? '- ' + o.cliente : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div style={s.fila}>
            <label style={s.label}>Título *</label>
            <input value={form.titulo} onChange={e => setF('titulo', e.target.value)} style={s.input} />
          </div>

          {/* Descripción */}
          <div style={s.fila}>
            <label style={s.label}>Descripción</label>
            <input value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} style={s.input} />
          </div>

          {/* Cliente */}
          <div style={s.fila}>
            <label style={s.label}>Cliente</label>
            <input value={form.cliente} onChange={e => setF('cliente', e.target.value)} style={s.input} />
          </div>

          {/* Sede */}
          <div style={s.fila}>
            <label style={s.label}>Sede</label>
            <select value={form.sede} onChange={e => setF('cede', e.target.value)} style={s.input}>
              <option value="">Seleccionar</option>
              {SEDES.map(se => <option key={se} value={se}>{se}</option>)}
            </select>
          </div>
e={form.area_servicio} onChange={e => setF('area_servicio', e.target.value)} style={s.input} />
          </div>

          {/* Tipo de servicio */}
          <div style={s.fila}>
            <label style={s.label}>Tipo de servicio</label>
            <input value={form.tipo_servicio} onChange={e => setF('tipo_servicio', e.target.value)} style={s.input} />
          </div>

          {/* Ubicación */}
          <div style={s.fila}>
            <label style={s.label}>Ubicación</label>
            <input value={form.ubicacion} onChange={e => setF('ubicacion', e.target.value)} style={s.input} />
          </div>

          {/* Fechas */}
          <div style={{...s.fila, flexDirection':'row', gap:'12px'}}>
            <div style={{flex:1}}>
              <label style={s.label}>Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)} style={s.input} />
            </div>
            <div style={{flex:1}}>
              <label style={s.label}>Fecha término</label>
              <input type="date" value={form.fecha_termino} onChange={e => setF('fecha_termino', e.target.value)} style={s.input} />
            </div>
          </div>

          {/* Horas */}
          <div style={{...s.fila, flexDirection:'row', gap:'12px'}}>
            <div style={{flex:1}}>
              <label style={s.label}>Horo inicio</label>
              <input type="time" value={form.hora_inicio} onChange={e => setF('hora_inicio', e.target.value)} style={s.input} />
            </div>
            <div style={{flex:1}}>
              <label style={s.label}>Horo término</label>
              <input type="time" value={form.hora_termino} onChange={e => setF('hora_termino', e.target.value)} style={s.input} />
            </div>
          </div>

          {/* Responsable */}
          <div style={s.fila}>
            <label style={s.label}>Responsable</label>
            <input value={form.responsable_nombre} onChange={e => setF('responsable_nombre', e.target.value)} style={s.input} />
          </div>
e', e.target.value)} style={s.input} />
          </div>

          {/* Estado */}
          <div style={s.fila}>
            <label style={s.label}>Estado</label>
            <select value={form.estado} onChange={e => setF('estado', e.target.value)} style={s.input}>
              {ESTADOS.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          </div>

          {/* Observaciones */}
          <div style={s.fila}>
            <label style={s.label}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setF('observaciones', e.target.value)}
              style={{...s.input, height:'100px', resize:'vertical'}} rows={3} />
          </div>
        </div>
        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onCerrar}>Cancelar</button>
          <button style={s.saveBtn} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : esNueva ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
 margin:0, fontSize:'16px', fontWeight:'600'}}>
                {act.titulo}
              </h3>
              <button style={s.closeBtn} onClick={onCerrar}>�</button>
            </div>
            <div style={s.modalBody}>
              <Fila label="Estado"       value={act.estado} color={ESTADO_COLOR[act.estado]} />
              <Fila label="Cliente"      value={act.cliente} />
              <Fila label="Sede"         value={act.sede} />
              <Fila label="Área"         value={act.area_servicio} />
              <Fila label="Servicio"     value={act.tipo_servicio} />
              <Fila label="Ubicación"    value={act.ubicacion} />
              <Fila label="Fecha"        value={fmtFecha(act.fecha_inicio)} />
              {act.fecha_termino && <Fila label="Término" value={fmtFecha(act.fecha_termino)} />}
              {act.hora_inicio && <Fila label="Horas" value={`${fmtHora(act.hora_inicio)}${act.hora_termino ? ' - '+fmtHora(act.hora_termino) : ''}`} />}
              <Fila label="Responsable" value={act.responsable_nombre} />
              {act.inspector_nombre && <Fila label="Inspector" value={act.inspector_nombre} />}
              {act.observaciones && <Fila label="Observaciones" value={act.observaciones} />}
              {act.es_ot && <Fila label="OT" link={/ots/${act.ot_numero}} value={`Ir a OT ${act.ot_numero}`} />}
            </div>
            {!act.es_ot && (
              <div style={s.modalFooter}>
                {puedeEditar && <button style={s.saveBtn} onClick={onEditar}>Editar</button>}
                {puedeEditar && <button style={{...s.cancelBtn, color:'#DC2626'}} onClick={onEliminar}>Eliminar</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
}
                <div style={s.modalOverlay}>
                  <div style={{...s.modalBox, maxWidth:'500px'}}>
                    <div style={s.modalHeader}>
                      <h3 style={{margin:0, fontSize:'16px', fontWeight:'600'}}>
                        {act.titulo}
                      </h3>
                      <button style={s.closeBtn} onClick={onCerrar}>�</button>
                    </div>
                    <div style={s.modalBody}>
                      <Fila label="Estado"       value={act.estado} color={ESTADO_COLOR[act.estado]} />
                      <Fila label="Cliente"      value={act.cliente} />
                      <Fila label="Sede"         value={act.sede} />
                      <Fila label="Área"         value={act.area_servicio} />
                      <Fila label="Servicio"     value={act.tipo_servicio} />
                      <Fila label="Ubicación"    value={act.ubicacion} />
                      <Fila label="Fecha"        value={fmtFecha(act.fecha_inicio)} />
                      {act.fecha_termino && <Fila label="Término" value={fmtFecha(act.fecha_termino)} />}
                      {act.hora_inicio && <Fila label="Horos" value={`${fmtHora(act.hora_inicio)}${act.hora_termino ? ' - '+fmtHora(act.hora_termino) : ''}`} />}
                      <Fila label="Responsable" value={act.responsable_nombre} />
                      {act.inspector_nombre && <Fila label="Inspector" value={act.inspector_nombre} />}
                      {act.observaciones && <Fila label="Observaciones" value={act.observaciones} />}
                    </div>
                    <div style={s.modalFooter}>
                      {puedeEditar && !act.es_ot && <button style={s.cancelBtn} onClick={onEliminar}>Eliminar</button>}
                      {puedeEditar && !act.es_ot && <button style={s.saveBtn} onClick={onEditar}>Editar</button>}
                    </div>
                  </div>
                </div>
              )
            }
          }
tDate() + delta * 7*)
    if (vista === 'dia')    d.setDate(d.getDate()   + delta)
    return d
    })
  }

  function getRango(vista, fechaRef) {
    const d = new Date(fechaRef)
    if (vista === 'mes') {
      return {
        inicio: new Date(d.getFullYear(), d.getMonth(), 1),
        fin:    new Date(d.getFullYear(), d.getMonth() + 1, 0),
      }
    }
    if (vista === 'semana') {
      const inicio = new Date(d)
      inicio.setDate(d.getDate() - d.getDay())
      const fin = new Date(inicio)
      fin.setDate(inicio.getDate() + 6)
      return { inicio, fin }
    }
    // dia
    return { inicio: d, fin: d }
  }

  function getLabelFecha(vista, fechaRef) {
    if (vista === 'mes')    return `${MESESwfechaRef.getMonth()]} ${fechaRef.getFullYear()}`
    if (vista === 'semana') {
      const { inicio, fin } = getRango('semana', fechaRef)
      return `${inicio.getDate()}/${inicio.getMonth()+1} - ${fin.getDate()}/${fin.getMonth()+1}/${fin.getFullYear()}`
    }
    return `${DAAS[fechaRef.getDay()]} ${fechaRef.getDate()} de ${MESES[fechaRef.getMonth()]}`
  }
0, color:'#fff', border:'none', borderRadius:'6px', padding:'6px 12px', cursor:'pointer', fontSize:'14px' },
  hoyBtn:  { background:'#F3F4F6', color:'#1F2937', border:'1px solid #E5E7EB', borderRadius:'6px', padding:'6px 12px', cursor:"pointer', fontSize:'14px' },
  filtros: { display:'flex', gap:'8px', alignItems: 'center', marginTop:'8px' },
  filtroSelect: { border:'1px solid #E5E7EB', borderRadius:'6px', padding:'6px 10px', fontSize:'13px', cursor:'pointer' },
  filtroInput: { border:'1px solid #E5E7EB', borderRadius:'6px', padding:'6px 10px', fontSize:'13px', width:'180px' },
  leyenda: { display:'flex', flexWrap:'wrap', gap:'8px 16px', marginTop:'12px', padding: '8px 4px' },
  errorBox: { background:'#FEF2F2', color:'#991B1B', padding:'10px', borderRadius:'6px', marginBottom:'12px', fontSize:'13px' },
  mesTable: { width:'100%', borderCollapse:'collapse' },
  mesTh: { textAlign:'center', padding:'10px 6px', fontSize:'13px', fontWeight:'600', color:'#6B7380', borderBottom:'1px solid #E5E7EB' },
  mesTd: { verticalAlign:'top', minHeight:'100px', height:'100px', padding:'4px', border:'1px solid #F5F5F5', cursor:"pointer', ':hover': { background: '#F9FAFB' } },
  mesTdVacio: { background:'#F9FAFB', border:'1px solid #F5F5F5' },
  mesDiaNum: { fontSize:'12px', color:'#6B7380', marginBottom:'2px', textAlign:'right' },
  mesCeldaActs: { display:'flex', flexDirection:'column', gap:'2px' },
  chip: { fontSize:'10px', color:'#fff', borderRadius:'4px', padding:'2px 6px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor:'pointer', display:'block' },
  diaSemanaRow: { marginBottom:'4px', border:'1px solid #F5F5F5', borderRadius:'6px', overflow:'hidden' },
  diaSemanaHeader: { background:'#F9FAFB', padding:'8px 12px', fontWeight:'600', fontSize:'13px' },
  diaSemanaCelda: { padding:'8px 12px', display:'flex', flexWrap:'wrap', gap:'6px' },
  card: { borderRadius:'6px', padding:'8px 10px', marginBottom:'6px', cursor:"pointer', boyShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  cardTitulo: { fontWeight: '600', fontSize: '13px', color: '#fff', marginBottom: '2px' },
  cardHora: { fontSize: '11px', color: 'rgba(255,255,255,0.8)' },
  cardResp: { fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' },
  diaContainer: { maxWidth:'640px' },
  diaTitulo: { fontSize:'16px', fontWeight:'600', marginBottom:'12px' },
  vacio: { color:'#9C99A6', fontStyle:'italic', padding:'16px 0' },
  modalOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' },
  modalBox: { background:'#fff', borderRadius:'12px', padding:0, width:'90%', maxWidth:'640px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent: 'space-between', padding:'16px 24px', borderBottom:'1px solid #F3F4F6' },
  modalBody: { padding:'16px 24px', overflowY�'auto'},
  modalFooter: { display:'flex', gap:'8px', justifyContent:'flex-end', padding:'16px 24px', borderTop:'1px solid #F3F4F6' },
  closeBtn: { background:'none', border:'none', cursor:"pointer', fontSize:'20px', color:'#6B7380', padding:'0 4px' },
  fila: { marginBottom:'12px' },
  label: { display:'block', fontSize:'13px', fontWeight:'500', color:'#4B5563', marginBottom:'4px' },
  input: { width:'100%', padding:'10px', border:'1px solid #E5E7EB', borderRadius:'6px', fontSize:'14px', boySizing:'border-box' },
  saveBtn: { background:'#1E4D7B', color:'#fff', border:'none', borderRadius:'6px', padding:'8px 20px', cursor:'pointer', fontSize:'14px' },
  cancelBtn: { background:'#F3F4F6', color:'#1F2937', border:'1px solid #E5E7EB', borderRadius:'6px', padding:'8px 20px', cursor:'pointer', fontSize:'14px' },
}
