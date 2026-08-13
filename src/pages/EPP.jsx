// ============================================================
// EPP.jsx — Control de stock y entregas de EPP
// REG-SEG-011 Rev. 05 · DS N°44
//
// Rev. 05 reemplaza a la Rev. 04 (planilla en papel con firma manuscrita):
// incorpora firma digital, correlativo único y notificación automática.
// La fecha de emisión debe confirmarla control de gestión antes de
// declararlo vigente en el listado maestro de documentos.
//
// Tres vistas:
//   Stock    — qué hay disponible, por artículo y talla
//   Compras  — la secretaria carga lo que compró
//   Entregas — quién pidió qué, con firma digital y PDF
//
// El stock no se guarda: se calcula desde los movimientos.
// ============================================================
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const ROLES_OK = ['ADMIN', 'ADMINISTRADOR', 'SUPERVISOR', 'APR', 'SECRETARIA', 'PREVENCIONISTA']

const MOTIVOS = ['Entrega inicial', 'Recambio por uso', 'Extravío', 'Deterioro', 'Reposición']

const hoy = () => new Date().toISOString().slice(0, 10)

// ═══════════════════════════════════════════════════════════════
export default function EPP() {
  const { usuario } = useAuth()
  const rol = (usuario?.rol || '').toUpperCase()
  const autorizado = ROLES_OK.includes(rol)

  const [vista, setVista]       = useState('stock')
  const [stock, setStock]       = useState([])
  const [entregas, setEntregas] = useState([])
  const [personal, setPersonal] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState('')
  const [aviso, setAviso]       = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const [rs, re, rp] = await Promise.all([
        supabase.from('v_epp_stock').select('*').eq('activo', true).order('nombre'),
        supabase.from('epp_entregas').select('*').order('fecha', { ascending: false }).limit(200),
        supabase.from('personal').select('id,nombre,apellido,email,cargo,sede,jefe_email')
          .eq('activo', true).order('nombre'),
      ])
      if (rs.error) throw rs.error
      setStock(rs.data || [])
      if (re.error) console.warn('[EPP] entregas:', re.error.message)
      setEntregas(re.data || [])
      if (rp.error) console.warn('[EPP] personal:', rp.error.message)
      setPersonal(rp.data || [])
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { if (autorizado) cargar() }, [autorizado, cargar])

  function notificar(msg) { setAviso(msg); setTimeout(() => setAviso(''), 5000) }

  if (!autorizado) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
        <h2 style={{ color: '#DC2626', margin: '0 0 8px' }}>Acceso restringido</h2>
        <p style={{ color: '#64748B', margin: 0 }}>
          El módulo de EPP es para administración, supervisores, APR y secretaría.
        </p>
      </div>
    )
  }

  const bajoStock = stock.filter(s => Number(s.stock) <= 2)
  const sinStock  = stock.filter(s => Number(s.stock) <= 0)
  const pendFirma = entregas.filter(e => !e.firma_b64)

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0E2A45' }}>
          Elementos de Protección Personal
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
          REG-SEG-011 Rev. 05 · Decreto Supremo N°44
        </p>
      </div>

      {/* Indicadores */}
      <div style={S.kpis}>
        <KPI label="Artículos en catálogo" valor={stock.length} />
        <KPI label="Sin stock" valor={sinStock.length} color={sinStock.length ? '#DC2626' : '#059669'} />
        <KPI label="Stock bajo (≤2)" valor={bajoStock.length} color={bajoStock.length ? '#B8860B' : '#059669'} />
        <KPI label="Entregas sin firmar" valor={pendFirma.length} color={pendFirma.length ? '#B8860B' : '#059669'} />
      </div>

      {/* Pestañas */}
      <div style={S.tabs}>
        {[['stock','Stock'], ['compras','Cargar compra'], ['entregas','Entregas']].map(([id, txt]) => (
          <button key={id} onClick={() => setVista(id)} style={S.tab(vista === id)}>{txt}</button>
        ))}
      </div>

      {aviso && <div style={S.aviso}>{aviso}</div>}
      {error && <div style={S.error}>{error}</div>}

      {cargando ? <p style={{ color: '#64748B' }}>Cargando…</p> : (
        <>
          {vista === 'stock'    && <VistaStock stock={stock} />}
          {vista === 'compras'  && <VistaCompra stock={stock} onListo={() => { cargar(); notificar('Compra registrada. El stock ya está actualizado.') }} />}
          {vista === 'entregas' && (
            <VistaEntregas
              entregas={entregas} stock={stock} personal={personal}
              usuario={usuario}
              onListo={(m) => { cargar(); notificar(m) }}
              onError={setError}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Vista: stock ─────────────────────────────────────────────
function VistaStock({ stock }) {
  const [busca, setBusca] = useState('')
  const filtrado = stock.filter(s =>
    !busca || `${s.nombre} ${s.talla || ''}`.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div style={S.tarjeta}>
      <input placeholder="Buscar artículo…" value={busca} onChange={e => setBusca(e.target.value)}
        style={{ ...S.input, maxWidth: 320, marginBottom: 14 }} />

      <div style={{ overflowX: 'auto' }}>
        <table style={S.tabla}>
          <thead>
            <tr>
              <th style={S.th}>Artículo</th>
              <th style={S.th}>Talla</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Ingresado</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Entregado</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Disponible</th>
              <th style={S.th}>Última compra</th>
            </tr>
          </thead>
          <tbody>
            {filtrado.length === 0 && (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#94A3B8' }}>
                Sin artículos que mostrar
              </td></tr>
            )}
            {filtrado.map(s => {
              const n = Number(s.stock)
              const color = n <= 0 ? '#DC2626' : n <= 2 ? '#B8860B' : '#059669'
              return (
                <tr key={s.id}>
                  <td style={S.td}>{s.nombre}</td>
                  <td style={S.td}>{s.talla || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: '#64748B' }}>{s.ingresado}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: '#64748B' }}>{s.salido}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color }}>
                    {n} <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8' }}>{s.unidad}</span>
                  </td>
                  <td style={{ ...S.td, color: '#64748B', fontSize: 12 }}>{s.ultima_compra || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Vista: cargar compra ─────────────────────────────────────
function VistaCompra({ stock, onListo }) {
  const vacio = { nombre: '', talla: '', cantidad: '', unidad: 'unidad',
                  documento: '', proveedor: '', fecha: hoy(), observacion: '' }
  const [f, setF] = useState(vacio)
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')

  const nombresPrevios = [...new Set(stock.map(s => s.nombre))].sort()

  async function guardar() {
    setErr('')
    if (!f.nombre.trim())          return setErr('Escribe qué artículo compraste')
    if (!(Number(f.cantidad) > 0)) return setErr('La cantidad debe ser mayor que cero')

    setGuardando(true)
    try {
      const { error } = await supabase.rpc('fn_epp_ingresar', {
        p_nombre: f.nombre.trim(), p_talla: f.talla.trim() || null,
        p_cantidad: Number(f.cantidad), p_unidad: f.unidad,
        p_documento: f.documento.trim() || null, p_proveedor: f.proveedor.trim() || null,
        p_fecha: f.fecha, p_observacion: f.observacion.trim() || null,
      })
      if (error) throw error
      setF({ ...vacio, fecha: f.fecha, proveedor: f.proveedor, documento: f.documento })
      onListo()
    } catch (e) { setErr(e.message) }
    finally { setGuardando(false) }
  }

  return (
    <div style={S.tarjeta}>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B' }}>
        Escribe lo que compraste. Si el artículo no existe, se crea solo; si ya existe,
        la cantidad se suma al stock.
      </p>

      {err && <div style={S.error}>{err}</div>}

      <div style={S.grid2}>
        <Campo label="Artículo *">
          <input list="epp-nombres" value={f.nombre} placeholder="Ej: Antiparras oscuras"
            onChange={e => setF({ ...f, nombre: e.target.value })} style={S.input} />
          <datalist id="epp-nombres">
            {nombresPrevios.map(n => <option key={n} value={n} />)}
          </datalist>
        </Campo>

        <Campo label="Talla (si aplica)">
          <input value={f.talla} placeholder="42, M, XL…"
            onChange={e => setF({ ...f, talla: e.target.value })} style={S.input} />
        </Campo>

        <Campo label="Cantidad *">
          <input type="number" min="1" value={f.cantidad}
            onChange={e => setF({ ...f, cantidad: e.target.value })} style={S.input} />
        </Campo>

        <Campo label="Unidad">
          <select value={f.unidad} onChange={e => setF({ ...f, unidad: e.target.value })} style={S.input}>
            <option value="unidad">unidad</option>
            <option value="par">par</option>
            <option value="caja">caja</option>
          </select>
        </Campo>

        <Campo label="Fecha de compra">
          <input type="date" value={f.fecha}
            onChange={e => setF({ ...f, fecha: e.target.value })} style={S.input} />
        </Campo>

        <Campo label="Proveedor">
          <input value={f.proveedor} onChange={e => setF({ ...f, proveedor: e.target.value })} style={S.input} />
        </Campo>

        <Campo label="N° factura o guía">
          <input value={f.documento} onChange={e => setF({ ...f, documento: e.target.value })} style={S.input} />
        </Campo>

        <Campo label="Observación">
          <input value={f.observacion} onChange={e => setF({ ...f, observacion: e.target.value })} style={S.input} />
        </Campo>
      </div>

      <button onClick={guardar} disabled={guardando} style={{ ...S.btnPrimario, marginTop: 18 }}>
        {guardando ? 'Guardando…' : 'Registrar compra'}
      </button>
    </div>
  )
}

// ── Vista: entregas ──────────────────────────────────────────
function VistaEntregas({ entregas, stock, personal, usuario, onListo, onError }) {
  const [nueva, setNueva]   = useState(false)
  const [firmando, setFirmando] = useState(null)   // entrega a firmar

  if (firmando) {
    return <PanelFirma entrega={firmando} onCerrar={() => setFirmando(null)}
             onFirmada={(m) => { setFirmando(null); onListo(m) }} onError={onError} />
  }

  if (nueva) {
    return <FormEntrega stock={stock} personal={personal} usuario={usuario}
             onCancelar={() => setNueva(false)}
             onCreada={(ent, alertas) => {
               setNueva(false)
               onListo(alertas?.length
                 ? `Entrega ${ent.correlativo} registrada. Ojo: ${alertas.length} artículo(s) quedaron con stock negativo.`
                 : `Entrega ${ent.correlativo} registrada. Falta la firma del trabajador.`)
             }} onError={onError} />
  }

  return (
    <div style={S.tarjeta}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#64748B' }}>{entregas.length} entrega(s) registrada(s)</span>
        <button onClick={() => setNueva(true)} style={S.btnPrimario}>+ Nueva entrega</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={S.tabla}>
          <thead>
            <tr>
              <th style={S.th}>N°</th>
              <th style={S.th}>Fecha</th>
              <th style={S.th}>Trabajador</th>
              <th style={S.th}>Motivo</th>
              <th style={S.th}>Entregó</th>
              <th style={S.th}>Estado</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {entregas.length === 0 && (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94A3B8' }}>
                Todavía no hay entregas registradas
              </td></tr>
            )}
            {entregas.map(e => (
              <tr key={e.id}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700 }}>{e.correlativo}</td>
                <td style={S.td}>{e.fecha}</td>
                <td style={S.td}>{e.trabajador}</td>
                <td style={{ ...S.td, fontSize: 12, color: '#64748B' }}>{e.motivo || '—'}</td>
                <td style={{ ...S.td, fontSize: 12, color: '#64748B' }}>{e.entregado_por}</td>
                <td style={S.td}>
                  <span style={S.badge(!!e.firma_b64)}>
                    {e.firma_b64 ? 'Firmada' : 'Pendiente de firma'}
                  </span>
                </td>
                <td style={S.td}>
                  {!e.firma_b64 && (
                    <button onClick={() => setFirmando(e)} style={S.btnChico}>Firmar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Formulario de nueva entrega ──────────────────────────────
function FormEntrega({ stock, personal, usuario, onCancelar, onCreada, onError }) {
  const [personaId, setPersonaId] = useState('')
  const [motivo, setMotivo]       = useState(MOTIVOS[0])
  const [obs, setObs]             = useState('')
  const [items, setItems]         = useState([{ articulo_id: '', cantidad: 1 }])
  const [guardando, setGuardando] = useState(false)
  const [err, setErr]             = useState('')

  const persona = personal.find(p => p.id === personaId)

  function cambiar(i, campo, valor) {
    setItems(items.map((it, k) => k === i ? { ...it, [campo]: valor } : it))
  }

  async function guardar() {
    setErr('')
    if (!personaId) return setErr('Selecciona a quién se le entrega')
    const validos = items.filter(i => i.articulo_id && Number(i.cantidad) > 0)
    if (validos.length === 0) return setErr('Agrega al menos un artículo')

    setGuardando(true)
    try {
      const { data, error } = await supabase.rpc('fn_epp_entregar', {
        p_personal_id: personaId,
        p_trabajador: `${persona.nombre} ${persona.apellido || ''}`.trim(),
        p_cargo: persona.cargo || null,
        p_lugar: persona.sede || null,
        p_motivo: motivo,
        p_observacion: obs.trim() || null,
        p_items: validos.map(i => ({ articulo_id: Number(i.articulo_id), cantidad: Number(i.cantidad) })),
      })
      if (error) throw error
      onCreada({ id: data.entrega_id, correlativo: data.correlativo }, data.alertas_stock || [])
    } catch (e) { setErr(e.message); onError?.(e.message) }
    finally { setGuardando(false) }
  }

  return (
    <div style={S.tarjeta}>
      <h3 style={{ margin: '0 0 16px', color: '#0E2A45' }}>Nueva entrega de EPP</h3>
      {err && <div style={S.error}>{err}</div>}

      <div style={S.grid2}>
        <Campo label="Trabajador *">
          <select value={personaId} onChange={e => setPersonaId(e.target.value)} style={S.input}>
            <option value="">Seleccionar…</option>
            {personal.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellido || ''}{p.cargo ? ` — ${p.cargo}` : ''}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Motivo">
          <select value={motivo} onChange={e => setMotivo(e.target.value)} style={S.input}>
            {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
      </div>

      <div style={{ marginTop: 18 }}>
        <label style={S.label}>Artículos entregados *</label>
        {items.map((it, i) => {
          const art = stock.find(s => String(s.id) === String(it.articulo_id))
          const falta = art && Number(art.stock) < Number(it.cantidad)
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <select value={it.articulo_id} onChange={e => cambiar(i, 'articulo_id', e.target.value)}
                style={{ ...S.input, flex: 1 }}>
                <option value="">Seleccionar artículo…</option>
                {stock.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}{s.talla ? ` · talla ${s.talla}` : ''} (disponible: {s.stock})
                  </option>
                ))}
              </select>
              <input type="number" min="1" value={it.cantidad}
                onChange={e => cambiar(i, 'cantidad', e.target.value)}
                style={{ ...S.input, width: 90 }} />
              {items.length > 1 && (
                <button onClick={() => setItems(items.filter((_, k) => k !== i))}
                  style={S.btnQuitar}>✕</button>
              )}
              {falta && (
                <span style={{ fontSize: 11, color: '#B8860B', alignSelf: 'center', maxWidth: 150 }}>
                  Stock insuficiente — se registra igual
                </span>
              )}
            </div>
          )
        })}
        <button onClick={() => setItems([...items, { articulo_id: '', cantidad: 1 }])}
          style={S.btnSecundario}>+ Agregar artículo</button>
      </div>

      <div style={{ marginTop: 18 }}>
        <Campo label="Observación">
          <input value={obs} onChange={e => setObs(e.target.value)} style={S.input} />
        </Campo>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={guardar} disabled={guardando} style={S.btnPrimario}>
          {guardando ? 'Registrando…' : 'Registrar entrega'}
        </button>
        <button onClick={onCancelar} style={S.btnSecundario}>Cancelar</button>
      </div>
    </div>
  )
}

// ── Panel de firma + PDF + notificación ──────────────────────
function PanelFirma({ entrega, onCerrar, onFirmada, onError }) {
  const canvasRef = useRef(null)
  const docRef    = useRef(null)
  const [dibujando, setDibujando] = useState(false)
  const [hayTrazo, setHayTrazo]   = useState(false)
  const [items, setItems]         = useState([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('epp_entrega_items')
      .select('cantidad, epp_articulos(nombre, talla, unidad)')
      .eq('entrega_id', entrega.id)
      .then(({ data, error }) => {
        if (error) console.warn('[EPP] items:', error.message)
        setItems(data || [])
      })
  }, [entrega.id])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0E2A45'
  }, [])

  function pos(e) {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    const t = e.touches?.[0]
    return { x: (t ? t.clientX : e.clientX) - r.left, y: (t ? t.clientY : e.clientY) - r.top }
  }
  function iniciar(e) {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = pos(e)
    ctx.beginPath(); ctx.moveTo(x, y)
    setDibujando(true); setHayTrazo(true)
  }
  function mover(e) {
    if (!dibujando) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = pos(e)
    ctx.lineTo(x, y); ctx.stroke()
  }
  function limpiar() {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setHayTrazo(false)
  }

  async function confirmar() {
    if (!hayTrazo) return onError?.('Falta la firma del trabajador')
    setGuardando(true)
    try {
      const firma = canvasRef.current.toDataURL('image/png')

      const { error: eUp } = await supabase.from('epp_entregas')
        .update({ firma_b64: firma, firmado_en: new Date().toISOString(), estado: 'Firmada' })
        .eq('id', entrega.id)
      if (eUp) throw eUp

      // PDF del REG-SEG-011
      let adjuntos = []
      try {
        const b64 = await pdfDesdeNodo(docRef.current)
        if (b64) adjuntos = [{
          filename: `REG-SEG-011_${entrega.correlativo}.pdf`,
          content_base64: b64, mime_type: 'application/pdf',
        }]
      } catch (e) { console.warn('[EPP] PDF:', e.message) }

      // Aviso al trabajador, su jefatura y los APR
      try {
        const { data: pers } = await supabase.from('personal')
          .select('email, jefe_email').eq('id', entrega.personal_id).maybeSingle()
        const { data: aprs } = await supabase.from('usuarios')
          .select('email').in('rol', ['APR', 'SUPERVISOR']).not('email', 'is', null)

        const destinos = [...new Set([
          pers?.email, pers?.jefe_email, ...(aprs || []).map(u => u.email),
        ].filter(Boolean))]

        if (destinos.length) {
          await supabase.functions.invoke('enviar-email', {
            body: {
              to: destinos,
              subject: `[WSS] Entrega de EPP ${entrega.correlativo} — ${entrega.trabajador}`,
              html: htmlAviso(entrega, items),
              adjuntos,
            },
          })
        }
      } catch (e) { console.warn('[EPP] aviso:', e.message) }

      onFirmada(`Entrega ${entrega.correlativo} firmada. Se avisó al trabajador, su jefatura y los APR.`)
    } catch (e) {
      onError?.(e.message)
    } finally { setGuardando(false) }
  }

  return (
    <div style={S.tarjeta}>
      <h3 style={{ margin: '0 0 4px', color: '#0E2A45' }}>Firma de recepción</h3>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748B' }}>
        {entrega.correlativo} · {entrega.trabajador}
      </p>

      {/* Documento que se convierte en PDF */}
      <div ref={docRef} style={S.doc}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0E2A45', paddingBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0E2A45' }}>
              REGISTRO DE ENTREGA DE ELEMENTOS DE PROTECCIÓN PERSONAL
            </div>
            <div style={{ fontSize: 10, color: '#64748B' }}>Decreto Supremo N°44</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: '#64748B' }}>
            <div style={{ fontWeight: 800, color: '#0E2A45' }}>REG-SEG-011</div>
            <div>Rev. 05</div>
            <div>{entrega.correlativo}</div>
          </div>
        </div>

        <table style={{ width: '100%', fontSize: 11, marginTop: 10, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={S.dt}>Trabajador</td><td style={S.dd}>{entrega.trabajador}</td>
              <td style={S.dt}>Cargo</td><td style={S.dd}>{entrega.cargo || '—'}</td>
            </tr>
            <tr>
              <td style={S.dt}>Lugar de trabajo</td><td style={S.dd}>{entrega.lugar_trabajo || '—'}</td>
              <td style={S.dt}>Fecha</td><td style={S.dd}>{entrega.fecha}</td>
            </tr>
            <tr>
              <td style={S.dt}>Responsable entrega</td><td style={S.dd}>{entrega.entregado_por}</td>
              <td style={S.dt}>Motivo</td><td style={S.dd}>{entrega.motivo || '—'}</td>
            </tr>
          </tbody>
        </table>

        <table style={{ width: '100%', fontSize: 11, marginTop: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={S.dth}>Elemento de protección personal</th>
              <th style={S.dth}>Talla</th>
              <th style={{ ...S.dth, textAlign: 'right' }}>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td style={S.dtd}>{it.epp_articulos?.nombre}</td>
                <td style={S.dtd}>{it.epp_articulos?.talla || '—'}</td>
                <td style={{ ...S.dtd, textAlign: 'right' }}>
                  {it.cantidad} {it.epp_articulos?.unidad}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 14, fontSize: 9.5, color: '#475569', lineHeight: 1.55 }}>
          <strong>Responsabilidades del trabajador (RIOHS · DS N°44):</strong><br />
          · Mantener y cuidar adecuadamente los elementos entregados.<br />
          · El mal uso o adulteración de los EPP será sancionado según el Reglamento Interno.<br />
          · Se prohíbe el préstamo o intercambio de EPP por razones de higiene (RIOHS Art. 67).<br />
          · Debe avisar a su jefe directo si el equipo fue cambiado, sustraído, extraviado o quedó inservible,
          solicitando su reposición.
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 30 }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: 46, borderBottom: '1px solid #94A3B8' }} />
            <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 3 }}>Responsable de la entrega</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 46, borderBottom: '1px solid #94A3B8' }} />
            <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 3 }}>
              Firma del trabajador · {entrega.trabajador}
            </div>
          </div>
        </div>
      </div>

      {/* Pizarra de firma */}
      <div style={{ marginTop: 18 }}>
        <label style={S.label}>Firme aquí con el dedo o el mouse</label>
        <canvas
          ref={canvasRef} width={520} height={170}
          onMouseDown={iniciar} onMouseMove={mover}
          onMouseUp={() => setDibujando(false)} onMouseLeave={() => setDibujando(false)}
          onTouchStart={iniciar} onTouchMove={mover} onTouchEnd={() => setDibujando(false)}
          style={{ width: '100%', maxWidth: 520, height: 170, border: '2px dashed #CBD5E1',
                   borderRadius: 10, background: '#fff', touchAction: 'none', cursor: 'crosshair' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button onClick={confirmar} disabled={guardando || !hayTrazo} style={{
          ...S.btnPrimario, opacity: (guardando || !hayTrazo) ? .5 : 1,
        }}>
          {guardando ? 'Guardando…' : 'Confirmar recepción'}
        </button>
        <button onClick={limpiar} style={S.btnSecundario}>Borrar firma</button>
        <button onClick={onCerrar} style={S.btnSecundario}>Cancelar</button>
      </div>
    </div>
  )
}

// ── Utilidades ───────────────────────────────────────────────
async function pdfDesdeNodo(nodo) {
  if (!nodo) return null
  const canvas = await html2canvas(nodo, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const img = canvas.toDataURL('image/jpeg', 0.92)
  const ih = (canvas.height * pw) / canvas.width
  pdf.addImage(img, 'JPEG', 0, 0, pw, ih)
  let resto = ih - ph, y = -ph
  while (resto > 0) { pdf.addPage(); pdf.addImage(img, 'JPEG', 0, y, pw, ih); y -= ph; resto -= ph }
  const bytes = new Uint8Array(pdf.output('arraybuffer'))
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function htmlAviso(e, items) {
  const filas = items.map(it => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #EEF2F7;font-size:13px">${it.epp_articulos?.nombre || ''}</td>
      <td style="padding:6px 0;border-bottom:1px solid #EEF2F7;font-size:13px">${it.epp_articulos?.talla || '—'}</td>
      <td style="padding:6px 0;border-bottom:1px solid #EEF2F7;font-size:13px;text-align:right">${it.cantidad}</td>
    </tr>`).join('')

  return `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0F172A">
  <div style="background:#0E2A45;padding:22px 28px;border-radius:12px 12px 0 0">
    <div style="color:#D4A017;font-size:11px;font-weight:800;letter-spacing:1.2px">ENTREGA DE EPP</div>
    <div style="color:#fff;font-size:20px;font-weight:800;margin-top:6px">${e.correlativo}</div>
    <div style="color:rgba(255,255,255,.82);font-size:14px;margin-top:3px">${e.trabajador}</div>
  </div>
  <div style="background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:22px 28px">
    <p style="margin:0 0 14px;font-size:14px;color:#334155">
      Se registró la entrega de elementos de protección personal, con firma de recepción del trabajador.
    </p>
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <th style="text-align:left;font-size:11px;color:#94A3B8;text-transform:uppercase;padding-bottom:4px">Elemento</th>
        <th style="text-align:left;font-size:11px;color:#94A3B8;text-transform:uppercase;padding-bottom:4px">Talla</th>
        <th style="text-align:right;font-size:11px;color:#94A3B8;text-transform:uppercase;padding-bottom:4px">Cant.</th>
      </tr>
      ${filas}
    </table>
    <div style="margin-top:18px;font-size:13px;color:#64748B">
      Fecha: ${e.fecha} · Motivo: ${e.motivo || '—'}<br>
      Responsable de la entrega: ${e.entregado_por}
    </div>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid #EEF2F7;font-size:12px;color:#94A3B8">
      REG-SEG-011 Rev. 05 · DS N°44 · El comprobante firmado va adjunto.
    </div>
  </div>
</div>`
}

// ── Piezas visuales ──────────────────────────────────────────
function KPI({ label, valor, color = '#0E2A45' }) {
  return (
    <div style={S.kpi}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  )
}

const S = {
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 },
  kpi: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px' },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #E2E8F0', marginBottom: 18 },
  tab: (a) => ({
    padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: a ? 700 : 400, color: a ? '#185FA5' : '#64748B',
    borderBottom: a ? '3px solid #185FA5' : '3px solid transparent',
  }),
  tarjeta: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 },
  doc: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: 20 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 5 },
  input: { width: '100%', padding: '9px 11px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '9px 10px', borderBottom: '2px solid #E2E8F0', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px' },
  td: { padding: '9px 10px', borderBottom: '1px solid #F1F5F9' },
  dt: { padding: '4px 6px', fontSize: 10, color: '#64748B', background: '#F8FAFC', width: '18%' },
  dd: { padding: '4px 6px', fontSize: 11, fontWeight: 600, color: '#0E2A45', width: '32%' },
  dth: { padding: '6px 8px', fontSize: 10, color: '#475569', textAlign: 'left', border: '1px solid #E2E8F0' },
  dtd: { padding: '6px 8px', fontSize: 11, border: '1px solid #E2E8F0' },
  badge: (ok) => ({
    display: 'inline-block', fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
    background: ok ? '#D1FAE5' : '#FEF3C7', color: ok ? '#065F46' : '#92400E',
  }),
  btnPrimario: { background: '#0E2A45', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnSecundario: { background: '#fff', color: '#475569', border: '1px solid #CBD5E1', borderRadius: 9, padding: '10px 18px', fontSize: 14, cursor: 'pointer' },
  btnChico: { background: '#185FA5', color: '#fff', border: 'none', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  btnQuitar: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8, width: 38, height: 38, cursor: 'pointer', fontSize: 14 },
  aviso: { background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13.5 },
  error: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13.5 },
}
