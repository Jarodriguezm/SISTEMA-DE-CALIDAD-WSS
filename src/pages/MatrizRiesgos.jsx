// ============================================================
// MatrizRiesgos.jsx — Página PÚBLICA (sin login)
// URL: /matriz-riesgos
// Se enlaza desde las cotizaciones para que el cliente
// verifique la MIPER vigente de WSS.
// ============================================================
import { useEffect } from 'react'

const PDF = '/docs/matriz-riesgos-wss.pdf'

const DOC = {
  codigo:      'REG-SEG-062',
  revision:    'Rev. 01',
  emision:     '12-09-2025',
  actualizado: '24-07-2026',
  empresa:     'World Survey Services Chile S.A.',
  division:    'Inspecciones Industriales',
  elaborado:   'Claudio López A. — Jefe de Departamento',
  aprobado:    'José Rodríguez M. — Jefe de División Inspecciones Industriales',
}

const KPIS = [
  { n: '30',  t: 'Riesgos evaluados',        d: 'Peligros identificados y valorados' },
  { n: '14',  t: 'Clasificados Alto',        d: 'En condición de riesgo puro, sin control' },
  { n: '0',   t: 'Alto tras control',        d: 'Ninguno permanece en nivel Alto', ok: true },
  { n: '100%','t': 'En nivel aceptable',     d: 'Los 30 riesgos, tras control operacional', ok: true },
]

const PROCESOS = [
  {
    titulo: 'Transporte terrestre de personal',
    tipo: 'Rutinaria',
    items: [
      'Conducción y desplazamiento en vehículos livianos hacia áreas operativas',
      'Tránsito por carreteras, caminos de servicio y áreas operativas de faena',
      'Control de fatiga y somnolencia, GPS, manejo defensivo y examen psicosensométrico',
    ],
  },
  {
    titulo: 'Ingreso a instalaciones y puntos de trabajo',
    tipo: 'Rutinaria',
    items: [
      'Coordinación de ingreso y permisos de trabajo',
      'Traslado desde estacionamiento a puntos de inspección',
      'Exposición a material particulado y superficies irregulares',
    ],
  },
  {
    titulo: 'Inspección a elementos de izaje y levante',
    tipo: 'Rutinaria',
    items: [
      'Inspección de grúas, polipastos, eslingas, grilletes y elementos bajo el gancho',
      'Cargas y objetos suspendidos, caída de objetos en altura',
      'Trabajo sobre superficies temporales certificadas y plataformas',
    ],
  },
  {
    titulo: 'Ensayos no destructivos e inspección estructural',
    tipo: 'Rutinaria',
    items: [
      'Limpieza de superficie y medición de espesores',
      'Manipulación de equipos, herramientas manuales y sustancias peligrosas',
      'Exposición a material particulado y contacto con productos químicos',
    ],
  },
  {
    titulo: 'Trabajo en altura',
    tipo: 'No rutinaria',
    items: [
      'Inspección sobre estructuras, estanques y superficies elevadas',
      'Anclaje permanente a puntos certificados durante todo el trabajo',
      'Permiso de trabajo en altura y aprobación de plataformas por supervisor',
    ],
  },
  {
    titulo: 'Espacio confinado',
    tipo: 'No rutinaria',
    items: [
      'Ingreso a estanques y recintos cerrados para inspección interior',
      'Medición de oxígeno y compuestos previa al ingreso',
      'Vigía externo, radio de comunicación e iluminación permanente',
    ],
  },
]

export default function MatrizRiesgos() {
  useEffect(() => {
    document.title = 'Matriz de Riesgos MIPER · WSS Inspecciones Industriales'
    const m = document.querySelector('meta[name="description"]')
    const c = 'Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER) vigente de World Survey Services Chile S.A. — División Inspecciones Industriales. REG-SEG-062 Rev. 01.'
    if (m) m.setAttribute('content', c)
  }, [])

  return (
    <div style={S.page}>
      {/* ── Encabezado ── */}
      <header style={S.hero}>
        <div style={S.heroInner}>
          <div style={S.brandRow}>
            <img src="/assets/wss-logo-horizontal-white.png" alt="WSS"
              style={{ height: 40 }}
              onError={e => { e.target.style.display = 'none' }} />
            <span style={S.acred}>Organismo de Inspección acreditado INN · ISO/IEC 17020</span>
          </div>

          <h1 style={S.h1}>Matriz de Identificación de Peligros<br />y Evaluación de Riesgos</h1>
          <p style={S.sub}>{DOC.empresa} · División {DOC.division}</p>

          <div style={S.chips}>
            <Chip k="Código"        v={DOC.codigo} />
            <Chip k="Revisión"      v={DOC.revision} />
            <Chip k="Emisión"       v={DOC.emision} />
            <Chip k="Actualización" v={DOC.actualizado} destacar />
          </div>

          <div style={S.acciones}>
            <a href={PDF} target="_blank" rel="noopener noreferrer" style={S.btnPrimary}>
              Abrir documento oficial (PDF)
            </a>
            <a href={PDF} download="Matriz-Riesgos-WSS-REG-SEG-062.pdf" style={S.btnGhost}>
              Descargar
            </a>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {/* ── KPIs ── */}
        <section style={S.kpiGrid}>
          {KPIS.map((k, i) => (
            <div key={i} style={{ ...S.kpi, borderTopColor: k.ok ? '#059669' : '#B8860B' }}>
              <div style={{ ...S.kpiN, color: k.ok ? '#059669' : '#0E2A45' }}>{k.n}</div>
              <div style={S.kpiT}>{k.t}</div>
              <div style={S.kpiD}>{k.d}</div>
            </div>
          ))}
        </section>

        <p style={S.nota}>
          La evaluación se realiza sobre <strong>riesgo puro</strong> (sin control) y{' '}
          <strong>riesgo residual</strong> (con control operacional aplicado), usando la
          magnitud <strong>MR = Consecuencia × Probabilidad</strong>. Tras la aplicación de los
          controles definidos, ningún riesgo permanece en clasificación Alto y la totalidad
          queda en nivel aceptable.
        </p>

        {/* ── Alcance ── */}
        <section>
          <h2 style={S.h2}>Actividades cubiertas</h2>
          <div style={S.procGrid}>
            {PROCESOS.map((p, i) => (
              <article key={i} style={S.card}>
                <div style={S.cardHead}>
                  <h3 style={S.cardTitle}>{p.titulo}</h3>
                  <span style={{
                    ...S.tag,
                    background: p.tipo === 'Rutinaria' ? '#DBEAFE' : '#FEF3C7',
                    color:      p.tipo === 'Rutinaria' ? '#1D4ED8' : '#92400E',
                  }}>{p.tipo}</span>
                </div>
                <ul style={S.ul}>
                  {p.items.map((it, j) => <li key={j} style={S.li}>{it}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* ── Visor ── */}
        <section>
          <h2 style={S.h2}>Documento completo</h2>
          <p style={S.pSmall}>
            Versión controlada y vigente. Si el visor no carga en su dispositivo, use el botón
            de descarga.
          </p>
          <div style={S.visorWrap}>
            <object data={PDF} type="application/pdf" style={S.visor}>
              <div style={S.fallback}>
                <p style={{ margin: '0 0 14px', fontSize: 15, color: '#334155' }}>
                  Su navegador no puede mostrar el PDF incrustado.
                </p>
                <a href={PDF} target="_blank" rel="noopener noreferrer" style={S.btnPrimary}>
                  Abrir el documento
                </a>
              </div>
            </object>
          </div>
        </section>

        {/* ── Control documental ── */}
        <section style={S.controlBox}>
          <h2 style={{ ...S.h2, marginTop: 0 }}>Control documental</h2>
          <div style={S.ctrlGrid}>
            <Dato k="Elaborado / revisado por" v={DOC.elaborado} />
            <Dato k="Aprobado por"             v={DOC.aprobado} />
            <Dato k="Código del documento"     v={`${DOC.codigo} · ${DOC.revision}`} />
            <Dato k="Última actualización"     v={DOC.actualizado} />
          </div>
          <p style={S.aviso}>
            Este documento forma parte del sistema de gestión de WSS y se actualiza
            periódicamente. La versión publicada en esta página es siempre la vigente.
            Para antecedentes adicionales o versiones anteriores, contacte al Departamento
            de Calidad.
          </p>
        </section>
      </main>

      <footer style={S.footer}>
        <div style={S.footInner}>
          <span>World Survey Services Chile S.A. · Inspecciones Industriales</span>
          <span style={{ opacity: .65 }}>
            Organismo de Inspección acreditado INN bajo ISO/IEC 17020
          </span>
        </div>
      </footer>
    </div>
  )
}

function Chip({ k, v, destacar }) {
  return (
    <div style={{
      ...S.chip,
      background: destacar ? 'rgba(184,134,11,.22)' : 'rgba(255,255,255,.10)',
      borderColor: destacar ? 'rgba(212,160,23,.55)' : 'rgba(255,255,255,.20)',
    }}>
      <span style={S.chipK}>{k}</span>
      <span style={S.chipV}>{v}</span>
    </div>
  )
}

function Dato({ k, v }) {
  return (
    <div>
      <div style={S.datoK}>{k}</div>
      <div style={S.datoV}>{v}</div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', background: '#F0F4F9',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: '#0F172A',
  },
  hero: {
    background: 'linear-gradient(135deg, #0E2A45 0%, #1E3A5F 55%, #2D5080 100%)',
    padding: '34px 20px 44px',
  },
  heroInner: { maxWidth: 1080, margin: '0 auto' },
  brandRow: {
    display: 'flex', alignItems: 'center', gap: 16,
    flexWrap: 'wrap', marginBottom: 26,
  },
  acred: {
    fontSize: 12, color: '#D4A017', fontWeight: 600,
    letterSpacing: '.3px',
  },
  h1: {
    margin: 0, color: '#fff', fontSize: 'clamp(24px, 4vw, 38px)',
    fontWeight: 800, lineHeight: 1.18, letterSpacing: '-.5px',
  },
  sub: {
    margin: '12px 0 0', color: 'rgba(255,255,255,.72)', fontSize: 15,
  },
  chips: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 },
  chip: {
    border: '1px solid', borderRadius: 10, padding: '8px 14px',
    display: 'flex', flexDirection: 'column', gap: 2, minWidth: 104,
  },
  chipK: {
    fontSize: 10, textTransform: 'uppercase', letterSpacing: '.7px',
    color: 'rgba(255,255,255,.60)', fontWeight: 700,
  },
  chipV: { fontSize: 14, color: '#fff', fontWeight: 700 },
  acciones: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 },
  btnPrimary: {
    background: '#B8860B', color: '#fff', textDecoration: 'none',
    padding: '12px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14,
    display: 'inline-block', boxShadow: '0 4px 14px rgba(184,134,11,.35)',
  },
  btnGhost: {
    background: 'rgba(255,255,255,.10)', color: '#fff', textDecoration: 'none',
    padding: '12px 22px', borderRadius: 10, fontWeight: 600, fontSize: 14,
    border: '1px solid rgba(255,255,255,.28)', display: 'inline-block',
  },
  main: { maxWidth: 1080, margin: '0 auto', padding: '32px 20px 60px' },
  kpiGrid: {
    display: 'grid', gap: 14,
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  },
  kpi: {
    background: '#fff', borderRadius: 14, padding: '18px 20px',
    borderTop: '4px solid', boxShadow: '0 1px 3px rgba(15,23,42,.08)',
  },
  kpiN: { fontSize: 34, fontWeight: 800, lineHeight: 1 },
  kpiT: { fontSize: 14, fontWeight: 700, color: '#1E3A5F', marginTop: 8 },
  kpiD: { fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 1.5 },
  nota: {
    background: '#fff', border: '1px solid #DCE5EF', borderLeft: '4px solid #B8860B',
    borderRadius: 10, padding: '16px 20px', fontSize: 14, lineHeight: 1.65,
    color: '#334155', marginTop: 18,
  },
  h2: {
    fontSize: 20, fontWeight: 800, color: '#0E2A45',
    margin: '40px 0 6px', letterSpacing: '-.2px',
  },
  pSmall: { fontSize: 13.5, color: '#64748B', margin: '0 0 16px', lineHeight: 1.6 },
  procGrid: {
    display: 'grid', gap: 14, marginTop: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  },
  card: {
    background: '#fff', borderRadius: 14, padding: '18px 20px',
    border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15,23,42,.06)',
  },
  cardHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 10, marginBottom: 12,
  },
  cardTitle: { margin: 0, fontSize: 15.5, fontWeight: 800, color: '#0E2A45', lineHeight: 1.35 },
  tag: {
    fontSize: 10.5, fontWeight: 800, padding: '4px 10px',
    borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
  },
  ul: { margin: 0, paddingLeft: 18 },
  li: { fontSize: 13.5, color: '#475569', lineHeight: 1.65, marginBottom: 6 },
  visorWrap: {
    background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
    overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,.06)',
  },
  visor: { width: '100%', height: '78vh', minHeight: 460, border: 'none', display: 'block' },
  fallback: { padding: '48px 24px', textAlign: 'center' },
  controlBox: {
    background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
    padding: '22px 24px', marginTop: 40,
  },
  ctrlGrid: {
    display: 'grid', gap: 18, marginTop: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  },
  datoK: {
    fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px',
    color: '#94A3B8', fontWeight: 800, marginBottom: 4,
  },
  datoV: { fontSize: 14, color: '#1E3A5F', fontWeight: 600, lineHeight: 1.5 },
  aviso: {
    fontSize: 12.5, color: '#64748B', lineHeight: 1.65,
    marginTop: 20, paddingTop: 16, borderTop: '1px solid #EEF2F7',
  },
  footer: { background: '#0E2A45', padding: '22px 20px' },
  footInner: {
    maxWidth: 1080, margin: '0 auto', display: 'flex',
    justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    fontSize: 12.5, color: 'rgba(255,255,255,.85)',
  },
}
