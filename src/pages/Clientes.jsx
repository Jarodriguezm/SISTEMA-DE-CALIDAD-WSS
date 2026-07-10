// ============================================================
// Clientes.jsx — Módulo CRM
// Lista, detalle, seguimiento, WhatsApp, email masivo
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADOS = ['Activo', 'Inactivo', 'Prospecto', 'En Negociación']
const TIPOS_SEG = ['llamada', 'email', 'whatsapp', 'reunión', 'cotización', 'otro']

const COLOR_ESTADO = {
  'Activo':          { bg: '#D1FAE5', color: '#065F46' },
  'Inactivo':        { bg: '#F1F5F9', color: '#64748B' },
  'Prospecto':       { bg: '#DBEAFE', color: '#1E40AF' },
  'En Negociación':  { bg: '#FEF3C7', color: '#92400E' },
}

function diasDesde(fecha) {
  if (!fecha) return null
  const diff = Date.now() - new Date(fecha).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function badgeEstado(estado) {
  const s = COLOR_ESTADO[estado] || { bg: '#F1F5F9', color: '#64748B' }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
      {estado || '—'}
    </span>
  )
}

// ── Modal email masivo ────────────────────────────────────────────────────────
function ModalEmailMasivo({ clientes, onClose }) {
  const { usuario } = useAuth()
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const conEmail = clientes.filter(c => c.email)

  async function enviar() {
    if (!asunto.trim() || !mensaje.trim()) return
    setEnviando(true)
    setResultado(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notificar-supervisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          ot_numero: 'CAMPAÑA',
          inspector_nombre: `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim() || usuario?.email,
          informes_codigos: [],
          mensaje_adicional: mensaje,
          supervisor_email: conEmail[0]?.email || '',
          // Para email masivo usamos la Edge Function de forma individual por ahora
          _bulk: true,
          _emails: conEmail.map(c => c.email),
          _asunto: asunto,
          _cuerpo: mensaje,
        }),
      })
      // Como la Edge Function actual no soporta bulk, enviamos uno a uno
      let ok = 0, err = 0
      for (const c of conEmail) {
        try {
          const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notificar-supervisor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({
              ot_numero: asunto,
              inspector_nombre: `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim() || 'WSS Calidad',
              informes_codigos: [mensaje],
              mensaje_adicional: '',
              supervisor_email: c.email,
            }),
          })
          const d = await r.json()
          if (d.ok) ok++; else err++
        } catch { err++ }
      }
      setResultado({ ok, err, total: conEmail.length })
    } catch (e) {
      setResultado({ error: e.message })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 24px 80px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0E2A45,#17395C)', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>✉️ Email masivo</div>
            <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{conEmail.length} destinatario{conEmail.length !== 1 ? 's' : ''} con email registrado</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          {resultado ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {resultado.error
                ? <div style={{ color: '#DC2626', fontSize: 14 }}>❌ Error: {resultado.error}</div>
                : <div>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Campaña enviada</div>
                    <div style={{ color: '#065F46', fontSize: 14 }}>✓ {resultado.ok} enviados correctamente</div>
                    {resultado.err > 0 && <div style={{ color: '#DC2626', fontSize: 13, marginTop: 4 }}>⚠️ {resultado.err} fallidos</div>}
                    <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Cerrar</button>
                  </div>
              }
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, background: '#DBEAFE', color: '#1E40AF', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
                📋 Destinatarios: {conEmail.map(c => c.email).join(', ')}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Asunto *</label>
                <input className="input" value={asunto} onChange={e => setAsunto(e.target.value)}
                  placeholder="Ej: Cotización servicios de inspección WSS" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Mensaje *</label>
                <textarea className="input" rows={6} style={{ resize: 'vertical' }}
                  value={mensaje} onChange={e => setMensaje(e.target.value)}
                  placeholder="Estimado cliente,&#10;&#10;Nos ponemos en contacto para...&#10;&#10;Saludos,&#10;WSS División Inspección Industrial" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
                <button className="btn btn-primary" onClick={enviar} disabled={enviando || !asunto.trim() || !mensaje.trim() || conEmail.length === 0}>
                  {enviando ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Enviando...</> : `✉️ Enviar a ${conEmail.length} clientes`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel detalle cliente ─────────────────────────────────────────────────────
function PanelDetalle({ cliente, onClose, onActualizado }) {
  const { usuario } = useAuth()
  const [tab, setTab] = useState('info')
  const [ots, setOts] = useState([])
  const [seguimientos, setSeguimientos] = useState([])
  const [cargandoOts, setCargandoOts] = useState(false)
  const [cargandoSeg, setCargandoSeg] = useState(false)
  const [mostrarFormSeg, setMostrarFormSeg] = useState(false)
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState({ ...cliente })
  const [guardando, setGuardando] = useState(false)
  const [formSeg, setFormSeg] = useState({ tipo: 'llamada', descripcion: '', proxima_accion: '', fecha_proxima_accion: '' })
  const [guardandoSeg, setGuardandoSeg] = useState(false)

  useEffect(() => {
    if (tab === 'ots') cargarOts()
    if (tab === 'seguimiento') cargarSeguimientos()
  }, [tab, cliente.id])

  async function cargarOts() {
    setCargandoOts(true)
    const { data } = await supabase.from('ots').select('ot_numero,cliente,estado,sede,created_at,descripcion')
      .ilike('cliente', `%${cliente.razon_social.trim()}%`)
      .order('created_at', { ascending: false }).limit(50)
    setOts(data || [])
    setCargandoOts(false)
  }

  async function cargarSeguimientos() {
    setCargandoSeg(true)
    const { data } = await supabase.from('seguimiento_clientes').select('*')
      .eq('cliente_id', cliente.id).order('created_at', { ascending: false })
    setSeguimientos(data || [])
    setCargandoSeg(false)
  }

  async function guardarEdicion() {
    setGuardando(true)
    await supabase.from('clientes').update({
      razon_social: formEdit.razon_social,
      contacto: formEdit.contacto,
      email: formEdit.email,
      telefono: formEdit.telefono,
      comercial: formEdit.comercial,
      estado: formEdit.estado,
      notas: formEdit.notas,
      rut_empresa: formEdit.rut_empresa,
      updated_at: new Date().toISOString(),
    }).eq('id', cliente.id)
    setGuardando(false)
    setEditando(false)
    onActualizado()
  }

  async function guardarSeguimiento() {
    if (!formSeg.descripcion.trim()) return
    setGuardandoSeg(true)
    const createdBy = `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim() || usuario?.email
    await supabase.from('seguimiento_clientes').insert({
      cliente_id: cliente.id,
      tipo: formSeg.tipo,
      descripcion: formSeg.descripcion,
      proxima_accion: formSeg.proxima_accion || null,
      fecha_proxima_accion: formSeg.fecha_proxima_accion || null,
      created_by: createdBy,
    })
    setFormSeg({ tipo: 'llamada', descripcion: '', proxima_accion: '', fecha_proxima_accion: '' })
    setMostrarFormSeg(false)
    setGuardandoSeg(false)
    cargarSeguimientos()
  }

  const waUrl = cliente.telefono
    ? `https://wa.me/${cliente.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${cliente.contacto || cliente.razon_social}, le contactamos desde WSS División Inspección Industrial.`)}`
    : null

  const emailUrl = cliente.email
    ? `mailto:${cliente.email}?subject=${encodeURIComponent(`Contacto WSS — ${cliente.razon_social}`)}`
    : null

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,.15)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0E2A45,#17395C)', color: '#fff', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{cliente.razon_social}</div>
            <div style={{ fontSize: 12, opacity: .75, marginTop: 3 }}>{cliente.contacto || 'Sin contacto registrado'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
        </div>
        {/* Botones acción rápida */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {waUrl
            ? <a href={waUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#25D366', color: '#fff', borderRadius: 7, padding: '6px 12px', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>Sin teléfono</span>
          }
          {emailUrl
            ? <a href={emailUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', color: '#fff', borderRadius: 7, padding: '6px 12px', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                ✉️ Email
              </a>
            : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>Sin email</span>
          }
          <div style={{ marginLeft: 'auto' }}>{badgeEstado(cliente.estado)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
        {[['info', 'Información'], ['ots', 'OTs'], ['seguimiento', 'Seguimiento']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === k ? 700 : 400,
            color: tab === k ? '#17395C' : '#64748B',
            borderBottom: tab === k ? '2px solid #17395C' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* Tab: Información */}
        {tab === 'info' && (
          editando ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  ['razon_social', 'Razón Social *'],
                  ['rut_empresa', 'RUT'],
                  ['contacto', 'Contacto'],
                  ['email', 'Email'],
                  ['telefono', 'Teléfono'],
                  ['comercial', 'Comercial'],
                ].map(([campo, label]) => (
                  <div key={campo} className="field">
                    <label>{label}</label>
                    <input className="input" value={formEdit[campo] || ''} onChange={e => setFormEdit(f => ({ ...f, [campo]: e.target.value }))} />
                  </div>
                ))}
                <div className="field">
                  <label>Estado</label>
                  <select className="select" value={formEdit.estado || 'Activo'} onChange={e => setFormEdit(f => ({ ...f, estado: e.target.value }))}>
                    {ESTADOS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Notas internas</label>
                <textarea className="input" rows={3} value={formEdit.notas || ''} onChange={e => setFormEdit(f => ({ ...f, notas: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={guardarEdicion} disabled={guardando}>
                  {guardando ? 'Guardando...' : '✓ Guardar'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditando(false); setFormEdit({ ...cliente }) }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {[
                  ['Razón Social', cliente.razon_social],
                  ['RUT', cliente.rut_empresa],
                  ['Contacto', cliente.contacto],
                  ['Email', cliente.email],
                  ['Teléfono', cliente.telefono],
                  ['Comercial', cliente.comercial],
                  ['Estado', cliente.estado],
                  ['Última actividad', cliente.ultima_ot ? `hace ${diasDesde(cliente.ultima_ot)} días` : '—'],
                  ['Total OTs', cliente.total_ots || 0],
                ].map(([label, val]) => (
                  <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 500 }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
              {cliente.notas && (
                <div style={{ marginTop: 16, padding: 12, background: '#FEF9EC', borderRadius: 8, fontSize: 13, color: '#78350F' }}>
                  📝 {cliente.notas}
                </div>
              )}
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => { setEditando(true); setFormEdit({ ...cliente }) }}>
                ✏️ Editar datos
              </button>
            </div>
          )
        )}

        {/* Tab: OTs */}
        {tab === 'ots' && (
          cargandoOts
            ? <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>Cargando OTs...</div>
            : ots.length === 0
              ? <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>Sin OTs registradas</div>
              : <div>
                  <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{ots.length} orden{ots.length !== 1 ? 'es' : ''} de trabajo</div>
                  {ots.map(ot => (
                    <div key={ot.ot_numero} style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: '#17395C', fontSize: 13 }}>{ot.ot_numero}</span>
                        <span style={{ fontSize: 11, padding: '2px 7px', background: '#F1F5F9', borderRadius: 5, color: '#475569' }}>{ot.estado}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{ot.sede} · {new Date(ot.created_at).toLocaleDateString('es-CL')}</div>
                      {ot.descripcion && <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>{ot.descripcion.substring(0, 120)}{ot.descripcion.length > 120 ? '...' : ''}</div>}
                    </div>
                  ))}
                </div>
        )}

        {/* Tab: Seguimiento */}
        {tab === 'seguimiento' && (
          <div>
            <button className="btn btn-primary btn-sm" style={{ marginBottom: 16 }} onClick={() => setMostrarFormSeg(true)}>
              + Registrar contacto
            </button>

            {mostrarFormSeg && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="field">
                    <label>Tipo</label>
                    <select className="select" value={formSeg.tipo} onChange={e => setFormSeg(f => ({ ...f, tipo: e.target.value }))}>
                      {TIPOS_SEG.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Próxima fecha</label>
                    <input className="input" type="date" value={formSeg.fecha_proxima_accion} onChange={e => setFormSeg(f => ({ ...f, fecha_proxima_accion: e.target.value }))} />
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>¿Qué se habló / hizo? *</label>
                  <textarea className="input" rows={3} value={formSeg.descripcion} onChange={e => setFormSeg(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Ej: Se llamó al contacto, mostró interés en inspección de tanques..." />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Próxima acción</label>
                  <input className="input" value={formSeg.proxima_accion} onChange={e => setFormSeg(f => ({ ...f, proxima_accion: e.target.value }))}
                    placeholder="Ej: Enviar cotización, llamar en 2 semanas..." />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={guardarSeguimiento} disabled={guardandoSeg || !formSeg.descripcion.trim()}>
                    {guardandoSeg ? 'Guardando...' : '✓ Guardar'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMostrarFormSeg(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {cargandoSeg
              ? <div style={{ color: '#94A3B8', fontSize: 13 }}>Cargando...</div>
              : seguimientos.length === 0
                ? <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 20 }}>Sin registros de seguimiento aún</div>
                : seguimientos.map(s => (
                    <div key={s.id} style={{ padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#7C3AED', background: '#EDE9FE', padding: '2px 7px', borderRadius: 5 }}>{s.tipo}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(s.created_at).toLocaleDateString('es-CL')}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#1E293B', marginBottom: s.proxima_accion ? 6 : 0 }}>{s.descripcion}</div>
                      {s.proxima_accion && (
                        <div style={{ fontSize: 12, color: '#065F46', background: '#D1FAE5', borderRadius: 5, padding: '4px 8px', marginTop: 6 }}>
                          ⚡ {s.proxima_accion}{s.fecha_proxima_accion ? ` · ${new Date(s.fecha_proxima_accion).toLocaleDateString('es-CL')}` : ''}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Por {s.created_by}</div>
                    </div>
                  ))
            }
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Clientes() {
  const [clientes, setClientes]             = useState([])
  const [cargando, setCargando]             = useState(true)
  const [busqueda, setBusqueda]             = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('')
  const [filtroComercial, setFiltroComercial] = useState('')
  const [seleccionados, setSeleccionados]   = useState([])
  const [clienteDetalle, setClienteDetalle] = useState(null)
  const [mostrarEmailMasivo, setMostrarEmailMasivo] = useState(false)
  const [importando, setImportando]         = useState(false)
  const [mensajeExito, setMensajeExito]     = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data: clis } = await supabase.from('clientes').select('*').order('razon_social')
      const { data: otsData } = await supabase.from('ots').select('cliente, created_at').order('created_at', { ascending: false })

      const statsMap = {}
      ;(otsData || []).forEach(ot => {
        const k = (ot.cliente || '').trim().toLowerCase()
        if (!statsMap[k]) statsMap[k] = { total_ots: 0, ultima_ot: null }
        statsMap[k].total_ots++
        if (!statsMap[k].ultima_ot) statsMap[k].ultima_ot = ot.created_at
      })

      setClientes((clis || []).map(c => ({
        ...c,
        ...(statsMap[(c.razon_social || '').trim().toLowerCase()] || { total_ots: 0, ultima_ot: null }),
      })))
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function importarDesdeOTs() {
    setImportando(true)
    try {
      const { data: ots } = await supabase.from('ots').select('cliente,contacto,email_cliente,telefono_cliente,rut_empresa,comercial').order('created_at', { ascending: false })
      const vistos = new Set()
      const nuevos = []
      for (const ot of (ots || [])) {
        const key = (ot.cliente || '').trim().toLowerCase()
        if (!key || vistos.has(key)) continue
        vistos.add(key)
        nuevos.push({
          razon_social: ot.cliente.trim(),
          contacto:     ot.contacto     || null,
          email:        ot.email_cliente || null,
          telefono:     ot.telefono_cliente || null,
          rut_empresa:  ot.rut_empresa   || null,
          comercial:    ot.comercial     || null,
          estado:       'Activo',
        })
      }
      if (nuevos.length > 0) {
        await supabase.from('clientes').upsert(nuevos, { onConflict: 'razon_social', ignoreDuplicates: true })
      }
      setMensajeExito(`✅ Sincronización completada — ${nuevos.length} clientes procesados`)
      setTimeout(() => setMensajeExito(''), 5000)
      cargar()
    } finally { setImportando(false) }
  }

  const comerciales = [...new Set(clientes.map(c => c.comercial).filter(Boolean))]

  const filtrados = clientes.filter(c => {
    const q = busqueda.toLowerCase()
    if (busqueda && !['razon_social','contacto','email','telefono','rut_empresa']
      .some(k => (c[k] || '').toLowerCase().includes(q))) return false
    if (filtroEstado && c.estado !== filtroEstado) return false
    if (filtroComercial && c.comercial !== filtroComercial) return false
    return true
  })

  const stats = {
    total:        clientes.length,
    activos:      clientes.filter(c => c.estado === 'Activo').length,
    prospectos:   clientes.filter(c => c.estado === 'Prospecto').length,
    sinActividad: clientes.filter(c => !c.ultima_ot || diasDesde(c.ultima_ot) > 90).length,
  }

  function toggleSeleccion(id) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleTodos() {
    if (seleccionados.length === filtrados.length) setSeleccionados([])
    else setSeleccionados(filtrados.map(c => c.id))
  }

  const clientesSeleccionados = clientes.filter(c => seleccionados.includes(c.id))

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#0E2A45' }}>Clientes</h1>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>{clientes.length} clientes registrados</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={importarDesdeOTs} disabled={importando}>
            {importando ? '⏳ Sincronizando...' : '🔄 Sincronizar desde OTs'}
          </button>
          {seleccionados.length > 0 && (
            <button className="btn btn-primary btn-sm" style={{ background: '#7C3AED', borderColor: '#7C3AED' }}
              onClick={() => setMostrarEmailMasivo(true)}>
              ✉️ Email masivo ({seleccionados.length})
            </button>
          )}
        </div>
      </div>

      {mensajeExito && (
        <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#065F46', marginBottom: 16 }}>
          {mensajeExito}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total clientes', valor: stats.total, color: '#17395C', bg: '#EFF6FF' },
          { label: 'Activos', valor: stats.activos, color: '#065F46', bg: '#D1FAE5' },
          { label: 'Prospectos', valor: stats.prospectos, color: '#1E40AF', bg: '#DBEAFE' },
          { label: 'Sin actividad +90 días', valor: stats.sinActividad, color: '#92400E', bg: '#FEF3C7' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.valor}</div>
            <div style={{ fontSize: 12, color: s.color, opacity: .8, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="input" placeholder="Buscar por nombre, email, contacto..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
        <select className="select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: 160 }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e}>{e}</option>)}
        </select>
        <select className="select" value={filtroComercial} onChange={e => setFiltroComercial(e.target.value)} style={{ width: 180 }}>
          <option value="">Todos los comerciales</option>
          {comerciales.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Cargando clientes...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: 36 }}>
                  <input type="checkbox" checked={seleccionados.length === filtrados.length && filtrados.length > 0}
                    onChange={toggleTodos} />
                </th>
                {['Cliente', 'Contacto', 'Email', 'Teléfono', 'Comercial', 'Última OT', 'OTs', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>Sin clientes que coincidan</td></tr>
              ) : filtrados.map(c => {
                const dias = diasDesde(c.ultima_ot)
                const alertaInactividad = dias !== null && dias > 90
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9', background: seleccionados.includes(c.id) ? '#EFF6FF' : 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = seleccionados.includes(c.id) ? '#EFF6FF' : '#FAFAFA'}
                    onMouseLeave={e => e.currentTarget.style.background = seleccionados.includes(c.id) ? '#EFF6FF' : 'transparent'}>
                    <td style={{ padding: '10px 14px' }}>
                      <input type="checkbox" checked={seleccionados.includes(c.id)} onChange={() => toggleSeleccion(c.id)} />
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#17395C', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.razon_social}</div>
                      {c.rut_empresa && <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.rut_empresa}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{c.contacto || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {c.email ? <a href={`mailto:${c.email}`} style={{ color: '#185FA5' }}>{c.email}</a> : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {c.telefono
                        ? <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ color: '#25D366', fontWeight: 600 }}>{c.telefono}</a>
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{c.comercial || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {c.ultima_ot
                        ? <span style={{ color: alertaInactividad ? '#DC2626' : '#475569', fontWeight: alertaInactividad ? 600 : 400 }}>
                            {alertaInactividad ? '⚠️ ' : ''}{dias}d atrás
                          </span>
                        : <span style={{ color: '#94A3B8' }}>Sin OTs</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>{c.total_ots || 0}</td>
                    <td style={{ padding: '10px 12px' }}>{badgeEstado(c.estado)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setClienteDetalle(c)} style={{ fontSize: 12 }}>Ver →</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel detalle */}
      {clienteDetalle && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', zIndex: 199 }} onClick={() => setClienteDetalle(null)} />
          <PanelDetalle
            cliente={clienteDetalle}
            onClose={() => setClienteDetalle(null)}
            onActualizado={() => { cargar(); setClienteDetalle(null) }}
          />
        </>
      )}

      {/* Modal email masivo */}
      {mostrarEmailMasivo && (
        <ModalEmailMasivo
          clientes={clientesSeleccionados}
          onClose={() => { setMostrarEmailMasivo(false); setSeleccionados([]) }}
        />
      )}
    </div>
  )
}
