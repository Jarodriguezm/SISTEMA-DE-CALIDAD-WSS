// ============================================================
// Celebracion.jsx — Fuegos artificiales al completar una OT
// Se dispara una sola vez, en el momento en que la OT llega
// a 12/12 etapas documentadas.
// ============================================================
import { useEffect, useRef, useState } from 'react'

const COLORES = ['#B8860B', '#D4A017', '#2D5080', '#185FA5', '#059669', '#DC2626', '#FFFFFF']

export default function Celebracion({ activo, otNumero, cliente, equipo = [], onCerrar }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!activo) return
    setVisible(true)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const dpr = window.devicePixelRatio || 1
    function dimensionar() {
      canvas.width  = window.innerWidth  * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width  = window.innerWidth  + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    dimensionar()
    window.addEventListener('resize', dimensionar)

    const W = () => window.innerWidth
    const H = () => window.innerHeight

    let cohetes    = []
    let particulas = []
    const inicio   = Date.now()
    const DURACION = 6500   // deja de lanzar cohetes nuevos

    function lanzarCohete() {
      const xd = W() * (0.15 + Math.random() * 0.7)
      const yd = H() * (0.15 + Math.random() * 0.35)
      cohetes.push({
        x: xd, y: H() + 10, xd, yd,
        vy: -(7 + Math.random() * 3),
        color: COLORES[Math.floor(Math.random() * COLORES.length)],
        estela: [],
      })
    }

    function explotar(c) {
      const n = 55 + Math.floor(Math.random() * 35)
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.2
        const vel = 1.6 + Math.random() * 4.2
        particulas.push({
          x: c.x, y: c.y,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel,
          color: Math.random() < 0.22 ? '#FFFFFF' : c.color,
          vida: 1,
          decay: 0.010 + Math.random() * 0.012,
          radio: 1.6 + Math.random() * 1.8,
        })
      }
    }

    let ultimoLanzamiento = 0

    function animar() {
      const t = Date.now() - inicio

      // Rastro suave en vez de limpiar del todo
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.16)'
      ctx.fillRect(0, 0, W(), H())
      ctx.globalCompositeOperation = 'lighter'

      // Lanzar cohetes con ritmo
      if (t < DURACION && t - ultimoLanzamiento > 260) {
        lanzarCohete()
        if (Math.random() < 0.4) setTimeout(lanzarCohete, 120)
        ultimoLanzamiento = t
      }

      // Cohetes subiendo
      cohetes = cohetes.filter(c => {
        c.estela.push({ x: c.x, y: c.y })
        if (c.estela.length > 8) c.estela.shift()

        c.y += c.vy
        c.vy += 0.055

        c.estela.forEach((p, i) => {
          ctx.globalAlpha = (i / c.estela.length) * 0.7
          ctx.fillStyle = c.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.globalAlpha = 1

        if (c.y <= c.yd || c.vy >= 0) { explotar(c); return false }
        return true
      })

      // Partículas de la explosión
      particulas = particulas.filter(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.045          // gravedad
        p.vx *= 0.985          // roce
        p.vy *= 0.985
        p.vida -= p.decay

        if (p.vida <= 0) return false

        ctx.globalAlpha = Math.max(p.vida, 0)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radio * p.vida, 0, Math.PI * 2)
        ctx.fill()
        return true
      })
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      if (t < DURACION || particulas.length || cohetes.length) {
        rafRef.current = requestAnimationFrame(animar)
      }
    }

    // Primera andanada inmediata
    lanzarCohete()
    setTimeout(lanzarCohete, 180)
    setTimeout(lanzarCohete, 380)
    rafRef.current = requestAnimationFrame(animar)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', dimensionar)
    }
  }, [activo])

  if (!visible) return null

  const cerrar = () => { setVisible(false); onCerrar?.() }

  return (
    <div style={S.overlay}>
      <canvas ref={canvasRef} style={S.canvas} />

      <div style={S.tarjeta}>
        <div style={S.sello}>OT COMPLETADA</div>

        <h2 style={S.titulo}>¡Proceso cerrado!</h2>

        <div style={S.ot}>{otNumero}</div>
        {cliente && <div style={S.cliente}>{cliente}</div>}

        <p style={S.texto}>
          Las 12 etapas documentales están completas. Este expediente resiste
          cualquier auditoría, y eso no pasa solo: lo hizo el equipo.
        </p>

        {equipo.length > 0 && (
          <div style={S.equipo}>
            <div style={S.equipoLbl}>Gracias a</div>
            <div style={S.equipoNombres}>{equipo.join(' · ')}</div>
          </div>
        )}

        <button onClick={cerrar} style={S.btn}>Seguimos</button>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'rgba(8,18,32,.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  canvas: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  tarjeta: {
    position: 'relative', zIndex: 2, textAlign: 'center',
    background: 'rgba(255,255,255,.97)', borderRadius: 22,
    padding: '38px 44px 34px', maxWidth: 520, width: '100%',
    boxShadow: '0 30px 90px rgba(0,0,0,.5)',
    border: '1px solid rgba(184,134,11,.35)',
  },
  sello: {
    display: 'inline-block', background: '#B8860B', color: '#fff',
    fontSize: 11, fontWeight: 800, letterSpacing: '1.4px',
    padding: '6px 16px', borderRadius: 20, marginBottom: 18,
  },
  titulo: { margin: '0 0 18px', fontSize: 30, fontWeight: 800, color: '#0E2A45' },
  ot: {
    fontFamily: 'monospace', fontSize: 25, fontWeight: 800,
    color: '#185FA5', letterSpacing: '.5px',
  },
  cliente: { fontSize: 15, color: '#475569', marginTop: 5, fontWeight: 600 },
  texto: {
    fontSize: 15, lineHeight: 1.68, color: '#334155',
    margin: '20px 0 0',
  },
  equipo: {
    marginTop: 22, paddingTop: 18, borderTop: '1px solid #EEF2F7',
  },
  equipoLbl: {
    fontSize: 10.5, fontWeight: 800, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '.8px',
  },
  equipoNombres: {
    fontSize: 15, color: '#0E2A45', fontWeight: 700, marginTop: 6, lineHeight: 1.5,
  },
  btn: {
    marginTop: 26, width: '100%', background: '#0E2A45', color: '#fff',
    border: 'none', borderRadius: 12, padding: '14px',
    fontSize: 15.5, fontWeight: 700, cursor: 'pointer',
  },
}
