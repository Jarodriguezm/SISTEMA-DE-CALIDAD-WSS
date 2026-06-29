import { useState, useEffect } from 'react'
import { rpc, supabase, mensajeError } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const SEDES = [
  { value: 'SCL', label: 'SCL — Santiago' },
  { value: 'ANF', label: 'ANF — Antofagasta' },
  { value: 'CCP', label: 'CCP — Concepción' },
]

const MESES = [
  '01 - Enero', '02 - Febrero', '03 - Marzo', '04 - Abril',
  '05 - Mayo', '06 - Junio', '07 - Julio', '08 - Agosto',
  '09 - Septiembre', '10 - Octubre', '11 - Noviembre', '12 - Diciembre'
]

const SERVICIOS = [
  { cod: 'VT',  nombre: 'Inspección Visual' },
  { cod: 'PT',  nombre: 'Líquidos Penetrantes' },
  { cod: 'MT',  nombre: 'Partículas Magnéticas' },
  { cod: 'UT',  nombre: 'Ultrasonido' },
  { cod: 'UTT', nombre: 'Medición Espesores' },
  { cod: 'PAUT',nombre: 'Ultrasonido Phased Array' },
  { cod: 'T',   nombre: 'Termografía' },
  { cod: 'CG',  nombre: 'Cert. Grúas/Izaje' },
  { cod: 'CTK', nombre: 'Insp. Tanques' },
  { cod: 'PH',  nombre: 'Prueba Hidrostática' },
  { cod: 'PN',  nombre: 'Prueba Neumática' },
  { cod: 'CV',  nombre: 'Ensayo de Vacío' },
  { cod: 'END', nombre: 'END General' },
  { cod: 'O',   nombre: 'Otros' },
]

function mesActual()  { return String(new Date().getMonth() + 1).padStart(2, '0') }
function anioActual() { return String(new Date().getFullYear()) }

export default function ModalCrearOT({ onClose, onCreada }) {
  const { usuario } = useAuth()
  const [guardando, setGuardando] = useState(false)
  const [mensajePaso, setMensajePaso] = useState('')   // texto durante carga
  const [error, setError] = useState('')
  const [supervisores, setSupervisores] = useState([])
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([])

  const [form, setForm] = useState({
    ot_numero: '',
    cliente: '',
    contacto: '',
    email_cliente: '',
    telefono_cliente: '',
    rut_empresa: '',
    sede: 'SCL',
    mes: mesActual(),
    anio: anioActual(),
    referencia_cotizacion: '',
    tipo_servicio: '',
    direccion_faena: '',
    descripcion: '',
    supervisor_id: '',
    observaciones: '',
  })

  useEffect(() => { cargarSupervisores() }, [])

  async function cargarSupervisores() {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, sede')
        .eq('activo', true)
        .in('rol', ['SUPERVISOR', 'ADMIN', 'ADMINISTRADOR'])
        .order('nombre')
      setSupervisores(data || [])
    } catch { /* no bloquea */ }
  }

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (error) setError('')
  }

  function toggleServicio(cod) {
    setServiciosSeleccionados(prev =>
      prev.includes(cod) ? prev.filter(s => s !== cod) : [...prev, cod]
    )
  }

  function validar() {
    if (!form.ot_numero.trim()) return 'Ingresa el N° de OT'
    if (!/^OT[A-Z0-9]+$/i.test(form.ot_numero.trim())) return 'El N° OT debe comenzar con OT (ej: OT062628700)'
    if (!form.cliente.trim()) return 'Ingresa el nombre del cliente'
    if (!form.tipo_servicio.trim()) return 'Ingresa el producto / servicio contratado'
    if (!form.descripcion.trim()) return 'Ingresa la descripción del trabajo'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validar()
    if (err) { setError(err); return }

    try {
      setGuardando(true)
      setError('')
      setMensajePaso('Creando Orden de Trabajo...')

      // Nombre del supervisor si se seleccionó
      let supervisorNombre = ''
      if (form.supervisor_id) {
        const sup = supervisores.find(s => s.id === form.supervisor_id)
        if (sup) supervisorNombre = `${sup.nombre} ${sup.apellido}`.trim()
      }

      const otNumero = form.ot_numero.trim().toUpperCase()

      // ── Paso 1: Crear OT en Supabase ──────────────────────────────────────
      await rpc('crear_ot_portal', {
        p_email_usuario:                usuario?.email || '',
        p_ot_numero:                    otNumero,
        p_cliente:                      form.cliente.trim(),
        p_contacto:                     form.contacto.trim() || null,
        p_email_cliente:                form.email_cliente.trim() || null,
        p_telefono_cliente:             form.telefono_cliente.trim() || null,
        p_rut_empresa:                  form.rut_empresa.trim() || null,
        p_sede:                         form.sede,
        p_referencia_cotizacion:        form.referencia_cotizacion.trim() || null,
        p_producto_servicio_contratado: form.tipo_servicio.trim(),
        p_servicios_seleccionados:      serviciosSeleccionados.join(', ') || null,
        p_direccion_faena:              form.direccion_faena.trim() || null,
        p_descripcion:                  form.descripcion.trim() || null,
        p_observaciones:                form.observaciones.trim() || null,
      })

      // ── Paso 2: Crear carpetas en Google Drive ────────────────────────────
      setMensajePaso('Creando carpetas en Google Drive... 📁')

      try {
        const driveRes = await fetch('/api/drive/crear-carpetas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ot_numero: otNumero,
            cliente:   form.cliente.trim(),
            sede:      form.sede,
            anio:      Number(form.anio),
            mes:       Number(form.mes),
          }),
        })

        const driveData = await driveRes.json()

        if (driveData.ok && driveData.carpeta_ot_url) {
          // Guardar URL y subcarpetas en la OT
          await supabase
            .from('ots')
            .update({
              carpeta_drive_url: driveData.carpeta_ot_url,
              carpetas_drive:    driveData.subcarpetas,
            })
            .eq('ot_numero', otNumero)

          setMensajePaso('✅ OT creada con carpetas Drive')
        } else {
          // Drive falló pero OT fue creada — no es fatal
          console.warn('[ModalCrearOT] Drive error (no fatal):', driveData.error)
          setMensajePaso('OT creada — carpetas Drive pendientes')
        }
      } catch (driveErr) {
        // Error de red al llamar Drive — no bloquea
        console.warn('[ModalCrearOT] Drive network error:', driveErr.message)
      }

      // ── Éxito ──────────────────────────────────────────────────────────────
      onCreada && onCreada(otNumero)

    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
      setMensajePaso('')
    }
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.box}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 18 }}>Nueva Orden de Trabajo</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
              World Survey Services S.A. · División Inspección Industrial
            </p>
          </div>
          <button onClick={onClose} style={styles.btnCerrar} disabled={guardando}>✕</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Sección 1 — Identificación */}
            <Seccion titulo="Identificación de la OT">
              <div className="grid">
                <div className="col-4 field">
                  <label>N° OT *</label>
                  <input className="input" placeholder="OT062628700"
                    value={form.ot_numero}
                    onChange={e => set('ot_numero', e.target.value.toUpperCase())}
                    disabled={guardando} autoFocus />
                  <span className="text-sm">Formato: OT + números</span>
                </div>
                <div className="col-4 field">
                  <label>Sede *</label>
                  <select className="select" value={form.sede} onChange={e => set('sede', e.target.value)} disabled={guardando}>
                    {SEDES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="col-4 field">
                  <label>Mes</label>
                  <select className="select" value={form.mes} onChange={e => set('mes', e.target.value)} disabled={guardando}>
                    {MESES.map((m, i) => {
                      const v = String(i + 1).padStart(2, '0')
                      return <option key={v} value={v}>{m}</option>
                    })}
                  </select>
                </div>
              </div>
            </Seccion>

            {/* Sección 2 — Cliente */}
            <Seccion titulo="Datos del cliente">
              <div className="grid">
                <div className="col-6 field">
                  <label>Cliente *</label>
                  <input className="input" placeholder="Razón social"
                    value={form.cliente} onChange={e => set('cliente', e.target.value)} disabled={guardando} />
                </div>
                <div className="col-6 field">
                  <label>Contacto</label>
                  <input className="input" placeholder="Nombre del contacto"
                    value={form.contacto} onChange={e => set('contacto', e.target.value)} disabled={guardando} />
                </div>
                <div className="col-4 field">
                  <label>Email cliente</label>
                  <input className="input" type="email" placeholder="cliente@empresa.cl"
                    value={form.email_cliente} onChange={e => set('email_cliente', e.target.value)} disabled={guardando} />
                </div>
                <div className="col-4 field">
                  <label>Teléfono</label>
                  <input className="input" placeholder="+56 9 XXXX XXXX"
                    value={form.telefono_cliente} onChange={e => set('telefono_cliente', e.target.value)} disabled={guardando} />
                </div>
                <div className="col-4 field">
                  <label>RUT empresa</label>
                  <input className="input" placeholder="XX.XXX.XXX-X"
                    value={form.rut_empresa} onChange={e => set('rut_empresa', e.target.value)} disabled={guardando} />
                </div>
              </div>
            </Seccion>

            {/* Sección 3 — Servicio */}
            <Seccion titulo="Servicio contratado">
              <div className="grid">
                <div className="col-6 field">
                  <label>Producto / Servicio contratado *</label>
                  <input className="input"
                    placeholder="Ej: Inspección END mediante UT para 8 ejes de ferrocarril"
                    value={form.tipo_servicio} onChange={e => set('tipo_servicio', e.target.value)} disabled={guardando} />
                  <span className="text-sm">Este dato va en PRODUCTO de la planilla ESI/EAI</span>
                </div>
                <div className="col-6 field">
                  <label>Referencia cotización</label>
                  <input className="input" placeholder="COT-2026-089"
                    value={form.referencia_cotizacion} onChange={e => set('referencia_cotizacion', e.target.value)} disabled={guardando} />
                </div>
                <div className="col-12 field">
                  <label>Técnicas / tipos de inspección</label>
                  <div style={styles.serviciosGrid}>
                    {SERVICIOS.map(s => (
                      <label key={s.cod} style={{
                        ...styles.pillCheck,
                        background: serviciosSeleccionados.includes(s.cod) ? '#17395C' : '#fff',
                        color: serviciosSeleccionados.includes(s.cod) ? '#fff' : '#344054',
                        borderColor: serviciosSeleccionados.includes(s.cod) ? '#17395C' : '#D0D5DD',
                      }}>
                        <input
                          type="checkbox"
                          style={{ display: 'none' }}
                          checked={serviciosSeleccionados.includes(s.cod)}
                          onChange={() => toggleServicio(s.cod)}
                          disabled={guardando}
                        />
                        <span style={{ fontWeight: 700 }}>{s.cod}</span>
                        <span style={{ fontSize: 11, opacity: .8 }}>{s.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="col-12 field">
                  <label>Dirección / Faena</label>
                  <input className="input" placeholder="Ej: Av. El Salto 3000, Planta Norte, Codelco Chuquicamata"
                    value={form.direccion_faena} onChange={e => set('direccion_faena', e.target.value)} disabled={guardando} />
                </div>
                <div className="col-12 field">
                  <label>Descripción del trabajo *</label>
                  <textarea className="input" rows={4} style={{ resize: 'vertical' }}
                    placeholder="Describir alcance, elementos a inspeccionar, normas aplicables, condiciones especiales..."
                    value={form.descripcion} onChange={e => set('descripcion', e.target.value)} disabled={guardando} />
                </div>
              </div>
            </Seccion>

            {/* Sección 4 — Asignación */}
            <Seccion titulo="Asignación inicial">
              <div className="grid">
                <div className="col-4 field">
                  <label>Comercial responsable</label>
                  <input className="input" value={usuario?.nombre || ''} readOnly style={{ background: '#F9FAFB' }} />
                </div>
                <div className="col-4 field">
                  <label>Supervisor (opcional)</label>
                  <select className="select" value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)} disabled={guardando}>
                    <option value="">— Sin asignar aún —</option>
                    {supervisores.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} {s.apellido} · {s.sede}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4 field">
                  <label>Observaciones</label>
                  <input className="input" placeholder="Observaciones adicionales"
                    value={form.observaciones} onChange={e => set('observaciones', e.target.value)} disabled={guardando} />
                </div>
              </div>
            </Seccion>

            {/* Info Drive */}
            <div style={{
              background: '#E6F1FB', border: '1px solid #85B7EB',
              borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#185FA5', marginBottom: 16,
            }}>
              📁 Al guardar se crearán automáticamente <b>13 carpetas en Google Drive</b>:
              la carpeta de la OT + las 12 etapas del proceso WSS.
            </div>

            {/* Footer */}
            <div style={styles.footer}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={guardando}>
                {guardando ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    {mensajePaso || 'Procesando...'}
                  </>
                ) : '✓ Crear OT'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--azul)',
        textTransform: 'uppercase', letterSpacing: '.5px',
        borderBottom: '2px solid var(--azul)', paddingBottom: 6, marginBottom: 14
      }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,.6)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px 16px',
    overflowY: 'auto',
  },
  box: {
    width: '100%',
    maxWidth: 860,
    background: '#fff',
    borderRadius: 18,
    boxShadow: '0 24px 80px rgba(0,0,0,.3)',
    overflow: 'hidden',
    marginBottom: 24,
  },
  header: {
    background: 'linear-gradient(135deg, #0E2A45, #17395C)',
    padding: '18px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btnCerrar: {
    background: 'rgba(255,255,255,.15)',
    border: 'none',
    color: '#fff',
    width: 32, height: 32,
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
  },
  body: {
    padding: '24px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 16,
    borderTop: '1px solid var(--borde)',
    marginTop: 8,
  },
  serviciosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
  },
  pillCheck: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 12px',
    border: '1.5px solid',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all .15s',
    userSelect: 'none',
  },
}
