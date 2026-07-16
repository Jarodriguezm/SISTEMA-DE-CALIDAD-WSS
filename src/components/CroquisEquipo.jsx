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
// 2. TANQUE — Grilla UT configurable P × E + techo + fondo
// ════════════════════════════════════════════════════════════════════════════

function initGrid(nP, nE) {
  return Array.from({ length: nP }, () => Array(nE).fill(''))
}

export function CroquisTanque({ data = {}, onChange }) {
  const nP     = data.n_puntos   || 6
  const nE     = data.n_ejes     || 4
  const manto  = data.manto      || initGrid(nP, nE)
  const techo  = data.techo      || Array(nE).fill('')
  const fondo  = data.fondo      || Array(nE).fill('')

  function setNP(v) {
    const n = Math.max(1, Math.min(20, parseInt(v) || 1))
    const newManto = Array.from({ length: n }, (_, i) => manto[i] || Array(nE).fill(''))
    onChange({ ...data, n_puntos: n, manto: newManto })
  }
  function setNE(v) {
    const n = Math.max(1, Math.min(12, parseInt(v) || 1))
    const newManto = manto.map(row => Array.from({ length: n }, (_, i) => row[i] || ''))
    const newTecho = Array.from({ length: n }, (_, i) => techo[i] || '')
    const newFondo = Array.from({ length: n }, (_, i) => fondo[i] || '')
    onChange({ ...data, n_ejes: n, manto: newManto, techo: newTecho, fondo: newFondo })
  }
  function setCelda(zona, row, col, val) {
    if (zona === 'manto') {
      const m = manto.map((r, i) => i === row ? r.map((c, j) => j === col ? val : c) : r)
      onChange({ ...data, manto: m })
    } else {
      const arr = zona === 'techo' ? [...techo] : [...fondo]
      arr[col] = val
      onChange({ ...data, [zona]: arr })
    }
  }
  function setEspesorNominal(v) { onChange({ ...data, espesor_nominal: v }) }
  function setEspesorMinimo(v)  { onChange({ ...data, espesor_minimo: v }) }

  const ejeLabels = Array.from({ length: nE }, (_, i) => `E${i + 1}`)
  const pLabels   = Array.from({ length: nP }, (_, i) => `P${i + 1}`)

  return (
    <div style={S.card}>
      <div style={S.title}>Control de Espesores — Ultrasonido Pulso-Eco (UT)</div>

      <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-start', marginBottom:20 }}>

        {/* SVG tanque cilíndrico */}
        <div style={{ flex:'0 0 180px' }}>
          <svg viewBox="0 0 180 260" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:180 }}>
            {/* Techo */}
            <ellipse cx="90" cy="38" rx="60" ry="14" fill="#BFDBFE" stroke="#1D4ED8" strokeWidth="2"/>
            <text x="90" y="30" fill="#1D4ED8" fontSize="10" fontWeight="bold" textAnchor="middle">TECHO</text>
            {/* Manto */}
            <rect x="30" y="38" width="120" height="170" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="2"/>
            {/* Ejes verticales en el manto */}
            {[0,1,2,3].slice(0,nE).map((_, i) => {
              const x = 30 + (i + 1) * 120 / (nE + 1)
              return (
                <g key={i}>
                  <line x1={x} y1="38" x2={x} y2="208" stroke="#93C5FD" strokeWidth="1" strokeDasharray="4,3"/>
                  <text x={x} y="34" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">{`E${i+1}`}</text>
                </g>
              )
            })}
            {/* Puntos P en el manto */}
            {Array.from({ length: Math.min(nP, 8) }, (_, i) => {
              const y = 38 + (i + 1) * 170 / (Math.min(nP, 8) + 1)
              return (
                <g key={i}>
                  <line x1="25" y1={y} x2="30" y2={y} stroke="#1D4ED8" strokeWidth="1.5"/>
                  <text x="22" y={y + 4} fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="end">{`P${i+1}`}</text>
                </g>
              )
            })}
            {/* Fondo */}
            <ellipse cx="90" cy="208" rx="60" ry="14" fill="#BFDBFE" stroke="#1D4ED8" strokeWidth="2"/>
            <text x="90" y="232" fill="#1D4ED8" fontSize="10" fontWeight="bold" textAnchor="middle">FONDO</text>
            {/* Etiquetas Ejes abajo */}
            {[0,1,2,3].slice(0,nE).map((_, i) => {
              const x = 30 + (i + 1) * 120 / (nE + 1)
              return <text key={i} x={x} y="225" fill="#1D4ED8" fontSize="9" fontWeight="bold" textAnchor="middle">{`E${i+1}`}</text>
            })}
          </svg>
          <p style={S.nota}>Técnica: pulso-eco<br/>Unidades en mm</p>
        </div>

        {/* Configuración */}
        <div style={{ flex:1, minWidth:260 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:16 }}>
            <div>
              <label style={S.label}>Puntos (P)</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" min="1" max="20"
                value={nP} onChange={e => setNP(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Ejes (E)</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" min="1" max="12"
                value={nE} onChange={e => setNE(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Esp. nominal (mm)</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" step="0.1"
                value={data.espesor_nominal || ''} onChange={e => setEspesorNominal(e.target.value)}
                placeholder="ej: 6.35" />
            </div>
            <div>
              <label style={S.label}>Esp. mínimo (mm)</label>
              <input style={{ ...S.input, textAlign:'left' }} type="number" step="0.1"
                value={data.espesor_minimo || ''} onChange={e => setEspesorMinimo(e.target.value)}
                placeholder="ej: 5.0" />
            </div>
          </div>

          {/* Tabla TECHO */}
          <div style={{ fontSize:11, fontWeight:700, color:'#1D4ED8', marginBottom:4 }}>Techo (mm)</div>
          <div style={{ overflowX:'auto', marginBottom:12 }}>
            <table style={{ borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth:60 }}>Zona</th>
                  {ejeLabels.map(e => <th key={e} style={{ ...S.th, minWidth:72 }}>{e}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={S.tdLabel}>Techo</td>
                  {ejeLabels.map((_, j) => (
                    <td key={j} style={S.td}>
                      <input style={{ ...S.input, width:68 }} type="number" step="0.1"
                        value={techo[j] || ''} onChange={e => setCelda('techo', 0, j, e.target.value)}
                        placeholder="—" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tabla MANTO */}
          <div style={{ fontSize:11, fontWeight:700, color:'#1D4ED8', marginBottom:4 }}>Manto (mm)</div>
          <div style={{ overflowX:'auto', marginBottom:12 }}>
            <table style={{ borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth:60 }}>Puntos</th>
                  {ejeLabels.map(e => <th key={e} style={{ ...S.th, minWidth:72 }}>{e}</th>)}
                </tr>
              </thead>
              <tbody>
                {pLabels.map((p, i) => {
                  const row = manto[i] || Array(nE).fill('')
                  const nominal = parseFloat(data.espesor_nominal) || null
                  const minimo  = parseFloat(data.espesor_minimo)  || null
                  return (
                    <tr key={i}>
                      <td style={S.tdLabel}>{p}</td>
                      {ejeLabels.map((_, j) => {
                        const val = parseFloat(row[j])
                        const bajo = !isNaN(val) && minimo && val < minimo
                        return (
                          <td key={j} style={{ ...S.td, background: bajo ? '#FEF2F2' : '#fff' }}>
                            <input
                              style={{ ...S.input, width:68, color: bajo ? '#DC2626' : '#1E293B', fontWeight: bajo ? 700 : 400 }}
                              type="number" step="0.1"
                              value={row[j] || ''}
                              onChange={e => setCelda('manto', i, j, e.target.value)}
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

          {/* Tabla FONDO */}
          <div style={{ fontSize:11, fontWeight:700, color:'#1D4ED8', marginBottom:4 }}>Fondo (mm)</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth:60 }}>Zona</th>
                  {ejeLabels.map(e => <th key={e} style={{ ...S.th, minWidth:72 }}>{e}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={S.tdLabel}>Fondo</td>
                  {ejeLabels.map((_, j) => (
                    <td key={j} style={S.td}>
                      <input style={{ ...S.input, width:68 }} type="number" step="0.1"
                        value={fondo[j] || ''} onChange={e => setCelda('fondo', 0, j, e.target.value)}
                        placeholder="—" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {data.espesor_minimo && (
            <div style={{ marginTop:10, fontSize:11, color:'#DC2626', fontWeight:600 }}>
              🔴 Celdas en rojo = espesor bajo el mínimo ({data.espesor_minimo} mm)
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

        {/* SVG tubería — croquis técnico v3 */}
        <div style={{ flex:'0 0 200px' }}>
          <svg viewBox="0 0 195 215" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:200 }}>

            {/*
              TÉCNICA: tuberías como trazo grueso, paleta gris acero.
              Tramo horizontal: y=120, de x=12 a x=83
              Codo 90°: arco radio=37, centro (120,120), de (83,120) a (120,83)
              Tramo vertical: x=120, de y=83 a y=18
            */}

            {/* ── BORDE EXTERIOR (sombra) ── */}
            <line x1="12" y1="120" x2="83" y2="120"
              fill="none" stroke="#1E293B" strokeWidth="26" strokeLinecap="square"/>
            <path d="M 83,120 A 37,37 0 0 1 120,83"
              fill="none" stroke="#1E293B" strokeWidth="26" strokeLinecap="round"/>
            <line x1="120" y1="83" x2="120" y2="18"
              fill="none" stroke="#1E293B" strokeWidth="26" strokeLinecap="square"/>

            {/* ── CUERPO DE LA TUBERÍA (gris acero) ── */}
            <line x1="12" y1="120" x2="83" y2="120"
              fill="none" stroke="#64748B" strokeWidth="22" strokeLinecap="square"/>
            <path d="M 83,120 A 37,37 0 0 1 120,83"
              fill="none" stroke="#64748B" strokeWidth="22" strokeLinecap="round"/>
            <line x1="120" y1="83" x2="120" y2="18"
              fill="none" stroke="#64748B" strokeWidth="22" strokeLinecap="square"/>

            {/* ── RESALTE SUPERIOR/LATERAL (efecto cilindro) ── */}
            <line x1="12" y1="112" x2="83" y2="112"
              fill="none" stroke="#CBD5E1" strokeWidth="8" strokeLinecap="square" opacity="0.75"/>
            <path d="M 83,112 A 29,29 0 0 1 112,83"
              fill="none" stroke="#CBD5E1" strokeWidth="8" strokeLinecap="round" opacity="0.75"/>
            <line x1="112" y1="83" x2="112" y2="18"
              fill="none" stroke="#CBD5E1" strokeWidth="8" strokeLinecap="square" opacity="0.75"/>

            {/* ── TAPAS (sección transversal en los extremos) ── */}
            {/* Tapa izquierda */}
            <ellipse cx="12" cy="120" rx="5" ry="11" fill="#94A3B8" stroke="#1E293B" strokeWidth="1.5"/>
            {/* Tapa superior */}
            <ellipse cx="120" cy="18" rx="11" ry="5" fill="#94A3B8" stroke="#1E293B" strokeWidth="1.5"/>

            {/* ── PUNTOS DE MEDICIÓN ── */}
            {/* P1: Tramo horizontal */}
            <circle cx="45" cy="120" r="9" fill="#1E3A5F" stroke="#fff" strokeWidth="2"/>
            <text x="45" y="124" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P1</text>

            {/* P2: Extradós del codo */}
            <circle cx="86" cy="99" r="9" fill="#1E3A5F" stroke="#fff" strokeWidth="2"/>
            <text x="86" y="103" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P2</text>

            {/* P3: Intradós del codo */}
            <circle cx="107" cy="116" r="9" fill="#1E3A5F" stroke="#fff" strokeWidth="2"/>
            <text x="107" y="120" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P3</text>

            {/* P4: Tramo vertical */}
            <circle cx="120" cy="52" r="9" fill="#1E3A5F" stroke="#fff" strokeWidth="2"/>
            <text x="120" y="56" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P4</text>

            {/* ── FLECHAS DE FLUJO ── */}
            <polygon points="22,117 31,120 22,123" fill="#CBD5E1" opacity="0.9"/>
            <polygon points="117,31 120,22 123,31" fill="#CBD5E1" opacity="0.9"/>

            {/* ── LEYENDA ── */}
            <text x="8" y="150" fill="#475569" fontSize="10" fontWeight="700">Flujo →</text>
            <text x="8" y="164" fill="#64748B" fontSize="9">P1: Tramo recto</text>
            <text x="8" y="176" fill="#64748B" fontSize="9">P2: Extradós codo</text>
            <text x="8" y="188" fill="#64748B" fontSize="9">P3: Intradós codo</text>
            <text x="8" y="200" fill="#64748B" fontSize="9">P4: Tramo vertical</text>
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
// 5. Selector principal — elige el croquis según tipo
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
  if (tipo === 'ESTRUCTURA') {
    return <CroquisPlancha data={data.mediciones_ut || {}} onChange={v => onChange({ ...data, mediciones_ut: v })} />
  }
  return null
}
