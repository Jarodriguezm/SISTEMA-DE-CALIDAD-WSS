// ============================================================
// ChatWidget.jsx — Asistente IA flotante de WSS
// Botón FAB + panel de chat + loop agentic con tools Supabase
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const API_URL    = '/api/chat'
const MAX_LOOPS  = 4   // máximo de rondas tool → respuesta antes de cortar

// ── Ejecución de herramientas (client-side, usa Supabase con RLS) ─────────
async function ejecutarHerramienta(nombre, args) {
  switch (nombre) {

    case 'buscar_ots': {
      const limite = Math.min(args.limite || 5, 20)
      let q = supabase
        .from('v_portal_ots_listado')
        .select('numero_ot, cliente, estado, avance_porcentaje, inspector_nombre, fecha_inspeccion, sede')
        .limit(limite)
      if (args.estado) q = q.eq('estado', args.estado)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      let resultado = data || []
      if (args.busqueda) {
        const b = args.busqueda.toLowerCase()
        resultado = resultado.filter(r =>
          String(r.numero_ot  || '').toLowerCase().includes(b) ||
          String(r.cliente    || '').toLowerCase().includes(b)
        )
      }
      return resultado
    }

    case 'obtener_asignaciones': {
      const hoy   = new Date().toISOString().slice(0, 10)
      const dias  = args.dias || 7
      const hasta = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)
      let q = supabase
        .from('asignaciones')
        .select('ot_numero, inspectores_asignados, fecha_inspeccion, hora, estado, tipos_inspeccion, supervisor, vehiculo')
        .gte('fecha_inspeccion', hoy)
        .lte('fecha_inspeccion', hasta)
        .order('fecha_inspeccion', { ascending: true })
        .limit(15)
      if (args.estado) q = q.eq('estado', args.estado)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return data || []
    }

    default:
      return { error: `Herramienta desconocida: ${nombre}` }
  }
}

// Texto descriptivo de cada herramienta para mostrar al usuario
const TOOL_LABEL = {
  buscar_ots:           'órdenes de trabajo',
  obtener_asignaciones: 'asignaciones',
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ChatWidget() {
  const { usuario } = useAuth()
  const [abierto,       setAbierto]       = useState(false)
  const [mensajes,      setMensajes]      = useState([])    // { id, rol, texto, imagen? }
  const [historialAPI,  setHistorialAPI]  = useState([])    // formato OpenAI
  const [input,         setInput]         = useState('')
  const [cargando,      setCargando]      = useState(false)
  const [toolActivo,    setToolActivo]    = useState('')    // label de tool en ejecución
  const [contexto,      setContexto]      = useState('')
  const [contextoCargado, setContextoCargado] = useState(false)
  const [archivo,       setArchivo]       = useState(null)  // { base64, nombre, tipo }

  const scrollRef = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes, cargando])

  // Foco al input cuando se abre
  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 120)
  }, [abierto])

  // Cargar contexto del usuario la primera vez que se abre
  useEffect(() => {
    if (!abierto || contextoCargado) return
    setContextoCargado(true)

    async function cargarContexto() {
      // Nombre desde el contexto de auth (ya disponible, sin query extra)
      const nombre     = usuario?.nombre?.split(' ')[0] || usuario?.email?.split('@')[0] || 'usuario'
      const nombreFull = usuario?.nombre || ''
      const rol        = usuario?.rol    || ''
      const sede       = usuario?.sede   || ''

      try {
        const [{ count: totalOTs }, { count: pendientes }, { count: proximas }] = await Promise.all([
          supabase.from('v_portal_ots_listado').select('*', { count: 'exact', head: true }),
          supabase.from('v_portal_ots_listado').select('*', { count: 'exact', head: true })
            .in('estado', ['Pendiente de asignación', 'Sin inspector']),
          supabase.from('asignaciones').select('*', { count: 'exact', head: true })
            .gte('fecha_inspeccion', new Date().toISOString().slice(0, 10))
            .eq('estado', 'Programada'),
        ])

        const ctx = [
          nombreFull && `Usuario: ${nombreFull}`,
          rol        && `Rol: ${rol}`,
          sede       && `Sede: ${sede}`,
          `Fecha: ${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
          totalOTs   != null && `OTs totales en sistema: ${totalOTs}`,
          pendientes != null && `OTs pendientes de asignación: ${pendientes}`,
          proximas   != null && `Asignaciones próximas (7 días): ${proximas}`,
        ].filter(Boolean).join('\n')

        setContexto(ctx)
      } catch {
        setContexto([
          nombreFull && `Usuario: ${nombreFull}`,
          rol        && `Rol: ${rol}`,
        ].filter(Boolean).join('\n') || 'Usuario autenticado en WSS.')
      }

      setMensajes([{
        id: 0,
        rol: 'ia',
        texto: `Hola ${nombre}, soy María, tu asistente de WSS. Puedo ayudarte con procedimientos de inspección, búsqueda de OTs y asignaciones, análisis de documentos técnicos y más. ¿En qué te puedo ayudar?`
      }])
    }

    cargarContexto()
  }, [abierto, contextoCargado])

  // ── Manejo de archivo adjunto ──────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setArchivo({ base64: reader.result, nombre: file.name, tipo: file.type })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Loop agentic principal ─────────────────────────────────────────────
  async function runLoop(historial) {
    let msgs           = [...historial]
    let historialExtra = []
    let loops          = 0

    while (loops < MAX_LOOPS) {
      loops++

      const resp = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: msgs, contexto })
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }

      const data = await resp.json()

      // Respuesta final de texto
      if (data.tipo === 'respuesta') {
        return { contenido: data.contenido, historialExtra }
      }

      // GPT quiere ejecutar herramientas
      if (data.tipo === 'tool_calls') {
        historialExtra.push(data.message)
        msgs = [...msgs, data.message]

        for (const tc of data.tool_calls) {
          const nombre = tc.function.name
          setToolActivo(TOOL_LABEL[nombre] || nombre)

          let resultado
          try {
            const args = JSON.parse(tc.function.arguments || '{}')
            resultado  = await ejecutarHerramienta(nombre, args)
          } catch (e) {
            resultado = { error: e.message }
          }

          const toolMsg = {
            role:         'tool',
            tool_call_id: tc.id,
            content:      JSON.stringify(resultado)
          }
          historialExtra.push(toolMsg)
          msgs = [...msgs, toolMsg]
        }

        setToolActivo('')
        continue // siguiente iteración → GPT procesa los resultados
      }

      throw new Error('Respuesta inesperada del servidor')
    }

    return {
      contenido: 'Alcancé el límite de consultas en esta operación. Por favor reformula tu pregunta.',
      historialExtra
    }
  }

  // ── Envío de mensaje ───────────────────────────────────────────────────
  async function enviar() {
    const texto = input.trim()
    if (!texto && !archivo) return
    if (cargando) return

    // Construir mensaje en formato OpenAI
    let userContent
    if (archivo?.tipo?.startsWith('image/')) {
      userContent = [
        { type: 'text',      text: texto || 'Analiza esta imagen.' },
        { type: 'image_url', image_url: { url: archivo.base64 } }
      ]
    } else {
      userContent = texto
    }

    const msgDisplay = {
      id:            Date.now(),
      rol:           'yo',
      texto:         texto || archivo?.nombre || '',
      imagen:        archivo?.tipo?.startsWith('image/') ? archivo.base64 : null,
      archivoNombre: archivo?.nombre,
    }
    const msgAPI = { role: 'user', content: userContent }

    const nuevosMensajes   = [...mensajes, msgDisplay]
    const nuevoHistorial   = [...historialAPI, msgAPI]

    setMensajes(nuevosMensajes)
    setHistorialAPI(nuevoHistorial)
    setInput('')
    setArchivo(null)
    setCargando(true)

    try {
      const { contenido, historialExtra } = await runLoop(nuevoHistorial)

      const iaDisplay = { id: Date.now() + 1, rol: 'ia', texto: contenido }
      const iaAPI     = { role: 'assistant', content: contenido }

      setMensajes(prev => [...prev, iaDisplay])
      setHistorialAPI(prev => [...prev, ...historialExtra, iaAPI])

    } catch (e) {
      setMensajes(prev => [...prev, {
        id:    Date.now() + 2,
        rol:   'ia',
        texto: `Error al conectar con el asistente: ${e.message}`,
        error: true
      }])
    } finally {
      setCargando(false)
      setToolActivo('')
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  function limpiarChat() {
    setMensajes([])
    setHistorialAPI([])
    setContextoCargado(false)
    setContexto('')
  }

  const puedoEnviar = !cargando && (!!input.trim() || !!archivo)

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Panel de chat */}
      {abierto && (
        <div style={S.panel}>

          {/* Header */}
          <div style={S.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={S.avatarIA}><IcRobot /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1 }}>
                  María · Asistente WSS
                </div>
                <div style={{ fontSize: 11, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }}/>
                  En línea · Claude
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {mensajes.length > 1 && (
                <button onClick={limpiarChat} style={S.btnIcon} title="Nueva conversación">
                  <IcRefresh />
                </button>
              )}
              <button onClick={() => setAbierto(false)} style={S.btnIcon} aria-label="Cerrar">
                <IcX />
              </button>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div ref={scrollRef} style={S.mensajesArea}>
            {mensajes.map(m => <BurbujaMsg key={m.id} m={m} />)}

            {/* Indicador de carga / tool en proceso */}
            {cargando && (
              <div style={S.rowIA}>
                <div style={S.avatarIASmall}><IcRobot size={11} /></div>
                <div style={S.burbujaIA}>
                  {toolActivo
                    ? <span style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>
                        Consultando {toolActivo}…
                      </span>
                    : <TypingDots />
                  }
                </div>
              </div>
            )}
          </div>

          {/* Preview archivo adjunto */}
          {archivo && (
            <div style={S.adjuntoBarra}>
              <IcPaperclip size={13} />
              <span style={{ fontSize: 12, color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {archivo.nombre}
              </span>
              <button onClick={() => setArchivo(null)} style={{ ...S.btnIcon, padding: 2 }}>
                <IcX size={11} />
              </button>
            </div>
          )}

          {/* Área de input */}
          <div style={S.inputArea}>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ ...S.btnIcon, border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: 8 }}
              title="Adjuntar imagen"
            >
              <IcPaperclip />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Escribe tu consulta… (Enter para enviar)"
              style={S.textarea}
              rows={1}
              disabled={cargando}
            />
            <button
              onClick={enviar}
              disabled={!puedoEnviar}
              style={{ ...S.btnSend, opacity: puedoEnviar ? 1 : 0.35 }}
              aria-label="Enviar"
            >
              <IcSend />
            </button>
          </div>

          <div style={S.pie}>Powered by Claude · WSS Sistema de Calidad</div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(v => !v)}
        style={S.fab}
        aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente IA WSS'}
        title="Asistente IA WSS"
      >
        {abierto ? <IcX size={22} /> : <IcChat size={22} />}
      </button>
    </>
  )
}

// ── Burbuja individual ────────────────────────────────────────────────────
function BurbujaMsg({ m }) {
  const esIA = m.rol === 'ia'
  return (
    <div style={esIA ? S.rowIA : S.rowYo}>
      {esIA && <div style={S.avatarIASmall}><IcRobot size={11} /></div>}
      <div style={{
        ...(esIA ? S.burbujaIA : S.burbujaYo),
        ...(m.error && { background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B' })
      }}>
        {m.imagen && (
          <img
            src={m.imagen}
            alt="adjunto"
            style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6, display: 'block', marginBottom: 6, objectFit: 'contain' }}
          />
        )}
        {m.texto && <RenderTexto texto={m.texto} esIA={esIA} />}
      </div>
    </div>
  )
}

// Render básico de markdown: **negrita**, `código`, listas con -
function RenderTexto({ texto, esIA }) {
  const lineas = texto.split('\n')
  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {lineas.map((linea, li) => {
        // Lista con guión o asterisco
        if (/^[-*]\s/.test(linea)) {
          return (
            <div key={li} style={{ display: 'flex', gap: 6, marginTop: li > 0 ? 2 : 0 }}>
              <span style={{ color: esIA ? '#94A3B8' : 'rgba(255,255,255,.6)', flexShrink: 0 }}>•</span>
              <span>{renderInline(linea.slice(2))}</span>
            </div>
          )
        }
        return <div key={li} style={{ marginTop: li > 0 && linea === '' ? 4 : 0 }}>{renderInline(linea)}</div>
      })}
    </div>
  )
}

function renderInline(texto) {
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return partes.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`')  && p.endsWith('`'))  return <code key={i} style={{ background: 'rgba(0,0,0,.07)', padding: '1px 5px', borderRadius: 3, fontSize: 11.5, fontFamily: 'monospace' }}>{p.slice(1, -1)}</code>
    return p
  })
}

// ── Indicador de typing ────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 18 }}>
      <style>{`@keyframes wss-bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-5px);opacity:1}}`}</style>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: '#94A3B8', display: 'inline-block',
          animation: `wss-bounce 1.3s ease-in-out ${i * 0.16}s infinite`
        }}/>
      ))}
    </div>
  )
}

// ── Icons SVG inline ──────────────────────────────────────────────────────
const IcChat = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)
const IcX = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
)
const IcRobot = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <path d="M12 11V3M8 3h8M6 15h.01M18 15h.01M9 19h6"/>
  </svg>
)
const IcSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13M22 2 15 22 11 13 2 9l20-7z"/>
  </svg>
)
const IcPaperclip = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 01-8.49-8.49l8.57-8.57A4 4 0 1118 8.84l-8.59 8.57a2 2 0 01-2.83-2.83l8.49-8.48"/>
  </svg>
)
const IcRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
)

// ── Estilos ───────────────────────────────────────────────────────────────
const S = {
  fab: {
    position:        'fixed',
    bottom:          24,
    right:           24,
    width:           52,
    height:          52,
    borderRadius:    '50%',
    background:      '#1E3A5F',
    color:           '#fff',
    border:          'none',
    cursor:          'pointer',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    boxShadow:       '0 4px 18px rgba(30,58,95,.42)',
    zIndex:          9999,
    transition:      'transform .12s, box-shadow .12s',
  },
  panel: {
    position:       'fixed',
    bottom:         88,
    right:          24,
    width:          390,
    height:         580,
    background:     '#fff',
    borderRadius:   16,
    boxShadow:      '0 10px 50px rgba(0,0,0,.18), 0 2px 10px rgba(0,0,0,.08)',
    display:        'flex',
    flexDirection:  'column',
    zIndex:         9998,
    overflow:       'hidden',
    border:         '1px solid #E2E8F0',
  },
  header: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         '13px 16px',
    borderBottom:    '1px solid #F1F5F9',
    background:      '#fff',
    flexShrink:      0,
  },
  avatarIA: {
    width:           36,
    height:          36,
    borderRadius:    '50%',
    background:      '#EFF6FF',
    color:           '#1E3A5F',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  avatarIASmall: {
    width:           24,
    height:          24,
    borderRadius:    '50%',
    background:      '#EFF6FF',
    color:           '#1E3A5F',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    alignSelf:       'flex-start',
    marginTop:       2,
  },
  btnIcon: {
    background:  'none',
    border:      'none',
    cursor:      'pointer',
    color:       '#94A3B8',
    padding:     4,
    display:     'flex',
    borderRadius: 6,
    alignItems:  'center',
    justifyContent: 'center',
  },
  mensajesArea: {
    flex:           1,
    overflowY:      'auto',
    padding:        '14px 14px 8px',
    display:        'flex',
    flexDirection:  'column',
    gap:            10,
  },
  rowIA: {
    display:    'flex',
    gap:         8,
    alignItems: 'flex-start',
    alignSelf:  'flex-start',
    maxWidth:   '92%',
  },
  rowYo: {
    display:       'flex',
    justifyContent: 'flex-end',
    alignSelf:     'flex-end',
    maxWidth:      '88%',
  },
  burbujaIA: {
    background:   '#F8FAFC',
    border:       '1px solid #E2E8F0',
    borderRadius: '4px 12px 12px 12px',
    padding:      '9px 12px',
    fontSize:     13,
    color:        '#0F172A',
    lineHeight:   1.56,
  },
  burbujaYo: {
    background:   '#1E3A5F',
    borderRadius: '12px 4px 12px 12px',
    padding:      '9px 12px',
    fontSize:     13,
    color:        '#fff',
    lineHeight:   1.56,
  },
  adjuntoBarra: {
    display:     'flex',
    alignItems:  'center',
    gap:          8,
    padding:     '7px 14px',
    borderTop:   '1px solid #F1F5F9',
    background:  '#F8FAFC',
    fontSize:    12,
    color:       '#64748B',
    flexShrink:  0,
  },
  inputArea: {
    display:     'flex',
    alignItems:  'flex-end',
    gap:          7,
    padding:     '10px 12px',
    borderTop:   '1px solid #F1F5F9',
    background:  '#fff',
    flexShrink:  0,
  },
  textarea: {
    flex:        1,
    border:      '1.5px solid #E2E8F0',
    borderRadius: 10,
    padding:     '8px 11px',
    fontSize:    13,
    fontFamily:  'inherit',
    resize:      'none',
    outline:     'none',
    lineHeight:  1.5,
    maxHeight:   110,
    color:       '#0F172A',
    background:  '#fff',
    overflowY:   'auto',
  },
  btnSend: {
    background:     '#1E3A5F',
    border:         'none',
    borderRadius:   10,
    cursor:         'pointer',
    color:          '#fff',
    padding:        '9px 12px',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    transition:     'opacity .1s',
  },
  pie: {
    textAlign:  'center',
    fontSize:   10,
    color:      '#CBD5E1',
    padding:    '5px 0 7px',
    background: '#fff',
    flexShrink: 0,
  },
}
