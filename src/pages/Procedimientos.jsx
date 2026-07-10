import { useEffect, useState } from 'react'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const CATEGORIAS = [
  { key: 'TODOS',       label: 'Todos',          icono: '📋' },
  { key: 'END',         label: 'END',             icono: '🔬' },
  { key: 'TANQUES',     label: 'Tanques',         icono: '🛢️' },
  { key: 'TUBERIAS',    label: 'Tuberías',        icono: '🔧' },
  { key: 'ESTRUCTURAS', label: 'Estructuras',     icono: '🏗️' },
  { key: 'EQUIPOS',     label: 'Equipos / Izaje', icono: '🏗' },
  { key: 'CALIDAD',     label: 'Calidad',         icono: '✅' },
  { key: 'SEGURIDAD',   label: 'Seguridad',       icono: '🦺' },
]

const NORMAS_SUGERIDAS = ['API 650', 'API 653', 'API 570', 'AWS D1.1', 'ASNT', 'ASME B30', 'ISO 9001:2015', 'OSHAS 18001']

function extraerFileId(url) {
  if (!url) return null
  // Formatos: /file/d/ID/view o /file/d/ID/preview o id=ID
  const m1 = url.match(/\/file\/d\/([^/]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/id=([^&]+)/)
  if (m2) return m2[1]
  return null
}

export default function Procedimientos() {
  const { usuario, esAdmin } = useAuth()
  const [procedimientos, setProcedimientos] = useState([])
  const [cargando, setCargando]             = useState(true)
  const [error, setError]                   = useState('')
  const [catActiva, setCatActiva]           = useState('TODOS')
  const [busqueda, setBusqueda]             = useState('')
  const [visorDoc, setVisorDoc]             = useState(null)   // { nombre, fileId, drive_url }
  const [modalEditar, setModalEditar]       = useState(null)   // null | {} | { id, ... }
  const [guardando, setGuardando]           = useState(false)
  const [exito, setExito]                   = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setCargando(true)
      const { data, error: e } = await supabase
        .from('procedimientos')
        .select('*')
        .eq('activo', true)
        .order('categoria')
        .order('orden')
      if (e) throw e
      setProcedimientos(data || [])
    } catch (e) { setError(mensajeError(e)) }
    finally { setCargando(false) }
  }

  async function guardar() {
    if (!modalEditar?.nombre?.trim()) return
    setGuardando(true)
    try {
      const payload = {
        nombre:        modalEditar.nombre.trim(),
        descripcion:   modalEditar.descripcion?.trim() || null,
        categoria:     modalEditar.categoria || 'CALIDAD',
        norma:         modalEditar.norma?.trim() || null,
        version:       modalEditar.version?.trim() || null,
        drive_url:     modalEditar.drive_url?.trim() || null,
        drive_file_id: extraerFileId(modalEditar.drive_url) || modalEditar.drive_file_id?.trim() || null,
        orden:         Number(modalEditar.orden) || 0,
      }
      if (modalEditar.id) {
        const { error: e } = await supabase.from('procedimientos').update(payload).eq('id', modalEditar.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('procedimientos').insert(payload)
        if (e) throw e
      }
      setExito('✅ Guardado correctamente')
      setTimeout(() => setExito(''), 3000)
      setModalEditar(null)
      cargar()
    } catch (e) { setError(mensajeError(e)) }
    finally { setGuardando(false) }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Desactivar este procedimiento?')) return
    await supabase.from('procedimientos').update({ activo: false }).eq('id', id)
    cargar()
  }

  const filtrados = procedimientos.filter(p => {
    const catOk = catActiva === 'TODOS' || p.categoria === catActiva
    const q     = busqueda.toLowerCase()
    const txtOk = !q || [p.nombre, p.descripcion, p.norma, p.categoria]
      .some(v => (v || '').toLowerCase().includes(q))
    return catOk && txtOk
  })

  const porCategoria = CATEGORIAS.filter(c => c.key !== 'TODOS').map(c => ({
    ...c,
    count: procedimientos.filter(p => p.categoria === c.key).length,
  })).filter(c => c.count > 0)

  return (
    <div>
      {/* Visor de documento */}
      {visorDoc && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setVisorDoc(null)}>
          <div style={S.visorModal}>
            <div style={S.visorHeader}>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>{visorDoc.nombre}</div>
                {visorDoc.norma && <div style={{ fontSize: 12, color: '#93C5FD', marginTop: 2 }}>{visorDoc.norma}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {visorDoc.drive_url && (
                  <a href={visorDoc.drive_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#BAE6FD', padding: '5px 12px', border: '1px solid rgba(255,255,255,.3)', borderRadius: 6, textDecoration: 'none' }}>
                    ↗ Abrir en Drive
                  </a>
                )}
                <button onClick={() => setVisorDoc(null)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, background: '#1E293B' }}>
              {visorDoc.fileId ? (
                <iframe
                  src={`https://drive.google.com/file/d/${visorDoc.fileId}/preview`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={visorDoc.nombre}
                  allow="autoplay"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', gap: 16 }}>
                  <div style={{ fontSize: 48 }}>📄</div>
                  <div style={{ fontSize: 14 }}>Este procedimiento no tiene archivo vinculado.</div>
                  {visorDoc.drive_url && (
                    <a href={visorDoc.drive_url} target="_blank" rel="noreferrer"
                      style={{ color: '#60A5FA', fontWeight: 600 }}>
                      Abrir en Google Drive →
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal editar / agregar */}
      {modalEditar !== null && (
        <div style={S.overlay}>
          <div style={S.editModal}>
            <div style={S.editHeader}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>
                {modalEditar.id ? 'Editar Procedimiento' : 'Nuevo Procedimiento'}
              </h3>
              <button onClick={() => setModalEditar(null)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

              <div className="field">
                <label>Nombre del procedimiento *</label>
                <input className="input" value={modalEditar.nombre || ''}
                  onChange={e => setModalEditar(m => ({ ...m, nombre: e.target.value }))}
                  placeholder="Ej: Inspección Visual de Tanques de Almacenamiento" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Categoría *</label>
                  <select className="select" value={modalEditar.categoria || 'CALIDAD'}
                    onChange={e => setModalEditar(m => ({ ...m, categoria: e.target.value }))}>
                    {CATEGORIAS.filter(c => c.key !== 'TODOS').map(c =>
                      <option key={c.key} value={c.key}>{c.icono} {c.label}</option>
                    )}
                  </select>
                </div>
                <div className="field">
                  <label>Norma aplicable</label>
                  <input className="input" value={modalEditar.norma || ''}
                    list="normas-list"
                    onChange={e => setModalEditar(m => ({ ...m, norma: e.target.value }))}
                    placeholder="Ej: API 653, AWS D1.1" />
                  <datalist id="normas-list">
                    {NORMAS_SUGERIDAS.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Versión / Revisión</label>
                  <input className="input" value={modalEditar.version || ''}
                    onChange={e => setModalEditar(m => ({ ...m, version: e.target.value }))}
                    placeholder="Ej: Rev. 02" />
                </div>
                <div className="field">
                  <label>Orden de visualización</label>
                  <input className="input" type="number" value={modalEditar.orden || 0}
                    onChange={e => setModalEditar(m => ({ ...m, orden: e.target.value }))} />
                </div>
              </div>

              <div className="field">
                <label>Descripción</label>
                <textarea className="input" rows={3} value={modalEditar.descripcion || ''}
                  onChange={e => setModalEditar(m => ({ ...m, descripcion: e.target.value }))}
                  placeholder="Breve descripción del alcance del procedimiento..." />
              </div>

              <div className="field">
                <label>URL del archivo en Google Drive</label>
                <input className="input" value={modalEditar.drive_url || ''}
                  onChange={e => setModalEditar(m => ({ ...m, drive_url: e.target.value }))}
                  placeholder="https://drive.google.com/file/d/..." />
                <span className="text-sm" style={{ color: 'var(--gris)', marginTop: 4, display: 'block' }}>
                  Pega el link de "Compartir" del archivo en Drive. El ID se extrae automáticamente para el visor.
                </span>
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--borde)', paddingTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => setModalEditar(null)} disabled={guardando}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardar} disabled={guardando || !modalEditar.nombre?.trim()}>
                  {guardando ? 'Guardando...' : '✓ Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h1>Procedimientos Acreditados</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            {procedimientos.length} procedimiento{procedimientos.length !== 1 ? 's' : ''} disponibles · WSS División Inspección Industrial
          </p>
        </div>
        {esAdmin() && (
          <button className="btn btn-primary btn-sm"
            onClick={() => setModalEditar({ nombre: '', categoria: 'END', norma: '', version: '', descripcion: '', drive_url: '', orden: 0 })}>
            + Nuevo procedimiento
          </button>
        )}
      </div>

      {exito && <div className="alert alert-ok" style={{ marginBottom: 16 }}>{exito}</div>}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Buscar procedimiento, norma..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ maxWidth: 280 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ key: 'TODOS', label: 'Todos', icono: '📋' }, ...CATEGORIAS.filter(c => c.key !== 'TODOS')].map(c => (
            <button key={c.key}
              onClick={() => setCatActiva(c.key)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: '1px solid',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background:   catActiva === c.key ? '#1E3A5F' : '#fff',
                color:        catActiva === c.key ? '#fff'    : '#475569',
                borderColor:  catActiva === c.key ? '#1E3A5F' : '#CBD5E1',
              }}>
              {c.icono} {c.label}
              {c.key !== 'TODOS' && procedimientos.filter(p => p.categoria === c.key).length > 0 &&
                <span style={{ marginLeft: 5, opacity: .7 }}>
                  ({procedimientos.filter(p => p.categoria === c.key).length})
                </span>
              }
            </button>
          ))}
        </div>
      </div>

      {cargando && <div className="loading-bar" />}

      {!cargando && filtrados.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--gris)' }}>
          {busqueda || catActiva !== 'TODOS'
            ? 'No hay procedimientos que coincidan con el filtro.'
            : 'No hay procedimientos cargados aún. Usa "+ Nuevo procedimiento" para agregar.'}
        </div>
      )}

      {/* Grid de procedimientos */}
      {!cargando && filtrados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtrados.map(p => {
            const cat = CATEGORIAS.find(c => c.key === p.categoria) || { icono: '📄', label: p.categoria }
            const tieneVisor = !!(p.drive_file_id || extraerFileId(p.drive_url))
            return (
              <div key={p.id} style={S.card}
                onClick={() => setVisorDoc({ nombre: p.nombre, fileId: p.drive_file_id || extraerFileId(p.drive_url), drive_url: p.drive_url, norma: p.norma })}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={S.cardIcon}>{cat.icono}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.3, marginBottom: 4 }}>
                      {p.nombre}
                    </div>
                    {p.descripcion && (
                      <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.4, marginBottom: 6,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.descripcion}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={S.badge}>{cat.label}</span>
                      {p.norma && <span style={{ ...S.badge, background: '#EFF6FF', color: '#1D4ED8' }}>{p.norma}</span>}
                      {p.version && <span style={{ ...S.badge, background: '#F0FDF4', color: '#166534' }}>{p.version}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: tieneVisor ? '#059669' : '#94A3B8', fontWeight: 600 }}>
                    {tieneVisor ? '👁 Ver en la app' : '🔗 Solo link externo'}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                    {p.drive_url && (
                      <a href={p.drive_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: '#185FA5', padding: '3px 8px', border: '1px solid #BFDBFE', borderRadius: 5, textDecoration: 'none', fontWeight: 600 }}>
                        ↗ Drive
                      </a>
                    )}
                    {esAdmin() && (
                      <>
                        <button onClick={() => setModalEditar({ ...p })}
                          style={S.btnSm}>✏</button>
                        <button onClick={() => eliminar(p.id)}
                          style={{ ...S.btnSm, color: '#DC2626' }}>✕</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,.7)',
    zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  visorModal: {
    width: '95vw', maxWidth: 1100, height: '90vh',
    background: '#0F172A', borderRadius: 16,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,.5)',
  },
  visorHeader: {
    background: '#1E3A5F', padding: '14px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    flexShrink: 0,
  },
  editModal: {
    width: '100%', maxWidth: 600,
    background: '#fff', borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,.3)',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  editHeader: {
    background: 'linear-gradient(135deg,#0E2A45,#17395C)',
    padding: '16px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  card: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #E2E8F0',
    padding: '16px',
    cursor: 'pointer',
    transition: 'box-shadow .15s, border-color .15s',
    boxShadow: '0 1px 3px rgba(0,0,0,.06)',
  },
  cardIcon: {
    fontSize: 28, width: 44, height: 44,
    background: '#F8FAFC', borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  badge: {
    fontSize: 10, fontWeight: 700, padding: '2px 8px',
    borderRadius: 12, background: '#F1F5F9', color: '#475569',
  },
  btnSm: {
    background: 'none', border: '1px solid #E2E8F0',
    borderRadius: 5, padding: '2px 8px', cursor: 'pointer',
    fontSize: 12, color: '#64748B',
  },
}
