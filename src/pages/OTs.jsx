import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, rpc, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADOS = ['', 'Pendiente', 'Sin inspector', 'Asignado', 'En proceso', 'Acta cargada', 'Informe cargado', 'Cerrada documentalmente']
const SEDES = ['', 'ANF', 'SCL', 'CCP']

function badgeEstado(estado) {
  const mapa = {
    'Pendiente': 'badge-red',
    'Sin inspector': 'badge-red',
    'Asignado': 'badge-amber',
    'En proceso': 'badge-blue',
    'Acta cargada': 'badge-blue',
    'Informe cargado': 'badge-green',
    'Cerrada documentalmente': 'badge-green',
  }
  return mapa[estado] || 'badge-gray'
}

export default function OTs() {
  const { usuario, esAdmin, esComercial, esSupervisor } = useAuth()
  const navigate = useNavigate()

  const [ots, setOTs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 25

  const puedeCrearOT = esAdmin() || esComercial()

  const cargarOTs = useCallback(async () => {
    try {
      setCargando(true)
      setError('')

      // Usar función RPC si existe, sino vista directa
      let data
      try {
        data = await rpc('obtener_ots_para_usuario', { p_email: usuario?.email })
      } catch {
        const result = await supabase
          .from('v_portal_ots_listado')
          .select('*')
          .order('fecha_creacion', { ascending: false })

        if (result.error) throw result.error
        data = result.data
      }

      setOTs(data || [])
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }, [usuario?.email])

  useEffect(() => {
    cargarOTs()
  }, [cargarOTs])

  // Filtrado local
  const otsFiltradas = ots.filter(o => {
    const q = busqueda.toLowerCase()
    const matchBusqueda = !q || [o.ot_numero, o.cliente, o.supervisor, o.inspector, o.comercial]
      .some(v => String(v || '').toLowerCase().includes(q))
    const matchSede = !filtroSede || o.sede === filtroSede
    const matchEstado = !filtroEstado || o.estado === filtroEstado
    return matchBusqueda && matchSede && matchEstado
  })

  const otsVisibles = otsFiltradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(otsFiltradas.length / POR_PAGINA)

  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h1>Órdenes de Trabajo</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            {otsFiltradas.length} OT{otsFiltradas.length !== 1 ? 's' : ''} encontradas
          </p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" onClick={cargarOTs}>
            ↻ Actualizar
          </button>
          {puedeCrearOT && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/ots/nueva')}>
              + Nueva OT
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div className="grid" style={{ alignItems: 'end' }}>
          <div className="col-6 field">
            <label>Buscar</label>
            <input
              className="input"
              placeholder="OT, cliente, supervisor, inspector..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(0) }}
            />
          </div>
          <div className="col-3 field">
            <label>Sede</label>
            <select className="select" value={filtroSede} onChange={e => { setFiltroSede(e.target.value); setPagina(0) }}>
              {SEDES.map(s => <option key={s} value={s}>{s || 'Todas las sedes'}</option>)}
            </select>
          </div>
          <div className="col-3 field">
            <label>Estado</label>
            <select className="select" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(0) }}>
              {ESTADOS.map(s => <option key={s} value={s}>{s || 'Todos los estados'}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-secondary btn-sm" onClick={cargarOTs} style={{ marginLeft: 12 }}>
            Reintentar
          </button>
        </div>
      )}

      {/* Loading */}
      {cargando && <div className="loading-bar" style={{ marginBottom: 16 }} />}

      {/* Tabla */}
      {!cargando && (
        <>
          {otsVisibles.length === 0 ? (
            <div className="empty-state">
              {busqueda || filtroSede || filtroEstado
                ? 'No hay OTs con esos filtros'
                : 'No hay órdenes de trabajo registradas'}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>OT</th>
                      <th>Cliente</th>
                      <th>Sede</th>
                      <th>Estado</th>
                      <th>Avance</th>
                      <th>Supervisor</th>
                      <th>Inspector</th>
                      <th>Creación</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otsVisibles.map(ot => (
                      <FilaOT
                        key={ot.id || ot.ot_numero}
                        ot={ot}
                        onVerDetalle={() => navigate(`/ots/${ot.ot_numero}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="flex-between" style={{ padding: '12px 18px', borderTop: '1px solid var(--borde)' }}>
                  <span className="text-sm">
                    Página {pagina + 1} de {totalPaginas} · {otsFiltradas.length} OTs
                  </span>
                  <div className="flex gap-8">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPagina(p => Math.max(0, p - 1))}
                      disabled={pagina === 0}
                    >
                      ← Anterior
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                      disabled={pagina >= totalPaginas - 1}
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FilaOT({ ot, onVerDetalle }) {
  const progreso = Number(ot.progreso || 0)

  return (
    <tr>
      <td>
        <span style={{ fontWeight: 700, color: 'var(--azul)', fontFamily: 'monospace' }}>
          {ot.ot_numero}
        </span>
      </td>
      <td>
        <div style={{ fontWeight: 600 }}>{ot.cliente}</div>
        <div className="text-sm">{ot.tipo_servicio || ot.servicio_contratado || ''}</div>
      </td>
      <td>
        <span className="badge badge-blue">{ot.sede}</span>
      </td>
      <td>
        <span className={`badge ${badgeEstado(ot.estado)}`}>{ot.estado}</span>
      </td>
      <td style={{ minWidth: 100 }}>
        <div className="progress-track">
          <div
            className={`progress-fill ${progreso >= 100 ? 'completa' : ''}`}
            style={{ width: `${progreso}%` }}
          />
        </div>
        <div className="text-sm" style={{ textAlign: 'right', marginTop: 3 }}>{progreso}%</div>
      </td>
      <td>{ot.supervisor || '—'}</td>
      <td>{ot.inspector || '—'}</td>
      <td className="text-sm">{ot.fecha_creacion ? new Date(ot.fecha_creacion).toLocaleDateString('es-CL') : '—'}</td>
      <td>
        <button className="btn btn-secondary btn-sm" onClick={onVerDetalle}>
          Ver detalle
        </button>
      </td>
    </tr>
  )
}
