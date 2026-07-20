// ============================================================
// CroquisEquipo.jsx — Croquis SVG + formularios de medición
// WSS · Sistema de Calidad
// Soporta: Gancho (A/B/C), Tanque (UT P×E), Tubería, Plancha
// ============================================================

// ── Estilos compartidos ───────────────────────────────────────────────────
const S = {
  card:    { background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:10, padding:'16px 18px', marginBottom:16 },
  title:   { fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:14 },
  label:   { display:'block', fontSize:11, fontWeight:700, color:'#475569', marginBottom:4 },
  input:   { width:'100%', borderRadius:6, border:'1.5px solid #CBD5E1', padding:'7px 10px', fontSize:13, color:'#1E293B', boxSizing:'border-box', outline:'none', textAlign:'center' },
  btnSec:  { padding:'7px 16px', borderRadius:6, border:'1.5px solid #CBD5E1', background:'#fff', color:'#475569', cursor:'pointer', fontSize:12, fontWeight:600 },
  btnPri:  { padding:'7px 16px', borderRadius:6, border:'none', background:'#1E3A5F', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' },
  th:      { padding:'8px 10px', background:'#1E3A5F', color:'#fff', fontSize:11, fontWeight:700, textAlign:'center', border:'1px solid #1E3A5F' },
  td:      { padding:4, border:'1px solid #E2E8F0', background:'#fff' },
  tdLabel: { padding:'6px 10px', border:'1px solid #E2E8F0', background:'#F1F5F9', fontSize:12, fontWeight:700, color:'#475569', textAlign:'center', whiteSpace:'nowrap' },
  nota:    { fontSize:11, color:'#94A3B8', fontStyle:'italic', marginTop:8 },
}

// ════════════════════════════════════════════════════════════════════════════
// 1. GANCHO — Control Dimensional A / B / C
// ════════════════════════════════════════════════════════════════════════════

export function CroquisGancho({ data = {}, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })

  return (
    <div style={S.card}>
      <div style={S.title}>Control Dimensional — Gancho (ASME B30.10)</div>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* SVG gancho — arco abierto v4 */}
        <div style={{ flex:'0 0 215px' }}>
          <svg viewBox="0 0 226 276" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:215 }}>

            {/*
              TÉCNICA: el cuerpo del gancho es un ARCO ABIERTO con trazo grueso.
              Centro del círculo: (100, 140), radio 70.
              Hombro (inicio): (112, 71)  — ángulo ≈ -80°
              Punta  (fin):    ( 34, 116) — ángulo ≈ -160°
              Barrido: 280° horario (large-arc=1, sweep=1)
              Boca visible: los ~80° restantes entre punta y hombro.
            */}

            {/* ── CUERPO DEL GANCHO: tres capas de trazo ── */}
            {/* 1) Borde exterior oscuro */}
            <path d="M 112,71 A 70,70 0 1 1 34,116"
              fill="none" stroke="#2D3E4E" strokeWidth="30" strokeLinecap="round"/>
            {/* 2) Cuerpo principal (acero azul-gris) */}
            <path d="M 112,71 A 70,70 0 1 1 34,116"
              fill="none" stroke="#8AABBE" strokeWidth="25" strokeLinecap="round"/>
            {/* 3) Resalte interior (da sensación cilíndrica) */}
            <path d="M 110,74 A 63,63 0 1 1 38,112"
              fill="none" stroke="#C4D4E0" strokeWidth="11" strokeLinecap="round"/>

            {/* ── PESTILLO DE SEGURIDAD ── */}
            {/* Cruza la boca desde la punta hasta el collar */}
            <path d="M 34,116 Q 52,94 74,80"
              fill="none" stroke="#2D3E4E" strokeWidth="7" strokeLinecap="round"/>
            <path d="M 34,116 Q 52,94 74,80"
              fill="none" stroke="#7A9BB0" strokeWidth="3.5" strokeLinecap="round"/>

            {/* ── COLLAR / TUERCA (cubre el hombro del arco) ── */}
            <rect x="74" y="62" width="52" height="14" rx="2" fill="#516070" stroke="#2D3E4E" strokeWidth="1.5"/>
            <line x1="74" y1="66.5" x2="126" y2="66.5" stroke="#334155" strokeWidth="0.8"/>
            <line x1="74" y1="71.5" x2="126" y2="71.5" stroke="#334155" strokeWidth="0.8"/>

            {/* ── VÁSTAGO con rosca (encima del collar) ── */}
            <rect x="86" y="8" width="28" height="56" fill="#8AABBE" stroke="#2D3E4E" strokeWidth="1.5"/>
            {[14,20,26,32,38,44,50,56].map(y => (
              <line key={y} x1="86" y1={y} x2="114" y2={y} stroke="#6A8BA0" strokeWidth="0.9"/>
            ))}
            {/* Sombra derecha (volumen 3D) */}
            <rect x="108" y="8" width="6" height="56" fill="#6A8BA0" stroke="none"/>

            {/* ══ COTAS ══ */}

            {/* A: Abertura de garganta — ancho interior del arco en y=140 */}
            {/* Pared int. izq.: x≈43  |  Pared int. der.: x≈157 */}
            <line x1="43" y1="140" x2="157" y2="140"
              stroke="#DC2626" strokeWidth="1.5" strokeDasharray="5,3"/>
            <line x1="43"  y1="136" x2="43"  y2="144" stroke="#DC2626" strokeWidth="2"/>
            <line x1="157" y1="136" x2="157" y2="144" stroke="#DC2626" strokeWidth="2"/>
            <line x1="18"  y1="140" x2="43"  y2="140" stroke="#DC2626" strokeWidth="1"/>
            <circle cx="12" cy="140" r="11" fill="#DC2626"/>
            <text x="12" y="145" fill="#fff" fontSize="13" fontWeight="bold" textAnchor="middle">A</text>

            {/* B: Altura desde collar bottom (y=76) hasta borde ext. inferior del arco (y=222) */}
            <line x1="192" y1="76" x2="192" y2="222"
              stroke="#2563EB" strokeWidth="1.5" strokeDasharray="5,3"/>
            <line x1="187" y1="76"  x2="197" y2="76"  stroke="#2563EB" strokeWidth="2"/>
            <line x1="187" y1="222" x2="197" y2="222" stroke="#2563EB" strokeWidth="2"/>
            {/* Guías desde el cuerpo */}
            <line x1="126" y1="76"  x2="192" y2="76"  stroke="#2563EB" strokeWidth="0.6" strokeDasharray="2,5"/>
            <line x1="100" y1="222" x2="192" y2="222" stroke="#2563EB" strokeWidth="0.6" strokeDasharray="2,5"/>
            <line x1="192" y1="149" x2="204" y2="149" stroke="#2563EB" strokeWidth="1"/>
            <circle cx="210" cy="149" r="11" fill="#2563EB"/>
            <text x="210" y="154" fill="#fff" fontSize="13" fontWeight="bold" textAnchor="middle">B</text>

            {/* C: Ancho del collar (x=74 a x=126) */}
            <line x1="74"  y1="248" x2="126" y2="248"
              stroke="#059669" strokeWidth="1.5" strokeDasharray="5,3"/>
            <line x1="74"  y1="243" x2="74"  y2="253" stroke="#059669" strokeWidth="2"/>
            <line x1="126" y1="243" x2="126" y2="253" stroke="#059669" strokeWidth="2"/>
            {/* Guías verticales desde el collar */}
            <line x1="74"  y1="76" x2="74"  y2="245" stroke="#059669" strokeWidth="0.6" strokeDasharray="2,5"/>
            <line x1="126" y1="76" x2="126" y2="245" stroke="#059669" strokeWidth="0.6" strokeDasharray="2,5"/>
            <line x1="100" y1="248" x2="100" y2="252" stroke="#059669" strokeWidth="1"/>
            <circle cx="100" cy="262" r="11" fill="#059669"/>
            <text x="100" y="267" fill="#fff" fontSize="13" fontWeight="bold" textAnchor="middle">C</text>
          </svg>
          <p style={S.nota}>Referencia: ASME B30.10</p>
        </div>

        {/* Tabla de mediciones */}
        <div style={{ flex:1, minWidth:220 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, width:28 }}>Ref.</th>
                <th style={S.th}>Descripción</th>
                <th style={{ ...S.th, width:100 }}>Resultado (mm)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key:'A', label:'Abertura de garganta',    color:'#DC2626' },
                { key:'B', label:'Altura de base (vástago)', color:'#2563EB' },
                { key:'C', label:'Ancho de base',            color:'#059669' },
              ].map(({ key, label, color }) => (
                <tr key={key}>
                  <td style={{ ...S.tdLabel, color, fontSize:14 }}>{key}</td>
                  <td style={{ ...S.tdLabel, textAlign:'left', fontWeight:400, color:'#374151' }}>{label}</td>
                  <td style={S.td}>
                    <input
                      style={S.input}
                      type="number"
                      step="0.1"
                      value={data[key] || ''}
                      onChange={e => set(key, e.target.value)}
                      placeholder="—"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop:12, padding:'10px 14px', background:'#FFFBEB', borderRadius:8, border:'1px solid #FDE68A', fontSize:12, color:'#92400E' }}>
            <b>Nota:</b> Los resultados se entregan a modo informativo cuando el solicitante no proporciona especificación técnica.
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2. TANQUE — Grilla UT configurable P × E + tipos de tanque
// ════════════════════════════════════════════════════════════════════════════

function initGrid(nP, nE) {
  return Array.from({ length: nP }, () => Array(nE).fill(''))
}

// ── Configuración por tipo ─────────────────────────────────────────────────
const TIPO_TK = {
  vertical: {
    label:        'Vertical cilíndrico',
    labelFilas:   'Puntos',
    labelCols:    'Ejes',
    filaLabel:    i => `P${i + 1}`,
    colLabel:     j => `E${j + 1}`,
    tieneSup:     true,
    tieneInf:     true,
    labelSup:     'Techo',
    labelInf:     'Fondo',
    nota:         'API 650 · Pulso-eco · mm',
  },
  horizontal: {
    label:        'Horizontal cilíndrico',
    labelFilas:   'Generatrices',
    labelCols:    'Secciones',
    filaLabel:    i => `G${i + 1}`,
    colLabel:     j => `S${j + 1}`,
    tieneSup:     true,
    tieneInf:     true,
    labelSup:     'Cabezal IZQ',
    labelInf:     'Cabezal DER',
    nota:         'API 510 · Pulso-eco · mm',
  },
  conico: {
    label:        'Cónico (fondo cónico)',
    labelFilas:   'Puntos',
    labelCols:    'Ejes',
    filaLabel:    i => `P${i + 1}`,
    colLabel:     j => `E${j + 1}`,
    tieneSup:     true,
    tieneInf:     true,
    labelSup:     'Techo',
    labelInf:     'Cono',
    nota:         'API 650 · Pulso-eco · mm',
  },
  techo_flotante: {
    label:        'Techo flotante',
    labelFilas:   'Puntos',
    labelCols:    'Ejes',
    filaLabel:    i => `P${i + 1}`,
    colLabel:     j => `E${j + 1}`,
    tieneSup:     false,
    tieneInf:     true,
    labelSup:     null,
    labelInf:     'Fondo',
    nota:         'API 650 Anexo C · Pulso-eco · mm',
  },
}

// ── SVG: Tanque Vertical ──────────────────────────────────────────────────
function SvgVertical({ nP, nE }) {
  const maxP = Math.min(nP, 9)
  const maxE = Math.min(nE, 6)
  return (
    <svg viewBox="0 0 180 268" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:180 }}>
      {/* Techo cónico */}
      <polygon points="90,12 30,46 150,46" fill="#BFDBFE" stroke="#1D4ED8" strokeWidth="2"/>
      <text x="90" y="38" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">TECHO</text>
      {/* Manto */}
      <rect x="30" y="46" width="120" height="165" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="2"/>
      {/* Ejes verticales */}
      {Array.from({ length: maxE }, (_, i) => {
        const x = 30 + (i + 1) * 120 / (maxE + 1)
        return (
          <g key={i}>
            <line x1={x} y1="46" x2={x} y2="211" stroke="#93C5FD" strokeWidth="1" strokeDasharray="4,3"/>
            <text x={x} y="43" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">E{i+1}</text>
          </g>
        )
      })}
      {/* Puntos P */}
      {Array.from({ length: maxP }, (_, i) => {
        const y = 46 + (i + 1) * 165 / (maxP + 1)
        return (
          <g key={i}>
            <line x1="22" y1={y} x2="30" y2={y} stroke="#1D4ED8" strokeWidth="1.5"/>
            <text x="20" y={y + 4} fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="end">P{i+1}</text>
          </g>
        )
      })}
      {/* Fondo */}
      <ellipse cx="90" cy="211" rx="60" ry="13" fill="#BFDBFE" stroke="#1D4ED8" strokeWidth="2"/>
      <text x="90" y="233" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">FONDO</text>
      {Array.from({ length: maxE }, (_, i) => {
        const x = 30 + (i + 1) * 120 / (maxE + 1)
        return <text key={i} x={x} y="228" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">E{i+1}</text>
      })}
    </svg>
  )
}

// ── SVG: Tanque Horizontal ────────────────────────────────────────────────
function SvgHorizontal({ nP, nE }) {
  const maxG = Math.min(nP, 8)  // generatrices = filas
  const maxS = Math.min(nE, 6)  // secciones = columnas
  const bx = 45, by = 50, bw = 138, bh = 88
  const cy = by + bh / 2   // centro Y = 94
  const ry = bh / 2        // 44

  return (
    <svg viewBox="0 0 240 190" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:220 }}>
      {/* Cuerpo */}
      <rect x={bx} y={by} width={bw} height={bh} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="2"/>
      {/* Cabezal IZQ */}
      <ellipse cx={bx} cy={cy} rx="20" ry={ry} fill="#BFDBFE" stroke="#1D4ED8" strokeWidth="2"/>
      {/* Cabezal DER */}
      <ellipse cx={bx + bw} cy={cy} rx="20" ry={ry} fill="#BFDBFE" stroke="#1D4ED8" strokeWidth="2"/>
      {/* Labels cabezales */}
      <text x={bx - 24} y={cy - ry - 4} fill="#1D4ED8" fontSize="8" fontWeight="bold" textAnchor="middle">CAB.</text>
      <text x={bx - 24} y={cy - ry + 5} fill="#1D4ED8" fontSize="8" fontWeight="bold" textAnchor="middle">IZQ</text>
      <text x={bx + bw + 24} y={cy - ry - 4} fill="#1D4ED8" fontSize="8" fontWeight="bold" textAnchor="middle">CAB.</text>
      <text x={bx + bw + 24} y={cy - ry + 5} fill="#1D4ED8" fontSize="8" fontWeight="bold" textAnchor="middle">DER</text>
      {/* Secciones longitudinales */}
      {Array.from({ length: maxS }, (_, i) => {
        const x = bx + (i + 1) * bw / (maxS + 1)
        return (
          <g key={i}>
            <line x1={x} y1={by} x2={x} y2={by + bh} stroke="#93C5FD" strokeWidth="1" strokeDasharray="4,3"/>
            <text x={x} y={by - 4} fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">S{i+1}</text>
          </g>
        )
      })}
      {/* Generatrices (posiciones reloj en sección transversal derecha) */}
      {Array.from({ length: maxG }, (_, i) => {
        const ang = (i * 360 / maxG) - 90
        const rad = ang * Math.PI / 180
        const ox = 195, gx = ox + Math.cos(rad) * 20, gy = cy + Math.sin(rad) * 20
        return (
          <g key={i}>
            <circle cx={gx} cy={gy} r="3" fill="#1D4ED8"/>
            <text
              x={gx + (Math.cos(rad) > 0 ? 8 : -8)}
              y={gy + 4}
              fill="#1D4ED8" fontSize="8" fontWeight="bold"
              textAnchor={Math.cos(rad) > 0 ? 'start' : 'end'}
            >G{i+1}</text>
          </g>
        )
      })}
      {/* Círculo sección transversal */}
      <circle cx="195" cy={cy} r="22" fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="195" y={by - 4} fill="#64748B" fontSize="7.5" textAnchor="middle">Secc.</text>
      {/* Silletas */}
      <polygon points={`${bx+15},${by+bh} ${bx+5},${by+bh+22} ${bx+40},${by+bh+22} ${bx+30},${by+bh}`}
        fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="1.5"/>
      <polygon points={`${bx+bw-30},${by+bh} ${bx+bw-40},${by+bh+22} ${bx+bw-5},${by+bh+22} ${bx+bw-15},${by+bh}`}
        fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="1.5"/>
      <line x1={bx} y1={by+bh+22} x2={bx+45} y2={by+bh+22} stroke="#1D4ED8" strokeWidth="2"/>
      <line x1={bx+bw-45} y1={by+bh+22} x2={bx+bw} y2={by+bh+22} stroke="#1D4ED8" strokeWidth="2"/>
    </svg>
  )
}

// ── SVG: Tanque Cónico ────────────────────────────────────────────────────
function SvgConico({ nP, nE }) {
  const maxP = Math.min(nP, 8)
  const maxE = Math.min(nE, 6)
  return (
    <svg viewBox="0 0 180 285" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:180 }}>
      {/* Techo plano */}
      <ellipse cx="90" cy="38" rx="60" ry="13" fill="#BFDBFE" stroke="#1D4ED8" strokeWidth="2"/>
      <text x="90" y="30" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">TECHO</text>
      {/* Manto */}
      <rect x="30" y="38" width="120" height="150" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="2"/>
      {/* Ejes */}
      {Array.from({ length: maxE }, (_, i) => {
        const x = 30 + (i + 1) * 120 / (maxE + 1)
        return (
          <g key={i}>
            <line x1={x} y1="38" x2={x} y2="188" stroke="#93C5FD" strokeWidth="1" strokeDasharray="4,3"/>
            <text x={x} y="34" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">E{i+1}</text>
          </g>
        )
      })}
      {/* Puntos P */}
      {Array.from({ length: maxP }, (_, i) => {
        const y = 38 + (i + 1) * 150 / (maxP + 1)
        return (
          <g key={i}>
            <line x1="22" y1={y} x2="30" y2={y} stroke="#1D4ED8" strokeWidth="1.5"/>
            <text x="20" y={y + 4} fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="end">P{i+1}</text>
          </g>
        )
      })}
      {/* Cono inferior */}
      <path d="M 30,188 L 150,188 L 90,252 Z" fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="2"/>
      {/* Líneas de ejes en el cono */}
      {Array.from({ length: maxE }, (_, i) => {
        const x = 30 + (i + 1) * 120 / (maxE + 1)
        return <line key={i} x1={x} y1="188" x2="90" y2="252" stroke="#93C5FD" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.6"/>
      })}
      <text x="90" y="238" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">CONO</text>
      <text x="90" y="268" fill="#64748B" fontSize="8" textAnchor="middle">fondo cónico</text>
    </svg>
  )
}

// ── SVG: Techo Flotante ──────────────────────────────────────────────────
function SvgTechoFlotante({ nP, nE }) {
  const maxP = Math.min(nP, 9)
  const maxE = Math.min(nE, 6)
  const my = 18, mh = 195  // manto Y y alto
  const tfY = my + mh * 0.38  // nivel del techo flotante (~92)

  return (
    <svg viewBox="0 0 180 268" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:180 }}>
      {/* Manto */}
      <rect x="30" y={my} width="120" height={mh} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="2"/>
      {/* Shell topes (top rim) */}
      <rect x="26" y={my - 6} width="128" height="10" rx="2" fill="#93C5FD" stroke="#1D4ED8" strokeWidth="1.5"/>
      <text x="90" y={my - 10} fill="#1D4ED8" fontSize="8" textAnchor="middle">Shell / Virola</text>
      {/* Ejes verticales */}
      {Array.from({ length: maxE }, (_, i) => {
        const x = 30 + (i + 1) * 120 / (maxE + 1)
        return (
          <g key={i}>
            <line x1={x} y1={my} x2={x} y2={my + mh} stroke="#93C5FD" strokeWidth="1" strokeDasharray="4,3"/>
            <text x={x} y={my + 10} fill="#1D4ED8" fontSize="8" fontWeight="bold" textAnchor="middle">E{i+1}</text>
          </g>
        )
      })}
      {/* Techo flotante */}
      <rect x="34" y={tfY - 5} width="112" height="10" rx="3"
        fill="#FDE68A" stroke="#B45309" strokeWidth="2"/>
      <text x="90" y={tfY + 3} fill="#92400E" fontSize="8" fontWeight="bold" textAnchor="middle">TECHO FLOTANTE</text>
      {/* Flecha indica flotación */}
      <text x="19" y={tfY + 4} fill="#B45309" fontSize="13" textAnchor="middle">↕</text>
      {/* Nivel producto */}
      <line x1="34" y1={tfY + 8} x2="146" y2={tfY + 8} stroke="#60A5FA" strokeWidth="1" strokeDasharray="3,2" opacity="0.7"/>
      {/* Pontones (esquemático) */}
      <rect x="36" y={tfY - 4} width="16" height="8" rx="2" fill="#F59E0B" stroke="#B45309" strokeWidth="1"/>
      <rect x="128" y={tfY - 4} width="16" height="8" rx="2" fill="#F59E0B" stroke="#B45309" strokeWidth="1"/>
      {/* Puntos P en el manto */}
      {Array.from({ length: maxP }, (_, i) => {
        const y = my + 14 + (i + 1) * (mh - 14) / (maxP + 1)
        return (
          <g key={i}>
            <line x1="22" y1={y} x2="30" y2={y} stroke="#1D4ED8" strokeWidth="1.5"/>
            <text x="20" y={y + 4} fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="end">P{i+1}</text>
          </g>
        )
      })}
      {/* Fondo */}
      <ellipse cx="90" cy={my + mh} rx="60" ry="13" fill="#BFDBFE" stroke="#1D4ED8" strokeWidth="2"/>
      <text x="90" y={my + mh + 22} fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">FONDO</text>
      {Array.from({ length: maxE }, (_, i) => {
        const x = 30 + (i + 1) * 120 / (maxE + 1)
        return <text key={i} x={x} y={my + mh + 14} fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">E{i+1}</text>
      })}
    </svg>
  )
}

const SVG_POR_TIPO = {
  vertical:       SvgVertical,
  horizontal:     SvgHorizontal,
  conico:         SvgConico,
  techo_flotante: SvgTechoFlotante,
}

// ── Componente principal ──────────────────────────────────────────────────
export function CroquisTanque({ data = {}, onChange }) {
  const tipo   = data.tipo_tanque  || 'vertical'
  const cfg    = TIPO_TK[tipo]     || TIPO_TK.vertical
  const SvgCmp = SVG_POR_TIPO[tipo] || SvgVertical

  const nP    = data.n_puntos || 6
  const nE    = data.n_ejes   || 4
  const manto = data.manto    || initGrid(nP, nE)
  const techo = data.techo    || Array(nE).fill('')
  const fondo = data.fondo    || Array(nE).fill('')

  function setTipo(t) {
    onChange({ ...data, tipo_tanque: t })
  }
  function setNP(v) {
    const n = Math.max(1, Math.min(20, parseInt(v) || 1))
    onChange({ ...data, n_puntos: n, manto: Array.from({ length: n }, (_, i) => manto[i] || Array(nE).fill('')) })
  }
  function setNE(v) {
    const n = Math.max(1, Math.min(12, parseInt(v) || 1))
    onChange({
      ...data, n_ejes: n,
      manto: manto.map(row => Array.from({ length: n }, (_, i) => row[i] || '')),
      techo: Array.from({ length: n }, (_, i) => techo[i] || ''),
      fondo: Array.from({ length: n }, (_, i) => fondo[i] || ''),
    })
  }
  function setCelda(zona, row, col, val) {
    if (zona === 'manto') {
      onChange({ ...data, manto: manto.map((r, i) => i === row ? r.map((c, j) => j === col ? val : c) : r) })
    } else {
      const arr = zona === 'techo' ? [...techo] : [...fondo]
      arr[col] = val
      onChange({ ...data, [zona]: arr })
    }
  }

  const colLabels  = Array.from({ length: nE }, (_, j) => cfg.colLabel(j))
  const filaLabels = Array.from({ length: nP }, (_, i) => cfg.filaLabel(i))
  const nominal    = parseFloat(data.espesor_nominal) || null
  const minimo     = parseFloat(data.espesor_minimo)  || null

  return (
    <div style={S.card}>
      <div style={S.title}>Control de Espesores — Ultrasonido Pulso-Eco (UT)</div>

      <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-start', marginBottom:20 }}>

        {/* SVG dinámico según tipo */}
        <div style={{ flex:'0 0 200px' }}>
          <SvgCmp nP={nP} nE={nE} />
          <p style={S.nota}>{cfg.nota}</p>
        </div>

        {/* Configuración */}
        <div style={{ flex:1, minWidth:260 }}>

          {/* Selector de tipo de tanque */}
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Tipo de tanque</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {Object.entries(TIPO_TK).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => setTipo(key)}
                  style={{
                    padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
                    cursor:'pointer', border:'1.5px solid',
                    borderColor:  tipo === key ? '#1D4ED8' : '#CBD5E1',
                    background:   tipo === key ? '#EFF6FF' : '#fff',
                    color:        tipo === key ? '#1D4ED8' : '#64748B',
                    transition:   'all .1s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parámetros numéricos */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:16 }}>
            <div>
              <label style={S.label}>{cfg.labelFilas}</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" min="1" max="20"
                value={nP} onChange={e => setNP(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>{cfg.labelCols}</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" min="1" max="12"
                value={nE} onChange={e => setNE(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Esp. nominal (mm)</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" step="0.1"
                value={data.espesor_nominal || ''} placeholder="ej: 6.35"
                onChange={e => onChange({ ...data, espesor_nominal: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>Esp. mínimo (mm)</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" step="0.1"
                value={data.espesor_minimo || ''} placeholder="ej: 5.0"
                onChange={e => onChange({ ...data, espesor_minimo: e.target.value })} />
            </div>
          </div>

          {/* Tabla zona SUPERIOR (Techo / Cabezal IZQ) — oculta en techo flotante */}
          {cfg.tieneSup && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'#1D4ED8', marginBottom:4 }}>{cfg.labelSup} (mm)</div>
              <div style={{ overflowX:'auto', marginBottom:12 }}>
                <table style={{ borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, minWidth:80 }}>Zona</th>
                      {colLabels.map(c => <th key={c} style={{ ...S.th, minWidth:72 }}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={S.tdLabel}>{cfg.labelSup}</td>
                      {colLabels.map((_, j) => (
                        <td key={j} style={S.td}>
                          <input style={{ ...S.input, width:68 }} type="number" step="0.1"
                            value={techo[j] || ''} placeholder="—"
                            onChange={e => setCelda('techo', 0, j, e.target.value)} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Tabla MANTO / CUERPO */}
          <div style={{ fontSize:11, fontWeight:700, color:'#1D4ED8', marginBottom:4 }}>
            {tipo === 'horizontal' ? 'Cuerpo — Generatrices (mm)' : 'Manto (mm)'}
          </div>
          <div style={{ overflowX:'auto', marginBottom:12 }}>
            <table style={{ borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth:80 }}>{cfg.labelFilas}</th>
                  {colLabels.map(c => <th key={c} style={{ ...S.th, minWidth:72 }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {filaLabels.map((fila, i) => {
                  const row = manto[i] || Array(nE).fill('')
                  return (
                    <tr key={i}>
                      <td style={S.tdLabel}>{fila}</td>
                      {colLabels.map((_, j) => {
                        const val  = parseFloat(row[j])
                        const bajo = !isNaN(val) && minimo && val < minimo
                        return (
                          <td key={j} style={{ ...S.td, background: bajo ? '#FEF2F2' : '#fff' }}>
                            <input
                              style={{ ...S.input, width:68, color: bajo ? '#DC2626' : '#1E293B', fontWeight: bajo ? 700 : 400 }}
                              type="number" step="0.1"
                              value={row[j] || ''} placeholder="—"
                              onChange={e => setCelda('manto', i, j, e.target.value)}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Tabla zona INFERIOR (Fondo / Cabezal DER / Cono) */}
          {cfg.tieneInf && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'#1D4ED8', marginBottom:4 }}>{cfg.labelInf} (mm)</div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, minWidth:80 }}>Zona</th>
                      {colLabels.map(c => <th key={c} style={{ ...S.th, minWidth:72 }}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={S.tdLabel}>{cfg.labelInf}</td>
                      {colLabels.map((_, j) => (
                        <td key={j} style={S.td}>
                          <input style={{ ...S.input, width:68 }} type="number" step="0.1"
                            value={fondo[j] || ''} placeholder="—"
                            onChange={e => setCelda('fondo', 0, j, e.target.value)} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {minimo && (
            <div style={{ marginTop:10, fontSize:11, color:'#DC2626', fontWeight:600 }}>
              Celdas en rojo = espesor bajo el minimo ({minimo} mm)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3. TUBERÍA — Isométrico + puntos configurables
// ════════════════════════════════════════════════════════════════════════════

export function CroquisTuberia({ data = {}, onChange }) {
  const puntos = data.puntos || [
    { id:'P1', zona:'Tramo recto', nominal:'', medido:'' },
    { id:'P2', zona:'Codo (extradós)', nominal:'', medido:'' },
    { id:'P3', zona:'Codo (intradós)', nominal:'', medido:'' },
  ]

  function setPunto(i, field, val) {
    const p = puntos.map((pt, j) => j === i ? { ...pt, [field]: val } : pt)
    onChange({ ...data, puntos: p })
  }
  function addPunto() {
    onChange({ ...data, puntos: [...puntos, { id:`P${puntos.length + 1}`, zona:'', nominal:'', medido:'' }] })
  }
  function removePunto(i) {
    onChange({ ...data, puntos: puntos.filter((_, j) => j !== i) })
  }

  return (
    <div style={S.card}>
      <div style={S.title}>Medición de Espesores — Tubería (UT Pulso-Eco)</div>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* SVG tubería — codo real v5: path relleno con extradós/intradós geométricamente correctos */}
        <div style={{ flex:'0 0 200px' }}>
          <svg viewBox="0 0 195 215" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:200 }}>
            {/*
              GEOMETRÍA DEL CODO 90°:
              Línea de centro horizontal: y=120, de x=12 a x=83
              Línea de centro vertical:   x=120, de y=18 a y=83
              Radio de codo (centroline): R=37
              Radio visual de la tubería: d=13  (diámetro visual = 26 px)
              Esquina interior del codo:  (83, 83)

              Arco EXTERIOR (extradós): centro (83,83), radio R+d=50
                Desde (83,133) hasta (133,83) — barrido CCW sweep=0

              Arco INTERIOR (intradós): centro (83,83), radio R-d=24
                Desde (107,83) hasta (83,107) — barrido CW sweep=1

              Path del cuerpo del codo:
                M 83,133  → inicio en pared inferior del tramo horizontal
                A 50,50 0 0 0 133,83  → arco exterior CCW hasta pared derecha del tramo vertical
                L 107,83  → cara de corte del tramo vertical (derecha → izquierda)
                A 24,24 0 0 1 83,107  → arco interior CW hasta pared superior del tramo horizontal
                Z → cierra: cara de corte del tramo horizontal (arriba → abajo)
            */}

            <defs>
              {/* Gradiente tubería horizontal: oscuro-claro-oscuro (efecto cilindro) */}
              <linearGradient id="tub_h" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#0F172A"/>
                <stop offset="18%"  stopColor="#334155"/>
                <stop offset="40%"  stopColor="#C4D4DF"/>
                <stop offset="56%"  stopColor="#8AABBE"/>
                <stop offset="80%"  stopColor="#334155"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </linearGradient>
              {/* Gradiente tubería vertical */}
              <linearGradient id="tub_v" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#0F172A"/>
                <stop offset="18%"  stopColor="#334155"/>
                <stop offset="40%"  stopColor="#C4D4DF"/>
                <stop offset="56%"  stopColor="#8AABBE"/>
                <stop offset="80%"  stopColor="#334155"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </linearGradient>
              {/* Gradiente codo: radial desde extradós (brillante) hacia esquina interior (oscuro) */}
              <radialGradient id="tub_codo" cx="75%" cy="75%" r="70%" gradientUnits="objectBoundingBox">
                <stop offset="0%"   stopColor="#C4D4DF"/>
                <stop offset="35%"  stopColor="#7A9BB0"/>
                <stop offset="65%"  stopColor="#334155"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </radialGradient>
            </defs>

            {/* ── TRAMO HORIZONTAL ── */}
            <rect x="12" y="107" width="71" height="26" fill="url(#tub_h)"/>
            <line x1="12" y1="107" x2="83" y2="107" stroke="#080E14" strokeWidth="1.2"/>
            <line x1="12" y1="133" x2="83" y2="133" stroke="#080E14" strokeWidth="1.2"/>

            {/* ── TRAMO VERTICAL ── */}
            <rect x="107" y="18" width="26" height="65" fill="url(#tub_v)"/>
            <line x1="107" y1="18" x2="107" y2="83" stroke="#080E14" strokeWidth="1.2"/>
            <line x1="133" y1="18" x2="133" y2="83" stroke="#080E14" strokeWidth="1.2"/>

            {/* ── CODO 90° — path relleno (extradós + intradós reales) ── */}
            <path
              d="M 83,133 A 50,50 0 0 0 133,83 L 107,83 A 24,24 0 0 1 83,107 Z"
              fill="url(#tub_codo)"
              stroke="#080E14"
              strokeWidth="1.5"
            />

            {/* ── TAPA IZQUIERDA (vista sección transversal) ── */}
            <ellipse cx="12" cy="120" rx="5" ry="13" fill="#2D3E4E" stroke="#080E14" strokeWidth="1.5"/>
            <ellipse cx="12" cy="120" rx="3.5" ry="9"   fill="#475569"/>
            <ellipse cx="12" cy="120" rx="2"   ry="5.5" fill="#050A0F"/>

            {/* ── TAPA SUPERIOR ── */}
            <ellipse cx="120" cy="18" rx="13" ry="5"   fill="#2D3E4E" stroke="#080E14" strokeWidth="1.5"/>
            <ellipse cx="120" cy="18" rx="9"  ry="3.5" fill="#475569"/>
            <ellipse cx="120" cy="18" rx="5.5" ry="2"  fill="#050A0F"/>

            {/* ── FLECHAS DE FLUJO ── */}
            <polygon points="22,117 31,120 22,123" fill="#8AABBE" opacity="0.8"/>
            <polygon points="117,28 120,18 123,28" fill="#8AABBE" opacity="0.8"/>

            {/* ── PUNTOS DE MEDICIÓN ── */}
            {/* P1: Tramo horizontal */}
            <circle cx="45" cy="120" r="9" fill="#1E3A5F"/>
            <text x="45" y="124" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P1</text>

            {/* P2: Extradós — sobre el arco exterior, ~45° desde esquina interior (83+35,83+35)≈(118,118) */}
            <line x1="118" y1="118" x2="130" y2="132" stroke="#fff" strokeWidth="1" opacity="0.5"/>
            <circle cx="138" cy="139" r="9" fill="#1E3A5F"/>
            <text x="138" y="143" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P2</text>

            {/* P3: Intradós — arco interior ~45° desde (83,83): (83+17,83+17)=(100,100) */}
            <line x1="100" y1="100" x2="91" y2="89" stroke="#fff" strokeWidth="1" opacity="0.5"/>
            <circle cx="85" cy="80" r="9" fill="#1E3A5F"/>
            <text x="85" y="84" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P3</text>

            {/* P4: Tramo vertical */}
            <circle cx="120" cy="50" r="9" fill="#1E3A5F"/>
            <text x="120" y="54" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P4</text>

            {/* ── LEYENDA ── */}
            <text x="8" y="155" fill="#475569" fontSize="10" fontWeight="700">Flujo →</text>
            <text x="8" y="168" fill="#64748B" fontSize="9">P1: Tramo recto</text>
            <text x="8" y="180" fill="#64748B" fontSize="9">P2: Extradós codo</text>
            <text x="8" y="192" fill="#64748B" fontSize="9">P3: Intradós codo</text>
            <text x="8" y="204" fill="#64748B" fontSize="9">P4: Tramo vertical</text>
          </svg>
          <p style={S.nota}>Puntos según API 570<br/>Unidades en mm</p>
        </div>

        {/* Tabla de puntos */}
        <div style={{ flex:1, minWidth:300 }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width:50 }}>Punto</th>
                  <th style={S.th}>Zona / Descripción</th>
                  <th style={{ ...S.th, width:100 }}>Nominal (mm)</th>
                  <th style={{ ...S.th, width:100 }}>Medido (mm)</th>
                  <th style={{ ...S.th, width:36 }}></th>
                </tr>
              </thead>
              <tbody>
                {puntos.map((pt, i) => {
                  const nom = parseFloat(pt.nominal)
                  const med = parseFloat(pt.medido)
                  const bajo = !isNaN(nom) && !isNaN(med) && med < nom * 0.875 // API 570: ≥ 87.5% del nominal
                  return (
                    <tr key={i}>
                      <td style={S.td}>
                        <input style={{ ...S.input, width:44, fontWeight:700 }}
                          value={pt.id} onChange={e => setPunto(i, 'id', e.target.value)} />
                      </td>
                      <td style={S.td}>
                        <input style={{ ...S.input, textAlign:'left' }}
                          value={pt.zona} onChange={e => setPunto(i, 'zona', e.target.value)}
                          placeholder="ej: Codo 90° extradós" />
                      </td>
                      <td style={S.td}>
                        <input style={{ ...S.input }} type="number" step="0.1"
                          value={pt.nominal} onChange={e => setPunto(i, 'nominal', e.target.value)}
                          placeholder="—" />
                      </td>
                      <td style={{ ...S.td, background: bajo ? '#FEF2F2' : '#fff' }}>
                        <input style={{ ...S.input, color: bajo ? '#DC2626' : '#1E293B', fontWeight: bajo ? 700 : 400 }}
                          type="number" step="0.1"
                          value={pt.medido} onChange={e => setPunto(i, 'medido', e.target.value)}
                          placeholder="—" />
                      </td>
                      <td style={{ ...S.td, textAlign:'center' }}>
                        <button onClick={() => removePunto(i)}
                          style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:14, padding:2 }}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
            <button onClick={addPunto} style={S.btnSec}>+ Agregar punto</button>
            <span style={{ fontSize:11, color:'#94A3B8' }}>
              🔴 Rojo = espesor &lt; 87.5% nominal (API 570)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 4. ESTRUCTURA / PLANCHA — Grilla de espesores UT
// ════════════════════════════════════════════════════════════════════════════

export function CroquisPlancha({ data = {}, onChange }) {
  const nFilas = data.n_filas  || 3
  const nCols  = data.n_cols   || 4
  const grid   = data.grid     || initGrid(nFilas, nCols)

  function setNF(v) {
    const n = Math.max(1, Math.min(15, parseInt(v) || 1))
    const g = Array.from({ length: n }, (_, i) => grid[i] || Array(nCols).fill(''))
    onChange({ ...data, n_filas: n, grid: g })
  }
  function setNC(v) {
    const n = Math.max(1, Math.min(15, parseInt(v) || 1))
    const g = grid.map(row => Array.from({ length: n }, (_, i) => row[i] || ''))
    onChange({ ...data, n_cols: n, grid: g })
  }
  function setCell(row, col, val) {
    const g = grid.map((r, i) => i === row ? r.map((c, j) => j === col ? val : c) : r)
    onChange({ ...data, grid: g })
  }

  const nominal = parseFloat(data.espesor_nominal) || null
  const minimo  = parseFloat(data.espesor_minimo)  || null

  return (
    <div style={S.card}>
      <div style={S.title}>Medición de Espesores — Estructura / Plancha (UT)</div>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* SVG plancha */}
        <div style={{ flex:'0 0 160px' }}>
          <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:160 }}>
            {/* Plancha principal */}
            <rect x="15" y="25" width="130" height="110" rx="4" fill="#FEF3C7" stroke="#92400E" strokeWidth="2"/>
            {/* Grid de puntos */}
            {[0,1,2].map(r => [0,1,2,3].map(c => (
              <g key={`${r}-${c}`}>
                <circle cx={35 + c * 30} cy={50 + r * 30} r="5" fill="#92400E"/>
                <text x={35 + c * 30} y={80 + r * 30 + 15} fill="#92400E" fontSize="8" textAnchor="middle">
                  {`F${r+1}C${c+1}`}
                </text>
              </g>
            )))}
            {/* Indicación de medición */}
            <path d="M 80 10 L 80 22" stroke="#92400E" strokeWidth="2" markerEnd="url(#arr)"/>
            <text x="80" y="8" fill="#92400E" fontSize="9" fontWeight="bold" textAnchor="middle">Sonda UT</text>
            {/* Espesor */}
            <path d="M 8 25 L 8 135" stroke="#92400E" strokeWidth="1.5" strokeDasharray="3,2"/>
            <text x="6" y="85" fill="#92400E" fontSize="8" fontWeight="bold" textAnchor="middle"
              transform="rotate(-90 6 85)">Espesor (t)</text>
          </svg>
          <p style={S.nota}>Grilla configurable<br/>Unidades en mm</p>
        </div>

        {/* Config + grilla */}
        <div style={{ flex:1, minWidth:280 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:14 }}>
            <div>
              <label style={S.label}>Filas</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" min="1" max="15"
                value={nFilas} onChange={e => setNF(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Columnas</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" min="1" max="15"
                value={nCols} onChange={e => setNC(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Esp. nominal (mm)</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" step="0.1"
                value={data.espesor_nominal || ''} placeholder="ej: 8.0"
                onChange={e => onChange({ ...data, espesor_nominal: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>Esp. mínimo (mm)</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" step="0.1"
                value={data.espesor_minimo || ''} placeholder="ej: 6.5"
                onChange={e => onChange({ ...data, espesor_minimo: e.target.value })} />
            </div>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth:50 }}>Punto</th>
                  {Array.from({ length: nCols }, (_, j) => (
                    <th key={j} style={{ ...S.th, minWidth:72 }}>C{j + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: nFilas }, (_, i) => {
                  const row = grid[i] || Array(nCols).fill('')
                  return (
                    <tr key={i}>
                      <td style={S.tdLabel}>F{i + 1}</td>
                      {Array.from({ length: nCols }, (_, j) => {
                        const val = parseFloat(row[j])
                        const bajo = !isNaN(val) && minimo && val < minimo
                        return (
                          <td key={j} style={{ ...S.td, background: bajo ? '#FEF2F2' : '#fff' }}>
                            <input
                              style={{ ...S.input, width:68, color: bajo ? '#DC2626' : '#1E293B', fontWeight: bajo ? 700 : 400 }}
                              type="number" step="0.1"
                              value={row[j] || ''}
                              onChange={e => setCell(i, j, e.target.value)}
                              placeholder="—"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {minimo && (
            <div style={{ marginTop:8, fontSize:11, color:'#DC2626', fontWeight:600 }}>
              🔴 Celdas en rojo = espesor bajo el mínimo ({minimo} mm)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 5. SPOOL — Isométrico prefabricado con flanges y codo real
// ════════════════════════════════════════════════════════════════════════════

export function CroquisSpool({ data = {}, onChange }) {
  const puntos = data.puntos || [
    { id:'P1', zona:'Tramo horizontal', nominal:'', medido:'' },
    { id:'P2', zona:'Extradós codo',    nominal:'', medido:'' },
    { id:'P3', zona:'Intradós codo',    nominal:'', medido:'' },
    { id:'P4', zona:'Tramo vertical',   nominal:'', medido:'' },
  ]

  function setPunto(i, field, val) {
    const p = puntos.map((pt, j) => j === i ? { ...pt, [field]: val } : pt)
    onChange({ ...data, puntos: p })
  }
  function addPunto() {
    onChange({ ...data, puntos: [...puntos, { id:`P${puntos.length + 1}`, zona:'', nominal:'', medido:'' }] })
  }
  function removePunto(i) {
    onChange({ ...data, puntos: puntos.filter((_, j) => j !== i) })
  }

  return (
    <div style={S.card}>
      <div style={S.title}>Medición de Espesores — Spool (UT Pulso-Eco)</div>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* SVG Spool con flanges y codo real */}
        <div style={{ flex:'0 0 210px' }}>
          <svg viewBox="0 0 210 215" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:210 }}>
            {/*
              SPOOL N°1 — Geometría:
              Línea de centro horizontal: y=130, de x=30 a x=113
              Línea de centro vertical:   x=153, de y=48 a y=90
              Codo 90°: esquina interior (113, 90), R=40, d=10
              Arco exterior (R+d=50): (113,140) → (163,90), CCW sweep=0
              Arco interior (R-d=30): (143,90) → (113,120), CW sweep=1

              Bridas: raised-face, con 4 agujeros de perno
                Brida izquierda: x=12–29, cy=130, OD±22
                Brida superior:  y=36–50, cx=153, OD±22
            */}

            <defs>
              <linearGradient id="sp_h" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#0F172A"/>
                <stop offset="20%"  stopColor="#334155"/>
                <stop offset="42%"  stopColor="#C4D4DF"/>
                <stop offset="58%"  stopColor="#8AABBE"/>
                <stop offset="80%"  stopColor="#334155"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </linearGradient>
              <linearGradient id="sp_v" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#0F172A"/>
                <stop offset="20%"  stopColor="#334155"/>
                <stop offset="42%"  stopColor="#C4D4DF"/>
                <stop offset="58%"  stopColor="#8AABBE"/>
                <stop offset="80%"  stopColor="#334155"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </linearGradient>
              <radialGradient id="sp_codo" cx="75%" cy="75%" r="70%" gradientUnits="objectBoundingBox">
                <stop offset="0%"   stopColor="#C4D4DF"/>
                <stop offset="38%"  stopColor="#7A9BB0"/>
                <stop offset="68%"  stopColor="#334155"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </radialGradient>
              <linearGradient id="sp_fl_v" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#0F172A"/>
                <stop offset="28%"  stopColor="#4A6878"/>
                <stop offset="52%"  stopColor="#8AABBE"/>
                <stop offset="75%"  stopColor="#4A6878"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </linearGradient>
              <linearGradient id="sp_fl_h" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#0F172A"/>
                <stop offset="28%"  stopColor="#4A6878"/>
                <stop offset="52%"  stopColor="#8AABBE"/>
                <stop offset="75%"  stopColor="#4A6878"/>
                <stop offset="100%" stopColor="#0F172A"/>
              </linearGradient>
            </defs>

            {/* ── BRIDA IZQUIERDA (raised-face) ── */}
            <rect x="12" y="108" width="18" height="44" rx="1"
              fill="url(#sp_fl_v)" stroke="#080E14" strokeWidth="1.5"/>
            {/* Cara levantada (raised face) */}
            <rect x="13.5" y="118" width="15" height="24"
              fill="#6B8BA0" stroke="#080E14" strokeWidth="0.8"/>
            {/* 4 pernos */}
            {[111,119,141,149].map(cy => (
              <circle key={cy} cx="21" cy={cy} r="2.5" fill="#080E14"/>
            ))}
            {/* Vista de cara / bore */}
            <ellipse cx="12" cy="130" rx="4.5" ry="22" fill="#2D3E4E" stroke="#080E14" strokeWidth="1.5"/>
            <ellipse cx="12" cy="130" rx="3"   ry="16" fill="#475569"/>
            <ellipse cx="12" cy="130" rx="1.8" ry="10" fill="#050A0F"/>

            {/* ── TRAMO HORIZONTAL ── */}
            <rect x="30" y="120" width="83" height="20" fill="url(#sp_h)"/>
            <line x1="30" y1="120" x2="113" y2="120" stroke="#080E14" strokeWidth="1"/>
            <line x1="30" y1="140" x2="113" y2="140" stroke="#080E14" strokeWidth="1"/>

            {/* ── TRAMO VERTICAL ── */}
            <rect x="143" y="50" width="20" height="40" fill="url(#sp_v)"/>
            <line x1="143" y1="50" x2="143" y2="90" stroke="#080E14" strokeWidth="1"/>
            <line x1="163" y1="50" x2="163" y2="90" stroke="#080E14" strokeWidth="1"/>

            {/* ── CODO 90° real — path relleno ──
                Esquina interior: (113, 90)
                Outer arc r=50: (113,140)→(163,90) CCW sweep=0
                Inner arc r=30: (143,90)→(113,120) CW sweep=1  */}
            <path
              d="M 113,140 A 50,50 0 0 0 163,90 L 143,90 A 30,30 0 0 1 113,120 Z"
              fill="url(#sp_codo)"
              stroke="#080E14"
              strokeWidth="1.5"
            />

            {/* ── BRIDA SUPERIOR (raised-face) ── */}
            <rect x="131" y="36" width="44" height="14" rx="1"
              fill="url(#sp_fl_h)" stroke="#080E14" strokeWidth="1.5"/>
            {/* Cara levantada */}
            <rect x="141" y="37.5" width="24" height="11"
              fill="#6B8BA0" stroke="#080E14" strokeWidth="0.8"/>
            {/* 4 pernos */}
            {[134,142,164,172].map(cx => (
              <circle key={cx} cx={cx} cy="43" r="2.5" fill="#080E14"/>
            ))}
            {/* Vista de cara / bore */}
            <ellipse cx="153" cy="36" rx="22" ry="4.5" fill="#2D3E4E" stroke="#080E14" strokeWidth="1.5"/>
            <ellipse cx="153" cy="36" rx="16" ry="3"   fill="#475569"/>
            <ellipse cx="153" cy="36" rx="10" ry="1.8" fill="#050A0F"/>

            {/* ── FLECHAS DE FLUJO ── */}
            <polygon points="40,127 50,130 40,133" fill="#8AABBE" opacity="0.8"/>
            <polygon points="150,58 153,48 156,58" fill="#8AABBE" opacity="0.8"/>

            {/* ── PUNTOS DE MEDICIÓN ── */}
            {/* P1: horizontal */}
            <circle cx="70" cy="130" r="9" fill="#1E3A5F"/>
            <text x="70" y="134" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P1</text>
            {/* P2: extradós (113+35,90+35)=(148,125) */}
            <line x1="147" y1="124" x2="160" y2="138" stroke="#fff" strokeWidth="1" opacity="0.5"/>
            <circle cx="168" cy="145" r="9" fill="#1E3A5F"/>
            <text x="168" y="149" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P2</text>
            {/* P3: intradós (113+21,90+21)=(134,111), label arriba-izq */}
            <line x1="132" y1="109" x2="122" y2="99" stroke="#fff" strokeWidth="1" opacity="0.5"/>
            <circle cx="116" cy="92" r="9" fill="#1E3A5F"/>
            <text x="116" y="96" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P3</text>
            {/* P4: vertical */}
            <circle cx="153" cy="68" r="9" fill="#1E3A5F"/>
            <text x="153" y="72" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P4</text>

            {/* ── ETIQUETAS TÉCNICAS ── */}
            <text x="8"  y="162" fill="#475569" fontSize="9.5" fontWeight="700">Spool N°1</text>
            <text x="8"  y="175" fill="#64748B" fontSize="8.5">Mat: A106-B · Sch 40</text>
            <text x="8"  y="187" fill="#64748B" fontSize="8.5">OD: 168.3 mm · WT: 7.11 mm</text>
            <text x="8"  y="200" fill="#64748B" fontSize="8.5">Bridas: ASME B16.5 · 150 lb RF</text>
            <text x="8"  y="211" fill="#94A3B8" fontSize="7.5" fontStyle="italic">Ref: ISO 15614</text>

            {/* Etiquetas bridas */}
            <text x="10" y="98" fill="#64748B" fontSize="7.5" textAnchor="middle">BRIDA</text>
            <text x="10" y="107" fill="#64748B" fontSize="7.5" textAnchor="middle">RF</text>
            <text x="153" y="26" fill="#64748B" fontSize="7.5" textAnchor="middle">BRIDA RF</text>
          </svg>
          <p style={S.nota}>Puntos según API 570<br/>Unidades en mm</p>
        </div>

        {/* Tabla de puntos */}
        <div style={{ flex:1, minWidth:300 }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width:50 }}>Punto</th>
                  <th style={S.th}>Zona / Descripción</th>
                  <th style={{ ...S.th, width:100 }}>Nominal (mm)</th>
                  <th style={{ ...S.th, width:100 }}>Medido (mm)</th>
                  <th style={{ ...S.th, width:36 }}></th>
                </tr>
              </thead>
              <tbody>
                {puntos.map((pt, i) => {
                  const nom = parseFloat(pt.nominal)
                  const med = parseFloat(pt.medido)
                  const bajo = !isNaN(nom) && !isNaN(med) && med < nom * 0.875
                  return (
                    <tr key={i}>
                      <td style={S.td}>
                        <input style={{ ...S.input, width:44, fontWeight:700 }}
                          value={pt.id} onChange={e => setPunto(i, 'id', e.target.value)} />
                      </td>
                      <td style={S.td}>
                        <input style={{ ...S.input, textAlign:'left' }}
                          value={pt.zona} onChange={e => setPunto(i, 'zona', e.target.value)}
                          placeholder="ej: Codo 90° extradós" />
                      </td>
                      <td style={S.td}>
                        <input style={{ ...S.input }} type="number" step="0.1"
                          value={pt.nominal} onChange={e => setPunto(i, 'nominal', e.target.value)}
                          placeholder="—" />
                      </td>
                      <td style={{ ...S.td, background: bajo ? '#FEF2F2' : '#fff' }}>
                        <input style={{ ...S.input, color: bajo ? '#DC2626' : '#1E293B', fontWeight: bajo ? 700 : 400 }}
                          type="number" step="0.1"
                          value={pt.medido} onChange={e => setPunto(i, 'medido', e.target.value)}
                          placeholder="—" />
                      </td>
                      <td style={{ ...S.td, textAlign:'center' }}>
                        <button onClick={() => removePunto(i)}
                          style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:14, padding:2 }}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
            <button onClick={addPunto} style={S.btnSec}>+ Agregar punto</button>
            <span style={{ fontSize:11, color:'#94A3B8' }}>
              🔴 Rojo = espesor &lt; 87.5% nominal (API 570)
            </span>
          </div>
          <div style={{ marginTop:10, padding:'8px 12px', background:'#F0FDF4', borderRadius:8, border:'1px solid #BBF7D0', fontSize:11, color:'#166534' }}>
            <b>Nota:</b> Datos de especificación (Mat/OD/WT) son editables en el encabezado del informe.
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6. Selector principal — elige el croquis según tipo
// ════════════════════════════════════════════════════════════════════════════

export default function CroquisEquipo({ tipo, tipoIzaje, data = {}, onChange }) {
  if (tipo === 'IZAJE' && ['Gancho','Grillete','Grillete conector','Cáncamo Giratorio','Cáncamo Fijo'].includes(tipoIzaje)) {
    return <CroquisGancho data={data.control_dim || {}} onChange={v => onChange({ ...data, control_dim: v })} />
  }
  if (tipo === 'TANQUE') {
    return <CroquisTanque data={data.mediciones_ut || {}} onChange={v => onChange({ ...data, mediciones_ut: v })} />
  }
  if (tipo === 'TUBERIA') {
    return <CroquisTuberia data={data.mediciones_ut || {}} onChange={v => onChange({ ...data, mediciones_ut: v })} />
  }
  if (tipo === 'SPOOL') {
    return <CroquisSpool data={data.mediciones_ut || {}} onChange={v => onChange({ ...data, mediciones_ut: v })} />
  }
  if (tipo === 'ESTRUCTURA') {
    return <CroquisPlancha data={data.mediciones_ut || {}} onChange={v => onChange({ ...data, mediciones_ut: v })} />
  }
  return null
}
