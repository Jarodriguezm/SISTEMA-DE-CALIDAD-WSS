import { useEffect, useState } from 'react'

// Carpeta raíz de procedimientos en Drive
const FOLDER_ID = '1D4khmD9N_LOqUxFnuWCeJh-QL0LcE5ys'

// Icono según mime type o nombre del archivo
function iconoArchivo(mimeType, nombre) {
  if (!mimeType) return '📄'
  if (mimeType.includes('pdf'))           return '📕'
  if (mimeType.includes('spreadsheet') || nombre?.match(/\.xlsx?$/i)) return '📗'
  if (mimeType.includes('presentation') || nombre?.match(/\.pptx?$/i)) return '📙'
  if (mimeType.includes('document') || nombre?.match(/\.docx?$/i))     return '📘'
  if (mimeType.includes('image'))         return '🖼️'
  return '📄'
}

// URL de preview embebida para cualquier archivo Drive
function previewUrl(file) {
  if (!file?.id) return null
  // Google Docs/Sheets/Slides tienen su propio viewer
  if (file.mimeType?.includes('google-apps')) {
    return (file.webViewLink || '').replace('/edit', '/preview').replace('/view', '/preview')
  }
  // PDF, Word, etc. → Google Drive file preview
  return `https://drive.google.com/file/d/${file.id}/preview`
}

export default function Procedimientos() {
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [raiz, setRaiz]           = useState([])
  const [categorias, setCategorias] = useState([])
  const [catActiva, setCatActiva] = useState('__raiz__')
  const [busqueda, setBusqueda]   = useState('')
  const [visor, setVisor]         = useState(null)  // archivo seleccionado

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true); setError('')
    try {
      const res = await fetch(`/api/drive/listar-carpeta?folderId=${FOLDER_ID}`)
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error || 'Error al listar Drive')
      setRaiz(d.raiz || [])
      setCategorias(d.categorias || [])
      // Si hay categorías, activar la primera
      if (d.categorias?.length > 0) setCatActiva(d.categorias[0].id)
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  // Archivos a mostrar según categoría activa y búsqueda
  const archivosActivos = (() => {
    let lista = catActiva === '__raiz__'
      ? raiz
      : (categorias.find(c => c.id === catActiva)?.archivos || [])
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(f => f.name.toLowerCase().includes(q))
    }
    return lista
  })()

  const totalArchivos = raiz.length + categorias.reduce((s, c) => s + c.archivos.length, 0)

  return (
    <div>
      {/* Visor embebido */}
      {visor && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setVisor(null)}>
          <div style={S.visorModal}>
            <div style={S.visorHeader}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {iconoArchivo(visor.mimeType, visor.name)} {visor.name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a href={visor.webViewLink} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#BAE6FD', padding: '5px 12px', border: '1px solid rgba(255,255,255,.3)', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  ↗ Abrir en Drive
                </a>
                <button onClick={() => setVisor(null)}
                  style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>
                  ✕
                </button>
              </div>
            </div>
            <div style={{ flex: 1, background: '#1E293B' }}>
              {previewUrl(visor) ? (
                <iframe
                  src={previewUrl(visor)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={visor.name}
                  allow="autoplay"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', gap: 16 }}>
                  <div style={{ fontSize: 48 }}>📄</div>
                  <a href={visor.webViewLink} target="_blank" rel="noreferrer" style={{ color: '#60A5FA', fontWeight: 600 }}>
                    Abrir en Google Drive →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h1>📐 Procedimientos Acreditados</h1>
          <p className="text-sm" style={{ marginTop: 4, color: 'var(--gris)' }}>
            {cargando ? 'Cargando desde Drive...' : `${totalArchivos} documentos · WSS División Inspección Industrial`}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar} disabled={cargando}>
          {cargando ? '...' : '↻ Actualizar'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          ⚠️ {error}
          <button className="btn btn-secondary btn-sm" onClick={cargar} style={{ marginLeft: 12 }}>Reintentar</button>
        </div>
      )}

      {/* Filtros */}
      {!cargando && !error && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" placeholder="Buscar procedimiento..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ maxWidth: 260 }} />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* Tab raíz solo si hay archivos sueltos */}
            {raiz.length > 0 && (
              <button
                onClick={() => setCatActiva('__raiz__')}
                style={catActiva === '__raiz__' ? S.tabActivo : S.tab}>
                📋 General ({raiz.length})
              </button>
            )}
            {categorias.map(c => (
              <button key={c.id}
                onClick={() => setCatActiva(c.id)}
                style={catActiva === c.id ? S.tabActivo : S.tab}>
                📁 {c.nombre} ({c.archivos.length})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {cargando && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--gris)' }}>
          <div className="loading-bar" style={{ marginBottom: 16 }} />
          <p>Cargando procedimientos desde Google Drive...</p>
        </div>
      )}

      {/* Sin resultados */}
      {!cargando && !error && archivosActivos.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--gris)' }}>
          {busqueda ? `Sin resultados para "${busqueda}"` : 'Esta carpeta está vacía en Drive.'}
        </div>
      )}

      {/* Grid de archivos */}
      {!cargando && !error && archivosActivos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {archivosActivos.map(f => (
            <div key={f.id} style={S.card} onClick={() => setVisor(f)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={S.cardIcon}>{iconoArchivo(f.mimeType, f.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A', lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {f.name}
                  </div>
                  {f.modifiedTime && (
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                      Actualizado: {new Date(f.modifiedTime).toLocaleDateString('es-CL')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>👁 Ver en la app</span>
                <a href={f.webViewLink} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 11, color: '#185FA5', padding: '3px 8px', border: '1px solid #BFDBFE', borderRadius: 5, textDecoration: 'none', fontWeight: 600 }}>
                  ↗ Drive
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,.75)',
    zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  visorModal: {
    width: '96vw', maxWidth: 1100, height: '92vh',
    background: '#0F172A', borderRadius: 16,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,.6)',
  },
  visorHeader: {
    background: '#1E3A5F', padding: '14px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    flexShrink: 0,
  },
  card: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #E2E8F0', padding: 16,
    cursor: 'pointer', transition: 'box-shadow .15s, transform .1s',
    boxShadow: '0 1px 3px rgba(0,0,0,.06)',
  },
  cardIcon: {
    fontSize: 30, width: 46, height: 46,
    background: '#F8FAFC', borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tab: {
    padding: '5px 12px', borderRadius: 20, border: '1px solid #CBD5E1',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: '#fff', color: '#475569',
  },
  tabActivo: {
    padding: '5px 12px', borderRadius: 20, border: '1px solid #1E3A5F',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: '#1E3A5F', color: '#fff',
  },
}
