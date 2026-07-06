// ============================================================
// TabDocumentos — Checklist visual de las 12 etapas WSS
// ============================================================

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const ETAPAS = [
  { num: '01', tipo: 'correo_cotizacion',  nombre: 'Correo solicitud cotización',  actor: 'Comercial',            icono: '📧', descripcion: 'Archiva correo del cliente solicitando cotización', auto: false },
  { num: '02', tipo: 'cotizacion',          nombre: 'Cotización',                    actor: 'Comercial',            icono: '📋', descripcion: 'Genera y guarda la cotización enviada al cliente', auto: false },
  { num: '03', tipo: 'envio_cotizacion',    nombre: 'Envío cotización',              actor: 'Comercial',            icono: '📤', descripcion: 'Guarda evidencia del correo de envío de cotización', auto: false },
  { num: '04', tipo: 'orden_compra',        nombre: 'Orden de compra (OC)',          actor: 'Cliente / Comercial',  icono: '🛒', descripcion: 'Cliente acepta y envía OC; se archiva aquí', auto: false },
  { num: '05', tipo: 'correo_oc',           nombre: 'Correo recepción OC',           actor: 'Comercial',            icono: '📨', descripcion: 'Acuse de recibo de la Orden de Compra', auto: false },
  { num: '06', tipo: null,                   nombre: 'Creación OT',                   actor: 'Portal WSS',           icono: '🏭', descripcion: 'Sistema crea la OT — etapa automática', auto: true },
  { num: '07', tipo: 'asignacion',          nombre: 'Asignación de actividades',     actor: 'Supervisor',           icono: '👥', descripcion: 'Supervisor asigna inspector con requerimientos del cliente', auto: false },
  { num: '08', tipo: 'acta',               nombre: 'Acta de trabajo',               actor: 'Inspector',            icono: '📝', descripcion: 'Inspector genera REG-DII-001 (digital o manual)', auto: false },
  { num: '09', tipo: 'informe',            nombre: 'Informe(s)',                    actor: 'Inspector',            icono: '📊', descripcion: 'Genera ESI (Santiago) o EAI (Antofagasta) con correlativo', auto: false },
  { num: '10', tipo: 'envio_informes',     nombre: 'Envío informes',                actor: 'Inspector / Comercial',icono: '📬', descripcion: 'Envía informes al cliente y avisa a comercial para facturar', auto: false },
  { num: '11', tipo: 'sdf',                nombre: 'SDF Solicitud factura',         actor: 'Comercial',            icono: '💰', descripcion: 'Genera Solicitud De Factura', auto: false },
  { num: '12', tipo: 'factura',            nombre: 'Factura',                       actor: 'Facturación',          icono: '🧾', descripcion: 'Emite factura y la envía al cliente — proceso cerrado', auto: false },
]

export default function TabDocumentos({ docs = [], ot, onActualizar }) {
  const { usuario } = useAuth()
  const [subiendo, setSubiendo] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [error, setError] = useState('')

  const docsPorTipo = {}
  docs.forEach(d => {
    if (!d.tipo) return
    if (!docsPorTipo[d.tipo]) docsPorTipo[d.tipo] = []
    docsPorTipo[d.tipo].push(d)
  })

  let carpetas = {}
  try {
    carpetas = typeof ot?.carpetas_drive === 'string'
      ? JSON.parse(ot.carpetas_drive)
      : (ot?.carpetas_drive || {})
  } catch { carpetas = {} }

  function estadoEtapa(etapa) {
    if (etapa.auto) return 'completa'
    if (!etapa.tipo) return 'pendiente'
    return (docsPorTipo[etapa.tipo] || []).length > 0 ? 'completa' : 'pendiente'
  }

  const completadas = ETAPAS.filter(e => estadoEtapa(e) === 'completa').length
  const progreso = Math.round((completadas / 12) * 100)

  async function handleSubirArchivo(etapa, archivo) {
    if (!archivo || !ot || !etapa.tipo) return
    setSubiendo(etapa.tipo)
    setError('')
    try {
      const ruta = ot.ot_numero + '/etapa_' + etapa.num + '/' + Date.now() + '_' + archivo.name
      const { error: uploadErr } = await supabase.storage.from('documentos-ot').upload(ruta, archivo, { upsert: false })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('documentos-ot').getPublicUrl(ruta)
      const { error: upsertErr } = await supabase.from('documentos_ot').upsert({
        ot_numero: ot.ot_numero, tipo: etapa.tipo,
        nombre_archivo: archivo.name, drive_url: urlData?.publicUrl || null,
        subido_por: ((usuario?.nombre || '') + ' ' + (usuario?.apellido || '')).trim(),
      }, { onConflict: 'ot_numero,tipo' })
      if (upsertErr) throw upsertErr
      setMensajeExito('Etapa "' + etapa.nombre + '" — archivo cargado')
      setTimeout(() => setMensajeExito(''), 4000)
      onActualizar?.()
    } catch (e) {
      setError('Error al subir archivo: ' + e.message)
    } finally {
      setSubiendo(null)
    }
  }

  async function handleSincronizarDrive() {
    if (!ot?.ot_numero) return
    setSincronizando(true)
    setError('')
    try {
      const resp = await fetch('/api/drive/escanear-ot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ot_numero: ot.ot_numero }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error al sincronizar')
      setMensajeExito('Sincronizado — ' + data.etapas_con_documentos + ' etapas con documentos')
      setTimeout(() => setMensajeExito(''), 6000)
      onActualizar?.()
    } catch (e) {
      setError('Error sincronizando desde Drive: ' + e.message)
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div>
      <div style={S.headerProgreso}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: progreso === 100 ? 'var(--verde)' : 'var(--azul)' }}>{completadas}/12</span>
            <span style={{ fontSize: 14, color: 'var(--gris)' }}>etapas documentadas</span>
          </div>
          <div className="progress-track" style={{ height: 10, borderRadius: 10 }}>
            <div className={'progress-fill ' + (progreso === 100 ? 'completa' : '')} style={{ width: progreso + '%', borderRadius: 10, transition: 'width .4s' }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: progreso === 100 ? 'var(--verde)' : 'var(--azul)' }}>{progreso}%</div>
          <div style={{ fontSize: 11, color: 'var(--gris)' }}>avance documental</div>
        </div>
        {ot?.carpeta_drive_url && (
          <button style={{ ...S.btnDrive, marginLeft: 16 }} onClick={handleSincronizarDrive} disabled={sincronizando}>
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Drive'}
          </button>
        )}
      </div>
      {ot?.carpeta_drive_url && (
        <div style={S.driveAlert}>
          <span>Carpeta principal en Google Drive: </span>
          <a href={ot.carpeta_drive_url} target="_blank" rel="noopener noreferrer" style={S.driveLink}>{ot.ot_numero} abrir en Drive</a>
        </div>
      )}
      {!ot?.carpeta_drive_url && (
        <div style={{ ...S.driveAlert, background: '#FFF8E6', borderColor: '#F0C040', color: '#7A5A00' }}>
          Las carpetas de Drive se crean al crear una nueva OT.
        </div>
      )}
      {mensajeExito && <div className="alert alert-ok" style={{ marginBottom: 16 }}>{mensajeExito}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      <div style={S.grid}>
        {ETAPAS.map(etapa => (
          <EtapaCard key={etapa.num} etapa={etapa} estado={estadoEtapa(etapa)}
            carpetaInfo={carpetas[etapa.num]} etapaDocs={docsPorTipo[etapa.tipo] || []}
            subiendo={subiendo === etapa.tipo} onSubirArchivo={(a) => handleSubirArchivo(etapa, a)} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
        <Leyenda color="#16A34A" label="Completada" />
        <Leyenda color="#9CA3AF" label="Pendiente" />
        <Leyenda color="#1A3A5C" label="Automático" />
      </div>
    </div>
  )
}

function EtapaCard({ etapa, estado, carpetaInfo, etapaDocs, subiendo, onSubirArchivo }) {
  const c = estado === 'completa'
    ? { borde: '#16A34A', fondo: '#F0FDF4', badge: '#DCFCE7', texto: '#15803D' }
    : { borde: '#E5E7EB', fondo: '#fff',    badge: '#F3F4F6', texto: '#6B7280' }
  const esAuto = etapa.auto
  return (
    <div style={{ ...S.card, borderLeft: '5px solid ' + (esAuto ? '#1A3A5C' : c.borde), background: esAuto ? '#EEF5FF' : c.fondo }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: esAuto ? '#1A3A5C' : (estado === 'completa' ? '#16A34A' : '#E5E7EB'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: estado === 'pendiente' ? '#6B7280' : '#fff', fontWeight: 800, fontSize: 13 }}>
          {estado === 'completa' ? '✓' : etapa.num}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{etapa.icono} {etapa.nombre}</span>
            {esAuto && <span style={{ fontSize: 10, background: '#1A3A5C', color: '#fff', borderRadius: 4, padding: '1px 6px' }}>AUTO</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gris)' }}>{etapa.actor}</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
          background: esAuto ? '#1A3A5C' : c.badge, color: esAuto ? '#fff' : c.texto, whiteSpace: 'nowrap' }}>
          {estado === 'completa' ? 'Completada' : 'Pendiente'}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gris)', lineHeight: 1.5 }}>{etapa.descripcion}</div>
      {etapaDocs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {etapaDocs.map((doc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nombre_archivo}</span>
              {doc.created_at && <span style={{ fontSize: 10, color: 'var(--gris)' }}>{new Date(doc.created_at).toLocaleDateString('es-CL')}</span>}
              {doc.drive_url && <a href={doc.drive_url} target="_blank" rel="noopener noreferrer"><button style={S.btnMini}>Ver</button></a>}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {carpetaInfo?.url
          ? <a href={carpetaInfo.url} target="_blank" rel="noopener noreferrer"><button style={S.btnDrive}>Carpeta Drive</button></a>
          : <button style={{ ...S.btnDrive, opacity: 0.4, cursor: 'not-allowed' }} disabled>Sin carpeta Drive</button>}
        {!esAuto && (carpetaInfo?.url
          ? <button style={S.btnUpload} onClick={() => window.open(carpetaInfo.url, '_blank')} disabled={subiendo}>Subir en Drive</button>
          : <label>
              <input type="file" style={{ display: 'none' }} disabled={subiendo}
                onChange={e => { const f = e.target.files?.[0]; if (f) onSubirArchivo(f); e.target.value = '' }} />
              <span style={{ ...S.btnUpload, display: 'inline-block' }}>{subiendo ? 'Subiendo...' : 'Subir documento'}</span>
            </label>)}
      </div>
    </div>
  )
}

function Leyenda({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 11, color: 'var(--gris)' }}>{label}</span>
    </div>
  )
}

const S = {
  headerProgreso: { display: 'flex', alignItems: 'center', background: '#fff', border: '1.5px solid var(--borde)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 },
  driveAlert: { display: 'flex', alignItems: 'center', gap: 8, background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#185FA5', marginBottom: 16 },
  driveLink: { color: '#185FA5', fontWeight: 700, textDecoration: 'none' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 },
  card: { borderRadius: 10, border: '1.5px solid var(--borde)', padding: '14px 16px' },
  btnDrive: { fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #85B7EB', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontWeight: 600 },
  btnUpload: { fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #D0D5DD', background: '#fff', color: '#344054', cursor: 'pointer', fontWeight: 600 },
  btnMini: { fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid #85B7EB', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer' },
}
