import { useEffect, useState } from 'react'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ROLES = ['ADMIN', 'COMERCIAL', 'SUPERVISOR', 'INSPECTOR', 'FACTURACION']
const SEDES = ['SCL', 'ANF', 'CCP']

export default function Usuarios() {
  const { esAdmin, usuario: usuarioActual } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [modalUsuario, setModalUsuario] = useState(null) // null=cerrado, {}=nuevo, {data}=editar
  const [mensajeExito, setMensajeExito] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setCargando(true)
      const { data, error: err } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, email, rol, sede, activo, cargo, telefono_whatsapp, created_at')
        .order('nombre')
      if (err) throw err
      setUsuarios(data || [])
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  const filtrados = usuarios.filter(u => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return [u.nombre, u.apellido, u.email, u.rol, u.sede]
      .some(v => String(v || '').toLowerCase().includes(q))
  })

  async function toggleActivo(u) {
    if (!esAdmin()) return
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !u.activo })
      .eq('id', u.id)
    if (!error) {
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo } : x))
      mostrarExito(`Usuario ${u.activo ? 'desactivado' : 'activado'} correctamente`)
    }
  }

  function mostrarExito(msg) {
    setMensajeExito(msg)
    setTimeout(() => setMensajeExito(''), 3000)
  }

  if (!esAdmin()) {
    return <div className="alert alert-error">Solo el administrador puede acceder a esta sección.</div>
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h1>Gestión de Usuarios</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>{filtrados.length} usuario{filtrados.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setModalUsuario({})}>+ Nuevo usuario</button>
        </div>
      </div>

      {mensajeExito && <div className="alert alert-ok" style={{ marginBottom: 16 }}>{mensajeExito}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
        <input className="input" placeholder="Buscar por nombre, email, rol, sede..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {cargando && <div className="loading-bar" style={{ marginBottom: 16 }} />}

      {!cargando && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Sede</th>
                <th>Cargo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.nombre} {u.apellido}</div>
                    {u.telefono_whatsapp && <div className="text-sm">📱 {u.telefono_whatsapp}</div>}
                  </td>
                  <td className="text-sm">{u.email || '—'}</td>
                  <td><span className="badge badge-blue">{u.rol}</span></td>
                  <td><span className="badge badge-gray">{u.sede}</span></td>
                  <td className="text-sm">{u.cargo || '—'}</td>
                  <td>
                    <span className={`badge ${u.activo ? 'badge-green' : 'badge-red'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-secondary btn-sm" onClick={() => setModalUsuario(u)}>
                        ✏ Editar
                      </button>
                      {u.id !== usuarioActual?.id && (
                        <button
                          className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-ghost'}`}
                          onClick={() => toggleActivo(u)}>
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalUsuario !== null && (
        <ModalUsuario
          usuario={modalUsuario.id ? modalUsuario : null}
          onClose={() => setModalUsuario(null)}
          onGuardado={() => {
            setModalUsuario(null)
            cargar()
            mostrarExito('Usuario guardado correctamente')
          }}
        />
      )}
    </div>
  )
}

function ModalUsuario({ usuario, onClose, onGuardado }) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre: usuario?.nombre || '',
    apellido: usuario?.apellido || '',
    email: usuario?.email || '',
    telefono_whatsapp: usuario?.telefono_whatsapp || '',
    cargo: usuario?.cargo || '',
    rol: usuario?.rol || 'INSPECTOR',
    sede: usuario?.sede || 'SCL',
  })

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (error) setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.email.trim()) { setError('El email es obligatorio'); return }

    try {
      setGuardando(true)
      setError('')

      if (usuario?.id) {
        // Editar
        const { error: err } = await supabase
          .from('usuarios')
          .update({
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            email: form.email.trim().toLowerCase(),
            telefono_whatsapp: form.telefono_whatsapp.trim() || null,
            cargo: form.cargo.trim() || null,
            rol: form.rol,
            sede: form.sede,
          })
          .eq('id', usuario.id)
        if (err) throw err
      } else {
        // Crear
        const { error: err } = await supabase
          .from('usuarios')
          .insert({
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            email: form.email.trim().toLowerCase(),
            telefono_whatsapp: form.telefono_whatsapp.trim() || null,
            cargo: form.cargo.trim() || null,
            rol: form.rol,
            sede: form.sede,
            activo: true,
          })
        if (err) throw err
      }

      onGuardado()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 600, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #0E2A45, #17395C)', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 18 }}>{usuario?.id ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="grid">
              <div className="col-6 field">
                <label>Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-6 field">
                <label>Apellido</label>
                <input className="input" value={form.apellido} onChange={e => set('apellido', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-6 field">
                <label>Email *</label>
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-6 field">
                <label>Teléfono WhatsApp</label>
                <input className="input" placeholder="+56 9 XXXX XXXX" value={form.telefono_whatsapp} onChange={e => set('telefono_whatsapp', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-6 field">
                <label>Cargo</label>
                <input className="input" placeholder="Ej: Inspector END" value={form.cargo} onChange={e => set('cargo', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-3 field">
                <label>Rol</label>
                <select className="select" value={form.rol} onChange={e => set('rol', e.target.value)} disabled={guardando}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-3 field">
                <label>Sede</label>
                <select className="select" value={form.sede} onChange={e => set('sede', e.target.value)} disabled={guardando}>
                  {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {!usuario?.id && (
              <div className="alert alert-info" style={{ margin: '16px 0' }}>
                ⚠ Después de crear el usuario, debes ir a <strong>Supabase → Authentication → Users</strong> y crear la contraseña para que pueda iniciar sesión.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid var(--borde)', marginTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Guardando...</> : '✓ Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
