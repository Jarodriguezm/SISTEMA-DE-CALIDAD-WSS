import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, rpc, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import ModalEditarOT from '../components/modules/ModalEditarOT'
import ModalAsignarInspector from '../components/modules/ModalAsignarInspector'
import TabAsignaciones from '../components/modules/TabAsignaciones'
import TabDocumentos from '../components/modules/TabDocumentos'
import TabActa from '../components/modules/TabActa'
import TabInformes from '../components/modules/TabInformes'
import TabFacturacion from '../components/modules/TabFacturacion'

const TABS = [
  { id: 'info',         label: 'Información' },
  { id: 'documentos',   label: 'Documentos' },
  { id: 'asignaciones', label: 'Asignaciones' },
  { id: 'actas',        label: 'Actas' },
  { id: 'informes',     label: 'Informes DII' },
  { id: 'facturacion',  label: 'Facturación' },
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
  const [mostrarEditar, setMostrarEditar] = useState(false)
  const [mostrarAsignar, setMostrarAsignar] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [creandoCarpetas, setCreandoCarpetas] = useState(false)

  const puedeEditar = esAdmin() || esComercial() || esSupervisor()
  const puedeAsignar = esAdmin() || esSupervisor()

  function mostrarExito(msg) {
    setMensajeExito(msg)
    setTimeout(() => setMensajeExito(''), 3500)
  }

  async function crearCarpetasDrive() {
    if (!ot) return
    if (!['SCL', 'ANF'].includes(ot.sede)) {
      mostrarExito(`⚠️ La sede ${ot.sede || '—'} no tiene carpeta raíz configurada en Drive.`)
      return
    }
    try {
      setCreandoCarpetas(true)
      const res = await fetch('/api/drive/crear-carpetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ot_numero: ot.ot_numero,
          cliente: ot.cliente || '',
          sede: ot.sede,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al crear carpetas')
      // Actualizar estado local para reflejar la nueva carpeta sin recargar
      setOT(prev => ({
        ...prev,
        carpeta_drive_url: data.carpeta_ot_url || prev.carpeta_drive_url,
        carpetas_drive: data.subcarpetas || prev.carpetas_drive,
      }))
      mostrarExito('✅ Carpetas Drive creadas correctamente')
    } catch (e) {
      mostrarExito('❌ ' + e.message)
    } finally {
      setCreandoCarpetas(false)
    }
  }

  useEffect(() => {
    if (numero) cargarTodo()
  }, [numero])

  async function cargarTodo() {
    try {
      setCargando(true)
      setError('')

      // Cargar OT desde vista — usamos maybeSingle para tolerar vistas con JOINs que duplican filas
      const { data: otRows, error: otErr } = await supabase
        .from('v_portal_ot_detalle')
        .select('*')
        .eq('ot_numero', numero)
        .limit(1)

      if (otErr) throw otErr
      const otData = Array.isArray(otRows) ? otRows[0] : otRows
      if (!otData) throw new Error('No se encontró la OT ' + numero)

      const { data: otExtra } = await supabase
        .from('ots')
        .select('carpetas_drive, carpeta_drive_url')
        .eq('ot_numero', numero)
        .maybeSingle()

      setOT({
        ...otData,
        carpetas_drive:    otExtra?.carpetas_drive    || otData.carpetas_drive    || {},
        carpeta_drive_url: otExtra?.carpeta_drive_url || otData.carpeta_drive_url || null,
      })

      const [docs, asigs, actsData, resData] = await Promise.allSettled([
        supabase.from('documentos_ot').select('*').eq('ot_numero', numero).order('created_at', { ascending: false }),
        rpc('obtener_asignaciones_por_ot', { p_ot_numero: numero }),
        supabase.from('actas_terreno').select('*').eq('ot_numero', numero).order('created_at', { ascending: false }),
        supabase.from('numeros_informe').select('*').eq('ot_numero', numero).order('created_at', { ascending: false }),
      ])

      setDocumentos(docs.status === 'fulfilled'    ? (docs.value?.data    || []) : [])
      setAsignaciones(asigs.status === 'fulfilled' ? (asigs.value         || []) : [])
      setActas(actsData.status === 'fulfilled'     ? (actsData.value?.data || []) : [])
      setReservas(resData.status === 'fulfilled'   ? (resData.value?.data  || []) : [])

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

  // Progreso real: contar tipos distintos presentes + 1 (etapa 06 automática)
  // La tabla documentos_ot usa columna "tipo" (texto), no "etapa" ni "item"
  const _tiposConDoc = new Set(documentos.map(d => d.tipo).filter(Boolean)).size
  const _completadas = 1 + _tiposConDoc   // +1 para etapa 06 automática
  const progreso = Math.min(100, Math.round((_completadas / 12) * 100))
  const docsCargados = _tiposConDoc          // tipos distintos cargados
  const docsPendientes = Math.max(0, 11 - _tiposConDoc)  // 11 etapas manuales

  return (
    <div>
      {/* Modales */}
      {mostrarEditar && (
        <ModalEditarOT
          ot={ot}
          onClose={() => setMostrarEditar(false)}
          onGuardada={() => {
            setMostrarEditar(false)
            mostrarExito('OT actualizada correctamente')
            cargarTodo()
          }}
        />
      )}
      {mostrarAsignar && (
        <ModalAsignarInspector
          ot={ot}
          onClose={() => setMostrarAsignar(false)}
          onAsignada={() => {
            setMostrarAsignar(false)
            mostrarExito('Inspector asignado correctamente')
            cargarTodo()
            setTabActivo('asignaciones')
          }}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex gap-8" style={{ marginBottom: 16, alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ots')}>
          ← Órdenes de Trabajo
        </button>
        <span style={{ color: 'var(--gris)', fontSize: 13 }}>/ {ot.ot_numero}</span>
      </div>

      {/* Mensaje éxito */}
      {mensajeExito && (
        <div className="alert alert-ok" style={{ marginBottom: 16 }}>{mensajeExito}</div>
      )}

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
            {ot.carpeta_drive_url ? (
              <a href={ot.carpeta_drive_url} target="_blank" rel="noopener noreferrer">
                <button className="btn btn-secondary btn-sm">📁 Carpeta Drive</button>
              </a>
            ) : ['SCL', 'ANF'].includes(ot.sede) ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={crearCarpetasDrive}
                disabled={creandoCarpetas}
              >
                {creandoCarpetas ? '⏳ Creando...' : '📁 Crear carpetas Drive'}
              </button>
            ) : null}
            {puedeAsignar && (
              <button className="btn btn-warn btn-sm" onClick={() => setMostrarAsignar(true)}>
                👥 Asignar inspector
              </button>
            )}
            {puedeEditar && (
              <button className="btn btn-secondary btn-sm" onClick={() => setMostrarEditar(true)}>
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
          <KPIMini label="Documentos" valor={`${docsCargados}/11`} color="var(--azul)" />
          <KPIMini label="Pendientes" valor={docsPendientes} color={docsPendientes > 0 ? 'var(--rojo)' : 'var(--verde)'} />
          <KPIMini label="Asignaciones" valor={asignaciones.length} color="var(--ambar)" />
          <KPIMini label="Actas" valor={actas.length} color="var(--verde)" />
          <KPIMini label="Informes ESI/EAI" valor={reservas.length} color="var(--dorado)" />
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
            {t.id === 'informes'     && reservas.length     > 0 && <Chip n={reservas.length} />}
          </button>
        ))}
      </div>

      {/* Contenido tab */}
      <div style={{ marginTop: 16 }}>
        {tabActivo === 'info'         && <TabInfo ot={ot} />}
        {tabActivo === 'documentos'   && <TabDocumentos docs={documentos} ot={ot} onActualizar={cargarTodo} />}
        {tabActivo === 'asignaciones' && <TabAsignaciones ot={ot} />}
        {tabActivo === 'actas'        && <TabActa ot={ot} asignaciones={asignaciones} onActaCreada={cargarTodo} />}
        {tabActivo === 'informes'     && <TabInformes ot={ot} onInformeCreado={cargarTodo} />}
        {tabActivo === 'facturacion'  && <TabFacturacion ot={ot} onDocumentoSubido={cargarTodo} />}
      </div>
    </div>
  )
}

// ─── Tab Información ──────────────────────────────────────────────────────────
function TabInfo({ ot }) {
  const campos = [
    { label: 'N° OT',                 valor: ot.ot_numero },
    { label: 'Cliente',               valor: ot.cliente },
    { label: 'Contacto',              valor: ot.contacto },
    { label: 'Email cliente',         valor: ot.email_cliente },
    { label: 'Teléfono cliente',      valor: ot.telefono_cliente },
    { label: 'RUT empresa',           valor: ot.rut_empresa },
    { label: 'Sede',                  valor: ot.sede },
    { label: 'Año / Mes',             valor: `${ot.anio} / ${String(ot.mes).padStart(2,'0')}` },
    { label: 'Estado',                valor: ot.estado },
    { label: 'Progreso',              valor: `${ot.progreso || 0}%` },
    { label: 'Producto / Servicio',   valor: ot.producto_servicio_contratado || ot.tipo_servicio },
    { label: 'Referencia cotización', valor: ot.referencia_cotizacion },
    { label: 'Dirección / Faena',     valor: ot.direccion_faena },
    { label: 'Comercial',             valor: ot.comercial },
    { label: 'Supervisor',            valor: ot.supervisor },
    { label: 'Inspector',             valor: ot.inspector },
    { label: 'Fecha creación',        valor: ot.fecha_creacion ? new Date(ot.fecha_creacion).toLocaleString('es-CL') : '—' },
    { label: 'Observaciones',         valor: ot.observaciones },
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
        <div style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Serie</th><th>Desde</th><th>Hasta</th><th>Cant.</th>
                <th>Área</th><th>Producto</th><th>F. Inspección</th><th>F. Entrega</th><th>Estado</th>
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
                  <td className="text-sm">{r.fecha_inspeccion ? new Date(r.fecha_inspeccion).toLocaleDateString('es-CL') : '—'}</td>
                  <td className="text-sm">{r.fecha_entrega_informe ? new Date(r.fecha_entrega_informe).toLocaleDateString('es-CL') : '—'}</td>
                  <td><span className="badge badge-green">{r.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      padding: '1px 6px', marginLeft: 6,
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
    display: 'flex', gap: 24, flexWrap: 'wrap',
    paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--borde)',
  },
  tabBar: {
    display: 'flex', gap: 0,
    borderBottom: '2px solid var(--borde)', overflowX: 'auto',
  },
  tabBtn: {
    background: 'none', border: 'none',
    padding: '10px 18px', cursor: 'pointer',
    fontSize: 14, whiteSpace: 'nowrap',
    transition: 'color .15s',
    display: 'flex', alignItems: 'center',
  },
}
