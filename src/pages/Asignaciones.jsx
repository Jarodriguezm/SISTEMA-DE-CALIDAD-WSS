// ============================================================
// Asignaciones.jsx — Vista global de todas las asignaciones
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'

const ESTADOS = ['', 'Programada', 'Realizada', 'Cancelada', 'Pendiente']

export default function Asignaciones() {
  const navigate = useNavigate()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 30

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')
      let q = supabase
        .from('asignaciones')
        .select('*')
        .order('fecha_inspeccion', { ascending: false })
        .limit(500)
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      if (filtroDesde)  q = q.gte('fecha_inspeccion', filtroDesde)
      if (filtroHasta)  q = q.lte('fecha_inspeccion', filtroHasta)
      const { data, error: err } = await q
      if (err) throw err
      setDatos(data || [])
    } catch (e) { setError(mensajeError(e)) }
    finally { setCargando(false) }
  }, [filtroEstado, filtroDesde, filtroHasta])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = datos.filter(a => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return [a.ot_numero, a.inspectores_asignados, a.supervisor, a.descripcion_actividad, a.tipos_inspeccion]
      .some(v => String(v || '').toLowerCase().includes(q))
  })

  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h1>Asignaciones</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            {filtrados.length} asignación{filtrados.length !== 1 ? 'es' : ''} encontradas
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div className="grid" style={{ alignItems: 'end' }}>
          <div className="col-4 field">
            <label>Buscar</label>
            <input className="input" placeholder="OT, inspector, descripción..."
              value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0) }} />
          </div>
          <div className="col-2 field">
            <label>Estado</label>
            <select className="select" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(0) }}>
              {ESTADOS.map(s => <option key={s} value={s}>{s || 'Todos'}</option>)}
            </select>
          </div>
          <div className="col-3 field">
            <label>Desde</label>
            <input className="input" type="date" value={filtroDesde}
              onChange={e => { setFiltroDesde(e.target.value); setPagina(0) }} />
          </div>
          <div className="col-3 field">
            <label>Hasta</label>
            <input className="input" type="date" value={filtroHasta}
              onChange={e => { setFiltroHasta(e.target.value); setPagina(0) }} />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {cargando && <div className="loading-bar" style={{ marginBottom: 16 }} />}

      {!cargando && (
        visibles.length === 0
          ? <div className="empty-state">No hay asignaciones con esos filtros</div>
          : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>OT</th>
                      <th>Inspector(es)</th>
                      <th>Supervisor</th>
                      <th>Fecha inspección</th>
                      <th>Tipos</th>
                      <th>Vehículo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((a, i) => (
                      <tr key={a.id || i}>
                        <td>
                          <span
                            style={{ fontWeight: 700, color: 'var(--azul)', fontFamily: 'monospace', cursor: 'pointer' }}
                            onClick={() => navigate(`/ots/${a.ot_numero}`)}
                          >
                            {a.ot_numero}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{a.inspectores_asignados || '—'}</td>
                        <td className="text-sm">{a.supervisor || '—'}</td>
                        <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>
                          {a.fecha_inspeccion
                            ? new Date(a.fecha_inspeccion + 'T00:00:00').toLocaleDateString('es-CL')
                            : '—'}
                          {a.hora ? ` · ${a.hora}` : ''}
                        </td>
                        <td className="text-sm">{a.tipos_inspeccion || '—'}</td>
                        <td className="text-sm">{a.vehiculo || '—'}</td>
                        <td>
                          <span className={`badge ${
                            a.estado === 'Realizada' ? 'badge-green' :
                            a.estado === 'Cancelada' ? 'badge-red' : 'badge-amber'
                          }`}>{a.estado || 'Programada'}</span>
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/ots/${a.ot_numero}`)}>
                            Ver OT
                          </button>
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
          )
      )}
    </div>
  )
}
