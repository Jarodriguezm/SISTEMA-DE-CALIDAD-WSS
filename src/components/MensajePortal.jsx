// ============================================================
// MensajePortal.jsx — Mensajes de reflexión, seguridad y Ley Karin
// Selección determinística por día y usuario: distinto cada día,
// estable dentro del mismo día, y sin repetir hasta agotar el set.
// ============================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Hash simple y estable (día + usuario + contexto)
function semilla(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

const hoy = () => new Date().toISOString().slice(0, 10)

/**
 * @param {string} contexto  'ingreso' | 'crear_ot' | 'ver_asignacion' | 'crear_informe'
 * @param {boolean} soloUnaVezAlDia  si true, no reaparece el mismo día
 */
export default function MensajePortal({ contexto = 'ingreso', soloUnaVezAlDia = true }) {
  const { usuario } = useAuth()
  const [msj,     setMsj]     = useState(null)
  const [visible, setVisible] = useState(false)
  const [pref,    setPref]    = useState(null)   // null = aún no cargada
  const [recarga, setRecarga] = useState(0)

  // La preferencia se lee directo de la tabla usuarios
  useEffect(() => {
    if (!usuario?.id) return
    let cancelado = false
    supabase.from('usuarios').select('preferencia_mensajes').eq('id', usuario.id).maybeSingle()
      .then(({ data }) => { if (!cancelado) setPref(data?.preferencia_mensajes || 'general') })
    return () => { cancelado = true }
  }, [usuario, recarga])

  useEffect(() => {
    if (!usuario || pref === null) return
    let cancelado = false

    const claveDia = `wss_msj_${contexto}_${hoy()}_${usuario.id || usuario.email}`
    if (soloUnaVezAlDia && localStorage.getItem(claveDia)) return

    async function cargar() {
      const rol = (usuario.rol || '').toUpperCase()

      const { data, error } = await supabase
        .from('mensajes_portal')
        .select('*')
        .eq('contexto', contexto)
        .eq('activo', true)

      if (error || !data?.length || cancelado) return

      // Aplican los del rol del usuario y los generales,
      // filtrados por la preferencia que la persona eligió.
      const aplicables = data.filter(m =>
        (!m.rol || m.rol.toUpperCase() === rol) &&
        ((m.preferencia || 'general') === pref ||
         // los de seguridad y Ley Karin se muestran siempre
         m.categoria === 'seguridad' || m.categoria === 'karin')
      )
      if (!aplicables.length) return

      // Rotación: el día y el usuario definen cuál toca, sin repetir
      // hasta recorrer todo el set disponible.
      const base   = semilla(`${hoy()}|${usuario.id || usuario.email}|${contexto}`)
      const diaNum = Math.floor(Date.parse(hoy()) / 86400000)

      // En 'ingreso' se alterna: días pares muestran los modales
      // (seguridad y Ley Karin), impares los de reflexión.
      let pool = aplicables
      if (contexto === 'ingreso') {
        const modales = aplicables.filter(m => m.modal)
        const banners = aplicables.filter(m => !m.modal)
        if (diaNum % 2 === 0 && modales.length) pool = modales
        else if (banners.length)                pool = banners
      }

      const elegido = pool[(base + diaNum) % pool.length]
      if (cancelado) return
      setMsj(elegido)
      setVisible(true)
      if (soloUnaVezAlDia) localStorage.setItem(claveDia, elegido.id)
    }

    cargar()
    return () => { cancelado = true }
  }, [usuario, contexto, soloUnaVezAlDia, pref, recarga])

  if (!visible || !msj) return null

  const cerrar = () => setVisible(false)
  const esKarin = msj.categoria === 'karin'
  const esSeg   = msj.categoria === 'seguridad'

  // ── Modal: seguridad y Ley Karin ──
  if (msj.modal) {
    return (
      <div style={S.overlay} onClick={e => e.target === e.currentTarget && cerrar()}>
        <div style={S.modal}>
          <div style={{ ...S.mHead, background: esKarin ? S.gradKarin : S.gradSeg }}>
            <span style={S.chip}>
              {esKarin ? 'Ley Karin · Ley 21.643' : 'Seguridad'}
            </span>
            <h2 style={S.mTitulo}>{msj.titulo}</h2>
          </div>
          <div style={S.mBody}>
            <p style={S.mTexto}>{msj.texto}</p>
            {esKarin && (
              <p style={S.mPie}>
                Ante cualquier situación de acoso o violencia laboral, puedes acudir a tu jefatura,
                al Departamento de Calidad o directamente a la Dirección del Trabajo.
              </p>
            )}
            {esSeg && (
              <p style={S.mPie}>
                Si las condiciones no son seguras, tienes respaldo de la empresa para detener la actividad.
              </p>
            )}
            <button onClick={cerrar} style={S.btn}>Entendido</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Banner: motivación, reflexión, comercial ──
  return (
    <div style={S.banner}>
      <div style={S.barra} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {msj.titulo && <div style={S.bTitulo}>{msj.titulo}</div>}
        <div style={S.bTexto}>{msj.texto}</div>
        {contexto === 'ingreso' && (
          <SelectorPreferencia
            usuarioId={usuario?.id} actual={pref || 'general'}
            onCambio={v => { setPref(v); setVisible(false); setRecarga(r => r + 1) }} />
        )}
      </div>
      <button onClick={cerrar} style={S.bCerrar} aria-label="Cerrar">✕</button>
    </div>
  )
}

// ── Cada persona elige su propio estilo de mensaje ────────────
// No lo asigna la jefatura: es una elección personal y reversible.
const OPCIONES = [
  { v: 'general', l: 'Reflexión y trabajo' },
  { v: 'biblico', l: 'Pasaje bíblico' },
]

function SelectorPreferencia({ usuarioId, actual, onCambio }) {
  const [abierto,   setAbierto]   = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function elegir(v) {
    if (v === actual) { setAbierto(false); return }
    try {
      setGuardando(true)
      await supabase.from('usuarios').update({ preferencia_mensajes: v }).eq('id', usuarioId)
      // Limpia la marca del día para que el cambio se vea de inmediato
      Object.keys(localStorage)
        .filter(k => k.startsWith('wss_msj_'))
        .forEach(k => localStorage.removeItem(k))
      setAbierto(false)
      onCambio?.(v)
    } finally { setGuardando(false) }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={S.link}>
        Cambiar el tipo de mensaje que recibo
      </button>
    )
  }

  return (
    <div style={S.pref}>
      <span style={S.prefLbl}>Prefiero recibir:</span>
      {OPCIONES.map(o => (
        <button key={o.v} onClick={() => elegir(o.v)} disabled={guardando}
          style={{ ...S.prefBtn, ...(actual === o.v ? S.prefBtnOn : {}) }}>
          {o.l}
        </button>
      ))}
      <button onClick={() => setAbierto(false)} style={S.link}>Cancelar</button>
    </div>
  )
}

const S = {
  gradKarin: 'linear-gradient(135deg, #6D28D9, #9333EA)',
  gradSeg:   'linear-gradient(135deg, #B45309, #D97706)',
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,.66)', zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modal: {
    width: '100%', maxWidth: 520, background: '#fff', borderRadius: 18,
    overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.35)',
  },
  mHead: { padding: '22px 26px 20px' },
  chip: {
    display: 'inline-block', background: 'rgba(255,255,255,.20)', color: '#fff',
    fontSize: 10.5, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase',
    padding: '4px 11px', borderRadius: 20, marginBottom: 10,
  },
  mTitulo: { margin: 0, color: '#fff', fontSize: 20, fontWeight: 800, lineHeight: 1.3 },
  mBody: { padding: '20px 26px 24px' },
  mTexto: { margin: 0, fontSize: 14.5, lineHeight: 1.68, color: '#1F2937' },
  mPie: {
    margin: '16px 0 0', fontSize: 12.5, lineHeight: 1.6, color: '#6B7280',
    paddingTop: 14, borderTop: '1px solid #F1F5F9',
  },
  btn: {
    marginTop: 20, width: '100%', background: '#0E2A45', color: '#fff', border: 'none',
    borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  banner: {
    display: 'flex', alignItems: 'flex-start', gap: 14, background: '#fff',
    border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px',
    marginBottom: 18, boxShadow: '0 1px 3px rgba(15,23,42,.06)',
  },
  barra: { width: 4, alignSelf: 'stretch', background: '#B8860B', borderRadius: 4, flexShrink: 0 },
  bTitulo: { fontSize: 12, fontWeight: 800, color: '#B8860B', textTransform: 'uppercase', letterSpacing: '.5px' },
  bTexto: { fontSize: 14, color: '#334155', lineHeight: 1.6, marginTop: 3 },
  bCerrar: {
    background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer',
    fontSize: 14, padding: 2, flexShrink: 0,
  },
  link: {
    background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer',
    fontSize: 11.5, padding: 0, marginTop: 8, textDecoration: 'underline',
  },
  pref: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9',
  },
  prefLbl: { fontSize: 11.5, color: '#64748B', fontWeight: 600 },
  prefBtn: {
    background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 20,
    padding: '4px 12px', fontSize: 11.5, cursor: 'pointer', color: '#475569',
  },
  prefBtnOn: { background: '#0E2A45', borderColor: '#0E2A45', color: '#fff', fontWeight: 700 },
}
