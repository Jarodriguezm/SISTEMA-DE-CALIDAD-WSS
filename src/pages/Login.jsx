import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')
  const [recuperando, setRecuperando]       = useState(false)
  const [mensajeRecuperar, setMensajeRecuperar] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) { setError('Ingresa tu correo y contraseña'); return }
    try {
      setCargando(true); setError(''); setMensajeRecuperar('')
      await login(email, password)
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  async function handleRecuperarPassword() {
    if (!email) { setError('Ingresa tu correo primero para recuperar contraseña'); return }
    try {
      setRecuperando(true); setError('')
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      setMensajeRecuperar('Revisa tu correo para restablecer tu contraseña')
    } catch (err) {
      setError(err.message || 'Error al enviar email de recuperación')
    } finally {
      setRecuperando(false)
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoWrap}>
          <img
            src="/assets/wss-logo-horizontal-transparent.png"
            alt="WSS Testing & Certification Chile"
            style={styles.logo}
            onError={e => {
              e.target.src = '/assets/wss-logo-square-512.png'
              e.target.style.maxHeight = '80px'
            }}
          />
        </div>

        <h1 style={styles.titulo}>Sistema de Calidad</h1>
        <p style={styles.subtitulo}>World Survey Services S.A. · División Inspección Industrial</p>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        {mensajeRecuperar && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>{mensajeRecuperar}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Correo electrónico</label>
            <input
              className="input"
              type="email"
              placeholder="usuario@wss.cl"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              disabled={cargando}
            />
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>Contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={cargando}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '11px' }}
            disabled={cargando}
          >
            {cargando
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Ingresando...</>
              : 'Ingresar al portal'}
          </button>
        </form>

        <div style={styles.footer}>
          <div style={styles.divider} />
          <button
            type="button"
            onClick={handleRecuperarPassword}
            disabled={recuperando || cargando}
            style={styles.btnRecuperar}
          >
            {recuperando ? 'Enviando enlace...' : '¿Olvidaste tu contraseña?'}
          </button>
          <p style={{ color: 'var(--gris)', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
            Acceso restringido · Solo personal autorizado WSS
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  bg: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0E2A45 0%, #17395C 50%, #1E4D7B 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '40px 36px',
    width: '100%', maxWidth: 420,
    boxShadow: '0 24px 80px rgba(0,0,0,.3)',
  },
  logoWrap: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, minHeight: 80,
  },
  logo: {
    maxWidth: 280,
    maxHeight: 90,
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
  },
  titulo:   { textAlign: 'center', marginBottom: 4, fontSize: 22 },
  subtitulo: { textAlign: 'center', color: 'var(--gris)', fontSize: 12, marginBottom: 28 },
  footer:   { marginTop: 20 },
  divider:  { height: 1, background: 'var(--borde)', margin: '16px 0' },
  btnRecuperar: {
    background: 'none', border: 'none', color: 'var(--azul)',
    fontSize: 13, cursor: 'pointer', width: '100%',
    textAlign: 'center', padding: '6px 0', textDecoration: 'underline',
  },
}
