// ============================================================
// OTs.jsx — Órdenes de Trabajo
// Diseño enterprise: SummaryStrip + FilterBar + tabla moderna
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, rpc, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import ModalCrearOT from '../components/modules/ModalCrearOT'
import {
  StatusBadge, SedeBadge, ProgressBar, PersonList,
  RowActions, EmptyState, Pagination, TableSkeleton, SummaryStrip,
  TH, TD, PAGE_CARD, SELECT_STYLE, fmtFecha,
} from '../components/ui/WssUI'

// ── Constantes ────────────────────────────────────────────────────────────
const ESTADOS = [
  'Pendiente de asignación','Sin inspector','Asignado','Asignada',
  'En proceso','Acta cargada','Informe cargado','Informe enviado',
  'Factura cargada','Cerrada documentalmente',
]
const SEDES = ['ANF','SCL','CCP']

const GRUPOS = {
  pendientes:  ['Pendiente de asignación','Sin inspector'],
  asignadas:   ['Asignado','Asignada'],
  en_proceso:  ['En proceso','Acta cargada','Informe cargado'],
  finalizadas: ['Informe enviado','Factura cargada','Cerrada documentalmente'],
}
const POR_PAGINA = 25

// ═══════════════════════════════════════════════════════════════════════════
export default function OTs() {
  const { usuario, esAdmin, esComercial } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Estado
  const [ots, setOTs]                     = useState([])
  const [cargando, setCargando]           = useState(true)
  const [error, setError]                 = useState('')
  const [busqueda, setBusqueda]           = useState('')
  const [filtroSede, setFiltroSede]       = useState(searchParams.get('sede') || '')
  const [filtroEstado, setFiltroEstado]   = useState(searchParams.get('estado') || '')
  const [filtroResumen, setFiltroResumen] = useState(null)
  const [pagina, setPagina]               = useState(0)
  const [mostrarModal, setMostrarModal]   = useState(false)
  const [mensajeExito, setMensajeExito]   = useState('')

  // Parámetros de URL (desde Dashboard)
  const filtroDocs           = searchParams.get('docs')
  const estadosParam         = searchParams.get('estados')
  const labelParam           = searchParams.get('label')
  const filtroEstadosMulti   = estadosParam ? estadosParam.split(',').map(s => s.trim()) : null

  const puedeCrearOT  = esAdmin() || esComercial()
  const puedeEliminar = esAdmin() || esComercial()

  // ── Carga de datos ──────────────────────────────────────────────────────
  const cargarOTs = useCallback(async () => {
    try {
      setCargando(true); setError('')
      let data
      try {
        data = await rpc('obtener_ots_para_usuario', { p_email: usuario?.email })
      } catch {
        const res = await supabase.from('v_portal_ots_listado').select('*').order('fecha_creacion', { ascending: false })
        if (res.error) throw res.error
        data = res.data
      }
      setOTs(data || [])
    } catch (e) { setError(mensajeError(e)) }
    finally     { setCargando(false) }
  }, [usuario?.email])

  useEffect(() => { cargarOTs() }, [cargarOTs])

  // ── Acciones ────────────────────────────────────────────────────────────
  function handleOTCreada(otNumero) {
    setMostrarModal(false)
    setMensajeExito(`OT ${otNumero} creada correctamente`)
    cargarOTs()
    setTimeout(() => setMensajeExito(''), 4000)
  }

  async function eliminarOT(ot) {
    if (!window.confirm(`¿Eliminar la OT ${ot.ot_numero}?\n\nEsta acción no se puede deshacer.`)) return
    try {
      const { error: err } = await supabase.from('ots').delete().eq('ot_numero', ot.ot_numero)
      if (err) throw err
      setMensajeExito(`OT ${ot.ot_numero} eliminada`)
      cargarOTs()
      setTimeout(() => setMensajeExito(''), 4000)
    } catch (e) { setError(`Error al eliminar: ${e.message}`) }
  }

  function limpiarFiltros() {
    setBusqueda(''); setFiltroSede(''); setFiltroEstado(''); setFiltroResumen(null); setPagina(0)
  }

  function handleResumen(key) {
    setFiltroResumen(key); if (key) setFiltroEstado(''); setPagina(0)
  }

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const otsFiltradas = ots.filter(o => {
    const q = busqueda.toLowerCase()
    const progreso = Number(o.progreso || 0)
    const matchQ = !q || [o.ot_numero, o.cliente, o.supervisor, o.inspector, o.comercial, o.tipo_servicio, o.servicio_contratado]
      .some(v => String(v || '').toLowerCase().includes(q))
    const matchSede = !filtroSede || o.sede === filtroSede
    const matchEstado = filtroResumen
      ? (GRUPOS[filtroResumen] || []).includes(o.estado)
      : filtroEstadosMulti
      ? filtroEstadosMulti.includes(o.estado)
      : filtroEstado
      ? (o.estado || '').toLowerCase().includes(filtroEstado.toLowerCase())
      : true
    const matchDocs = !filtroDocs
      || (filtroDocs === 'pendientes' && progreso < 100 && o.estado !== 'Cerrada documentalmente')
      || (filtroDocs === 'cargados'   && progreso === 100)
    return matchQ && matchSede && matchEstado && matchDocs
  })

  const otsVisibles  = otsFiltradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(otsFiltradas.length / POR_PAGINA)
  const hayFiltros   = !!(busqueda || filtroSede || filtroEstado || filtroResumen)

  // ── Summary strip (sobre datos sin filtrar) ───────────────────────────
  const summaryItems = [
    { key: null,          label: 'Total',       count: ots.length,                                                              color: '#1E3A5F' },
    { key: 'pendientes',  label: 'Pendientes',  count: ots.filter(o => GRUPOS.pendientes.includes(o.estado)).length,           color: '#DC2626' },
    { key: 'asignadas',   label: 'Asignadas',   count: ots.filter(o => GRUPOS.asignadas.includes(o.estado)).length,            color: '#D97706' },
    { key: 'en_proceso',  label: 'En proceso',  count: ots.filter(o => GRUPOS.en_proceso.includes(o.estado)).length,           color: '#3B82F6' },
    { key: 'finalizadas', label: 'Finalizadas', count: ots.filter(o => GRUPOS.finalizadas.includes(o.estado)).length,          color: '#22C55E' },
  ]

  return (
    <div style={{ maxWidth: 1440 }}>

      {/* Modal crear OT */}
      {mostrarModal && (
        <ModalCrearOT onClose={() => setMostrarModal(false)} onCreada={handleOTCreada} />
      )}

      {/* ── Encabezado de página ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Órdenes de Trabajo
            </h1>
            {labelParam && <span style={CHIP_BLUE}>{labelParam}</span>}
            {filtroDocs === 'pendientes' && <span style={CHIP_PURPLE}>Documentos pendientes</span>}
            {filtroDocs === 'cargados'   && <span style={CHIP_TEAL}>Documentos cargados</span>}
          </div>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 5 }}>
            {cargando ? 'Cargando…' : `${otsFiltradas.length} ${otsFiltradas.length === 1 ? 'orden' : 'órdenes'} encontradas`}
            {!cargando && ots.length !== otsFiltradas.length && ` · ${ots.length} total`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={cargarOTs}
            disabled={cargando}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {cargando
              ? <><span className="spinner spinner-sm"/>Cargando…</>
              : <><IcRefresh />Actualizar</>}
          </button>
          {puedeCrearOT && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setMostrarModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IcPlus /> Nueva OT
            </button>
          )}
        </div>
      </div>

      {/* Mensaje éxito */}
      {mensajeExito && (
        <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
          {mensajeExito}
        </div>
      )}

      {/* ── Tarjeta principal ──────────────────────────────────────────── */}
      <div style={PAGE_CARD}>

        {/* Summary strip */}
        {!cargando && ots.length > 0 && (
          <SummaryStrip items={summaryItems} activeKey={filtroResumen} onSelect={handleResumen} />
        )}

        {/* Barra de filtros */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Búsqueda */}
          <div style={{ position: 'relative', flex: 3, minWidth: 220 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              style={{ ...INPUT_STYLE, paddingLeft: 34 }}
              placeholder="Buscar por OT, cliente, inspector o supervisor…"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(0) }}
            />
          </div>
          {/* Sede */}
          <select
            style={{ ...SELECT_STYLE, flex: 1, minWidth: 130, color: filtroSede ? '#0F172A' : '#94A3B8' }}
            value={filtroSede}
            onChange={e => { setFiltroSede(e.target.value); setPagina(0) }}
          >
            <option value="">Todas las sedes</option>
            {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Estado */}
          <select
            style={{ ...SELECT_STYLE, flex: 1.5, minWidth: 160, color: filtroEstado ? '#0F172A' : '#94A3B8' }}
            value={filtroEstado}
            onChange={e => { setFiltroEstado(e.target.value); setFiltroResumen(null); setPagina(0) }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Limpiar */}
          {hayFiltros && (
            <button
              onClick={limpiarFiltros}
              style={{ ...CLEAR_BTN, flexShrink: 0 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Limpiar
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ margin: '12px 16px' }}>
            {error}
            <button className="btn btn-secondary btn-sm" onClick={cargarOTs} style={{ marginLeft: 12 }}>Reintentar</button>
          </div>
        )}

        {/* Contenido */}
        {cargando ? (
          <TableSkeleton rows={7} cols={9} />
        ) : otsVisibles.length === 0 ? (
          <EmptyState
            title={hayFiltros ? 'No encontramos órdenes con estos filtros' : 'No hay órdenes de trabajo registradas'}
            desc={hayFiltros ? 'Prueba cambiando el estado, la sede o el texto de búsqueda.' : undefined}
            onClear={hayFiltros ? limpiarFiltros : undefined}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 880 }}>
              <colgroup>
                <col style={{ width: 118 }} />
                <col />
                <col style={{ width: 74 }} />
                <col style={{ width: 168 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 132 }} />
                <col style={{ width: 132 }} />
                <col style={{ width: 94 }} />
                <col style={{ width: 96 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={TH}>OT</th>
                  <th style={TH}>Cliente</th>
                  <th style={TH}>Sede</th>
                  <th style={TH}>Estado</th>
                  <th style={TH}>Avance</th>
                  <th style={TH}>Supervisor</th>
                  <th style={TH}>Inspector</th>
                  <th style={TH}>Creación</th>
                  <th style={{ ...TH, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {otsVisibles.map(ot => (
                  <FilaOT
                    key={ot.id || ot.ot_numero}
                    ot={ot}
                    puedeEliminar={puedeEliminar}
                    onVerDetalle={() => navigate(`/ots/${ot.ot_numero}`)}
                    onEliminar={() => eliminarOT(ot)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <Pagination
          pagina={pagina}
          totalPaginas={totalPaginas}
          totalRegistros={otsFiltradas.length}
          porPagina={POR_PAGINA}
          onChange={setPagina}
        />
      </div>
    </div>
  )
}

// ── Fila de la tabla ───────────────────────────────────────────────────────
function FilaOT({ ot, puedeEliminar, onVerDetalle, onEliminar }) {
  const [hover, setHover] = useState(false)
  return (
    <tr
      style={{ background: hover ? '#F8FAFC' : '#fff', transition: 'background .1s' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* OT */}
      <td style={TD}>
        <button
          onClick={onVerDetalle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}
        >
          <span style={{ fontFamily: "'Cascadia Code','JetBrains Mono',Menlo,monospace", fontSize: 12, fontWeight: 700, color: '#1E3A5F', letterSpacing: '.3px' }}>
            {ot.ot_numero}
          </span>
        </button>
      </td>

      {/* Cliente + servicio */}
      <td style={{ ...TD, overflow: 'hidden' }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0F172A' }}>
          {ot.cliente || '—'}
        </div>
        {(ot.tipo_servicio || ot.servicio_contratado) && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ot.tipo_servicio || ot.servicio_contratado}
          </div>
        )}
      </td>

      {/* Sede */}
      <td style={TD}>
        <SedeBadge sede={ot.sede} />
      </td>

      {/* Estado */}
      <td style={TD}>
        <StatusBadge estado={ot.estado} />
      </td>

      {/* Avance */}
      <td style={TD}>
        <ProgressBar value={ot.progreso} />
      </td>

      {/* Supervisor */}
      <td style={{ ...TD, overflow: 'hidden' }}>
        <PersonList text={ot.supervisor} max={1} />
      </td>

      {/* Inspector */}
      <td style={{ ...TD, overflow: 'hidden' }}>
        <PersonList text={ot.inspector} max={2} />
      </td>

      {/* Fecha */}
      <td style={{ ...TD, whiteSpace: 'nowrap', fontSize: 12, color: '#64748B' }}>
        {fmtFecha(ot.fecha_creacion)}
      </td>

      {/* Acciones */}
      <td style={{ ...TD, textAlign: 'right' }}>
        <RowActions
          onView={onVerDetalle}
          onDelete={onEliminar}
          canDelete={puedeEliminar}
          viewLabel="Ver"
        />
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
const IcPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)

// ── Estilos locales ────────────────────────────────────────────────────────
const INPUT_STYLE = {
  width: '100%', height: 36,
  paddingRight: 12, paddingLeft: 12,
  border: '1.5px solid #E2E8F0', borderRadius: 7,
  fontSize: 13, color: '#0F172A', background: '#fff',
  fontFamily: 'inherit', outline: 'none',
}

const CLEAR_BTN = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 7,
  border: '1.5px solid #E2E8F0', background: '#fff',
  fontSize: 12, fontWeight: 500, color: '#64748B',
  cursor: 'pointer', fontFamily: 'inherit',
}

const CHIP_BLUE   = { fontSize: 11, fontWeight: 600, color: '#1E40AF', background: '#EFF6FF', padding: '3px 10px', borderRadius: 99, border: '1px solid #BFDBFE' }
const CHIP_PURPLE = { fontSize: 11, fontWeight: 600, color: '#5B21B6', background: '#F5F3FF', padding: '3px 10px', borderRadius: 99, border: '1px solid #DDD6FE' }
const CHIP_TEAL   = { fontSize: 11, fontWeight: 600, color: '#0F766E', background: '#F0FDFA', padding: '3px 10px', borderRadius: 99, border: '1px solid #99F6E4' }
