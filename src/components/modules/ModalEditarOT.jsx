import { useState, useEffect } from 'react'
import { rpc, supabase, mensajeError } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const SEDES = [
  { value: 'SCL', label: 'SCL — Santiago' },
  { value: 'ANF', label: 'ANF — Antofagasta' },
  { value: 'CCP', label: 'CCP — Concepción' },
]

const SERVICIOS = [
  { cod: 'VT', nombre: 'Inspección Visual' },
  { cod: 'PT', nombre: 'Líquidos Penetrantes' },
  { cod: 'MT', nombre: 'Partículas Magnéticas' },
  { cod: 'UT', nombre: 'Ultrasonido' },
  { cod: 'UTT', nombre: 'Medición Espesores' },
  { cod: 'PAUT', nombre: 'Ultrasonido Phased Array' },
  { cod: 'T', nombre: 'Termografía' },
  { cod: 'CG', nombre: 'Cert. Grúas/Izaje' },
  { cod: 'CTK', nombre: 'Insp. Tanques' },
  { cod: 'PH', nombre: 'Prueba Hidrostática' },
  { cod: 'PN', nombre: 'Prueba Neumática' },
  { cod: 'CV', nombre: 'Ensayo de Vacío' },
  { cod: 'END', nombre: 'END General' },
  { cod: 'O', nombre: 'Otros' },
]

export default function ModalEditarOT({ ot, onClose, onGuardada }) {
  const { usuario } = useAuth()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([])

  const [form, setForm] = useState({
    cliente: '',
    contacto: '',
    email_cliente: '',
    telefono_cliente: '',
    rut_empresa: '',
    sede: 'SCL',
    referencia_cotizacion: '',
    producto_servicio_contratado: '',
    direccion_faena: '',
    descripcion: '',
    observaciones: '',
  })

  useEffect(() => {
    if (ot) {
      setForm({
        cliente:                      ot.cliente || '',
        contacto:                     ot.contacto || '',
        email_cliente:                ot.email_cliente || '',
        telefono_cliente:             ot.telefono_cliente || '',
        rut_empresa:                  ot.rut_empresa || '',
        sede:                         ot.sede || 'SCL',
        referencia_cotizacion:        ot.referencia_cotizacion || '',
        producto_servicio_contratado: ot.producto_servicio_contratado || '',
        direccion_faena:              ot.direccion_faena || '',
        descripcion:                  ot.descripcion || '',
        observaciones:                ot.observaciones || '',
      })
      if (ot.servicios_seleccionados) {
        setServiciosSeleccionados(
          ot.servicios_seleccionados.split(',').map(s => s.trim()).filter(Boolean)
        )
      }
    }
  }, [ot])

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (error) setError('')
  }

  function toggleServicio(cod) {
    setServiciosSeleccionados(prev =>
      prev.includes(cod) ? prev.filter(s => s !== cod) : [...prev, cod]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.cliente.trim()) { setError('El cliente es obligatorio'); return }
    if (!form.producto_servicio_contratado.trim()) { setError('El producto/servicio contratado es obligatorio'); return }

    try {
      setGuardando(true)
      setError('')

      await rpc('editar_ot_portal', {
        p_email_usuario:               usuario?.email || '',
        p_ot_numero:                   ot.ot_numero,
        p_cliente:                     form.cliente.trim(),
        p_contacto:                    form.contacto.trim() || null,
        p_email_cliente:               form.email_cliente.trim() || null,
        p_telefono_cliente:            form.telefono_cliente.trim() || null,
        p_rut_empresa:                 form.rut_empresa.trim() || null,
        p_sede:                        form.sede,
        p_referencia_cotizacion:       form.referencia_cotizacion.trim() || null,
        p_producto_servicio_contratado: form.producto_servicio_contratado.trim(),
        p_servicios_seleccionados:     serviciosSeleccionados.join(', ') || null,
        p_direccion_faena:             form.direccion_faena.trim() || null,
        p_descripcion:                 form.descripcion.trim() || null,
        p_observaciones:               form.observaciones.trim() || null,
      })

      onGuardada && onGuardada()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  if (!ot) return null

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.box}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 18 }}>Editar OT — {ot.ot_numero}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{ot.cliente}</p>
          </div>
          <button onClick={onClose} style={styles.btnCerrar} disabled={guardando}>✕</button>
        </div>

        <div style={styles.body}>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="grid">
              <div className="col-6 field">
                <label>Cliente *</label>
                <input className="input" value={form.cliente} onChange={e => set('cliente', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-6 field">
                <label>Sede</label>
                <select className="select" value={form.sede} onChange={e => set('sede', e.target.value)} disabled={guardando}>
                  {SEDES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="col-6 field">
                <label>Contacto</label>
                <input className="input" value={form.contacto} onChange={e => set('contacto', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-6 field">
                <label>Email cliente</label>
                <input className="input" type="email" value={form.email_cliente} onChange={e => set('email_cliente', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-4 field">
                <label>Teléfono</label>
                <input className="input" value={form.telefono_cliente} onChange={e => set('telefono_cliente', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-4 field">
                <label>RUT empresa</label>
                <input className="input" value={form.rut_empresa} onChange={e => set('rut_empresa', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-4 field">
                <label>Referencia cotización</label>
                <input className="input" value={form.referencia_cotizacion} onChange={e => set('referencia_cotizacion', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-12 field">
                <label>Producto / Servicio contratado *</label>
                <input className="input" value={form.producto_servicio_contratado} onChange={e => set('producto_servicio_contratado', e.target.value)} disabled={guardando} />
                <span className="text-sm">Este dato va en PRODUCTO de la planilla ESI/EAI</span>
              </div>
              <div className="col-12 field">
                <label>Técnicas de inspección</label>
                <div style={styles.serviciosGrid}>
                  {SERVICIOS.map(s => (
                    <label key={s.cod} style={{
                      ...styles.pillCheck,
                      background: serviciosSeleccionados.includes(s.cod) ? '#17395C' : '#fff',
                      color: serviciosSeleccionados.includes(s.cod) ? '#fff' : '#344054',
                      borderColor: serviciosSeleccionados.includes(s.cod) ? '#17395C' : '#D0D5DD',
                    }}>
                      <input type="checkbox" style={{ display: 'none' }}
                        checked={serviciosSeleccionados.includes(s.cod)}
                        onChange={() => toggleServicio(s.cod)} disabled={guardando} />
                      <span style={{ fontWeight: 700 }}>{s.cod}</span>
                      <span style={{ fontSize: 11, opacity: .8 }}>{s.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-12 field">
                <label>Dirección / Faena</label>
                <input className="input" value={form.direccion_faena} onChange={e => set('direccion_faena', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-12 field">
                <label>Descripción del trabajo</label>
                <textarea className="input" rows={4} style={{ resize: 'vertical' }}
                  value={form.descripcion} onChange={e => set('descripcion', e.target.value)} disabled={guardando} />
              </div>
              <div className="col-12 field">
                <label>Observaciones</label>
                <textarea className="input" rows={2} style={{ resize: 'vertical' }}
                  value={form.observaciones} onChange={e => set('observaciones', e.target.value)} disabled={guardando} />
              </div>
            </div>

            <div style={styles.footer}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={guardando}>
                {guardando ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Guardando...</> : '✓ Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' },
  box: { width: '100%', maxWidth: 860, background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(0,0,0,.3)', overflow: 'hidden', marginBottom: 24 },
  header: { background: 'linear-gradient(135deg, #0E2A45, #17395C)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  btnCerrar: { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  body: { padding: '24px', maxHeight: '80vh', overflowY: 'auto' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid var(--borde)', marginTop: 8 },
  serviciosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 },
  pillCheck: { display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', border: '1.5px solid', borderRadius: 10, cursor: 'pointer', transition: 'all .15s', userSelect: 'none' },
}
