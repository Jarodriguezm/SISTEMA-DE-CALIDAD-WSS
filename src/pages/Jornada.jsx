// ============================================================
// Jornada.jsx — Horas trabajadas, horas de viaje y ubicación
//
// QUÉ ES: herramienta interna de gestión para controlar HHEE y
// costear traslados. NO es el registro oficial de asistencia: ese
// está regulado por la Resolución Exenta N°38/2024 de la Dirección
// del Trabajo y exige certificación por un tercero independiente más
// autorización expresa de la DT.
//
// Dos vistas:
//   Mi jornada  — el trabajador marca; cuatro botones, nada más
//   Supervisión — horas por persona, ubicación de cada marca, HHEE
//
// SIN SEÑAL: las faenas mineras no siempre tienen cobertura. Las
// marcas se guardan en el teléfono con su hora real y se envían al
// recuperar conexión. Si esto dependiera de tener internet, el módulo
// fallaría justo donde se necesita.
// ============================================================
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ROLES_SUPERVISION = ['ADMIN', 'ADMINISTRADOR', 'SUPERVISOR',
                           'AUDITOR', 'APR', 'PREVENCIONISTA']

const PASOS = [
  { tipo: 'viaje_ida_inicio', label: 'Iniciar viaje',    icono: '🚗',
    ayuda: 'Cuando sales hacia la faena',           color: '#2B5280' },
  { tipo: 'trabajo_inicio',   label: 'Iniciar trabajo',  icono: '🔧',
    ayuda: 'Al llegar y empezar la tarea',          color: '#159A6B' },
  { tipo: 'trabajo_fin',      label: 'Terminar trabajo', icono: '✅',
    ayuda: 'Cuando terminas la tarea en terreno',   color: '#E08A1E' },
  { tipo: 'viaje_vuelta_fin', label: 'Fin del regreso',  icono: '🏁',
    ayuda: 'Al llegar de vuelta. Cierra la jornada', color: '#0E2A45' },
]

const COLA = 'wss_marcas_pendientes'
const hhmm = min => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`
const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtFecha = f => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CL') : '—'

// ═══════════════════════════════════════════════════════════════
export default function Jornada() {
  const { usuario } = useAuth()
  const rol = (usuario?.rol || '').toUpperCase()
  const supervisa = ROLES_SUPERVISION.includes(rol)

  const [vista, setVista] = useState('mia')

  return (
    <div style={{ padding: '20px 24px 60px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#0E2A45' }}>Jornada y horas</h1>
        <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
          Registro de horas de trabajo y de viaje para control interno de HHEE.
          No reemplaza el registro oficial de asistencia.
        </div>
      </div>

      {supervisa && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {[['mia', 'Mi jornada'], ['sup', 'Supervisión']].map(([k, t]) => (
            <button key={k} onClick={() => setVista(k)}
              style={{
                border: '1px solid ' + (vista === k ? '#1E4D7B' : '#DDE5EE'),
                background: vista === k ? '#1E4D7B' : '#fff',
                color: vista === k ? '#fff' : '#334155',
                borderRadius: 8, padding: '8px 16px', fontSize: 13,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t}</button>
          ))}
        </div>
      )}

      {vista === 'mia' ? <MiJornada usuario={usuario} /> : <Supervision />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MI JORNADA — lo que usa el inspector en terreno
// ═══════════════════════════════════════════════════════════════
function MiJornada({ usuario }) {
  const [jornada, setJornada]   = useState(null)
  const [marcas, setMarcas]     = useState([])
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState('')
  const [error, setError]       = useState('')
  const [aviso, setAviso]       = useState('')
  const [otNumero, setOtNumero] = useState('')
  const [referencia, setReferencia] = useState('')
  const [pendientes, setPendientes] = useState(() => leerCola())
  const [enLinea, setEnLinea]   = useState(navigator.onLine)
  const tic = useRef(null)
  const [, forzar] = useState(0)

  // Reloj: el tiempo transcurrido tiene que avanzar a la vista
  useEffect(() => {
    tic.current = setInterval(() => forzar(n => n + 1), 30000)
    return () => clearInterval(tic.current)
  }, [])

  const cargar = useCallback(async () => {
    try {
      setCargando(true)
      const { data: abierta } = await supabase
        .from('jornadas').select('*')
        .eq('email', (usuario?.email || '').toLowerCase())
        .eq('estado', 'abierta').maybeSingle()
      setJornada(abierta || null)

      if (abierta) {
        const { data: ms } = await supabase.from('marcas_jornada')
          .select('*').eq('jornada_id', abierta.id).order('momento')
        setMarcas(ms || [])
      } else setMarcas([])

      const { data: hist } = await supabase.from('v_jornadas')
        .select('*').eq('email', (usuario?.email || '').toLowerCase())
        .order('fecha', { ascending: false }).limit(20)
      setHistorial(hist || [])
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }, [usuario])

  useEffect(() => { cargar() }, [cargar])

  // Reconexión: al volver la señal se vacía la cola
  useEffect(() => {
    const arriba = () => { setEnLinea(true); sincronizar() }
    const abajo  = () => setEnLinea(false)
    window.addEventListener('online', arriba)
    window.addEventListener('offline', abajo)
    if (navigator.onLine && leerCola().length) sincronizar()
    return () => { window.removeEventListener('online', arriba); window.removeEventListener('offline', abajo) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sincronizar() {
    const cola = leerCola()
    if (!cola.length) return
    let quedan = []
    for (const m of cola) {
      const { error: e } = await supabase.rpc('fn_jornada_marcar', m)
      if (e) quedan.push(m)                      // se reintenta la próxima vez
    }
    guardarCola(quedan); setPendientes(quedan)
    if (quedan.length < cola.length) {
      setAviso(`${cola.length - quedan.length} marca(s) sincronizada(s)`)
      cargar()
    }
  }

  // Ubicación: se pide con alta precisión, pero no se bloquea por ella.
  // Una marca sin coordenada vale más que una marca que no se hizo.
  //
  // El GPS NO necesita internet: el receptor del teléfono habla con los
  // satélites directamente. Lo que falta sin datos es la asistencia que
  // acelera la primera lectura, así que en faena sin señal puede tardar
  // bastante más en fijar posición. Por eso el plazo es mayor cuando no
  // hay conexión: conviene esperar 35 segundos antes que perder el punto.
  function ubicar() {
    const sinRed = !navigator.onLine
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null)
      let resuelto = false
      const listo = p => {
        if (resuelto) return
        resuelto = true
        resolve({
          lat: +p.coords.latitude.toFixed(6),
          lng: +p.coords.longitude.toFixed(6),
          precision: Math.round(p.coords.accuracy),
        })
      }
      const falla = () => { if (!resuelto) { resuelto = true; resolve(null) } }
      navigator.geolocation.getCurrentPosition(listo, falla, {
        enableHighAccuracy: true,
        timeout: sinRed ? 35000 : 15000,
        maximumAge: sinRed ? 120000 : 30000,   // sin red, sirve una lectura reciente
      })
    })
  }

  async function marcar(tipo) {
    setError(''); setAviso(''); setEnviando(tipo)
    try {
      const pos = await ubicar()
      const args = {
        p_tipo: tipo,
        p_lat: pos?.lat ?? null,
        p_lng: pos?.lng ?? null,
        p_precision: pos?.precision ?? null,
        p_ot_numero: otNumero.trim() || null,
        p_referencia: referencia.trim() || null,
        p_momento: new Date().toISOString(),
      }
      if (!navigator.onLine) {
        const cola = [...leerCola(), args]
        guardarCola(cola); setPendientes(cola)
        setAviso(pos
          ? `Sin señal: marca guardada con su hora y ubicación reales (${pos.lat}, ${pos.lng}, ±${pos.precision} m). Se enviará sola al recuperar conexión.`
          : 'Sin señal: marca guardada con su hora real, pero el GPS no alcanzó a fijar posición. Se enviará al recuperar conexión.')
        return
      }
      const { error: e } = await supabase.rpc('fn_jornada_marcar', args)
      if (e) throw e
      setReferencia('')
      await cargar()
      setAviso(pos ? 'Marca registrada' : 'Marca registrada, pero sin ubicación: revisa los permisos de GPS.')
    } catch (e) {
      setError(e.message || 'No se pudo registrar la marca')
    } finally { setEnviando('') }
  }

  async function cerrarSinRegreso() {
    if (!confirm('¿Cerrar la jornada sin marcar viaje de regreso?')) return
    setEnviando('cerrar')
    try {
      const { error: e } = await supabase.rpc('fn_jornada_cerrar')
      if (e) throw e
      await cargar(); setAviso('Jornada cerrada')
    } catch (e) { setError(e.message) } finally { setEnviando('') }
  }

  const hechas = new Set(marcas.map(m => m.tipo))
  const siguiente = PASOS.find(p => !hechas.has(p.tipo))
  const mIni = marcas.find(m => m.tipo === 'trabajo_inicio')
  const mFinT = marcas.find(m => m.tipo === 'trabajo_fin')
  const mIda = marcas.find(m => m.tipo === 'viaje_ida_inicio')

  // Tiempo corriendo ahora mismo
  let corriendo = null
  if (mIni && !mFinT) corriendo = { etq: 'Trabajando hace', min: (Date.now() - new Date(mIni.momento)) / 60000 }
  else if (mIda && !mIni) corriendo = { etq: 'En viaje hace', min: (Date.now() - new Date(mIda.momento)) / 60000 }
  else if (mFinT && jornada) corriendo = { etq: 'De regreso hace', min: (Date.now() - new Date(mFinT.momento)) / 60000 }

  if (cargando) return <div style={S.vacio}>Cargando…</div>

  return (
    <div>
      {!enLinea && (
        <div style={{ ...S.alerta, background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E' }}>
          📡 Sin conexión. Sigue marcando igual: el GPS funciona sin internet, así que la hora y la
          ubicación quedan guardadas en el teléfono y se envían solas cuando vuelva la señal.
          Puede tardar hasta medio minuto en fijar posición — no cierres la pantalla mientras marca.
        </div>
      )}
      {pendientes.length > 0 && (
        <div style={{ ...S.alerta, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E3A5F',
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>{pendientes.length} marca(s) esperando enviarse.</span>
          <button onClick={sincronizar} style={S.btnChico} disabled={!enLinea}>Reintentar ahora</button>
        </div>
      )}
      {error && <div style={{ ...S.alerta, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B' }}>⚠ {error}</div>}
      {aviso && <div style={{ ...S.alerta, background: '#F0FDF4', border: '1px solid #A7F3D0', color: '#036C4B' }}>{aviso}</div>}

      {/* ── Estado actual ── */}
      <div style={S.tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: '#0E2A45' }}>
            {jornada ? 'Jornada en curso' : 'Sin jornada abierta'}
          </h2>
          {jornada && (
            <div style={{ fontSize: 12.5, color: '#64748B' }}>
              {fmtFecha(jornada.fecha)}{jornada.ot_numero ? ` · OT ${jornada.ot_numero}` : ''}
            </div>
          )}
        </div>

        {jornada && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <Dato etq="Trabajo"  val={hhmm(jornada.minutos_trabajo)} color="#159A6B" />
            <Dato etq="Viaje"    val={hhmm(jornada.minutos_viaje)}   color="#2B5280" />
            {corriendo && <Dato etq={corriendo.etq} val={hhmm(corriendo.min)} color="#E08A1E" />}
          </div>
        )}

        {/* OT y referencia: solo al abrir la jornada */}
        {!jornada && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <label style={S.lbl}>OT (opcional)</label>
              <input value={otNumero} onChange={e => setOtNumero(e.target.value)}
                placeholder="Ej: OT082629485" style={{ ...S.input, width: 190 }} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={S.lbl}>Lugar / referencia (opcional)</label>
              <input value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="Ej: Planta Mantoverde, sector chancado" style={{ ...S.input, width: '100%' }} />
            </div>
          </div>
        )}

        {/* ── Los cuatro botones ── */}
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))' }}>
          {PASOS.map(p => {
            const hecho = hechas.has(p.tipo)
            const activo = siguiente?.tipo === p.tipo
            const m = marcas.find(x => x.tipo === p.tipo)
            return (
              <button key={p.tipo} onClick={() => marcar(p.tipo)}
                disabled={!activo || !!enviando}
                style={{
                  textAlign: 'left', borderRadius: 12, padding: '14px 16px',
                  border: '1.5px solid ' + (hecho ? '#A7F3D0' : activo ? p.color : '#E2E8F0'),
                  background: hecho ? '#F0FDF4' : activo ? p.color : '#F8FAFC',
                  color: hecho ? '#036C4B' : activo ? '#fff' : '#94A3B8',
                  cursor: activo && !enviando ? 'pointer' : 'default',
                  fontFamily: 'inherit', transition: '.15s',
                }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{p.icono}</div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  {enviando === p.tipo ? 'Registrando…' : p.label}
                </div>
                <div style={{ fontSize: 11.5, marginTop: 3, opacity: .9 }}>
                  {hecho ? `Marcado a las ${fmtHora(m?.momento)}` : p.ayuda}
                </div>
              </button>
            )
          })}
        </div>

        {jornada && hechas.has('trabajo_fin') && !hechas.has('viaje_vuelta_fin') && (
          <button onClick={cerrarSinRegreso} disabled={!!enviando}
            style={{ ...S.btnChico, marginTop: 14 }}>
            Cerrar sin viaje de regreso (trabajé en oficina o taller)
          </button>
        )}
      </div>

      {/* ── Marcas de la jornada en curso ── */}
      {marcas.length > 0 && (
        <div style={S.tarjeta}>
          <h3 style={S.h3}>Marcas de hoy</h3>
          {marcas.map(m => <FilaMarca key={m.id} m={m} />)}
        </div>
      )}

      {/* ── Historial ── */}
      <div style={S.tarjeta}>
        <h3 style={S.h3}>Mis últimas jornadas</h3>
        {historial.length === 0
          ? <div style={S.vacio}>Todavía no hay jornadas registradas</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.tabla}>
                <thead><tr>
                  <th style={S.th}>Fecha</th><th style={S.th}>OT</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Trabajo</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Viaje</th>
                  <th style={S.th}>Estado</th><th style={S.th}>Validada</th>
                </tr></thead>
                <tbody>
                  {historial.map(j => (
                    <tr key={j.id}>
                      <td style={S.td}>{fmtFecha(j.fecha)}</td>
                      <td style={S.td}>{j.ot_numero || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{j.horas_trabajo} h</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{j.horas_viaje} h</td>
                      <td style={S.td}>
                        <span style={j.estado === 'cerrada' ? S.pillOk : S.pillPend}>{j.estado}</span>
                      </td>
                      <td style={S.td}>{j.validada_por ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUPERVISIÓN
// ═══════════════════════════════════════════════════════════════
function Supervision() {
  const { usuario } = useAuth()
  const [jornadas, setJornadas] = useState([])
  const [semanas, setSemanas]   = useState([])
  const [detalle, setDetalle]   = useState(null)
  const [marcas, setMarcas]     = useState([])
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [persona, setPersona] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try {
      setCargando(true); setError('')
      let q = supabase.from('v_jornadas').select('*')
        .gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false })
      const { data, error: e } = await q
      if (e) throw e
      setJornadas(data || [])
      const { data: sem } = await supabase.from('v_hhee_semana')
        .select('*').order('semana', { ascending: false }).limit(60)
      setSemanas(sem || [])
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  async function abrir(j) {
    setDetalle(j)
    const { data } = await supabase.from('marcas_jornada')
      .select('*').eq('jornada_id', j.id).order('momento')
    setMarcas(data || [])
  }

  async function validar(j) {
    const { error: e } = await supabase.from('jornadas')
      .update({ validada_por: usuario?.email, validada_en: new Date().toISOString() })
      .eq('id', j.id)
    if (e) { setError(e.message); return }
    cargar(); if (detalle?.id === j.id) setDetalle({ ...detalle, validada_por: usuario?.email })
  }

  const lista = persona ? jornadas.filter(j => j.persona === persona) : jornadas
  const personas = [...new Set(jornadas.map(j => j.persona))].sort()
  const totTrab = lista.reduce((s, j) => s + Number(j.horas_trabajo || 0), 0)
  const totViaje = lista.reduce((s, j) => s + Number(j.horas_viaje || 0), 0)

  function exportar() {
    const cab = ['Persona', 'Fecha', 'OT', 'Horas trabajo', 'Horas viaje', 'Km aprox', 'Estado', 'Validada por']
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = '﻿' + [cab.join(';')].concat(lista.map(j =>
      [j.persona, j.fecha, j.ot_numero, j.horas_trabajo, j.horas_viaje,
       j.km_estimados, j.estado, j.validada_por].map(esc).join(';'))).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `jornadas_${desde}_${hasta}.csv`; a.click()
  }

  return (
    <div>
      <div style={{ ...S.tarjeta, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={S.lbl}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={S.input} /></div>
        <div><label style={S.lbl}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={S.input} /></div>
        <div><label style={S.lbl}>Persona</label>
          <select value={persona} onChange={e => setPersona(e.target.value)} style={S.input}>
            <option value="">Todas</option>
            {personas.map(p => <option key={p} value={p}>{p}</option>)}
          </select></div>
        <button onClick={exportar} style={S.btnChico} disabled={!lista.length}>⬇ CSV</button>
      </div>

      {error && <div style={{ ...S.alerta, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B' }}>⚠ {error}</div>}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginBottom: 14 }}>
        <Kpi etq="Jornadas" val={lista.length} />
        <Kpi etq="Horas de trabajo" val={totTrab.toFixed(1) + ' h'} color="#159A6B" />
        <Kpi etq="Horas de viaje" val={totViaje.toFixed(1) + ' h'} color="#2B5280" />
        <Kpi etq="Sin validar" val={lista.filter(j => !j.validada_por).length}
             color={lista.some(j => !j.validada_por) ? '#E08A1E' : '#64748B'} />
      </div>

      <div style={S.tarjeta}>
        <h3 style={S.h3}>Jornadas</h3>
        {cargando ? <div style={S.vacio}>Cargando…</div>
          : lista.length === 0 ? <div style={S.vacio}>Sin jornadas en el período</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.tabla}>
                <thead><tr>
                  <th style={S.th}>Persona</th><th style={S.th}>Fecha</th><th style={S.th}>OT</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Trabajo</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Viaje</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Km</th>
                  <th style={S.th}>Ubicación</th><th style={S.th}>Validada</th><th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {lista.map(j => (
                    <tr key={j.id}>
                      <td style={S.td}>{j.persona}</td>
                      <td style={S.td}>{fmtFecha(j.fecha)}</td>
                      <td style={S.td}>{j.ot_numero || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{j.horas_trabajo} h</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{j.horas_viaje} h</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{j.km_estimados ?? '—'}</td>
                      <td style={S.td}>
                        {j.marcas_sin_ubicacion > 0
                          ? <span style={S.pillPend}>{j.marcas_sin_ubicacion} sin GPS</span>
                          : <span style={S.pillOk}>completa</span>}
                        {j.marcas_diferidas > 0 &&
                          <span style={{ ...S.pillPend, marginLeft: 4 }}>{j.marcas_diferidas} diferida(s)</span>}
                      </td>
                      <td style={S.td}>{j.validada_por ? '✓ ' + j.validada_por.split('@')[0] : '—'}</td>
                      <td style={S.td}>
                        <button onClick={() => abrir(j)} style={S.btnChico}>Ver</button>
                        {!j.validada_por && j.estado === 'cerrada' &&
                          <button onClick={() => validar(j)} style={{ ...S.btnChico, marginLeft: 5 }}>Validar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div style={S.tarjeta}>
        <h3 style={S.h3}>Resumen semanal y HHEE estimadas</h3>
        <div style={{ fontSize: 11.5, color: '#92400E', background: '#FFFBEB',
                      border: '1px solid #FCD34D', borderRadius: 8, padding: '9px 13px', marginBottom: 12 }}>
          Las HHEE que se muestran son una <b>estimación de gestión</b> sobre la jornada ordinaria
          configurada. Las horas extraordinarias efectivas dependen del contrato, del turno y de que
          estén pactadas por escrito. Esto orienta la revisión; no reemplaza el cálculo de remuneraciones.
        </div>
        {semanas.length === 0 ? <div style={S.vacio}>Sin datos</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.tabla}>
              <thead><tr>
                <th style={S.th}>Persona</th><th style={S.th}>Semana</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Días</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Trabajo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Viaje</th>
                <th style={{ ...S.th, textAlign: 'right' }}>HHEE est.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Sin validar</th>
              </tr></thead>
              <tbody>
                {semanas.filter(s => !persona || s.persona === persona).map((s, i) => (
                  <tr key={i}>
                    <td style={S.td}>{s.persona}</td>
                    <td style={S.td}>{fmtFecha(s.semana)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{s.dias}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{s.horas_trabajo} h</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{s.horas_viaje} h</td>
                    <td style={{ ...S.td, textAlign: 'right',
                                 color: Number(s.hhee_estimadas) > 0 ? '#C0392B' : '#64748B',
                                 fontWeight: Number(s.hhee_estimadas) > 0 ? 800 : 400 }}>
                      {s.hhee_estimadas} h</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{s.sin_validar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detalle && (
        <div style={S.fondo} onClick={() => setDetalle(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0E2A45' }}>{detalle.persona}</h3>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                  {fmtFecha(detalle.fecha)}{detalle.ot_numero ? ` · OT ${detalle.ot_numero}` : ''} ·
                  Trabajo {detalle.horas_trabajo} h · Viaje {detalle.horas_viaje} h
                </div>
              </div>
              <button onClick={() => setDetalle(null)} style={S.btnChico}>✕</button>
            </div>
            {marcas.length === 0 ? <div style={S.vacio}>Sin marcas</div>
              : marcas.map(m => <FilaMarca key={m.id} m={m} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
function FilaMarca({ m }) {
  const p = PASOS.find(x => x.tipo === m.tipo)
  const mapa = m.lat != null
    ? `https://www.google.com/maps?q=${m.lat},${m.lng}`
    : null
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{p?.icono || '•'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0E2A45' }}>
          {p?.label || m.tipo}
          <span style={{ fontWeight: 400, color: '#64748B', marginLeft: 8 }}>
            {fmtHora(m.momento)}
          </span>
          {m.diferida && <span style={{ ...S.pillPend, marginLeft: 6 }}>sin señal</span>}
        </div>
        {m.referencia && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{m.referencia}</div>}
        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3 }}>
          {m.lat != null
            ? <>
                {m.lat}, {m.lng}
                {m.precision_m != null && ` · ±${m.precision_m} m`}
                {' · '}
                <a href={mapa} target="_blank" rel="noopener noreferrer"
                   style={{ color: '#1E4D7B', fontWeight: 600 }}>Ver ubicación exacta</a>
              </>
            : <span style={{ color: '#B45309' }}>Sin ubicación registrada</span>}
        </div>
      </div>
    </div>
  )
}

function Dato({ etq, val, color }) {
  return (
    <div style={{ border: '1px solid #DDE5EE', borderLeft: `3.5px solid ${color}`,
                  borderRadius: 10, padding: '10px 14px', minWidth: 130 }}>
      <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: .5 }}>{etq}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: '#0E2A45', marginTop: 3 }}>{val}</div>
    </div>
  )
}

function Kpi({ etq, val, color = '#1E4D7B' }) {
  return (
    <div style={{ ...S.tarjeta, margin: 0, borderLeft: `3.5px solid ${color}` }}>
      <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: .5 }}>{etq}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0E2A45', marginTop: 4 }}>{val}</div>
    </div>
  )
}

// ── Cola local ───────────────────────────────────────────────
function leerCola() {
  try { return JSON.parse(localStorage.getItem(COLA) || '[]') } catch { return [] }
}
function guardarCola(v) {
  try { localStorage.setItem(COLA, JSON.stringify(v)) } catch { /* sin espacio */ }
}

// ── Estilos ──────────────────────────────────────────────────
const S = {
  tarjeta: { background: '#fff', border: '1px solid #DDE5EE', borderRadius: 12,
             padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(14,42,69,.06)' },
  h3: { margin: '0 0 12px', fontSize: 14, color: '#0E2A45' },
  alerta: { borderRadius: 10, padding: '11px 15px', fontSize: 13, marginBottom: 14, lineHeight: 1.55 },
  lbl: { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B',
         textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 },
  input: { border: '1px solid #DDE5EE', borderRadius: 7, padding: '8px 10px',
           fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#0F172A' },
  btnChico: { border: '1px solid #DDE5EE', background: '#F1F5F9', color: '#1E3A5F',
              borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { background: '#0E2A45', color: '#fff', textAlign: 'left', padding: '8px 10px',
        fontSize: 10.5, textTransform: 'uppercase', letterSpacing: .4, whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', borderBottom: '1px solid #F1F5F9', color: '#334155' },
  pillOk: { background: '#DEF7EC', color: '#036C4B', borderRadius: 11,
            padding: '2px 8px', fontSize: 10.5, fontWeight: 700 },
  pillPend: { background: '#FEF3C7', color: '#92400E', borderRadius: 11,
              padding: '2px 8px', fontSize: 10.5, fontWeight: 700 },
  vacio: { textAlign: 'center', color: '#94A3B8', padding: '30px 14px', fontSize: 13 },
  fondo: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
           background: 'rgba(8,18,32,.55)', display: 'grid', placeItems: 'center',
           zIndex: 9000, padding: 20 },
  modal: { background: '#fff', borderRadius: 14, padding: 20, width: 'min(560px,100%)',
           maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.35)' },
}
