// ============================================================
// TabDocumentos — Checklist visual de las 12 etapas WSS
// Props: { docs, ot, onActualizar }
//   docs — array de registros de documentos_ot
//          columnas reales: id, ot_numero, tipo, nombre_archivo,
//                           drive_file_id, drive_url, observacion,
//                           subido_por, created_at
//   ot   — objeto OT con ot.carpetas_drive (JSONB con URLs por etapa)
// ============================================================

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

// ── Helpers para visor de documentos ─────────────────────────────────────────

// Extrae el fileId de Drive desde drive_file_id o desde cualquier URL de Google
function getDriveFileId(doc) {
  if (doc.drive_file_id) return doc.drive_file_id
  const url = doc.drive_url || ''
  // /file/d/ID  (Drive)
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  // /document/d/ID, /spreadsheets/d/ID, /presentation/d/ID, /drawings/d/ID (Google Workspace)
  const m2 = url.match(/\/(document|spreadsheets|presentation|forms|drawings)\/d\/([a-zA-Z0-9_-]+)/)
  if (m2) return m2[2]
  // ?id=ID  (enlace compartido antiguo)
  const m3 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m3) return m3[1]
  return null
}

// Extensión del archivo (sin punto, minúsculas)
// Para archivos .msg.jpg (doble extensión), devuelve 'msg' para que no se intente preview de imagen
function getExt(nombre) {
  if (esMsgFile(nombre)) return 'msg'
  return (nombre || '').split('.').pop().toLowerCase()
}

// Tipos que se pueden mostrar en iframe (PDF, imágenes)
const EXT_PREVIEW = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'txt'])

// Detecta si el archivo es un correo .msg (incluso con extensión doble como .msg.jpg)
function esMsgFile(nombre) {
  const n = (nombre || '').toLowerCase()
  return n.endsWith('.msg') || /\.msg\./i.test(n)
}

// URL directa al archivo en Drive (para "Abrir en Drive")
function getDriveOpenUrl(doc) {
  const fileId = getDriveFileId(doc)
  if (fileId) return `https://drive.google.com/file/d/${fileId}/view`
  return doc.drive_url || null
}

// Determina si el doc tiene un archivo real viewable (no es carpeta de Drive)
function tieneArchivoViewable(doc) {
  if (doc.drive_file_id) return true
  const url = doc.drive_url || ''
  if (!url) return false
  if (url.includes('/drive/folders/')) return false    // URL de carpeta → no viewable
  if (url.includes('/file/d/')) return true            // URL de archivo Drive
  if (url.includes('.supabase.co/storage/')) return true // Supabase Storage
  if (/\/(document|spreadsheets|presentation)\/d\//.test(url)) return true
  return false
}

// URL proxy para servir el archivo via backend (OAuth2)
// Todo pasa por proxy-pdf: PDF/imágenes inline, MSG/DOCX/etc. como descarga
function getProxyUrl(doc) {
  const fileId = getDriveFileId(doc)
  if (fileId) return `/api/drive/proxy-pdf?fileId=${fileId}`
  const url = doc.drive_url || ''
  if (url.includes('.supabase.co/storage/')) return url
  return null
}

// ── Definición de las 12 etapas ───────────────────────────────────────────────
// tipo: valor que se guarda en documentos_ot.tipo

const ETAPAS = [
  { num: '01', tipo: 'correo_cotizacion',  nombre: 'Correo solicitud cotización',  actor: 'Comercial',            icono: '📧', descripcion: 'Archiva correo del cliente solicitando cotización' },
  { num: '02', tipo: 'cotizacion',          nombre: 'Cotización',                    actor: 'Comercial',            icono: '📋', descripcion: 'Genera y guarda la cotización enviada al cliente' },
  { num: '03', tipo: 'envio_cotizacion',    nombre: 'Envío cotización',              actor: 'Comercial',            icono: '📤', descripcion: 'Guarda evidencia del correo de envío de cotización' },
  { num: '04', tipo: 'orden_compra',        nombre: 'Orden de compra (OC)',          actor: 'Cliente / Comercial',  icono: '🛒', descripcion: 'Cliente acepta y envía OC; se archiva aquí' },
  { num: '05', tipo: 'correo_oc',           nombre: 'Correo recepción OC',           actor: 'Comercial',            icono: '📨', descripcion: 'Acuse de recibo de la Orden de Compra' },
  { num: '06', tipo: null,                   nombre: 'Creación OT',                   actor: 'Portal WSS',           icono: '🏭', descripcion: 'Sistema crea la OT — etapa automática', auto: true },
  { num: '07', tipo: 'asignacion',          nombre: 'Asignación de actividades',     actor: 'Supervisor',           icono: '👥', descripcion: 'Supervisor asigna inspector con requerimientos del cliente' },
  { num: '08', tipo: 'acta',               nombre: 'Acta de trabajo',               actor: 'Inspector',            icono: '📝', descripcion: 'Inspector genera REG-DII-001 (digital o manual)' },
  { num: '09', tipo: 'informe',            nombre: 'Informe(s)',                    actor: 'Inspector',            icono: '📊', descripcion: 'Genera ESI (Santiago) o EAI (Antofagasta) con correlativo' },
  { num: '10', tipo: 'envio_informes',     nombre: 'Envío informes',                actor: 'Inspector / Comercial',icono: '📬', descripcion: 'Envía informes al cliente y avisa a comercial para facturar' },
  { num: '11', tipo: 'sdf',                nombre: 'SDF Solicitud factura',         actor: 'Comercial',            icono: '💰', descripcion: 'Genera Solicitud De Factura' },
  { num: '12', tipo: 'factura',            nombre: 'Factura',                       actor: 'Facturación',          icono: '🧾', descripcion: 'Emite factura y la envía al cliente — proceso cerrado' },
]

// ── Componente principal ──────────────────────────────────────────────────────

export default function TabDocumentos({ docs = [], ot, onActualizar }) {
  const { usuario } = useAuth()
  const [subiendo, setSubiendo] = useState(null)   // tipo de etapa subiendo
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [error, setError] = useState('')
  const [visorDoc, setVisorDoc] = useState(null)   // { nombre, proxyUrl, driveUrl, ext }

  // Mapa de docs por tipo (clave real de documentos_ot)
  const docsPorTipo = {}
  docs.forEach(d => {
    if (!d.tipo) return
    if (!docsPorTipo[d.tipo]) docsPorTipo[d.tipo] = []
    docsPorTipo[d.tipo].push(d)
  })

  // carpetas_drive puede venir como objeto o string JSON desde Supabase
  let carpetas = {}
  try {
    carpetas = typeof ot?.carpetas_drive === 'string'
      ? JSON.parse(ot.carpetas_drive)
      : (ot?.carpetas_drive || {})
  } catch { carpetas = {} }

  // Calcular estado de cada etapa
  function estadoEtapa(etapa) {
    if (etapa.auto) return 'completa'          // etapa 06 siempre completa
    if (!etapa.tipo) return 'pendiente'
    const docsEtapa = docsPorTipo[etapa.tipo] || []
    return docsEtapa.length > 0 ? 'completa' : 'pendiente'
  }

  // Contar etapas completadas y calcular %
  const completadas = ETAPAS.filter(e => estadoEtapa(e) === 'completa').length
  const progreso = Math.round((completadas / 12) * 100)

  async function handleSubirArchivo(etapa, archivo, driveFolderUrl = null) {
    if (!archivo || !ot || !etapa.tipo) return

    setSubiendo(etapa.tipo)
    setError('')

    try {
      let fileUrl    = null
      let driveFileId = null

      if (driveFolderUrl) {
        // ── Ruta Drive: subir via API (no requiere que el usuario tenga permisos en Drive)
        const folderId = driveFolderUrl.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1]
        if (!folderId) throw new Error('No se pudo obtener el ID de la carpeta Drive desde la URL')

        // Convertir archivo a base64 en trozos para no romper la pila con archivos grandes
        const arrayBuffer = await archivo.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        const CHUNK = 8192
        let binary = ''
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
        }
        const base64 = btoa(binary)

        const resp = await fetch('/api/drive/subir-archivo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder_id:           folderId,
            file_name:           archivo.name,
            file_content_base64: base64,
            mime_type:           archivo.type || '',
          }),
        })

        const data = await resp.json()
        if (!data.ok) throw new Error(data.error || `Error HTTP ${resp.status} al subir a Drive`)

        fileUrl     = data.file_url
        driveFileId = data.file_id

      } else {
        // ── Ruta Supabase Storage (OT sin carpeta Drive configurada)
        // Sanitizar nombre: quitar tildes, reemplazar espacios y caracteres especiales
        const nombreLimpio = archivo.name
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
        const ruta = `${ot.ot_numero}/etapa_${etapa.num}/${Date.now()}_${nombreLimpio}`
        const { error: uploadErr } = await supabase.storage
          .from('documentos-ot')
          .upload(ruta, archivo, { upsert: false })
        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('documentos-ot')
          .getPublicUrl(ruta)
        fileUrl = urlData?.publicUrl || null
      }

      // Registrar en documentos_ot con los campos reales de la tabla
      const { error: upsertErr } = await supabase.from('documentos_ot').upsert({
        ot_numero:      ot.ot_numero,
        tipo:           etapa.tipo,
        nombre_archivo: archivo.name,
        drive_url:      fileUrl,
        drive_file_id:  driveFileId || null,
        subido_por:     ((usuario?.nombre || '') + ' ' + (usuario?.apellido || '')).trim(),
      }, { onConflict: 'ot_numero,tipo' })

      if (upsertErr) throw upsertErr

      setMensajeExito(`✅ "${etapa.nombre}" — archivo cargado correctamente`)
      setTimeout(() => setMensajeExito(''), 4000)
      onActualizar?.()

    } catch (e) {
      setError(`Error al subir archivo: ${e.message}`)
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ot_numero: ot.ot_numero }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error al sincronizar')
      setMensajeExito(
        `✅ Sincronizado — ${data.etapas_con_documentos} etapas con documentos (${data.total_archivos} archivos en Drive)`
      )
      setTimeout(() => setMensajeExito(''), 6000)
      onActualizar?.()
    } catch (e) {
      setError(`Error sincronizando desde Drive: ${e.message}`)
    } finally {
      setSincronizando(false)
    }
  }

  // Vincula manualmente una carpeta Drive a una etapa (OTs sin carpetas_drive configuradas)
  async function handleVincularDrive(etapa, driveUrl) {
    const url = (driveUrl || '').trim()
    if (!url || !ot?.ot_numero) return
    if (!url.includes('drive.google.com')) {
      setError('URL inválida — debe ser un enlace de Google Drive (drive.google.com)')
      return
    }
    const nuevasCarpetas = { ...carpetas, [etapa.num]: { url } }
    const { error: updErr } = await supabase
      .from('ots')
      .update({ carpetas_drive: nuevasCarpetas })
      .eq('ot_numero', ot.ot_numero)
    if (updErr) {
      setError('Error al vincular carpeta: ' + updErr.message)
    } else {
      setMensajeExito(`✅ Carpeta Drive vinculada para "${etapa.nombre}"`)
      setTimeout(() => setMensajeExito(''), 4000)
      onActualizar?.()
    }
  }

  return (
    <div>
      {/* Progreso general */}
      <div style={S.headerProgreso}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: progreso === 100 ? 'var(--verde)' : 'var(--azul)' }}>
              {completadas}/12
            </span>
            <span style={{ fontSize: 14, color: 'var(--gris)' }}>etapas documentadas</span>
          </div>
          <div className="progress-track" style={{ height: 10, borderRadius: 10 }}>
            <div
              className={`progress-fill ${progreso === 100 ? 'completa' : ''}`}
              style={{ width: `${progreso}%`, borderRadius: 10, transition: 'width .4s' }}
            />
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: progreso === 100 ? 'var(--verde)' : 'var(--azul)' }}>
            {progreso}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--gris)' }}>avance documental</div>
        </div>
        {ot?.carpeta_drive_url && (
          <button
            style={{ ...S.btnDrive, marginLeft: 16, flexShrink: 0 }}
            onClick={handleSincronizarDrive}
            disabled={sincronizando}
          >
            {sincronizando ? '⏳ Sincronizando...' : '🔄 Sincronizar Drive'}
          </button>
        )}
      </div>

      {/* Drive link general */}
      {ot?.carpeta_drive_url && (
        <div style={S.driveAlert}>
          <span>📁</span>
          <span>Carpeta principal en Google Drive:</span>
          <a href={ot.carpeta_drive_url} target="_blank" rel="noopener noreferrer" style={S.driveLink}>
            {ot.ot_numero} — {ot.cliente} →
          </a>
        </div>
      )}

      {/* Sin Drive configurado */}
      {!ot?.carpeta_drive_url && (
        <div style={{ ...S.driveAlert, background: '#FFF8E6', borderColor: '#F0C040', color: '#7A5A00' }}>
          ⚠️ Las carpetas de Drive se crean automáticamente al crear una nueva OT. Esta OT fue creada antes de esta función.
        </div>
      )}

      {/* Mensajes */}
      {mensajeExito && (
        <div className="alert alert-ok" style={{ marginBottom: 16 }}>{mensajeExito}</div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* Modal visor de documentos */}
      {visorDoc && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setVisorDoc(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, width: '90vw', maxWidth: 960,
            height: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>

            {/* Barra superior */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #E5E7EB', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                📄 {visorDoc.nombre}
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {visorDoc.proxyUrl && (
                  <a href={visorDoc.proxyUrl} download={visorDoc.nombre} rel="noopener noreferrer">
                    <button style={{ ...S.btnDrive, fontSize: 12 }}>⬇ Descargar</button>
                  </a>
                )}
                <button onClick={() => setVisorDoc(null)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {/* Cuerpo del visor */}
            {EXT_PREVIEW.has(visorDoc.ext) ? (
              // PDF e imágenes: iframe via proxy
              <iframe
                src={visorDoc.proxyUrl}
                title={visorDoc.nombre}
                style={{ flex: 1, border: 'none', width: '100%' }}
                allow="autoplay"
              />
            ) : (
              // DOCX, XLSX, MSG, etc. → no hay preview en navegador
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center', color: 'var(--gris)' }}>
                <div style={{ fontSize: 64 }}>📎</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--texto)' }}>
                  Este formato (.{visorDoc.ext}) no tiene previsualización en el navegador
                </div>
                <div style={{ fontSize: 13 }}>
                  Descarga el archivo para abrirlo en tu equipo.
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {visorDoc.proxyUrl && (
                    <a href={visorDoc.proxyUrl} download={visorDoc.nombre}>
                      <button style={{ ...S.btnUpload, fontSize: 14, padding: '10px 20px' }}>
                        ⬇ Descargar archivo
                      </button>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid de etapas */}
      <div style={S.grid}>
        {ETAPAS.map(etapa => {
          const estado = estadoEtapa(etapa)
          const carpetaInfo = carpetas[etapa.num]
          const etapaDocs = docsPorTipo[etapa.tipo] || []

          return (
            <EtapaCard
              key={etapa.num}
              etapa={etapa}
              estado={estado}
              carpetaInfo={carpetaInfo}
              etapaDocs={etapaDocs}
              subiendo={subiendo === etapa.tipo}
              onSubirArchivo={(archivo) => handleSubirArchivo(etapa, archivo, carpetaInfo?.url)}
              onVincularDrive={(url) => handleVincularDrive(etapa, url)}
              onVerDoc={(doc) => {
                const proxyUrl = getProxyUrl(doc)
                const driveUrl = getDriveOpenUrl(doc)
                const ext      = getExt(doc.nombre_archivo)
                if (proxyUrl || driveUrl) setVisorDoc({ nombre: doc.nombre_archivo, proxyUrl, driveUrl, ext })
              }}
            />
          )
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
        <Leyenda color="#16A34A" label="Completada — documento(s) cargado(s)" />
        <Leyenda color="#9CA3AF" label="Pendiente — sin documentos aún" />
        <Leyenda color="#1A3A5C" label="Automático — ejecutado por el sistema" />
      </div>
    </div>
  )
}

// ── Tarjeta por etapa ─────────────────────────────────────────────────────────

function EtapaCard({ etapa, estado, carpetaInfo, etapaDocs, subiendo, onSubirArchivo, onVincularDrive, onVerDoc }) {
  const [mostrarVincular, setMostrarVincular] = useState(false)
  const [vincularUrl, setVincularUrl] = useState('')

  const colorEstado = {
    completa:  { borde: '#16A34A', fondo: '#F0FDF4', badge: '#DCFCE7', texto: '#15803D' },
    pendiente: { borde: '#E5E7EB', fondo: '#fff',    badge: '#F3F4F6', texto: '#6B7280' },
  }
  const c = colorEstado[estado] || colorEstado.pendiente
  const esAuto = etapa.auto

  const iconoEstado = { completa: '✅', pendiente: '⏳' }
  const labelEstado = { completa: 'Completada', pendiente: 'Pendiente' }

  return (
    <div
      style={{
        ...S.card,
        borderLeft: `5px solid ${esAuto ? '#1A3A5C' : c.borde}`,
        background: esAuto ? '#EEF5FF' : c.fondo,
      }}
    >
      {/* Header de la tarjeta */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Número */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: esAuto ? '#1A3A5C' : (estado === 'completa' ? '#16A34A' : '#E5E7EB'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: estado === 'pendiente' ? '#6B7280' : '#fff',
          fontWeight: 800, fontSize: 13,
        }}>
          {estado === 'completa' ? '✓' : etapa.num}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto)' }}>
              {etapa.icono} {etapa.nombre}
            </span>
            {esAuto && (
              <span style={{ fontSize: 10, background: '#1A3A5C', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                AUTO
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gris)' }}>
            👤 {etapa.actor}
          </div>
        </div>

        {/* Badge estado */}
        <div style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
          background: esAuto ? '#1A3A5C' : c.badge,
          color: esAuto ? '#fff' : c.texto,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {iconoEstado[estado]} {esAuto ? 'Sistema' : labelEstado[estado]}
        </div>
      </div>

      {/* Descripción */}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gris)', lineHeight: 1.5 }}>
        {etapa.descripcion}
      </div>

      {/* Documentos cargados */}
      {etapaDocs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {etapaDocs.map((doc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#16A34A' }}>📄</span>
              <span style={{ fontSize: 12, color: 'var(--texto-sub)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.nombre_archivo}
              </span>
              {doc.created_at && (
                <span style={{ fontSize: 10, color: 'var(--gris)', whiteSpace: 'nowrap' }}>
                  {new Date(doc.created_at).toLocaleDateString('es-CL')}
                </span>
              )}
              {tieneArchivoViewable(doc) && (
                <button
                  style={S.btnMini}
                  onClick={() => onVerDoc?.(doc)}
                  title={`Ver ${doc.nombre_archivo}`}
                >
                  Ver
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Indicador/botón Drive */}
        {carpetaInfo?.url ? (
          <a href={carpetaInfo.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btnDrive, textDecoration: 'none', display: 'inline-block' }}>
            📁 Drive vinculado
          </a>
        ) : !esAuto && (
          mostrarVincular ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={vincularUrl}
                onChange={e => setVincularUrl(e.target.value)}
                placeholder="Pega URL de carpeta Drive..."
                autoFocus
                style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #85B7EB', borderRadius: 4, width: 200 }}
              />
              <button
                style={{ ...S.btnDrive, background: '#0f9d58', borderColor: '#0f9d58', color: '#fff' }}
                onClick={() => { onVincularDrive?.(vincularUrl); setMostrarVincular(false); setVincularUrl('') }}
              >✓ Vincular</button>
              <button style={S.btnMini} onClick={() => { setMostrarVincular(false); setVincularUrl('') }}>✕</button>
            </div>
          ) : (
            <button style={{ ...S.btnDrive, opacity: 0.7 }} onClick={() => setMostrarVincular(true)}>
              🔗 Vincular carpeta Drive
            </button>
          )
        )}

        {/* Botón subir — siempre file picker, sube via API (no requiere permisos en Drive) */}
        {!esAuto && (
          <label style={{ cursor: subiendo ? 'not-allowed' : 'pointer' }}>
            <input
              type="file"
              style={{ display: 'none' }}
              disabled={subiendo}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) onSubirArchivo(f)
                e.target.value = ''
              }}
            />
            <span style={{
              ...S.btnUpload,
              opacity: subiendo ? 0.6 : 1,
              display: 'inline-block',
            }}>
              {subiendo ? '⏳ Subiendo...' : '⬆ Subir documento'}
            </span>
          </label>
        )}
      </div>
    </div>
  )
}

// ── Auxiliares ────────────────────────────────────────────────────────────────

function Leyenda({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--gris)' }}>{label}</span>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  headerProgreso: {
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    border: '1.5px solid var(--borde)',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 16,
  },
  driveAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#E6F1FB',
    border: '1px solid #85B7EB',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#185FA5',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  driveLink: {
    color: '#185FA5',
    fontWeight: 700,
    textDecoration: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 12,
  },
  card: {
    borderRadius: 10,
    border: '1.5px solid var(--borde)',
    padding: '14px 16px',
    transition: 'box-shadow .15s',
  },
  btnDrive: {
    fontSize: 12,
    padding: '5px 10px',
    borderRadius: 6,
    border: '1.5px solid #85B7EB',
    background: '#E6F1FB',
    color: '#185FA5',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnUpload: {
    fontSize: 12,
    padding: '5px 10px',
    borderRadius: 6,
    border: '1.5px solid #D0D5DD',
    background: '#fff',
    color: '#344054',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnMini: {
    fontSize: 10,
    padding: '2px 7px',
    borderRadius: 4,
    border: '1px solid #85B7EB',
    background: '#E6F1FB',
    color: '#185FA5',
    cursor: 'pointer',
  },
}
