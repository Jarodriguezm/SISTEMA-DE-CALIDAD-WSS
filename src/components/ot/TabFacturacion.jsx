// ============================================================
// TabFacturacion.jsx — Flujo comercial de facturación
// Carpeta 11: SDF Solicitud de Factura (correo)
// Carpeta 12: Factura
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

// ── Helper Drive (igual que TabInformes) ─────────────────────────────────────
async function subirArchivoADrive(folderId, file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const res = await fetch('/api/drive/subir-archivo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId, file_name: file.name, file_content_base64: base64, mime_type: file.type }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Error al subir a Drive')
  return data
}

// ── Tipos de documentos de facturación ───────────────────────────────────────
const TIPOS_FACTURACION = [
  {
    key: 'sdf',
    carpetaNum: '11',
    titulo: 'SDF — Solicitud de Factura',
    subtitulo: 'Correo con solicitud de emisión de factura (PDF)',
    icon: '📧',
    color: '#7C3AED',
    bg: '#EDE9FE',
    accept: 'application/pdf,.pdf',
  },
  {
    key: 'factura',
    carpetaNum: '12',
    titulo: 'Factura',
    subtitulo: 'Documento de factura emitida (PDF)',
    icon: '🧾',
    color: '#0369A1',
    bg: '#E0F2FE',
    accept: 'application/pdf,.pdf',
  },
]

function SeccionUploadDoc({ tipo, ot, onSubido }) {
  const { usuario } = useAuth()
  const fileRef = useRef(null)
  const [archivos, setArchivos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [docs, setDocs] = useState([])
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const folderId  = ot.carpetas_drive?.[tipo.carpetaNum]?.id
  const folderUrl = ot.carpetas_drive?.[tipo.carpetaNum]?.url

  useEffect(() => { cargar() }, [ot.ot_numero, tipo.key])
  async function cargar() {
    const { data } = await supabase.from('documentos_ot').select('*').eq('ot_numero', ot.ot_numero).eq('tipo', tipo.key).order('created_at', { ascending: false })
    setDocs(data || [])
  }

  async function subir() {
    if (archivos.length === 0) { setError('Selecciona al menos un PDF'); return }
    const noValidos = archivos.filter(f => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'))
    if (noValidos.length > 0) { setError(`Solo se permiten PDFs: ${noValidos.map(f => f.name).join(', ')}`); return }
    if (!folderId) { setError(`Carpeta Drive "${tipo.carpetaNum}" no encontrada para esta OT. Verifica que la OT tenga carpetas creadas.`); return }
    setSubiendo(true); setError(''); setExito('')
    try {
      for (const file of archivos) {
        const driveData = await subirArchivoADrive(folderId, file)
        await supabase.from('documentos_ot').insert({
          ot_numero: ot.ot_numero, tipo: tipo.key,
          nombre_archivo: file.name, drive_file_id: driveData.file_id,
          drive_url: driveData.file_url, subido_por: usuario?.email || '',
        })
      }
      setExito(`✓ ${archivos.length} archivo${archivos.length > 1 ? 's subidos' : ' subido'}`)
      setArchivos([])
      if (fileRef.current) fileRef.current.value = ''
      cargar()
      onSubido && onSubido()
    } catch (e) { setError(e.message) } finally { setSubiendo(false) }
  }

  const yaSubido = docs.length > 0

  return (
    <div style={{ border: `2px solid ${yaSubido ? '#86EFAC' : '#E2E8F0'}`, borderRadius: 10, overflow: 'hidden', transition: 'border .2s' }}>
      {/* Header */}
      <div style={{ background: yaSubido ? '#F0FDF4' : '#F8FAFC', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: tipo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{tipo.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 14 }}>{tipo.titulo}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>{tipo.subtitulo}</div>
        </div>
        <div>
          {yaSubido
            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '3px 10px', borderRadius: 20 }}>✓ {docs.length} archivo{docs.length > 1 ? 's' : ''}</span>
            : <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', background: '#F1F5F9', padding: '3px 10px', borderRadius: 20 }}>Pendiente</span>}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: '#991B1B', marginBottom: 10 }}>⚠️ {error}</div>}
        {exito && <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: '#065F46', marginBottom: 10 }}>{exito}</div>}

        {/* Link carpeta Drive */}
        {folderUrl && <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>📁 <a href={folderUrl} target="_blank" rel="noreferrer" style={{ color: '#185FA5' }}>{tipo.carpetaNum} - {tipo.titulo}</a> en Drive</div>}

        {/* Upload */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept={tipo.accept} multiple onChange={e => { setArchivos(Array.from(e.target.files)); setError(''); setExito('') }}
            style={{ flex: 1, minWidth: 200, padding: '7px 10px', border: '1px dashed #CBD5E1', borderRadius: 6, fontSize: 12, background: '#F8FAFC', cursor: 'pointer' }} />
          <button className="btn btn-primary" onClick={subir} disabled={subiendo || archivos.length === 0}
            style={{ whiteSpace: 'nowrap', background: tipo.color, borderColor: tipo.color }}>
            {subiendo ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Subiendo...</> : `${tipo.icon} Subir`}
          </button>
        </div>

        {/* Lista archivos subidos */}
        {yaSubido && (
          <div style={{ marginTop: 12 }}>
            {docs.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                <span style={{ color: '#22C55E' }}>✓</span>
                <a href={d.drive_url} target="_blank" rel="noreferrer" style={{ color: '#185FA5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre_archivo}</a>
                <span style={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>{new Date(d.created_at).toLocaleDateString('es-CL')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TabFacturacion({ ot, onDocumentoSubido }) {
  const [docsCounts, setDocsCounts] = useState({ sdf: 0, factura: 0 })

  useEffect(() => { cargarResumen() }, [ot.ot_numero])
  async function cargarResumen() {
    const { data } = await supabase.from('documentos_ot').select('tipo').eq('ot_numero', ot.ot_numero).in('tipo', ['sdf', 'factura'])
    if (data) {
      setDocsCounts({
        sdf:     data.filter(d => d.tipo === 'sdf').length,
        factura: data.filter(d => d.tipo === 'factura').length,
      })
    }
  }

  const todoCompleto = docsCounts.sdf > 0 && docsCounts.factura > 0

  return (
    <div>
      {/* Estado general */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: todoCompleto ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${todoCompleto ? '#86EFAC' : '#FCD34D'}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 24 }}>{todoCompleto ? '✅' : '⏳'}</div>
        <div>
          <div style={{ fontWeight: 700, color: '#1E293B', fontSize: 14 }}>
            {todoCompleto ? 'Flujo de facturación completo' : 'Facturación pendiente'}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            SDF {docsCounts.sdf > 0 ? '✓' : '○'} · Factura {docsCounts.factura > 0 ? '✓' : '○'}
          </div>
        </div>
      </div>

      {/* Secciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {TIPOS_FACTURACION.map(tipo => (
          <SeccionUploadDoc
            key={tipo.key}
            tipo={tipo}
            ot={ot}
            onSubido={() => { cargarResumen(); onDocumentoSubido && onDocumentoSubido() }}
          />
        ))}
      </div>

      {/* Instrucciones */}
      <div style={{ marginTop: 20, background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#0369A1' }}>
        <b>Flujo comercial:</b> Subir primero el correo de SDF (solicitud de factura) enviado a contabilidad, y luego la factura emitida por el cliente. Ambos documentos se guardan en la carpeta Drive de la OT.
      </div>
    </div>
  )
}
