import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  // Supabase procesa el token del URL automáticamente al cargar.
  // No necesitamos hacer nada extra; updateUser() funciona con esa sesión.
  useEffect(() => {
    // Si no hay hash de recovery (acceso directo sin token), volver al login
    const hash = window.location.hash
    if (!hash.includes('type=recovery') && !hash.includes('access_token')) {
      // Esperar un momento por si Supabase ya procesó el token
      const timer = setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) navigate('/login', { replace: true })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    try {
      setCargando(true)
      setError('')
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setListo(true)
      // Cerrar sesión y redirigir al login
      await supabase.auth.signOut()
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      setError(err.message || 'Error al actualizar la contraseña')
    } finally {
      setCargando(false)
    }
  }

  if (listo) {
    return (
      <div style={bgStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img
              src="/assets/wss-logo-horizontal-transparent.png"
              alt="WSS"
              style={{ maxWidth: 220, maxHeight: 70, objectFit: 'contain' }}
              onError={e => { e.target.src = '/assets/wss-logo-square-512.png'; e.target.style.maxHeight = '60px' }}
            />
          </div>
          <div style={{ textAlign: 'center', fontSize: 52, marginBottom: 12 }}>✅</div>
          <h2 style={{ textAlign: 'center', marginBottom: 8 }}>¡Contraseña actualizada!</h2>
          <p style={{ textAlign: 'center', color: 'var(--gris)', fontSize: 14 }}>
            Tu contraseña fue actualizada correctamente.<br />
            Redirigiendo al login en unos segundos...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={bgStyle}>
      <div style={cardStyle}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <img
            src="/assets/wss-logo-horizontal-transparent.png"
            alt="WSS Testing & Certification Chile"
            style={{ maxWidth: 260, maxHeight: 80, objectFit: 'contain' }}
            onError={e => { e.target.src = '/assets/wss-logo-square-512.png'; e.target.style.maxHeight = '70px' }}
          />
        </div>

        <h1 style={{ textAlign: 'center', fontSize: 22, marginBottom: 6 }}>Nueva contraseña</h1>
        <p style={{ textAlign: 'center', color: 'var(--gris)', fontSize: 13, marginBottom: 28 }}>
          Ingresa y confirma tu nueva contraseña de acceso al portal
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Nueva contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              disabled={cargando}
            />
          </div>

          <div className="field" style={{ marginBottom: 22 }}>
            <label>Confirmar contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Actualizando...</>
              : 'Actualizar contraseña'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: 'none', color: 'var(--azul)',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Volver al login
          </button>
        </div>
      </div>
    </div>
  )
}

const bgStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0E2A45 0%, #17395C 50%, #1E4D7B 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 16px',
}

const cardStyle = {
  background: '#fff',
  borderRadius: 20,
  padding: '40px 36px',
  width: '100%',
  maxWidth: 420,
  boxShadow: '0 24px 80px rgba(0,0,0,.3)',
}
