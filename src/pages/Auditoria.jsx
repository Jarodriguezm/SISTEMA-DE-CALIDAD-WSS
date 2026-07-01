// ============================================================
// Auditoria.jsx — Trazabilidad completa de informes WSS
// Tab 1: Cadena trazable informe → OT → Acta → Entrega
// Tab 2: Log de acciones del sistema
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'

const SERIES = ['', 'ESI', 'EAI', 'IVS', 'IVA']
const ESTADOS_INF = ['', 'Reservado', 'Emitido', 'Anulado']
const COLOR_SERIE = { ESI: '#185FA5', EAI: '#7C3AED', IVS: '#059669', IVA: '#D97706' }

function fmt(fecha, hora = false) {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return hora
    ? d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Modal Informe (cadena completa) ──────────────────────────
function ModalInforme({ fila, onClose }) {
  const navigate = useNavigate()
  if (!fila) return null
  const col = COLOR_SERIE[fila.serie] || 'var(--azul)'
  return (
    <div style={modal.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modal.box, maxWidth: 760 }}>
        <div style={{ ...modal.header, background: `linear-gradient(135deg,${col},${col}cc)` }}>
          <div>
            <h2 style={modal.h2}>Informe {fila.codigo_informe}</h2>
            <p style={modal.sub}>{fila.cliente || '—'} · OT {fila.ot_numero || '—'}</p>
          </div>
          <button style={modal.cerrar} onClick={onClose}>✕</button>
        </div>
        <div style={modal.body}>

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Serie', val: fila.serie, color: col },
              { label: 'N° Correlativo', val: fila.numero_correlativo, color: col },
              { label: 'Estado Informe', val: fila.estado_informe || 'Reservado', color: '#374151' },
              { label: 'Estado OT', val: fila.estado_ot || '—', color: '#374151' },
            ].map(k => (
              <div key={k.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontWeight: 800, color: k.color, fontSize: 16 }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Cadena cronológica */}
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: '#E2E8F0' }} />

            <Paso icono="📋" titulo="OT Creada" fecha={fmt(fila.fecha_creacion_ot)}>
              <Info l="OT" v={fila.ot_numero} mono />
              <Info l="Cliente" v={fila.cliente} />
              <Info l="Producto/Servicio" v={fila.producto} />
              <Info l="Área" v={fila.area} />
              <Info l="Supervisor" v={fila.supervisor} clickable />
              <Info l="Comercial" v={fila.comercial} />
            </Paso>

            <Paso icono="🔢" titulo="Número Reservado" fecha={fmt(fila.fecha_reserva, true)}>
              <Info l="Código" v={fila.codigo_informe} mono />
              <Info l="Reservado por" v={fila.reservado_por} />
            </Paso>

            <Paso icono="✍️" titulo="Acta de Terreno"
              fecha={fila.codigo_acta ? fmt(fila.fecha_inspeccion) : null}
              pendiente={!fila.codigo_acta}>
              {fila.codigo_acta ? (
                <>
                  <Info l="Código Acta" v={fila.codigo_acta} mono />
                  <Info l="Inspector(es)" v={fila.inspector} clickable />
                  <Info l="Tipos ensayo" v={Array.isArray(fila.tipos_ensayo) ? fila.tipos_ensayo.join(', ') : fila.tipos_ensayo} />
                  <Info l="Norma evaluación" v={fila.norma_evaluacion} />
                  <Info l="Estado acta" v={fila.estado_acta} />
                  {fila.acta_drive_url && (
                    <a href={fila.acta_drive_url} target="_blank" rel="noreferrer">
                      <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }}>📄 Ver acta</button>
                    </a>
                  )}
                </>
              ) : <span style={{ fontSize: 12, color: '#94A3B8' }}>Pendiente de emitir</span>}
            </Paso>

            <Paso icono="📤" titulo="Entrega de Informe"
              fecha={fila.fecha_entrega_informe ? fmt(fila.fecha_entrega_informe, true) : null}
              pendiente={!fila.fecha_entrega_informe}>
              {fila.informe_drive_url ? (
                <>
                  <Info l="Archivo" v={fila.nombre_informe} />
                  <Info l="Entregado por" v={fila.entregado_por} />
                  <a href={fila.informe_drive_url} target="_blank" rel="noreferrer">
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>📥 Descargar informe</button>
                  </a>
                </>
              ) : <span style={{ fontSize: 12, color: '#94A3B8' }}>Informe aún no entregado</span>}
            </Paso>
          </div>

          <div style={{ marginTop: 20, borderTop: '1px solid #E2E8F0', paddingTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm"
              onClick={() => { navigate(`/ots/${fila.ot_numero}`); onClose() }}>
              Ver OT completa →
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Paso({ icono, titulo, fecha, pendiente, children }) {
  return (
    <div style={{ position: 'relative', marginBottom: 20, paddingLeft: 12 }}>
      <div style={{
        position: 'absolute', left: -22, top: 2, width: 22, height: 22, borderRadius: '50%',
        background: pendiente ? '#F3F4F6' : '#EFF6FF', border: `2px solid ${pendiente ? '#D1D5DB' : '#3B82F6'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
      }}>{icono}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: pendiente ? '#9CA3AF' : '#1E293B' }}>{titulo}</div>
        {fecha && <div style={{ fontSize: 11, color: '#94A3B8' }}>{fecha}</div>}
      </div>
      <div style={{ background: pendiente ? '#F9FAFB' : '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '6px 16px' }}>
        {children}
      </div>
    </div>
  )
}

function Info({ l, v, mono, clickable }) {
  if (!v) return null
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.3px' }}>{l}</div>
      <div style={{
        fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', fontWeight: mono ? 700 : 500,
        color: clickable ? 'var(--azul)' : '#1E293B',
      }}>{v}</div>
    </div>
  )
}

// ── Modal Persona (inspector / supervisor) ────────────────────
function ModalPersona({ nombre, onClose }) {
  const [usuario, setUsuario] = useState(null)
  const [actas, setActas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!nombre) return
    const partes = nombre.trim().split(' ')
    Promise.all([
      supabase.from('usuarios')
        .select('*')
        .ilike('nombre', `%${partes[0]}%`)
        .limit(1),
      supabase.from('actas_terreno')
        .select('codigo_acta, ot_numero, fecha_inspeccion, estado, ensayos')
        .ilike('inspectores_nombres', `%${partes[0]}%`)
        .order('fecha_inspeccion', { ascending: false })
        .limit(20),
    ]).then(([u, a]) => {
      setUsuario(u.data?.[0] || null)
      setActas(a.data || [])
      setCargando(false)
    })
  }, [nombre])

  if (!nombre) return null
  const inicial = nombre[0]?.toUpperCase()

  return (
    <div style={modal.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modal.box, maxWidth: 560 }}>
        <div style={{ ...modal.header, background: 'linear-gradient(135deg,#0E2A45,#17395C)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#fff' }}>{inicial}</div>
            <div>
              <h2 style={modal.h2}>{nombre}</h2>
              <p style={modal.sub}>{usuario?.rol || 'Inspector/Supervisor WSS'} · {usuario?.sede || '—'}</p>
            </div>
          </div>
          <button style={modal.cerrar} onClick={onClose}>✕</button>
        </div>
        <div style={modal.body}>
          {cargando ? <div className="loading-bar" /> : (
            <>
              {usuario && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {[
                    { l: 'Nombre completo', v: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() },
                    { l: 'Email', v: usuario.email },
                    { l: 'Rol', v: usuario.rol },
                    { l: 'Sede', v: usuario.sede },
                    { l: 'Estado', v: usuario.activo ? 'Activo ✓' : 'Inactivo' },
                    { l: 'Especialidad', v: usuario.especialidad },
                  ].filter(r => r.v).map(r => (
                    <div key={r.l} style={{ background: '#F8FAFC', borderRadius: 7, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>{r.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginTop: 2 }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>
                  Historial de inspecciones ({actas.length})
                </div>
                {actas.length === 0
                  ? <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>Sin actas registradas</div>
                  : (
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#F1F5F9' }}>
                            <th style={th}>Acta</th>
                            <th style={th}>OT</th>
                            <th style={th}>Fecha inspección</th>
                            <th style={th}>Ensayos</th>
                            <th style={th}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actas.map((a, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={td}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--verde)' }}>{a.codigo_acta || '—'}</span></td>
                              <td style={td}><span style={{ fontFamily: 'monospace', color: 'var(--azul)', fontWeight: 700 }}>{a.ot_numero}</span></td>
                              <td style={td}>{fmt(a.fecha_inspeccion)}</td>
                              <td style={td}>{Array.isArray(a.ensayos) ? a.ensayos.join(', ') : (a.ensayos || '—')}</td>
                              <td style={td}><span className={`badge ${a.estado === 'Emitida' ? 'badge-green' : 'badge-amber'}`}>{a.estado}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </>
          )}
          <div style={{ paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const th = { padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 11, textTransform: 'uppercase' }
const td = { padding: '7px 10px' }

// ── Tab Trazabilidad ──────────────────────────────────────────
function TabTrazabilidad() {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroSerie, setFiltroSerie] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [pagina, setPagina] = useState(0)
  const [modalInforme, setModalInforme] = useState(null)
  const [modalPersona, setModalPersona] = useState(null)
  const POR_PAGINA = 30

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')
      let q = supabase.from('v_trazabilidad_informes').select('*').limit(2000)
      if (filtroSerie)  q = q.eq('serie', filtroSerie)
      if (filtroEstado) q = q.eq('estado_informe', filtroEstado)
      const { data, error: err } = await q
      if (err) throw err
      setDatos(data || [])
    } catch (e) { setError(mensajeError(e)) }
    finally { setCargando(false) }
  }, [filtroSerie, filtroEstado])

  useEffect(() => { cargar() }, [cargar])

  // Resumen por serie
  const resumen = datos.reduce((acc, r) => {
    if (!acc[r.serie]) acc[r.serie] = { total: 0, emitidos: 0, pendientes: 0 }
    acc[r.serie].total++
    if (r.estado_informe === 'Emitido') acc[r.serie].emitidos++
    if (!r.fecha_entrega_informe) acc[r.serie].pendientes++
    return acc
  }, {})

  const filtrados = datos.filter(r => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return [r.codigo_informe, r.ot_numero, r.cliente, r.inspector, r.supervisor, r.producto, r.codigo_acta]
      .some(v => String(v || '').toLowerCase().includes(q))
  })

  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

  function clickPersona(e, nombre) {
    e.stopPropagation()
    if (nombre && nombre !== '—') setModalPersona(nombre)
  }

  return (
    <div>
      {/* KPIs por serie */}
      {!cargando && Object.keys(resumen).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
          {['ESI','EAI','IVS','IVA'].filter(s => resumen[s]).map(s => (
            <div key={s} className="card" style={{ borderTop: `4px solid ${COLOR_SERIE[s]}`, padding: '12px 16px', cursor: 'pointer' }}
              onClick={() => { setFiltroSerie(s === filtroSerie ? '' : s); setPagina(0) }}>
              <div style={{ fontWeight: 900, fontSize: 24, color: COLOR_SERIE[s] }}>{resumen[s].total}</div>
              <div style={{ fontWeight: 700, color: COLOR_SERIE[s], fontSize: 13 }}>{s}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                {resumen[s].emitidos} emitidos · {resumen[s].pendientes} sin entrega
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 3, minWidth: 200 }}>
            <label>Buscar</label>
            <input className="input" placeholder="N° informe, OT, cliente, inspector..."
              value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0) }} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 100 }}>
            <label>Serie</label>
            <select className="select" value={filtroSerie} onChange={e => { setFiltroSerie(e.target.value); setPagina(0) }}>
              {SERIES.map(s => <option key={s} value={s}>{s || 'Todas'}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 120 }}>
            <label>Estado informe</label>
            <select className="select" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(0) }}>
              {ESTADOS_INF.map(s => <option key={s} value={s}>{s || 'Todos'}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={cargar} style={{ marginBottom: 2 }}>↻</button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>
        {filtrados.length} registros · Haz clic en cualquier fila para ver la cadena completa
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
      {cargando && <div className="loading-bar" style={{ marginBottom: 14 }} />}

      {!cargando && (
        filtrados.length === 0
          ? <div className="empty-state">No hay informes con esos filtros</div>
          : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>N° Informe</th>
                      <th>Producto / Servicio</th>
                      <th>OT</th>
                      <th>Área</th>
                      <th>Cliente</th>
                      <th>Acta</th>
                      <th>F. Inspección</th>
                      <th>Inspector</th>
                      <th>Supervisor</th>
                      <th>F. Entrega</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((r, i) => {
                      const col = COLOR_SERIE[r.serie] || 'var(--azul)'
                      const sinEntrega = !r.fecha_entrega_informe
                      return (
                        <tr key={r.id || i}
                          onClick={() => setModalInforme(r)}
                          style={{ cursor: 'pointer' }}
                          className="fila-hover">
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 14, color: col }}>
                              {r.codigo_informe}
                            </span>
                          </td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.producto || '—'}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--azul)', fontSize: 13 }}>
                              {r.ot_numero || '—'}
                            </span>
                          </td>
                          <td><span className="badge badge-blue">{r.area || '—'}</span></td>
                          <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.cliente || '—'}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--verde)', fontSize: 13 }}>
                              {r.codigo_acta || <span style={{ color: '#D1D5DB' }}>—</span>}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(r.fecha_inspeccion)}</td>
                          <td>
                            <span
                              style={{ fontWeight: 600, color: r.inspector ? 'var(--azul)' : '#9CA3AF', textDecoration: r.inspector ? 'underline' : 'none', cursor: r.inspector ? 'pointer' : 'default', fontSize: 12 }}
                              onClick={e => clickPersona(e, r.inspector)}>
                              {r.inspector || '—'}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{ fontWeight: 600, color: r.supervisor ? 'var(--azul)' : '#9CA3AF', textDecoration: r.supervisor ? 'underline' : 'none', cursor: r.supervisor ? 'pointer' : 'default', fontSize: 12 }}
                              onClick={e => clickPersona(e, r.supervisor)}>
                              {r.supervisor || '—'}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                            {sinEntrega
                              ? <span style={{ color: '#EF4444', fontWeight: 700 }}>Pendiente</span>
                              : <span style={{ color: '#059669', fontWeight: 700 }}>{fmt(r.fecha_entrega_informe)}</span>}
                          </td>
                          <td>
                            <span className={`badge ${
                              r.estado_informe === 'Emitido'  ? 'badge-green' :
                              r.estado_informe === 'Anulado'  ? 'badge-red'   : 'badge-blue'
                            }`}>{r.estado_informe || 'Reservado'}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {totalPaginas > 1 && (
                <div className="flex-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--borde)' }}>
                  <span className="text-sm">Pág {pagina + 1} / {totalPaginas} · {filtrados.length} registros</span>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}>←</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}>→</button>
                  </div>
                </div>
              )}
            </div>
          )
      )}

      {modalInforme && <ModalInforme fila={modalInforme} onClose={() => setModalInforme(null)} />}
      {modalPersona && <ModalPersona nombre={modalPersona} onClose={() => setModalPersona(null)} />}
    </div>
  )
}

// ── Tab Log Sistema ───────────────────────────────────────────
function TabLog() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 50
  const MODULOS = ['','ots','asignaciones','actas','reservas_informes','documentos']

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')
      let q = supabase.from('v_auditoria_sistema').select('*').order('fecha', { ascending: false }).limit(500)
      if (filtroModulo) q = q.eq('modulo', filtroModulo)
      const { data, err } = await q
      if (err) throw err
      setRegistros(data || [])
    } catch (e) { setError(mensajeError(e)) }
    finally { setCargando(false) }
  }, [filtroModulo])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = registros.filter(r => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return [r.ot_numero, r.nombre_usuario, r.accion, r.detalle].some(v => String(v || '').toLowerCase().includes(q))
  })
  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

  return (
    <div>
      <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 3, minWidth: 200 }}>
            <label>Buscar</label>
            <input className="input" placeholder="OT, usuario, acción..."
              value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0) }} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 130 }}>
            <label>Módulo</label>
            <select className="select" value={filtroModulo} onChange={e => { setFiltroModulo(e.target.value); setPagina(0) }}>
              {MODULOS.map(m => <option key={m} value={m}>{m || 'Todos'}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={cargar} style={{ marginBottom: 2 }}>↻</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
      {cargando && <div className="loading-bar" style={{ marginBottom: 14 }} />}

      {!cargando && (
        visibles.length === 0
          ? <div className="empty-state">Sin registros</div>
          : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Módulo</th>
                      <th>Acción</th>
                      <th>OT</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((r, i) => (
                      <tr key={r.id || i}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(r.fecha, true)}</td>
                        <td style={{ fontWeight: 600 }}>{r.nombre_usuario || '—'}</td>
                        <td><span className="badge badge-blue">{r.modulo}</span></td>
                        <td>
                          <span className={`badge ${
                            r.accion?.includes('CREAR') ? 'badge-green' :
                            r.accion?.includes('CARGAR') ? 'badge-blue' :
                            r.accion?.includes('RESERVAR') ? 'badge-gold' : 'badge-gray'
                          }`}>{r.accion}</span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--azul)' }}>{r.ot_numero || '—'}</td>
                        <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.detalle || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPaginas > 1 && (
                <div className="flex-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--borde)' }}>
                  <span className="text-sm">Pág {pagina + 1} / {totalPaginas}</span>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}>←</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}>→</button>
                  </div>
                </div>
              )}
            </div>
          )
      )}

      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600 }}>
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>JSON — {detalle.accion}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <pre style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, fontSize: 11, overflow: 'auto' }}>
              {JSON.stringify(detalle.datos, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
const modal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.65)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '28px 16px', overflowY: 'auto' },
  box: { width: '100%', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(0,0,0,.3)', overflow: 'hidden', marginBottom: 24 },
  header: { padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  h2: { margin: 0, color: '#fff', fontSize: 18, fontWeight: 800 },
  sub: { margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.75)' },
  cerrar: { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  body: { padding: '20px 24px', maxHeight: '82vh', overflowY: 'auto' },
}

const TABS = [
  { id: 'trazabilidad', label: '🔗 Trazabilidad Informes' },
  { id: 'log',          label: '📋 Log del Sistema' },
]

export default function Auditoria() {
  const [tab, setTab] = useState('trazabilidad')

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1>Auditoría y Trazabilidad</h1>
        <p className="text-sm" style={{ marginTop: 4, color: 'var(--gris)' }}>
          Cadena completa: Informe → OT → Acta → Inspector → Entrega
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t.id ? 700 : 500, fontSize: 14,
              color: tab === t.id ? 'var(--azul)' : '#6B7280',
              borderBottom: tab === t.id ? '2px solid var(--azul)' : '2px solid transparent',
              marginBottom: -2, transition: 'all .15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'trazabilidad' && <TabTrazabilidad />}
      {tab === 'log'          && <TabLog />}
    </div>
  )
}
