import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) {
      setError('Ingresa tu correo y contraseña')
      return
    }
    try {
      setCargando(true)
      setError('')
      await login(email, password)
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>

        {/* Logo y marca */}
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

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
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
            {cargando ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Ingresando...</> : 'Ingresar al portal'}
          </button>
        </form>

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
  bg: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0E2A45 0%, #17395C 50%, #1E4D7B 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px'
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 24px 80px rgba(0,0,0,.3)'
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20
  },
  logo: {
    maxWidth: 240,
    height: 'auto'
  },
  titulo: {
    textAlign: 'center',
    marginBottom: 4,
    fontSize: 22
  },
  subtitulo: {
    textAlign: 'center',
    color: 'var(--gris)',
    fontSize: 12,
    marginBottom: 28
  },
  footer: {
    marginTop: 20
  },
  divider: {
    height: 1,
    background: 'var(--borde)',
    margin: '16px 0'
  }
}
