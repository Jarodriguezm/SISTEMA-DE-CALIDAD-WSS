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

// Qué hacer según el motivo del fallo. Concreto, para que el inspector
// lo resuelva en terreno sin tener que llamar a nadie.
function consejoGps(error) {
  switch (error) {
    case 'denegado':
      return 'Toca el ícono a la izquierda de la dirección del sitio (🔒 o ⓘ) → Ubicación → Permitir, y recarga la página.'
    case 'tiempo':
      return 'Sal a cielo abierto o acércate a una ventana y reintenta: dentro de naves, galpones o subterráneos el GPS no llega.'
    case 'no_disponible':
      return 'Revisa que la ubicación del teléfono esté activada (Ajustes → Ubicación) y reintenta.'
    case 'sin_soporte':
      return 'Este equipo no tiene GPS. Marca desde el teléfono de la empresa.'
    default:
      return ''
  }
}

const ETQ_ERROR = {
  denegado: 'Permiso denegado', tiempo: 'GPS sin respuesta',
  no_disponible: 'Ubicación apagada', sin_soporte: 'Equipo sin GPS',
}
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
  // Revisar una jornada ya cerrada: al cerrarla desaparecen las marcas
  // del panel de arriba, y el trabajador tiene que poder volver a verlas.
  const [detalle, setDetalle]       = useState(null)
  const [marcasDet, setMarcasDet]   = useState([])
  // Marca sin ubicación: diálogo que exige motivo
  const [sinGps, setSinGps]         = useState(null)   // { tipo, motivo, error }
  const [justificacion, setJustif]  = useState('')
  const [verificacion, setVerif]    = useState(null)   // resultado de "Verificar GPS"
  const [enLinea, setEnLinea]   = useState(navigator.onLine)
  const tic = useRef(null)
  const [, forzar] = useState(0)
  const [permiso, setPermiso] = useState('consultando')

  // Estado del GPS antes de marcar. Sin esto, alguien puede hacer una
  // jornada completa sin coordenadas y enterarse recién al cerrarla.
  useEffect(() => {
    if (!navigator.geolocation) { setPermiso('no-soportado'); return }
    if (!navigator.permissions?.query) { setPermiso('desconocido'); return }
    let vivo = true
    navigator.permissions.query({ name: 'geolocation' })
      .then(p => {
        if (!vivo) return
        setPermiso(p.state)                       // granted | prompt | denied
        p.onchange = () => setPermiso(p.state)
      })
      .catch(() => vivo && setPermiso('desconocido'))
    return () => { vivo = false }
  }, [])

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
  //
  // DOS INTENTOS. Primero GPS de alta precisión. Si no responde a tiempo
  // o no está disponible, un segundo intento con ubicación por red —wifi
  // y antenas—, más rápida aunque menos precisa. La primera versión solo
  // intentaba una vez con 15 s y se rendía: en computadores, la ubicación
  // por wifi puede tardar justo en ese rango, y se perdía el punto.
  //
  // Además devuelve el MOTIVO del fallo, para que el aviso diga qué pasó
  // en vez de un genérico "revisa los permisos".
  function pedirPosicion(opciones) {
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ ok: true, pos: {
          lat: +p.coords.latitude.toFixed(6),
          lng: +p.coords.longitude.toFixed(6),
          precision: Math.round(p.coords.accuracy),
        } }),
        e => resolve({ ok: false, codigo: e.code }),
        opciones)
    })
  }

  async function ubicar() {
    if (!navigator.geolocation) {
      return { pos: null, error: 'sin_soporte', motivo: 'este dispositivo no entrega ubicación' }
    }
    const sinRed = !navigator.onLine

    // 1) GPS de alta precisión
    let r = await pedirPosicion({
      enableHighAccuracy: true,
      timeout: sinRed ? 35000 : 20000,
      maximumAge: sinRed ? 120000 : 30000,   // sin red, sirve una lectura reciente
    })
    if (r.ok) return { pos: r.pos }

    // Permiso denegado: reintentar no sirve de nada
    if (r.codigo === 1) {
      return { pos: null, error: 'denegado',
               motivo: 'el permiso de ubicación está denegado para este sitio' }
    }

    // 2) Respaldo por red. Sin conexión no hay red que consultar, así
    //    que solo se intenta si hay señal.
    if (!sinRed) {
      r = await pedirPosicion({ enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 })
      if (r.ok) return { pos: r.pos }
    }

    if (r.codigo === 1) return { pos: null, error: 'denegado',
      motivo: 'el permiso de ubicación está denegado para este sitio' }
    if (r.codigo === 3) return { pos: null, error: 'tiempo',
      motivo: 'se agotó el tiempo esperando la posición' }
    return { pos: null, error: 'no_disponible',
      motivo: 'el dispositivo no pudo determinar su posición' }
  }

  // ── Marcar ────────────────────────────────────────────────────
  // La ubicación es obligatoria. Si no se obtiene, NO se envía la marca:
  // se abre un diálogo que explica por qué falló, permite reintentar, y
  // solo deja marcar sin ubicación escribiendo un motivo. La base aplica
  // la misma regla, así que no se puede saltar desde fuera de la pantalla.
  async function marcar(tipo) {
    setError(''); setAviso(''); setEnviando(tipo)
    try {
      const r = await ubicar()
      if (r.error === 'denegado') setPermiso('denied')
      if (!r.pos) {
        setSinGps({ tipo, motivo: r.motivo, error: r.error })
        setJustif('')
        return
      }
      await enviarMarca(tipo, r.pos, null, null)
    } catch (e) {
      setError(e.message || 'No se pudo registrar la marca')
    } finally { setEnviando('') }
  }

  async function enviarMarca(tipo, pos, motivoSinGps, errorGps) {
    const args = {
      p_tipo: tipo,
      p_lat: pos?.lat ?? null,
      p_lng: pos?.lng ?? null,
      p_precision: pos?.precision ?? null,
      p_ot_numero: otNumero.trim() || null,
      p_referencia: referencia.trim() || null,
      p_momento: new Date().toISOString(),
      p_motivo_sin_gps: motivoSinGps || null,
      p_error_gps: errorGps || null,
    }
    if (!navigator.onLine) {
      const cola = [...leerCola(), args]
      guardarCola(cola); setPendientes(cola)
      setAviso(pos
        ? `Sin señal: marca guardada con su hora y ubicación reales (${pos.lat}, ${pos.lng}, ±${pos.precision} m). Se enviará sola al recuperar conexión.`
        : 'Sin señal: marca guardada con su hora real y el motivo indicado. Se enviará al recuperar conexión.')
      return
    }
    const { error: e } = await supabase.rpc('fn_jornada_marcar', args)
    if (e) throw e
    setReferencia('')
    await cargar()
    setAviso(pos
      ? `Marca registrada · ubicación ±${pos.precision} m`
      : 'Marca registrada sin ubicación, con el motivo indicado. Tu supervisor la verá señalada.')
  }

  async function marcarSinUbicacion() {
    if (justificacion.trim().length < 10) return
    const { tipo, error: err } = sinGps
    setEnviando(tipo)
    try {
      await enviarMarca(tipo, null, justificacion.trim(), err)
      setSinGps(null)
    } catch (e) {
      setError(e.message || 'No se pudo registrar la marca')
      setSinGps(null)
    } finally { setEnviando('') }
  }

  async function reintentarUbicacion() {
    const tipo = sinGps.tipo
    setSinGps(null)
    await marcar(tipo)
  }

  // Prueba de GPS sin marcar nada: para que el inspector compruebe al
  // empezar el día que su teléfono está entregando ubicación.
  async function verificarGps() {
    setVerif({ estado: 'probando' })
    const r = await ubicar()
    if (r.error === 'denegado') setPermiso('denied')
    setVerif(r.pos
      ? { estado: 'ok', pos: r.pos }
      : { estado: 'falla', motivo: r.motivo, error: r.error })
  }

  async function abrirDetalle(j) {
    setDetalle(j)
    const { data } = await supabase.from('marcas_jornada')
      .select('*').eq('jornada_id', j.id).order('momento')
    setMarcasDet(data || [])
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
      {(permiso === 'denied' || permiso === 'no-soportado') && (
        <div style={{ ...S.alerta, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B' }}>
          <b>{permiso === 'denied'
            ? 'La ubicación está bloqueada en este navegador.'
            : 'Este dispositivo no entrega ubicación.'}</b><br />
          Puedes marcar igual, pero las marcas quedarán <b>sin ubicación</b> y no aparecerán en el mapa.
          {permiso === 'denied' && (
            <>
              <br /><b>Para habilitarla:</b> toca el ícono a la izquierda de la dirección del sitio
              (🔒 o ⓘ) → Ubicación → Permitir, y recarga la página.
              <br />Si ya dice "Permitir" y sigue fallando, la ubicación está apagada en el equipo:
              en el teléfono, actívala en Ajustes → Ubicación; en Windows, en Configuración →
              Privacidad y seguridad → Ubicación.
            </>
          )}
          {permiso === 'no-soportado' && ' Si estás en un computador de escritorio, usa el teléfono para marcar en terreno.'}
        </div>
      )}
      {permiso === 'prompt' && (
        <div style={{ ...S.alerta, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E3A5F' }}>
          Al marcar por primera vez el navegador te va a pedir permiso de ubicación. Acéptalo,
          o las marcas quedarán sin punto en el mapa.
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

        {/* ── Verificar GPS antes de marcar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      marginBottom: 14, padding: '10px 12px', background: '#F8FAFC',
                      border: '1px solid #E2E8F0', borderRadius: 10 }}>
          <button onClick={verificarGps} disabled={verificacion?.estado === 'probando'}
            style={S.btnChico}>
            {verificacion?.estado === 'probando' ? '📡 Probando…' : '📡 Verificar GPS'}
          </button>
          <span style={{ fontSize: 12.5, color:
            verificacion?.estado === 'ok' ? '#036C4B'
            : verificacion?.estado === 'falla' ? '#991B1B' : '#64748B' }}>
            {!verificacion && 'Compruébalo al empezar el día, antes de salir a terreno.'}
            {verificacion?.estado === 'probando' && 'Buscando señal de ubicación…'}
            {verificacion?.estado === 'ok' &&
              `✓ GPS funcionando · precisión ±${verificacion.pos.precision} m`}
            {verificacion?.estado === 'falla' &&
              <>✗ Sin ubicación: {verificacion.motivo}. {consejoGps(verificacion.error)}</>}
          </span>
        </div>

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
                  {enviando === p.tipo ? '📡 Obteniendo ubicación…' : p.label}
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
          <MapaMarcas marcas={marcas} />
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
                  <th style={S.th}>Estado</th><th style={S.th}>Validada</th><th style={S.th}>Ubicaciones</th>
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
                      <td style={S.td}>
                        <button onClick={() => abrirDetalle(j)} style={S.btnChico}>
                          📍 Ver marcas
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* ── Sin ubicación: reintentar o justificar ── */}
      {sinGps && (
        <div style={S.fondo}>
          <div style={{ ...S.modal, width: 'min(520px,100%)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#991B1B' }}>
              📡 No se pudo obtener tu ubicación
            </h3>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 12 }}>
              Motivo: <b>{sinGps.motivo}</b>.<br />
              {consejoGps(sinGps.error)}
            </div>

            <button onClick={reintentarUbicacion} disabled={!!enviando}
              style={{ ...S.btnChico, background: '#1E4D7B', color: '#fff',
                       border: 'none', padding: '10px 16px', fontSize: 13, marginBottom: 16 }}>
              🔄 Reintentar ubicación
            </button>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
              <label style={S.lbl}>Si no es posible, marca indicando el motivo *</label>
              <textarea value={justificacion} onChange={e => setJustif(e.target.value)} rows={3}
                placeholder="Ej: trabajando dentro de nave industrial, el GPS no toma señal"
                style={{ ...S.input, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11.5, color: '#64748B', margin: '4px 0 12px' }}>
                Mínimo 10 caracteres. Tu supervisor verá la marca señalada con este motivo.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={() => setSinGps(null)} style={S.btnChico}>Cancelar</button>
                <button onClick={marcarSinUbicacion}
                  disabled={justificacion.trim().length < 10 || !!enviando}
                  style={{ ...S.btnChico,
                           background: justificacion.trim().length >= 10 ? '#E08A1E' : '#F1F5F9',
                           color: justificacion.trim().length >= 10 ? '#fff' : '#94A3B8',
                           border: 'none' }}>
                  {enviando ? 'Registrando…' : 'Marcar sin ubicación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detalle && (
        <div style={S.fondo} onClick={() => setDetalle(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0E2A45' }}>
                  Jornada del {fmtFecha(detalle.fecha)}
                </h3>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                  {detalle.ot_numero ? `OT ${detalle.ot_numero} · ` : ''}
                  Trabajo {detalle.horas_trabajo} h · Viaje {detalle.horas_viaje} h
                  {detalle.km_estimados ? ` · ~${detalle.km_estimados} km` : ''}
                </div>
              </div>
              <button onClick={() => setDetalle(null)} style={S.btnChico}>✕</button>
            </div>
            {marcasDet.length === 0
              ? <div style={S.vacio}>Esta jornada no tiene marcas registradas</div>
              : <>
                  <MapaMarcas marcas={marcasDet} />
                  <BotonRecorrido marcas={marcasDet} />
                  {marcasDet.map(m => <FilaMarca key={m.id} m={m} />)}
                </>}
          </div>
        </div>
      )}
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
  const [enTerreno, setEnTerreno] = useState([])
  const [estadoGps, setEstadoGps] = useState([])

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

      // Quién tiene jornada abierta ahora, con su última marca.
      // No es seguimiento en vivo: es dónde marcó por última vez.
      const { data: abiertas } = await supabase.from('v_jornadas')
        .select('*').eq('estado', 'abierta').order('fecha', { ascending: false })
      const conMarca = await Promise.all((abiertas || []).map(async j => {
        const { data: ult } = await supabase.from('marcas_jornada')
          .select('*').eq('jornada_id', j.id)
          .order('momento', { ascending: false }).limit(1)
        return { ...j, ultima: ult?.[0] || null }
      }))
      setEnTerreno(conMarca)

      // Estado del GPS por inspector: quién no está entregando ubicación
      const { data: gps } = await supabase.from('v_estado_gps')
        .select('*').order('pct_gps', { ascending: true })
      setEstadoGps(gps || [])
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

      {enTerreno.length > 0 && (
        <div style={{ ...S.tarjeta, borderLeft: '3.5px solid #159A6B' }}>
          <h3 style={S.h3}>
            En terreno ahora <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 11.5 }}>
              — jornadas abiertas, con su última marca</span>
          </h3>
          <div style={{ display: 'grid', gap: 10,
                        gridTemplateColumns: 'repeat(auto-fit,minmax(265px,1fr))' }}>
            {enTerreno.map(j => {
              const p = PASOS.find(x => x.tipo === j.ultima?.tipo)
              const mins = j.ultima ? (Date.now() - new Date(j.ultima.momento)) / 60000 : 0
              return (
                <div key={j.id} style={{ border: '1px solid #DDE5EE', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0E2A45' }}>{j.persona}</div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                    {p ? `${p.icono} ${p.label}` : 'Sin marcas'}
                    {j.ultima && <> · {fmtHora(j.ultima.momento)} · hace {hhmm(mins)}</>}
                  </div>
                  {j.ot_numero && (
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>OT {j.ot_numero}</div>
                  )}
                  <div style={{ marginTop: 7 }}>
                    {j.ultima?.lat != null
                      ? <a href={`https://www.google.com/maps?q=${j.ultima.lat},${j.ultima.lng}`}
                           target="_blank" rel="noopener noreferrer"
                           style={{ color: '#1E4D7B', fontWeight: 700, fontSize: 12 }}>
                          📍 Dónde marcó por última vez
                        </a>
                      : <span style={{ fontSize: 11.5, color: '#B45309' }}>Última marca sin ubicación</span>}
                    <button onClick={() => abrir(j)} style={{ ...S.btnChico, marginLeft: 8 }}>Detalle</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {estadoGps.length > 0 && (
        <div style={S.tarjeta}>
          <h3 style={S.h3}>
            Estado del GPS por inspector <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 11.5 }}>
              — últimos 14 días, los con problemas primero</span>
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.tabla}>
              <thead><tr>
                <th style={S.th}>Persona</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Marcas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Con GPS</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Precisión media</th>
                <th style={S.th}>Último problema</th>
                <th style={S.th}>Motivo declarado</th>
              </tr></thead>
              <tbody>
                {estadoGps.map(g => {
                  const pct = Number(g.pct_gps ?? 0)
                  const color = pct >= 95 ? '#036C4B' : pct >= 80 ? '#B45309' : '#C0392B'
                  return (
                    <tr key={g.email}>
                      <td style={S.td}>{g.persona}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{g.marcas}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color }}>{pct}%</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        {g.precision_media_m != null ? `±${g.precision_media_m} m` : '—'}</td>
                      <td style={S.td}>
                        {g.ultimo_error
                          ? <span style={S.pillPend} title={consejoGps(g.ultimo_error)}>
                              {ETQ_ERROR[g.ultimo_error] || g.ultimo_error}</span>
                          : g.sin_gps > 0 ? <span style={S.pillPend}>sin dato</span>
                          : <span style={S.pillOk}>ninguno</span>}
                      </td>
                      <td style={{ ...S.td, fontSize: 12, color: '#475569', maxWidth: 260 }}>
                        {g.ultimo_motivo || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, fontStyle: 'italic' }}>
            Pasa el cursor sobre el problema para ver cómo corregirlo en el teléfono del inspector.
          </div>
        </div>
      )}

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
              : <>
                  <MapaMarcas marcas={marcas} />
                  <BotonRecorrido marcas={marcas} />
                  {marcas.map(m => <FilaMarca key={m.id} m={m} />)}
                </>}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// MAPA — Leaflet con OpenStreetMap
//
// Leaflet se sirve DESDE EL PROPIO PORTAL (public/vendor/leaflet), no
// desde un CDN. La política de seguridad del sitio (vercel.json) solo
// permite scripts de 'self': cargarlo desde cdnjs quedaba bloqueado en
// silencio. Abrir la política a un CDN externo habría debilitado la
// protección —cdnjs sirve cualquier librería—, así que se aloja aquí.
// Tampoco se instaló por npm, para no tocar package.json y su lock.
//
// Si los mosaicos de OpenStreetMap están bloqueados por la red de la
// faena, el mapa queda gris pero los enlaces a Google Maps siguen ahí.
// Nunca debe impedir ver las coordenadas.
// ═══════════════════════════════════════════════════════════════
let leafletPromesa = null
function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromesa) return leafletPromesa
  leafletPromesa = new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = '/vendor/leaflet/leaflet.css'
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = '/vendor/leaflet/leaflet.js'
    js.onload = () => resolve(window.L)
    js.onerror = () => reject(new Error('No se pudo cargar el mapa'))
    document.head.appendChild(js)
  })
  return leafletPromesa
}

function MapaMarcas({ marcas }) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const [fallo, setFallo] = useState('')
  const puntos = marcas.filter(m => m.lat != null)

  useEffect(() => {
    if (!puntos.length || !caja.current) return
    let vivo = true
    cargarLeaflet().then(L => {
      if (!vivo || !caja.current) return
      if (mapa.current) { mapa.current.remove(); mapa.current = null }

      const m = L.map(caja.current, { scrollWheelZoom: false })
      mapa.current = m
      // Sin subdominios a/b/c: es lo que OpenStreetMap recomienda hoy, y
      // deja un solo host autorizado en la política de seguridad.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(m)

      const coords = puntos.map(p => [Number(p.lat), Number(p.lng)])

      // Línea del recorrido
      if (coords.length > 1) {
        L.polyline(coords, { color: '#1E4D7B', weight: 3, opacity: .75, dashArray: '6,6' }).addTo(m)
      }

      puntos.forEach((p, i) => {
        const paso = PASOS.find(x => x.tipo === p.tipo)
        const color = paso?.color || '#1E4D7B'
        // Marcador numerado: se ve el orden del recorrido de un vistazo
        const icono = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:#fff;width:26px;height:26px;
                   border-radius:50%;display:grid;place-items:center;font-weight:800;
                   font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${i + 1}</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        })
        L.marker([Number(p.lat), Number(p.lng)], { icon: icono }).addTo(m)
          .bindPopup(
            `<b>${paso?.label || p.tipo}</b><br>${fmtHora(p.momento)}` +
            (p.precision_m != null ? `<br>Precisión ±${p.precision_m} m` : '') +
            (p.referencia ? `<br>${p.referencia}` : '') +
            (p.diferida ? '<br><i>marcada sin señal</i>' : '')
          )
        // Círculo de precisión: muestra honestamente cuánto puede errar
        if (p.precision_m != null && Number(p.precision_m) > 25) {
          L.circle([Number(p.lat), Number(p.lng)], {
            radius: Number(p.precision_m), color, weight: 1, opacity: .5, fillOpacity: .08,
          }).addTo(m)
        }
      })

      if (coords.length === 1) m.setView(coords[0], 16)
      else m.fitBounds(L.latLngBounds(coords), { padding: [30, 30] })

      // El contenedor nace dentro de un modal: Leaflet necesita que le
      // avisen del tamaño real una vez que ya está pintado.
      setTimeout(() => m.invalidateSize(), 120)
    }).catch(() => { if (vivo) setFallo('No se pudo cargar el mapa. Usa los enlaces de abajo.') })

    return () => {
      vivo = false
      if (mapa.current) { mapa.current.remove(); mapa.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcas])

  // Antes esto devolvía null y el mapa simplemente no aparecía: imposible
  // distinguir "está roto" de "no hay coordenadas". Ahora lo dice.
  if (!puntos.length) {
    return (
      <div style={{ fontSize: 12.5, color: '#92400E', background: '#FFFBEB',
                    border: '1px solid #FCD34D', borderRadius: 10,
                    padding: '12px 15px', marginBottom: 12, lineHeight: 1.6 }}>
        <b>No hay mapa porque ninguna marca tiene ubicación.</b><br />
        Las {marcas.length} marca(s) se registraron sin coordenadas. Suele deberse a que
        se marcó desde un computador de escritorio —que no tiene GPS— o a que el navegador
        no tiene permiso de ubicación. En el teléfono, revisa que el sitio tenga la ubicación
        permitida y vuelve a marcar.
      </div>
    )
  }
  if (fallo) {
    return (
      <div style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB',
                    border: '1px solid #FCD34D', borderRadius: 8,
                    padding: '9px 12px', marginBottom: 12 }}>{fallo}</div>
    )
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div ref={caja} style={{ height: 280, borderRadius: 10, border: '1px solid #DDE5EE',
                               overflow: 'hidden', background: '#EEF2F7' }} />
      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5, fontStyle: 'italic' }}>
        Los números siguen el orden del recorrido. El círculo alrededor de un punto es el
        margen de error del GPS en ese momento.
      </div>
    </div>
  )
}

// Recorrido completo en un solo mapa: salida, trabajo y regreso.
// Google Maps acepta una ruta con puntos intermedios por URL, así que
// el supervisor ve de una vez de dónde salió, dónde trabajó y dónde
// cerró, sin abrir cuatro pestañas.
function enlaceRecorrido(marcas) {
  const pts = marcas.filter(m => m.lat != null).map(m => `${m.lat},${m.lng}`)
  if (pts.length < 2) return null
  return 'https://www.google.com/maps/dir/' + pts.join('/')
}

function BotonRecorrido({ marcas }) {
  const url = enlaceRecorrido(marcas)
  const conUbic = marcas.filter(m => m.lat != null).length
  if (!url) {
    return (
      <div style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB',
                    border: '1px solid #FCD34D', borderRadius: 8,
                    padding: '9px 12px', marginBottom: 12 }}>
        No hay suficientes marcas con ubicación para dibujar el recorrido
        ({conUbic} de {marcas.length}).
      </div>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
                background: '#1E4D7B', color: '#fff', borderRadius: 8,
                padding: '9px 14px', fontSize: 12.5, fontWeight: 700,
                textDecoration: 'none', marginBottom: 12 }}>
      🗺 Ver recorrido completo en el mapa
      <span style={{ fontWeight: 400, opacity: .85 }}>({conUbic} puntos)</span>
    </a>
  )
}

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
            : <span style={{ color: '#B45309' }}>
                Sin ubicación{m.error_gps ? ` (${ETQ_ERROR[m.error_gps] || m.error_gps})` : ''}
                {m.motivo_sin_ubicacion && <> · motivo: <i>{m.motivo_sin_ubicacion}</i></>}
              </span>}
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
  modal: { background: '#fff', borderRadius: 14, padding: 20, width: 'min(700px,100%)',
           maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.35)' },
}
