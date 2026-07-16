import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { encolarInforme } from '../lib/offlineDB'
import CroquisEquipo from '../components/CroquisEquipo'

// ── Configuración por tipo de equipo ──────────────────────────────────────────

const TIPOS = [
  { id: 'TANQUE',     icon: '🛢️', label: 'Tanque',         desc: 'API 650 / API 653 / DS43', color: '#1D4ED8' },
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
    { id: 'norma_diseño',     label: 'Norma de diseño',         type: 'select', ops: ['API 650 (Ed. 13, 2020)','API 653 (Ed. 5, 2014)','API 620 (Ed. 12, 2013)','ASME VIII Div.1 (Ed. 2021)','Otra'] },
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
    { id: 'norma_soldadura',  label: 'Norma de soldadura',            type: 'select', ops: ['AWS D1.1 (Ed. 2020)','AWS D1.2 (Ed. 2014)','AWS D1.3 (Ed. 2018)','AWS D1.6 (Ed. 2017)','ASME BPVC Secc. V (Ed. 2021)','Otra'] },
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

// ── Familias de elementos IZAJE con columnas específicas por tabla ─────────────
// Familia HARDWARE: Grilletes, Cáncamos, Ganchos → Medida|Marca|Modelo|Cap|N°Serie|Sello WSS
// Familia ESLINGA:  Eslingas planas/cadena/cable → Largo|Marca|N°Serie-Código|Ancho|Cap|Sello WSS
// Familia GRUA:     Equipos mayores               → Cap|Luz|Vel|CertOp|UltInsp

const TIPOS_IZAJE = {
  hardware: ['Grillete','Grillete conector','Cáncamo Giratorio','Cáncamo Fijo','Gancho'],
  eslinga:  ['Eslinga Plana','Eslinga cadena','Eslinga cable de acero','Eslinga textil'],
  grua:     ['Grúa Puente','Grúa Pórtico','Grúa Horquilla','Grúa Articulada','Grúa Móvil','Aparejo diferencial'],
  otro:     ['Esparrago','Otro'],
}

const TODOS_TIPOS_IZAJE = [
  ...TIPOS_IZAJE.hardware, ...TIPOS_IZAJE.eslinga, ...TIPOS_IZAJE.grua, ...TIPOS_IZAJE.otro
]

function getFamiliaIzaje(tipo) {
  for (const [fam, lista] of Object.entries(TIPOS_IZAJE)) {
    if (lista.includes(tipo)) return fam
  }
  return 'otro'
}

// Columnas por familia (excluye: Item, Tipo, Sello Antiguo y Resultado que son comunes)
const COLS_FAMILIA = {
  hardware: [
    { id:'medida',    label:'Medida',    ph:'ej: 2", M16, 5/8"', w:90 },
    { id:'marca',     label:'Marca',     ph:'ej: Crosby',         w:90 },
    { id:'modelo',    label:'Modelo',    ph:'S/I',                w:70 },
    { id:'capacidad', label:'Capacidad', ph:'ej: 35 Ton',         w:90 },
    { id:'n_serie',   label:'N° Serie',  ph:'S/I',                w:90 },
    { id:'sello_wss', label:'Sello WSS', ph:'ej: 1341',           w:80 },
  ],
  eslinga: [
    { id:'largo',     label:'Largo',          ph:'ej: 6 m',   w:70 },
    { id:'marca',     label:'Marca',          ph:'ej: Gorila', w:90 },
    { id:'n_serie',   label:'N°Serie/Código', ph:'',           w:150 },
    { id:'ancho',     label:'Ancho',          ph:'ej: 50 mm',  w:75 },
    { id:'capacidad', label:'Capacidad',      ph:'ej: 4000 Kg',w:90 },
    { id:'sello_wss', label:'Sello WSS',      ph:'ej: 1341',   w:80 },
  ],
  grua: [
    { id:'capacidad',              label:'Capacidad',       ph:'ej: 5 Ton', w:90 },
    { id:'luz_m',                  label:'Luz / Radio (m)', ph:'',          w:100 },
    { id:'velocidad_izaje',        label:'Vel. izaje',      ph:'',          w:90 },
    { id:'certificado_operacion',  label:'Cert. operación', ph:'',          w:120 },
    { id:'fecha_ultima_inspeccion',label:'Últ. inspección', ph:'',          w:110 },
  ],
  otro: [
    { id:'capacidad', label:'Capacidad', ph:'', w:90 },
    { id:'marca',     label:'Marca',     ph:'', w:90 },
    { id:'n_serie',   label:'N° Serie',  ph:'', w:100 },
    { id:'sello_wss', label:'Sello WSS', ph:'', w:80 },
  ],
}

// Para compatibilidad con código anterior que usaba CAMPOS_IZAJE
const CAMPOS_IZAJE = {}

// ── Configuración inspección TANQUE ──────────────────────────────────────────

const TK_GEOM_FIELDS = {
  vertical: [
    { id:'diametro_m',        label:'Diámetro (m)',          type:'number' },
    { id:'altura_m',          label:'Altura total (m)',       type:'number' },
    { id:'num_cursos',        label:'N° cursos / anillos',   type:'number' },
    { id:'tipo_techo',        label:'Tipo de techo',          type:'select', ops:['Cónico fijo','Autoportante','Flotante externo','Flotante interno','Abierto'] },
    { id:'capacidad_m3',      label:'Capacidad (m³)',         type:'number' },
    { id:'año_fabricacion',   label:'Año fabricación',        type:'number' },
    { id:'ultima_inspeccion', label:'Última inspección',      type:'date'   },
  ],
  horizontal: [
    { id:'diametro_m',         label:'Diámetro (m)',          type:'number' },
    { id:'longitud_m',         label:'Longitud total (m)',     type:'number' },
    { id:'num_compartimentos', label:'N° compartimentos',      type:'number' },
    { id:'tipo_soporte',       label:'Tipo de soporte',       type:'select', ops:['Sillas fijas','Sillas deslizantes','Enterrado'] },
    { id:'capacidad_m3',       label:'Capacidad (m³)',         type:'number' },
    { id:'año_fabricacion',    label:'Año fabricación',        type:'number' },
    { id:'ultima_inspeccion',  label:'Última inspección',      type:'date'   },
  ],
}

const TK_CHECKLIST = {
  'Acero-externo': [
    { id:'pintura',       label:'Estado pintura / recubrimiento exterior' },
    { id:'corrosion_ext', label:'Corrosión exterior visible' },
    { id:'deform_manto',  label:'Deformaciones del manto' },
    { id:'fundacion',     label:'Estado fundación / base' },
    { id:'boquillas',     label:'Boquillas y conexiones' },
    { id:'valvulas',      label:'Estado válvulas' },
    { id:'escaleras',     label:'Escaleras / plataformas / barandas' },
    { id:'venteos',       label:'Sistema de venteo' },
    { id:'tierra',        label:'Sistema de tierra / puesta a tierra' },
    { id:'incendio',      label:'Sistema contra incendio' },
  ],
  'Acero-interno': [
    { id:'fondo_corr',    label:'Corrosión interna del fondo' },
    { id:'fondo_pitting', label:'Pitting fondo (cantidad / profundidad)' },
    { id:'fondo_deform',  label:'Deformaciones del fondo' },
    { id:'sold_fondo',    label:'Estado soldaduras fondo' },
    { id:'caja_vacio',    label:'Prueba caja de vacío (soldaduras fondo)' },
    { id:'lp_sold',       label:'Líquidos penetrantes (soldaduras críticas)' },
    { id:'manto_int',     label:'Estado manto interior (por curso)' },
    { id:'techo_int',     label:'Estado techo interior' },
    { id:'boquillas_int', label:'Boquillas interiores' },
  ],
  'Plástico (PE/PP)-externo': [
    { id:'grietas',       label:'Grietas / fisuras superficie exterior' },
    { id:'decoloracion',  label:'Decoloración / degradación UV' },
    { id:'deformaciones', label:'Deformaciones / ablandamiento' },
    { id:'uniones_termo', label:'Estado uniones termosoldadas' },
    { id:'soportes',      label:'Estado soportes / sillas' },
    { id:'fundacion',     label:'Estado fundación / base' },
    { id:'boquillas',     label:'Boquillas y conexiones' },
  ],
  'Plástico (PE/PP)-interno': [
    { id:'sup_int',       label:'Estado superficie interior' },
    { id:'fisuras_int',   label:'Fisuras / grietas internas' },
    { id:'uniones_int',   label:'Estado uniones termosoldadas internas' },
    { id:'fondo_int',     label:'Estado fondo interior' },
    { id:'emision_ac',    label:'Emisión acústica (si aplica)' },
  ],
  'FRP-externo': [
    { id:'uv_deg',        label:'Degradación UV superficie exterior' },
    { id:'ampollas',      label:'Ampollas / burbujas' },
    { id:'fisuras_araña', label:'Fisuras en araña (crazing)' },
    { id:'delaminacion',  label:'Delaminación exterior (coin tap test)' },
    { id:'barcol',        label:'Dureza Barcol (curado de resina)' },
    { id:'laminado',      label:'Estado laminado secundario / uniones' },
    { id:'deformaciones', label:'Deformaciones del cuerpo' },
    { id:'fundacion',     label:'Estado fundación / base' },
    { id:'boquillas',     label:'Boquillas y conexiones' },
  ],
  'FRP-interno': [
    { id:'liner_int',     label:'Estado liner / revestimiento interior' },
    { id:'delam_int',     label:'Delaminación interior (coin tap test)' },
    { id:'fisuras_int',   label:'Fisuras internas' },
    { id:'fondo_int',     label:'Estado fondo interior' },
    { id:'emision_ac',    label:'Emisión acústica (si aplica)' },
    { id:'uniones_int',   label:'Estado uniones internas' },
  ],

  // ── Contingencia (por demanda / problema reportado) ───────────────────────
  'Acero-contingencia': [
    { id:'descripcion_zona',   label:'Zona afectada identificada' },
    { id:'tipo_dano_fuga',     label:'Tipo daño — Fuga / Filtración' },
    { id:'tipo_dano_corr',     label:'Tipo daño — Corrosión acelerada' },
    { id:'tipo_dano_deform',   label:'Tipo daño — Deformación / Abolladuras' },
    { id:'tipo_dano_impacto',  label:'Tipo daño — Impacto externo' },
    { id:'tipo_dano_grieta',   label:'Tipo daño — Grieta / Fisura' },
    { id:'visual_zona',        label:'Inspección visual focalizada zona afectada' },
    { id:'ut_zona',            label:'UT en zona afectada (medición espesores)' },
    { id:'lp_pm_zona',         label:'LP / PM en zona afectada (si aplica)' },
    { id:'evaluacion_ffs',     label:'Evaluación aptitud servicio (API 579-1 / FFS)' },
    { id:'riesgo_propagacion', label:'Evaluación riesgo de propagación' },
    { id:'apto_continuar',     label:'Apto para continuar operación (con/sin restricciones)' },
  ],
  'Plástico (PE/PP)-contingencia': [
    { id:'zona_afectada',      label:'Zona afectada identificada' },
    { id:'tipo_dano_fuga',     label:'Tipo daño — Fuga / Filtración' },
    { id:'tipo_dano_grieta',   label:'Tipo daño — Grieta / Fisura' },
    { id:'tipo_dano_deform',   label:'Tipo daño — Deformación / Ablandamiento' },
    { id:'visual_zona',        label:'Inspección visual focalizada zona afectada' },
    { id:'emision_ac',         label:'Emisión acústica zona afectada (si aplica)' },
    { id:'evaluacion_ffs',     label:'Evaluación aptitud para servicio' },
    { id:'apto_continuar',     label:'Apto para continuar operación' },
  ],
  'FRP-contingencia': [
    { id:'zona_afectada',      label:'Zona afectada identificada' },
    { id:'tipo_dano_fuga',     label:'Tipo daño — Fuga / Filtración' },
    { id:'tipo_dano_delam',    label:'Tipo daño — Delaminación' },
    { id:'tipo_dano_fisura',   label:'Tipo daño — Fisura / Rotura' },
    { id:'tipo_dano_impacto',  label:'Tipo daño — Impacto externo' },
    { id:'coin_tap_zona',      label:'Coin tap test zona afectada' },
    { id:'barcol_zona',        label:'Dureza Barcol zona afectada' },
    { id:'emision_ac',         label:'Emisión acústica (si aplica)' },
    { id:'evaluacion_ffs',     label:'Evaluación aptitud para servicio' },
    { id:'apto_continuar',     label:'Apto para continuar operación' },
  ],

  // ── Post-reparación ───────────────────────────────────────────────────────
  'Acero-post_reparacion': [
    { id:'tipo_reparacion',    label:'Tipo de reparación realizada' },
    { id:'wps_pqr',            label:'WPS / PQR aplicable disponible' },
    { id:'vt_soldadura_rep',   label:'VT soldaduras de reparación (API 653)' },
    { id:'lp_pm_sold_rep',     label:'LP / PM soldaduras reparación' },
    { id:'ut_zona_rep',        label:'UT zona reparada (verificación espesor)' },
    { id:'prueba_hermeticidad',label:'Prueba de hermeticidad zona reparada' },
    { id:'revestimiento_rep',  label:'Estado recubrimiento post-reparación' },
    { id:'reintegracion_ok',   label:'Zona reparada apta para reintegrar al servicio' },
  ],
  'Plástico (PE/PP)-post_reparacion': [
    { id:'tipo_reparacion',    label:'Tipo de reparación (termofusión / parche)' },
    { id:'vt_union_rep',       label:'VT uniones de reparación' },
    { id:'prueba_hermeticidad',label:'Prueba de hermeticidad zona reparada' },
    { id:'reintegracion_ok',   label:'Zona reparada apta para reintegrar al servicio' },
  ],
  'FRP-post_reparacion': [
    { id:'tipo_reparacion',    label:'Tipo de reparación (laminado secundario / parche)' },
    { id:'coin_tap_rep',       label:'Coin tap test zona reparada' },
    { id:'barcol_rep',         label:'Dureza Barcol zona reparada (curado correcto)' },
    { id:'prueba_hermeticidad',label:'Prueba de hermeticidad zona reparada' },
    { id:'reintegracion_ok',   label:'Zona reparada apta para reintegrar al servicio' },
  ],
}

const TK_TIPOS_INSPECCION = [
  { id:'preoperacional',   icon:'🆕', label:'Pre-operacional / Nuevo',      sub:'API 650 · DS 43/2015' },
  { id:'externa_5',        icon:'🔍', label:'Periódica Externa — 5 años',   sub:'API 653 · DS 43/2015' },
  { id:'interna_10',       icon:'🔬', label:'Periódica Interna — 10 años',  sub:'API 653 · DS 43/2015' },
  { id:'contingencia',     icon:'⚠️', label:'Por demanda / Contingencia',   sub:'API 653 · API 579-1' },
  { id:'post_reparacion',  icon:'🔧', label:'Post-reparación',              sub:'API 653 · ASME V' },
  { id:'retorno_servicio', icon:'▶️', label:'Retorno al servicio',          sub:'API 653' },
  { id:'cert_ds43',        icon:'📜', label:'Certificación DS 43 (INN)',    sub:'DS 43/2015 · API 653' },
]

const TK_NORMAS_POR_TIPO = {
  preoperacional:   'API 650 (Ed. 13, 2020) · DS 43/2015 · ASME V (Ed. 2021)',
  externa_5:        'API 653 (Ed. 5, 2014) · DS 43/2015 · ASME V (Ed. 2021)',
  interna_10:       'API 653 (Ed. 5, 2014) · DS 43/2015 · ASME V (Ed. 2021)',
  contingencia:     'API 653 (Ed. 5, 2014) · API 579-1/ASME FFS-1 (Ed. 2016) · DS 43/2015',
  post_reparacion:  'API 653 (Ed. 5, 2014) · ASME V (Ed. 2021) · AWS D1.1 (Ed. 2020)',
  retorno_servicio: 'API 653 (Ed. 5, 2014) · DS 43/2015',
  cert_ds43:        'DS 43/2015 (Art. 38-52) · API 653 (Ed. 5, 2014) · Acreditación INN',
}

const TK_NORMAS = {
  'Acero':             'API 650 (Ed. 13, 2020) · API 653 (Ed. 5, 2014) · DS 43/2015 · ASME V (Ed. 2021)',
  'Plástico (PE/PP)':  'DS 43/2015 · ASTM D1998 · NTC 4384',
  'FRP':               'ASTM D3299 · ASME RTP-1 · DS 43/2015 · AWWA D120',
}

// Mapea (material, tipoInspeccion) → clave del checklist
function getTkChecklistKey(material, tipoInspeccion) {
  const esExterno = ['preoperacional','externa_5','cert_ds43','retorno_servicio'].includes(tipoInspeccion)
  const esInterno = ['interna_10'].includes(tipoInspeccion)
  const esContingencia = tipoInspeccion === 'contingencia'
  const esPostRep = tipoInspeccion === 'post_reparacion'

  if (esContingencia)  return `${material}-contingencia`
  if (esPostRep)       return `${material}-post_reparacion`
  if (esInterno)       return `${material}-interno`
  return `${material}-externo`   // preoperacional, externa_5, cert_ds43, retorno_servicio
}

// ── Configuración inspección TUBERÍA ─────────────────────────────────────────

const TUB_TIPOS_INSPECCION = [
  { id:'preoperacional',   icon:'🆕', label:'Pre-operacional / Nueva instalación', sub:'ASME B31.3 · API 570 · DS 43' },
  { id:'ut_espesores',     icon:'📏', label:'Medición de espesores (UT)',           sub:'API 570 · ASME V Art. 5' },
  { id:'lp',               icon:'🔵', label:'Líquidos Penetrantes (LP)',            sub:'ASTM E165 · ASME V Art. 6' },
  { id:'pm',               icon:'🔴', label:'Partículas Magnéticas (PM)',           sub:'ASTM E709 · ASME V Art. 7' },
  { id:'ph',               icon:'💧', label:'Prueba Hidrostática (PH)',             sub:'ASME B31.3 Párr.345 · API 570' },
  { id:'contingencia',     icon:'⚠️', label:'Por demanda / Contingencia',          sub:'API 570 · API 579-1/FFS' },
  { id:'post_reparacion',  icon:'🔧', label:'Post-reparación',                     sub:'API 570 · ASME V' },
  { id:'retorno_servicio', icon:'▶️', label:'Retorno al servicio',                 sub:'API 570' },
  { id:'integral',         icon:'🔬', label:'Inspección integral (múltiples END)', sub:'API 570 · ASME B31.3' },
]

const TUB_NORMAS_POR_TIPO = {
  preoperacional:   'ASME B31.3 (Ed. 2022) · API 570 (Ed. 4, 2016) · ASME V (Ed. 2021) · DS 43/2015',
  ut_espesores:     'API 570 (Ed. 4, 2016) · ASME V Art. 5 (Ed. 2021) · ASME B31.3 (Ed. 2022)',
  lp:               'ASTM E165 (Ed. 2018) · ASTM E1417 (Ed. 2021) · ASME V Art. 6 (Ed. 2021)',
  pm:               'ASTM E709 (Ed. 2021) · ASTM E1444 (Ed. 2016) · ASME V Art. 7 (Ed. 2021)',
  ph:               'ASME B31.3 Párr. 345 (Ed. 2022) · API 570 (Ed. 4, 2016) · DS 43/2015',
  contingencia:     'API 570 (Ed. 4, 2016) · API 579-1/ASME FFS-1 (Ed. 2016) · DS 43/2015',
  post_reparacion:  'API 570 (Ed. 4, 2016) · ASME V (Ed. 2021) · AWS D1.1 (Ed. 2020)',
  retorno_servicio: 'API 570 (Ed. 4, 2016) · ASME B31.3 (Ed. 2022)',
  integral:         'API 570 (Ed. 4, 2016) · ASME B31.3 (Ed. 2022) · ASME V (Ed. 2021)',
}

const TUB_CHECKLIST = {
  preoperacional: [
    { id:'cert_mat',      label:'Certificados de material (MTR) disponibles' },
    { id:'wps_pqr',       label:'WPS / PQR aplicable disponible' },
    { id:'vt_sold',       label:'VT soldaduras circunferenciales' },
    { id:'dimensional',   label:'Verificación dimensional (DN, espesor, longitud)' },
    { id:'soporteria',    label:'Estado de soportería y fijaciones' },
    { id:'accesorios',    label:'Estado accesorios (válvulas, bridas, juntas)' },
    { id:'revestimiento', label:'Estado revestimiento / pintura / aislación' },
    { id:'prueba_presion',label:'Prueba de presión realizada' },
  ],
  ut_espesores: [
    { id:'rectas',        label:'Medición en tramos rectos' },
    { id:'codos',         label:'Medición en codos (extradós / intradós)' },
    { id:'tees',          label:'Medición en tees y ramales' },
    { id:'reducciones',   label:'Medición en reducciones' },
    { id:'zonas_crit',    label:'Zonas de corrosión preferencial identificadas' },
    { id:'cui',           label:'Inspección bajo aislación (CUI) — si aplica' },
  ],
  lp: [
    { id:'limpieza',      label:'Limpieza superficial previa (grado requerido)' },
    { id:'penetrante',    label:'Aplicación penetrante (tiempo penetración cumplido)' },
    { id:'remocion',      label:'Remoción exceso penetrante correcta' },
    { id:'revelador',     label:'Aplicación revelador correcta' },
    { id:'interpretacion',label:'Interpretación y evaluación de indicaciones' },
    { id:'documentacion', label:'Discontinuidades documentadas y ubicadas' },
  ],
  pm: [
    { id:'material_ferr', label:'Confirmado material ferromagnético' },
    { id:'calibracion',   label:'Calibración yoquillo / bobina verificada' },
    { id:'campo_long',    label:'Campo longitudinal aplicado' },
    { id:'campo_circ',    label:'Campo circular aplicado' },
    { id:'interpretacion',label:'Interpretación y evaluación de indicaciones' },
    { id:'documentacion', label:'Discontinuidades documentadas y ubicadas' },
  ],
  ph: [
    { id:'aislamiento',   label:'Aislamiento de sistemas adyacentes completado' },
    { id:'instrumentos',  label:'Manómetros calibrados y verificados' },
    { id:'presion_ok',    label:'Presión de prueba = 1.5 × Pdiseño confirmada' },
    { id:'llenado',       label:'Llenado completo (sin vacíos de aire)' },
    { id:'sostenida',     label:'Presión sostenida durante tiempo requerido' },
    { id:'sin_fugas',     label:'Sin fugas en juntas / soldaduras / accesorios' },
    { id:'despresurizado',label:'Despresurización controlada completada' },
  ],
  contingencia: [
    { id:'zona_id',       label:'Zona afectada identificada y delimitada' },
    { id:'dano_fuga',     label:'Tipo daño — Fuga / Filtración' },
    { id:'dano_fisura',   label:'Tipo daño — Fisura / Grieta' },
    { id:'dano_corr',     label:'Tipo daño — Corrosión acelerada / perforación' },
    { id:'dano_deform',   label:'Tipo daño — Deformación / Impacto' },
    { id:'ut_zona',       label:'UT en zona afectada' },
    { id:'lp_pm_zona',    label:'LP / PM en zona afectada (si aplica)' },
    { id:'ffs',           label:'Evaluación aptitud servicio (API 579-1 / FFS)' },
    { id:'propagacion',   label:'Evaluación riesgo de propagación' },
    { id:'apto',          label:'Apto para continuar operación' },
  ],
  post_reparacion: [
    { id:'tipo_rep',      label:'Tipo reparación (sleeve / parche / reemplazo spool)' },
    { id:'wps_pqr',       label:'WPS / PQR de reparación disponible' },
    { id:'vt_rep',        label:'VT soldaduras de reparación' },
    { id:'lp_pm_rep',     label:'LP / PM soldaduras reparación' },
    { id:'ut_zona',       label:'UT zona reparada (verificación espesor)' },
    { id:'hermeticidad',  label:'Prueba de hermeticidad zona reparada' },
    { id:'revestimiento', label:'Revestimiento post-reparación aplicado' },
    { id:'apto',          label:'Zona reparada apta para retornar al servicio' },
  ],
  retorno_servicio: [
    { id:'tiempo_fuera',  label:'Tiempo fuera de servicio documentado' },
    { id:'vt_general',    label:'Inspección visual general' },
    { id:'ut_criticos',   label:'UT en puntos críticos / zonas corrosión conocida' },
    { id:'soporteria',    label:'Estado de soportería' },
    { id:'valvulas',      label:'Estado válvulas y accesorios' },
    { id:'purga',         label:'Purga / limpieza antes de retornar' },
    { id:'apto',          label:'Apto para retornar al servicio' },
  ],
  integral: [
    { id:'iv',            label:'Inspección Visual (IV)' },
    { id:'ut_esp',        label:'Medición de espesores UT' },
    { id:'lp_sold',       label:'LP en soldaduras' },
    { id:'pm_sold',       label:'PM en soldaduras (si aplica)' },
    { id:'soporteria',    label:'Estado de soportería' },
    { id:'valvulas',      label:'Estado válvulas y accesorios' },
    { id:'revestimiento', label:'Estado revestimiento / pintura' },
    { id:'cui',           label:'Inspección CUI (si aplica)' },
    { id:'evaluacion',    label:'Evaluación general del sistema' },
  ],
}

const DN_OPCIONES = ['1/2"','3/4"','1"','1¼"','1½"','2"','2½"','3"','4"','6"','8"','10"','12"','14"','16"','18"','20"','24"','30"','36"']
const SCHEDULE_OPCIONES = ['Sch 5','Sch 10','Sch 20','Sch 40','Sch 80','Sch 120','Sch 160','STD','XS','XXS','XH','XXH']
const SPOOL_MATERIALES = ['Acero Carbono A106-B','Acero Carbono A53','Acero Inox. 304 (A312)','Acero Inox. 316L (A312)','Acero Inox. 321 (A312)','Duplex 2205','HDPE','PVC','CPVC','Cobre','Aleación de Níquel','Otro']

// Tabla ASME B36.10M — espesor de pared (mm) por NPS y Schedule
const ASME_B36_10M = {
  '1/2"':  { 'Sch 5':1.24, 'Sch 10':1.65, 'Sch 40':2.77, 'STD':2.77, 'Sch 80':3.73, 'XS':3.73, 'XH':3.73, 'Sch 160':4.78, 'XXS':7.47, 'XXH':7.47 },
  '3/4"':  { 'Sch 5':1.65, 'Sch 10':1.65, 'Sch 40':2.87, 'STD':2.87, 'Sch 80':3.91, 'XS':3.91, 'XH':3.91, 'Sch 160':5.56, 'XXS':7.82, 'XXH':7.82 },
  '1"':    { 'Sch 5':1.65, 'Sch 10':1.73, 'Sch 40':3.38, 'STD':3.38, 'Sch 80':4.55, 'XS':4.55, 'XH':4.55, 'Sch 160':6.35, 'XXS':9.09, 'XXH':9.09 },
  '1¼"':   { 'Sch 5':1.65, 'Sch 10':1.73, 'Sch 40':3.56, 'STD':3.56, 'Sch 80':4.85, 'XS':4.85, 'XH':4.85, 'Sch 160':6.35, 'XXS':9.70, 'XXH':9.70 },
  '1½"':   { 'Sch 5':1.65, 'Sch 10':2.11, 'Sch 40':3.68, 'STD':3.68, 'Sch 80':5.08, 'XS':5.08, 'XH':5.08, 'Sch 160':7.14, 'XXS':10.16, 'XXH':10.16 },
  '2"':    { 'Sch 5':1.65, 'Sch 10':2.11, 'Sch 40':3.91, 'STD':3.91, 'Sch 80':5.54, 'XS':5.54, 'XH':5.54, 'Sch 160':8.74, 'XXS':11.07, 'XXH':11.07 },
  '2½"':   { 'Sch 5':1.65, 'Sch 10':2.77, 'Sch 40':5.16, 'STD':5.16, 'Sch 80':7.01, 'XS':7.01, 'XH':7.01, 'Sch 160':9.53, 'XXS':14.02, 'XXH':14.02 },
  '3"':    { 'Sch 5':1.65, 'Sch 10':2.77, 'Sch 40':5.49, 'STD':5.49, 'Sch 80':7.62, 'XS':7.62, 'XH':7.62, 'Sch 160':11.13, 'XXS':15.24, 'XXH':15.24 },
  '4"':    { 'Sch 5':1.65, 'Sch 10':2.77, 'Sch 20':3.18, 'Sch 40':6.02, 'STD':6.02, 'Sch 80':8.56, 'XS':8.56, 'XH':8.56, 'Sch 120':11.13, 'Sch 160':13.49, 'XXS':17.12, 'XXH':17.12 },
  '6"':    { 'Sch 5':1.65, 'Sch 10':2.77, 'Sch 20':3.18, 'Sch 40':7.11, 'STD':7.11, 'Sch 80':10.97, 'XS':10.97, 'XH':10.97, 'Sch 120':14.27, 'Sch 160':18.26, 'XXS':21.95, 'XXH':21.95 },
  '8"':    { 'Sch 5':1.65, 'Sch 10':2.77, 'Sch 20':3.96, 'Sch 40':8.18, 'STD':8.18, 'Sch 60':10.31, 'Sch 80':12.70, 'XS':12.70, 'XH':12.70, 'Sch 100':15.09, 'Sch 120':17.48, 'Sch 160':21.44, 'XXS':22.23, 'XXH':22.23 },
  '10"':   { 'Sch 5':1.65, 'Sch 10':2.77, 'Sch 20':3.40, 'Sch 40':9.27, 'STD':9.27, 'Sch 60':12.70, 'Sch 80':15.09, 'XS':12.70, 'XH':12.70, 'Sch 100':18.26, 'Sch 120':21.44, 'Sch 140':25.40, 'Sch 160':28.58, 'XXS':25.40, 'XXH':25.40 },
  '12"':   { 'Sch 5':1.65, 'Sch 10':2.77, 'Sch 20':3.96, 'Sch 40':9.53, 'STD':9.53, 'Sch 60':14.27, 'Sch 80':17.48, 'XS':12.70, 'XH':12.70, 'Sch 100':21.44, 'Sch 120':25.40, 'Sch 140':28.58, 'Sch 160':33.32, 'XXS':25.40, 'XXH':25.40 },
  '14"':   { 'Sch 5':1.65, 'Sch 10':3.40, 'Sch 20':4.78, 'Sch 40':9.53, 'STD':9.53, 'Sch 60':11.13, 'Sch 80':15.09, 'XS':12.70, 'XH':12.70, 'Sch 100':19.05, 'Sch 120':23.83, 'Sch 140':27.79, 'Sch 160':31.75 },
  '16"':   { 'Sch 5':1.65, 'Sch 10':3.40, 'Sch 20':4.78, 'Sch 40':9.53, 'STD':9.53, 'Sch 60':12.70, 'Sch 80':15.09, 'XS':12.70, 'XH':12.70, 'Sch 100':21.44, 'Sch 120':26.19, 'Sch 140':30.96, 'Sch 160':36.53 },
  '18"':   { 'Sch 5':1.65, 'Sch 10':3.40, 'Sch 20':4.78, 'Sch 40':11.13, 'STD':9.53, 'Sch 60':14.27, 'Sch 80':19.05, 'XS':12.70, 'XH':12.70, 'Sch 100':23.83, 'Sch 120':29.36, 'Sch 140':34.93, 'Sch 160':39.67 },
  '20"':   { 'Sch 5':1.65, 'Sch 10':3.40, 'Sch 20':5.54, 'Sch 40':11.13, 'STD':9.53, 'Sch 60':15.09, 'Sch 80':20.62, 'XS':12.70, 'XH':12.70, 'Sch 100':26.19, 'Sch 120':32.54, 'Sch 140':38.10, 'Sch 160':44.45 },
  '24"':   { 'Sch 5':1.65, 'Sch 10':3.40, 'Sch 20':6.35, 'Sch 40':14.27, 'STD':9.53, 'Sch 60':17.48, 'Sch 80':24.61, 'XS':12.70, 'XH':12.70, 'Sch 100':30.96, 'Sch 120':38.10, 'Sch 140':46.02, 'Sch 160':52.37 },
  '30"':   { 'Sch 5':1.65, 'Sch 10':3.96, 'STD':9.53, 'XS':12.70, 'XH':12.70 },
  '36"':   { 'Sch 5':1.65, 'Sch 10':3.96, 'STD':9.53, 'XS':12.70, 'XH':12.70 },
}
function getAsmEspesor(dn, sch) {
  if (!dn || !sch) return null
  const row = ASME_B36_10M[dn]
  if (!row) return null
  return row[sch] ?? null
}

// Tabla HDPE — OD externo (mm) en sistema IPS, según ASTM F714 / ISO 4427
const HDPE_IPS_OD = {
  '1/2"':3.34, '3/4"':26.67, '1"':33.40, '1¼"':42.16, '1½"':48.26,
  '2"':60.33, '2½"':73.03, '3"':88.90, '4"':114.30, '6"':168.28,
  '8"':219.08, '10"':273.05, '12"':323.85, '14"':355.60, '16"':406.40,
  '18"':457.20, '20"':508.00, '24"':609.60, '30"':762.00, '36"':914.40,
}
// SDR disponibles para tuberías plásticas (ASTM D3035 / ASTM F714 / ISO 4427)
const SDR_OPCIONES = ['SDR 7.3','SDR 9','SDR 11','SDR 13.6','SDR 17','SDR 21','SDR 26','SDR 32.5','SDR 41']

function getSdrNumero(sdrStr) {
  // extrae el número de "SDR 11" → 11
  const m = sdrStr && sdrStr.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}
function getHdpeEspesor(dn, sdr) {
  // t = OD / SDR, redondeado a 2 decimales
  const od = HDPE_IPS_OD[dn]
  const sdrN = getSdrNumero(sdr)
  if (!od || !sdrN) return null
  return Math.round((od / sdrN) * 100) / 100
}
function esMaterialPlastico(material) {
  return /hdpe|pvc|cpvc|polietileno|pp|pe/i.test(material || '')
}
// Función unificada: retorna {espesor, norma, tipo}
function getNominalEspesor(dn, scheduleOrSdr, material) {
  if (esMaterialPlastico(material)) {
    const e = getHdpeEspesor(dn, scheduleOrSdr)
    return e ? { espesor: e, norma: 'ASTM F714', tipo: 'SDR' } : null
  }
  const e = getAsmEspesor(dn, scheduleOrSdr)
  return e ? { espesor: e, norma: 'ASME B36.10M', tipo: 'SCH' } : null
}

// ── MultiSelect: selección múltiple con chips y búsqueda ─────────────────────

function MultiSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase()) && !value.includes(o)
  )
  function add(opt) {
    if (!value.includes(opt)) onChange([...value, opt])
    setSearch('')
  }
  function addCustom() {
    const s = search.trim()
    if (s && !value.includes(s)) { onChange([...value, s]); setSearch('') }
  }
  function remove(opt) { onChange(value.filter(v => v !== opt)) }
  return (
    <div style={{ position:'relative' }}>
      <div
        style={{ border:'1px solid #CBD5E1', borderRadius:8, padding:'6px 8px', minHeight:38,
          background:'#fff', cursor:'text', display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}
        onClick={() => setOpen(true)}>
        {value.map(v => (
          <span key={v} style={{ background:'#EFF6FF', color:'#1D4ED8', borderRadius:4, padding:'2px 8px',
            fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
            {v}
            <button onClick={e => { e.stopPropagation(); remove(v) }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:11, padding:0, lineHeight:1 }}>✕</button>
          </span>
        ))}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addCustom() }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{ border:'none', outline:'none', fontSize:13, minWidth:80, flex:1, background:'transparent' }}
        />
      </div>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:200,
          background:'#fff', border:'1px solid #CBD5E1', borderRadius:8,
          boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:200, overflowY:'auto', marginTop:4 }}>
          {filtered.length === 0 && search.trim() && (
            <div style={{ padding:'8px 12px', fontSize:12, color:'#64748B' }}>
              Presiona Enter para agregar "<strong>{search}</strong>"
            </div>
          )}
          {filtered.map(o => (
            <div key={o}
              onClick={() => { add(o); setOpen(false) }}
              style={{ padding:'8px 12px', fontSize:13, cursor:'pointer', color:'#1E293B' }}
              onMouseEnter={e => e.currentTarget.style.background='#F1F5F9'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              {o}
            </div>
          ))}
          {filtered.length === 0 && !search.trim() && (
            <div style={{ padding:'8px 12px', fontSize:12, color:'#94A3B8' }}>Sin más opciones</div>
          )}
        </div>
      )}
      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setOpen(false)} />
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function NuevoInforme() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { usuario } = useAuth()
  const fileRef = useRef()

  // ── Parámetros desde la cola de trabajo ──────────────────────────────────
  const regDii = searchParams.get('reg') || ''    // e.g. 'REG-DII-004'
  const codEnd = searchParams.get('cod') || ''    // e.g. 'PT'

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
    norma_ejecucion: [],
    norma_evaluacion: [],
    procedimientos: [],
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

  // Inspectores de la OT
  const [inspectoresOT, setInspectoresOT] = useState([])
  // Tabla de elementos IZAJE
  const [elementosIzaje, setElementosIzaje] = useState([])
  // Fotos de inspección generales
  const [fotosInspeccion, setFotosInspeccion] = useState([])
  const [subiendoFotoGeneral, setSubiendoFotoGeneral] = useState(false)
  // Equipos de medición END (múltiples)
  const [equiposMedicion, setEquiposMedicion] = useState([])
  // Equipos de izaje principales (múltiples)
  const [equiposIzaje, setEquiposIzaje] = useState([{}])
  // Error de validación de hallazgo
  const [hallazgoDescError, setHallazgoDescError] = useState(false)
  // Datos visuales de croquis (mediciones + control dimensional)
  const [datosVisuales, setDatosVisuales] = useState({})

  // ── Estado inspección TANQUE (múltiples tanques) ─────────────────────────
  const initTanque = () => ({
    tag: '',
    config:             { material:'', orientacion:'', tipoInspeccion:'' },
    motivo_contingencia: '',
    geom:               {},
    checklist:          {},
    medicionesUT:       [],
    verticalidad:       { norte:'', sur:'', este:'', oeste:'' },
    asentamiento:       [],
  })
  const [tanques, setTanques] = useState([initTanque()])

  function updateTanque(idx, field, value) {
    setTanques(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }
  function addTanque() { setTanques(prev => [...prev, initTanque()]) }
  function removeTanque(idx) { setTanques(prev => prev.filter((_, i) => i !== idx)) }

  // ── Estado inspección TUBERÍA (múltiples líneas) ──────────────────────────
  const initSpool = () => ({ id_spool:'', dn:'', schedule:'', material:'', longitud_m:'', ubicacion:'', estado:'' })
  const initLinea = () => ({
    tag:            '',
    pid:            '',
    fluido:         '',
    temp_op:        '',
    presion_op:     '',
    tipoInspeccion: '',
    motivo:         '',
    spools:         [initSpool()],
    medicionesUT:   [],
    soldaduras:     [],
    ph: { presion_diseno:'', presion_prueba:'', fluido_prueba:'Agua', temperatura:'', duracion_hrs:'', resultado:'' },
    checklist:      {},
    fotos:          [],   // { preview, url, caption, zona, nombre }
  })
  const [lineas, setLineas] = useState([initLinea()])
  function updateLinea(idx, field, value) {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }
  function addLinea() { setLineas(prev => [...prev, initLinea()]) }
  function removeLinea(idx) { setLineas(prev => prev.filter((_, i) => i !== idx)) }

  // Auto-cargar si hay ?ot= en la URL
  useEffect(() => {
    const ot = searchParams.get('ot')
    if (ot) {
      setOtInput(ot)
      buscarOT(ot)
    }
  }, [])

  // Auto-seleccionar tipo_equipo según el código END (cuando viene desde la cola de trabajo)
  const TIPO_POR_COD = {
    PL: 'IZAJE', GM: 'IZAJE', PG: 'IZAJE',   // Izaje y Levante
    CTK: 'TANQUE',                              // Tanques
  }
  useEffect(() => {
    if (codEnd && !tipo) {
      const autoTipo = TIPO_POR_COD[codEnd]
      if (autoTipo) setTipo(autoTipo)
    }
  }, [codEnd])

  // ── Buscar OT + asignación ───────────────────────────────────────────────

  async function buscarOT(numero) {
    const n = (numero || otInput).trim().toUpperCase()
    if (!n) return
    setCargandoOT(true); setErrorOT('')
    try {
      // Cargar OT
      const { data: otData, error: otErr } = await supabase
        .from('ots')
        .select('ot_numero,cliente,direccion_faena,descripcion,supervisor,sede,email_cliente,contacto')
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

      // Intentar obtener normas desde acta de terreno como respaldo
      let actaNormas = null
      try {
        const { data: actaData } = await supabase
          .from('actas_terreno')
          .select('norma_ejecucion,norma_evaluacion,procedimientos')
          .eq('ot_numero', n)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        actaNormas = actaData
      } catch { /* columnas pueden no existir en actas */ }

      // Pre-llenar formulario
      setGeneral({
        ot_numero:         otData.ot_numero || '',
        cliente_nombre:    otData.cliente || '',
        lugar:             otData.direccion_faena || '',
        fecha_inspeccion:  asigData?.fecha_inspeccion || new Date().toISOString().split('T')[0],
        supervisor_nombre: asigData?.supervisor || otData.supervisor || '',
      })

      // Pre-llenar normas: prioridad asignación → acta → memoria localStorage
      const splitNorma = str => (str ? str.split(',').map(s => s.trim()).filter(Boolean) : [])
      const initNormaEje  = splitNorma(asigData?.norma_ejecucion  || actaNormas?.norma_ejecucion  || '')
      const initNormaEval = splitNorma(asigData?.norma_evaluacion || actaNormas?.norma_evaluacion || '')
      const initProc      = splitNorma(asigData?.procedimientos   || actaNormas?.procedimientos   || '')

      // Memoria por cliente
      const clienteKey = `wss_cliente_${(otData.cliente || '').replace(/\s+/g, '_').toLowerCase()}`
      let memData = null
      try { const m = localStorage.getItem(clienteKey); if (m) memData = JSON.parse(m) } catch {}

      setNormas({
        norma_ejecucion:  initNormaEje.length  ? initNormaEje  : (memData?.norma_ejecucion  || []),
        norma_evaluacion: initNormaEval.length ? initNormaEval : (memData?.norma_evaluacion || []),
        procedimientos:   initProc.length      ? initProc      : (memData?.procedimientos   || []),
      })

      // Parsear inspectores asignados a la OT
      if (asigData?.inspectores_asignados) {
        setInspectoresOT(asigData.inspectores_asignados.split(',').map(s => s.trim()).filter(Boolean))
      }

      // Pre-mapear tipos_inspeccion → métodos END
      if (asigData?.tipos_inspeccion) {
        const mapa = {
          // Visual
          'VT': 'IV', 'VISUAL': 'IV', 'IV': 'IV',
          // Líquidos penetrantes
          'PT': 'LP', 'LP': 'LP', 'LIQUIDOS': 'LP',
          // Partículas magnéticas
          'MT': 'PM', 'PM': 'PM', 'MAGNETICAS': 'PM',
          // UT espesores
          'UTT': 'UT_E', 'ESPESORES': 'UT_E',
          // UT fallas
          'UT': 'UT_F',
          // Phased Array
          'UTPA': 'UTPA', 'PAUT': 'UTPA',
          // Termografía
          'T': 'TERMO', 'IRT': 'TERMO', 'TERMOGRAFIA': 'TERMO',
          // Prueba hidrostática / hermeticidad
          'PH': 'HIDRO', 'HIDROSTATICA': 'HIDRO',
          // Prueba de carga / Izaje
          'PL': 'CARGA', 'CG': 'CARGA', 'CARGA': 'CARGA',
          'GM': 'IV',    // Grúas Móviles → incluye visual
          'PG': 'IV',    // Puentes Grúa  → incluye visual
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
    if (!hallazgoForm.descripcion.trim()) { setHallazgoDescError(true); return }
    setHallazgoDescError(false)
    setHallazgos(prev => [...prev, { ...hallazgoForm, foto_url: null }])
    setHallazgoForm({ descripcion: '', ubicacion: '', norma: '', criticidad: 'Menor' })
  }

  function removeHallazgo(i) {
    setHallazgos(prev => prev.filter((_, j) => j !== i))
  }

  // ── Elementos IZAJE ──────────────────────────────────────────────────────
  function addElementoIzaje() {
    setElementosIzaje(prev => [...prev, { tipo:'', n_sello:'', descripcion:'', resultado:'' }])
  }
  function updateElementoIzaje(i, field, val) {
    setElementosIzaje(prev => prev.map((el, j) => j === i ? { ...el, [field]: val } : el))
  }
  function removeElementoIzaje(i) {
    setElementosIzaje(prev => prev.filter((_, j) => j !== i))
  }

  // ── Fotos de inspección generales ────────────────────────────────────────
  async function subirFotoGeneral(file) {
    setSubiendoFotoGeneral(true)
    const ext  = file.name.split('.').pop()
    const path = `general-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('informes-fotos').upload(path, file)
    if (!error) {
      const url = supabase.storage.from('informes-fotos').getPublicUrl(path).data.publicUrl
      setFotosInspeccion(prev => [...prev, url])
    }
    setSubiendoFotoGeneral(false)
  }
  function removeFotoGeneral(i) {
    setFotosInspeccion(prev => prev.filter((_, j) => j !== i))
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
          norma_ejecucion:   normas.norma_ejecucion.join(', '),
          norma_evaluacion:  normas.norma_evaluacion.join(', '),
          procedimientos:    normas.procedimientos.join(', '),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setTextoIA(d.texto_ia)
    } catch (e) { setErrorIA(e.message) }
    finally { setGenerando(false) }
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  // ── Subir fotos de líneas a Supabase Storage ─────────────────────────────
  async function subirFotosLineas(lineasData, otNumero) {
    const lineasConUrls = await Promise.all(lineasData.map(async (ln) => {
      if (!ln.fotos || ln.fotos.length === 0) return ln
      const fotosSubidas = await Promise.all(ln.fotos.map(async (foto, idx) => {
        if (!foto.file) return foto // ya subida o sin archivo
        try {
          const ext = foto.nombre.split('.').pop() || 'jpg'
          const path = `${otNumero || 'sin-ot'}/${ln.tag || `linea-${idx}`}/${Date.now()}_fig${idx+1}.${ext}`
          const { error } = await supabase.storage
            .from('inspecciones-fotos')
            .upload(path, foto.file, { cacheControl:'3600', upsert:false })
          if (error) return { ...foto, file:undefined, url:'', error:error.message }
          const { data } = supabase.storage.from('inspecciones-fotos').getPublicUrl(path)
          return { caption:foto.caption, zona:foto.zona, nombre:foto.nombre, url:data.publicUrl }
        } catch (e) {
          return { caption:foto.caption, zona:foto.zona, nombre:foto.nombre, url:'', error:e.message }
        }
      }))
      return { ...ln, fotos:fotosSubidas }
    }))
    return lineasConUrls
  }

  async function guardar(estado) {
    if (!tipo) return setErrorGuardar('Selecciona el tipo de equipo')
    setGuardando(true); setErrorGuardar('')
    // Guardar memoria por cliente antes de insertar
    const clienteKey = `wss_cliente_${(general.cliente_nombre || '').replace(/\s+/g, '_').toLowerCase()}`
    try {
      localStorage.setItem(clienteKey, JSON.stringify({
        norma_ejecucion:  normas.norma_ejecucion,
        norma_evaluacion: normas.norma_evaluacion,
        procedimientos:   normas.procedimientos,
      }))
    } catch {}
    // Subir fotos si hay líneas con fotos adjuntas
    let lineasGuardar = lineas
    if (tipo === 'TUBERIA' && lineas.some(l => l.fotos?.some(f => f.file))) {
      try { lineasGuardar = await subirFotosLineas(lineas, general.ot_numero) }
      catch {}
    }
    // Construir payload del informe
    const payload = {
      tipo_equipo:         tipo,
      ot_numero:           general.ot_numero,
      cliente_nombre:      general.cliente_nombre,
      lugar:               general.lugar,
      fecha_inspeccion:    general.fecha_inspeccion,
      supervisor_nombre:   general.supervisor_nombre,
      inspector_id:        usuario?.id,
      inspector_nombre:    [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || usuario?.email,
      norma_ejecucion:     normas.norma_ejecucion.join(', '),
      norma_evaluacion:    normas.norma_evaluacion.join(', '),
      procedimientos:      normas.procedimientos.join(', '),
      norma_ejecucion_arr: normas.norma_ejecucion,
      datos_equipo:        {
        ...equipo,
        equipos_izaje_adicionales: equiposIzaje,
        elementos_izaje:           elementosIzaje,
        fotos_inspeccion:          fotosInspeccion,
        equipo_medicion:           equiposMedicion,
        inspectores_ot:            inspectoresOT,
        tanques,
        lineas: lineasGuardar,
        croquis: datosVisuales,
      },
      end_aplicados:     endAplicados,
      mediciones,
      hallazgos,
      resultado,
      texto_ia:          textoIA,
      estado,
      reg_dii_numero:    regDii || null,
      metodo_end_cod:    codEnd || null,
    }

    // ── Si no hay conexión → guardar en cola offline ──────────────────────
    if (!navigator.onLine) {
      setGuardando(false)
      try {
        await encolarInforme(payload)
        setErrorGuardar('')
        alert('📡 Sin conexión. El informe quedó guardado en este dispositivo y se subirá automáticamente cuando recuperes señal.')
      } catch (e) {
        setErrorGuardar('Error al guardar offline: ' + e.message)
      }
      return
    }

    // ── Con conexión → subir directo a Supabase ───────────────────────────
    const { data, error } = await supabase.from('informes').insert(payload).select('id').single()
    setGuardando(false)
    if (error) {
      // Si falló por pérdida de conexión durante el envío → encolar
      if (!navigator.onLine || error.message?.includes('fetch')) {
        try {
          await encolarInforme(payload)
          alert('📡 Se perdió la conexión al guardar. El informe quedó guardado en este dispositivo.')
        } catch {}
      } else {
        setErrorGuardar(error.message)
      }
      return
    }
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
          {regDii && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:6, padding:'6px 14px', background:'rgba(124,58,237,0.08)', borderRadius:8, border:'1.5px solid #7C3AED', fontSize:13 }}>
              <span style={{ fontWeight:800, color:'#7C3AED', fontFamily:'monospace' }}>{regDii}</span>
              {codEnd && <span style={{ fontSize:11, background:'#7C3AED', color:'#fff', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>{codEnd}</span>}
            </div>
          )}
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
              setNormas({ norma_ejecucion:[], norma_evaluacion:[], procedimientos:[] }); setEnd([]); setInspectoresOT([])
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
              <label style={S.label}>Inspectores de la OT</label>
              {inspectoresOT.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'6px 0' }}>
                  {inspectoresOT.map(insp => {
                    const nombreLogueado = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ').trim().toLowerCase()
                    const esYo = nombreLogueado === insp.toLowerCase() || (usuario?.email || '').toLowerCase() === insp.toLowerCase()
                    return (
                      <span key={insp} style={{
                        background: esYo ? '#D1FAE5' : '#EFF6FF',
                        color: esYo ? '#065F46' : '#1D4ED8',
                        border: `1px solid ${esYo ? '#6EE7B7' : '#BFDBFE'}`,
                        borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600,
                      }}>
                        {insp}{esYo ? ' ✓ Tú' : ''}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <input className="input"
                  value={[usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || usuario?.email || ''}
                  disabled style={{ background:'#F8FAFC', color:'#475569' }} />
              )}
              {usuario?.nivel_snt && (
                <div style={{ fontSize:11, color:'#7C3AED', marginTop:3, fontWeight:700 }}>
                  🏅 Nivel {usuario.nivel_snt} SNT-TC-1A
                </div>
              )}
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
              <MultiSelect
                value={normas.norma_ejecucion}
                onChange={v => setNormas(p => ({ ...p, norma_ejecucion: v }))}
                options={['API 650 (Ed. 13, 2020)','API 653 (Ed. 5, 2014)','API 570 (Ed. 4, 2016)','API 510 (Ed. 10, 2014)','ASME V (Ed. 2021)','ASME VIII Div.1 (Ed. 2021)','AWS D1.1 (Ed. 2020)','AWS D1.2 (Ed. 2014)','AWS D1.3 (Ed. 2018)','DS 43/2015','ISO 9712 (Ed. 2021)','ASTM E165 (Ed. 2018)','ASTM E709 (Ed. 2021)','ASTM E1417 (Ed. 2021)','ASME B31.3 (Ed. 2022)','ASME B31.1 (Ed. 2020)','ASME B30.2 (Ed. 2016)','ASME B30.9 (Ed. 2018)','ASME B30.10 (Ed. 2019)','INN OI376','INN OI377']}
                placeholder="Selecciona o escribe normas de ejecución..."
              />
            </div>
            <div>
              <label style={S.label}>Norma de evaluación / criterio de aceptación</label>
              <MultiSelect
                value={normas.norma_evaluacion}
                onChange={v => setNormas(p => ({ ...p, norma_evaluacion: v }))}
                options={['API 650 Apéndice C (Ed. 13, 2020)','API 653 Tabla 4.3.2 (Ed. 5, 2014)','AWS D1.1 Tabla 6.1 (Ed. 2020)','ASME V Art. 6 (Ed. 2021)','ASME V Art. 7 (Ed. 2021)','DS 43/2015 Art. 42','ISO 9712 (Ed. 2021)','ASTM E165 (Ed. 2018)','ASTM E709 (Ed. 2021)','API 570 Párrafo 7 (Ed. 4, 2016)']}
                placeholder="Selecciona o escribe criterios de aceptación..."
              />
            </div>
            <div>
              <label style={S.label}>Procedimientos WSS aplicables</label>
              <MultiSelect
                value={normas.procedimientos}
                onChange={v => setNormas(p => ({ ...p, procedimientos: v }))}
                options={['PRO-DII-IV-001','PRO-DII-LP-001','PRO-DII-PM-001','PRO-DII-UT-001','PRO-DII-UT-002','PRO-DII-UTPA-001','PRO-DII-IRT-001','PRO-DII-PH-001','PRO-DII-PC-001','PRO-DII-IZL-001','PRO-DII-IZL-002','PRO-DII-CTK-001']}
                placeholder="Selecciona o escribe procedimientos WSS..."
              />
            </div>
          </div>
        </div>

        {tipo && (<>
          {/* ── PASO 4: Datos del equipo ── */}
          <div style={S.seccion}>
            <div style={S.seccionTitulo}>⑤ Datos del Equipo — {TIPOS.find(t => t.id === tipo)?.label}</div>
            {tipo === 'IZAJE' ? (<>
              {equiposIzaje.map((eq, idx) => (
                <div key={idx} style={{ border:'1px solid #E2E8F0', borderRadius:8, padding:14, marginBottom:12, background:'#FAFAFA' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'#475569' }}>Equipo mayor #{idx + 1}</span>
                    {equiposIzaje.length > 1 && (
                      <button onClick={() => setEquiposIzaje(prev => prev.filter((_, j) => j !== idx))}
                        style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:13 }}>
                        ✕ Eliminar
                      </button>
                    )}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    {camposActivos.map(c => (
                      <div key={c.id}>
                        <label style={S.label}>{c.label} {c.req && <span style={{ color:'red' }}>*</span>}</label>
                        {c.type === 'select' ? (
                          <select className="input" value={eq[c.id] || ''}
                            onChange={e => setEquiposIzaje(prev => prev.map((x, j) => j === idx ? { ...x, [c.id]: e.target.value } : x))}>
                            <option value="">— Seleccionar —</option>
                            {c.ops.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input className="input" type={c.type} value={eq[c.id] || ''}
                            onChange={e => setEquiposIzaje(prev => prev.map((x, j) => j === idx ? { ...x, [c.id]: e.target.value } : x))} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm"
                onClick={() => setEquiposIzaje(prev => [...prev, {}])}
                style={{ cursor:'pointer' }}>
                + Agregar equipo
              </button>
            </>) : (
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
            )}
          </div>

          {/* ── PASO 5b: Elementos de izaje (solo IZAJE) ── */}
          {tipo === 'IZAJE' && (
            <div style={S.seccion}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={S.seccionTitulo}>⑤b Elementos de Izaje Inspeccionados</div>
                <button className="btn btn-secondary btn-sm" onClick={addElementoIzaje}>+ Agregar elemento</button>
              </div>

              {elementosIzaje.length === 0 ? (
                <div style={{ color:'var(--gris)', fontSize:13, padding:'14px 0', textAlign:'center', borderTop:'1px dashed #E2E8F0' }}>
                  Sin elementos. Haz clic en "+ Agregar elemento".
                </div>
              ) : (
                <>
                  {/* ─── Tablas separadas por familia de elemento ─── */}
                  {[
                    { fam:'hardware', label:'Accesorios de Izaje (Grilletes, Cáncamos, Ganchos)' },
                    { fam:'eslinga',  label:'Eslingas' },
                    { fam:'grua',     label:'Equipos de Izaje (Grúas / Aparejos)' },
                    { fam:'otro',     label:'Otros' },
                  ].map(({ fam, label }) => {
                    const cols = COLS_FAMILIA[fam]
                    const filas = elementosIzaje.map((el, i) => ({ ...el, _i: i }))
                      .filter(el => getFamiliaIzaje(el.tipo) === fam)
                    if (filas.length === 0) return null
                    return (
                      <div key={fam} style={{ marginBottom:22 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#1A3A5C', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6, borderLeft:'3px solid #185FA5', paddingLeft:8 }}>
                          {label}
                        </div>
                        <div style={{ overflowX:'auto' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                            <thead>
                              <tr style={{ background:'linear-gradient(135deg,#1A3A5C,#185FA5)', color:'#fff' }}>
                                <th style={S.th}>Item</th>
                                <th style={S.th}>Sello antiguo</th>
                                <th style={S.th}>Elemento</th>
                                {cols.map(c => <th key={c.id} style={S.th}>{c.label}</th>)}
                                <th style={S.th}>Resultado</th>
                                <th style={{ ...S.th, width:32 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filas.map((el, rowIdx) => (
                                <tr key={el._i} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                  <td style={{ ...S.td, textAlign:'center', fontWeight:700, color:'#475569', width:36 }}>{rowIdx + 1}</td>
                                  <td style={S.tdInput}>
                                    <input className="input" value={el.n_sello || ''}
                                      onChange={e => updateElementoIzaje(el._i,'n_sello',e.target.value)}
                                      placeholder="S/I" style={{ fontSize:11, width:65, textAlign:'center' }} />
                                  </td>
                                  <td style={S.tdInput}>
                                    <select className="input" value={el.tipo}
                                      onChange={e => updateElementoIzaje(el._i,'tipo',e.target.value)}
                                      style={{ fontSize:11, minWidth:130 }}>
                                      <option value="">— Tipo —</option>
                                      {TODOS_TIPOS_IZAJE.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </td>
                                  {cols.map(c => (
                                    <td key={c.id} style={S.tdInput}>
                                      <input className="input" value={el[c.id] || ''}
                                        onChange={e => updateElementoIzaje(el._i, c.id, e.target.value)}
                                        placeholder={c.ph || ''} style={{ fontSize:11, width: c.w || 80 }} />
                                    </td>
                                  ))}
                                  <td style={{ ...S.td, minWidth:150 }}>
                                    <div style={{ display:'flex', gap:4 }}>
                                      {[['CUMPLE','✓ Aceptable','#16A34A','#D1FAE5','#065F46'],['NO_CUMPLE','✗ Rechazado','#DC2626','#FEE2E2','#991B1B']].map(([val,lbl,bc,bg,fc]) => (
                                        <button key={val} onClick={() => updateElementoIzaje(el._i,'resultado',val)}
                                          style={{ flex:1, padding:'5px 3px', borderRadius:5, border:`2px solid ${el.resultado===val ? bc : '#E2E8F0'}`,
                                            cursor:'pointer', fontSize:10, fontWeight:700,
                                            background: el.resultado===val ? bg : '#F8FAFC',
                                            color: el.resultado===val ? fc : '#94A3B8' }}>
                                          {lbl}
                                        </button>
                                      ))}
                                    </div>
                                  </td>
                                  <td style={{ ...S.td, textAlign:'center' }}>
                                    <button onClick={() => removeElementoIzaje(el._i)}
                                      style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:15 }}>✕</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}

                  {/* Fila de nuevos elementos sin tipo asignado aún */}
                  {elementosIzaje.some(el => !el.tipo) && (
                    <div style={{ border:'1px dashed #CBD5E1', borderRadius:8, padding:'10px 14px' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8', marginBottom:8 }}>Elementos sin tipo asignado</div>
                      {elementosIzaje.map((el, i) => el.tipo ? null : (
                        <div key={i} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                          <span style={{ fontSize:11, color:'#64748B', minWidth:30 }}>#{i+1}</span>
                          <select className="input" value={el.tipo}
                            onChange={e => updateElementoIzaje(i,'tipo',e.target.value)}
                            style={{ fontSize:12, flex:1, maxWidth:220 }}>
                            <option value="">— Seleccionar tipo de elemento —</option>
                            {TODOS_TIPOS_IZAJE.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <button onClick={() => removeElementoIzaje(i)}
                            style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:15 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resumen */}
                  <div style={{ marginTop:12, display:'flex', gap:16, fontSize:12 }}>
                    <span style={{ color:'#065F46', fontWeight:700 }}>✓ {elementosIzaje.filter(e => e.resultado==='CUMPLE').length} aceptables</span>
                    <span style={{ color:'#991B1B', fontWeight:700 }}>✗ {elementosIzaje.filter(e => e.resultado==='NO_CUMPLE').length} rechazados</span>
                    <span style={{ color:'#64748B' }}>({elementosIzaje.filter(e => !e.resultado).length} sin evaluar)</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PASO 5b: Inspección estructurada TANQUE — múltiples tanques ── */}
          {tipo === 'TANQUE' && (
            <div style={S.seccion}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={S.seccionTitulo}>⑤b Inspección Técnica de Tanques</div>
                <button className="btn btn-secondary btn-sm" onClick={addTanque}>+ Agregar tanque</button>
              </div>

              {tanques.map((tk, tkIdx) => (
                <div key={tkIdx} style={{ border:'1.5px solid #CBD5E1', borderRadius:10, padding:18, marginBottom:20, background:'#FAFAFA' }}>

                  {/* Header tanque */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:'#1E3A5F',
                        background:'#EFF6FF', border:'1.5px solid #BFDBFE',
                        borderRadius:6, padding:'3px 12px' }}>
                        🛢️ Tanque #{tkIdx + 1}
                      </span>
                      <input className="input" value={tk.tag}
                        onChange={e => updateTanque(tkIdx, 'tag', e.target.value)}
                        placeholder="Tag / Código (ej: TK-201)"
                        style={{ fontSize:12, fontFamily:'monospace', fontWeight:700, maxWidth:180 }} />
                    </div>
                    {tanques.length > 1 && (
                      <button onClick={() => removeTanque(tkIdx)}
                        style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#DC2626',
                          borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                        🗑️ Eliminar
                      </button>
                    )}
                  </div>

                  {/* ── Selectores: Material · Orientación · Tipo inspección ── */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:18 }}>
                    <div>
                      <label style={S.label}>Material</label>
                      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                        {['Acero','Plástico (PE/PP)','FRP'].map(m => (
                          <button key={m}
                            onClick={() => updateTanque(tkIdx, 'config', { ...tk.config, material:m })}
                            style={{ padding:'7px 10px', borderRadius:7,
                              border:`2px solid ${tk.config.material===m?'#1D4ED8':'#E2E8F0'}`,
                              background: tk.config.material===m?'#EFF6FF':'#fff',
                              color: tk.config.material===m?'#1D4ED8':'#475569',
                              fontWeight:700, fontSize:12, cursor:'pointer', textAlign:'left' }}>
                            {m==='Acero'?'⚙️':m==='FRP'?'🔵':'🟡'} {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Orientación</label>
                      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                        {[['vertical','🛢️ Vertical'],['horizontal','➡️ Horizontal']].map(([val,lbl]) => (
                          <button key={val}
                            onClick={() => updateTanque(tkIdx, 'config', { ...tk.config, orientacion:val })}
                            style={{ padding:'7px 10px', borderRadius:7,
                              border:`2px solid ${tk.config.orientacion===val?'#047857':'#E2E8F0'}`,
                              background: tk.config.orientacion===val?'#D1FAE5':'#fff',
                              color: tk.config.orientacion===val?'#065F46':'#475569',
                              fontWeight:700, fontSize:12, cursor:'pointer', textAlign:'left' }}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Tipo de inspección</label>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {TK_TIPOS_INSPECCION.map(({ id, icon, label, sub }) => (
                          <button key={id}
                            onClick={() => updateTanque(tkIdx, 'config', { ...tk.config, tipoInspeccion:id })}
                            style={{ padding:'6px 10px', borderRadius:7,
                              border:`2px solid ${tk.config.tipoInspeccion===id?'#7C3AED':'#E2E8F0'}`,
                              background: tk.config.tipoInspeccion===id?'#EDE9FE':'#fff',
                              color: tk.config.tipoInspeccion===id?'#5B21B6':'#475569',
                              fontWeight:700, fontSize:11, cursor:'pointer', textAlign:'left' }}>
                            {icon} {label}
                            <div style={{ fontSize:10, fontWeight:400, marginTop:1,
                              color: tk.config.tipoInspeccion===id?'#7C3AED':'#94A3B8' }}>{sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Badge normas combinadas: material + tipo inspección */}
                  {(tk.config.material || tk.config.tipoInspeccion) && (
                    <div style={{ background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:7,
                      padding:'7px 12px', marginBottom:14, fontSize:11, color:'#0369A1' }}>
                      📋 <strong>Normas aplicables:</strong>{' '}
                      {tk.config.tipoInspeccion && TK_NORMAS_POR_TIPO[tk.config.tipoInspeccion]
                        ? TK_NORMAS_POR_TIPO[tk.config.tipoInspeccion]
                        : TK_NORMAS[tk.config.material] || '—'}
                    </div>
                  )}

                  {/* Campo motivo — solo para contingencia */}
                  {tk.config.tipoInspeccion === 'contingencia' && (
                    <div style={{ marginBottom:14, background:'#FFFBEB', border:'1px solid #FCD34D',
                      borderRadius:8, padding:'10px 14px' }}>
                      <label style={{ ...S.label, color:'#92400E' }}>⚠️ Problema / motivo de la inspección <span style={{ color:'red' }}>*</span></label>
                      <textarea className="input" rows={2}
                        value={tk.motivo_contingencia || ''}
                        onChange={e => updateTanque(tkIdx, 'motivo_contingencia', e.target.value)}
                        placeholder="Ej: Cliente detectó fuga en soldadura perimetral del primer anillo, costado norte, aprox. h=1.5m..." />
                    </div>
                  )}

                  {/* ── Datos geométricos ── */}
                  {tk.config.orientacion && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#1A3A5C', textTransform:'uppercase',
                        letterSpacing:'.5px', marginBottom:8, borderLeft:'3px solid #185FA5', paddingLeft:8 }}>
                        Datos geométricos — {tk.config.orientacion==='vertical'?'Vertical':'Horizontal'}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                        {TK_GEOM_FIELDS[tk.config.orientacion].map(f => (
                          <div key={f.id}>
                            <label style={S.label}>{f.label}</label>
                            {f.type==='select' ? (
                              <select className="input" value={tk.geom[f.id]||''}
                                onChange={e => updateTanque(tkIdx,'geom',{...tk.geom,[f.id]:e.target.value})}>
                                <option value="">— Seleccionar —</option>
                                {f.ops.map(o=><option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input className="input" type={f.type} value={tk.geom[f.id]||''}
                                onChange={e => updateTanque(tkIdx,'geom',{...tk.geom,[f.id]:e.target.value})} />
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── Checklist visual ── */}
                  {tk.config.material && tk.config.tipoInspeccion && (() => {
                    const key = getTkChecklistKey(tk.config.material, tk.config.tipoInspeccion)
                    const items = TK_CHECKLIST[key] || []
                    if (!items.length) return null
                    return (
                      <>
                        <div style={{ fontSize:11, fontWeight:700, color:'#1A3A5C', textTransform:'uppercase',
                          letterSpacing:'.5px', marginBottom:8, borderLeft:'3px solid #185FA5', paddingLeft:8 }}>
                          Checklist — {tk.config.tipoInspeccion==='externa_5'?'Exterior':'Interior'}
                        </div>
                        <div style={{ overflowX:'auto', marginBottom:16 }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                            <thead>
                              <tr style={{ background:'linear-gradient(135deg,#1A3A5C,#185FA5)', color:'#fff' }}>
                                <th style={S.th}>Ítem de inspección</th>
                                <th style={{ ...S.th, textAlign:'center', width:95 }}>Conforme</th>
                                <th style={{ ...S.th, textAlign:'center', width:105 }}>No conforme</th>
                                <th style={{ ...S.th, textAlign:'center', width:65 }}>N/A</th>
                                <th style={{ ...S.th, width:200 }}>Observación</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, rowIdx) => {
                                const res = tk.checklist[item.id]?.resultado || ''
                                const obs = tk.checklist[item.id]?.obs || ''
                                return (
                                  <tr key={item.id} style={{ background:rowIdx%2===0?'#fff':'#F8FAFC' }}>
                                    <td style={{ ...S.td, fontWeight:500 }}>{item.label}</td>
                                    {['CONFORME','NO_CONFORME','NA'].map(v => (
                                      <td key={v} style={{ ...S.td, textAlign:'center' }}>
                                        <input type="radio" name={`tk${tkIdx}_${item.id}`} value={v} checked={res===v}
                                          onChange={() => updateTanque(tkIdx,'checklist',{...tk.checklist,[item.id]:{...(tk.checklist[item.id]||{}),resultado:v}})}
                                          style={{ accentColor:v==='CONFORME'?'#16A34A':v==='NO_CONFORME'?'#DC2626':'#94A3B8', width:15, height:15 }} />
                                      </td>
                                    ))}
                                    <td style={S.tdInput}>
                                      <input className="input" value={obs} placeholder="Observación..."
                                        onChange={e => updateTanque(tkIdx,'checklist',{...tk.checklist,[item.id]:{...(tk.checklist[item.id]||{}),obs:e.target.value}})}
                                        style={{ fontSize:11 }} />
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          <div style={{ display:'flex', gap:14, marginTop:6, fontSize:11 }}>
                            <span style={{ color:'#065F46', fontWeight:700 }}>✓ {Object.values(tk.checklist).filter(v=>v?.resultado==='CONFORME').length} conformes</span>
                            <span style={{ color:'#DC2626', fontWeight:700 }}>✗ {Object.values(tk.checklist).filter(v=>v?.resultado==='NO_CONFORME').length} no conformes</span>
                            <span style={{ color:'#94A3B8' }}>N/A: {Object.values(tk.checklist).filter(v=>v?.resultado==='NA').length}</span>
                          </div>
                        </div>
                      </>
                    )
                  })()}

                  {/* ── Mediciones UT ── */}
                  {tk.config.material && tk.config.tipoInspeccion && (
                    <>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#1A3A5C', textTransform:'uppercase',
                          letterSpacing:'.5px', borderLeft:'3px solid #185FA5', paddingLeft:8 }}>
                          Medición de espesores — UT
                          {tk.config.material!=='Acero' && (
                            <span style={{ fontSize:10, color:'#92400E', marginLeft:6, fontWeight:400, textTransform:'none' }}>
                              {tk.config.material==='FRP'?'(UT especializado / coin tap)':'(UT especializado / emisión acústica)'}
                            </span>
                          )}
                        </div>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => updateTanque(tkIdx,'medicionesUT',[...tk.medicionesUT,{zona:'',nominal_mm:'',medido_mm:'',minimo_mm:'',obs:''}])}>
                          + Agregar punto
                        </button>
                      </div>
                      {tk.medicionesUT.length===0 ? (
                        <div style={{ color:'var(--gris)', fontSize:12, padding:'10px 0', textAlign:'center',
                          borderTop:'1px dashed #E2E8F0', marginBottom:14 }}>
                          Sin mediciones — clic en "+ Agregar punto"
                        </div>
                      ) : (
                        <div style={{ overflowX:'auto', marginBottom:14 }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                            <thead>
                              <tr style={{ background:'#F8FAFC' }}>
                                {['Zona / Punto','E. nominal (mm)','E. medido (mm)','E. mín. req. (mm)','% Pérdida','Estado','Obs.',''].map(h=>(
                                  <th key={h} style={{ padding:'6px 9px', fontSize:11, fontWeight:700, color:'#64748B',
                                    textAlign:'left', border:'1px solid #E2E8F0', whiteSpace:'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tk.medicionesUT.map((m,mi) => {
                                const pct = m.nominal_mm&&m.medido_mm ? (((+m.nominal_mm-+m.medido_mm)/+m.nominal_mm)*100).toFixed(1) : '—'
                                const bajoMin = m.minimo_mm&&m.medido_mm&&+m.medido_mm<+m.minimo_mm
                                const estado = !m.medido_mm?'—':bajoMin?'🔴 Rechazado':parseFloat(pct)>20?'🟡 Alerta':'🟢 OK'
                                const upd = (field,val) => updateTanque(tkIdx,'medicionesUT',tk.medicionesUT.map((x,j)=>j===mi?{...x,[field]:val}:x))
                                return (
                                  <tr key={mi} style={{ background:mi%2===0?'#fff':'#F8FAFC' }}>
                                    <td style={S.tdInput}><input className="input" value={m.zona} onChange={e=>upd('zona',e.target.value)} placeholder="Anillo 1 / Techo / Fondo" style={{ fontSize:11 }} /></td>
                                    <td style={S.tdInput}><input className="input" type="number" value={m.nominal_mm} onChange={e=>upd('nominal_mm',e.target.value)} placeholder="12.5" style={{ fontSize:11, width:65 }} /></td>
                                    <td style={S.tdInput}><input className="input" type="number" value={m.medido_mm} onChange={e=>upd('medido_mm',e.target.value)} placeholder="11.8" style={{ fontSize:11, width:65 }} /></td>
                                    <td style={S.tdInput}><input className="input" type="number" value={m.minimo_mm} onChange={e=>upd('minimo_mm',e.target.value)} placeholder="9.0" style={{ fontSize:11, width:65 }} /></td>
                                    <td style={{ padding:'4px 8px', border:'1px solid #E2E8F0', fontSize:11, fontWeight:700,
                                      color:pct!=='—'&&parseFloat(pct)>20?'#991B1B':parseFloat(pct)>10?'#92400E':'#065F46' }}>
                                      {pct!=='—'?`${pct}%`:'—'}
                                    </td>
                                    <td style={{ padding:'4px 8px', border:'1px solid #E2E8F0', fontSize:11, fontWeight:600 }}>{estado}</td>
                                    <td style={S.tdInput}><input className="input" value={m.obs} onChange={e=>upd('obs',e.target.value)} placeholder="Obs." style={{ fontSize:11 }} /></td>
                                    <td style={{ padding:'4px 8px', border:'1px solid #E2E8F0', textAlign:'center' }}>
                                      <button onClick={()=>updateTanque(tkIdx,'medicionesUT',tk.medicionesUT.filter((_,j)=>j!==mi))}
                                        style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:14 }}>✕</button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Verticalidad (solo verticales) ── */}
                  {tk.config.orientacion==='vertical' && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#1A3A5C', textTransform:'uppercase',
                        letterSpacing:'.5px', marginBottom:8, borderLeft:'3px solid #185FA5', paddingLeft:8 }}>
                        Verticalidad — 4 puntos cardinales
                        <span style={{ fontSize:10, color:'#64748B', fontWeight:400, marginLeft:8, textTransform:'none' }}>
                          Tolerancia API 653: H/100{tk.geom.altura_m?` = ${(+tk.geom.altura_m/100*1000).toFixed(0)} mm`:''}
                        </span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
                        {[['norte','Norte (N)'],['sur','Sur (S)'],['este','Este (E)'],['oeste','Oeste (O)']].map(([dir,lbl]) => {
                          const tol = tk.geom.altura_m ? +tk.geom.altura_m/100*1000 : null
                          const val = +tk.verticalidad[dir]
                          const fuera = tol && val && val > tol
                          return (
                            <div key={dir}>
                              <label style={S.label}>{lbl} (mm)</label>
                              <input className="input" type="number" value={tk.verticalidad[dir]}
                                onChange={e=>updateTanque(tkIdx,'verticalidad',{...tk.verticalidad,[dir]:e.target.value})}
                                placeholder="ej: 45"
                                style={{ borderColor:fuera?'#EF4444':undefined }} />
                              {fuera && <div style={{ fontSize:10, color:'#DC2626', marginTop:2 }}>⚠ Excede {tol.toFixed(0)} mm</div>}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* ── Asentamiento ── */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1A3A5C', textTransform:'uppercase',
                      letterSpacing:'.5px', borderLeft:'3px solid #185FA5', paddingLeft:8 }}>Asentamiento</div>
                    <button className="btn btn-secondary btn-sm"
                      onClick={()=>updateTanque(tkIdx,'asentamiento',[...tk.asentamiento,{punto:'',cota_mm:'',diferencia_mm:'',estado:''}])}>
                      + Agregar punto
                    </button>
                  </div>
                  {tk.asentamiento.length===0 ? (
                    <div style={{ color:'var(--gris)', fontSize:12, padding:'10px 0', textAlign:'center', borderTop:'1px dashed #E2E8F0' }}>
                      Sin puntos — clic en "+ Agregar punto"
                    </div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ background:'#F8FAFC' }}>
                            {['Punto','Cota medida (mm)','Diferencia (mm)','Estado',''].map(h=>(
                              <th key={h} style={{ padding:'6px 9px', fontSize:11, fontWeight:700, color:'#64748B',
                                textAlign:'left', border:'1px solid #E2E8F0' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tk.asentamiento.map((a,ai) => {
                            const updA = (field,val) => updateTanque(tkIdx,'asentamiento',tk.asentamiento.map((x,j)=>j===ai?{...x,[field]:val}:x))
                            return (
                              <tr key={ai} style={{ background:ai%2===0?'#fff':'#F8FAFC' }}>
                                <td style={S.tdInput}>
                                  <select className="input" value={a.punto} onChange={e=>updA('punto',e.target.value)} style={{ fontSize:11, minWidth:70 }}>
                                    <option value="">—</option>
                                    {['N','NE','E','SE','S','SW','O','NO','Centro'].map(pt=><option key={pt} value={pt}>{pt}</option>)}
                                  </select>
                                </td>
                                <td style={S.tdInput}><input className="input" type="number" value={a.cota_mm} onChange={e=>updA('cota_mm',e.target.value)} placeholder="0.0" style={{ fontSize:11, width:95 }} /></td>
                                <td style={S.tdInput}><input className="input" type="number" value={a.diferencia_mm} onChange={e=>updA('diferencia_mm',e.target.value)} placeholder="0.0" style={{ fontSize:11, width:95 }} /></td>
                                <td style={S.tdInput}>
                                  <select className="input" value={a.estado} onChange={e=>updA('estado',e.target.value)} style={{ fontSize:11 }}>
                                    <option value="">—</option>
                                    <option value="OK">✅ Dentro tolerancia</option>
                                    <option value="ALERTA">⚠️ Alerta</option>
                                    <option value="CRÍTICO">🔴 Crítico</option>
                                  </select>
                                </td>
                                <td style={{ padding:'4px 8px', border:'1px solid #E2E8F0', textAlign:'center' }}>
                                  <button onClick={()=>updateTanque(tkIdx,'asentamiento',tk.asentamiento.filter((_,j)=>j!==ai))}
                                    style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:14 }}>✕</button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              <button className="btn btn-secondary" onClick={addTanque} style={{ width:'100%', cursor:'pointer' }}>
                + Agregar otro tanque
              </button>
            </div>
          )}

          {/* ── PASO 5c: Inspección estructurada TUBERÍA — múltiples líneas ── */}
          {tipo === 'TUBERIA' && (
            <div style={S.seccion}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={S.seccionTitulo}>⑤c Inspección Técnica de Tuberías</div>
                <button className="btn btn-secondary btn-sm" onClick={addLinea}>+ Agregar línea</button>
              </div>

              {lineas.map((ln, lnIdx) => (
                <div key={lnIdx} style={{ border:'1.5px solid #CBD5E1', borderRadius:10, padding:18, marginBottom:20, background:'#FAFAFA' }}>

                  {/* ─ Header línea ─ */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <span style={{ fontWeight:700, fontSize:13, color:'#0F172A' }}>
                      📐 Línea / Tramo {lnIdx + 1}
                    </span>
                    <input placeholder="ID Línea / Tag (ej: LP-100-4&quot;-CS)"
                      value={ln.tag}
                      onChange={e => updateLinea(lnIdx, 'tag', e.target.value)}
                      style={{ fontSize:12, fontFamily:'monospace', fontWeight:700, maxWidth:220 }} />
                    {lineas.length > 1 && (
                      <button onClick={() => removeLinea(lnIdx)}
                        style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#DC2626',
                          borderRadius:6, padding:'2px 10px', fontSize:12, cursor:'pointer', marginLeft:'auto' }}>
                        ✕ Eliminar
                      </button>
                    )}
                  </div>

                  {/* ─ Datos generales línea ─ */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
                    {[
                      { id:'pid',        label:'P&ID / N° Isométrico' },
                      { id:'fluido',     label:'Fluido transportado' },
                      { id:'temp_op',    label:'T° operación (°C)' },
                      { id:'presion_op', label:'P° operación (bar)' },
                    ].map(f => (
                      <label key={f.id} style={{ fontSize:12, fontWeight:600, color:'#475569' }}>
                        {f.label}
                        <input value={ln[f.id] || ''}
                          onChange={e => updateLinea(lnIdx, f.id, e.target.value)}
                          style={{ display:'block', width:'100%', marginTop:3 }} />
                      </label>
                    ))}
                  </div>

                  {/* ─ Tipo de inspección ─ */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:6 }}>
                      Tipo de inspección
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
                      {TUB_TIPOS_INSPECCION.map(ti => (
                        <label key={ti.id} style={{
                          display:'flex', flexDirection:'column', gap:2, padding:'8px 10px',
                          border:`1.5px solid ${ln.tipoInspeccion === ti.id ? '#2563EB' : '#E2E8F0'}`,
                          borderRadius:8, cursor:'pointer',
                          background: ln.tipoInspeccion === ti.id ? '#EFF6FF' : '#fff',
                        }}>
                          <input type="radio" name={`tub-tipo-${lnIdx}`} value={ti.id}
                            checked={ln.tipoInspeccion === ti.id}
                            onChange={() => updateLinea(lnIdx, 'tipoInspeccion', ti.id)}
                            style={{ display:'none' }} />
                          <span style={{ fontSize:13, fontWeight:700 }}>{ti.icon} {ti.label}</span>
                          <span style={{ fontSize:10, color:'#64748B' }}>{ti.sub}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ─ Badge normas ─ */}
                  {ln.tipoInspeccion && TUB_NORMAS_POR_TIPO[ln.tipoInspeccion] && (
                    <div style={{ fontSize:11, fontFamily:'monospace', color:'#1D4ED8', background:'#EFF6FF',
                      border:'1px solid #BFDBFE', borderRadius:6, padding:'6px 10px', marginBottom:12 }}>
                      📋 Normas aplicables: {TUB_NORMAS_POR_TIPO[ln.tipoInspeccion]}
                    </div>
                  )}

                  {/* ─ Motivo (solo contingencia) ─ */}
                  {ln.tipoInspeccion === 'contingencia' && (
                    <label style={{ display:'block', marginBottom:12, fontSize:12, fontWeight:600, color:'#B45309' }}>
                      ⚠️ Descripción del problema / contingencia
                      <textarea rows={2} value={ln.motivo}
                        onChange={e => updateLinea(lnIdx, 'motivo', e.target.value)}
                        placeholder="Describir fuga, fisura, daño o evento que genera la inspección…"
                        style={{ display:'block', width:'100%', marginTop:4, fontSize:12 }} />
                    </label>
                  )}

                  {/* ─ Tabla de Spools / Tramos ─ */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#475569' }}>🔩 Spools / Tramos</div>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const updated = { ...ln, spools: [...ln.spools, initSpool()] }
                          setLineas(prev => prev.map((l, i) => i === lnIdx ? updated : l))
                        }}>
                        + Spool
                      </button>
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                        <thead>
                          <tr style={{ background:'#F1F5F9' }}>
                            {['N° / ID Spool','DN (pulg)','Sch / SDR','e nom. (mm)','Material','Longitud (m)','Ubicación / Desc.','Estado',''].map(h => (
                              <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontWeight:600, color: h==='e nom. (mm)' ? '#0369A1' : '#475569', whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ln.spools.map((sp, spIdx) => (
                            <tr key={spIdx} style={{ borderBottom:'1px solid #E2E8F0' }}>
                              <td style={{ padding:'4px 6px' }}>
                                <input value={sp.id_spool}
                                  onChange={e => {
                                    const spools = ln.spools.map((s,i) => i===spIdx ? {...s, id_spool:e.target.value} : s)
                                    setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                  }} style={{ width:90, fontSize:11 }} />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <select value={sp.dn}
                                  onChange={e => {
                                    const spools = ln.spools.map((s,i) => i===spIdx ? {...s, dn:e.target.value} : s)
                                    setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                  }} style={{ fontSize:11 }}>
                                  <option value="">--</option>
                                  {DN_OPCIONES.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                {esMaterialPlastico(sp.material) ? (
                                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                                    <select value={sp.schedule}
                                      onChange={e => {
                                        const spools = ln.spools.map((s,i) => i===spIdx ? {...s, schedule:e.target.value} : s)
                                        setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                      }} style={{ fontSize:11, borderColor:'#86EFAC' }}>
                                      <option value="">-- SDR --</option>
                                      {SDR_OPCIONES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {/* Calculadora inversa SDR: OD medido ÷ t medido */}
                                    <details style={{ fontSize:10 }}>
                                      <summary style={{ cursor:'pointer', color:'#15803D', fontWeight:600, userSelect:'none' }}>
                                        🔢 No sé el SDR
                                      </summary>
                                      <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:6,
                                        padding:'6px 8px', marginTop:4, minWidth:190 }}>
                                        <div style={{ fontWeight:700, color:'#166534', marginBottom:4 }}>
                                          Calcular SDR en terreno
                                        </div>
                                        <div style={{ color:'#374151', marginBottom:4, lineHeight:'1.4' }}>
                                          1. Lee el sello impreso del caño<br/>
                                          2. Si no: mide OD (cinta Pi) y espesor (UT en zona sin daño)
                                        </div>
                                        <div style={{ display:'flex', gap:4, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                                          <label style={{ fontWeight:600, color:'#166534' }}>
                                            OD medido (mm)
                                            <input type="number" placeholder="114.3"
                                              value={sp._od_medido || ''}
                                              onChange={e => {
                                                const spools = ln.spools.map((s,i) => i===spIdx ? {...s, _od_medido:e.target.value} : s)
                                                setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                              }}
                                              style={{ display:'block', width:70, fontSize:11, marginTop:2 }} />
                                          </label>
                                          <label style={{ fontWeight:600, color:'#166534' }}>
                                            t medido (mm)
                                            <input type="number" placeholder="6.7"
                                              value={sp._t_medido || ''}
                                              onChange={e => {
                                                const spools = ln.spools.map((s,i) => i===spIdx ? {...s, _t_medido:e.target.value} : s)
                                                setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                              }}
                                              style={{ display:'block', width:70, fontSize:11, marginTop:2 }} />
                                          </label>
                                        </div>
                                        {/* Resultado del cálculo */}
                                        {(() => {
                                          const od = parseFloat(sp._od_medido)
                                          const t  = parseFloat(sp._t_medido)
                                          if (!od || !t || t <= 0) return null
                                          const sdrCalc = od / t
                                          // Buscar SDR estándar más cercano
                                          const SDR_ESTANDAR = [7.3, 9, 11, 13.6, 17, 21, 26, 32.5, 41]
                                          const nearest = SDR_ESTANDAR.reduce((a, b) =>
                                            Math.abs(b - sdrCalc) < Math.abs(a - sdrCalc) ? b : a)
                                          const sdrStr = `SDR ${nearest}`
                                          const diff = Math.abs(nearest - sdrCalc)
                                          const match = diff < 1.5
                                          return match ? (
                                            /* ── RESULTADO OK ── */
                                            <div style={{ background:'#DCFCE7', border:'1px solid #4ADE80', borderRadius:6, padding:'6px 10px' }}>
                                              <div style={{ fontWeight:700, color:'#166534', fontSize:11 }}>
                                                SDR calculado = {sdrCalc.toFixed(1)} → {sdrStr}
                                              </div>
                                              <div style={{ color:'#166534', fontSize:10, margin:'3px 0 6px' }}>
                                                ✅ Corresponde a <strong>{sdrStr}</strong> (ASTM F714 / ISO 4427)
                                              </div>
                                              <button onClick={() => {
                                                const spools = ln.spools.map((s,i) => i===spIdx ? {...s, schedule:sdrStr} : s)
                                                setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                              }} style={{ fontSize:10, padding:'3px 10px', background:'#15803D',
                                                border:'none', borderRadius:4, color:'#fff', cursor:'pointer', marginBottom:4 }}>
                                                ✔ Aplicar {sdrStr}
                                              </button>
                                              <div style={{ fontSize:10, color:'#166534', borderTop:'1px solid #86EFAC', paddingTop:4, marginTop:2 }}>
                                                📋 <strong>Nota para el informe:</strong> SDR determinado en terreno mediante medición directa
                                                OD = {sp._od_medido} mm / t = {sp._t_medido} mm (SDR calc. = {sdrCalc.toFixed(1)}).
                                                Sello de fabricante no disponible o ilegible.
                                              </div>
                                            </div>
                                          ) : (
                                            /* ── ADVERTENCIA: NO COINCIDE ── */
                                            <div style={{ background:'#FEF3C7', border:'2px solid #F59E0B', borderRadius:6, padding:'8px 10px' }}>
                                              <div style={{ fontWeight:700, color:'#92400E', fontSize:12, marginBottom:4 }}>
                                                ⚠️ SDR calculado = {sdrCalc.toFixed(1)} — no coincide con ningún SDR estándar
                                              </div>
                                              <div style={{ fontSize:11, color:'#78350F', lineHeight:'1.5', marginBottom:6 }}>
                                                El valor calculado ({sdrCalc.toFixed(1)}) no corresponde a ningún SDR normalizado
                                                por ASTM F714 / ISO 4427. El más cercano sería <strong>{sdrStr}</strong> (diferencia: {diff.toFixed(1)}).
                                              </div>
                                              <div style={{ background:'#FDE68A', borderRadius:5, padding:'6px 8px', fontSize:10, color:'#78350F', lineHeight:'1.5' }}>
                                                <strong>Acciones recomendadas antes de continuar:</strong><br/>
                                                1. Verificar que el OD y espesor se midieron correctamente (al menos 3 lecturas).<br/>
                                                2. Buscar sello del fabricante en otro tramo visible del mismo ramal.<br/>
                                                3. Consultar P&ID, lista de materiales o al cliente.<br/>
                                                4. Si persiste la duda, registrar espesor como <em>estimado en terreno</em> y documentar el hallazgo como observación en el informe.
                                              </div>
                                              <div style={{ fontSize:10, color:'#92400E', marginTop:6 }}>
                                                📋 <strong>Dejar constancia en informe:</strong> SDR no identificado. OD medido = {sp._od_medido} mm,
                                                t medido = {sp._t_medido} mm, SDR calc. = {sdrCalc.toFixed(1)}.
                                                No coincide con estándar ASTM F714. Requiere verificación documental.
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </details>
                                  </div>
                                ) : (
                                  <select value={sp.schedule}
                                    onChange={e => {
                                      const spools = ln.spools.map((s,i) => i===spIdx ? {...s, schedule:e.target.value} : s)
                                      setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                    }} style={{ fontSize:11 }}>
                                    <option value="">-- Sch --</option>
                                    {SCHEDULE_OPCIONES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                )}
                              </td>
                              {/* Espesor nominal calculado — ASME B36.10M (acero) o ASTM F714 (plástico) */}
                              <td style={{ padding:'4px 6px', textAlign:'center' }}>
                                {(() => {
                                  const res = getNominalEspesor(sp.dn, sp.schedule, sp.material)
                                  return res
                                    ? (
                                      <span style={{ fontWeight:700, color: esMaterialPlastico(sp.material)?'#16A34A':'#0369A1',
                                        fontFamily:'monospace', fontSize:12 }}>
                                        {res.espesor} mm
                                        <span style={{ fontSize:9, fontWeight:400, marginLeft:3, color:'#64748B' }}>
                                          {res.norma}
                                        </span>
                                      </span>
                                    )
                                    : <span style={{ color:'#94A3B8', fontSize:11 }}>—</span>
                                })()}
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <select value={sp.material}
                                  onChange={e => {
                                    const spools = ln.spools.map((s,i) => i===spIdx ? {...s, material:e.target.value} : s)
                                    setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                  }} style={{ fontSize:11 }}>
                                  <option value="">--</option>
                                  {SPOOL_MATERIALES.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <input type="number" value={sp.longitud_m}
                                  onChange={e => {
                                    const spools = ln.spools.map((s,i) => i===spIdx ? {...s, longitud_m:e.target.value} : s)
                                    setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                  }} style={{ width:70, fontSize:11 }} />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <input value={sp.ubicacion}
                                  onChange={e => {
                                    const spools = ln.spools.map((s,i) => i===spIdx ? {...s, ubicacion:e.target.value} : s)
                                    setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                  }} style={{ width:130, fontSize:11 }} />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <select value={sp.estado}
                                  onChange={e => {
                                    const spools = ln.spools.map((s,i) => i===spIdx ? {...s, estado:e.target.value} : s)
                                    setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                  }} style={{ fontSize:11 }}>
                                  <option value="">--</option>
                                  <option value="conforme">✅ Conforme</option>
                                  <option value="observado">⚠️ Observado</option>
                                  <option value="rechazado">❌ Rechazado</option>
                                </select>
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                {ln.spools.length > 1 && (
                                  <button onClick={() => {
                                    const spools = ln.spools.filter((_,i) => i !== spIdx)
                                    setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, spools} : l))
                                  }} style={{ background:'none', border:'none', color:'#DC2626', cursor:'pointer', fontSize:13 }}>✕</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ─ Tabla de Mediciones UT (si aplica) ─ */}
                  {['ut_espesores','preoperacional','contingencia','post_reparacion','retorno_servicio','integral'].includes(ln.tipoInspeccion) && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#475569' }}>📏 Mediciones de Espesores UT</div>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const med = { spool_ref:'', punto:'', nominal_mm:'', nominal_fuente:'', medido_mm:'', minimo_mm:'', perdida_pct:'', tasa_mm_ano:'', estado:'' }
                            setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, medicionesUT:[...l.medicionesUT, med]} : l))
                          }}>+ Punto</button>
                      </div>
                      <div style={{ fontSize:10, color:'#64748B', marginBottom:4 }}>
                        ① Si no tienes el espesor nominal: haz clic en <strong>⬇ ASME</strong> para usar el valor ASME B36.10M según DN+Schedule del spool,
                        o <strong>✏ Estimado</strong> para indicar que se tomó el valor máximo medido en terreno como referencia (API 570 §4.3).
                      </div>
                      {ln.medicionesUT.length === 0 ? (
                        <div style={{ fontSize:11, color:'#94A3B8', fontStyle:'italic' }}>Sin puntos de medición. Haz clic en "+ Punto" para agregar.</div>
                      ) : (
                        <div style={{ overflowX:'auto' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                            <thead>
                              <tr style={{ background:'#F0FDF4' }}>
                                {['Spool Ref','Punto / Zona','Nominal (mm) ①','Medido (mm)','Mín. req. (mm)','% Pérdida','Tasa (mm/año)','Estado',''].map(h => (
                                  <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontWeight:600, color:'#166534', whiteSpace:'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ln.medicionesUT.map((m, mIdx) => {
                                const pct = m.nominal_mm && m.medido_mm
                                  ? (((parseFloat(m.nominal_mm) - parseFloat(m.medido_mm)) / parseFloat(m.nominal_mm)) * 100).toFixed(1)
                                  : ''
                                const ok = pct === '' || parseFloat(pct) < 20
                                const upd = (field, val) => {
                                  const medicionesUT = ln.medicionesUT.map((x,i) => i===mIdx ? {...x,[field]:val} : x)
                                  setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, medicionesUT} : l))
                                }
                                return (
                                  <tr key={mIdx} style={{ borderBottom:'1px solid #DCFCE7', background: pct !== '' && parseFloat(pct) >= 20 ? '#FEF2F2' : 'transparent' }}>
                                    <td style={{ padding:'4px 6px' }}><input value={m.spool_ref} onChange={e=>upd('spool_ref',e.target.value)} style={{ width:80,fontSize:11 }}/></td>
                                    <td style={{ padding:'4px 6px' }}><input value={m.punto} onChange={e=>upd('punto',e.target.value)} placeholder="Codo ext., Recto, Tee…" style={{ width:130,fontSize:11 }}/></td>
                                    <td style={{ padding:'4px 4px' }}>
                                      {/* Nominal con asistente ASME B36.10M */}
                                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                                          <input type="number" value={m.nominal_mm}
                                            onChange={e => { upd('nominal_mm', e.target.value); upd('nominal_fuente','manual') }}
                                            style={{ width:58, fontSize:11,
                                              border: m.nominal_fuente==='estimado' ? '1.5px dashed #D97706' : '1px solid #CBD5E1',
                                            }} />
                                          {m.nominal_fuente === 'estimado' && (
                                            <span style={{ fontSize:9, color:'#D97706', fontWeight:700 }}>EST</span>
                                          )}
                                          {m.nominal_fuente && m.nominal_fuente !== 'estimado' && m.nominal_fuente !== 'manual' && (
                                            <span style={{ fontSize:9, color: m.nominal_fuente.includes('F714')?'#15803D':'#0369A1', fontWeight:700 }}>
                                              {m.nominal_fuente.includes('F714') ? 'F714' : 'B36.10M'}
                                            </span>
                                          )}
                                        </div>
                                        {/* Botón: calcular desde spool referenciado — ASME B36.10M o ASTM F714 */}
                                        {(() => {
                                          const sp = ln.spools.find(s => s.id_spool && s.id_spool === m.spool_ref)
                                            ?? (ln.spools.length === 1 ? ln.spools[0] : null)
                                          const res = sp ? getNominalEspesor(sp.dn, sp.schedule, sp.material) : null
                                          return (
                                            <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                                              {res && (
                                                <button onClick={() => { upd('nominal_mm', String(res.espesor)); upd('nominal_fuente', res.norma) }}
                                                  style={{ fontSize:9, padding:'1px 5px',
                                                    background: esMaterialPlastico(sp.material) ? '#F0FDF4' : '#EFF6FF',
                                                    border: `1px solid ${esMaterialPlastico(sp.material) ? '#86EFAC' : '#93C5FD'}`,
                                                    borderRadius:4, cursor:'pointer',
                                                    color: esMaterialPlastico(sp.material) ? '#15803D' : '#1D4ED8',
                                                    whiteSpace:'nowrap' }}>
                                                  ⬇ {res.norma} {res.espesor}mm
                                                </button>
                                              )}
                                              <button onClick={() => upd('nominal_fuente','estimado')}
                                                style={{ fontSize:9, padding:'1px 5px', background:'#FFFBEB',
                                                  border:'1px solid #FCD34D', borderRadius:4, cursor:'pointer', color:'#92400E', whiteSpace:'nowrap' }}>
                                                ✏ Estimado
                                              </button>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </td>
                                    <td style={{ padding:'4px 6px' }}><input type="number" value={m.medido_mm} onChange={e=>upd('medido_mm',e.target.value)} style={{ width:70,fontSize:11 }}/></td>
                                    <td style={{ padding:'4px 6px' }}><input type="number" value={m.minimo_mm} onChange={e=>upd('minimo_mm',e.target.value)} style={{ width:70,fontSize:11 }}/></td>
                                    <td style={{ padding:'4px 6px', fontWeight:700, color: ok ? '#166534' : '#DC2626' }}>{pct !== '' ? `${pct}%` : '—'}</td>
                                    <td style={{ padding:'4px 6px' }}><input value={m.tasa_mm_ano} onChange={e=>upd('tasa_mm_ano',e.target.value)} style={{ width:70,fontSize:11 }}/></td>
                                    <td style={{ padding:'4px 6px' }}>
                                      <select value={m.estado} onChange={e=>upd('estado',e.target.value)} style={{ fontSize:11 }}>
                                        <option value="">--</option>
                                        <option value="aceptable">✅ Aceptable</option>
                                        <option value="alerta">⚠️ Alerta</option>
                                        <option value="critico">❌ Crítico</option>
                                      </select>
                                    </td>
                                    <td><button onClick={() => {
                                      const medicionesUT = ln.medicionesUT.filter((_,i)=>i!==mIdx)
                                      setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l,medicionesUT} : l))
                                    }} style={{ background:'none',border:'none',color:'#DC2626',cursor:'pointer',fontSize:13 }}>✕</button></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─ Tabla LP / PM — juntas y soldaduras ─ */}
                  {['lp','pm','preoperacional','post_reparacion','contingencia','integral'].includes(ln.tipoInspeccion) && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#475569' }}>
                          {['lp','pm'].includes(ln.tipoInspeccion)
                            ? (ln.tipoInspeccion === 'lp' ? '🔵 Resultados LP por Junta / Soldadura' : '🔴 Resultados PM por Junta / Soldadura')
                            : '🔵🔴 Resultados LP / PM por Junta / Soldadura'}
                        </div>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const sold = { junta:'', spool_ref:'', tipo_junta:'', resultado:'', descripcion:'', disposicion:'' }
                            setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, soldaduras:[...l.soldaduras, sold]} : l))
                          }}>+ Junta</button>
                      </div>
                      {ln.soldaduras.length === 0 ? (
                        <div style={{ fontSize:11, color:'#94A3B8', fontStyle:'italic' }}>Sin juntas. Haz clic en "+ Junta" para agregar.</div>
                      ) : (
                        <div style={{ overflowX:'auto' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                            <thead>
                              <tr style={{ background:'#FDF4FF' }}>
                                {['N° Junta','Spool Ref','Tipo junta','Resultado','Descripción discontinuidad','Disposición',''].map(h => (
                                  <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontWeight:600, color:'#6B21A8', whiteSpace:'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ln.soldaduras.map((s, sIdx) => {
                                const upd = (field, val) => {
                                  const soldaduras = ln.soldaduras.map((x,i) => i===sIdx ? {...x,[field]:val} : x)
                                  setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, soldaduras} : l))
                                }
                                return (
                                  <tr key={sIdx} style={{ borderBottom:'1px solid #F3E8FF' }}>
                                    <td style={{ padding:'4px 6px' }}><input value={s.junta} onChange={e=>upd('junta',e.target.value)} style={{ width:70,fontSize:11 }}/></td>
                                    <td style={{ padding:'4px 6px' }}><input value={s.spool_ref} onChange={e=>upd('spool_ref',e.target.value)} style={{ width:80,fontSize:11 }}/></td>
                                    <td style={{ padding:'4px 6px' }}>
                                      <select value={s.tipo_junta} onChange={e=>upd('tipo_junta',e.target.value)} style={{ fontSize:11 }}>
                                        <option value="">--</option>
                                        <option value="circunferencial">Circunferencial</option>
                                        <option value="longitudinal">Longitudinal</option>
                                        <option value="filete">Filete (fillet)</option>
                                        <option value="socket">Socket weld</option>
                                        <option value="brida">Unión a brida</option>
                                      </select>
                                    </td>
                                    <td style={{ padding:'4px 6px' }}>
                                      <select value={s.resultado} onChange={e=>upd('resultado',e.target.value)} style={{ fontSize:11 }}>
                                        <option value="">--</option>
                                        <option value="sd">✅ S/D — Sin discontinuidad</option>
                                        <option value="cd">❌ C/D — Con discontinuidad</option>
                                      </select>
                                    </td>
                                    <td style={{ padding:'4px 6px' }}><input value={s.descripcion} onChange={e=>upd('descripcion',e.target.value)} placeholder="Solo si C/D" style={{ width:160,fontSize:11 }}/></td>
                                    <td style={{ padding:'4px 6px' }}>
                                      <select value={s.disposicion} onChange={e=>upd('disposicion',e.target.value)} style={{ fontSize:11 }}>
                                        <option value="">--</option>
                                        <option value="aceptable">Aceptable</option>
                                        <option value="reparar">Requiere reparación</option>
                                        <option value="rechazado">Rechazado</option>
                                      </select>
                                    </td>
                                    <td><button onClick={() => {
                                      const soldaduras = ln.soldaduras.filter((_,i)=>i!==sIdx)
                                      setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l,soldaduras} : l))
                                    }} style={{ background:'none',border:'none',color:'#DC2626',cursor:'pointer',fontSize:13 }}>✕</button></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─ Prueba Hidrostática ─ */}
                  {['ph','preoperacional','post_reparacion','integral'].includes(ln.tipoInspeccion) && (
                    <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:12, marginBottom:14 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#1D4ED8', marginBottom:10 }}>💧 Prueba Hidrostática / Presión</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                        {[
                          { id:'presion_diseno',  label:'Presión diseño (bar)' },
                          { id:'presion_prueba',  label:'P° prueba = 1.5×Pd (bar)' },
                          { id:'fluido_prueba',   label:'Fluido de prueba' },
                          { id:'temperatura',     label:'Temperatura fluido (°C)' },
                          { id:'duracion_hrs',    label:'Duración (horas)' },
                        ].map(f => (
                          <label key={f.id} style={{ fontSize:12, fontWeight:600, color:'#1E40AF' }}>
                            {f.label}
                            <input value={ln.ph[f.id] || ''}
                              onChange={e => {
                                const ph = { ...ln.ph, [f.id]: e.target.value }
                                setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, ph} : l))
                              }}
                              style={{ display:'block', width:'100%', marginTop:3, fontSize:12 }} />
                          </label>
                        ))}
                        <label style={{ fontSize:12, fontWeight:600, color:'#1E40AF' }}>
                          Resultado prueba
                          <select value={ln.ph.resultado}
                            onChange={e => {
                              const ph = { ...ln.ph, resultado: e.target.value }
                              setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, ph} : l))
                            }}
                            style={{ display:'block', width:'100%', marginTop:3, fontSize:12 }}>
                            <option value="">-- Seleccionar --</option>
                            <option value="aprueba">✅ APRUEBA</option>
                            <option value="falla">❌ FALLA</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* ─ Checklist de inspección ─ */}
                  {ln.tipoInspeccion && TUB_CHECKLIST[ln.tipoInspeccion] && (
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:8 }}>
                        ✔ Checklist — {TUB_TIPOS_INSPECCION.find(t=>t.id===ln.tipoInspeccion)?.label}
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ background:'#F8FAFC' }}>
                            <th style={{ padding:'6px 10px', textAlign:'left', color:'#64748B', fontWeight:600 }}>Ítem de verificación</th>
                            {['Conforme','No conforme','N/A'].map(h => (
                              <th key={h} style={{ padding:'6px 10px', textAlign:'center', color:'#64748B', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {TUB_CHECKLIST[ln.tipoInspeccion].map((item, iIdx) => (
                            <tr key={item.id} style={{ borderBottom:'1px solid #F1F5F9', background: iIdx%2===0?'#FFFFFF':'#F8FAFC' }}>
                              <td style={{ padding:'6px 10px', color:'#334155' }}>{item.label}</td>
                              {['conforme','no_conforme','na'].map(val => (
                                <td key={val} style={{ padding:'6px 10px', textAlign:'center' }}>
                                  <input type="radio"
                                    name={`tub-cl-${lnIdx}-${item.id}`}
                                    checked={ln.checklist[item.id] === val}
                                    onChange={() => {
                                      const checklist = { ...ln.checklist, [item.id]: val }
                                      setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l,checklist} : l))
                                    }} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ─ Evidencia fotográfica ─ */}
                  <div style={{ marginTop:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#475569' }}>
                        📷 Evidencia fotográfica
                        {ln.fotos.length > 0 && (
                          <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'#64748B' }}>
                            {ln.fotos.length} foto{ln.fotos.length !== 1 ? 's' : ''} adjunta{ln.fotos.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <label style={{ cursor:'pointer' }}>
                        <input type="file" accept="image/*" multiple style={{ display:'none' }}
                          onChange={e => {
                            const archivos = Array.from(e.target.files)
                            const nuevas = archivos.map(f => ({
                              preview: URL.createObjectURL(f),
                              file: f,
                              caption: '',
                              zona: '',
                              nombre: f.name,
                            }))
                            setLineas(prev => prev.map((l,i) => i===lnIdx
                              ? {...l, fotos:[...l.fotos, ...nuevas]} : l))
                            e.target.value = ''
                          }} />
                        <span className="btn btn-secondary btn-sm" style={{ pointerEvents:'none' }}>
                          + Agregar fotos
                        </span>
                      </label>
                    </div>

                    {ln.fotos.length === 0 ? (
                      <label style={{ cursor:'pointer', display:'block' }}>
                        <input type="file" accept="image/*" multiple style={{ display:'none' }}
                          onChange={e => {
                            const archivos = Array.from(e.target.files)
                            const nuevas = archivos.map(f => ({
                              preview: URL.createObjectURL(f),
                              file: f,
                              caption: '',
                              zona: '',
                              nombre: f.name,
                            }))
                            setLineas(prev => prev.map((l,i) => i===lnIdx
                              ? {...l, fotos:[...l.fotos, ...nuevas]} : l))
                            e.target.value = ''
                          }} />
                        <div style={{ border:'1.5px dashed #CBD5E1', borderRadius:8, padding:'20px',
                          textAlign:'center', color:'#94A3B8', fontSize:12 }}>
                          📷 Haz clic aquí o arrastra fotos desde el terreno
                          <div style={{ fontSize:10, marginTop:4 }}>JPG, PNG — múltiples archivos permitidos</div>
                        </div>
                      </label>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                        {ln.fotos.map((foto, fIdx) => (
                          <div key={fIdx} style={{ border:'1px solid #E2E8F0', borderRadius:8,
                            overflow:'hidden', background:'#F8FAFC' }}>
                            {/* Thumbnail */}
                            <div style={{ position:'relative' }}>
                              <img src={foto.preview} alt={foto.caption || `Foto ${fIdx+1}`}
                                style={{ width:'100%', height:110, objectFit:'cover', display:'block' }} />
                              <button onClick={() => {
                                const fotos = ln.fotos.filter((_,i) => i!==fIdx)
                                setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, fotos} : l))
                              }} style={{ position:'absolute', top:4, right:4,
                                background:'rgba(0,0,0,0.65)', border:'none', borderRadius:'50%',
                                width:20, height:20, cursor:'pointer', color:'#fff', fontSize:12,
                                display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                                ✕
                              </button>
                              <span style={{ position:'absolute', bottom:4, left:4,
                                background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:10,
                                padding:'1px 7px', borderRadius:4, fontWeight:700 }}>
                                Fig. {fIdx+1}
                              </span>
                            </div>
                            {/* Metadatos */}
                            <div style={{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                              <input value={foto.zona} placeholder="Zona / spool ref. (ej: SP-02 codo)"
                                onChange={e => {
                                  const fotos = ln.fotos.map((f,i) => i===fIdx ? {...f, zona:e.target.value} : f)
                                  setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, fotos} : l))
                                }}
                                style={{ fontSize:10, padding:'3px 5px' }} />
                              <input value={foto.caption} placeholder="Descripción del hallazgo..."
                                onChange={e => {
                                  const fotos = ln.fotos.map((f,i) => i===fIdx ? {...f, caption:e.target.value} : f)
                                  setLineas(prev => prev.map((l,i) => i===lnIdx ? {...l, fotos} : l))
                                }}
                                style={{ fontSize:10, padding:'3px 5px' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              ))}

              <button className="btn btn-secondary" onClick={addLinea} style={{ width:'100%', cursor:'pointer' }}>
                + Agregar otra línea / tramo
              </button>
            </div>
          )}

          {/* ── PASO 5d: Croquis y Mediciones Visuales ── */}
          {(tipo === 'TANQUE' || tipo === 'TUBERIA' || tipo === 'ESTRUCTURA') && (
            <div style={S.seccion}>
              <div style={S.seccionTitulo}>⑤d Croquis y Registro de Mediciones</div>
              <CroquisEquipo
                tipo={tipo}
                data={datosVisuales}
                onChange={setDatosVisuales}
              />
            </div>
          )}
          {tipo === 'IZAJE' && elementosIzaje.some(el => getFamiliaIzaje(el.tipo) === 'hardware') && (
            <div style={S.seccion}>
              <div style={S.seccionTitulo}>⑤d Control Dimensional — Elementos de Izaje</div>
              <CroquisEquipo
                tipo="IZAJE"
                tipoIzaje={elementosIzaje.find(el => getFamiliaIzaje(el.tipo) === 'hardware')?.tipo}
                data={datosVisuales}
                onChange={setDatosVisuales}
              />
            </div>
          )}

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

          {/* ── PASO 6b: Equipo de medición END utilizado ── */}
          <div style={S.seccion}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={S.seccionTitulo}>⑦ Equipo / Instrumento END Utilizado</div>
              <button className="btn btn-secondary btn-sm"
                onClick={() => setEquiposMedicion(prev => [...prev, { tipo:'', marca:'', modelo:'', numero_serie:'', cert_calibracion:'' }])}
                style={{ cursor:'pointer' }}>
                + Agregar equipo
              </button>
            </div>
            <p style={{ fontSize:12, color:'#64748B', marginBottom:14 }}>
              Registra cada instrumento utilizado (marca, modelo, N° serie y certificado de calibración).
            </p>
            {equiposMedicion.length === 0 ? (
              <div style={{ color:'var(--gris)', fontSize:13, padding:'14px 0', textAlign:'center', borderTop:'1px dashed #E2E8F0' }}>
                Sin equipos. Haz clic en "+ Agregar equipo" para ingresar.
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                  <thead>
                    <tr style={{ background:'#F8FAFC' }}>
                      {['Tipo / Instrumento','Marca','Modelo','N° Serie','Certificado calibración',''].map(h => (
                        <th key={h} style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'#64748B', textAlign:'left', border:'1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {equiposMedicion.map((em, i) => (
                      <tr key={i}>
                        <td style={S.tdInput}>
                          <select className="input" value={em.tipo}
                            onChange={e => setEquiposMedicion(prev => prev.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))}
                            style={{ fontSize:12, minWidth:160 }}>
                            <option value="">— Tipo —</option>
                            {['Medidor UT','Medidor UT Phased Array','Lámpara UV (36W)','Lámpara UV (100W)','Yoquillo magnético','Bobina de campo','Penetrómetro','Cuña de calibración','Cámara termográfica','Medidor de espesores por ultrasonido','Galga de recubrimiento','Manómetro digital','Dinamómetro'].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td style={S.tdInput}>
                          <input className="input" value={em.marca}
                            onChange={e => setEquiposMedicion(prev => prev.map((x, j) => j === i ? { ...x, marca: e.target.value } : x))}
                            placeholder="Marca" style={{ fontSize:12, width:90 }} />
                        </td>
                        <td style={S.tdInput}>
                          <input className="input" value={em.modelo}
                            onChange={e => setEquiposMedicion(prev => prev.map((x, j) => j === i ? { ...x, modelo: e.target.value } : x))}
                            placeholder="Modelo" style={{ fontSize:12, width:90 }} />
                        </td>
                        <td style={S.tdInput}>
                          <input className="input" value={em.numero_serie}
                            onChange={e => setEquiposMedicion(prev => prev.map((x, j) => j === i ? { ...x, numero_serie: e.target.value } : x))}
                            placeholder="N° serie" style={{ fontSize:12, width:80 }} />
                        </td>
                        <td style={S.tdInput}>
                          <input className="input" value={em.cert_calibracion}
                            onChange={e => setEquiposMedicion(prev => prev.map((x, j) => j === i ? { ...x, cert_calibracion: e.target.value } : x))}
                            placeholder="CAL-2025-XXXX, vig. hasta..." style={{ fontSize:12 }} />
                        </td>
                        <td style={{ padding:'4px 8px', border:'1px solid #E2E8F0', textAlign:'center' }}>
                          <button onClick={() => setEquiposMedicion(prev => prev.filter((_, j) => j !== i))}
                            style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:16 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── PASO 7: Mediciones (tanque y tubería) ── */}
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
                    onChange={e => { setHallazgoForm(p => ({ ...p, descripcion: e.target.value })); setHallazgoDescError(false) }}
                    placeholder="Ej: Corrosión generalizada en primer anillo, con pérdida de espesor estimada en 15%..."
                    style={{ borderColor: hallazgoDescError ? '#EF4444' : undefined }} />
                  {hallazgoDescError && (
                    <div style={{ color:'#EF4444', fontSize:12, marginTop:4 }}>⚠ La descripción es obligatoria para agregar un hallazgo.</div>
                  )}
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
              <button className="btn btn-secondary btn-sm" onClick={addHallazgo}
                style={{ marginTop:10, opacity: hallazgoForm.descripcion.trim() ? 1 : 0.5, cursor: hallazgoForm.descripcion.trim() ? 'pointer' : 'not-allowed' }}>
                + Agregar hallazgo
              </button>
            </div>
          </div>

          {/* ── Fotos de inspección generales ── */}
          <div style={S.seccion}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={S.seccionTitulo}>📷 Fotos de Inspección</div>
              <label style={{
                padding:'6px 14px', borderRadius:8, border:'1.5px solid #CBD5E1',
                background: subiendoFotoGeneral ? '#F1F5F9' : '#fff', color:'#475569',
                cursor: subiendoFotoGeneral ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:600 }}>
                {subiendoFotoGeneral ? '⏳ Subiendo...' : '📷 Agregar foto'}
                <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoFotoGeneral}
                  onChange={e => e.target.files[0] && subirFotoGeneral(e.target.files[0])} />
              </label>
            </div>
            {fotosInspeccion.length === 0 ? (
              <div style={{ color:'var(--gris)', fontSize:13, textAlign:'center', padding:'20px 0', borderTop:'1px dashed #E2E8F0' }}>
                Sin fotos. Haz clic en "📷 Agregar foto" para subir imágenes de la inspección.
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:12 }}>
                {fotosInspeccion.map((url, i) => (
                  <div key={i} style={{ position:'relative' }}>
                    <img src={url} alt={`Foto ${i+1}`}
                      style={{ width:'100%', height:140, objectFit:'cover', borderRadius:8, border:'1px solid #E2E8F0' }} />
                    <button onClick={() => removeFotoGeneral(i)}
                      style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.65)',
                        border:'none', color:'#fff', borderRadius:'50%', width:22, height:22,
                        cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      ✕
                    </button>
                    <div style={{ fontSize:10, color:'#64748B', textAlign:'center', marginTop:4 }}>Foto {i+1}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Resultado ── */}
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
  th: { padding:'7px 10px', fontSize:11, fontWeight:700, color:'#fff', textAlign:'left', border:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap' },
  td:  { padding:'5px 8px', border:'1px solid #E2E8F0', fontSize:12 },
  btnIA: {
    background:'linear-gradient(135deg,#7C3AED,#5B21B6)',
    color:'#fff', border:'none', borderRadius:10,
    padding:'10px 20px', fontWeight:700, fontSize:14,
    cursor:'pointer', display:'flex', alignItems:'center', gap:6,
  },
}
