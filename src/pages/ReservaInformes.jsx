// ============================================================
// ReservaInformes.jsx — Reserva de Informes DII
// Serie única DII, diferenciada por sede (SCL / ANF / CCP)
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADOS = ['', 'Reservado', 'Emitido', 'Anulado']
const AREAS   = ['', 'END', 'IZL', 'TRZ', 'VER']

const NOMBRE_SEDE = {
  SCL: 'Santiago',
  ANF: 'Antofagasta',
  CCP: 'Concepción',
}

const COLOR_SEDE = {
  SCL: '#185FA5',
  ANF: '#7C3AED',
  CCP: '#059669',
}

export default function ReservaInformes() {
  const navigate    = useNavigate()
  const { usuario } = useAuth()

  // ── listado ──────────────────────────────────────────────────
  const [datos,        setDatos]        = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [error,        setError]        = useState('')
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroSede,   setFiltroSede]   = useState('')
  const [pagina,       setPagina]       = useState(0)
  const POR_PAGINA = 40
  const [resumen,      setResumen]      = useState({})
  const [mensajeExito, setMensajeExito] = useState('')

  // ── formulario nueva reserva ─────────────────────────────────
  const [mostrarForm,    setMostrarForm]    = useState(false)
  const [guardando,      setGuardando]      = useState(false)
  const [errorForm,      setErrorForm]      = useState('')
  const [otsDisponibles, setOTsDisponibles] = useState([])

  const [form, setForm] = useState({
    ot_numero:           '',
    sede:                '',          // auto-cargado desde OT
    cantidad:            1,
    area:                '',
    producto:            '',
    acta:                '',
    fecha_inspeccion:    '',
    fecha_entrega:       '',
    inspector:           '',
    observacion:         '',
  })

  // ── carga del listado ────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')
      let q = supabase
        .from('numeros_informe')
        .select('*')
        .order('numero_correlativo', { ascending: false })
        .limit(1000)
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      if (filtroSede)   q = q.eq('sede', filtroSede)
      const { data, error: err } = await q
      if (err) throw err
      setDatos(data || [])

      // KPIs por sede
      const res = {}
      ;(data || []).forEach(r => {
        const sede = r.sede || 'SIN SEDE'
        if (!res[sede]) res[sede] = { total: 0, ultimo: 0 }
        res[sede].total++
        if (r.numero_correlativo > res[sede].ultimo)
          res[sede].ultimo = r.numero_correlativo
      })
      setResumen(res)
    } catch (e) { setError(mensajeError(e)) }
    finally { setCargando(false) }
  }, [filtroEstado, filtroSede])

  useEffect(() => { cargar() }, [cargar])

  // ── cargar OTs para el selector ──────────────────────────────
  useEffect(() => {
    if (!mostrarForm) return
    supabase
      .from('ots')
      .select('ot_numero, cliente, sede')
      .order('ot_numero', { ascending: false })
      .limit(200)
      .then(({ data }) => setOTsDisponibles(data || []))
  }, [mostrarForm])

  // ── cambio de OT → auto-detectar sede ───────────────────────
  function handleOTChange(ot_numero) {
    const ot = otsDisponibles.find(o => o.ot_numero === ot_numero)
    setForm(f => ({ ...f, ot_numero, sede: ot?.sede || '' }))
  }

  function setField(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrorForm('')
  }

  // ── reservar números ─────────────────────────────────────────
  async function handleReservar(e) {
    e.preventDefault()
    if (!form.ot_numero) { setErrorForm('Selecciona una OT'); return }
    if (!form.sede)       { setErrorForm('La OT no tiene sede asignada'); return }
    if (form.cantidad < 1 || form.cantidad > 50) { setErrorForm('Cantidad entre 1 y 50'); return }

    setGuardando(true)
    setErrorForm('')
    try {
      // Obtener siguiente correlativo DII
      const { data: nextNum, error: rpcErr } = await supabase
        .rpc('siguiente_numero_informe', { p_serie: 'DII' })
      if (rpcErr) throw rpcErr
      if (!nextNum) throw new Error('No se pudo obtener el siguiente número')

      const reservaId    = 'RINF-' + crypto.randomUUID()
      const reservadoPor = ((usuario?.nombre || '') + ' ' + (usuario?.apellido || '')).trim()
        || usuario?.email || 'Sistema'

      const records = Array.from({ length: Number(form.cantidad) }, (_, i) => {
        const num = nextNum + i
        return {
          reserva_id:            reservaId,
          ot_numero:             form.ot_numero,
          sede:                  form.sede,
          serie:                 'DII',
          numero_correlativo:    num,
          codigo_informe:        `DII-${num}`,
          area:                  form.area             || null,
          producto:              form.producto          || null,
          acta_asociada:         form.acta             || null,
          fecha_inspeccion:      form.fecha_inspeccion || null,
          fecha_entrega_informe: form.fecha_entrega    || null,
          inspector:             form.inspector         || null,
          observacion:           form.observacion       || null,
          estado:                'Reservado',
          created_by:            reservadoPor,
        }
      })

      const { error: insErr } = await supabase.from('numeros_informe').insert(records)
      if (insErr) throw insErr

      const desde = `DII-${nextNum}`
      const hasta = Number(form.cantidad) > 1 ? ` a DII-${nextNum + Number(form.cantidad) - 1}` : ''
      setMensajeExito(`✅ ${form.cantidad} número${form.cantidad > 1 ? 's' : ''} reservados: ${desde}${hasta} · ${NOMBRE_SEDE[form.sede] || form.sede}`)
      setTimeout(() => setMensajeExito(''), 6000)

      setMostrarForm(false)
      setForm({ ot_numero: '', sede: '', cantidad: 1, area: '', producto: '',
                acta: '', fecha_inspeccion: '', fecha_entrega: '', inspector: '', observacion: '' })
      cargar()
    } catch (e) {
      setErrorForm(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  // ── filtrado ─────────────────────────────────────────────────
  const filtrados = datos.filter(r => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return [r.ot_numero, r.codigo_informe, `DII-${r.numero_correlativo}`,
            NOMBRE_SEDE[r.sede], r.sede]
      .some(v => String(v || '').toLowerCase().includes(q))
  })
  const visibles     = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

  // ── render ───────────────────────────────────────────────────
  return (
    <div>
      {/* Modal Nueva Reserva */}
      {mostrarForm && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && !guardando && setMostrarForm(false)}>
          <div style={S.modal}>

            <div style={S.modalHeader}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 17 }}>Nueva Reserva de Informe</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
                  Serie DII · Correlativo automático · Sede según la OT
                </p>
              </div>
              <button onClick={() => setMostrarForm(false)} style={S.btnCerrar} disabled={guardando}>✕</button>
            </div>

            <form onSubmit={handleReservar} style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: '75vh' }}>

              {errorForm && (
                <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠ {errorForm}</div>
              )}

              <Seccion titulo="Identificación">
                <div className="grid">
                  <div className="col-7 field">
                    <label>N° OT *</label>
                    <select className="select" value={form.ot_numero}
                      onChange={e => handleOTChange(e.target.value)} disabled={guardando}>
                      <option value="">— Selecciona la OT —</option>
                      {otsDisponibles.map(o => (
                        <option key={o.ot_numero} value={o.ot_numero}>
                          {o.ot_numero} · {o.cliente} · {NOMBRE_SEDE[o.sede] || o.sede}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-2 field">
                    <label>Sede</label>
                    <div style={{
                      padding: '8px 12px', border: '1.5px solid var(--borde)', borderRadius: 8,
                      background: '#F9FAFB', fontSize: 14, fontWeight: 700,
                      color: COLOR_SEDE[form.sede] || 'var(--gris)',
                    }}>
                      {form.sede ? `${form.sede} · ${NOMBRE_SEDE[form.sede] || form.sede}` : '—'}
                    </div>
                  </div>
                  <div className="col-3 field">
                    <label>Cantidad *</label>
                    <input className="input" type="number" min="1" max="50"
                      value={form.cantidad}
                      onChange={e => setField('cantidad', parseInt(e.target.value) || 1)}
                      disabled={guardando} />
                    <span className="text-sm">Números consecutivos</span>
                  </div>
                </div>

                {/* Preview serie */}
                {form.ot_numero && (
                  <div style={S.previewBox}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: '#1A3A5C' }}>
                      DII-11650
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--gris)', marginLeft: 8 }}>
                      (el número exacto se asigna al guardar)
                    </span>
                    {form.sede && (
                      <span style={{
                        marginLeft: 12, fontSize: 12, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 99, background: (COLOR_SEDE[form.sede] || '#185FA5') + '20',
                        color: COLOR_SEDE[form.sede] || '#185FA5',
                      }}>
                        {form.sede} · {NOMBRE_SEDE[form.sede]}
                      </span>
                    )}
                  </div>
                )}
              </Seccion>

              <Seccion titulo="Datos del informe">
                <div className="grid">
                  <div className="col-6 field">
                    <label>Producto / servicio</label>
                    <input className="input" placeholder="Ej: Inspección VT a 8 ejes de ferrocarril"
                      value={form.producto} onChange={e => setField('producto', e.target.value)} disabled={guardando} />
                  </div>
                  <div className="col-3 field">
                    <label>Área</label>
                    <select className="select" value={form.area}
                      onChange={e => setField('area', e.target.value)} disabled={guardando}>
                      {AREAS.map(a => <option key={a} value={a}>{a || '— Sin área —'}</option>)}
                    </select>
                  </div>
                  <div className="col-3 field">
                    <label>Acta asociada</label>
                    <input className="input" placeholder="Ej: D-3852"
                      value={form.acta} onChange={e => setField('acta', e.target.value)} disabled={guardando} />
                  </div>
                  <div className="col-6 field">
                    <label>Inspector(es)</label>
                    <input className="input" placeholder="Nombre(s) del inspector"
                      value={form.inspector} onChange={e => setField('inspector', e.target.value)} disabled={guardando} />
                  </div>
                  <div className="col-3 field">
                    <label>Fecha inspección</label>
                    <input className="input" type="date"
                      value={form.fecha_inspeccion} onChange={e => setField('fecha_inspeccion', e.target.value)} disabled={guardando} />
                  </div>
                  <div className="col-3 field">
                    <label>Fecha entrega informe</label>
                    <input className="input" type="date"
                      value={form.fecha_entrega} onChange={e => setField('fecha_entrega', e.target.value)} disabled={guardando} />
                  </div>
                  <div className="col-12 field">
                    <label>Observaciones</label>
                    <input className="input" placeholder="Opcional"
                      value={form.observacion} onChange={e => setField('observacion', e.target.value)} disabled={guardando} />
                  </div>
                </div>
              </Seccion>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10,
                paddingTop: 16, borderTop: '1px solid var(--borde)', marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setMostrarForm(false)} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-lg"
                  disabled={guardando || !form.ot_numero}>
                  {guardando
                    ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Reservando...</>
                    : `✓ Reservar ${form.cantidad} número${form.cantidad > 1 ? 's' : ''} DII`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h1>Reserva de Informes</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            {filtrados.length} número{filtrados.length !== 1 ? 's' : ''} registrados · Serie DII
          </p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setMostrarForm(true); setErrorForm('') }}>
            + Nueva Reserva
          </button>
        </div>
      </div>

      {mensajeExito && (
        <div className="alert alert-ok" style={{ marginBottom: 16 }}>{mensajeExito}</div>
      )}

      {/* KPIs por sede */}
      {!cargando && Object.keys(resumen).length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {['SCL', 'ANF', 'CCP'].filter(s => resumen[s]).map(s => (
            <div key={s} className="card" style={{
              flex: 1, minWidth: 140,
              borderTop: `4px solid ${COLOR_SEDE[s] || '#999'}`,
              textAlign: 'center', padding: '12px 16px',
            }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: COLOR_SEDE[s] || '#999' }}>
                DII-{resumen[s].ultimo}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLOR_SEDE[s] || '#999', marginTop: 2 }}>
                {NOMBRE_SEDE[s] || s}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gris)', marginTop: 2 }}>
                Último · {resumen[s].total} reservas
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div className="grid" style={{ alignItems: 'end' }}>
          <div className="col-5 field">
            <label>Buscar</label>
            <input className="input" placeholder="OT, código DII, sede..."
              value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0) }} />
          </div>
          <div className="col-3 field">
            <label>Sede</label>
            <select className="select" value={filtroSede} onChange={e => { setFiltroSede(e.target.value); setPagina(0) }}>
              <option value="">Todas las sedes</option>
              <option value="SCL">Santiago</option>
              <option value="ANF">Antofagasta</option>
              <option value="CCP">Concepción</option>
            </select>
          </div>
          <div className="col-4 field">
            <label>Estado</label>
            <select className="select" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(0) }}>
              {ESTADOS.map(s => <option key={s} value={s}>{s || 'Todos'}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {cargando && <div className="loading-bar" style={{ marginBottom: 16 }} />}

      {!cargando && (
        visibles.length === 0
          ? <div className="empty-state">No hay reservas con esos filtros</div>
          : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Serie</th>
                      <th>N° Correlativo</th>
                      <th>Sede</th>
                      <th>OT</th>
                      <th>Estado</th>
                      <th>Registrado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((r, i) => {
                      const codigo = r.codigo_informe || `${r.serie}-${r.numero_correlativo}`
                      const colorSede = COLOR_SEDE[r.sede] || 'var(--gris)'
                      return (
                        <tr key={r.id || i}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: '#1A3A5C' }}>
                              {codigo}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-blue">{r.serie || 'DII'}</span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {r.numero_correlativo}
                          </td>
                          <td>
                            {r.sede
                              ? <span className="badge" style={{
                                  background: colorSede + '20',
                                  color: colorSede,
                                  border: `1px solid ${colorSede}40`,
                                }}>
                                  {r.sede} · {NOMBRE_SEDE[r.sede] || r.sede}
                                </span>
                              : <span style={{ color: 'var(--gris)' }}>—</span>}
                          </td>
                          <td>
                            <span
                              style={{ fontWeight: 700, color: 'var(--azul)', fontFamily: 'monospace', cursor: 'pointer' }}
                              onClick={() => navigate(`/ots/${r.ot_numero}`)}
                            >
                              {r.ot_numero || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              r.estado === 'Emitido'  ? 'badge-green' :
                              r.estado === 'Anulado'  ? 'badge-red'   : 'badge-blue'
                            }`}>{r.estado || 'Reservado'}</span>
                          </td>
                          <td className="text-sm">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('es-CL') : '—'}
                          </td>
                          <td>
                            {r.ot_numero && (
                              <button className="btn btn-secondary btn-sm"
                                onClick={() => navigate(`/ots/${r.ot_numero}`)}>
                                Ver OT
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {totalPaginas > 1 && (
                <div className="flex-between" style={{ padding: '12px 18px', borderTop: '1px solid var(--borde)' }}>
                  <span className="text-sm">Página {pagina + 1} de {totalPaginas}</span>
                  <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}>← Anterior</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}>Siguiente →</button>
                  </div>
                </div>
              )}
            </div>
          )
      )}
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--azul)',
        textTransform: 'uppercase', letterSpacing: '.5px',
        borderBottom: '2px solid var(--azul)', paddingBottom: 5, marginBottom: 12,
      }}>{titulo}</div>
      {children}
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,.6)', zIndex: 300,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '24px 16px', overflowY: 'auto',
  },
  modal: {
    width: '100%', maxWidth: 820,
    background: '#fff', borderRadius: 18,
    boxShadow: '0 24px 80px rgba(0,0,0,.3)',
    overflow: 'hidden', marginBottom: 24,
  },
  modalHeader: {
    background: 'linear-gradient(135deg, #0E2A45, #17395C)',
    padding: '16px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  btnCerrar: {
    background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
    width: 32, height: 32, borderRadius: 8, fontSize: 14, cursor: 'pointer',
  },
  previewBox: {
    background: '#EEF5FF', border: '1px solid #85B7EB',
    borderRadius: 8, padding: '10px 14px', marginTop: 10,
    fontSize: 13, lineHeight: 1.7, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
  },
}
