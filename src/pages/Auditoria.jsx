import { useEffect, useState, useCallback } from 'react'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ACCIONES = ['', 'CREAR_OT', 'EDITAR_OT', 'CREAR_ASIGNACION', 'CREAR_ACTA', 'RESERVAR_INFORMES', 'CERRAR_OT']
const MODULOS  = ['', 'ots', 'asignaciones', 'actas', 'reservas_informes', 'usuarios', 'documentos']

export default function Auditoria() {
  const { esAdmin } = useAuth()
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [pagina, setPagina] = useState(0)
  const [detalle, setDetalle] = useState(null)
  const POR_PAGINA = 50

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')

      let query = supabase
        .from('v_auditoria_sistema')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(500)

      if (filtroAccion) query = query.eq('accion', filtroAccion)
      if (filtroModulo) query = query.eq('modulo', filtroModulo)
      if (filtroDesde)  query = query.gte('fecha', filtroDesde)
      if (filtroHasta)  query = query.lte('fecha', filtroHasta + 'T23:59:59')

      const { data, error: err } = await query
      if (err) throw err
      setRegistros(data || [])
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }, [filtroAccion, filtroModulo, filtroDesde, filtroHasta])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = registros.filter(r => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return [r.ot_numero, r.nombre_usuario, r.email_usuario, r.accion, r.detalle]
      .some(v => String(v || '').toLowerCase().includes(q))
  })

  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

  function colorAccion(accion) {
    if (!accion) return 'badge-gray'
    if (accion.includes('CREAR')) return 'badge-green'
    if (accion.includes('EDITAR')) return 'badge-blue'
    if (accion.includes('CERRAR')) return 'badge-red'
    if (accion.includes('RESERVAR')) return 'badge-gold'
    return 'badge-amber'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h1>Auditoría del Sistema</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''} · Solo lectura
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div className="grid" style={{ alignItems: 'end' }}>
          <div className="col-4 field">
            <label>Buscar</label>
            <input className="input" placeholder="OT, usuario, acción, detalle..."
              value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0) }} />
          </div>
          <div className="col-2 field">
            <label>Acción</label>
            <select className="select" value={filtroAccion} onChange={e => { setFiltroAccion(e.target.value); setPagina(0) }}>
              {ACCIONES.map(a => <option key={a} value={a}>{a || 'Todas'}</option>)}
            </select>
          </div>
          <div className="col-2 field">
            <label>Módulo</label>
            <select className="select" value={filtroModulo} onChange={e => { setFiltroModulo(e.target.value); setPagina(0) }}>
              {MODULOS.map(m => <option key={m} value={m}>{m || 'Todos'}</option>)}
            </select>
          </div>
          <div className="col-2 field">
            <label>Desde</label>
            <input className="input" type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setPagina(0) }} />
          </div>
          <div className="col-2 field">
            <label>Hasta</label>
            <input className="input" type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setPagina(0) }} />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {cargando && <div className="loading-bar" style={{ marginBottom: 16 }} />}

      {!cargando && (
        <>
          {visibles.length === 0 ? (
            <div className="empty-state">No hay registros de auditoría con esos filtros</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Módulo</th>
                      <th>Acción</th>
                      <th>OT</th>
                      <th>Detalle</th>
                      <th>Datos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((r, i) => (
                      <tr key={r.id || i}>
                        <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>
                          {r.fecha ? new Date(r.fecha).toLocaleString('es-CL') : '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.nombre_usuario || '—'}</div>
                          <div className="text-sm">{r.email_usuario}</div>
                        </td>
                        <td><span className="badge badge-gray">{r.rol_usuario || '—'}</span></td>
                        <td><span className="badge badge-blue">{r.modulo || '—'}</span></td>
                        <td><span className={`badge ${colorAccion(r.accion)}`}>{r.accion || '—'}</span></td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--azul)' }}>
                          {r.ot_numero || '—'}
                        </td>
                        <td className="text-sm" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.detalle || '—'}
                        </td>
                        <td>
                          {r.datos && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(r)}>
                              Ver JSON
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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
          )}
        </>
      )}

      {/* Modal detalle JSON */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 700, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Datos JSON — {detalle.accion}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(null)}>✕ Cerrar</button>
            </div>
            <pre style={{ background: '#F8FAFC', padding: 16, borderRadius: 10, fontSize: 12, overflow: 'auto', margin: 0 }}>
              {JSON.stringify(detalle.datos, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
