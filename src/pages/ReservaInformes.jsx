// ============================================================
// ReservaInformes.jsx — Vista global de reservas de informes
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'

const SERIES = ['', 'ESI', 'EAI', 'IVS', 'IVA']
const ESTADOS = ['', 'Reservado', 'Emitido', 'Anulado']

function padNum(num, serie) {
  if (serie === 'IVS' || serie === 'IVA') return String(num).padStart(4, '0')
  return String(num)
}

export default function ReservaInformes() {
  const navigate = useNavigate()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroSerie, setFiltroSerie] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 40

  // Resumen por serie
  const [resumen, setResumen] = useState({})

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      setError('')
      let q = supabase
        .from('numeros_informe')
        .select('*')
        .order('numero_correlativo', { ascending: false })
        .limit(1000)
      if (filtroSerie)  q = q.eq('serie', filtroSerie)
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      const { data, error: err } = await q
      if (err) throw err
      setDatos(data || [])

      // Calcular resumen
      const res = {}
      ;(data || []).forEach(r => {
        if (!res[r.serie]) res[r.serie] = { total: 0, ultimo: 0 }
        res[r.serie].total++
        if (r.numero_correlativo > res[r.serie].ultimo) res[r.serie].ultimo = r.numero_correlativo
      })
      setResumen(res)
    } catch (e) { setError(mensajeError(e)) }
    finally { setCargando(false) }
  }, [filtroSerie, filtroEstado])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = datos.filter(r => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return [r.ot_numero, r.serie, `${r.serie}-${padNum(r.numero_correlativo, r.serie)}`]
      .some(v => String(v || '').toLowerCase().includes(q))
  })

  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

  const colorSerie = { ESI: '#185FA5', EAI: '#7C3AED', IVS: '#059669', IVA: '#D97706' }

  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h1>Reserva de Informes</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            {filtrados.length} número{filtrados.length !== 1 ? 's' : ''} registrados
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
      </div>

      {/* KPIs por serie */}
      {!cargando && Object.keys(resumen).length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {['ESI', 'EAI', 'IVS', 'IVA'].filter(s => resumen[s]).map(s => (
            <div key={s} className="card" style={{ flex: 1, minWidth: 140, borderTop: `4px solid ${colorSerie[s]}`, textAlign: 'center', padding: '12px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: colorSerie[s] }}>
                {s}-{padNum(resumen[s].ultimo, s)}
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
            <input className="input" placeholder="OT, código informe..."
              value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0) }} />
          </div>
          <div className="col-3 field">
            <label>Serie</label>
            <select className="select" value={filtroSerie} onChange={e => { setFiltroSerie(e.target.value); setPagina(0) }}>
              {SERIES.map(s => <option key={s} value={s}>{s || 'Todas'}</option>)}
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
                      <th>OT</th>
                      <th>Estado</th>
                      <th>Registrado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((r, i) => {
                      const codigo = `${r.serie}-${padNum(r.numero_correlativo, r.serie)}`
                      const color = colorSerie[r.serie] || 'var(--azul)'
                      return (
                        <tr key={r.id || i}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color }}>
                              {codigo}
                            </span>
                          </td>
                          <td>
                            <span className="badge" style={{ background: color + '20', color, border: `1px solid ${color}40` }}>
                              {r.serie}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {padNum(r.numero_correlativo, r.serie)}
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
                              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/ots/${r.ot_numero}`)}>
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
