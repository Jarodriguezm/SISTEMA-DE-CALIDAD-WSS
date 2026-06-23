import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, rpc, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const TABS = [
  { id: 'info',         label: 'Información' },
  { id: 'documentos',   label: 'Documentos' },
  { id: 'asignaciones', label: 'Asignaciones' },
  { id: 'actas',        label: 'Actas' },
  { id: 'reservas',     label: 'Reservas ESI/EAI' },
]

function badgeEstado(estado) {
  const mapa = {
    'Pendiente de asignación': 'badge-red',
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

function badgeDoc(estado) {
  if (!estado) return 'badge-gray'
  const e = estado.toLowerCase()
  if (e === 'cargado' || e === 'aprobado') return 'badge-green'
  if (e === 'pendiente') return 'badge-red'
  return 'badge-amber'
}

export default function DetalleOT() {
  const { numero } = useParams()
  const navigate = useNavigate()
  const { usuario, esAdmin, esComercial, esSupervisor } = useAuth()

  const [ot, setOT] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [actas, setActas] = useState([])
  const [reservas, setReservas] = useState([])
  const [tabActivo, setTabActivo] = useState('info')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const puedeEditar = esAdmin() || esComercial() || esSupervisor()

  useEffect(() => {
    if (numero) cargarTodo()
  }, [numero])

  async function cargarTodo() {
    try {
      setCargando(true)
      setError('')

      // Cargar OT desde vista
      const { data: otData, error: otErr } = await supabase
        .from('v_portal_ot_detalle')
        .select('*')
        .eq('ot_numero', numero)
        .single()

      if (otErr) throw otErr
      if (!otData) throw new Error('No se encontró la OT ' + numero)
      setOT(otData)

      // Cargar tabs en paralelo
      const [docs, asigs, actsData, resData] = await Promise.allSettled([
        rpc('obtener_documentos_por_ot',   { p_ot_numero: numero }),
        rpc('obtener_asignaciones_por_ot', { p_ot_numero: numero }),
        rpc('obtener_actas_por_ot',        { p_ot_numero: numero }),
        rpc('obtener_reservas_por_ot',     { p_ot_numero: numero }),
      ])

      setDocumentos(docs.status === 'fulfilled'    ? (docs.value    || []) : [])
      setAsignaciones(asigs.status === 'fulfilled' ? (asigs.value   || []) : [])
      setActas(actsData.status === 'fulfilled'     ? (actsData.value || []) : [])
      setReservas(resData.status === 'fulfilled'   ? (resData.value  || []) : [])

    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  if (cargando) return (
    <div>
      <div className="loading-bar" style={{ marginBottom: 24 }} />
      <div style={{ display: 'grid', gap: 14 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 80, background: '#F2F4F7', borderRadius: 12, animation: 'shimmer 1.5s infinite' }} />
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ots')} style={{ marginBottom: 16 }}>
        ← Volver a OTs
      </button>
      <div className="alert alert-error">{error}</div>
    </div>
  )

  if (!ot) return null

  const progreso = Number(ot.progreso || 0)
  const docsCargados = documentos.filter(d => d.estado_documento === 'Cargado').length
  const docsPendientes = documentos.filter(d => d.estado_documento === 'Pendiente').length

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex gap-8" style={{ marginBottom: 16, alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ots')}>
          ← Órdenes de Trabajo
        </button>
        <span style={{ color: 'var(--gris)', fontSize: 13 }}>/ {ot.ot_numero}</span>
      </div>

      {/* Header OT */}
      <div className="card" style={{ marginBottom: 20, borderLeft: '5px solid var(--azul)' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: 'var(--azul)' }}>
                {ot.ot_numero}
              </span>
              <span className="badge badge-blue">{ot.sede}</span>
              <span className={`badge ${badgeEstado(ot.estado)}`}>{ot.estado}</span>
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>{ot.cliente}</h2>
            <p style={{ margin: 0, color: 'var(--gris)', fontSize: 13 }}>
              {ot.producto_servicio_contratado || ot.tipo_servicio || '—'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {puedeEditar && (
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/ots/${numero}/editar`)}>
                ✏ Editar OT
              </button>
            )}
            <div style={{ textAlign: 'right' }}>
              <div className="progress-track" style={{ width: 160 }}>
                <div className={`progress-fill ${progreso >= 100 ? 'completa' : ''}`} style={{ width: `${progreso}%` }} />
              </div>
              <span className="text-sm">{progreso}% avance documental</span>
            </div>
          </div>
        </div>

        {/* KPIs rápidos */}
        <div style={styles.kpiRow}>
          <KPIMini label="Documentos" valor={`${docsCargados}/${documentos.length}`} color="var(--azul)" />
          <KPIMini label="Pendientes" valor={docsPendientes} color={docsPendientes > 0 ? 'var(--rojo)' : 'var(--verde)'} />
          <KPIMini label="Asignaciones" valor={asignaciones.length} color="var(--ambar)" />
          <KPIMini label="Actas" valor={actas.length} color="var(--verde)" />
          <KPIMini label="Reservas ESI/EAI" valor={reservas.length} color="var(--dorado)" />
          <KPIMini label="Supervisor" valor={ot.supervisor || '—'} color="var(--gris)" />
          <KPIMini label="Inspector" valor={ot.inspector || '—'} color="var(--gris)" />
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTabActivo(t.id)}
            style={{
              ...styles.tabBtn,
              borderBottom: tabActivo === t.id ? '3px solid var(--azul)' : '3px solid transparent',
              color: tabActivo === t.id ? 'var(--azul)' : 'var(--gris)',
              fontWeight: tabActivo === t.id ? 700 : 400,
            }}
          >
            {t.label}
            {t.id === 'documentos'   && documentos.length   > 0 && <Chip n={documentos.length} />}
            {t.id === 'asignaciones' && asignaciones.length > 0 && <Chip n={asignaciones.length} />}
            {t.id === 'actas'        && actas.length        > 0 && <Chip n={actas.length} />}
            {t.id === 'reservas'     && reservas.length     > 0 && <Chip n={reservas.length} />}
          </button>
        ))}
      </div>

      {/* Contenido tab */}
      <div style={{ marginTop: 16 }}>
        {tabActivo === 'info'         && <TabInfo ot={ot} />}
        {tabActivo === 'documentos'   && <TabDocumentos docs={documentos} />}
        {tabActivo === 'asignaciones' && <TabAsignaciones asignaciones={asignaciones} />}
        {tabActivo === 'actas'        && <TabActas actas={actas} />}
        {tabActivo === 'reservas'     && <TabReservas reservas={reservas} />}
      </div>
    </div>
  )
}

// ─── Tab Información ─────────────────────────────────────────────────────────
function TabInfo({ ot }) {
  const campos = [
    { label: 'N° OT',                    valor: ot.ot_numero },
    { label: 'Cliente',                  valor: ot.cliente },
    { label: 'Contacto',                 valor: ot.contacto },
    { label: 'Email cliente',            valor: ot.email_cliente },
    { label: 'Teléfono cliente',         valor: ot.telefono_cliente },
    { label: 'RUT empresa',              valor: ot.rut_empresa },
    { label: 'Sede',                     valor: ot.sede },
    { label: 'Año / Mes',                valor: `${ot.anio} / ${String(ot.mes).padStart(2,'0')}` },
    { label: 'Estado',                   valor: ot.estado },
    { label: 'Progreso',                 valor: `${ot.progreso || 0}%` },
    { label: 'Producto / Servicio',      valor: ot.producto_servicio_contratado || ot.tipo_servicio },
    { label: 'Referencia cotización',    valor: ot.referencia_cotizacion },
    { label: 'Dirección / Faena',        valor: ot.direccion_faena },
    { label: 'Comercial',                valor: ot.comercial },
    { label: 'Supervisor',               valor: ot.supervisor },
    { label: 'Inspector',                valor: ot.inspector },
    { label: 'Fecha creación',           valor: ot.fecha_creacion ? new Date(ot.fecha_creacion).toLocaleString('es-CL') : '—' },
    { label: 'Observaciones',            valor: ot.observaciones },
  ]

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, marginBottom: 16, color: 'var(--azul)' }}>Datos generales</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px 24px' }}>
        {campos.map(c => c.valor ? (
          <div key={c.label} style={{ borderBottom: '1px solid #F2F4F7', paddingBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '.3px' }}>
              {c.label}
            </div>
            <div style={{ fontSize: 14, color: 'var(--texto)', marginTop: 2 }}>
              {c.valor}
            </div>
          </div>
        ) : null)}
      </div>
      {ot.descripcion && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--borde)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gris)', textTransform: 'uppercase', marginBottom: 6 }}>
            Descripción del trabajo
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--texto-sub)' }}>{ot.descripcion}</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab Documentos ───────────────────────────────────────────────────────────
function TabDocumentos({ docs }) {
  if (!docs.length) return <Vacio mensaje="No hay documentos registrados para esta OT" />

  const cargados  = docs.filter(d => d.estado_documento === 'Cargado').length
  const pendientes = docs.filter(d => d.estado_documento === 'Pendiente').length

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="badge badge-green">✓ {cargados} cargados</span>
        <span className="badge badge-red">⏳ {pendientes} pendientes</span>
        <span className="badge badge-gray">Total: {docs.length}</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tabla">
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Documento</th>
              <th>Etapa</th>
              <th>Estado</th>
              <th>Responsable</th>
              <th>Fecha carga</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={i}>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--azul)' }}>
                    {d.item}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.nombre_documento}</div>
                  {d.obligatorio && <span className="badge badge-red" style={{ fontSize: 10 }}>Obligatorio</span>}
                </td>
                <td><span className="badge badge-gray">{d.etapa}</span></td>
                <td><span className={`badge ${badgeDoc(d.estado_documento)}`}>{d.estado_documento}</span></td>
                <td className="text-sm">{d.responsable || '—'}</td>
                <td className="text-sm">
                  {d.fecha_carga ? new Date(d.fecha_carga).toLocaleDateString('es-CL') : '—'}
                </td>
                <td>
                  {d.drive_url && (
                    <a href={d.drive_url} target="_blank" rel="noopener noreferrer">
                      <button className="btn btn-secondary btn-sm">📄 Ver</button>
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab Asignaciones ─────────────────────────────────────────────────────────
function TabAsignaciones({ asignaciones }) {
  if (!asignaciones.length) return <Vacio mensaje="No hay asignaciones para esta OT" />

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {asignaciones.map((a, i) => (
        <div key={i} className="card" style={{ borderLeft: '4px solid var(--ambar)' }}>
          <div className="flex-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                📅 {a.fecha_inspeccion ? new Date(a.fecha_inspeccion).toLocaleDateString('es-CL') : '—'}
                {a.hora && ` · ${a.hora}`}
              </span>
            </div>
            <span className={`badge ${a.estado === 'Asignado' ? 'badge-amber' : 'badge-green'}`}>
              {a.estado}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 20px' }}>
            <Campo label="Supervisor"    valor={a.supervisor} />
            <Campo label="Inspector(es)" valor={a.inspectores_asignados} />
            <Campo label="Sede"          valor={a.sede} />
            <Campo label="Vehículo"      valor={a.vehiculo} />
            <Campo label="Tiempo est."   valor={a.tiempo_estimado} />
            <Campo label="Norma ejec."   valor={a.norma_ejecucion} />
            <Campo label="Norma eval."   valor={a.norma_evaluacion} />
          </div>

          {a.procedimientos && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gris)', textTransform: 'uppercase' }}>
                Procedimientos
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--texto-sub)' }}>{a.procedimientos}</p>
            </div>
          )}

          {a.descripcion_actividad && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gris)', textTransform: 'uppercase' }}>
                Descripción
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--texto-sub)' }}>{a.descripcion_actividad}</p>
            </div>
          )}

          {a.drive_url && (
            <div style={{ marginTop: 12 }}>
              <a href={a.drive_url} target="_blank" rel="noopener noreferrer">
                <button className="btn btn-secondary btn-sm">📋 Ver PDF asignación</button>
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tab Actas ────────────────────────────────────────────────────────────────
function TabActas({ actas }) {
  if (!actas.length) return <Vacio mensaje="No hay actas emitidas para esta OT" />

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {actas.map((a, i) => (
        <div key={i} className="card" style={{ borderLeft: '4px solid var(--verde)' }}>
          <div className="flex-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: 'var(--azul)' }}>
              {a.correlativo_acta}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-blue">{a.tipo_acta}</span>
              <span className={`badge ${a.estado_acta === 'Emitida' ? 'badge-green' : 'badge-amber'}`}>
                {a.estado_acta}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 20px' }}>
            <Campo label="Inspector"       valor={a.inspector} />
            <Campo label="Supervisor"      valor={a.supervisor} />
            <Campo label="Fecha insp."     valor={a.fecha_inspeccion ? new Date(a.fecha_inspeccion).toLocaleDateString('es-CL') : '—'} />
            <Campo label="Tipo inspección" valor={a.tipo_inspeccion} />
            <Campo label="Norma ejec."     valor={a.norma_ejecucion} />
            <Campo label="Norma eval."     valor={a.norma_evaluacion} />
            <Campo label="Procedimiento"   valor={a.procedimiento} />
            {a.numero_acta_manual && <Campo label="N° acta manual" valor={a.numero_acta_manual} />}
          </div>

          {a.observaciones && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gris)', textTransform: 'uppercase' }}>Observaciones</span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--texto-sub)' }}>{a.observaciones}</p>
            </div>
          )}

          {a.drive_url && (
            <div style={{ marginTop: 12 }}>
              <a href={a.drive_url} target="_blank" rel="noopener noreferrer">
                <button className="btn btn-secondary btn-sm">📄 Ver PDF acta</button>
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tab Reservas ─────────────────────────────────────────────────────────────
function TabReservas({ reservas }) {
  if (!reservas.length) return <Vacio mensaje="No hay reservas de informes ESI/EAI para esta OT" />

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <span className="badge badge-gold">
          {reservas.reduce((acc, r) => acc + (Number(r.cantidad) || 0), 0)} números reservados en total
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tabla">
          <thead>
            <tr>
              <th>Serie</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Cant.</th>
              <th>Área</th>
              <th>Producto</th>
              <th>F. Inspección</th>
              <th>F. Entrega</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((r, i) => (
              <tr key={i}>
                <td><span className="badge badge-gold">{r.serie}</span></td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.desde}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.hasta}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.cantidad}</td>
                <td>{r.area || '—'}</td>
                <td className="text-sm">{r.producto || '—'}</td>
                <td className="text-sm">
                  {r.fecha_inspeccion ? new Date(r.fecha_inspeccion).toLocaleDateString('es-CL') : '—'}
                </td>
                <td className="text-sm">
                  {r.fecha_entrega_informe ? new Date(r.fecha_entrega_informe).toLocaleDateString('es-CL') : '—'}
                </td>
                <td><span className="badge badge-green">{r.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────
function KPIMini({ label, valor, color }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontWeight: 800, fontSize: 18, color }}>{valor}</div>
      <div style={{ fontSize: 11, color: 'var(--gris)' }}>{label}</div>
    </div>
  )
}

function Campo({ label, valor }) {
  if (!valor) return null
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gris)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--texto-sub)', marginTop: 2 }}>{valor}</div>
    </div>
  )
}

function Chip({ n }) {
  return (
    <span style={{
      background: 'var(--azul)', color: '#fff',
      borderRadius: 999, fontSize: 10, fontWeight: 700,
      padding: '1px 6px', marginLeft: 6
    }}>{n}</span>
  )
}

function Vacio({ mensaje }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
      {mensaje}
    </div>
  )
}

const styles = {
  kpiRow: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
    paddingTop: 16,
    marginTop: 16,
    borderTop: '1px solid var(--borde)',
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '2px solid var(--borde)',
    overflowX: 'auto',
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    padding: '10px 18px',
    cursor: 'pointer',
    fontSize: 14,
    whiteSpace: 'nowrap',
    transition: 'color .15s',
    display: 'flex',
    alignItems: 'center',
  },
}
