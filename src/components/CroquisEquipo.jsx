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

        {/* SVG gancho */}
        <div style={{ flex:'0 0 200px' }}>
          <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:200 }}>
            {/* ── Cuerpo del gancho ── */}
            {/* Vástago / base superior */}
            <rect x="82" y="10" width="36" height="55" rx="4" fill="#CBD5E1" stroke="#475569" strokeWidth="2"/>
            {/* Cuello */}
            <rect x="88" y="63" width="24" height="20" rx="2" fill="#94A3B8" stroke="#475569" strokeWidth="1.5"/>
            {/* Cuerpo curvo — arco principal */}
            <path d="M 88 83 Q 88 130 105 150 Q 122 170 140 155 Q 160 138 155 115 Q 150 95 135 90"
                  fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round"/>
            {/* Pestillo de seguridad */}
            <path d="M 98 115 Q 88 108 82 118 Q 76 128 85 135"
                  fill="none" stroke="#334155" strokeWidth="5" strokeLinecap="round"/>

            {/* ── Cotas ── */}
            {/* A: Abertura garganta */}
            <line x1="85" y1="108" x2="137" y2="108" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="4,2"/>
            <line x1="85" y1="104" x2="85" y2="112" stroke="#DC2626" strokeWidth="1.5"/>
            <line x1="137" y1="104" x2="137" y2="112" stroke="#DC2626" strokeWidth="1.5"/>
            <circle cx="50" cy="108" r="10" fill="#DC2626"/>
            <text x="50" y="113" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">A</text>
            <line x1="60" y1="108" x2="85" y2="108" stroke="#DC2626" strokeWidth="1"/>

            {/* B: Altura base (vástago) */}
            <line x1="128" y1="10" x2="128" y2="82" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="4,2"/>
            <line x1="124" y1="10" x2="132" y2="10" stroke="#2563EB" strokeWidth="1.5"/>
            <line x1="124" y1="82" x2="132" y2="82" stroke="#2563EB" strokeWidth="1.5"/>
            <circle cx="160" cy="46" r="10" fill="#2563EB"/>
            <text x="160" y="51" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">B</text>
            <line x1="128" y1="46" x2="150" y2="46" stroke="#2563EB" strokeWidth="1"/>

            {/* C: Ancho base */}
            <line x1="82" y1="195" x2="118" y2="195" stroke="#059669" strokeWidth="1.5" strokeDasharray="4,2"/>
            <line x1="82" y1="191" x2="82" y2="199" stroke="#059669" strokeWidth="1.5"/>
            <line x1="118" y1="191" x2="118" y2="199" stroke="#059669" strokeWidth="1.5"/>
            <circle cx="100" cy="218" r="10" fill="#059669"/>
            <text x="100" y="223" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">C</text>
            <line x1="100" y1="195" x2="100" y2="208" stroke="#059669" strokeWidth="1"/>
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

        {/* SVG Isométrico tubería */}
        <div style={{ flex:'0 0 200px' }}>
          <svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', maxWidth:200 }}>
            {/* Tramo horizontal izquierdo */}
            <rect x="10" y="88" width="70" height="24" rx="3" fill="#D1FAE5" stroke="#047857" strokeWidth="2"/>
            {/* Codo superior */}
            <path d="M 80 100 Q 100 100 100 80" fill="none" stroke="#047857" strokeWidth="24" strokeLinecap="round"/>
            <path d="M 80 100 Q 100 100 100 80" fill="none" stroke="#D1FAE5" strokeWidth="18" strokeLinecap="round"/>
            {/* Tramo vertical */}
            <rect x="88" y="20" width="24" height="62" rx="3" fill="#D1FAE5" stroke="#047857" strokeWidth="2"/>
            {/* Codo inferior */}
            <path d="M 80 100 Q 100 100 100 120" fill="none" stroke="#047857" strokeWidth="24" strokeLinecap="round"/>
            <path d="M 80 100 Q 100 100 100 120" fill="none" stroke="#D1FAE5" strokeWidth="18" strokeLinecap="round"/>
            {/* Tramo horizontal derecho */}
            <rect x="100" y="108" width="88" height="24" rx="3" fill="#D1FAE5" stroke="#047857" strokeWidth="2"/>

            {/* Puntos de medición */}
            {/* P1 en tramo recto izquierdo */}
            <circle cx="40" cy="100" r="8" fill="#047857"/>
            <text x="40" y="104" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P1</text>
            {/* P2 en codo extradós */}
            <circle cx="78" cy="78" r="8" fill="#059669"/>
            <text x="78" y="82" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P2</text>
            {/* P3 en codo intradós */}
            <circle cx="100" cy="100" r="8" fill="#10B981"/>
            <text x="100" y="104" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P3</text>
            {/* P4 en tramo recto derecho */}
            <circle cx="150" cy="120" r="8" fill="#047857"/>
            <text x="150" y="124" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">P4</text>

            {/* Flechas de flujo */}
            <path d="M 22 97 L 30 100 L 22 103" fill="#047857"/>
            <path d="M 110 107 L 118 120 L 113 117" fill="#047857"/>
            <text x="20" y="150" fill="#047857" fontSize="10" fontWeight="bold">→ Flujo</text>

            {/* Leyenda */}
            <text x="10" y="175" fill="#475569" fontSize="9">Medir en:</text>
            <text x="10" y="187" fill="#475569" fontSize="9">· Tramos rectos</text>
            <text x="10" y="199" fill="#475569" fontSize="9">· Extradós e intradós</text>
            <text x="10" y="211" fill="#475569" fontSize="9">· Tees y reducciones</text>
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
