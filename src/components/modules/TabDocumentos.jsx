// ============================================================
// TabDocumentos — Checklist visual de las 12 etapas WSS
// Props:
//   docs         — array de documentos_ot desde Supabase
//   ot           — objeto OT (ot_numero, carpeta_drive_url, carpetas_drive)
//   onActualizar — callback para refrescar datos desde el padre
// Cambios v2:
//   - Carga MÚLTIPLE de archivos por etapa (input[multiple])
//   - Progreso individual por archivo (estado + nombre)
//   - Insert en vez de upsert para no sobrescribir
//   - Refetch via onActualizar() al terminar
//   - Estado de etapa se recalcula en tiempo real (sin reload)
// ============================================================
import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const ETAPAS = [
  { num: '01', nombre: 'Correo solicitud cotización',  actor: 'Comercial',             icono: '📧', descripcion: 'Archiva correo del cliente solicitando cotización' },
  { num: '02', nombre: 'Cotización',                   actor: 'Comercial',             icono: '📋', descripcion: 'Genera y guarda la cotización enviada al cliente' },
  { num: '03', nombre: 'Envío cotización',             actor: 'Comercial',             icono: '📤', descripcion: 'Guarda evidencia del correo de envío de cotización' },
  { num: '04', nombre: 'Orden de compra (OC)',         actor: 'Cliente / Comercial',   icono: '🛒', descripcion: 'Cliente acepta y envía OC; se archiva aquí' },
  { num: '05', nombre: 'Correo recepción OC',          actor: 'Comercial',             icono: '📨', descripcion: 'Acuse de recibo de la Orden de Compra' },
  { num: '06', nombre: 'Creación OT',                  actor: 'Portal WSS',            icono: '🏭', descripcion: 'Sistema crea la OT — etapa automática', auto: true },
  { num: '07', nombre: 'Asignación de actividades',   actor: 'Supervisor',             icono: '👥', descripcion: 'Supervisor asigna inspector con requerimientos del cliente' },
  { num: '08', nombre: 'Acta de trabajo',              actor: 'Inspector',             icono: '📝', descripcion: 'Inspector genera REG-DII-001 (digital o manual)' },
  { num: '09', nombre: 'Informe(s)',                   actor: 'Inspector',             icono: '📊', descripcion: 'Genera ESI (Santiago) o EAI (Antofagasta) con correlativo' },
  { num: '10', nombre: 'Envío informes',               actor: 'Inspector / Comercial', icono: '📬', descripcion: 'Envía informes al cliente y avisa a comercial para facturar' },
  { num: '11', nombre: 'SDF Solicitud factura',        actor: 'Comercial',             icono: '💰', descripcion: 'Genera Solicitud De Factura' },
  { num: '12', nombre: 'Factura',                      actor: 'Facturación',           icono: '🧾', descripcion: 'Emite factura y la envía al cliente — proceso cerrado' },
]

export default function TabDocumentos({ docs = [], ot, onActualizar }) {
  const { usuario } = useAuth()

  // Estado local de documentos para actualización inmediata sin esperar refetch
  const [docsLocales, setDocsLocales] = useState(docs)
  // Sincronizar cuando llegan nuevos props desde el padre
  useState(() => { setDocsLocales(docs) }, [docs])

  // Progreso de subida por etapa: { [etapa.num]: [ {nombre, estado, error?} ] }
  const [progSubida, setProgSubida] = useState({})
  const [errorGlobal, setErrorGlobal] = useState('')

  // Mapa de docs por item
  const docsPorEtapa = useCallback(() => {
    const mapa = {}
    docsLocales.forEach(d => {
      const num = String(d.item || '').padStart(2, '0')
      if (!mapa[num]) mapa[num] = []
      mapa[num].push(d)
    })
    return mapa
  }, [docsLocales])

  // Carpetas Drive desde ot.carpetas_drive (JSONB)
  let carpetas = {}
  try {
    carpetas = typeof ot?.carpetas_drive === 'string'
      ? JSON.parse(ot.carpetas_drive)
      : (ot?.carpetas_drive || {})
  } catch { carpetas = {} }

  function estadoEtapa(etapa) {
    if (etapa.auto) return 'completa'
    const mapa = docsPorEtapa()
    const etapaDocs = mapa[etapa.num] || []
    const tieneCargado = etapaDocs.some(d =>
      ['Cargado','Completada','Aprobado'].includes(d.estado_documento)
    )
    if (tieneCargado) return 'completa'
    if (etapaDocs.length > 0) return 'en_proceso'
    return 'pendiente'
  }

  const completadas = ETAPAS.filter(e => estadoEtapa(e) === 'completa').length
  const progreso    = Math.round((completadas / 12) * 100)

  async function handleSubirArchivos(etapa, archivos) {
    if (!archivos?.length || !ot) return
    setErrorGlobal('')

    const listaArchivos = Array.from(archivos)

    setProgSubida(prev => ({
      ...prev,
      [etapa.num]: listaArchivos.map(f => ({ nombre: f.name, estado: 'subiendo' }))
    }))

    const nuevosDocsLocales = []
    let hayErrores = false

    for (let i = 0; i < listaArchivos.length; i++) {
      const archivo = listaArchivos[i]
      const timestamp = Date.now() + i
      const ruta = `${ot.ot_numero}/etapa_${etapa.num}/${timestamp}_${archivo.name}`

      try {
        const { error: uploadErr } = await supabase.storage
          .from('documentos-ot')
          .upload(ruta, archivo, { upsert: false })

        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('documentos-ot')
          .getPublicUrl(ruta)

        const fileUrl = urlData?.publicUrl || null

        const { data: insertData, error: insertErr } = await supabase
          .from('documentos_ot')
          .insert({
            ot_numero:        ot.ot_numero,
            item:             etapa.num,
            nombre_documento: archivo.name,
            etapa:            etapa.num,
            estado_documento: 'Cargado',
            responsable:      usuario?.nombre
              ? (usuario.nombre + ' ' + (usuario.apellido || '')).trim()
              : usuario?.email || '',
            fecha_cargaq:     new Date().toISOString(),
            drive_url:        fileUrl,
            storage_path:     ruta,
          })
          .select()
          .single()

        if (insertErr) throw insertErr

        setProgSubida(prev => {
          const lista = [...(prev[etapa.num] || [])]
          lista[i] = { nombre: archivo.name, estado: 'ok' }
          return { ...prev, [etapa.num]: lista }
        })

        if (insertData) nuevosDocsLocales.push(insertData)

      } catch (e) {
        hayErrores = true
        setProgSubida(prev => {
          const lista = [...(prev[etapa.num] || [])]
          lista[i] = { nombre: archivo.name, estado: 'error', error: e.message }
          return { ...prev, [etapa.num]: lista }
        })
      }
    }

    if (nuevosDocsLocales.length > 0) {
      setDocsLocales(prev => [...prev, ...nuevosDocsLocales])
    }

    if (typeof onActualizar === 'function') {
      setTimeout(() => onActualizar(), 800)
    }

    if (!hayErrores) {
      setTimeout(() => {
        setProgSubida(prev => {
          const next = { ...prev }
          delete next[etapa.num]
          return next
        })
      }, 5000)
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
      </div>

      {ot?.carpeta_drive_url ? (
        <div style={S.driveAlert}>
          <span>📁</span>
          <span>Carpeta principal Google Drive:</span>
          <a href={ot.carpeta_drive_url} target="_blank" rel="noopener noreferrer" style={S.driveLink}>
            {ot.ot_numero} — {ot.cliente} →
          </a>
        </div>
      ) : (
        <div style={{ ...S.driveAlert, background: '#FFF8E6', borderColor: '#F0C040', color: '#7A5A00' }}>
          ⚠️ Las carpetas Drive se crean automáticamente al crear una nueva OT. Esta OT fue creada antes de esa función. Los documentos se guardan en Storage interno.
        </div>
      )}

      {errorGlobal && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorGlobal}</div>}

      <div style={S.grid}>
        {ETAPAQ�map(etapa => {
          const mapa     = docsPorEtapa()
          const estado   = estadoEtapa(etapa)
          const etapaDocs = mapa[etapa.num] || []
          const carpetaInfo = carpetas[etapa.num]
          const progEtapa = progSubida[etapa.num] || []

          return (
            <EtapaCard
              key={etapa.num}
              etapa={etapa}
              estado={estado}
              carpetaInfo={carpetaInfo}
              etapaDocs={etapaDocs}
              progSubida={progEtapa}
              onSubirArchivos={(archivos) => handleSubirArchivos(etapa, archivos)}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
        <Leyenda color="#16A34A" label="Completada — documento(s) cargado(s)" />
        <Leyenda color="#D97706" label="En proceso ⌔ hay actividad registrada" />
        <Leyenda color="#9CA3AF" label="Pendiente — sin documentos aún" />
        <Leyenda color="#1A3A5C" label="Automático — ejecutado por el sistema" />
      </div>
    </div>
  )
}

function EtapaCard({ etapa, estado, carpetaInfo, etapaDocs, progSubida, onSubirArchivos }) {
  const estaSubiendo = progSubida.some(p => p.estado === 'subiendo')
  const esAuto       = etapa.auto

  const colorEstado = {
    completa:   { borde: '#16A34A', fondo: '#F0FDF4', badge: '#DCFCE7', texto: '#15803D' },
    en_proceso: { borde: '#D97706', fondo: '#FFFBEB', badge: '#FEF3C7', texto: '#B45309' },
    pendiente:  { borde: '#E5E7EB', fondo: '#fff',    badge: '#F3F4F6', texto: '#6B7280' },
  }
  const c = colorEstado[estado] || colorEstado.pendiente
  const labelEstado = { completa: 'Completada', en_proceso: 'En proceso', pendiente: 'Pendiente' }
  const iconoEstado = { completa: '✅', en_proceso: '🔄', pendiente: '⏳' }

  return (
    <div style={{ ...S.card, borderLeft: `5px solid ${esAuto ? '#1A3A5C' : c.borde}`, background: esAuto ? '#EEF5FF' : c.fondo }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: esAuto ? '#1A3A5C' : estado === 'completa' ? '#16A34A' : estado === 'en_proceso' ? '#D97706' : '#E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: estado === 'pendiente' ? '#6B7280' : '#fff', fontWeight: 800, fontSize: 13,
        }}>
          {estado === 'completa' ? '✓' : etapa.num}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto)' }}>{etapa.icono} {etapa.nombre}</span>
            {esAuto && <span style={{ fontSize: 10, background: '#1A3A5C', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>AUTO</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gris)' }}>👤 {etapa.actor}</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: esAuto ? '#1A3A5C' : c.badge, color: esAuto ? '#fff' : c.texto, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {iconoEstado[estado]} {esAuto ? 'Sistema' : labelEstado[estado]}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gris)', lineHeight: 1.5 }}>{etapa.descripcion}</div>

      {etapaDocs.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {etapaDocs.map((doc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#16A34A' }}>📄</span>
              <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--texto-sub)' }}>
                {doc.nombre_documento}
              </span>
              <span style={{ fontSize: 10, color: 'var(--gris)', whiteSpace: 'nowrap' }}>
                {doc.fecha_carga ? new Date(doc.fecha_carga).toLocaleDateString('es-CL') : ''}
              </span>
              {doc.drive_url && (
                <a href={doc.drive_url} target="_blank" rel="noopener noreferrer">
                  <button style={S.btnMini}>⬇Ver</button>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {progSubida.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {progSubida.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span>{p.estado === 'subiendo' ? '⏳' : p.estado === 'ok' ? '✅' : '❌'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
              {p.estado === 'error' && <span style={{ color: '#DC2626', fontSize: 10 }}>{p.error?.substring(0, 40)}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {carpetaInfo?.url ? (
          <a href={carpetaInfo.url} target="_blank" rel="noopener noreferrer">
            <button style={S.btnDrive}>📁 Carpeta Drive</button>
          </a>
        ) : (
          <button style={{ ...S.btnDrive, opacity: 0.45, cursor: 'not-allowed' }} disabled title="Sin carpeta Drive asociada">
             📁 Sin carpeta Drive
          </button>
        )}

        {!esAuto && (
          <label style={{ cursor: estaSubiendo ? 'not-allowed' : 'pointer' }}>
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              disabled={estaSubiendo}
              onChange={e => {
                if (e.target.files?.length) onSubirArchivos(e.target.files)
                e.target.value = ''
              }}
            />
            <span style={{ ...S.btnUpload, opacity: estaSubiendo ? 0.6 : 1, display: 'inline-block', cursor: estaSubiendo ? 'not-allowed' : 'pointer' }}>
             {estaSubiendo ? '⏳ Subiendo...' : '⬆ Subir documentos'}
            </span>
          </label>
        )}
      </div>
    </div>
  )
}

function Leyenda({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--gris)' }}>{label}</span>
    </div>
  )
}

const S = {
  headerProgreso: {
    display: 'flex', alignItems: 'center', background: '#fff',
    border: '1.5px solid var(--borde)', borderRadius: 12,
    padding: '16px 20px', marginBottom: 16,
  },
  driveAlert: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#E6F1FB', border: '1px solid #85B7EB',
    borderRadius: 8, padding: '10px 14px', fontSize: 13,
    color: '#185FA5', marginBottom: 16, flexWrap: 'wrap',
  },
  driveLink: { color: '#185FA5', fontWeight: 700, textDecoration: 'none' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 },
  card: { borderRadius: 10, border: '1.5px solid var(--borde)', padding: '14px 16px', transition: 'box-shadow .15s' },
  btnDrive:  { fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #85B7EB', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontWeight: 600 },
  btnUpload: { fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #D0D5DD', background: '#fff', color: '#344054', fontWeight: 600 },
  btnMini:   { fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid #85B7EB', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer' },
}
