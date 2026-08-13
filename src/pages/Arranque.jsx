// ============================================================
// Arranque.jsx — Carpeta de arranque (DS 76, art. 66 bis Ley 16.744)
//
// Tres bloques:
//   Faenas     → los 15 documentos de empresa, por faena
//   Flota      → vehículos y sus 5 documentos
//   Conductores→ quién maneja y si está al día
//
// Acceso: APR, supervisores y administración. Auditoría solo lee.
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ROLES_VER    = ['ADMIN','ADMINISTRADOR','SUPERVISOR','APR','PREVENCIONISTA','AUDITOR']
const ROLES_EDITAR = ['ADMIN','ADMINISTRADOR','SUPERVISOR','APR','PREVENCIONISTA']

const COLOR_ESTADO = {
  'Vigente':    { bg: '#D1FAE5', fg: '#065F46' },
  'Cargado':    { bg: '#DBEAFE', fg: '#1E40AF' },
  'Por vencer': { bg: '#FEF3C7', fg: '#92400E' },
  'Vencido':    { bg: '#FEE2E2', fg: '#991B1B' },
  'Faltante':   { bg: '#F1F5F9', fg: '#64748B' },
  'Sin fecha':  { bg: '#F1F5F9', fg: '#64748B' },
}

const hoy = () => new Date().toISOString().slice(0, 10)

// Suma meses a una fecha, para calcular el vencimiento
function sumarMeses(fecha, meses) {
  if (!fecha || !meses) return ''
  const d = new Date(fecha + 'T00:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

// ═══════════════════════════════════════════════════════════════
export default function Arranque() {
  const { usuario } = useAuth()
  const rol = (usuario?.rol || '').toUpperCase()
  const puedeVer    = ROLES_VER.includes(rol)
  const puedeEditar = ROLES_EDITAR.includes(rol)

  const [vista, setVista]   = useState('faenas')
  const [faenas, setFaenas] = useState([])
  const [flota, setFlota]   = useState([])
  const [conductores, setConductores] = useState([])
  const [faenaAbierta, setFaenaAbierta] = useState(null)
  const [autoAbierto, setAutoAbierto]   = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const [f, v, c] = await Promise.all([
        supabase.from('v_arranque_cumplimiento').select('*').order('nombre'),
        supabase.from('v_vehiculos_cumplimiento').select('*').order('codigo_interno'),
        supabase.from('v_conductores').select('*'),
      ])
      if (f.error) throw f.error
      setFaenas(f.data || [])
      if (v.error) console.warn('[Arranque] flota:', v.error.message)
      setFlota(v.data || [])
      if (c.error) console.warn('[Arranque] conductores:', c.error.message)
      setConductores(c.data || [])
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { if (puedeVer) cargar() }, [puedeVer, cargar])

  function notificar(m) { setAviso(m); setTimeout(() => setAviso(''), 5000) }

  if (!puedeVer) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
        <h2 style={{ color: '#DC2626', margin: '0 0 8px' }}>Acceso restringido</h2>
        <p style={{ color: '#64748B', margin: 0 }}>
          La carpeta de arranque es para prevención, supervisores y administración.
        </p>
      </div>
    )
  }

  if (faenaAbierta) {
    return <DetalleFaena faena={faenaAbierta} puedeEditar={puedeEditar}
             onVolver={() => { setFaenaAbierta(null); cargar() }} onError={setError} />
  }
  if (autoAbierto) {
    return <DetalleVehiculo vehiculo={autoAbierto} puedeEditar={puedeEditar}
             onVolver={() => { setAutoAbierto(null); cargar() }} onError={setError} />
  }

  const conVencidos = flota.filter(v => Number(v.vencidos) > 0).length
  const faenasIncompletas = faenas.filter(f => Number(f.porcentaje || 0) < 100).length

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0E2A45' }}>
          Carpeta de arranque
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
          DS 76 · Artículo 66 bis, Ley 16.744 — acreditación de empresa, personal y vehículos
        </p>
      </div>

      <div style={S.kpis}>
        <KPI label="Faenas activas" valor={faenas.length} />
        <KPI label="Faenas incompletas" valor={faenasIncompletas}
             color={faenasIncompletas ? '#B8860B' : '#059669'} />
        <KPI label="Vehículos" valor={flota.length} />
        <KPI label="Con documentos vencidos" valor={conVencidos}
             color={conVencidos ? '#DC2626' : '#059669'} />
      </div>

      <div style={S.tabs}>
        {[['faenas','Faenas'], ['flota','Flota'], ['conductores','Conductores']].map(([id, t]) => (
          <button key={id} onClick={() => setVista(id)} style={S.tab(vista === id)}>{t}</button>
        ))}
      </div>

      {aviso && <div style={S.aviso}>{aviso}</div>}
      {error && <div style={S.error}>{error}</div>}

      {cargando ? <p style={{ color: '#64748B' }}>Cargando…</p> : (
        <>
          {vista === 'faenas' && (
            <ListaFaenas faenas={faenas} puedeEditar={puedeEditar}
              onAbrir={setFaenaAbierta}
              onCreada={() => { cargar(); notificar('Faena creada. Ahora carga sus documentos.') }}
              onError={setError} />
          )}
          {vista === 'flota' && (
            <ListaFlota flota={flota} puedeEditar={puedeEditar}
              onAbrir={setAutoAbierto}
              onCreado={() => { cargar(); notificar('Vehículo registrado.') }}
              onError={setError} />
          )}
          {vista === 'conductores' && <ListaConductores filas={conductores} />}
        </>
      )}
    </div>
  )
}

// ── Faenas ───────────────────────────────────────────────────
function ListaFaenas({ faenas, puedeEditar, onAbrir, onCreada, onError }) {
  const [nueva, setNueva] = useState(false)
  const vacio = { nombre: '', cliente: '', mandante: '', ubicacion: '', sede: 'SCL',
                  ot_numero: '', fecha_inicio: hoy(), fecha_termino: '', responsable: '' }
  const [f, setF] = useState(vacio)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!f.nombre.trim() || !f.cliente.trim()) {
      return onError('El nombre de la faena y el cliente son obligatorios')
    }
    setGuardando(true)
    try {
      const { error } = await supabase.from('arranque_faenas').insert({
        ...f,
        ot_numero: f.ot_numero.trim() || null,
        fecha_termino: f.fecha_termino || null,
      })
      if (error) throw error
      setF(vacio); setNueva(false); onCreada()
    } catch (e) { onError(e.message) }
    finally { setGuardando(false) }
  }

  if (nueva) {
    return (
      <div style={S.tarjeta}>
        <h3 style={{ margin: '0 0 16px', color: '#0E2A45' }}>Nueva faena</h3>
        <div style={S.grid2}>
          <Campo label="Nombre de la faena *">
            <input value={f.nombre} placeholder="Mantos Verde 2026"
              onChange={e => setF({ ...f, nombre: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Cliente *">
            <input value={f.cliente} onChange={e => setF({ ...f, cliente: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Empresa mandante">
            <input value={f.mandante} placeholder="Si es distinta del cliente"
              onChange={e => setF({ ...f, mandante: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Ubicación">
            <input value={f.ubicacion} onChange={e => setF({ ...f, ubicacion: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Sede">
            <select value={f.sede} onChange={e => setF({ ...f, sede: e.target.value })} style={S.input}>
              <option>SCL</option><option>ANF</option><option>CCP</option>
            </select>
          </Campo>
          <Campo label="OT asociada">
            <input value={f.ot_numero} onChange={e => setF({ ...f, ot_numero: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Inicio">
            <input type="date" value={f.fecha_inicio}
              onChange={e => setF({ ...f, fecha_inicio: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Término estimado">
            <input type="date" value={f.fecha_termino}
              onChange={e => setF({ ...f, fecha_termino: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="APR responsable">
            <input value={f.responsable} onChange={e => setF({ ...f, responsable: e.target.value })} style={S.input} />
          </Campo>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={guardar} disabled={guardando} style={S.btnPrimario}>
            {guardando ? 'Guardando…' : 'Crear faena'}
          </button>
          <button onClick={() => setNueva(false)} style={S.btnSecundario}>Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.tarjeta}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#64748B' }}>{faenas.length} faena(s)</span>
        {puedeEditar && <button onClick={() => setNueva(true)} style={S.btnPrimario}>+ Nueva faena</button>}
      </div>

      {faenas.length === 0 ? (
        <p style={{ color: '#94A3B8', fontSize: 14 }}>
          Aún no hay faenas. Crea la primera para empezar a cargar su carpeta de arranque.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {faenas.map(f => {
            const pct = Number(f.porcentaje || 0)
            const color = pct === 100 ? '#059669' : pct >= 60 ? '#B8860B' : '#DC2626'
            return (
              <div key={f.faena_id} onClick={() => onAbrir(f)} style={S.fila}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, color: '#0E2A45', fontSize: 15 }}>{f.nombre}</div>
                  <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                    {f.cliente}{f.sede ? ` · ${f.sede}` : ''}
                    {f.fecha_inicio ? ` · desde ${f.fecha_inicio}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{f.trabajadores} personas</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{f.vehiculos} vehículos</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{pct}%</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>
                    {f.presentes}/{f.exigidos} documentos
                  </div>
                  {Number(f.vencidos) > 0 && (
                    <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700 }}>
                      {f.vencidos} vencido(s)
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Detalle de una faena ─────────────────────────────────────
function DetalleFaena({ faena, puedeEditar, onVolver, onError }) {
  const [tab, setTab] = useState('empresa')
  const [docs, setDocs] = useState([])
  const [personal, setPersonal] = useState([])
  const [asignados, setAsignados] = useState([])
  const [flota, setFlota] = useState([])
  const [autos, setAutos] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [d, p, ap, v, av] = await Promise.all([
      supabase.from('v_arranque_documentos').select('*').eq('faena_id', faena.faena_id).order('orden'),
      supabase.from('personal').select('id,nombre,apellido,cargo,sede').eq('activo', true).order('nombre'),
      supabase.from('arranque_personal').select('*, personal(nombre,apellido,cargo)').eq('faena_id', faena.faena_id),
      supabase.from('vehiculos').select('id,patente,codigo_interno,descripcion').eq('activo', true),
      supabase.from('arranque_vehiculos').select('*, vehiculos(patente,codigo_interno,descripcion)').eq('faena_id', faena.faena_id),
    ])
    setDocs(d.data || []); setPersonal(p.data || []); setAsignados(ap.data || [])
    setFlota(v.data || []); setAutos(av.data || [])
    setCargando(false)
  }, [faena.faena_id])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <button onClick={onVolver} style={S.volver}>← Volver a faenas</button>

      <div style={{ ...S.tarjeta, marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: '#0E2A45', fontSize: 20 }}>{faena.nombre}</h2>
        <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 4 }}>
          {faena.cliente} · {faena.sede || '—'}
          {faena.fecha_inicio ? ` · inicio ${faena.fecha_inicio}` : ''}
        </div>
      </div>

      <div style={S.tabs}>
        {[['empresa','Empresa'], ['personal','Personal'], ['vehiculos','Vehículos']].map(([id, t]) => (
          <button key={id} onClick={() => setTab(id)} style={S.tab(tab === id)}>{t}</button>
        ))}
      </div>

      {cargando ? <p style={{ color: '#64748B' }}>Cargando…</p> : (
        <>
          {tab === 'empresa' && (
            <DocsFaena docs={docs} faenaId={faena.faena_id}
              puedeEditar={puedeEditar} onCambio={cargar} onError={onError} />
          )}
          {tab === 'personal' && (
            <PersonalFaena faenaId={faena.faena_id} personal={personal} asignados={asignados}
              puedeEditar={puedeEditar} onCambio={cargar} onError={onError} />
          )}
          {tab === 'vehiculos' && (
            <VehiculosFaena faenaId={faena.faena_id} flota={flota} autos={autos}
              puedeEditar={puedeEditar} onCambio={cargar} onError={onError} />
          )}
        </>
      )}
    </div>
  )
}

// ── Los 15 documentos de empresa ─────────────────────────────
function DocsFaena({ docs, faenaId, puedeEditar, onCambio, onError }) {
  const [subiendo, setSubiendo] = useState(null)

  async function subir(doc, archivo, fechaEmision) {
    if (!archivo) return
    setSubiendo(doc.tipo_codigo)
    try {
      const ruta = `arranque/${faenaId}/${doc.tipo_codigo}_${Date.now()}_${archivo.name}`
      const { error: eUp } = await supabase.storage
        .from('documentos-ot').upload(ruta, archivo, { upsert: true })
      if (eUp) throw eUp
      const { data: url } = supabase.storage.from('documentos-ot').getPublicUrl(ruta)

      const { data: tipo } = await supabase.from('arranque_tipos_documento')
        .select('vigencia_meses').eq('codigo', doc.tipo_codigo).maybeSingle()

      const emision = fechaEmision || hoy()
      const vence = tipo?.vigencia_meses ? sumarMeses(emision, tipo.vigencia_meses) : null

      const { error } = await supabase.from('arranque_documentos').upsert({
        faena_id: faenaId, tipo_codigo: doc.tipo_codigo,
        nombre_archivo: archivo.name, archivo_url: url.publicUrl,
        fecha_emision: emision, fecha_vencimiento: vence,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'faena_id,tipo_codigo' })
      if (error) throw error
      onCambio()
    } catch (e) { onError(e.message) }
    finally { setSubiendo(null) }
  }

  return (
    <div style={S.tarjeta}>
      <div style={{ display: 'grid', gap: 8 }}>
        {docs.map(d => {
          const c = COLOR_ESTADO[d.estado] || COLOR_ESTADO['Faltante']
          return (
            <div key={d.tipo_codigo} style={S.docFila}>
              <div style={{ width: 26, fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>
                {String(d.orden).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0E2A45' }}>{d.documento}</div>
                {d.fecha_vencimiento && (
                  <div style={{ fontSize: 11.5, color: '#64748B' }}>
                    vence {d.fecha_vencimiento}
                  </div>
                )}
              </div>
              <span style={{ ...S.badge, background: c.bg, color: c.fg }}>{d.estado}</span>
              {d.archivo_url && (
                <a href={d.archivo_url} target="_blank" rel="noreferrer" style={S.link}>Ver</a>
              )}
              {puedeEditar && (
                <label style={S.btnSubir}>
                  {subiendo === d.tipo_codigo ? 'Subiendo…' : (d.documento_id ? 'Reemplazar' : 'Subir')}
                  <input type="file" style={{ display: 'none' }}
                    onChange={e => subir(d, e.target.files?.[0])} />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Personal asignado a la faena ─────────────────────────────
function PersonalFaena({ faenaId, personal, asignados, puedeEditar, onCambio, onError }) {
  const [sel, setSel] = useState('')
  const [conductor, setConductor] = useState(false)

  const yaAsignados = new Set(asignados.map(a => a.personal_id))
  const disponibles = personal.filter(p => !yaAsignados.has(p.id))

  async function agregar() {
    if (!sel) return
    try {
      const { error } = await supabase.from('arranque_personal')
        .insert({ faena_id: faenaId, personal_id: sel, es_conductor: conductor })
      if (error) throw error
      setSel(''); setConductor(false); onCambio()
    } catch (e) { onError(e.message) }
  }

  async function quitar(personalId) {
    try {
      const { error } = await supabase.from('arranque_personal')
        .delete().eq('faena_id', faenaId).eq('personal_id', personalId)
      if (error) throw error
      onCambio()
    } catch (e) { onError(e.message) }
  }

  return (
    <div style={S.tarjeta}>
      {puedeEditar && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...S.input, maxWidth: 340 }}>
            <option value="">Agregar trabajador…</option>
            {disponibles.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellido || ''}{p.cargo ? ` — ${p.cargo}` : ''}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={conductor} onChange={e => setConductor(e.target.checked)} />
            Conduce vehículo
          </label>
          <button onClick={agregar} disabled={!sel} style={S.btnPrimario}>Agregar</button>
        </div>
      )}

      {asignados.length === 0 ? (
        <p style={{ color: '#94A3B8', fontSize: 14 }}>
          Sin trabajadores asignados. Este es el listado que exige el DS 76.
        </p>
      ) : (
        <table style={S.tabla}>
          <thead>
            <tr>
              <th style={S.th}>Trabajador</th>
              <th style={S.th}>Cargo</th>
              <th style={S.th}>Conduce</th>
              <th style={S.th}>Alta</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {asignados.map(a => (
              <tr key={a.personal_id}>
                <td style={S.td}>
                  {a.personal?.nombre} {a.personal?.apellido || ''}
                </td>
                <td style={{ ...S.td, color: '#64748B', fontSize: 12.5 }}>{a.personal?.cargo || '—'}</td>
                <td style={S.td}>{a.es_conductor ? 'Sí' : '—'}</td>
                <td style={{ ...S.td, fontSize: 12.5, color: '#64748B' }}>{a.fecha_alta}</td>
                <td style={S.td}>
                  {puedeEditar && (
                    <button onClick={() => quitar(a.personal_id)} style={S.btnQuitar}>Quitar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Vehículos asignados a la faena ───────────────────────────
function VehiculosFaena({ faenaId, flota, autos, puedeEditar, onCambio, onError }) {
  const [sel, setSel] = useState('')
  const ya = new Set(autos.map(a => a.vehiculo_id))
  const disponibles = flota.filter(v => !ya.has(v.id))

  async function agregar() {
    if (!sel) return
    try {
      const { error } = await supabase.from('arranque_vehiculos')
        .insert({ faena_id: faenaId, vehiculo_id: sel })
      if (error) throw error
      setSel(''); onCambio()
    } catch (e) { onError(e.message) }
  }

  async function quitar(vehiculoId) {
    try {
      const { error } = await supabase.from('arranque_vehiculos')
        .delete().eq('faena_id', faenaId).eq('vehiculo_id', vehiculoId)
      if (error) throw error
      onCambio()
    } catch (e) { onError(e.message) }
  }

  return (
    <div style={S.tarjeta}>
      {puedeEditar && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...S.input, maxWidth: 340 }}>
            <option value="">Autorizar vehículo…</option>
            {disponibles.map(v => (
              <option key={v.id} value={v.id}>
                {v.codigo_interno || v.patente} — {v.descripcion || ''}
              </option>
            ))}
          </select>
          <button onClick={agregar} disabled={!sel} style={S.btnPrimario}>Agregar</button>
        </div>
      )}

      {autos.length === 0 ? (
        <p style={{ color: '#94A3B8', fontSize: 14 }}>Sin vehículos autorizados en esta faena.</p>
      ) : (
        <table style={S.tabla}>
          <thead>
            <tr>
              <th style={S.th}>Código</th>
              <th style={S.th}>Patente</th>
              <th style={S.th}>Descripción</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {autos.map(a => (
              <tr key={a.vehiculo_id}>
                <td style={{ ...S.td, fontWeight: 700 }}>{a.vehiculos?.codigo_interno || '—'}</td>
                <td style={{ ...S.td, fontFamily: 'monospace' }}>{a.vehiculos?.patente}</td>
                <td style={{ ...S.td, color: '#64748B' }}>{a.vehiculos?.descripcion || '—'}</td>
                <td style={S.td}>
                  {puedeEditar && (
                    <button onClick={() => quitar(a.vehiculo_id)} style={S.btnQuitar}>Quitar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Flota ────────────────────────────────────────────────────
function ListaFlota({ flota, puedeEditar, onAbrir, onCreado, onError }) {
  const [nuevo, setNuevo] = useState(false)
  const vacio = { patente: '', codigo_interno: '', descripcion: '', tipo: '',
                  marca: '', modelo: '', anio: '', sede: 'SCL' }
  const [v, setV] = useState(vacio)

  async function guardar() {
    if (!v.patente.trim()) return onError('La patente es obligatoria')
    try {
      const { error } = await supabase.from('vehiculos').insert({
        ...v, anio: v.anio ? Number(v.anio) : null,
      })
      if (error) throw error
      setV(vacio); setNuevo(false); onCreado()
    } catch (e) { onError(e.message) }
  }

  if (nuevo) {
    return (
      <div style={S.tarjeta}>
        <h3 style={{ margin: '0 0 16px', color: '#0E2A45' }}>Nuevo vehículo</h3>
        <div style={S.grid2}>
          <Campo label="Patente *">
            <input value={v.patente} placeholder="ABCD-12"
              onChange={e => setV({ ...v, patente: e.target.value.toUpperCase() })} style={S.input} />
          </Campo>
          <Campo label="Código interno">
            <input value={v.codigo_interno} placeholder="WSSP-04"
              onChange={e => setV({ ...v, codigo_interno: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Descripción">
            <input value={v.descripcion} onChange={e => setV({ ...v, descripcion: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Tipo">
            <input value={v.tipo} placeholder="Camioneta, camión, van"
              onChange={e => setV({ ...v, tipo: e.target.value })} style={S.input} />
          </Campo>
          <Campo label="Marca"><input value={v.marca}
            onChange={e => setV({ ...v, marca: e.target.value })} style={S.input} /></Campo>
          <Campo label="Modelo"><input value={v.modelo}
            onChange={e => setV({ ...v, modelo: e.target.value })} style={S.input} /></Campo>
          <Campo label="Año"><input type="number" value={v.anio}
            onChange={e => setV({ ...v, anio: e.target.value })} style={S.input} /></Campo>
          <Campo label="Sede">
            <select value={v.sede} onChange={e => setV({ ...v, sede: e.target.value })} style={S.input}>
              <option>SCL</option><option>ANF</option><option>CCP</option>
            </select>
          </Campo>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={guardar} style={S.btnPrimario}>Registrar vehículo</button>
          <button onClick={() => setNuevo(false)} style={S.btnSecundario}>Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.tarjeta}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#64748B' }}>{flota.length} vehículo(s)</span>
        {puedeEditar && <button onClick={() => setNuevo(true)} style={S.btnPrimario}>+ Nuevo vehículo</button>}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {flota.map(v => {
          const pct = Number(v.porcentaje || 0)
          const color = pct === 100 ? '#059669' : pct >= 60 ? '#B8860B' : '#DC2626'
          return (
            <div key={v.vehiculo_id} onClick={() => onAbrir(v)} style={S.fila}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700, color: '#0E2A45', fontSize: 15 }}>
                  {v.codigo_interno || v.patente}
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748B', marginLeft: 10 }}>
                    {v.patente}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  {v.tipo_vehiculo || 'Sin tipo'}{v.sede ? ` · ${v.sede}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 120 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{pct}%</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{v.vigentes}/{v.exigidos} vigentes</div>
                {Number(v.vencidos) > 0 && (
                  <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700 }}>
                    {v.vencidos} vencido(s)
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Documentos de un vehículo ────────────────────────────────
function DetalleVehiculo({ vehiculo, puedeEditar, onVolver, onError }) {
  const [docs, setDocs] = useState([])
  const [subiendo, setSubiendo] = useState(null)
  const [emision, setEmision] = useState({})

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('v_vehiculos_documentos')
      .select('*').eq('vehiculo_id', vehiculo.vehiculo_id).order('orden')
    setDocs(data || [])
  }, [vehiculo.vehiculo_id])

  useEffect(() => { cargar() }, [cargar])

  async function subir(doc, archivo) {
    if (!archivo) return
    const fEmision = emision[doc.tipo_codigo] || hoy()
    setSubiendo(doc.tipo_codigo)
    try {
      const ruta = `vehiculos/${vehiculo.vehiculo_id}/${doc.tipo_codigo}_${Date.now()}_${archivo.name}`
      const { error: eUp } = await supabase.storage
        .from('documentos-ot').upload(ruta, archivo, { upsert: true })
      if (eUp) throw eUp
      const { data: url } = supabase.storage.from('documentos-ot').getPublicUrl(ruta)

      const { data: tipo } = await supabase.from('vehiculos_tipos_documento')
        .select('vigencia_meses').eq('codigo', doc.tipo_codigo).maybeSingle()
      const vence = tipo?.vigencia_meses ? sumarMeses(fEmision, tipo.vigencia_meses) : null

      const { error } = await supabase.from('vehiculos_documentos').upsert({
        vehiculo_id: vehiculo.vehiculo_id, tipo_codigo: doc.tipo_codigo,
        nombre_archivo: archivo.name, archivo_url: url.publicUrl,
        fecha_emision: fEmision, fecha_vencimiento: vence,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'vehiculo_id,tipo_codigo' })
      if (error) throw error
      cargar()
    } catch (e) { onError(e.message) }
    finally { setSubiendo(null) }
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <button onClick={onVolver} style={S.volver}>← Volver a la flota</button>

      <div style={{ ...S.tarjeta, marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: '#0E2A45', fontSize: 20 }}>
          {vehiculo.codigo_interno || vehiculo.patente}
        </h2>
        <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 4 }}>
          Patente {vehiculo.patente} · {vehiculo.tipo_vehiculo || 'sin tipo'}
        </div>
      </div>

      <div style={S.tarjeta}>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B' }}>
          Indica la fecha de emisión antes de subir. El vencimiento se calcula solo.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {docs.map(d => {
            const c = COLOR_ESTADO[d.estado] || COLOR_ESTADO['Faltante']
            return (
              <div key={d.tipo_codigo} style={S.docFila}>
                <div style={{ flex: 1, minWidth: 170 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0E2A45' }}>{d.documento}</div>
                  {d.fecha_vencimiento && (
                    <div style={{ fontSize: 11.5, color: d.dias_restantes < 30 ? '#B45309' : '#64748B' }}>
                      vence {d.fecha_vencimiento}
                      {d.dias_restantes != null && ` · ${d.dias_restantes} días`}
                    </div>
                  )}
                </div>
                <span style={{ ...S.badge, background: c.bg, color: c.fg }}>{d.estado}</span>
                {puedeEditar && (
                  <input type="date" value={emision[d.tipo_codigo] || hoy()}
                    onChange={e => setEmision({ ...emision, [d.tipo_codigo]: e.target.value })}
                    style={{ ...S.input, width: 150 }} title="Fecha de emisión" />
                )}
                {d.archivo_url && (
                  <a href={d.archivo_url} target="_blank" rel="noreferrer" style={S.link}>Ver</a>
                )}
                {puedeEditar && (
                  <label style={S.btnSubir}>
                    {subiendo === d.tipo_codigo ? 'Subiendo…' : (d.documento_id ? 'Reemplazar' : 'Subir')}
                    <input type="file" style={{ display: 'none' }}
                      onChange={e => subir(d, e.target.files?.[0])} />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Conductores ──────────────────────────────────────────────
function ListaConductores({ filas }) {
  const porPersona = {}
  filas.forEach(f => {
    if (!porPersona[f.personal_id]) porPersona[f.personal_id] = { nombre: f.conductor, docs: [] }
    porPersona[f.personal_id].docs.push(f)
  })
  const lista = Object.entries(porPersona)

  return (
    <div style={S.tarjeta}>
      {lista.length === 0 ? (
        <p style={{ color: '#94A3B8', fontSize: 14 }}>
          Nadie está marcado como conductor. Se marca al asignar personal a una faena.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {lista.map(([id, p]) => (
            <div key={id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, color: '#0E2A45', marginBottom: 8 }}>{p.nombre}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {p.docs.map(d => {
                  const c = COLOR_ESTADO[d.estado] || COLOR_ESTADO['Faltante']
                  return (
                    <div key={d.tipo_codigo} style={{
                      background: c.bg, color: c.fg, borderRadius: 8,
                      padding: '7px 12px', fontSize: 12.5,
                    }}>
                      <div style={{ fontWeight: 700 }}>{d.documento}</div>
                      <div style={{ fontSize: 11 }}>
                        {d.estado}{d.fecha_vencimiento ? ` · ${d.fecha_vencimiento}` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
  return <div><label style={S.label}>{label}</label>{children}</div>
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
  fila: {
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px',
    cursor: 'pointer', background: '#fff',
  },
  docFila: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    borderBottom: '1px solid #F1F5F9', paddingBottom: 10,
  },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 5 },
  input: { width: '100%', padding: '9px 11px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '9px 10px', borderBottom: '2px solid #E2E8F0', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px' },
  td: { padding: '9px 10px', borderBottom: '1px solid #F1F5F9' },
  badge: { fontSize: 10.5, fontWeight: 700, padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' },
  link: { fontSize: 12.5, color: '#185FA5', fontWeight: 700, textDecoration: 'none' },
  btnPrimario: { background: '#0E2A45', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnSecundario: { background: '#fff', color: '#475569', border: '1px solid #CBD5E1', borderRadius: 9, padding: '10px 18px', fontSize: 14, cursor: 'pointer' },
  btnSubir: { background: '#185FA5', color: '#fff', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnQuitar: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 7, padding: '4px 12px', fontSize: 12, cursor: 'pointer' },
  volver: { background: 'none', border: 'none', color: '#185FA5', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 14 },
  aviso: { background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13.5 },
  error: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13.5 },
}
