// ============================================================
// EncabezadoDocumento.jsx — Encabezado institucional WSS
// Obligatorio en todos los documentos formales.
// Para documentos acreditados: BLOQUEA si falta logo WSS o INN.
// ============================================================
import { useState, useEffect } from 'react'
import { BRAND, verificarLogosAcreditacion, CSS_ACRED } from '../../lib/brandingConfig'

// ── Bloque de bloqueo si faltan logos ────────────────────────────────────
function BloqueAcreditacion({ faltante }) {
  return (
    <div className="alert alert-block" style={{ margin: 0 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:1 }}>
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:'#92400E', marginBottom:4 }}>
            Documento bloqueado — logos institucionales no disponibles
          </div>
          <div style={{ fontSize:13, color:'#78350F', lineHeight:1.5 }}>
            {faltante === 'wss'
              ? 'El logo WSS no está disponible en el servidor. Los documentos acreditados requieren logo WSS institucional.'
              : 'La marca INN-Chile de acreditación no está disponible. Los documentos acreditados requieren el símbolo de acreditación INN.'}
            <br/>
            Contacte a Administración para cargar los assets institucionales en <code style={{ background:'rgba(0,0,0,.06)', padding:'1px 5px', borderRadius:3 }}>/public/assets/</code>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
/**
 * EncabezadoDocumento
 *
 * Props:
 *   acreditado  {boolean}  — Si true, muestra logo INN y aplica anillo dorado
 *   titulo      {string}   — Título del documento (ej: "INFORME DE INSPECCIÓN")
 *   subtitulo   {string}   — Subtítulo o número (ej: "INF-2026-0042")
 *   fecha       {string}   — Fecha del documento
 *   children    {node}     — Contenido adicional del encabezado (ej: datos OT)
 *   onBloqueado {fn}       — Callback cuando el documento queda bloqueado
 *   modo        {string}   — 'pantalla' (default) | 'impresion' | 'pdf'
 */
export default function EncabezadoDocumento({
  acreditado  = false,
  titulo      = '',
  subtitulo   = '',
  fecha       = '',
  children,
  onBloqueado,
  modo        = 'pantalla',
}) {
  const [estado, setEstado]     = useState('cargando')  // cargando | ok | bloqueado
  const [faltante, setFaltante] = useState(null)
  const [wssError, setWssError] = useState(false)

  useEffect(() => {
    if (!acreditado) {
      setEstado('ok')
      return
    }
    verificarLogosAcreditacion().then(res => {
      if (res.ok) {
        setEstado('ok')
      } else {
        setEstado('bloqueado')
        setFaltante(res.faltante)
        onBloqueado?.(res.msg)
      }
    })
  }, [acreditado])

  // ── Loading ─────────────────────────────────────────────────────────────
  if (estado === 'cargando') {
    return (
      <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', gap:10, color:'var(--gris)', fontSize:13 }}>
        <span className="spinner spinner-sm"/>
        Verificando logos institucionales…
      </div>
    )
  }

  // ── Bloqueado (solo para documentos acreditados con logos faltantes) ────
  if (estado === 'bloqueado') {
    return <BloqueAcreditacion faltante={faltante} />
  }

  // ── Encabezado completo ──────────────────────────────────────────────────
  const esImpresion = modo === 'impresion' || modo === 'pdf'

  return (
    <div
      className={`doc-header${acreditado ? ` ${CSS_ACRED}` : ''}`}
      style={esImpresion ? S.headerPrint : S.header}
    >
      {/* Franja azul superior */}
      <div style={{ ...S.banda, background: BRAND.colors.navySecond }}>

        {/* Logo WSS */}
        <div style={S.logoWrap}>
          {!wssError ? (
            <img
              src={BRAND.logoColor}
              alt="WSS"
              style={S.logoWSS}
              onError={() => setWssError(true)}
            />
          ) : (
            <span style={S.logoFallback}>WSS</span>
          )}
          <div style={S.subBrand}>División Inspección Industrial</div>
        </div>

        {/* Título central */}
        <div style={S.titleBlock}>
          {titulo && (
            <div style={S.titleText}>{titulo}</div>
          )}
          {subtitulo && (
            <div style={S.subtitleText}>{subtitulo}</div>
          )}
        </div>

        {/* Logo INN (solo si acreditado) */}
        {acreditado && (
          <div style={S.innBlock}>
            <img
              src={BRAND.logoINN}
              alt="Acreditación INN-Chile"
              style={S.logoINN}
            />
            <div style={S.innText}>
              <div style={S.innNumero}>{BRAND.inn.numero}</div>
              <div style={S.innNorma}>{BRAND.inn.norma}</div>
            </div>
          </div>
        )}
      </div>

      {/* Datos secundarios (fecha + children) */}
      {(fecha || children) && (
        <div style={S.secundario}>
          {fecha && (
            <div style={S.fechaTag}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              {fecha}
            </div>
          )}
          {children && (
            <div style={{ flex:1, display:'flex', flexWrap:'wrap', gap:'10px 24px', alignItems:'center' }}>
              {children}
            </div>
          )}
          {acreditado && (
            <div style={S.acredTag}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              Documento Acreditado
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente helper para datos de fila en el encabezado ────────────────
export function DatoEncabezado({ label, valor, negrita = false }) {
  if (!valor) return null
  return (
    <div style={{ fontSize:12, color:'var(--gris-2)', display:'flex', gap:4, alignItems:'baseline' }}>
      <span style={{ color:'var(--gris)', fontWeight:500 }}>{label}:</span>
      <span style={{ color:'var(--texto)', fontWeight: negrita ? 700 : 400 }}>{valor}</span>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────
const S = {
  header: {
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid var(--borde)',
    boxShadow: 'var(--shadow-sm)',
    background: '#fff',
    marginBottom: 20,
  },
  headerPrint: {
    overflow: 'hidden',
    border: '1.5px solid #1E3A5F',
    background: '#fff',
    marginBottom: 16,
    pageBreakInside: 'avoid',
  },
  banda: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 0,
    minHeight: 72,
  },
  logoWrap: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '14px 20px',
    borderRight: '1px solid rgba(255,255,255,.12)',
    minWidth: 160,
  },
  logoWSS: {
    maxWidth: 140,
    maxHeight: 40,
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
  },
  logoFallback: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '2px',
  },
  subBrand: {
    fontSize: 9,
    color: 'rgba(255,255,255,.5)',
    letterSpacing: '.6px',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  titleBlock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '12px 20px',
  },
  titleText: {
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '.4px',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitleText: {
    fontSize: 12,
    color: 'rgba(255,255,255,.72)',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: '.2px',
  },
  innBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 20px',
    borderLeft: '1px solid rgba(255,255,255,.12)',
    minWidth: 140,
  },
  logoINN: {
    width: 44,
    height: 44,
    objectFit: 'contain',
  },
  innText: {
    display: 'flex',
    flexDirection: 'column',
  },
  innNumero: {
    fontSize: 11,
    fontWeight: 700,
    color: '#FFD700',
    letterSpacing: '.3px',
  },
  innNorma: {
    fontSize: 9,
    color: 'rgba(255,255,255,.65)',
    marginTop: 2,
  },
  secundario: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px 20px',
    padding: '10px 20px',
    borderTop: '1px solid var(--borde)',
    background: 'var(--surface-2)',
  },
  fechaTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: 'var(--gris)',
    fontWeight: 500,
  },
  acredTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    color: '#92400E',
    background: '#FEF3C7',
    border: '1px solid #FCD34D',
    borderRadius: 99,
    padding: '3px 10px',
    fontWeight: 600,
    marginLeft: 'auto',
  },
}
