// ============================================================
// CharlaDiaria.jsx — Charla de seguridad al primer ingreso del día
//
// Muestra un mensaje de salud y seguridad ocupacional con una
// pregunta de sí o no. No se puede cerrar hasta responder: no hay
// botón de cierre, no cierra con Escape ni haciendo clic fuera.
//
// La respuesta queda registrada con fecha, hora y usuario. Ese
// registro es la evidencia de difusión que exigen el DS 44 y el
// DS 132: una charla sin registro no sirve ante fiscalización.
// ============================================================
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const COLOR_CATEGORIA = {
  'EPP':                  '#B8860B',
  'Altura':               '#DC2626',
  'Espacios confinados':  '#7C3AED',
  'END':                  '#0891B2',
  'Conducción':           '#EA580C',
  'Izaje':                '#DC2626',
  'Sustancias':           '#059669',
  'Salud':                '#0891B2',
  'Ley Karin':            '#BE185D',
  'Emergencias':          '#DC2626',
  'Calidad':              '#185FA5',
}

export default function CharlaDiaria() {
  const { usuario } = useAuth()
  const [charla, setCharla]   = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const inicio = useRef(Date.now())

  useEffect(() => {
    if (!usuario?.email) return
    let vigente = true
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('fn_charla_del_dia')
        if (error) { console.warn('[charla]', error.message); return }
        if (vigente && data?.pendiente) {
          setCharla(data)
          inicio.current = Date.now()
        }
      } catch (e) { console.warn('[charla]', e.message) }
    })()
    return () => { vigente = false }
  }, [usuario?.email])

  // Bloquea el scroll del fondo mientras está abierta
  useEffect(() => {
    if (!charla) return
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previo }
  }, [charla])

  async function responder(valor) {
    setEnviando(true)
    try {
      const segundos = Math.round((Date.now() - inicio.current) / 1000)
      const { data, error } = await supabase.rpc('fn_charla_responder', {
        p_charla_id: charla.id,
        p_respuesta: valor,
        p_segundos: segundos,
      })
      if (error) throw error
      setResultado(data)
    } catch (e) {
      console.warn('[charla] responder:', e.message)
      // Si falla el registro, no la dejamos atrapada
      setCharla(null)
    } finally { setEnviando(false) }
  }

  if (!charla) return null

  const color = COLOR_CATEGORIA[charla.categoria] || '#0E2A45'

  return (
    <div style={S.fondo} role="dialog" aria-modal="true">
      <div style={S.caja}>

        <div style={{ ...S.cinta, background: color }}>
          {charla.categoria}
        </div>

        <div style={S.cuerpo}>
          <div style={S.etiqueta}>Charla diaria de seguridad</div>
          <h2 style={S.titulo}>{charla.titulo}</h2>
          <p style={S.mensaje}>{charla.mensaje}</p>

          {!resultado ? (
            <>
              <div style={S.bloquePregunta}>
                <div style={S.pregunta}>{charla.pregunta}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button onClick={() => responder(true)} disabled={enviando}
                    style={{ ...S.btnRespuesta, borderColor: '#059669', color: '#065F46' }}>
                    Sí
                  </button>
                  <button onClick={() => responder(false)} disabled={enviando}
                    style={{ ...S.btnRespuesta, borderColor: '#DC2626', color: '#991B1B' }}>
                    No
                  </button>
                </div>
              </div>
              <p style={S.pie}>
                Tu respuesta queda registrada como constancia de difusión.
                {charla.referencia ? ` · ${charla.referencia}` : ''}
              </p>
            </>
          ) : (
            <div style={{
              ...S.bloqueResultado,
              background: resultado.correcta ? '#ECFDF5' : '#FFFBEB',
              borderColor: resultado.correcta ? '#A7F3D0' : '#FDE68A',
            }}>
              <div style={{
                fontSize: 13, fontWeight: 800, letterSpacing: '.5px',
                color: resultado.correcta ? '#065F46' : '#92400E',
                textTransform: 'uppercase', marginBottom: 6,
              }}>
                {resultado.correcta ? 'Respuesta correcta' : 'Vale la pena aclararlo'}
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: '#334155' }}>
                {resultado.retroalimentacion}
              </p>
              {resultado.referencia && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#94A3B8' }}>
                  {resultado.referencia}
                </div>
              )}
              <button onClick={() => setCharla(null)} style={S.btnCerrar}>
                Entendido, continuar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    width: '100vw', height: '100vh', zIndex: 9500,
    background: 'rgba(8,18,32,.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  caja: {
    background: '#fff', borderRadius: 18, maxWidth: 620, width: '100%',
    maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 30px 90px rgba(0,0,0,.5)',
  },
  cinta: {
    color: '#fff', fontSize: 11.5, fontWeight: 800, letterSpacing: '1.2px',
    textTransform: 'uppercase', padding: '10px 28px', borderRadius: '18px 18px 0 0',
  },
  cuerpo: { padding: '24px 28px 28px' },
  etiqueta: {
    fontSize: 11, fontWeight: 800, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '.9px',
  },
  titulo: { margin: '8px 0 14px', fontSize: 23, fontWeight: 800, color: '#0E2A45', lineHeight: 1.3 },
  mensaje: { margin: 0, fontSize: 16, lineHeight: 1.72, color: '#334155' },
  bloquePregunta: {
    marginTop: 24, background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 12, padding: '18px 20px',
  },
  pregunta: { fontSize: 16.5, fontWeight: 700, color: '#0E2A45', lineHeight: 1.5 },
  btnRespuesta: {
    flex: 1, padding: '14px', fontSize: 17, fontWeight: 800,
    background: '#fff', border: '2px solid', borderRadius: 12, cursor: 'pointer',
  },
  bloqueResultado: {
    marginTop: 24, border: '1px solid', borderRadius: 12, padding: '18px 20px',
  },
  btnCerrar: {
    marginTop: 18, width: '100%', background: '#0E2A45', color: '#fff',
    border: 'none', borderRadius: 10, padding: '13px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  pie: { marginTop: 16, marginBottom: 0, fontSize: 12, color: '#94A3B8', lineHeight: 1.5 },
}
