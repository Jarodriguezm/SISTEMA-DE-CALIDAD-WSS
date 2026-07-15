// ============================================================
// Supervisor.jsx — Panel de revisión y aprobación de informes
// WSS · Sistema de Calidad
// ============================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADO_BADGE = {
  BORRADOR:    { label: 'Borrador',    bg: '#F1F5F9', color: '#475569' },
  EN_REVISION: { label: 'En revisión', bg: '#FEF3C7', color: '#92400E' },
  APROBADO:    { label: 'Aprobado',    bg: '#D1FAE5', color: '#065F46' },
  RECHAZADO:   { label: 'Rechazado',   bg: '#FEE2E2', color: '#991B1B' },
}

export default function Supervisor() {
  const { usuario, esAdmin, esSupervisor } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]                               = useState('REVISION')
  const [informes, setInformes]                     = useState([])
  const [asignaciones, setAsignaciones]             = useState([])
  const [cargando, setCargando]                     = useState(true)
  const [errorTabla, setErrorTabla]                 = useState(null)
  const [filtroEstado, setFiltroEstado]             = useState('todos')
  const [informeSeleccionado, setInformeSeleccionado] = useState(null)
  const [observacion, setObservacion]               = useState('')
  const [modoRechazo, setModoRechazo]               = useState(false)
  const [guardando, setGuardando]                   = useState(false)

  useEffect(() => {
    cargarInformes()
    if (usuario) cargarAsignaciones()
  }, [usuario])

  async function cargarInformes() {
    setCargando(true)
    setErrorTabla(null)
    try {
      const { data, error } = await supabase
        .from('informes')
        .select([
          'id', 'numero', 'reg_dii_numero', 'metodo_end_cod',
          'ot_numero', 'cliente_nombre', 'estado', 'resultado',
          'fecha_inspeccion', 'created_at', 'updated_at',
          'inspector_nombre', 'supervisor_nombre',
          'comentario_supervisor', 'fecha_revision', 'fecha_aprobacion',
          'drive_pdf_id',
        ].join(','))
        .order('created_at', { ascending: false })

      if (error) throw error
      setInformes(data || [])
    } catch (e) {
      setErrorTabla(e.message || 'Error al cargar informes')
    } finally {
      setCargando(false)
    }
  }

  async function cargarAsignaciones() {
    const nombre = usuario?.nombre || ''
    if (!nombre) return
    const { data } = await supabase
      .from('asignaciones')
      .select('id,ot_numero,inspectores_asignados,fecha_inspeccion,tipos_inspeccion,estado,created_at')
      .ilike('supervisor', `%${nombre}%`)
      .order('fecha_inspeccion', { ascending: false })
      .limit(100)

    if (!data) return

    // Enriquecer con datos de la OT
    const nums = [...new Set(data.map(a => a.ot_numero).filter(Boolean))]
    let otsMap = {}
    if (nums.length) {
      const { data: otsData } = await supabase
        .from('ots').select('ot_numero,cliente,estado').in('ot_numero', nums)
      ;(otsData || []).forEach(o => { otsMap[o.ot_numero] = o })
    }
    setAsignaciones(data.map(a => ({ ...a, ot: otsMap[a.ot_numero] || {} })))
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const ahora      = new Date()
  const mesActual  = ahora.getMonth()
  const anioActual = ahora.getFullYear()

  const totalPendientes = informes.filter(i => i.estado === 'EN_REVISION').length
  const aprobadosMes    = informes.filter(i => {
    if (i.estado !== 'APROBADO') return false
    const d = new Date(i.created_at)
    return d.getMonth() === mesActual && d.getFullYear() === anioActual
  }).length
  const rechazadosMes   = informes.filter(i => {
    if (i.estado !== 'RECHAZADO') return false
    const d = new Date(i.created_at)
    return d.getMonth() === mesActual && d.getFullYear() === anioActual
  }).length

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const informesFiltrados = informes.filter(i =>
    filtroEstado === 'todos' || i.estado === filtroEstado
  )

  // ── Aprobar ────────────────────────────────────────────────────────────────
  async function aprobar() {
    if (!informeSeleccionado) return
    setGuardando(true)
    try {
      const { error } = await supabase
        .from('informes')
        .update({
          estado:            'APROBADO',
          supervisor_id:     usuario?.id    || null,
          supervisor_nombre: usuario?.nombre || null,
          fecha_aprobacion:  new Date().toISOString(),
          fecha_revision:    new Date().toISOString(),
          updated_at:        new Date().toISOString(),
        })
        .eq('id', informeSeleccionado.id)
      if (error) throw error
      await cargarInformes()
      cerrarModal()
    } catch (e) {
      alert('Error al aprobar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  // ── Rechazar ───────────────────────────────────────────────────────────────
  async function rechazar() {
    if (!informeSeleccionado) return
    if (!observacion.trim()) { alert('Ingrese una observación para el rechazo.'); return }
    setGuardando(true)
    try {
      const { error } = await supabase
        .from('informes')
        .update({
          estado:                 'RECHAZADO',
          supervisor_id:          usuario?.id    || null,
          supervisor_nombre:      usuario?.nombre || null,
          comentario_supervisor:  observacion,
          fecha_revision:         new Date().toISOString(),
          updated_at:             new Date().toISOString(),
        })
        .eq('id', informeSeleccionado.id)
      if (error) throw error
      await cargarInformes()
      cerrarModal()
    } catch (e) {
      alert('Error al rechazar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  function abrirModal(inf) { setInformeSeleccionado(inf); setModoRechazo(false); setObservacion('') }
  function cerrarModal()   { setInformeSeleccionado(null); setModoRechazo(false); setObservacion('') }

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!esAdmin() && !esSupervisor()) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: '#DC2626', margin: '0 0 8px' }}>Acceso restringido</h2>
        <p style={{ color: '#6B7280', margin: 0 }}>Esta sección es solo para supervisores y administradores.</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1A3A5C' }}>🔍 Panel Supervisor</h1>
        <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 14 }}>
          Revisión de informes y seguimiento de OTs asignadas
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icono="⏳" label="Pendientes de revisión" valor={totalPendientes} color="#D97706" bg="#FFFBEB" borderColor="#FDE68A" />
        <StatCard icono="✅" label="Aprobados este mes"     valor={aprobadosMes}    color="#16A34A" bg="#F0FDF4" borderColor="#BBF7D0" />
        <StatCard icono="❌" label="Rechazados este mes"    valor={rechazadosMes}   color="#DC2626" bg="#FEF2F2" borderColor="#FECACA" />
        <StatCard icono="📋" label="OTs asignadas"          valor={asignaciones.length} color="#1A3A5C" bg="#EFF6FF" borderColor="#BFDBFE" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
        {[
          { id: 'REVISION',    label: 'Revisión de informes', count: informes.length,       icon: '📄' },
          { id: 'OTS',         label: 'OTs asignadas',        count: asignaciones.length,   icon: '📋' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'transparent',
            borderBottom: tab === t.id ? '3px solid #1A3A5C' : '3px solid transparent',
            color: tab === t.id ? '#1A3A5C' : '#94A3B8', marginBottom: -2,
          }}>
            {t.icon} {t.label}
            <span style={{
              marginLeft: 6, fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 800,
              background: tab === t.id ? '#1A3A5C' : '#E2E8F0',
              color: tab === t.id ? '#fff' : '#94A3B8',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: Revisión de informes ── */}
      {tab === 'REVISION' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginRight: 4 }}>Estado:</span>
            {[
              { key: 'todos',       label: 'Todos'       },
              { key: 'EN_REVISION', label: 'En revisión' },
              { key: 'APROBADO',    label: 'Aprobados'   },
              { key: 'RECHAZADO',   label: 'Rechazados'  },
              { key: 'BORRADOR',    label: 'Borradores'  },
            ].map(f => (
              <button key={f.key} onClick={() => setFiltroEstado(f.key)} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                border: filtroEstado === f.key ? '1.5px solid #1A3A5C' : '1.5px solid #CBD5E1',
                background: filtroEstado === f.key ? '#1A3A5C' : '#fff',
                color: filtroEstado === f.key ? '#fff' : '#475569',
              }}>
                {f.label} ({f.key === 'todos' ? informes.length : informes.filter(i => i.estado === f.key).length})
              </button>
            ))}
          </div>

          {/* Tabla informes */}
          {cargando ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>Cargando informes...</div>
          ) : errorTabla ? (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 'bold', color: '#DC2626', marginBottom: 8 }}>Error al cargar informes</div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{errorTabla}</div>
              <button onClick={cargarInformes} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1A3A5C', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Reintentar
              </button>
            </div>
          ) : informesFiltrados.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 600 }}>
                {informes.length === 0 ? 'No hay informes registrados aún.' : 'Sin informes para el filtro seleccionado.'}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    {['N° Informe', 'OT', 'Cliente', 'REG-DII', 'Inspector', 'Fecha', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {informesFiltrados.map((inf, i) => {
                    const est = ESTADO_BADGE[inf.estado] || ESTADO_BADGE.BORRADOR
                    return (
                      <tr key={inf.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#1A3A5C' }}>
                          {inf.numero || '—'}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#475569', fontWeight: 600 }}>{inf.ot_numero || '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12 }}>{inf.cliente_nombre || '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#7C3AED' }}>
                          {inf.reg_dii_numero || '—'}
                          {inf.metodo_end_cod && <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 6 }}>({inf.metodo_end_cod})</span>}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#475569' }}>{inf.inspector_nombre || '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                          {inf.fecha_inspeccion ? new Date(inf.fecha_inspeccion).toLocaleDateString('es-CL') : '—'}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: est.bg, color: est.color, whiteSpace: 'nowrap' }}>
                            {est.label}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => navigate(`/informes/${inf.id}`)}
                              style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid #CBD5E1', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                            >
                              Ver
                            </button>
                            {inf.estado === 'EN_REVISION' && (
                              <button
                                onClick={() => abrirModal(inf)}
                                style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#1A3A5C', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                              >
                                Revisar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB: OTs asignadas ── */}
      {tab === 'OTS' && (
        <TabOTsAsignadas asignaciones={asignaciones} navigate={navigate} />
      )}

      {/* ── Modal de revisión ── */}
      {informeSeleccionado && (
        <ModalRevision
          informe={informeSeleccionado}
          modoRechazo={modoRechazo}
          setModoRechazo={setModoRechazo}
          observacion={observacion}
          setObservacion={setObservacion}
          guardando={guardando}
          onAprobar={aprobar}
          onRechazar={rechazar}
          onCerrar={cerrarModal}
        />
      )}
    </div>
  )
}

// ── Tab OTs asignadas ──────────────────────────────────────────────────────────

function TabOTsAsignadas({ asignaciones, navigate }) {
  const [busqueda, setBusqueda] = useState('')

  const filtradas = asignaciones.filter(a => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (a.ot_numero || '').toLowerCase().includes(q) ||
           (a.ot?.cliente || '').toLowerCase().includes(q) ||
           (a.inspectores_asignados || '').toLowerCase().includes(q)
  })

  if (asignaciones.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
        <div style={{ fontWeight: 600 }}>Sin OTs asignadas bajo tu supervisión.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>{filtradas.length} asignaciones</span>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar OT, cliente o inspector..."
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, width: 280 }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
              {['OT', 'Cliente', 'Inspectores', 'Tipos END', 'Fecha inspección', 'Estado OT', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#1A3A5C' }}>{a.ot_numero || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 12 }}>{a.ot?.cliente || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: '#374151', maxWidth: 200 }}>
                  {(a.inspectores_asignados || '').split(',').map((ins, j) => (
                    <div key={j} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ins.trim()}</div>
                  ))}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', color: '#7C3AED', fontWeight: 700 }}>
                  {a.tipos_inspeccion || '—'}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                  {a.fecha_inspeccion
                    ? new Date(a.fecha_inspeccion + 'T00:00:00').toLocaleDateString('es-CL')
                    : '—'}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  {a.ot?.estado && (
                    <span style={{ fontSize: 11, background: '#F1F5F9', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>
                      {a.ot.estado}
                    </span>
                  )}
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <button
                    onClick={() => navigate(`/ots/${a.ot_numero}`)}
                    style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid #CBD5E1', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    Ver OT
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Subcomponentes ─────────────────────────────────────────────────────────────

function StatCard({ icono, label, valor, color, bg, borderColor }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${borderColor}`, borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>{icono}</div>
      <div>
        <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  )
}

function MetaField({ label, valor, mono = false }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1A3A5C', fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>{valor || '—'}</div>
    </div>
  )
}

function ModalRevision({ informe, modoRechazo, setModoRechazo, observacion, setObservacion, guardando, onAprobar, onRechazar, onCerrar }) {
  const est         = ESTADO_BADGE[informe.estado] || ESTADO_BADGE.BORRADOR
  const puedeActuar = informe.estado === 'EN_REVISION'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.35)', margin: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1A3A5C' }}>Revisión de Informe</h2>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
              {informe.numero || 'Sin número'}
              {informe.reg_dii_numero && ` · ${informe.reg_dii_numero}`}
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: est.bg, color: est.color, flexShrink: 0, marginLeft: 12 }}>
            {est.label}
          </span>
        </div>

        {/* Metadata */}
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <MetaField label="N° OT"             valor={informe.ot_numero}        />
          <MetaField label="Cliente"            valor={informe.cliente_nombre}   />
          <MetaField label="Inspector"          valor={informe.inspector_nombre} />
          <MetaField label="REG-DII"            valor={informe.reg_dii_numero}   mono />
          <MetaField label="Tipo END (código)"  valor={informe.metodo_end_cod}   />
          <MetaField label="Resultado"          valor={informe.resultado}        />
          <MetaField
            label="Fecha inspección"
            valor={informe.fecha_inspeccion ? new Date(informe.fecha_inspeccion).toLocaleDateString('es-CL') : undefined}
          />
          {informe.estado === 'RECHAZADO' && informe.comentario_supervisor && (
            <div style={{ gridColumn: '1 / -1' }}>
              <MetaField label="Observación supervisor" valor={informe.comentario_supervisor} />
            </div>
          )}
        </div>

        {/* PDF */}
        {informe.drive_pdf_id && (
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Documento PDF</div>
            <iframe
              src={`/api/drive/proxy-pdf?fileId=${informe.drive_pdf_id}`}
              style={{ width: '100%', height: 400, border: '1px solid #E2E8F0', borderRadius: 8 }}
              title="Informe PDF"
            />
          </div>
        )}

        {/* Observación de rechazo */}
        {modoRechazo && (
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ height: 1, background: '#FEE2E2', marginBottom: 16 }} />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>
              Observación de rechazo *
            </label>
            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Describa el motivo del rechazo para que el inspector pueda corregirlo..."
              rows={4} autoFocus
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #DC2626', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', color: '#1A3A5C' }}
            />
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>
              Esta observación quedará guardada en el informe y visible para el inspector.
            </p>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', flexWrap: 'wrap' }}>
          <button onClick={onCerrar} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #CBD5E1', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Cerrar
          </button>

          {puedeActuar && !modoRechazo && (
            <>
              <button onClick={() => setModoRechazo(true)} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #DC2626', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                ❌ Rechazar
              </button>
              <button onClick={onAprobar} disabled={guardando} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: guardando ? .7 : 1 }}>
                {guardando ? 'Guardando...' : '✅ Aprobar'}
              </button>
            </>
          )}

          {puedeActuar && modoRechazo && (
            <>
              <button onClick={() => { setModoRechazo(false); setObservacion('') }} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #CBD5E1', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={onRechazar} disabled={guardando || !observacion.trim()} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', cursor: (guardando || !observacion.trim()) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: (!observacion.trim() || guardando) ? .6 : 1 }}>
                {guardando ? 'Guardando...' : 'Confirmar rechazo'}
              </button>
            </>
          )}

          {!puedeActuar && (
            <span style={{ fontSize: 12, color: '#94A3B8', paddingRight: 4 }}>
              {informe.estado === 'APROBADO' ? `✅ Aprobado por ${informe.supervisor_nombre || 'supervisor'}` : 'Solo informes "En revisión" pueden gestionarse.'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
