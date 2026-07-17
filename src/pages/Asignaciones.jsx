// ============================================================
// Asignaciones.jsx — Vista global de asignaciones
// Diseño enterprise: SummaryStrip + FilterBar + tabla moderna
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, mensajeError } from '../lib/supabase'
import {
  StatusBadge, PersonList, TechniqueList,
  EmptyState, Pagination, TableSkeleton, SummaryStrip,
  TH, TD, PAGE_CARD, SELECT_STYLE, fmtFecha,
} from '../components/ui/WssUI'

const ESTADOS_ASIG = ['Programada','Realizada','Cancelada','Pendiente']
const POR_PAGINA = 30

export default function Asignaciones() {
  const navigate = useNavigate()
  const [datos, setDatos]             = useState([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState('')
  const [busqueda, setBusqueda]       = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroResumen, setFiltroResumen] = useState(null)
  const [pagina, setPagina]           = useState(0)

  const cargar = useCallback(async () => {
    try {
      setCargando(true); setError('')
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
    finally     { setCargando(false) }
  }, [filtroEstado, filtroDesde, filtroHasta])

  useEffect(() => { cargar() }, [cargar])

  function limpiarFiltros() {
    setBusqueda(''); setFiltroEstado(''); setFiltroDesde(''); setFiltroHasta(''); setFiltroResumen(null); setPagina(0)
  }

  function handleResumen(key) {
    setFiltroResumen(key)
    if (key) setFiltroEstado('')
    setPagina(0)
  }

  // Filtrado local (sobre resultado de Supabase)
  const filtrados = datos.filter(a => {
    const matchBusqueda = !busqueda || [a.ot_numero, a.inspectores_asignados, a.supervisor, a.descripcion_actividad, a.tipos_inspeccion]
      .some(v => String(v || '').toLowerCase().includes(busqueda.toLowerCase()))
    const matchResumen = !filtroResumen || (a.estado || 'Programada') === filtroResumen
    return matchBusqueda && matchResumen
  })

  const visibles     = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const hayFiltros   = !!(busqueda || filtroEstado || filtroDesde || filtroHasta || filtroResumen)

  // Summary strip
  const summaryItems = [
    { key: null,         label: 'Total',       count: datos.length,                                               color: '#1E3A5F' },
    { key: 'Programada', label: 'Programadas', count: datos.filter(a => (a.estado || 'Programada') === 'Programada').length, color: '#3B82F6' },
    { key: 'Realizada',  label: 'Realizadas',  count: datos.filter(a => a.estado === 'Realizada').length,          color: '#22C55E' },
    { key: 'Cancelada',  label: 'Canceladas',  count: datos.filter(a => a.estado === 'Cancelada').length,          color: '#DC2626' },
    { key: 'Pendiente',  label: 'Pendientes',  count: datos.filter(a => a.estado === 'Pendiente').length,          color: '#D97706' },
  ]

  return (
    <div style={{ maxWidth: 1440 }}>

      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Asignaciones</h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 5 }}>
            {cargando ? 'Cargando…' : `${filtrados.length} ${filtrados.length === 1 ? 'asignación' : 'asignaciones'} encontradas`}
            {!cargando && datos.length !== filtrados.length && ` · ${datos.length} total`}
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={cargar}
          disabled={cargando}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {cargando
            ? <><span className="spinner spinner-sm"/>Cargando…</>
            : <><IcRefresh/>Actualizar</>}
        </button>
      </div>

      {/* ── Tarjeta principal ──────────────────────────────────────────── */}
      <div style={PAGE_CARD}>

        {/* Summary strip */}
        {!cargando && datos.length > 0 && (
          <SummaryStrip items={summaryItems} activeKey={filtroResumen} onSelect={handleResumen} />
        )}

        {/* Barra de filtros */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Búsqueda */}
          <div style={{ position: 'relative', flex: 2, minWidth: 200 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              style={{ ...INPUT_STYLE, paddingLeft: 34 }}
              placeholder="Buscar por OT, inspector, técnica…"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(0) }}
            />
          </div>
          {/* Estado */}
          <select
            style={{ ...SELECT_STYLE, flex: 1, minWidth: 140, color: filtroEstado ? '#0F172A' : '#94A3B8' }}
            value={filtroEstado}
            onChange={e => { setFiltroEstado(e.target.value); setFiltroResumen(null); setPagina(0) }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_ASIG.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Desde */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>Desde</label>
            <input type="date" style={INPUT_STYLE} value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setPagina(0) }} />
          </div>
          {/* Hasta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>Hasta</label>
            <input type="date" style={INPUT_STYLE} value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setPagina(0) }} />
          </div>
          {/* Limpiar */}
          {hayFiltros && (
            <button onClick={limpiarFiltros} style={CLEAR_BTN}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Limpiar
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ margin: '12px 16px' }}>
            {error}
            <button className="btn btn-secondary btn-sm" onClick={cargar} style={{ marginLeft: 12 }}>Reintentar</button>
          </div>
        )}

        {/* Contenido */}
        {cargando ? (
          <TableSkeleton rows={7} cols={8} />
        ) : visibles.length === 0 ? (
          <EmptyState
            title={hayFiltros ? 'No encontramos asignaciones con estos filtros' : 'No hay asignaciones registradas'}
            desc={hayFiltros ? 'Prueba cambiando el estado o el rango de fechas.' : undefined}
            onClear={hayFiltros ? limpiarFiltros : undefined}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 860 }}>
              <colgroup>
                <col style={{ width: 118 }} />
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 108 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 88 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={TH}>OT</th>
                  <th style={TH}>Inspector(es)</th>
                  <th style={TH}>Supervisor</th>
                  <th style={TH}>Fecha</th>
                  <th style={TH}>Técnicas</th>
                  <th style={TH}>Vehículo</th>
                  <th style={TH}>Estado</th>
                  <th style={{ ...TH, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((a, i) => (
                  <FilaAsig key={a.id || i} a={a} onVerOT={() => navigate(`/ots/${a.ot_numero}`)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <Pagination
          pagina={pagina}
          totalPaginas={totalPaginas}
          totalRegistros={filtrados.length}
          porPagina={POR_PAGINA}
          onChange={setPagina}
        />
      </div>
    </div>
  )
}

// ── Fila de asignación ─────────────────────────────────────────────────────
function FilaAsig({ a, onVerOT }) {
  const [hover, setHover] = useState(false)
  const fechaStr = a.fecha_inspeccion
    ? fmtFecha(a.fecha_inspeccion)
    : '—'
  const horaStr = a.hora || null

  return (
    <tr
      style={{ background: hover ? '#F8FAFC' : '#fff', transition: 'background .1s' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* OT */}
      <td style={TD}>
        <button
          onClick={onVerOT}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}
        >
          <span style={{ fontFamily: "'Cascadia Code','JetBrains Mono',Menlo,monospace", fontSize: 12, fontWeight: 700, color: '#1E3A5F', letterSpacing: '.3px' }}>
            {a.ot_numero}
          </span>
        </button>
      </td>

      {/* Inspector(es) */}
      <td style={{ ...TD, overflow: 'hidden' }}>
        <PersonList text={a.inspectores_asignados} max={2} />
      </td>

      {/* Supervisor */}
      <td style={{ ...TD, overflow: 'hidden' }}>
        <PersonList text={a.supervisor} max={1} />
      </td>

      {/* Fecha + hora */}
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{fechaStr}</div>
        {horaStr && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: -1, marginRight: 3 }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            {horaStr}
          </div>
        )}
      </td>

      {/* Técnicas */}
      <td style={TD}>
        <TechniqueList text={a.tipos_inspeccion} />
      </td>

      {/* Vehículo */}
      <td style={TD}>
        {a.vehiculo
          ? <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>{a.vehiculo}</span>
          : <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Sin vehículo</span>}
      </td>

      {/* Estado */}
      <td style={TD}>
        <StatusBadge estado={a.estado || 'Programada'} />
      </td>

      {/* Acción */}
      <td style={{ ...TD, textAlign: 'right' }}>
        <button
          onClick={onVerOT}
          style={BTN_VER}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.background = '#F8FAFC' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff' }}
        >
          Ver OT
        </button>
      </td>
    </tr>
  )
}

// ── Iconos inline ──────────────────────────────────────────────────────────
const IcRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
)

// ── Estilos locales ────────────────────────────────────────────────────────
const INPUT_STYLE = {
  width: '100%', height: 36, padding: '0 12px',
  border: '1.5px solid #E2E8F0', borderRadius: 7,
  fontSize: 13, color: '#0F172A', background: '#fff',
  fontFamily: 'inherit', outline: 'none',
}

const CLEAR_BTN = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 7,
  border: '1.5px solid #E2E8F0', background: '#fff',
  fontSize: 12, fontWeight: 500, color: '#64748B',
  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
}

const BTN_VER = {
  padding: '5px 10px', borderRadius: 6,
  border: '1px solid #E2E8F0', background: '#fff',
  color: '#334155', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  transition: 'all .12s',
}
