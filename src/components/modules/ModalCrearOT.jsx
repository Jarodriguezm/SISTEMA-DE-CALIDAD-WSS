import { useState, useEffect, useRef } from 'react'
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
  const [mensajePaso, setMensajePaso] = useState('')
  const [error, setError] = useState('')
  const [supervisores, setSupervisores] = useState([])
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([])
  const [clienteOptions, setClienteOptions] = useState([])
  const [clienteSugerencias, setClienteSugerencias] = useState([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const clienteMapaRef = useRef({})
  const [exito, setExito] = useState(null)   // { otNumero, waUrl, emailUrl, supervisorNombre }

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

  useEffect(() => {
    supabase
      .from('ots')
      .select('cliente, contacto, email_cliente, telefono_cliente, rut_empresa')
      .not('cliente', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        // Guardar el registro más reciente por cliente (para autocompletar datos)
        const mapaClientes = {}
        ;(data || []).forEach(r => {
          if (r.cliente && !mapaClientes[r.cliente]) {
            mapaClientes[r.cliente] = {
              contacto:         r.contacto         || '',
              email_cliente:    r.email_cliente     || '',
              telefono_cliente: r.telefono_cliente  || '',
              rut_empresa:      r.rut_empresa       || '',
            }
          }
        })
        setClienteOptions(Object.keys(mapaClientes).sort())
        // Guardar el mapa en ref para usarlo al seleccionar
        clienteMapaRef.current = mapaClientes
      })
  }, [])

  async function cargarSupervisores() {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, sede, email, telefono_whatsapp')
        .eq('activo', true)
        .in('rol', ['SUPERVISOR', 'ADMIN'])
        .order('nombre')
      const lista = data || []
      setSupervisores(lista)
      // Pre-seleccionar el primer supervisor disponible
      if (lista.length > 0 && !form.supervisor_id) {
        setForm(f => ({ ...f, supervisor_id: lista[0].id }))
      }
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
    if (!form.supervisor_id) return 'Selecciona un supervisor para la OT'
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
          // Guardar URL y subcarpetas en la OT (crear-carpetas ya lo hizo en servidor,
          // esto es un respaldo desde el frontend)
          const { error: sbUpdateErr } = await supabase
            .from('ots')
            .update({
              carpeta_drive_url: driveData.carpeta_ot_url,
              carpetas_drive:    driveData.subcarpetas,
            })
            .eq('ot_numero', otNumero)

          if (sbUpdateErr) {
            console.error('[ModalCrearOT] Error guardando carpetas_drive en Supabase:', sbUpdateErr.message)
            // No es fatal porque crear-carpetas.js ya lo guardó en el servidor
          }

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

      // ── Éxito — generar links de notificación al supervisor ───────────────
      const sup = supervisores.find(s => s.id === form.supervisor_id)
      const supNombreCompleto = sup ? `${sup.nombre} ${sup.apellido}`.trim() : ''
      const servicios = [form.tipo_servicio, serviciosSeleccionados.join(', ')].filter(Boolean).join(' — ')

      // Guardar supervisor en la OT
      if (sup) {
        try {
          await supabase.from('ots').update({ supervisor: supNombreCompleto }).eq('ot_numero', otNumero)
        } catch { /* no bloquea */ }
      }

      // Link WhatsApp
      let waUrl = null
      if (sup?.telefono_whatsapp) {
        const tel = sup.telefono_whatsapp.replace(/\D/g, '')
        const msgWA = [
          `📋 *NUEVA OT CREADA*`,
          ``,
          `*OT:* ${otNumero}`,
          `*Cliente:* ${form.cliente.trim()}`,
          `*Sede:* ${form.sede}`,
          `*Servicio:* ${servicios}`,
          form.direccion_faena ? `*Dirección:* ${form.direccion_faena.trim()}` : null,
          ``,
          form.descripcion ? `*Descripción:*\n${form.descripcion.trim().substring(0, 300)}` : null,
          ``,
          `⚡ Acción requerida: asignar inspector en el portal WSS.`,
        ].filter(l => l !== null).join('\n')
        waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(msgWA)}`
        try {
          await supabase.from('ots').update({ whatsapp_supervisor_url: waUrl }).eq('ot_numero', otNumero)
        } catch { /* no bloquea */ }
      }

      // Link Email
      let emailUrl = null
      if (sup?.email) {
        const asunto = `Nueva OT creada: ${otNumero} — ${form.cliente.trim()}`
        const cuerpo = [
          `Hola ${sup.nombre},`,
          ``,
          `Se ha creado una nueva Orden de Trabajo que requiere tu gestión.`,
          ``,
          `OT: ${otNumero}`,
          `Cliente: ${form.cliente.trim()}`,
          `Sede: ${form.sede}`,
          `Servicio: ${servicios}`,
          form.direccion_faena ? `Dirección/Faena: ${form.direccion_faena.trim()}` : null,
          ``,
          form.descripcion ? `Descripción:\n${form.descripcion.trim().substring(0, 400)}` : null,
          ``,
          `Por favor ingresa al portal para asignar el inspector.`,
          ``,
          `— WSS División Inspección Industrial`,
        ].filter(l => l !== null).join('\n')
        emailUrl = `mailto:${sup.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
      }

      setExito({ otNumero, waUrl, emailUrl, supervisorNombre: supNombreCompleto })

    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
      setMensajePaso('')
    }
  }

  // ── Pantalla éxito + notificación supervisor ────────────────────────────
  if (exito) {
    return (
      <div style={styles.overlay}>
        <div style={{ ...styles.box, maxWidth: 480, textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
          <h2 style={{ margin: '0 0 6px', color: 'var(--azul)', fontSize: 20 }}>
            OT {exito.otNumero} creada
          </h2>
          <p style={{ color: '#444', marginBottom: 6, fontSize: 14 }}>
            Carpetas en Drive generadas correctamente.
          </p>
          <p style={{ color: '#666', marginBottom: 24, fontSize: 13 }}>
            Notifica a <strong>{exito.supervisorNombre}</strong> para que asigne el inspector.
          </p>

          {/* WhatsApp */}
          {exito.waUrl ? (
            <a href={exito.waUrl} target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: '#25D366', color: '#fff', borderRadius: 10,
              padding: '13px 24px', textDecoration: 'none', fontWeight: 700, fontSize: 15,
              marginBottom: 10,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              📱 Notificar por WhatsApp
            </a>
          ) : (
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, padding: '10px', background: '#F8FAFC', borderRadius: 8 }}>
              ⚠️ {exito.supervisorNombre} no tiene teléfono registrado — WhatsApp no disponible
            </div>
          )}

          {/* Email */}
          {exito.emailUrl ? (
            <a href={exito.emailUrl} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: '#2563EB', color: '#fff', borderRadius: 10,
              padding: '13px 24px', textDecoration: 'none', fontWeight: 700, fontSize: 15,
              marginBottom: 10,
            }}>
              ✉️ Notificar por Email
            </a>
          ) : (
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, padding: '10px', background: '#F8FAFC', borderRadius: 8 }}>
              ⚠️ {exito.supervisorNombre} no tiene email registrado — correo no disponible
            </div>
          )}

          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => { onCreada && onCreada(exito.otNumero); onClose() }}
          >
            Ir a la OT →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.overlay}>
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
                <div className="col-6 field" style={{ position: 'relative' }}>
                  <label>Cliente *</label>
                  <input
                    className="input"
                    placeholder="Razón social"
                    value={form.cliente}
                    autoComplete="off"
                    onChange={e => {
                      const val = e.target.value
                      set('cliente', val)
                      if (val.length >= 2) {
                        const q = val.toLowerCase()
                        setClienteSugerencias(clienteOptions.filter(c => c.toLowerCase().includes(q)).slice(0, 8))
                        setMostrarSugerencias(true)
                      } else {
                        setMostrarSugerencias(false)
                      }
                    }}
                    onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
                    onFocus={() => {
                      if (form.cliente.length >= 2 && clienteSugerencias.length > 0)
                        setMostrarSugerencias(true)
                    }}
                    disabled={guardando}
                  />
                  {mostrarSugerencias && clienteSugerencias.length > 0 && (
                    <ul style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                      background: '#fff', border: '1.5px solid #85B7EB', borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,.15)', margin: '2px 0 0',
                      padding: 0, listStyle: 'none', maxHeight: 220, overflowY: 'auto',
                    }}>
                      {clienteSugerencias.map(c => (
                        <li key={c}
                          onMouseDown={() => {
                            const datos = clienteMapaRef.current[c] || {}
                            setForm(f => ({
                              ...f,
                              cliente:          c,
                              contacto:         datos.contacto         || f.contacto,
                              email_cliente:    datos.email_cliente     || f.email_cliente,
                              telefono_cliente: datos.telefono_cliente  || f.telefono_cliente,
                              rut_empresa:      datos.rut_empresa       || f.rut_empresa,
                            }))
                            setMostrarSugerencias(false)
                          }}
                          style={{
                            padding: '9px 14px', cursor: 'pointer', fontSize: 14,
                            borderBottom: '1px solid #F1F5F9',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#EEF5FF'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
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
                  <label>Supervisor *</label>
                  <select className="select" value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)} disabled={guardando}
                    style={{ borderColor: !form.supervisor_id ? '#FCA5A5' : undefined }}>
                    {supervisores.length === 0
                      ? <option value="">Cargando supervisores...</option>
                      : supervisores.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.nombre} {s.apellido} · {s.sede}
                          </option>
                        ))
                    }
                  </select>
                  <span className="text-sm" style={{ color: '#6B7280' }}>Requerido para crear la OT</span>
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
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillCheck: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '6px 12px',
    border: '1.5px solid',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12,
    userSelect: 'none',
    transition: 'all .15s',
  },
}
