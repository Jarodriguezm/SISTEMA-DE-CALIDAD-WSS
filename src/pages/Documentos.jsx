import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'

// Las 11 etapas manuales (mismas que TabDocumentos.jsx)
const ETAPAS = [
  { num: '01', tipo: 'correo_cotizacion', nombre: 'Correo cotización',   actor: 'Comercial',   icono: '📧' },
  { num: '02', tipo: 'cotizacion',         nombre: 'Cotización',          actor: 'Comercial',   icono: '📋' },
  { num: '03', tipo: 'envio_cotizacion',   nombre: 'Envío cotización',    actor: 'Comercial',   icono: '📤' },
  { num: '04', tipo: 'orden_compra',       nombre: 'Orden de compra',     actor: 'Cliente',     icono: '🛒' },
  { num: '05', tipo: 'correo_oc',          nombre: 'Correo OC',           actor: 'Comercial',   icono: '📨' },
  { num: '07', tipo: 'asignacion',         nombre: 'Asignación',          actor: 'Supervisor',  icono: '👥' },
  { num: '08', tipo: 'acta',              nombre: 'Acta terreno',        actor: 'Inspector',   icono: '📝' },
  { num: '09', tipo: 'informe',           nombre: 'Informe(s)',          actor: 'Inspector',   icono: '📊' },
  { num: '10', tipo: 'envio_informes',    nombre: 'Envío informes',      actor: 'Inspector',   icono: '📬' },
  { num: '11', tipo: 'sdf',              nombre: 'SDF',                 actor: 'Comercial',   icono: '💰' },
  { num: '12', tipo: 'factura',          nombre: 'Factura',             actor: 'Facturación', icono: '🧾' },
]

const FILTROS = [
  { key: 'pendientes', label: 'Con pendientes' },
  { key: 'todas',      label: 'Todas las OTs'  },
  { key: 'completas',  label: 'Completas'       },
]

export default function Documentos() {
  const [ots, setOts]         = useState([])
  const [docs, setDocs]       = useState({})   // { ot_numero: Set<tipo> }
  const [cargando, setCargando] = useState(true)
  const [error, setError]     = useState('')
  const [filtro, setFiltro]   = useState('pendientes')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setCargando(true)
      const [{ data: otsData, error: e1 }, { data: docsData, error: e2 }] = await Promise.all([
        supabase.from('ots').select('ot_numero, cliente, estado').order('created_at', { ascending: false }),
        supabase.from('documentos_ot').select('ot_numero, tipo'),
      ])
      if (e1) throw e1
      if (e2) throw e2

      // Construir mapa ot_numero → Set de tipos cargados
      const mapa = {}
      for (const d of (docsData || [])) {
        if (!mapa[d.ot_numero]) mapa[d.ot_numero] = new Set()
        mapa[d.ot_numero].add(d.tipo)
      }
      setOts(otsData || [])
      setDocs(mapa)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  function etapasCompletas(ot_numero) {
    const set = docs[ot_numero] || new Set()
    return ETAPAS.filter(e => set.has(e.tipo)).length
  }

  function etapasFaltantes(ot_numero) {
    const set = docs[ot_numero] || new Set()
    return ETAPAS.filter(e => !set.has(e.tipo))
  }

  // Filtrar OTs
  let otsFiltradas = ots.filter(ot => {
    const completas = etapasCompletas(ot.ot_numero)
    if (filtro === 'completas')  return completas === 11
    if (filtro === 'pendientes') return completas < 11
    return true
  })

  if (busqueda) {
    const q = busqueda.toLowerCase()
    otsFiltradas = otsFiltradas.filter(ot =>
      ot.ot_numero?.toLowerCase().includes(q) ||
      ot.cliente?.toLowerCase().includes(q)
    )
  }

  // Totales
  const totalEtapas    = ots.length * 11
  const etapasCargadas = ots.reduce((acc, ot) => acc + etapasCompletas(ot.ot_numero), 0)
  const etapasPend     = totalEtapas - etapasCargadas
  const pct            = totalEtapas > 0 ? Math.round((etapasCargadas / totalEtapas) * 100) : 0

  if (cargando) return <div style={{ padding: 40, color: 'var(--gris)' }}>Cargando...</div>
  if (error)    return <div style={{ padding: 40, color: 'var(--rojo)' }}>Error: {error}</div>

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Checklist Documentos</h1>
        <p style={{ color: 'var(--gris)', margin: 0 }}>
          Estado de las 11 etapas documentales por OT
        </p>
      </div>

      {/* KPIs resumen */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KPIChip label="Etapas cargadas"  valor={etapasCargadas} color="var(--verde)"  />
        <KPIChip label="Etapas pendientes" valor={etapasPend}    color="var(--rojo)"   />
        <KPIChip label="OTs completas"    valor={ots.filter(o => etapasCompletas(o.ot_numero) === 11).length} color="var(--azul)" />
        <div className="card" style={{ flex: 1, minWidth: 200, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--gris)' }}>Progreso general</span>
            <strong>{pct}%</strong>
          </div>
          <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--verde)', borderRadius: 4, transition: 'width .4s' }} />
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                borderColor: filtro === f.key ? 'var(--azul)' : '#D1D5DB',
                background: filtro === f.key ? 'var(--azul)' : '#fff',
                color: filtro === f.key ? '#fff' : 'var(--texto)',
                fontSize: 13, cursor: 'pointer', fontWeight: filtro === f.key ? 700 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar OT o empresa..."
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, width: 220 }}
        />
        <span style={{ fontSize: 13, color: 'var(--gris)', marginLeft: 'auto' }}>
          {otsFiltradas.length} OTs
        </span>
      </div>

      {/* Leyenda etapas */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {ETAPAS.map(e => (
          <span key={e.tipo} style={{ fontSize: 11, background: '#F3F4F6', borderRadius: 6, padding: '3px 8px', color: '#374151' }}>
            <strong>{e.icono} E{e.num}</strong> {e.nombre}
          </span>
        ))}
      </div>

      {/* Tabla */}
      {otsFiltradas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gris)' }}>
          {filtro === 'completas' ? '🎉 No hay OTs con todas las etapas completas aún' : 'No hay OTs con pendientes'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                <th style={th}>OT / Empresa</th>
                <th style={th}>Estado</th>
                {ETAPAS.map(e => (
                  <th key={e.tipo} style={{ ...th, width: 36, padding: '8px 4px', textAlign: 'center' }} title={`E${e.num} ${e.nombre} (${e.actor})`}>
                    {e.icono}
                  </th>
                ))}
                <th style={{ ...th, textAlign: 'center' }}>Progreso</th>
              </tr>
            </thead>
            <tbody>
              {otsFiltradas.map(ot => {
                const tiposOT    = docs[ot.ot_numero] || new Set()
                const completas  = etapasCompletas(ot.ot_numero)
                const faltantes  = etapasFaltantes(ot.ot_numero)
                const pctOT      = Math.round((completas / 11) * 100)

                return (
                  <tr key={ot.ot_numero} style={{ borderBottom: '1px solid #F3F4F6' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={td}>
                      <Link to={`/ots/${ot.ot_numero}`} style={{ color: 'var(--azul)', fontWeight: 700, textDecoration: 'none' }}>
                        {ot.ot_numero}
                      </Link>
                      <div style={{ fontSize: 11, color: 'var(--gris)', marginTop: 2 }}>{ot.cliente}</div>
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, background: '#F3F4F6', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        {ot.estado}
                      </span>
                    </td>
                    {ETAPAS.map(e => {
                      const ok = tiposOT.has(e.tipo)
                      return (
                        <td key={e.tipo} style={{ ...td, textAlign: 'center', padding: '8px 4px' }}
                          title={ok ? `✓ ${e.nombre}` : `⏳ Falta: ${e.nombre} (${e.actor})`}
                        >
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, borderRadius: '50%',
                            background: ok ? '#D1FAE5' : '#FEE2E2',
                            color: ok ? '#065F46' : '#991B1B',
                            fontSize: 12, fontWeight: 700,
                          }}>
                            {ok ? '✓' : '✗'}
                          </span>
                        </td>
                      )
                    })}
                    <td style={{ ...td, textAlign: 'center', minWidth: 100 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: pctOT === 100 ? 'var(--verde)' : pctOT >= 50 ? 'var(--ambar)' : 'var(--rojo)' }}>
                        {completas}/11
                      </div>
                      <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${pctOT}%`,
                          background: pctOT === 100 ? 'var(--verde)' : pctOT >= 50 ? 'var(--ambar)' : 'var(--rojo)',
                        }} />
                      </div>
                      {faltantes.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--rojo)', marginTop: 3 }}>
                          Falta: {faltantes.map(f => f.actor).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                        </div>
                      )}
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

function KPIChip({ label, valor, color }) {
  return (
    <div className="card" style={{ padding: '12px 20px', minWidth: 130 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{Number(valor).toLocaleString('es-CL')}</div>
      <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }
const td = { padding: '10px 12px', verticalAlign: 'middle' }
