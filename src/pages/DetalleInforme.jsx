// ============================================================
// DetalleInforme.jsx — Vista completa con tabs, IA, Word, email
// WSS · Sistema de Calidad  v2
// ============================================================
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ── Constantes ────────────────────────────────────────────────────────────
const ESTADO_BADGE = {
  BORRADOR:    { label: 'Borrador',    bg: '#F1F5F9', color: '#475569' },
  EN_REVISION: { label: 'En revisión', bg: '#FEF3C7', color: '#92400E' },
  APROBADO:    { label: 'Aprobado',    bg: '#D1FAE5', color: '#065F46' },
  RECHAZADO:   { label: 'Rechazado',   bg: '#FEE2E2', color: '#991B1B' },
  ENVIADO:     { label: 'Enviado',     bg: '#EDE9FE', color: '#5B21B6' },
}

const RESULTADO_BADGE = {
  CONFORME:    { label: '✅ Conforme',    bg: '#D1FAE5', color: '#065F46' },
  NO_CONFORME: { label: '❌ No conforme', bg: '#FEE2E2', color: '#991B1B' },
  CONDICIONADO:{ label: '⚠️ Condicionado',bg: '#FEF3C7', color: '#92400E' },
  CUMPLE:      { label: '✅ Cumple',      bg: '#D1FAE5', color: '#065F46' },
  NO_CUMPLE:   { label: '❌ No cumple',   bg: '#FEE2E2', color: '#991B1B' },
}

const SECCIONES_IA = [
  { key: 'introduccion',       label: 'Introducción' },
  { key: 'descripcion_equipo', label: 'Descripción del equipo' },
  { key: 'end_realizados',     label: 'Ensayos realizados' },
  { key: 'hallazgos',          label: 'Hallazgos' },
  { key: 'evaluacion',         label: 'Evaluación' },
  { key: 'conclusion',         label: 'Conclusión' },
  { key: 'recomendaciones',    label: 'Recomendaciones' },
]

const FAM_IZAJE = {
  grilletes: 'Accesorios', grillete: 'Accesorios',
  cancamos: 'Accesorios',  cancamo: 'Accesorios',
  ganchos: 'Accesorios',   gancho: 'Accesorios',
  eslingas: 'Eslingas',    eslinga: 'Eslingas',
  grua: 'Grúas',           gruas: 'Grúas',
  tecle: 'Grúas',          tecles: 'Grúas',
}
const getFamIzaje = t => FAM_IZAJE[(t || '').toLowerCase()] || 'Otros'

const TABS = [
  { id: 'resumen',  label: '📋 Resumen' },
  { id: 'tecnico',  label: '🔧 Datos técnicos' },
  { id: 'ia',       label: '🤖 Revisión IA' },
  { id: 'enviar',   label: '📤 Enviar' },
]

const TIMELINE = [
  { id: 'BORRADOR',    icon: '📝', label: 'Borrador' },
  { id: 'EN_REVISION', icon: '🔍', label: 'En revisión' },
  { id: 'APROBADO',    icon: '✅', label: 'Aprobado' },
  { id: 'ENVIADO',     icon: '📨', label: 'Enviado' },
]
const TIMELINE_ORDER = TIMELINE.map(t => t.id)

// ═══════════════════════════════════════════════════════════════════════════
export default function DetalleInforme() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { usuario } = useAuth()

  const [informe,      setInforme]      = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [error,        setError]        = useState('')
  const [tabActiva,    setTabActiva]    = useState('resumen')

  // IA
  const [analizando,   setAnalizando]   = useState(false)
  const [analisisIA,   setAnalisisIA]   = useState(null)
  const [textoEdit,    setTextoEdit]    = useState({})
  const [guardandoIA,  setGuardandoIA]  = useState(false)
  const [msgIA,        setMsgIA]        = useState('')

  // Enviar
  const [emailDest,    setEmailDest]    = useState('')
  const [enviandoMail, setEnviandoMail] = useState(false)
  const [msgMail,      setMsgMail]      = useState('')
  const [generandoW,   setGenerandoW]   = useState(false)

  // Aprobación supervisor
  const [comentRech,   setComentRech]   = useState('')
  const [aprobando,    setAprobando]    = useState(false)
  const [msgApro,      setMsgApro]      = useState('')

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setCargando(true); setError('')
    const { data, error: e } = await supabase
      .from('informes').select('*').eq('id', id).single()
    if (e) { setError(e.message) }
    else   { setInforme(data); setTextoEdit(data.texto_ia || {}) }
    setCargando(false)
  }

  // ── Análisis IA ───────────────────────────────────────────────────────────
  async function analizarConIA() {
    setAnalizando(true); setMsgIA('')
    const { data, error: e } = await supabase.functions.invoke('revisar-informe', {
      body: { informe_id: id, informe }
    })
    setAnalizando(false)
    if (e || data?.error) { setMsgIA('❌ ' + (e?.message || data?.error)); return }
    setAnalisisIA(data)
    if (data.texto_mejorado) setTextoEdit(prev => ({ ...prev, ...data.texto_mejorado }))
    setMsgIA('✅ Análisis completado — revisa las sugerencias y el texto mejorado abajo')
  }

  async function guardarMejoras() {
    setGuardandoIA(true); setMsgIA('')
    const score = analisisIA?.score ?? informe.score_ia
    const { error: e } = await supabase.from('informes')
      .update({ texto_ia: textoEdit, score_ia: score, updated_at: new Date().toISOString() })
      .eq('id', id)
    setGuardandoIA(false)
    if (e) { setMsgIA('❌ ' + e.message); return }
    setInforme(prev => ({ ...prev, texto_ia: textoEdit, score_ia: score }))
    setMsgIA('✅ Cambios guardados')
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  async function enviarEmailSupervisor() {
    if (!emailDest) { setMsgMail('❌ Ingresa el correo del supervisor'); return }
    setEnviandoMail(true); setMsgMail('')
    const appUrl = `https://sistema-de-calidad-wss.vercel.app/informes/${id}`
    const codigo = informe.codigo_informe || informe.numero || id
    const { data, error: e } = await supabase.functions.invoke('enviar-email', {
      body: {
        to: emailDest,
        subject: `[WSS] ${codigo} — pendiente de revisión`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            <div style="background:#1E3A5F;padding:20px 24px">
              <h2 style="color:#fff;margin:0;font-size:18px">Informe listo para revisión</h2>
            </div>
            <div style="padding:24px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:6px 0;color:#64748B;width:140px">Código</td><td style="font-weight:700;color:#1E3A5F">${codigo}</td></tr>
                <tr><td style="padding:6px 0;color:#64748B">OT</td><td>${informe.ot_numero || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#64748B">Cliente</td><td>${informe.cliente_nombre || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#64748B">Inspector</td><td>${informe.inspector_nombre || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#64748B">Resultado</td><td>${informe.resultado || '—'}</td></tr>
              </table>
              <div style="margin-top:24px">
                <a href="${appUrl}" style="background:#1E3A5F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">
                  Ver informe en la app →
                </a>
              </div>
            </div>
          </div>`,
        text: `Informe ${codigo} listo para revisión. OT: ${informe.ot_numero}. Ver en: ${appUrl}`,
      }
    })
    if (e || data?.error) {
      setMsgMail('❌ ' + (e?.message || data?.error))
      setEnviandoMail(false); return
    }
    if (informe.estado === 'BORRADOR') {
      await supabase.from('informes')
        .update({ estado: 'EN_REVISION', updated_at: new Date().toISOString() })
        .eq('id', id)
      setInforme(prev => ({ ...prev, estado: 'EN_REVISION' }))
    }
    setMsgMail('✅ Email enviado y estado actualizado a "En revisión"')
    setEnviandoMail(false)
  }

  async function enviarEmailCliente() {
    if (!emailDest) { setMsgMail('❌ Ingresa el correo del cliente'); return }
    setEnviandoMail(true); setMsgMail('')
    const codigo = informe.codigo_informe || informe.numero || id
    const { data, error: e } = await supabase.functions.invoke('enviar-email', {
      body: {
        to: emailDest,
        subject: `Informe de Inspección ${codigo} — WSS Calidad`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            <div style="background:#1E3A5F;padding:20px 24px">
              <h2 style="color:#fff;margin:0;font-size:18px">Informe de Inspección</h2>
            </div>
            <div style="padding:24px;font-size:14px;color:#374151;line-height:1.6">
              <p>Estimado cliente,</p>
              <p>Nos es grato informarle que hemos completado la inspección correspondiente a:</p>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:6px 0;color:#64748B;width:140px">Código</td><td style="font-weight:700">${codigo}</td></tr>
                <tr><td style="padding:6px 0;color:#64748B">OT</td><td>${informe.ot_numero || '—'}</td></tr>
                <tr><td style="padding:6px 0;color:#64748B">Resultado</td><td>${informe.resultado || '—'}</td></tr>
              </table>
              <p style="margin-top:16px">Para cualquier consulta, no dude en contactarnos.</p>
              <p>Atentamente,<br><b>WSS Calidad</b></p>
            </div>
          </div>`,
        text: `Estimado cliente, adjuntamos el informe ${codigo}. Resultado: ${informe.resultado}. Atentamente, WSS Calidad.`,
      }
    })
    if (e || data?.error) {
      setMsgMail('❌ ' + (e?.message || data?.error))
      setEnviandoMail(false); return
    }
    await supabase.from('informes')
      .update({ estado: 'ENVIADO', updated_at: new Date().toISOString() })
      .eq('id', id)
    setInforme(prev => ({ ...prev, estado: 'ENVIADO' }))
    setMsgMail('✅ Correo enviado al cliente y estado actualizado a "Enviado"')
    setEnviandoMail(false)
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  function abrirWhatsApp() {
    const appUrl = `https://sistema-de-calidad-wss.vercel.app/informes/${id}`
    const codigo = informe.codigo_informe || informe.numero || id
    const msg =
      `Hola, el informe *${codigo}* está listo para revisión.\n\n` +
      `OT: ${informe.ot_numero || '—'}\n` +
      `Cliente: ${informe.cliente_nombre || '—'}\n` +
      `Resultado: ${informe.resultado || '—'}\n\n` +
      `Ver en la app: ${appUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // ── Aprobación ────────────────────────────────────────────────────────────
  async function aprobar() {
    setAprobando(true); setMsgApro('')
    const nombre = usuario?.nombre || usuario?.email || 'Supervisor'
    const { error: e } = await supabase.from('informes').update({
      estado: 'APROBADO',
      fecha_aprobacion: new Date().toISOString(),
      supervisor_nombre: nombre,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setAprobando(false)
    if (e) { setMsgApro('❌ ' + e.message); return }
    setInforme(prev => ({ ...prev, estado: 'APROBADO', fecha_aprobacion: new Date().toISOString(), supervisor_nombre: nombre }))
    setMsgApro('✅ Informe aprobado correctamente')
  }

  async function rechazar() {
    if (!comentRech.trim()) { setMsgApro('❌ Escribe un comentario de rechazo'); return }
    setAprobando(true); setMsgApro('')
    const nombre = usuario?.nombre || usuario?.email || 'Supervisor'
    const { error: e } = await supabase.from('informes').update({
      estado: 'RECHAZADO',
      comentario_supervisor: comentRech,
      fecha_revision: new Date().toISOString(),
      supervisor_nombre: nombre,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setAprobando(false)
    if (e) { setMsgApro('❌ ' + e.message); return }
    setInforme(prev => ({ ...prev, estado: 'RECHAZADO', comentario_supervisor: comentRech }))
    setMsgApro('⚠️ Informe rechazado con observaciones')
    setComentRech('')
  }

  // ── Word (Certificado acreditado WSS) ────────────────────────────────────
  async function generarWord() {
    setGenerandoW(true)
    try {
      const res = await fetch('/api/generar-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ informeId: id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const cd   = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      const fname = match ? match[1] : `WSS_${informe.ot_numero || informe.id}.docx`
      const a = document.createElement('a')
      a.href = url; a.download = fname; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error generando certificado Word: ' + err.message)
    }
    setGenerandoW(false)
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (cargando) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
      Cargando informe…
    </div>
  )
  if (error) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ color: '#DC2626', marginBottom: 16, fontSize: 14 }}>Error: {error}</div>
      <button onClick={() => navigate('/informes')} style={S.btnSec}>← Volver</button>
    </div>
  )
  if (!informe) return null

  // ── Variables derivadas ───────────────────────────────────────────────────
  const est       = ESTADO_BADGE[informe.estado] || ESTADO_BADGE.BORRADOR
  const resBadge  = RESULTADO_BADGE[informe.resultado]
  const esMio     = informe.inspector_id === usuario?.id
  const esSuperv  = ['ADMIN', 'SUPERVISOR'].includes(usuario?.rol)
  const puedeEnv  = (esMio || esSuperv) && informe.estado === 'BORRADOR'
  const puedeApro = esSuperv && informe.estado === 'EN_REVISION'
  const hallazgos = Array.isArray(informe.hallazgos) ? informe.hallazgos : []
  const textoIA   = informe.texto_ia || {}
  const hayTextoIA= SECCIONES_IA.some(s => textoIA[s.key])
  const datosEq   = informe.datos_equipo || {}
  const scoreIA   = analisisIA?.score ?? informe.score_ia

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ── Navegación ── */}
      <button onClick={() => navigate('/informes')}
        style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>
        ← Volver a informes
      </button>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1E3A5F' }}>
            {informe.codigo_informe || informe.numero || 'Informe sin número'}
          </h1>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {informe.tipo_equipo && (
              <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 10px', borderRadius: 12, fontWeight: 700, fontSize: 11 }}>
                {informe.tipo_equipo}
              </span>
            )}
            {informe.metodo_end_cod && <span style={{ color: '#94A3B8' }}>· {informe.metodo_end_cod}</span>}
            {informe.ot_numero && <span style={{ color: '#94A3B8' }}>· OT {informe.ot_numero}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...S.badge, background: est.bg, color: est.color }}>{est.label}</span>
          {resBadge && <span style={{ ...S.badge, background: resBadge.bg, color: resBadge.color }}>{resBadge.label}</span>}
          {scoreIA != null && (
            <span style={{
              ...S.badge,
              background: scoreIA >= 75 ? '#D1FAE5' : scoreIA >= 50 ? '#FEF3C7' : '#FEE2E2',
              color: scoreIA >= 75 ? '#065F46' : scoreIA >= 50 ? '#92400E' : '#991B1B',
            }}>
              Score IA: {scoreIA}/100
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #E2E8F0', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTabActiva(t.id)} style={{
            padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tabActiva === t.id ? '#fff' : 'transparent',
            color: tabActiva === t.id ? '#1E3A5F' : '#64748B',
            borderBottom: tabActiva === t.id ? '2px solid #1E3A5F' : '2px solid transparent',
            borderRadius: '6px 6px 0 0', marginBottom: -2, transition: 'color .15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: RESUMEN
      ═══════════════════════════════════════════════════════════ */}
      {tabActiva === 'resumen' && <>

        {/* Alertas de estado */}
        {informe.estado === 'RECHAZADO' && informe.comentario_supervisor && (
          <div style={{ ...S.alertBox, background: '#FEF2F2', borderColor: '#FECACA', marginBottom: 20 }}>
            <div style={{ ...S.alertTitle, color: '#DC2626' }}>❌ Rechazado por el supervisor</div>
            <p style={{ margin: 0, fontSize: 14, color: '#7F1D1D', lineHeight: 1.6 }}>{informe.comentario_supervisor}</p>
            {informe.fecha_revision && (
              <div style={{ fontSize: 11, color: '#EF4444', marginTop: 6 }}>
                Revisado el {new Date(informe.fecha_revision).toLocaleDateString('es-CL')} · {informe.supervisor_nombre}
              </div>
            )}
          </div>
        )}
        {informe.estado === 'APROBADO' && (
          <div style={{ ...S.alertBox, background: '#F0FDF4', borderColor: '#BBF7D0', marginBottom: 20 }}>
            <div style={{ ...S.alertTitle, color: '#16A34A' }}>✅ Aprobado</div>
            <div style={{ fontSize: 13, color: '#166534' }}>
              Por {informe.supervisor_nombre || 'supervisor'}
              {informe.fecha_aprobacion && ` · ${new Date(informe.fecha_aprobacion).toLocaleDateString('es-CL')}`}
            </div>
          </div>
        )}
        {informe.estado === 'ENVIADO' && (
          <div style={{ ...S.alertBox, background: '#F5F3FF', borderColor: '#DDD6FE', marginBottom: 20 }}>
            <div style={{ ...S.alertTitle, color: '#5B21B6' }}>📨 Enviado al cliente</div>
          </div>
        )}

        {/* Metadata */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={S.secLbl}>Información general</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px 24px' }}>
            <Campo label="OT"               valor={informe.ot_numero} />
            <Campo label="Cliente"          valor={informe.cliente_nombre} />
            <Campo label="Tipo equipo"      valor={informe.tipo_equipo} />
            <Campo label="Lugar"            valor={informe.lugar} />
            <Campo label="Fecha inspección" valor={informe.fecha_inspeccion
              ? new Date(informe.fecha_inspeccion + 'T00:00:00').toLocaleDateString('es-CL') : null} />
            <Campo label="Fecha entrega"    valor={informe.fecha_entrega
              ? new Date(informe.fecha_entrega + 'T00:00:00').toLocaleDateString('es-CL') : null} />
            <Campo label="Inspector"        valor={informe.inspector_nombre} />
            <Campo label="Supervisor"       valor={informe.supervisor_nombre} />
            <Campo label="Norma / Código"   valor={informe.norma_codigo} />
            <Campo label="Acta N°"          valor={informe.numero_acta} />
          </div>
        </div>

        {/* Hallazgos */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={S.secLbl}>Hallazgos ({hallazgos.length})</div>
          {hallazgos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '12px 0' }}>Sin hallazgos registrados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hallazgos.map((h, i) => (
                <div key={i} style={{
                  padding: '12px 16px', borderRadius: 8,
                  background: h.criticidad === 'CRITICO' ? '#FEF2F2' : h.criticidad === 'MAYOR' ? '#FFFBEB' : '#F8FAFC',
                  border: `1px solid ${h.criticidad === 'CRITICO' ? '#FECACA' : h.criticidad === 'MAYOR' ? '#FDE68A' : '#E2E8F0'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1E3A5F' }}>Hallazgo #{i + 1}</span>
                    {h.criticidad && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#fff',
                        background: h.criticidad === 'CRITICO' ? '#DC2626' : h.criticidad === 'MAYOR' ? '#D97706' : '#6B7280',
                      }}>{h.criticidad}</span>
                    )}
                  </div>
                  {h.descripcion && <p style={{ margin: '4px 0', fontSize: 13, color: '#374151' }}>{h.descripcion}</p>}
                  {h.ubicacion   && <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Ubicación: {h.ubicacion}</p>}
                  {h.norma       && <p style={{ margin: 0, fontSize: 12, color: '#7C3AED', fontFamily: 'monospace' }}>Norma: {h.norma}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Texto IA (solo lectura) */}
        {hayTextoIA && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={S.secLbl}>Contenido del informe</div>
              <button onClick={() => setTabActiva('ia')} style={{ ...S.btnSec, fontSize: 12, padding: '5px 14px' }}>
                ✏️ Editar
              </button>
            </div>
            {SECCIONES_IA.map(sec => textoIA[sec.key] ? (
              <div key={sec.key} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', marginBottom: 6 }}>{sec.label}</div>
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {textoIA[sec.key]}
                </p>
              </div>
            ) : null)}
          </div>
        )}
      </>}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: DATOS TÉCNICOS
      ═══════════════════════════════════════════════════════════ */}
      {tabActiva === 'tecnico' && (
        <div>
          {informe.tipo_equipo === 'IZAJE'    && <TabIzaje   datosEq={datosEq} />}
          {informe.tipo_equipo === 'TK'       && <TabTK      datosEq={datosEq} />}
          {informe.tipo_equipo === 'TUBERÍA'  && <TabTuberia datosEq={datosEq} />}
          {!['IZAJE','TK','TUBERÍA'].includes(informe.tipo_equipo) && (
            <div className="card">
              <div style={S.secLbl}>Datos del equipo ({informe.tipo_equipo || 'desconocido'})</div>
              {Object.keys(datosEq).length === 0
                ? <div style={{ color: '#94A3B8', fontSize: 13 }}>Sin datos técnicos registrados</div>
                : <pre style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.6 }}>
                    {JSON.stringify(datosEq, null, 2)}
                  </pre>
              }
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: REVISIÓN IA
      ═══════════════════════════════════════════════════════════ */}
      {tabActiva === 'ia' && <>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={S.secLbl}>Análisis inteligente</div>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B', maxWidth: 480 }}>
                La IA detecta campos faltantes, inconsistencias y sugiere mejoras al texto del informe.
              </p>
            </div>
            <button onClick={analizarConIA} disabled={analizando} style={{
              ...S.btnPri, minWidth: 180, opacity: analizando ? .7 : 1, cursor: analizando ? 'wait' : 'pointer',
            }}>
              {analizando ? '⏳ Analizando…' : '🤖 Analizar con IA'}
            </button>
          </div>

          {/* Barra de score */}
          {scoreIA != null && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                <span style={{ color: '#475569' }}>Puntuación del informe</span>
                <span style={{ color: scoreIA >= 75 ? '#16A34A' : scoreIA >= 50 ? '#D97706' : '#DC2626' }}>
                  {scoreIA} / 100
                </span>
              </div>
              <div style={{ height: 10, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, transition: 'width .7s',
                  width: `${Math.min(100, scoreIA)}%`,
                  background: scoreIA >= 75 ? '#16A34A' : scoreIA >= 50 ? '#D97706' : '#DC2626',
                }} />
              </div>
            </div>
          )}

          {msgIA && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: msgIA.startsWith('✅') ? '#F0FDF4' : '#FEF2F2',
              color: msgIA.startsWith('✅') ? '#166534' : '#991B1B',
            }}>
              {msgIA}
            </div>
          )}
        </div>

        {/* Sugerencias */}
        {analisisIA?.sugerencias?.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={S.secLbl}>Sugerencias ({analisisIA.sugerencias.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {analisisIA.sugerencias.map((s, i) => {
                const TIPO = {
                  campo_faltante: { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', icon: '🔴' },
                  inconsistencia: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icon: '⚠️' },
                  norma:          { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', icon: '📋' },
                  mejora_texto:   { bg: '#F5F3FF', border: '#DDD6FE', color: '#5B21B6', icon: '✏️' },
                }
                const c = TIPO[s.tipo] || TIPO.mejora_texto
                return (
                  <div key={i} style={{ padding: '12px 16px', borderRadius: 8, background: c.bg, border: `1px solid ${c.border}` }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span>{c.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        {(s.tipo || '').replace('_', ' ')}
                      </span>
                      {s.campo && <span style={{ fontSize: 11, color: '#94A3B8' }}>· {s.campo}</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{s.mensaje}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Editor de secciones */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={S.secLbl}>Texto del informe (editable)</div>
            <button onClick={guardarMejoras} disabled={guardandoIA} style={{
              ...S.btnPri, fontSize: 12, padding: '7px 18px', opacity: guardandoIA ? .7 : 1,
            }}>
              {guardandoIA ? 'Guardando…' : '💾 Guardar cambios'}
            </button>
          </div>
          {SECCIONES_IA.map(sec => (
            <div key={sec.key} style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E3A5F', marginBottom: 6 }}>
                {sec.label}
              </label>
              <textarea
                value={textoEdit[sec.key] || ''}
                onChange={e => setTextoEdit(prev => ({ ...prev, [sec.key]: e.target.value }))}
                rows={5}
                style={{
                  width: '100%', borderRadius: 8, border: '1.5px solid #E2E8F0', padding: '10px 14px',
                  fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit',
                  color: '#374151', boxSizing: 'border-box',
                  outline: 'none',
                }}
                placeholder={`Texto de ${sec.label.toLowerCase()}…`}
              />
            </div>
          ))}
        </div>
      </>}

      {/* ═══════════════════════════════════════════════════════════
          TAB 4: ENVIAR
      ═══════════════════════════════════════════════════════════ */}
      {tabActiva === 'enviar' && <>

        {/* Timeline */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={S.secLbl}>Flujo del informe</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {TIMELINE.map((t, i) => {
              const idxActual = TIMELINE_ORDER.indexOf(informe.estado)
              const idxEste   = TIMELINE_ORDER.indexOf(t.id)
              const activo    = idxActual >= idxEste
              const esActual  = informe.estado === t.id
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18, margin: '0 auto',
                      background: activo ? (esActual ? '#1E3A5F' : '#93C5FD') : '#E2E8F0',
                      color: activo ? '#fff' : '#94A3B8',
                      boxShadow: esActual ? '0 0 0 3px #BFDBFE' : 'none',
                    }}>
                      {t.icon}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: activo ? '#1E3A5F' : '#94A3B8', marginTop: 6, whiteSpace: 'nowrap' }}>
                      {t.label}
                    </div>
                  </div>
                  {i < TIMELINE.length - 1 && (
                    <div style={{
                      flex: 1, height: 3, margin: '0 4px', marginBottom: 20,
                      background: idxActual > idxEste ? '#93C5FD' : '#E2E8F0', borderRadius: 99,
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Exportar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={S.secLbl}>Exportar</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={generarWord} disabled={generandoW} style={{ ...S.btnSec, display: 'flex', alignItems: 'center', gap: 8 }}>
              {generandoW ? '⏳ Generando…' : '📄 Descargar Word (.docx)'}
            </button>
            <button onClick={() => window.print()} style={{ ...S.btnSec, display: 'flex', alignItems: 'center', gap: 8 }}>
              🖨️ Imprimir / Guardar PDF
            </button>
          </div>
        </div>

        {/* Enviar a revisión (supervisor) */}
        {(puedeEnv || informe.estado === 'EN_REVISION') && informe.estado !== 'APROBADO' && informe.estado !== 'ENVIADO' && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={S.secLbl}>Enviar a revisión</div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B' }}>
              Notifica al supervisor o jefe de división para que apruebe el informe.
            </p>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              Correo del supervisor
            </label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input
                type="email"
                value={emailDest}
                onChange={e => { setEmailDest(e.target.value); setMsgMail('') }}
                placeholder="supervisor@empresa.com"
                style={S.input}
              />
              <button onClick={enviarEmailSupervisor} disabled={enviandoMail || !puedeEnv} style={{
                ...S.btnPri, whiteSpace: 'nowrap', opacity: (enviandoMail || !puedeEnv) ? .6 : 1,
              }}>
                {enviandoMail ? 'Enviando…' : '✉️ Enviar email'}
              </button>
            </div>

            <button onClick={abrirWhatsApp} style={{ ...S.btnSec, background: '#25D366', color: '#fff', border: 'none' }}>
              📱 Enviar por WhatsApp
            </button>

            {msgMail && <Msg txt={msgMail} />}
          </div>
        )}

        {/* Panel aprobación supervisor */}
        {puedeApro && (
          <div className="card" style={{ marginBottom: 20, border: '2px solid #FDE68A' }}>
            <div style={S.secLbl}>Aprobación del supervisor</div>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748B' }}>
              El inspector envió este informe para revisión. Apruébalo o rechaza con comentario.
            </p>
            <button onClick={aprobar} disabled={aprobando} style={{
              ...S.btnPri, background: '#16A34A', marginBottom: 20, opacity: aprobando ? .7 : 1,
            }}>
              {aprobando ? 'Procesando…' : '✅ Aprobar informe'}
            </button>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Comentario de rechazo
              </label>
              <textarea
                value={comentRech}
                onChange={e => setComentRech(e.target.value)}
                rows={3}
                placeholder="Describe qué debe corregir el inspector…"
                style={{ ...S.input, width: '100%', resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
              />
              <button onClick={rechazar} disabled={aprobando} style={{
                ...S.btnSec, color: '#DC2626', borderColor: '#FECACA', opacity: aprobando ? .7 : 1,
              }}>
                ❌ Rechazar con observaciones
              </button>
            </div>
            {msgApro && <Msg txt={msgApro} />}
          </div>
        )}

        {/* Enviar al cliente (solo si APROBADO) */}
        {informe.estado === 'APROBADO' && (
          <div className="card" style={{ marginBottom: 20, border: '2px solid #BBF7D0' }}>
            <div style={S.secLbl}>Enviar al cliente</div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
              ✅ Informe aprobado — listo para despachar al cliente.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={generarWord} disabled={generandoW} style={{ ...S.btnPri }}>
                {generandoW ? '⏳…' : '📄 Descargar Word'}
              </button>
              <button onClick={abrirWhatsApp} style={{ ...S.btnSec, background: '#25D366', color: '#fff', border: 'none' }}>
                📱 WhatsApp al cliente
              </button>
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              Correo del cliente
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="email"
                value={emailDest}
                onChange={e => { setEmailDest(e.target.value); setMsgMail('') }}
                placeholder="cliente@empresa.com"
                style={S.input}
              />
              <button onClick={enviarEmailCliente} disabled={enviandoMail} style={{
                ...S.btnPri, background: '#16A34A', whiteSpace: 'nowrap', opacity: enviandoMail ? .6 : 1,
              }}>
                {enviandoMail ? 'Enviando…' : '✉️ Enviar al cliente'}
              </button>
            </div>
            {msgMail && <Msg txt={msgMail} />}
          </div>
        )}
      </>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-componentes
// ═══════════════════════════════════════════════════════════════════════════

function TabIzaje({ datosEq }) {
  const elementos = datosEq?.elementos_izaje || []
  const equipos   = datosEq?.equipos_izaje_adicionales || []

  if (elementos.length === 0 && equipos.length === 0)
    return (
      <div className="card" style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '20px 16px' }}>
        Sin datos de elementos de izaje registrados
      </div>
    )

  const porFamilia = {}
  elementos.forEach(el => {
    const fam = getFamIzaje(el.tipo)
    if (!porFamilia[fam]) porFamilia[fam] = []
    porFamilia[fam].push(el)
  })

  return <>
    {equipos.length > 0 && (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={S.secLbl}>Equipos principales ({equipos.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.tbl}>
            <thead>
              <tr>{['Tipo', 'Marca', 'Modelo', 'Capacidad', 'N° sello', 'Resultado'].map(h =>
                <th key={h} style={S.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {equipos.map((eq, i) => (
                <tr key={i} style={{ background: i % 2 ? '#F8FAFC' : '#fff' }}>
                  <td style={S.td}>{eq.tipo_equipo_izaje || '—'}</td>
                  <td style={S.td}>{eq.marca || '—'}</td>
                  <td style={S.td}>{eq.modelo || '—'}</td>
                  <td style={S.td}>{eq.capacidad ? `${eq.capacidad} t` : '—'}</td>
                  <td style={S.td}>{eq.n_sello || '—'}</td>
                  <td style={S.td}><ResultBadge r={eq.resultado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {Object.entries(porFamilia).map(([fam, els]) => (
      <div key={fam} className="card" style={{ marginBottom: 16 }}>
        <div style={S.secLbl}>{fam} ({els.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.tbl}>
            <thead>
              <tr>{['Tipo', 'N° sello', 'Capacidad', 'Marca', 'Resultado'].map(h =>
                <th key={h} style={S.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {els.map((el, i) => (
                <tr key={i} style={{ background: i % 2 ? '#F8FAFC' : '#fff' }}>
                  <td style={S.td}>{el.tipo || '—'}</td>
                  <td style={S.td}>{el.n_sello || '—'}</td>
                  <td style={S.td}>{el.capacidad ? `${el.capacidad} t` : '—'}</td>
                  <td style={S.td}>{el.marca || '—'}</td>
                  <td style={S.td}><ResultBadge r={el.resultado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ))}
  </>
}

function TabTK({ datosEq }) {
  const tanques = datosEq?.tanques || datosEq?.tank_data || []
  if (tanques.length === 0)
    return (
      <div className="card">
        <div style={S.secLbl}>Datos técnicos TK</div>
        <pre style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.6 }}>
          {JSON.stringify(datosEq, null, 2)}
        </pre>
      </div>
    )

  return tanques.map((t, i) => (
    <div key={i} className="card" style={{ marginBottom: 16 }}>
      <div style={S.secLbl}>Tanque: {t.tag || t.numero_tag || `TK-${i + 1}`}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '12px 20px', marginBottom: 16 }}>
        <Campo label="Tag"            valor={t.tag || t.numero_tag} />
        <Campo label="Tipo"           valor={t.tipo_tanque} />
        <Campo label="Diámetro (m)"   valor={t.diametro} />
        <Campo label="Altura (m)"     valor={t.altura} />
        <Campo label="Capacidad (m³)" valor={t.capacidad} />
        <Campo label="Material"       valor={t.material} />
        <Campo label="Fluido"         valor={t.fluido} />
        <Campo label="Esp. nominal"   valor={t.espesor_nominal} />
        <Campo label="Esp. mínimo"    valor={t.espesor_minimo} />
      </div>
      {t.mediciones?.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Mediciones UT</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.tbl}>
            <thead>
              <tr>{['Zona', 'Lect. 1', 'Lect. 2', 'Lect. 3', 'Promedio', 'Estado'].map(h =>
                <th key={h} style={S.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {t.mediciones.map((m, j) => (
                <tr key={j} style={{ background: j % 2 ? '#F8FAFC' : '#fff' }}>
                  <td style={S.td}>{m.zona || m.ubicacion || `Zona ${j + 1}`}</td>
                  <td style={S.td}>{m.l1 ?? m.lectura_1 ?? '—'}</td>
                  <td style={S.td}>{m.l2 ?? m.lectura_2 ?? '—'}</td>
                  <td style={S.td}>{m.l3 ?? m.lectura_3 ?? '—'}</td>
                  <td style={S.td}>{m.promedio ?? '—'}</td>
                  <td style={S.td}><ResultBadge r={m.estado || m.resultado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  ))
}

function TabTuberia({ datosEq }) {
  const lineas = datosEq?.lineas || []
  if (lineas.length === 0)
    return (
      <div className="card">
        <div style={S.secLbl}>Datos técnicos Tubería</div>
        <pre style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.6 }}>
          {JSON.stringify(datosEq, null, 2)}
        </pre>
      </div>
    )

  return lineas.map((l, i) => (
    <div key={i} className="card" style={{ marginBottom: 16 }}>
      <div style={S.secLbl}>Línea: {l.numero_linea || l.tag || `L-${i + 1}`}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '12px 20px', marginBottom: 16 }}>
        <Campo label="N° línea"    valor={l.numero_linea} />
        <Campo label="Tag"         valor={l.tag} />
        <Campo label="Fluido"      valor={l.fluido} />
        <Campo label="Diámetro"    valor={l.diametro} />
        <Campo label="Sch / Esp."  valor={l.schedule || l.espesor_nominal} />
        <Campo label="Material"    valor={l.material} />
        <Campo label="Temperatura" valor={l.temperatura} />
        <Campo label="Presión"     valor={l.presion} />
      </div>
      {l.spools?.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Spools</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.tbl}>
            <thead>
              <tr>{['Spool', 'Longitud (m)', 'N° mediciones', 'Resultado'].map(h =>
                <th key={h} style={S.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {l.spools.map((sp, j) => (
                <tr key={j} style={{ background: j % 2 ? '#F8FAFC' : '#fff' }}>
                  <td style={S.td}>{sp.id || sp.numero || `SP-${j + 1}`}</td>
                  <td style={S.td}>{sp.longitud ?? '—'}</td>
                  <td style={S.td}>{sp.mediciones?.length ?? sp.n_mediciones ?? '—'}</td>
                  <td style={S.td}><ResultBadge r={sp.resultado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  ))
}

function ResultBadge({ r }) {
  if (!r) return <span style={{ color: '#CBD5E1' }}>—</span>
  const up = r.toUpperCase()
  const ok = up === 'CUMPLE' || up === 'CONFORME' || up === 'APROBADO' || up === 'OK' || up === 'APTO'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: ok ? '#D1FAE5' : '#FEE2E2',
      color:      ok ? '#065F46' : '#991B1B',
    }}>
      {r}
    </span>
  )
}

function Campo({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#1E3A5F', fontWeight: 600 }}>
        {(valor != null && valor !== '') ? valor : <span style={{ color: '#CBD5E1' }}>—</span>}
      </div>
    </div>
  )
}

function Msg({ txt }) {
  return (
    <div style={{
      marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      background: txt.startsWith('✅') ? '#F0FDF4' : txt.startsWith('⚠️') ? '#FFFBEB' : '#FEF2F2',
      color:      txt.startsWith('✅') ? '#166534' : txt.startsWith('⚠️') ? '#92400E' : '#991B1B',
    }}>
      {txt}
    </div>
  )
}

// ── Estilos ────────────────────────────────────────────────────────────────
const S = {
  badge:    { display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12 },
  secLbl:   { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 14 },
  alertBox: { borderRadius: 10, padding: '16px 20px', border: '1.5px solid' },
  alertTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 },
  btnSec:   { padding: '9px 20px', borderRadius: 8, border: '1.5px solid #CBD5E1', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnPri:   { padding: '9px 24px', borderRadius: 8, border: 'none', background: '#1E3A5F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  input:    { flex: 1, borderRadius: 8, border: '1.5px solid #CBD5E1', padding: '9px 14px', fontSize: 13, color: '#374151', outline: 'none', minWidth: 0 },
  tbl:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:       { padding: '8px 12px', textAlign: 'left', background: '#F1F5F9', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid #E2E8F0' },
  td:       { padding: '8px 12px', borderBottom: '1px solid #F1F5F9', color: '#374151' },
}
