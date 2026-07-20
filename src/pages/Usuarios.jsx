import { useEffect, useState } from 'react'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ROLES = ['ADMIN', 'SUPERVISOR', 'COMERCIAL', 'INSPECTOR', 'FACTURACION', 'AUDITOR']
const SEDES = ['SCL', 'ANF', 'CCP']

const BADGE_ROL = {
  ADMIN:       'badge-red',
  SUPERVISOR:  'badge-amber',
  COMERCIAL:   'badge-blue',
  INSPECTOR:   'badge-green',
  FACTURACION: 'badge-gray',
  AUDITOR:     'badge-purple',
}

export default function Usuarios() {
  const { esAdmin } = useAuth()
  const [usuarios, setUsuarios]       = useState([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState('')
  const [busqueda, setBusqueda]       = useState('')
  const [editando, setEditando]       = useState(null)   // usuario en edición
  const [guardando, setGuardando]     = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [desactivando, setDesactivando] = useState(null)
  // Crear usuario
  const NUEVO_VACIO = { nombre:'', apellido:'', email:'', password:'', rol:'INSPECTOR', sede:'SCL', telefono_whatsapp:'' }
  const [creando, setCreando]           = useState(false)
  const [nuevoU, setNuevoU]             = useState(NUEVO_VACIO)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorCrear, setErrorCrear]     = useState('')
  const [verPass, setVerPass]           = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setCargando(true)
      setError('')
      const { data, error: err } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, email, rol, sede, activo, telefono_whatsapp, nivel_snt')
        .order('nombre')
      if (err) throw err
      setUsuarios(data || [])
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }

  async function guardar() {
    if (!editando) return
    try {
      setGuardando(true)
      const { error: err } = await supabase
        .from('usuarios')
        .update({
          nombre:              editando.nombre?.trim(),
          apellido:            editando.apellido?.trim(),
          email:               editando.email?.trim().toLowerCase(),
          rol:                 editando.rol,
          sede:                editando.sede,
          activo:              editando.activo,
          telefono_whatsapp:   editando.telefono_whatsapp?.trim() || null,
          nivel_snt:           editando.nivel_snt || null,
        })
        .eq('id', editando.id)
      if (err) throw err
      setMensajeExito(`✅ ${editando.nombre} actualizado correctamente`)
      setEditando(null)
      cargar()
      setTimeout(() => setMensajeExito(''), 4000)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  async function handleCrearUsuario() {
    setErrorCrear('')
    if (!nuevoU.nombre.trim() || !nuevoU.email.trim() || !nuevoU.password || !nuevoU.rol) {
      setErrorCrear('Nombre, email, contraseña y rol son requeridos'); return
    }
    if (nuevoU.password.length < 8) {
      setErrorCrear('La contraseña debe tener al menos 8 caracteres'); return
    }
    try {
      setGuardandoNuevo(true)
      const resp = await fetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoU),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error al crear usuario')
      setMensajeExito(`✅ Usuario ${nuevoU.nombre} creado correctamente`)
      setCreando(false)
      setNuevoU(NUEVO_VACIO)
      cargar()
      setTimeout(() => setMensajeExito(''), 4000)
    } catch (e) {
      setErrorCrear(e.message)
    } finally {
      setGuardandoNuevo(false)
    }
  }

  async function toggleActivo(u) {
    if (!window.confirm(u.activo
      ? `¿Desactivar a ${u.nombre} ${u.apellido || ''}? No podrá iniciar sesión ni aparecerá en listas.`
      : `¿Reactivar a ${u.nombre} ${u.apellido || ''}?`
    )) return
    try {
      setDesactivando(u.id)
      const { error: err } = await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id)
      if (err) throw err
      setMensajeExito(`✅ ${u.nombre} ${u.activo ? 'desactivado' : 'reactivado'} correctamente`)
      cargar()
      setTimeout(() => setMensajeExito(''), 4000)
    } catch (e) { setError(mensajeError(e)) }
    finally { setDesactivando(null) }
  }

  const filtrados = usuarios.filter(u => {
    if (!mostrarInactivos && !u.activo) return false
    const q = busqueda.toLowerCase()
    return !q || [u.nombre, u.apellido, u.email, u.rol, u.sede]
      .some(v => String(v || '').toLowerCase().includes(q))
  })

  if (!esAdmin()) {
    return (
      <div className="alert alert-error" style={{ marginTop: 24 }}>
        No tienes permiso para ver esta sección.
      </div>
    )
  }

  return (
    <div>
      {/* Modal crear usuario */}
      {creando && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 17 }}>➕ Nuevo Usuario</h2>
              <button onClick={() => { setCreando(false); setNuevoU(NUEVO_VACIO); setErrorCrear('') }} style={S.btnX} disabled={guardandoNuevo}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              {errorCrear && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorCrear}</div>}
              <div className="grid">
                <div className="col-6 field">
                  <label>Nombre *</label>
                  <input className="input" value={nuevoU.nombre}
                    onChange={e => setNuevoU(u => ({ ...u, nombre: e.target.value }))} />
                </div>
                <div className="col-6 field">
                  <label>Apellido</label>
                  <input className="input" value={nuevoU.apellido}
                    onChange={e => setNuevoU(u => ({ ...u, apellido: e.target.value }))} />
                </div>
                <div className="col-6 field">
                  <label>Email *</label>
                  <input className="input" type="email" value={nuevoU.email}
                    onChange={e => setNuevoU(u => ({ ...u, email: e.target.value }))} />
                </div>
                <div className="col-6 field">
                  <label>Contraseña * (mín. 8 caracteres)</label>
                  <div style={{ display:'flex', gap:6 }}>
                    <input className="input" type={verPass ? 'text' : 'password'}
                      value={nuevoU.password} style={{ flex:1 }}
                      onChange={e => setNuevoU(u => ({ ...u, password: e.target.value }))} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVerPass(v => !v)}>
                      {verPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                <div className="col-6 field">
                  <label>WhatsApp</label>
                  <input className="input" placeholder="+56912345678"
                    value={nuevoU.telefono_whatsapp}
                    onChange={e => setNuevoU(u => ({ ...u, telefono_whatsapp: e.target.value }))} />
                </div>
                <div className="col-2 field">
                  <label>Rol *</label>
                  <select className="select" value={nuevoU.rol}
                    onChange={e => setNuevoU(u => ({ ...u, rol: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="col-2 field">
                  <label>Sede *</label>
                  <select className="select" value={nuevoU.sede}
                    onChange={e => setNuevoU(u => ({ ...u, sede: e.target.value }))}>
                    {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16, borderTop:'1px solid var(--borde)', paddingTop:16 }}>
                <button className="btn btn-ghost" onClick={() => { setCreando(false); setNuevoU(NUEVO_VACIO); setErrorCrear('') }} disabled={guardandoNuevo}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleCrearUsuario} disabled={guardandoNuevo}>
                  {guardandoNuevo ? 'Creando...' : '✓ Crear usuario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal edición */}
      {editando && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 17 }}>Editar Usuario</h2>
              <button onClick={() => setEditando(null)} style={S.btnX} disabled={guardando}>✕</button>
            </div>
            <div style={{ padding: 24 }}>

              <div className="grid">
                <div className="col-6 field">
                  <label>Nombre *</label>
                  <input className="input" value={editando.nombre || ''}
                    onChange={e => setEditando(u => ({ ...u, nombre: e.target.value }))} />
                </div>
                <div className="col-6 field">
                  <label>Apellido</label>
                  <input className="input" value={editando.apellido || ''}
                    onChange={e => setEditando(u => ({ ...u, apellido: e.target.value }))} />
                </div>
                <div className="col-6 field">
                  <label>Email *</label>
                  <input className="input" type="email" value={editando.email || ''}
                    onChange={e => setEditando(u => ({ ...u, email: e.target.value }))} />
                </div>
                <div className="col-6 field">
                  <label>WhatsApp</label>
                  <input className="input" placeholder="+56 9 XXXX XXXX"
                    value={editando.telefono_whatsapp || ''}
                    onChange={e => setEditando(u => ({ ...u, telefono_whatsapp: e.target.value }))} />
                  <span className="text-sm">Formato: +56912345678 (sin espacios)</span>
                </div>
                <div className="col-4 field">
                  <label>Rol *</label>
                  <select className="select" value={editando.rol || ''}
                    onChange={e => setEditando(u => ({ ...u, rol: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="col-4 field">
                  <label>Sede *</label>
                  <select className="select" value={editando.sede || ''}
                    onChange={e => setEditando(u => ({ ...u, sede: e.target.value }))}>
                    {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-4 field">
                  <label>Estado</label>
                  <select className="select" value={editando.activo ? 'activo' : 'inactivo'}
                    onChange={e => setEditando(u => ({ ...u, activo: e.target.value === 'activo' }))}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                <div className="col-4 field">
                  <label>Nivel SNT-TC-1A</label>
                  <select className="select" value={editando.nivel_snt || ''}
                    onChange={e => setEditando(u => ({ ...u, nivel_snt: e.target.value || null }))}>
                    <option value="">— No aplica —</option>
                    <option value="I">Nivel I</option>
                    <option value="II">Nivel II</option>
                    <option value="III">Nivel III</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, borderTop: '1px solid var(--borde)', paddingTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setEditando(null)} disabled={guardando}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : '✓ Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h1>Usuarios</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            {filtrados.length} usuario{filtrados.length !== 1 ? 's' : ''} registrados
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#64748B', cursor:'pointer' }}>
            <input type="checkbox" checked={mostrarInactivos} onChange={e => setMostrarInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
          <button className="btn btn-primary btn-sm" onClick={() => { setCreando(true); setErrorCrear('') }}>
            + Nuevo usuario
          </button>
          <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
        </div>
      </div>

      {/* Éxito */}
      {mensajeExito && (
        <div className="alert alert-ok" style={{ marginBottom: 16 }}>{mensajeExito}</div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-secondary btn-sm" onClick={cargar} style={{ marginLeft: 12 }}>Reintentar</button>
        </div>
      )}

      {/* Filtro */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <input className="input" placeholder="Buscar por nombre, email, rol, sede..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ maxWidth: 400 }} />
      </div>

      {/* Loading */}
      {cargando && <div className="loading-bar" style={{ marginBottom: 16 }} />}

      {/* Tabla */}
      {!cargando && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>WhatsApp</th>
                <th>Rol</th>
                <th>Sede</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gris)', padding: 32 }}>
                  No hay usuarios
                </td></tr>
              ) : filtrados.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.nombre} {u.apellido}</div>
                    {u.nivel_snt && (
                      <span style={{ fontSize:10, background:'#EDE9FE', color:'#5B21B6', padding:'1px 7px', borderRadius:10, fontWeight:700 }}>
                        SNT Nv.{u.nivel_snt}
                      </span>
                    )}
                  </td>
                  <td>
                    {u.email
                      ? <span style={{ fontSize: 13 }}>{u.email}</span>
                      : <span style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>⚠ Sin email</span>
                    }
                  </td>
                  <td>
                    {u.telefono_whatsapp
                      ? <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{u.telefono_whatsapp}</span>
                      : <span style={{ color: '#DC2626', fontSize: 12, fontWeight: 600 }}>⚠ Sin teléfono</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${BADGE_ROL[u.rol] || 'badge-gray'}`}>{u.rol}</span>
                  </td>
                  <td>
                    <span className="badge badge-blue">{u.sede}</span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 12,
                      background: u.activo ? '#D1FAE5' : '#FEE2E2',
                      color: u.activo ? '#065F46' : '#991B1B',
                    }}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditando({ ...u })}>
                        ✏ Editar
                      </button>
                      <button
                        className="btn btn-sm"
                        disabled={desactivando === u.id}
                        onClick={() => toggleActivo(u)}
                        style={{
                          background: u.activo ? '#FEE2E2' : '#D1FAE5',
                          color: u.activo ? '#991B1B' : '#065F46',
                          border: 'none', cursor:'pointer', borderRadius:6,
                          padding:'4px 10px', fontSize:12, fontWeight:600,
                        }}
                      >
                        {desactivando === u.id ? '...' : u.activo ? '✕ Desactivar' : '✓ Reactivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,.6)',
    zIndex: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%', maxWidth: 620,
    background: '#fff', borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    background: 'linear-gradient(135deg, #0E2A45, #17395C)',
    padding: '16px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  btnX: {
    background: 'rgba(255,255,255,.15)', border: 'none',
    color: '#fff', width: 32, height: 32,
    borderRadius: 8, fontSize: 14, cursor: 'pointer',
  },
}
