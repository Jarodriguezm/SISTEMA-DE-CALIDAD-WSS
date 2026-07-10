import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const ESTADO_BADGE = {
  BORRADOR:    { label: 'Borrador',    bg: '#F1F5F9', color: '#475569' },
  EN_REVISION: { label: 'En revisión', bg: '#FEF3C7', color: '#92400E' },
  APROBADO:    { label: 'Aprobado',    bg: '#D1FAE5', color: '#065F46' },
  RECHAZADO:   { label: 'Rechazado',   bg: '#FEE2E2', color: '#991B1B' },
}

const TIPO_INFO = {
  TANQUE:     { icon: '🛢️', label: 'Tanque',     color: '#1D4ED8' },
  TUBERIA:    { icon: '🔩', label: 'Tubería',    color: '#047857' },
  ESTRUCTURA: { icon: '🏗️', label: 'Estructura', color: '#92400E' },
  IZAJE:      { icon: '🏋️', label: 'Izaje',      color: '#7C3AED' },
}

const RESULTADO_BADGE = {
  CONFORME:      { label: 'Conforme',      bg: '#D1FAE5', color: '#065F46' },
  NO_CONFORME:   { label: 'No Conforme',   bg: '#FEE2E2', color: '#991B1B' },
  CONDICIONADO:  { label: 'Condicionado',  bg: '#FEF3C7', color: '#92400E' },
}

export default function Informes() {
  const navigate  = useNavigate()
  const { usuario } = useAuth()
  const [informes, setInformes]   = useState([])
  const [cargando, setCargando]   = useState(true)
  const [filtroEstado, setFiltro] = useState('TODOS')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [busqueda, setBusqueda]   = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('informes')
      .select('id,numero,tipo_equipo,ot_numero,cliente_nombre,inspector_nombre,supervisor_nombre,estado,resultado,fecha_inspeccion,created_at')
      .order('created_at', { ascending: false })
    setInformes(data || [])
    setCargando(false)
  }

  const filtrados = informes.filter(i => {
    if (filtroEstado !== 'TODOS' && i.estado !== filtroEstado) return false
    if (filtroTipo   !== 'TODOS' && i.tipo_equipo !== filtroTipo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return [i.numero, i.ot_numero, i.cliente_nombre, i.inspector_nombre]
        .some(v => (v || '').toLowerCase().includes(q))
    }
    return true
  })

  // Contadores
  const contadores = {
    TODOS:       informes.length,
    BORRADOR:    informes.filter(i => i.estado === 'BORRADOR').length,
    EN_REVISION: informes.filter(i => i.estado === 'EN_REVISION').length,
    APROBADO:    informes.filter(i => i.estado === 'APROBADO').length,
    RECHAZADO:   informes.filter(i => i.estado === 'RECHAZADO').length,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h1>📋 Informes de Inspección</h1>
          <p style={{ color: 'var(--gris)', fontSize: 14, marginTop: 4 }}>
            {informes.length} informes · WSS División Inspección Industrial
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/informes/nuevo')}>
          + Nuevo Informe
        </button>
      </div>

      {/* Filtros estado */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['TODOS', 'BORRADOR', 'EN_REVISION', 'APROBADO', 'RECHAZADO'].map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: filtroEstado === e ? '1px solid #1E3A5F' : '1px solid #CBD5E1',
              background: filtroEstado === e ? '#1E3A5F' : '#fff',
              color: filtroEstado === e ? '#fff' : '#475569',
            }}>
            {e === 'TODOS' ? 'Todos' : ESTADO_BADGE[e]?.label} ({contadores[e]})
          </button>
        ))}

        <select className="input" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          style={{ marginLeft: 8, fontSize: 12, padding: '4px 10px', height: 32 }}>
          <option value="TODOS">Todos los tipos</option>
          <option value="TANQUE">🛢️ Tanque</option>
          <option value="TUBERIA">🔩 Tubería</option>
          <option value="ESTRUCTURA">🏗️ Estructura</option>
          <option value="IZAJE">🏋️ Izaje</option>
        </select>

        <input className="input" placeholder="Buscar número, OT, cliente..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ fontSize: 12, padding: '4px 10px', height: 32, minWidth: 220 }} />
      </div>

      {/* Tabla */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--gris)' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--gris)' }}>
          {informes.length === 0
            ? 'No hay informes aún. Crea el primer informe con "＋ Nuevo Informe".'
            : 'Sin resultados para los filtros seleccionados.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                {['Número', 'Tipo', 'OT', 'Cliente', 'Inspector', 'Fecha', 'Estado', 'Resultado', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((inf, i) => {
                const tipo  = TIPO_INFO[inf.tipo_equipo]    || { icon: '📋', label: inf.tipo_equipo, color: '#475569' }
                const est   = ESTADO_BADGE[inf.estado]      || ESTADO_BADGE.BORRADOR
                const res   = RESULTADO_BADGE[inf.resultado]
                return (
                  <tr key={inf.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>
                      {inf.numero || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 12, color: tipo.color, fontWeight: 600 }}>
                        {tipo.icon} {tipo.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>{inf.ot_numero || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{inf.cliente_nombre || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>{inf.inspector_nombre || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>
                      {inf.fecha_inspeccion ? new Date(inf.fecha_inspeccion).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ ...S.badge, background: est.bg, color: est.color }}>{est.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {res ? <span style={{ ...S.badge, background: res.bg, color: res.color }}>{res.label}</span> : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/informes/${inf.id}`)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const S = {
  badge: { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
}
