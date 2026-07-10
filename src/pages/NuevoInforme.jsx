import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

// ── Configuración por tipo de equipo ──────────────────────────────────────────

const TIPOS = [
  { id: 'TANQUE',     icon: '🛢️', label: 'Tanque',         desc: 'API 650 / API 653',   color: '#1D4ED8' },
  { id: 'TUBERIA',    icon: '🔩', label: 'Tubería',         desc: 'API 570 / ASME B31',  color: '#047857' },
  { id: 'ESTRUCTURA', icon: '🏗️', label: 'Estructura',      desc: 'AWS D1.1 / ASME V',   color: '#92400E' },
  { id: 'IZAJE',      icon: '🏋️', label: 'Izaje / Levante', desc: 'ASME B30 / INN OI377',color: '#7C3AED' },
]

const CAMPOS = {
  TANQUE: [
    { id: 'tag',              label: 'Tag / Número de Tanque',  type: 'text',   req: true },
    { id: 'producto',         label: 'Producto almacenado',     type: 'text' },
    { id: 'capacidad_m3',     label: 'Capacidad (m³)',          type: 'number' },
    { id: 'diametro_m',       label: 'Diámetro (m)',            type: 'number', req: true },
    { id: 'altura_m',         label: 'Altura total (m)',        type: 'number', req: true },
    { id: 'cantidad_anillos', label: 'Cantidad de anillos',     type: 'number' },
    { id: 'material',         label: 'Material',                type: 'select', ops: ['Acero Carbono','Acero Inoxidable','FRP','Otro'] },
    { id: 'tipo_techo',       label: 'Tipo de techo',           type: 'select', ops: ['Cónico fijo','Flotante externo','Flotante interno','Abierto','Sin techo'] },
    { id: 'norma_diseño',     label: 'Norma de diseño',         type: 'select', ops: ['API 650','API 653','API 620','ASME','Otra'] },
    { id: 'año_fabricacion',  label: 'Año de fabricación',      type: 'number' },
    { id: 'estado_fondo',     label: 'Estado del fondo',        type: 'select', ops: ['Bueno','Regular','Deficiente','No inspeccionado'] },
    { id: 'estado_techo',     label: 'Estado del techo',        type: 'select', ops: ['Bueno','Regular','Deficiente','No aplica'] },
    { id: 'estado_costado',   label: 'Estado del costado',      type: 'select', ops: ['Bueno','Regular','Deficiente'] },
  ],
  TUBERIA: [
    { id: 'linea_id',        label: 'ID de Línea / Tag',          type: 'text', req: true },
    { id: 'fluido',          label: 'Fluido transportado',        type: 'text', req: true },
    { id: 'dn_pulgadas',     label: 'Diámetro nominal DN (″)',    type: 'text' },
    { id: 'schedule',        label: 'Schedule / Espesor nominal', type: 'text' },
    { id: 'material',        label: 'Material',                   type: 'select', ops: ['Acero Carbono','Acero Inoxidable','Cobre','HDPE','Otro'] },
    { id: 'temperatura_op',  label: 'Temperatura operación (°C)', type: 'text' },
    { id: 'presion_op',      label: 'Presión operación (bar)',    type: 'text' },
    { id: 'pid_numero',      label: 'N° P&ID / Isométrico',      type: 'text' },
    { id: 'longitud_m',      label: 'Longitud inspeccionada (m)', type: 'number' },
    { id: 'estado_pintura',  label: 'Estado de revestimiento',    type: 'select', ops: ['Bueno','Regular','Deficiente','Sin revestimiento'] },
  ],
  ESTRUCTURA: [
    { id: 'tipo_estructura',  label: 'Tipo de estructura',            type: 'text', req: true },
    { id: 'funcion',          label: 'Función / Uso',                 type: 'text' },
    { id: 'ubicacion',        label: 'Ubicación en planta',           type: 'text' },
    { id: 'material',         label: 'Material estructural',          type: 'select', ops: ['Acero Carbono','Acero Inoxidable','Aluminio','Otro'] },
    { id: 'proceso_soldadura',label: 'Proceso de soldadura',          type: 'select', ops: ['SMAW','GMAW','FCAW','GTAW','SAW','Múltiple'] },
    { id: 'norma_soldadura',  label: 'Norma de soldadura',            type: 'select', ops: ['AWS D1.1','AWS D1.2','AWS D1.3','AWS D1.6','ASME BPVC Secc. V','Otra'] },
    { id: 'año_fabricacion',  label: 'Año de fabricación',            type: 'number' },
    { id: 'estado_pintura',   label: 'Estado de pintura / corrosión', type: 'select', ops: ['Bueno','Regular','Deficiente'] },
    { id: 'estado_soldaduras',label: 'Estado general soldaduras',     type: 'select', ops: ['Sin discontinuidades','Con observaciones','Con defectos'] },
  ],
  IZAJE: [
    { id: 'tipo_equipo_izaje',  label: 'Tipo de equipo',     type: 'select', req: true, ops: ['Grúa Puente','Grúa Pórtico','Grúa Horquilla','Grúa Articulada','Alza Hombre','Eslinga','Grillete','Gancho','Otra'] },
    { id: 'marca',              label: 'Marca',              type: 'text' },
    { id: 'modelo',             label: 'Modelo',             type: 'text' },
    { id: 'numero_serie',       label: 'N° de Serie',        type: 'text' },
    { id: 'capacidad_ton',      label: 'Capacidad (ton)',    type: 'number', req: true },
    { id: 'año_fabricacion',    label: 'Año fabricación',    type: 'number' },
    { id: 'horas_operacion',    label: 'Horas de operación', type: 'number' },
    { id: 'prueba_carga',       label: 'Prueba de carga',    type: 'select', ops: ['Realizada - Satisfactoria','Realizada - No Satisfactoria','No realizada','No aplica'] },
    { id: 'carga_aplicada_ton', label: 'Carga aplicada (ton)', type: 'number' },
    { id: 'estado_estructura',  label: 'Estado estructura',  type: 'select', ops: ['Bueno','Regular','Deficiente'] },
    { id: 'estado_componentes', label: 'Estado componentes', type: 'select', ops: ['Bueno','Regular','Deficiente'] },
  ],
}

const METODOS_END = [
  { id: 'IV',    label: 'Inspección Visual (IV)' },
  { id: 'LP',    label: 'Líquidos Penetrantes (LP)' },
  { id: 'PM',    label: 'Partículas Magnéticas (PM)' },
  { id: 'UT_E',  label: 'UT Espesores (UT-E)' },
  { id: 'UT_F',  label: 'UT Detección de Fallas (UT-F)' },
  { id: 'UTPA',  label: 'Ultrasonido Phased Array (UTPA)' },
  { id: 'TERMO', label: 'Termografía (IRT)' },
  { id: 'HIDRO', label: 'Prueba Hidrostática' },
  { id: 'CARGA', label: 'Prueba de Carga' },
]

const CRITICIDADES = ['Crítico', 'Mayor', 'Menor', 'Observación']

// ── Componente principal ──────────────────────────────────────────────────────

export default function NuevoInforme() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { usuario } = useAuth()
  const fileRef = useRef()

  // ── Estado OT / carga ────────────────────────────────────────────────────
  const [otInput, setOtInput]       = useState(searchParams.get('ot') || '')
  const [cargandoOT, setCargandoOT] = useState(false)
  const [errorOT, setErrorOT]       = useState('')
  const [otCargada, setOtCargada]   = useState(null)      // objeto OT
  const [asignacion, setAsignacion] = useState(null)      // última asignación

  // ── Estado del formulario ────────────────────────────────────────────────
  const [tipo, setTipo]       = useState('')
  const [general, setGeneral] = useState({
    ot_numero: '', cliente_nombre: '', lugar: '',
    fecha_inspeccion: new Date().toISOString().split('T')[0],
    supervisor_nombre: '',
  })
  const [normas, setNormas] = useState({
    norma_ejecucion: '',
    norma_evaluacion: '',
    procedimientos: '',
  })
  const [equipo, setEquipo]         = useState({})
  const [endAplicados, setEnd]      = useState([])
  const [mediciones, setMediciones] = useState([])
  const [hallazgos, setHallazgos]   = useState([])
  const [resultado, setResultado]   = useState('')

  // IA
  const [generando, setGenerando] = useState(false)
  const [textoIA, setTextoIA]     = useState(null)
  const [errorIA, setErrorIA]     = useState('')

  // Guardado
  const [guardando, setGuardando]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  // Hallazgo en construcción
  const [hallazgoForm, setHallazgoForm] = useState({ descripcion: '', ubicacion: '', norma: '', criticidad: 'Menor' })
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  // Auto-cargar si hay ?ot= en la URL
  useEffect(() => {
    const ot = searchParams.get('ot')
    if (ot) {
      setOtInput(ot)
      buscarOT(ot)
    }
  }, [])

  // ── Buscar OT + asignación ───────────────────────────────────────────────

  async function buscarOT(numero) {
    const n = (numero || otInput).trim().toUpperCase()
    if (!n) return
    setCargandoOT(true); setErrorOT('')
    try {
      // Cargar OT
      const { data: otData, error: otErr } = await supabase
        .from('ots')
        .select('ot_numero,cliente,direccion_faena,tipo_servicio,descripcion,supervisor,sede,email_cliente,contacto')
        .eq('ot_numero', n)
        .maybeSingle()

      if (otErr) throw otErr
      if (!otData) { setErrorOT(`No se encontró la OT "${n}"`); setCargandoOT(false); return }

      setOtCargada(otData)

      // Cargar última asignación
      const { data: asigData } = await supabase
        .from('asignaciones')
        .select('id,ot_numero,inspectores_asignados,supervisor,fecha_inspeccion,tipos_inspeccion,norma_ejecucion,norma_evaluacion,procedimientos,descripcion_actividad')
        .eq('ot_numero', n)
        .order('fecha_inspeccion', { ascending: false })
        .limit(1)
        .maybeSingle()

      setAsignacion(asigData || null)

      // Pre-llenar formulario
      setGeneral({
        ot_numero:         otData.ot_numero || '',
        cliente_nombre:    otData.cliente || '',
        lugar:             otData.direccion_faena || '',
        fecha_inspeccion:  asigData?.fecha_inspeccion || new Date().toISOString().split('T')[0],
        supervisor_nombre: asigData?.supervisor || otData.supervisor || '',
      })

      // Pre-llenar normas desde asignación
      setNormas({
        norma_ejecucion:  asigData?.norma_ejecucion  || '',
        norma_evaluacion: asigData?.norma_evaluacion || '',
        procedimientos:   asigData?.procedimientos   || '',
      })

      // Pre-mapear tipos_inspeccion → métodos END
      if (asigData?.tipos_inspeccion) {
        const mapa = {
          'VT': 'IV', 'VISUAL': 'IV', 'IV': 'IV',
          'PT': 'LP', 'LP': 'LP', 'LIQUIDOS': 'LP',
          'MT': 'PM', 'PM': 'PM', 'MAGNETICAS': 'PM',
          'UT': 'UT_E', 'UTT': 'UT_E', 'ESPESORES': 'UT_E',
          'UTPA': 'UTPA', 'PAUT': 'UTPA',
          'T': 'TERMO', 'IRT': 'TERMO', 'TERMOGRAFIA': 'TERMO',
          'PH': 'HIDRO', 'HIDROSTATICA': 'HIDRO',
          'CARGA': 'CARGA', 'CG': 'CARGA',
        }
        const mapped = (asigData.tipos_inspeccion || '').toUpperCase().split(/[\s,/]+/)
          .map(t => mapa[t.trim()]).filter(Boolean)
        if (mapped.length > 0) setEnd([...new Set(mapped)])
      }

    } catch (e) { setErrorOT(e.message) }
    finally { setCargandoOT(false) }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function toggleEnd(id) {
    setEnd(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function addMedicion() {
    setMediciones(prev => [...prev, { zona: '', nominal_mm: '', medido_mm: '' }])
  }

  function updateMedicion(i, field, val) {
    setMediciones(prev => prev.map((m, j) => j === i ? { ...m, [field]: val } : m))
  }

  function removeMedicion(i) {
    setMediciones(prev => prev.filter((_, j) => j !== i))
  }

  function addHallazgo() {
    if (!hallazgoForm.descripcion.trim()) return
    setHallazgos(prev => [...prev, { ...hallazgoForm, foto_url: null }])
    setHallazgoForm({ descripcion: '', ubicacion: '', norma: '', criticidad: 'Menor' })
  }

  function removeHallazgo(i) {
    setHallazgos(prev => prev.filter((_, j) => j !== i))
  }

  async function subirFoto(file, hallazgoIdx) {
    setSubiendoFoto(true)
    const ext  = file.name.split('.').pop()
    const path = `hallazgo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('informes-fotos').upload(path, file)
    if (!error) {
      const url = supabase.storage.from('informes-fotos').getPublicUrl(path).data.publicUrl
      setHallazgos(prev => prev.map((h, i) => i === hallazgoIdx ? { ...h, foto_url: url } : h))
    }
    setSubiendoFoto(false)
  }

  // ── Generar con IA ───────────────────────────────────────────────────────

  async function generarConIA() {
    setGenerando(true); setErrorIA('')
    try {
      const res = await fetch('/api/generar-informe-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_equipo:       tipo,
          ot_numero:         general.ot_numero,
          cliente_nombre:    general.cliente_nombre,
          lugar:             general.lugar,
          fecha_inspeccion:  general.fecha_inspeccion,
          inspector_nombre:  usuario?.nombre || usuario?.email,
          supervisor_nombre: general.supervisor_nombre,
          datos_equipo:      equipo,
          end_aplicados:     endAplicados,
          mediciones,
          hallazgos,
          resultado,
          norma_ejecucion:   normas.norma_ejecucion,
          norma_evaluacion:  normas.norma_evaluacion,
          procedimientos:    normas.procedimientos,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setTextoIA(d.texto_ia)
    } catch (e) { setErrorIA(e.message) }
    finally { setGenerando(false) }
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  async function guardar(estado) {
    if (!tipo) return setErrorGuardar('Selecciona el tipo de equipo')
    setGuardando(true); setErrorGuardar('')
    const { data, error } = await supabase.from('informes').insert({
      tipo_equipo:       tipo,
      ot_numero:         general.ot_numero,
      cliente_nombre:    general.cliente_nombre,
      lugar:             general.lugar,
      fecha_inspeccion:  general.fecha_inspeccion,
      supervisor_nombre: general.supervisor_nombre,
      inspector_id:      usuario?.id,
      inspector_nombre:  usuario?.nombre || usuario?.email,
      datos_equipo:      equipo,
      end_aplicados:     endAplicados,
      mediciones,
      hallazgos,
      resultado,
      texto_ia:          textoIA,
      estado,
    }).select('id').single()
    setGuardando(false)
    if (error) return setErrorGuardar(error.message)
    navigate(`/informes/${data.id}`)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const camposActivos       = CAMPOS[tipo] || []
  const necesitaMediciones  = ['TANQUE', 'TUBERIA'].includes(tipo)
  const seccionesIA         = textoIA
    ? ['introduccion','descripcion_equipo','end_realizados','hallazgos','evaluacion','conclusion','recomendaciones']
    : []
  const otLista = otCargada !== null

  // Offset de numeración de pasos
  const paso = (n) => otLista ? n : n

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 28 }}>
        <div>
          <button onClick={() => navigate('/informes')}
            style={{ background: 'none', border: 'none', color: 'var(--gris)', cursor: 'pointer', fontSize: 13, marginBottom: 6 }}>
            ← Volver a Informes
          </button>
          <h1>📋 Nuevo Informe de Inspección</h1>
        </div>
      </div>

      {/* ── PASO 0: Vincular OT ── */}
      <div style={S.seccion}>
        <div style={S.seccionTitulo}>① Vincular Orden de Trabajo</div>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
          Ingresa el N° de OT para cargar automáticamente el cliente, lugar, fecha, normas y procedimientos desde la asignación.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input className="input"
              value={otInput}
              onChange={e => { setOtInput(e.target.value.toUpperCase()); setErrorOT('') }}
              onKeyDown={e => e.key === 'Enter' && buscarOT()}
              placeholder="Ej: OTSCL062628700"
              style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, letterSpacing: '.5px' }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => buscarOT()} disabled={cargandoOT || !otInput.trim()}>
            {cargandoOT ? '⏳ Cargando...' : '🔍 Cargar datos'}
          </button>
          {otCargada && (
            <button className="btn btn-secondary" onClick={() => {
              setOtCargada(null); setAsignacion(null); setGeneral({ ot_numero:'', cliente_nombre:'', lugar:'', fecha_inspeccion: new Date().toISOString().split('T')[0], supervisor_nombre:'' })
              setNormas({ norma_ejecucion:'', norma_evaluacion:'', procedimientos:'' }); setEnd([])
            }}>✕ Limpiar</button>
          )}
        </div>
        {errorOT && <div className="alert alert-error" style={{ marginTop: 10 }}>⚠ {errorOT}</div>}

        {/* Resumen de datos cargados */}
        {otCargada && (
          <div style={{ marginTop: 16, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              ✅ Datos cargados desde OT {otCargada.ot_numero}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 12, color: '#166534' }}>
              <div><span style={{ color: '#4B5563' }}>Cliente:</span> <strong>{otCargada.cliente || '—'}</strong></div>
              <div><span style={{ color: '#4B5563' }}>Lugar:</span> <strong>{otCargada.direccion_faena || '—'}</strong></div>
              {asignacion && <>
                <div><span style={{ color: '#4B5563' }}>Fecha inspección:</span> <strong>{asignacion.fecha_inspeccion || '—'}</strong></div>
                <div><span style={{ color: '#4B5563' }}>Supervisor:</span> <strong>{asignacion.supervisor || '—'}</strong></div>
                {asignacion.norma_ejecucion  && <div style={{ gridColumn:'1/-1' }}><span style={{ color: '#4B5563' }}>Norma ejecución:</span> <strong>{asignacion.norma_ejecucion}</strong></div>}
                {asignacion.norma_evaluacion && <div style={{ gridColumn:'1/-1' }}><span style={{ color: '#4B5563' }}>Norma evaluación:</span> <strong>{asignacion.norma_evaluacion}</strong></div>}
                {asignacion.procedimientos   && <div style={{ gridColumn:'1/-1' }}><span style={{ color: '#4B5563' }}>Procedimientos:</span> <strong>{asignacion.procedimientos}</strong></div>}
                {asignacion.tipos_inspeccion && <div style={{ gridColumn:'1/-1' }}><span style={{ color: '#4B5563' }}>Tipos END:</span> <strong>{asignacion.tipos_inspeccion}</strong></div>}
              </>}
              {!asignacion && <div style={{ gridColumn:'1/-1', color:'#92400E', fontStyle:'italic' }}>⚠ Sin asignación registrada para esta OT. Completa los datos manualmente.</div>}
            </div>
          </div>
        )}
      </div>

      {/* El resto del formulario solo aparece si hay OT cargada O si el usuario lo quiere saltarse */}
      {!otCargada && (
        <div style={{ textAlign: 'center', padding: '12px 0', marginBottom: 16 }}>
          <button
            onClick={() => setOtCargada({})}
            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Continuar sin vincular OT →
          </button>
        </div>
      )}

      {otCargada !== null && (<>

        {/* ── PASO 1: Tipo de equipo ── */}
        <div style={S.seccion}>
          <div style={S.seccionTitulo}>② Tipo de Equipo a Inspeccionar</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {TIPOS.map(t => (
              <button key={t.id} onClick={() => { setTipo(t.id); setEquipo({}) }}
                style={{
                  ...S.tipoCard,
                  border: tipo === t.id ? `2px solid ${t.color}` : '2px solid #E2E8F0',
                  background: tipo === t.id ? `${t.color}10` : '#fff',
                }}>
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: tipo === t.id ? t.color : '#1E293B', fontSize: 14 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── PASO 2: Datos generales ── */}
        <div style={S.seccion}>
          <div style={S.seccionTitulo}>③ Datos Generales</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={S.label}>N° OT</label>
              <input className="input" value={general.ot_numero}
                onChange={e => setGeneral(p => ({ ...p, ot_numero: e.target.value }))}
                placeholder="OTSCL0XXXXXXXXX" style={{ fontFamily: 'monospace', fontWeight: 700 }} />
            </div>
            <div>
              <label style={S.label}>Cliente <span style={{ color: 'red' }}>*</span></label>
              <input className="input" value={general.cliente_nombre}
                onChange={e => setGeneral(p => ({ ...p, cliente_nombre: e.target.value }))}
                placeholder="Nombre del cliente" />
            </div>
            <div>
              <label style={S.label}>Fecha de inspección</label>
              <input className="input" type="date" value={general.fecha_inspeccion}
                onChange={e => setGeneral(p => ({ ...p, fecha_inspeccion: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Lugar / Instalación</label>
              <input className="input" value={general.lugar}
                onChange={e => setGeneral(p => ({ ...p, lugar: e.target.value }))}
                placeholder="Planta, ciudad, región" />
            </div>
            <div>
              <label style={S.label}>Inspector</label>
              <input className="input" value={usuario?.nombre || usuario?.email || ''} disabled
                style={{ background: '#F8FAFC', color: '#475569' }} />
            </div>
            <div>
              <label style={S.label}>Supervisor</label>
              <input className="input" value={general.supervisor_nombre}
                onChange={e => setGeneral(p => ({ ...p, supervisor_nombre: e.target.value }))}
                placeholder="Nombre del supervisor" />
            </div>
          </div>
        </div>

        {/* ── PASO 3: Normas y procedimientos ── */}
        <div style={S.seccion}>
          <div style={S.seccionTitulo}>④ Normas y Procedimientos</div>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
            Cargados desde la asignación. Puedes editar o completar si corresponde.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={S.label}>Norma de ejecución</label>
              <input className="input" value={normas.norma_ejecucion}
                onChange={e => setNormas(p => ({ ...p, norma_ejecucion: e.target.value }))}
                placeholder="Ej: API 653, ASME V, AWS D1.1..." />
            </div>
            <div>
              <label style={S.label}>Norma de evaluación / criterio de aceptación</label>
              <input className="input" value={normas.norma_evaluacion}
                onChange={e => setNormas(p => ({ ...p, norma_evaluacion: e.target.value }))}
                placeholder="Ej: API 653 Tabla 4.3.2, AWS D1.1 Tabla 6.1..." />
            </div>
            <div>
              <label style={S.label}>Procedimientos WSS aplicables</label>
              <textarea className="input" rows={3} value={normas.procedimientos}
                onChange={e => setNormas(p => ({ ...p, procedimientos: e.target.value }))}
                placeholder="Ej: PRO-DII-END-001 Rev.03, PRO-DII-UT-002 Rev.02..." />
            </div>
          </div>
        </div>

        {tipo && (<>
          {/* ── PASO 4: Datos del equipo ── */}
          <div style={S.seccion}>
            <div style={S.seccionTitulo}>⑤ Datos del Equipo — {TIPOS.find(t => t.id === tipo)?.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {camposActivos.map(c => (
                <div key={c.id}>
                  <label style={S.label}>{c.label} {c.req && <span style={{ color: 'red' }}>*</span>}</label>
                  {c.type === 'select' ? (
                    <select className="input" value={equipo[c.id] || ''}
                      onChange={e => setEquipo(p => ({ ...p, [c.id]: e.target.value }))}>
                      <option value="">— Seleccionar —</option>
                      {c.ops.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="input" type={c.type} value={equipo[c.id] || ''}
                      onChange={e => setEquipo(p => ({ ...p, [c.id]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── PASO 5: END Aplicados ── */}
          <div style={S.seccion}>
            <div style={S.seccionTitulo}>⑥ Métodos END Aplicados</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {METODOS_END.map(m => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '8px 12px', borderRadius: 8, border: '1px solid',
                  borderColor: endAplicados.includes(m.id) ? '#1E3A5F' : '#E2E8F0',
                  background: endAplicados.includes(m.id) ? '#EFF6FF' : '#fff', fontSize: 12 }}>
                  <input type="checkbox" checked={endAplicados.includes(m.id)} onChange={() => toggleEnd(m.id)}
                    style={{ accentColor: '#1E3A5F' }} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {/* ── PASO 6: Mediciones (tanque y tubería) ── */}
          {necesitaMediciones && (
            <div style={S.seccion}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={S.seccionTitulo}>⑦ Mediciones de Espesores por Ultrasonido</div>
                <button className="btn btn-secondary btn-sm" onClick={addMedicion}>+ Agregar punto</button>
              </div>
              {mediciones.length === 0 ? (
                <div style={{ color: 'var(--gris)', fontSize: 13, padding: '12px 0' }}>
                  Sin mediciones. Clic en "+ Agregar punto" para ingresar lecturas UT.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Zona / Punto de medición','Espesor nominal (mm)','Espesor medido (mm)','Pérdida (%)',''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left', border: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mediciones.map((m, i) => {
                      const pct = m.nominal_mm && m.medido_mm
                        ? (((m.nominal_mm - m.medido_mm) / m.nominal_mm) * 100).toFixed(1) : '—'
                      return (
                        <tr key={i}>
                          <td style={S.tdInput}><input className="input" value={m.zona} onChange={e => updateMedicion(i,'zona',e.target.value)} placeholder="Ej: Anillo 1 - Zona A" style={{ fontSize:12 }} /></td>
                          <td style={S.tdInput}><input className="input" type="number" value={m.nominal_mm} onChange={e => updateMedicion(i,'nominal_mm',e.target.value)} placeholder="12.5" style={{ fontSize:12 }} /></td>
                          <td style={S.tdInput}><input className="input" type="number" value={m.medido_mm} onChange={e => updateMedicion(i,'medido_mm',e.target.value)} placeholder="11.8" style={{ fontSize:12 }} /></td>
                          <td style={{ padding:'4px 8px', border:'1px solid #E2E8F0', fontSize:12, fontWeight:700,
                            color: parseFloat(pct) > 20 ? '#991B1B' : parseFloat(pct) > 10 ? '#92400E' : '#065F46' }}>
                            {pct !== '—' ? `${pct}%` : '—'}
                          </td>
                          <td style={{ padding:'4px 8px', border:'1px solid #E2E8F0' }}>
                            <button onClick={() => removeMedicion(i)} style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:16 }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── PASO 7: Hallazgos ── */}
          <div style={S.seccion}>
            <div style={S.seccionTitulo}>{necesitaMediciones ? '⑧' : '⑦'} Hallazgos Detectados</div>

            {hallazgos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {hallazgos.map((h, i) => (
                  <div key={i} style={{ display:'flex', gap:10, padding:'10px 14px', borderRadius:8,
                    border: `1px solid ${h.criticidad==='Crítico'?'#FCA5A5':h.criticidad==='Mayor'?'#FCD34D':'#E2E8F0'}`,
                    background: h.criticidad==='Crítico'?'#FEF2F2':h.criticidad==='Mayor'?'#FFFBEB':'#F8FAFC',
                    marginBottom:8, alignItems:'flex-start' }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>
                      {h.criticidad==='Crítico'?'🔴':h.criticidad==='Mayor'?'🟡':h.criticidad==='Menor'?'🟢':'🔵'}
                    </span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13, color:'#1E293B' }}>[{h.criticidad}] {h.descripcion}</div>
                      {h.ubicacion && <div style={{ fontSize:11, color:'#64748B', marginTop:2 }}>📍 {h.ubicacion}</div>}
                      {h.norma     && <div style={{ fontSize:11, color:'#64748B' }}>📐 {h.norma}</div>}
                      {h.foto_url  && <img src={h.foto_url} alt="" style={{ marginTop:6, maxHeight:80, borderRadius:4 }} />}
                      {!h.foto_url && (
                        <label style={{ fontSize:11, color:'#3B82F6', cursor:'pointer', marginTop:4, display:'inline-block' }}>
                          📷 Agregar foto
                          <input type="file" accept="image/*" style={{ display:'none' }}
                            onChange={e => e.target.files[0] && subirFoto(e.target.files[0], i)} />
                        </label>
                      )}
                    </div>
                    <button onClick={() => removeHallazgo(i)}
                      style={{ background:'none', border:'none', color:'#94A3B8', cursor:'pointer', fontSize:16, flexShrink:0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Form nuevo hallazgo */}
            <div style={{ background:'#F8FAFC', borderRadius:10, padding:14, border:'1px dashed #CBD5E1' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:10 }}>+ Agregar hallazgo</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>Descripción <span style={{ color:'red' }}>*</span></label>
                  <textarea className="input" rows={2} value={hallazgoForm.descripcion}
                    onChange={e => setHallazgoForm(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Ej: Corrosión generalizada en primer anillo, con pérdida de espesor estimada en 15%..." />
                </div>
                <div>
                  <label style={S.label}>Ubicación en el equipo</label>
                  <input className="input" value={hallazgoForm.ubicacion}
                    onChange={e => setHallazgoForm(p => ({ ...p, ubicacion: e.target.value }))}
                    placeholder="Ej: Anillo 1, cara Sur, h=2m" />
                </div>
                <div>
                  <label style={S.label}>Norma / criterio de rechazo</label>
                  <input className="input" value={hallazgoForm.norma}
                    onChange={e => setHallazgoForm(p => ({ ...p, norma: e.target.value }))}
                    placeholder="Ej: API 653 Tabla 4.3.2" />
                </div>
                <div>
                  <label style={S.label}>Criticidad</label>
                  <select className="input" value={hallazgoForm.criticidad}
                    onChange={e => setHallazgoForm(p => ({ ...p, criticidad: e.target.value }))}>
                    {CRITICIDADES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={addHallazgo} style={{ marginTop:10 }}>
                + Agregar hallazgo
              </button>
            </div>
          </div>

          {/* ── PASO 8: Resultado ── */}
          <div style={S.seccion}>
            <div style={S.seccionTitulo}>{necesitaMediciones ? '⑨' : '⑧'} Resultado de la Inspección</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                { id:'CONFORME',     icon:'✅', label:'CONFORME',     desc:'Sin defectos fuera de tolerancia', color:'#065F46', bg:'#D1FAE5', border:'#6EE7B7' },
                { id:'CONDICIONADO', icon:'⚠️', label:'CONDICIONADO', desc:'Opera con restricciones o requiere seguimiento', color:'#92400E', bg:'#FEF3C7', border:'#FCD34D' },
                { id:'NO_CONFORME',  icon:'🚫', label:'NO CONFORME',  desc:'Defectos críticos requieren reparación', color:'#991B1B', bg:'#FEE2E2', border:'#FCA5A5' },
              ].map(r => (
                <button key={r.id} onClick={() => setResultado(r.id)}
                  style={{ padding:'14px 12px', borderRadius:10, border:`2px solid ${resultado===r.id?r.border:'#E2E8F0'}`,
                    background: resultado===r.id?r.bg:'#fff', cursor:'pointer', textAlign:'center' }}>
                  <div style={{ fontSize:24, marginBottom:4 }}>{r.icon}</div>
                  <div style={{ fontWeight:700, fontSize:13, color: resultado===r.id?r.color:'#1E293B' }}>{r.label}</div>
                  <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── PASO 9: Generar con IA ── */}
          <div style={S.seccion}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={S.seccionTitulo}>{necesitaMediciones ? '⑩' : '⑨'} Generar Informe Técnico con IA</div>
              <button onClick={generarConIA} disabled={generando || !tipo}
                style={{ ...S.btnIA, opacity: (generando || !tipo) ? .7 : 1 }}>
                {generando ? '⏳ Generando...' : '✨ Generar con IA'}
              </button>
            </div>

            {errorIA && <div className="alert alert-error" style={{ marginBottom:12 }}>⚠ {errorIA}</div>}

            {!textoIA && !generando && (
              <div style={{ color:'var(--gris)', fontSize:13, padding:'16px', background:'#F8FAFC', borderRadius:8, textAlign:'center' }}>
                Completa los pasos anteriores y haz clic en "✨ Generar con IA" para que Claude redacte el texto técnico completo del informe en lenguaje normativo, usando las normas y procedimientos definidos en la asignación.
              </div>
            )}

            {textoIA && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {seccionesIA.map(s => (
                  <div key={s}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>
                      {s.replace(/_/g,' ')}
                    </div>
                    <textarea className="input" rows={4}
                      value={textoIA[s] || ''}
                      onChange={e => setTextoIA(prev => ({ ...prev, [s]: e.target.value }))}
                      style={{ fontSize:13, lineHeight:1.6, resize:'vertical' }} />
                  </div>
                ))}
                <div style={{ padding:'10px 14px', background:'#EDE9FE', borderRadius:8, fontSize:12, color:'#5B21B6' }}>
                  💡 Puedes editar cualquier sección antes de guardar. Los cambios se preservan.
                </div>
              </div>
            )}
          </div>

          {/* ── Acciones finales ── */}
          {errorGuardar && <div className="alert alert-error" style={{ marginBottom:14 }}>⚠ {errorGuardar}</div>}

          <div style={{ display:'flex', gap:12, justifyContent:'flex-end', paddingBottom:40 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/informes')} disabled={guardando}>
              Cancelar
            </button>
            <button className="btn btn-secondary" onClick={() => guardar('BORRADOR')} disabled={guardando}>
              {guardando ? 'Guardando...' : '💾 Guardar borrador'}
            </button>
            <button className="btn btn-primary" onClick={() => guardar('EN_REVISION')} disabled={guardando || !resultado}>
              {guardando ? 'Enviando...' : '📤 Enviar a supervisor'}
            </button>
          </div>
        </>)}

      </>)}
    </div>
  )
}

const S = {
  seccion: {
    background:'#fff', borderRadius:12, border:'1px solid #E2E8F0',
    padding:'20px 24px', marginBottom:20,
    boxShadow:'0 1px 4px rgba(0,0,0,.04)',
  },
  seccionTitulo: {
    fontSize:14, fontWeight:700, color:'#1E3A5F',
    marginBottom:16, paddingBottom:10,
    borderBottom:'1px solid #F1F5F9',
  },
  label: { fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:4 },
  tipoCard: {
    display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
    borderRadius:10, cursor:'pointer', textAlign:'left',
  },
  tdInput: { padding:'4px 8px', border:'1px solid #E2E8F0' },
  btnIA: {
    background:'linear-gradient(135deg,#7C3AED,#5B21B6)',
    color:'#fff', border:'none', borderRadius:10,
    padding:'10px 20px', fontWeight:700, fontSize:14,
    cursor:'pointer', display:'flex', alignItems:'center', gap:6,
  },
}
