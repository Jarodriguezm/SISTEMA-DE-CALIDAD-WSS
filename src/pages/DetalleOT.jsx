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
  { id: 'informes',     label: 'Informes ESI/EAI' },
  { id: 'facturacion',  label: 'Facturación' },
]

function badgeEstado(estado) {
  const mapa = {
    'Pendiente de asignación': 'badge-red', 'Pendiente': 'badge-red',
    'Sin inspector': 'badge-red', 'Asignado': 'badge-amber',
    'En proceso': 'badge-blue', 'Acta cargada': 'badge-blue',
    'Informe cargado': 'badge-green', 'Cerrada documentalmente': 'badge-green',
  }
  return mapa[estado] || 'badge-gray'
}

export default function DetalleOT() {
  const { numero } = useParams()
  const navigate = useNavigate()
  const { esAdmin, esComercial, esSupervisor } = useAuth()

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

  const puedeEditar = esAdmin() || esComercial() || esSupervisor()
  const puedeAsignar = esAdmin() || esSupervisor()

  function mostrarExito(msg) { setMensajeExito(msg); setTimeout(() => setMensajeExito(''), 3500) }

  useEffect(() => { if (numero) cargarTodo() }, [numero])

  async function cargarTodo() {
    try {
      setCargando(true); setError('')
      const { data: otData, error: otErr } = await supabase
        .from('v_portal_ot_detalle').select('*').eq('ot_numero', numero).single()
      if (otErr) throw otErr
      if (!otData) throw new Error('No se encontró la OT ' + numero)

      const { data: otExtra } = await supabase
        .from('ots').select('carpetas_drive, carpeta_drive_url').eq('ot_numero', numero).maybeSingle()

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
        {[1,2,3].map(i => <div key={i} style={{ height: 80, background: '#F2F4F7', borderRadius: 12 }} />)}
      </div>
    </div>
  )

  if (error) return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ots')} style={{ marginBottom: 16 }}>← Volver a OTs</button>
      <div className="alert alert-error">{error}</div>
    </div>
  )

  if (!ot) return null

  // Progreso: contar tipos distintos en documentos_ot + 1 (etapa 06 automática)
  const _tiposConDoc = new Set(documentos.map(d => d.tipo).filter(Boolean)).size
  const _completadas = 1 + _tiposConDoc
  const progreso = Math.min(100, Math.round((_completadas / 12) * 100))
  const docsCargados = _tiposConDoc
  const docsPendientes = Math.max(0, 11 - _tiposConDoc)

  return (
    <div>
      {mostrarEditar && (
        <ModalEditarOT ot={ot} onClose={() => setMostrarEditar(false)}
          onGuardada={() => { setMostrarEditar(false); mostrarExito('OT actualizada'); cargarTodo() }} />
      )}
      {mostrarAsignar && (
        <ModalAsignarInspector ot={ot} onClose={() => setMostrarAsignar(false)}
          onAsignada={() => { setMostrarAsignar(false); mostrarExito('Inspector asignado'); cargarTodo(); setTabActivo('asignaciones') }} />
      )}

      <div className="flex gap-8" style={{ marginBottom: 16, alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/ots')}>← Órdenes de Trabajo</button>
        <span style={{ color: 'var(--gris)', fontSize: 13 }}>/ {ot.ot_numero}</span>
      </div>

      {mensajeExito && <div className="alert alert-ok" style={{ marginBottom: 16 }}>{mensajeExito}</div>}

      <div className="card" style={{ marginBottom: 20, borderLeft: '5px solid var(--azul)' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: 'var(--azul)' }}>{ot.ot_numero}</span>
              <span className="badge badge-blue">{ot.sede}</span>
              <span className={'badge ' + badgeEstado(ot.estado)}>{ot.estado}</span>
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>{ot.cliente}</h2>
            <p style={{ margin: 0, color: 'var(--gris)', fontSize: 13 }}>{ot.producto_servicio_contratado || ot.tipo_servicio || '—'}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {ot.carpeta_drive_url && (
              <a href={ot.carpeta_drive_url} target="_blank" rel="noopener noreferrer">
                <button className="btn btn-secondary btn-sm">Carpeta Drive</button>
              </a>
            )}
            {puedeAsignar && <button className="btn btn-warn btn-sm" onClick={() => setMostrarAsignar(true)}>Asignar inspector</button>}
            {puedeEditar && <button className="btn btn-secondary btn-sm" onClick={() => setMostrarEditar(true)}>Editar OT</button>}
            <div style={{ textAlign: 'right' }}>
              <div className="progress-track" style={{ width: 160 }}>
                <div className={'progress-fill ' + (progreso >= 100 ? 'completa' : '')} style={{ width: progreso + '%' }} />
              </div>
              <span className="text-sm">{progreso}% avance documental</span>
            </div>
          </div>
        </div>
        <div style={styles.kpiRow}>
          <KPIMini label="Documentos" valor={docsCargados + '/11'} color="var(--azul)" />
          <KPIMini label="Pendientes" valor={docsPendientes} color={docsPendientes > 0 ? 'var(--rojo)' : 'var(--verde)'} />
          <KPIMini label="Asignaciones" valor={asignaciones.length} color="var(--ambar)" />
          <KPIMini label="Actas" valor={actas.length} color="var(--verde)" />
          <KPIMini label="Informes ESI/EAI" valor={reservas.length} color="var(--dorado)" />
          <KPIMini label="Supervisor" valor={ot.supervisor || '—'} color="var(--gris)" />
          <KPIMini label="Inspector" valor={ot.inspector || '—'} color="var(--gris)" />
        </div>
      </div>

      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTabActivo(t.id)} style={{
            ...styles.tabBtn,
            borderBottom: tabActivo === t.id ? '3px solid var(--azul)' : '3px solid transparent',
            color: tabActivo === t.id ? 'var(--azul)' : 'var(--gris)',
            fontWeight: tabActivo === t.id ? 700 : 400,
          }}>
            {t.label}
            {t.id === 'documentos'   && documentos.length   > 0 && <Chip n={documentos.length} />}
            {t.id === 'asignaciones' && asignaciones.length > 0 && <Chip n={asignaciones.length} />}
            {t.id === 'actas'        && actas.length        > 0 && <Chip n={actas.length} />}
            {t.id === 'informes'     && reservas.length     > 0 && <Chip n={reservas.length} />}
          </button>
        ))}
      </div>

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

function TabInfo({ ot }) {
  const campos = [
    { label: 'N° OT',                 valor: ot.ot_numero },
    { label: 'Cliente',               valor: ot.cliente },
    { label: 'Contacto',              valor: ot.contacto },
    { label: 'Email cliente',         valor: ot.email_cliente },
    { label: 'Teléfono cliente',      valor: ot.telefono_cliente },
    { label: 'RUT empresa',           valor: ot.rut_empresa },
    { label: 'Sede',                  valor: ot.sede },
    { label: 'Año / Mes',             valor: ot.anio + ' / ' + String(ot.mes).padStart(2,'0') },
    { label: 'Estado',                valor: ot.estado },
    { label: 'Progreso',              valor: (ot.progreso || 0) + '%' },
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
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gris)', textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: 14, color: 'var(--texto)', marginTop: 2 }}>{c.valor}</div>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

function KPIMini({ label, valor, color }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontWeight: 800, fontSize: 18, color }}>{valor}</div>
      <div style={{ fontSize: 11, color: 'var(--gris)' }}>{label}</div>
    </div>
  )
}

function Chip({ n }) {
  return <span style={{ background: 'var(--azul)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', marginLeft: 6 }}>{n}</span>
}

const styles = {
  kpiRow: { display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--borde)' },
  tabBar: { display: 'flex', gap: 0, borderBottom: '2px solid var(--borde)', overflowX: 'auto' },
  tabBtn: { background: 'none', border: 'none', padding: '10px 18px', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', transition: 'color .15s', display: 'flex', alignItems: 'center' },
          }
