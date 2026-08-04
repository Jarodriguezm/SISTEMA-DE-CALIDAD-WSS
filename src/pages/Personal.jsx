// ============================================================
// Personal.jsx — Control documental del personal de la División
// Matriz de cumplimiento + ficha individual + alertas
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { supabase, mensajeError } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const SEDES = ['', 'SCL', 'ANF', 'CCP']
const AREAS = ['', 'END', 'IZL', 'TRZ', 'VER', 'Admin']

const NOMBRE_SEDE = { SCL: 'Santiago', ANF: 'Antofagasta', CCP: 'Concepción' }

const EST = {
  'VIGENTE':       { lbl: 'Vigente',    bg: '#D1FAE5', fg: '#065F46', ico: '✓' },
  'POR VENCER 60': { lbl: '60 días',    bg: '#DBEAFE', fg: '#1D4ED8', ico: '•' },
  'POR VENCER 30': { lbl: '30 días',    bg: '#FEF3C7', fg: '#92400E', ico: '!' },
  'VENCIDO':       { lbl: 'Vencido',    bg: '#FEE2E2', fg: '#991B1B', ico: '✕' },
  'FALTANTE':      { lbl: 'Falta',      bg: '#F1F5F9', fg: '#64748B', ico: '–' },
  'SIN FECHA':     { lbl: 'Sin fecha',  bg: '#EDE9FE', fg: '#5B21B6', ico: '?' },
}

const VACIO = {
  rut: '', nombre: '', apellido: '', email: '', telefono: '',
  cargo: '', area: 'END', sede: '', jefe_directo: '', jefe_email: '',
  fecha_ingreso: '', nivel_snt: '', carpeta_drive_url: '', observacion: '',
}

export default function Personal() {
  const { usuario, esAdmin } = useAuth()

  const [vista,      setVista]      = useState('resumen')   // resumen | matriz | alertas
  const [cumpl,      setCumpl]      = useState([])
  const [estados,    setEstados]    = useState([])
  const [tipos,      setTipos]      = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [error,      setError]      = useState('')
  const [ok,         setOk]         = useState('')

  const [busqueda,   setBusqueda]   = useState('')
  const [fSede,      setFSede]      = useState('')
  const [fArea,      setFArea]      = useState('')
  const [fEstado,    setFEstado]    = useState('')

  const [ficha,      setFicha]      = useState(null)        // personal_id abierto
  const [form,       setForm]       = useState(null)        // alta/edición
  const [guardando,  setGuardando]  = useState(false)
  const [editDoc,    setEditDoc]    = useState(null)

  // ── carga ────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    try {
      setCargando(true); setError('')
      const [c, e, t] = await Promise.all([
        supabase.from('v_personal_cumplimiento').select('*').order('nombre_completo'),
        supabase.from('v_estado_documentos_personal').select('*'),
        supabase.from('tipos_documento_personal').select('*').eq('activo', true).order('orden'),
      ])
      if (c.error) throw c.error
      if (e.error) throw e.error
      if (t.error) throw t.error
      setCumpl(c.data || []); setEstados(e.data || []); setTipos(t.data || [])
    } catch (err) { setError(mensajeError(err)) }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── filtrado ─────────────────────────────────────────────
  const personas = cumpl.filter(p => {
    if (fSede && p.sede !== fSede) return false
    if (fArea && p.area !== fArea) return false
    if (fEstado === 'incompletos' && Number(p.pct_cumplimiento) === 100) return false
    if (fEstado === 'vencidos'    && !Number(p.vencidos)) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (![p.nombre_completo, p.rut, p.cargo, p.email]
        .some(v => String(v || '').toLowerCase().includes(q))) return false
    }
    return true
  })

  const idsVisibles = new Set(personas.map(p => p.personal_id))
  const alertas = estados.filter(e =>
    e.obligatorio && idsVisibles.has(e.personal_id) &&
    ['VENCIDO','FALTANTE','POR VENCER 30','POR VENCER 60','SIN FECHA'].includes(e.estado)
  ).sort((a, b) => {
    const o = { 'VENCIDO':1,'FALTANTE':2,'POR VENCER 30':3,'SIN FECHA':4,'POR VENCER 60':5 }
    return (o[a.estado] - o[b.estado]) || a.nombre_completo.localeCompare(b.nombre_completo)
  })

  const kpi = {
    personas:  personas.length,
    completos: personas.filter(p => Number(p.pct_cumplimiento) === 100).length,
    vencidos:  alertas.filter(a => a.estado === 'VENCIDO').length,
    faltantes: alertas.filter(a => a.estado === 'FALTANTE').length,
    porVencer: alertas.filter(a => a.estado.startsWith('POR VENCER')).length,
  }

  // ── acciones ─────────────────────────────────────────────
  async function guardarPersona() {
    if (!form?.nombre?.trim()) { setError('El nombre es obligatorio'); return }
    try {
      setGuardando(true)
      const payload = { ...form }
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      const { error: err } = form.id
        ? await supabase.from('personal').update(payload).eq('id', form.id)
        : await supabase.from('personal').insert(payload)
      if (err) throw err
      setOk(form.id ? 'Trabajador actualizado' : 'Trabajador agregado')
      setTimeout(() => setOk(''), 4000)
      setForm(null); cargar()
    } catch (e) { setError(mensajeError(e)) }
    finally { setGuardando(false) }
  }

  async function guardarDocumento() {
    if (!editDoc) return
    try {
      setGuardando(true)
      const payload = {
        personal_id:       editDoc.personal_id,
        tipo_codigo:       editDoc.tipo_codigo,
        fecha_emision:     editDoc.fecha_emision     || null,
        fecha_vencimiento: editDoc.fecha_vencimiento || null,
        drive_url:         editDoc.drive_url         || null,
        nombre_archivo:    editDoc.nombre_archivo    || null,
        observacion:       editDoc.observacion       || null,
        cargado_por: ((usuario?.nombre || '') + ' ' + (usuario?.apellido || '')).trim()
                     || usuario?.email || 'Sistema',
      }
      const { error: err } = await supabase
        .from('documentos_personal')
        .upsert(payload, { onConflict: 'personal_id,tipo_codigo' })
      if (err) throw err
      setOk('Documento registrado')
      setTimeout(() => setOk(''), 4000)
      setEditDoc(null); cargar()
    } catch (e) { setError(mensajeError(e)) }
    finally { setGuardando(false) }
  }

  async function enviarResumen() {
    if (!window.confirm('¿Enviar el resumen de documentos pendientes por correo?')) return
    try {
      const { data, error: err } = await supabase.rpc('fn_enviar_alertas_personal')
      if (err) throw err
      setOk(data?.enviado
        ? `Correo enviado · ${data.pendientes} pendientes informados`
        : `Sin envío: ${data?.motivo || 'nada pendiente'}`)
      setTimeout(() => setOk(''), 7000)
    } catch (e) { setError('No se pudo enviar: ' + mensajeError(e)) }
  }

  const docsDe = id => estados.filter(e => e.personal_id === id)
    .sort((a, b) => (tipos.find(t => t.codigo === a.tipo_codigo)?.orden || 0)
                  - (tipos.find(t => t.codigo === b.tipo_codigo)?.orden || 0))

  const personaFicha = ficha ? cumpl.find(p => p.personal_id === ficha) : null

  // ── render ───────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Personal</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            Control documental · División Inspecciones Industriales
          </p>
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={cargar}>↻ Actualizar</button>
          <button className="btn btn-secondary btn-sm" onClick={enviarResumen}>
            ✉ Enviar resumen
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setForm({ ...VACIO })}>
            + Agregar trabajador
          </button>
        </div>
      </div>

      {ok    && <div className="alert alert-ok"    style={{ marginBottom: 14 }}>✅ {ok}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠ {error}</div>}

      {/* KPIs */}
      <div style={S.kpis}>
        <Kpi n={kpi.personas}  t="Trabajadores"      c="#0E2A45" />
        <Kpi n={kpi.completos} t="Carpeta completa"  c="#059669" />
        <Kpi n={kpi.vencidos}  t="Vencidos"          c="#DC2626" alerta={kpi.vencidos > 0} />
        <Kpi n={kpi.faltantes} t="Faltantes"         c="#B45309" alerta={kpi.faltantes > 0} />
        <Kpi n={kpi.porVencer} t="Por vencer"        c="#D97706" />
      </div>

      {/* Filtros */}
      <div className="card" style={{ margin: '16px 0', padding: '14px 18px' }}>
        <div className="grid" style={{ alignItems: 'end' }}>
          <div className="col-4 field">
            <label>Buscar</label>
            <input className="input" placeholder="Nombre, RUT, cargo..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="col-2 field">
            <label>Sede</label>
            <select className="select" value={fSede} onChange={e => setFSede(e.target.value)}>
              {SEDES.map(s => <option key={s} value={s}>{s ? (NOMBRE_SEDE[s] || s) : 'Todas'}</option>)}
            </select>
          </div>
          <div className="col-2 field">
            <label>Área</label>
            <select className="select" value={fArea} onChange={e => setFArea(e.target.value)}>
              {AREAS.map(a => <option key={a} value={a}>{a || 'Todas'}</option>)}
            </select>
          </div>
          <div className="col-4 field">
            <label>Estado</label>
            <select className="select" value={fEstado} onChange={e => setFEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="incompletos">Con documentos pendientes</option>
              <option value="vencidos">Con documentos vencidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[['resumen','Resumen por persona'],['matriz','Matriz documental'],['alertas',`Por regularizar (${alertas.length})`]]
          .map(([id, lbl]) => (
            <button key={id} onClick={() => setVista(id)}
              style={{ ...S.tab, ...(vista === id ? S.tabOn : {}) }}>{lbl}</button>
        ))}
      </div>

      {cargando && <div className="loading-bar" style={{ marginBottom: 16 }} />}

      {!cargando && personas.length === 0 && (
        <div className="empty-state">
          No hay personal registrado. Usa "+ Agregar trabajador" para comenzar.
        </div>
      )}

      {/* ── RESUMEN ── */}
      {!cargando && vista === 'resumen' && personas.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Trabajador</th><th>RUT</th><th>Cargo</th><th>Área</th><th>Sede</th>
                  <th>Cumplimiento</th><th>Pendientes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {personas.map(p => {
                  const pct = Number(p.pct_cumplimiento) || 0
                  const col = pct === 100 ? '#059669' : pct >= 70 ? '#D97706' : '#DC2626'
                  return (
                    <tr key={p.personal_id}>
                      <td style={{ fontWeight: 700, color: '#1A3A5C' }}>{p.nombre_completo}</td>
                      <td className="text-sm">{p.rut || '—'}</td>
                      <td className="text-sm">{p.cargo || '—'}</td>
                      <td className="text-sm">{p.area || '—'}</td>
                      <td className="text-sm">{NOMBRE_SEDE[p.sede] || p.sede || '—'}</td>
                      <td style={{ minWidth: 150 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={S.barra}>
                            <div style={{ ...S.barraFill, width: `${pct}%`, background: col }} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: 13, color: col, minWidth: 34 }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Number(p.vencidos)   > 0 && <Pill n={p.vencidos}   l="venc"  c="#991B1B" b="#FEE2E2" />}
                          {Number(p.faltantes)  > 0 && <Pill n={p.faltantes}  l="falta" c="#92400E" b="#FEF3C7" />}
                          {Number(p.por_vencer) > 0 && <Pill n={p.por_vencer} l="pronto" c="#1D4ED8" b="#DBEAFE" />}
                          {pct === 100 && <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>Al día</span>}
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => setFicha(p.personal_id)}>Ver ficha</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MATRIZ ── */}
      {!cargando && vista === 'matriz' && personas.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#0E2A45', zIndex: 2, minWidth: 180 }}>
                    Trabajador
                  </th>
                  {tipos.map(t => (
                    <th key={t.codigo} title={t.nombre}
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                               height: 130, padding: '8px 3px', fontSize: 10.5, whiteSpace: 'nowrap' }}>
                      {t.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personas.map(p => {
                  const docs = docsDe(p.personal_id)
                  return (
                    <tr key={p.personal_id}>
                      <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1,
                                   fontWeight: 700, color: '#1A3A5C', cursor: 'pointer' }}
                          onClick={() => setFicha(p.personal_id)}>
                        {p.nombre_completo}
                      </td>
                      {tipos.map(t => {
                        const d = docs.find(x => x.tipo_codigo === t.codigo)
                        const e = EST[d?.estado] || EST['FALTANTE']
                        return (
                          <td key={t.codigo} style={{ textAlign: 'center', padding: 4 }}
                              title={`${t.nombre}: ${d?.estado || 'FALTANTE'}${d?.fecha_vencimiento ? ' · vence ' + d.fecha_vencimiento : ''}`}>
                            <span
                              onClick={() => setEditDoc({
                                personal_id: p.personal_id, tipo_codigo: t.codigo,
                                tipo_nombre: t.nombre, nombre_completo: p.nombre_completo,
                                fecha_emision: d?.fecha_emision || '',
                                fecha_vencimiento: d?.fecha_vencimiento || '',
                                drive_url: d?.drive_url || '', observacion: d?.observacion || '',
                              })}
                              style={{ ...S.celda, background: e.bg, color: e.fg }}>
                              {e.ico}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={S.leyenda}>
            {Object.entries(EST).map(([k, v]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ ...S.celda, background: v.bg, color: v.fg, cursor: 'default' }}>{v.ico}</span>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>{v.lbl}</span>
              </span>
            ))}
            <span style={{ fontSize: 11.5, color: '#94A3B8', marginLeft: 'auto' }}>
              Haz clic en cualquier celda para registrar el documento
            </span>
          </div>
        </div>
      )}

      {/* ── ALERTAS ── */}
      {!cargando && vista === 'alertas' && (
        alertas.length === 0
          ? <div className="empty-state">Sin documentos pendientes con los filtros actuales.</div>
          : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla">
                  <thead>
                    <tr><th>Estado</th><th>Trabajador</th><th>Sede</th><th>Documento</th>
                        <th>Categoría</th><th>Vence</th><th>Días</th><th></th></tr>
                  </thead>
                  <tbody>
                    {alertas.map((a, i) => {
                      const e = EST[a.estado] || EST['FALTANTE']
                      return (
                        <tr key={i}>
                          <td>
                            <span style={{ ...S.badge, background: e.bg, color: e.fg }}>{e.lbl}</span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#1A3A5C' }}>{a.nombre_completo}</td>
                          <td className="text-sm">{a.sede || '—'}</td>
                          <td className="text-sm">{a.tipo_nombre}</td>
                          <td className="text-sm" style={{ color: '#64748B' }}>{a.categoria}</td>
                          <td className="text-sm">{a.fecha_vencimiento || '—'}</td>
                          <td className="text-sm" style={{
                            fontWeight: 700,
                            color: a.dias_restantes < 0 ? '#DC2626' : '#64748B',
                          }}>
                            {a.dias_restantes != null ? a.dias_restantes : '—'}
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => setEditDoc({
                                personal_id: a.personal_id, tipo_codigo: a.tipo_codigo,
                                tipo_nombre: a.tipo_nombre, nombre_completo: a.nombre_completo,
                                fecha_emision: a.fecha_emision || '',
                                fecha_vencimiento: a.fecha_vencimiento || '',
                                drive_url: a.drive_url || '', observacion: a.observacion || '',
                              })}>
                              Regularizar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}

      {/* ── MODAL FICHA ── */}
      {personaFicha && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setFicha(null)}>
          <div style={{ ...S.modal, maxWidth: 900 }}>
            <div style={S.mHead}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 18 }}>{personaFicha.nombre_completo}</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.72)' }}>
                  {personaFicha.cargo || 'Sin cargo'} · {personaFicha.area || '—'} ·{' '}
                  {NOMBRE_SEDE[personaFicha.sede] || personaFicha.sede || '—'} ·{' '}
                  Cumplimiento {personaFicha.pct_cumplimiento}%
                </p>
              </div>
              <button onClick={() => setFicha(null)} style={S.btnX}>✕</button>
            </div>
            <div style={{ padding: '18px 22px', overflowY: 'auto', maxHeight: '72vh' }}>
              <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  const p = cumpl.find(x => x.personal_id === ficha)
                  supabase.from('personal').select('*').eq('id', ficha).single()
                    .then(({ data }) => { if (data) { setForm(data); setFicha(null) } })
                }}>✎ Editar datos</button>
              </div>
              <table className="tabla" style={{ fontSize: 13 }}>
                <thead>
                  <tr><th>Documento</th><th>Categoría</th><th>Emisión</th><th>Vence</th>
                      <th>Estado</th><th>Archivo</th><th></th></tr>
                </thead>
                <tbody>
                  {docsDe(ficha).map(d => {
                    const e = EST[d.estado] || EST['FALTANTE']
                    return (
                      <tr key={d.tipo_codigo}>
                        <td style={{ fontWeight: 600 }}>
                          {d.tipo_nombre}
                          {!d.obligatorio && <span style={S.opt}>opcional</span>}
                        </td>
                        <td className="text-sm" style={{ color: '#64748B' }}>{d.categoria}</td>
                        <td className="text-sm">{d.fecha_emision || '—'}</td>
                        <td className="text-sm">{d.fecha_vencimiento || (d.vence ? '—' : 'No vence')}</td>
                        <td><span style={{ ...S.badge, background: e.bg, color: e.fg }}>{e.lbl}</span></td>
                        <td>
                          {d.drive_url
                            ? <a href={d.drive_url} target="_blank" rel="noopener noreferrer"
                                 style={{ color: '#185FA5', fontWeight: 600, fontSize: 12 }}>Abrir</a>
                            : <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>}
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => setEditDoc({
                              personal_id: ficha, tipo_codigo: d.tipo_codigo,
                              tipo_nombre: d.tipo_nombre, nombre_completo: d.nombre_completo,
                              fecha_emision: d.fecha_emision || '',
                              fecha_vencimiento: d.fecha_vencimiento || '',
                              drive_url: d.drive_url || '', observacion: d.observacion || '',
                            })}>
                            {d.documento_id ? 'Editar' : 'Registrar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DOCUMENTO ── */}
      {editDoc && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && !guardando && setEditDoc(null)}>
          <div style={{ ...S.modal, maxWidth: 560 }}>
            <div style={S.mHead}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 16 }}>{editDoc.tipo_nombre}</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.72)' }}>
                  {editDoc.nombre_completo}
                </p>
              </div>
              <button onClick={() => setEditDoc(null)} style={S.btnX} disabled={guardando}>✕</button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <div className="grid">
                <div className="col-6 field">
                  <label>Fecha de emisión</label>
                  <input className="input" type="date" value={editDoc.fecha_emision}
                    onChange={e => setEditDoc(d => ({ ...d, fecha_emision: e.target.value }))} />
                </div>
                <div className="col-6 field">
                  <label>Fecha de vencimiento</label>
                  <input className="input" type="date" value={editDoc.fecha_vencimiento}
                    onChange={e => setEditDoc(d => ({ ...d, fecha_vencimiento: e.target.value }))} />
                  <span style={S.hint}>Si lo dejas vacío se calcula según la vigencia del tipo.</span>
                </div>
                <div className="col-12 field">
                  <label>Enlace al archivo en Drive</label>
                  <input className="input" placeholder="https://drive.google.com/..."
                    value={editDoc.drive_url}
                    onChange={e => setEditDoc(d => ({ ...d, drive_url: e.target.value }))} />
                  <span style={S.hint}>
                    Carpeta: G:\Mi unidad\AUDITORIA\PERSONAL — copia el enlace del archivo
                  </span>
                </div>
                <div className="col-12 field">
                  <label>Observación</label>
                  <input className="input" placeholder="Opcional"
                    value={editDoc.observacion}
                    onChange={e => setEditDoc(d => ({ ...d, observacion: e.target.value }))} />
                </div>
              </div>
              <div style={S.pie}>
                <button className="btn btn-ghost" onClick={() => setEditDoc(null)} disabled={guardando}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={guardarDocumento} disabled={guardando}>
                  {guardando ? 'Guardando...' : '✓ Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PERSONA ── */}
      {form && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && !guardando && setForm(null)}>
          <div style={{ ...S.modal, maxWidth: 720 }}>
            <div style={S.mHead}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 17 }}>
                {form.id ? 'Editar trabajador' : 'Agregar trabajador'}
              </h2>
              <button onClick={() => setForm(null)} style={S.btnX} disabled={guardando}>✕</button>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto', maxHeight: '72vh' }}>
              <div className="grid">
                <Campo c="4" l="RUT"    v={form.rut}      s={v => setForm(f => ({ ...f, rut: v }))} ph="12.345.678-9" />
                <Campo c="4" l="Nombre *" v={form.nombre} s={v => setForm(f => ({ ...f, nombre: v }))} />
                <Campo c="4" l="Apellido" v={form.apellido} s={v => setForm(f => ({ ...f, apellido: v }))} />
                <Campo c="6" l="Correo"   v={form.email}    s={v => setForm(f => ({ ...f, email: v }))} />
                <Campo c="6" l="Teléfono" v={form.telefono} s={v => setForm(f => ({ ...f, telefono: v }))} />
                <Campo c="6" l="Cargo"    v={form.cargo}    s={v => setForm(f => ({ ...f, cargo: v }))} />
                <div className="col-3 field">
                  <label>Área</label>
                  <select className="select" value={form.area || ''}
                    onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                    {AREAS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="col-3 field">
                  <label>Sede</label>
                  <select className="select" value={form.sede || ''}
                    onChange={e => setForm(f => ({ ...f, sede: e.target.value }))}>
                    <option value="">—</option>
                    {SEDES.filter(Boolean).map(s => <option key={s} value={s}>{NOMBRE_SEDE[s]}</option>)}
                  </select>
                </div>
                <Campo c="6" l="Jefe directo"  v={form.jefe_directo} s={v => setForm(f => ({ ...f, jefe_directo: v }))} />
                <Campo c="6" l="Correo del jefe" v={form.jefe_email}  s={v => setForm(f => ({ ...f, jefe_email: v }))} />
                <div className="col-4 field">
                  <label>Fecha de ingreso</label>
                  <input className="input" type="date" value={form.fecha_ingreso || ''}
                    onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))} />
                </div>
                <Campo c="4" l="Nivel SNT" v={form.nivel_snt} s={v => setForm(f => ({ ...f, nivel_snt: v }))} ph="N1 / N2 / N3" />
                <Campo c="12" l="Carpeta en Drive" v={form.carpeta_drive_url}
                  s={v => setForm(f => ({ ...f, carpeta_drive_url: v }))}
                  ph="Enlace a la carpeta del trabajador en AUDITORIA\PERSONAL" />
                <Campo c="12" l="Observación" v={form.observacion} s={v => setForm(f => ({ ...f, observacion: v }))} />
              </div>
              <div style={S.pie}>
                <button className="btn btn-ghost" onClick={() => setForm(null)} disabled={guardando}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardarPersona} disabled={guardando}>
                  {guardando ? 'Guardando...' : '✓ Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── auxiliares ──────────────────────────────────────────────
function Kpi({ n, t, c, alerta }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 130, textAlign: 'center',
      padding: '14px 12px', borderTop: `4px solid ${c}` }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: c }}>{n}</div>
      <div style={{ fontSize: 12, color: alerta ? c : 'var(--gris)', marginTop: 2,
        fontWeight: alerta ? 700 : 500 }}>{t}</div>
    </div>
  )
}

function Pill({ n, l, c, b }) {
  return <span style={{ background: b, color: c, borderRadius: 20, padding: '2px 9px',
    fontSize: 11, fontWeight: 800 }}>{n} {l}</span>
}

function Campo({ c, l, v, s, ph }) {
  return (
    <div className={`col-${c} field`}>
      <label>{l}</label>
      <input className="input" value={v || ''} placeholder={ph || ''}
        onChange={e => s(e.target.value)} />
    </div>
  )
}

const S = {
  kpis: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  tabs: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  tab: {
    padding: '9px 18px', borderRadius: 9, border: '1.5px solid var(--borde)',
    background: '#fff', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#475569',
  },
  tabOn: { background: '#0E2A45', color: '#fff', borderColor: '#0E2A45' },
  barra: { flex: 1, height: 7, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden', minWidth: 70 },
  barraFill: { height: '100%', borderRadius: 4, transition: 'width .3s' },
  celda: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 24, height: 24, borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer',
  },
  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 },
  opt: { marginLeft: 6, fontSize: 10, color: '#94A3B8', fontWeight: 400 },
  leyenda: {
    display: 'flex', gap: 14, padding: '12px 18px', borderTop: '1px solid var(--borde)',
    flexWrap: 'wrap', alignItems: 'center', background: '#FAFBFC',
  },
  hint: { fontSize: 11, color: 'var(--gris)', marginTop: 3, display: 'block' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 300,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '24px 16px', overflowY: 'auto',
  },
  modal: {
    width: '100%', background: '#fff', borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,.3)', overflow: 'hidden', marginBottom: 24,
  },
  mHead: {
    background: 'linear-gradient(135deg,#0E2A45,#17395C)', padding: '15px 22px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  btnX: {
    background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
    width: 30, height: 30, borderRadius: 8, fontSize: 13, cursor: 'pointer',
  },
  pie: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    paddingTop: 16, borderTop: '1px solid var(--borde)', marginTop: 10,
  },
}
