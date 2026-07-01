import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const [modoOlvide, setModoOlvide] = useState(false)
  const [emailRecup, setEmailRecup] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) { setError('Ingresa tu correo y contraseña'); return }
    try {
      setCargando(true)
      setError('')
      await login(email.trim().toLowerCase(), password)
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    if (!emailRecup.trim()) { setError('Ingresa tu correo electrónico'); return }
    try {
      setEnviando(true)
      setError('')
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        emailRecup.trim().toLowerCase(),
        { redirectTo: window.location.origin + '/login' }
      )
      if (err) throw err
      setEnviado(true)
    } catch (err) {
      setError(err.message || 'Error al enviar el correo de recuperación')
    } finally {
      setEnviando(false)
    }
  }

  function volverALogin() {
    setModoOlvide(false)
    setEnviado(false)
    setError('')
    setEmailRecup('')
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img
            src="https://drive.google.com/thumbnail?id=1IzQfWUQ1BdzKI6VRW2XIX5ovkmb5Apzz&sz=w400"
            alt="WSS Testing & Certification Chile"
            style={styles.logo}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
        <h1 style={styles.titulo}>Sistema de Calidad</h1>
        <p style={styles.subtitulo}>World Survey Services S.A. · División Inspección Industrial</p>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {!modoOlvide && (
          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Correo electrónico</label>
              <input className="input" type="email" placeholder="usuario@wss.cl" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus disabled={cargando} />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Contraseña</label>
              <input className="input" type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password" disabled={cargando} />
            </div>
            <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: '11px' }} disabled={cargando}>
              {cargando ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Ingresando...</> : 'Ingresar al portal'}
            </button>
            <button type="button" onClick={() => { setModoOlvide(true); setEmailRecup(email); setError('') }} style={styles.linkOlvide}>
              Olvidé mi contraseña
            </button>
          </form>
        )}

        {modoOlvide && !enviado && (
          <form onSubmit={handleRecuperar}>
            <p style={{ color: 'var(--gris)', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
              Ingresa tu correo y te enviaremos un link para restablecer tu contraseña.
            </p>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Correo electrónico</label>
              <input className="input" type="email" placeholder="usuario@wss.cl" value={emailRecup}
                onChange={e => setEmailRecup(e.target.value)} autoFocus disabled={enviando} />
            </div>
            <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: '11px' }} disabled={enviando}>
              {enviando ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Enviando...</> : 'Enviar link de recuperación'}
            </button>
            <button type="button" onClick={volverALogin} style={styles.linkOlvide}>← Volver al inicio de sesión</button>
          </form>
        )}

        {modoOlvide && enviado && (
          <div>
            <div className="alert alert-ok" style={{ marginBottom: 20 }}>
              ✓ Correo enviado a <strong>{emailRecup}</strong>. Revisa tu bandeja de entrada (y spam).
            </div>
            <button type="button" className="btn btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={volverALogin}>
              ← Volver al inicio de sesión
            </button>
          </div>
        )}

        <div style={styles.footer}>
          <div style={styles.divider} />
          <p style={{ color: 'var(--gris)', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
            Acceso restringido · Solo personal autorizado WSS
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  bg: { minHeight: '100vh', background: 'linear-gradient(135deg, #0E2A45 0%, #17395C 50%, #1E4D7B 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
  card: { background: '#fff', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,.3)' },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 20 },
  logo: { maxWidth: 240, height: 'auto' },
  titulo: { textAlign: 'center', marginBottom: 4, fontSize: 22 },
  subtitulo: { textAlign: 'center', color: 'var(--gris)', fontSize: 12, marginBottom: 28 },
  linkOlvide: { display: 'block', width: '100%', marginTop: 12, padding: '8px', background: 'none', border: 'none', color: 'var(--primario)', fontSize: 13, cursor: 'pointer', textAlign: 'center' },
  footer: { marginTop: 20 },
  divider: { height: 1, background: 'var(--borde)', margin: '16px 0' }
                }
