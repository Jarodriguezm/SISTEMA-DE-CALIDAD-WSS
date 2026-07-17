// ============================================================
// EncabezadoDocumento.jsx — Encabezado institucional WSS
// Obligatorio en todos los documentos formales.
// Para documentos acreditados: BLOQUEA si falta logo WSS o INN.
// Layout: [Logo WSS | izq] — [Título | centro] — [INN | der]
// ============================================================
import { useState, useEffect } from 'react'
import { BRAND, verificarLogosAcreditacion, CSS_ACRED } from '../../lib/brandingConfig'

// ── Bloque de bloqueo si faltan logos ────────────────────────────────────
function BloqueAcreditacion({ faltante }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      background: '#FFFBEB', border: '1.5px solid #FCD34D',
      borderRadius: 8, padding: '14px 18px', margin: '0 0 20px',
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 4 }}>
          Documento bloqueado — logos institucionales no disponibles
        </div>
        <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
          {faltante === 'wss'
            ? 'El logotipo WSS no está disponible en el servidor. Los documentos acreditados requieren el logo institucional WSS.'
            : 'La marca de acreditación INN-Chile no está disponible. Los documentos acreditados requieren el símbolo INN.'}
          <br/>
          Cargue los archivos en{' '}
          <code style={{ background: 'rgba(0,0,0,.06)', padding: '1px 5px', borderRadius: 3 }}>
            /public/assets/
          </code>
          {' '}y recargue la aplicación.
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
 *   children    {node}     — Contenido adicional (datos OT, cliente, etc.)
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
  const [wssErr, setWssErr]     = useState(false)
  const [innErr, setInnErr]     = useState(false)

  useEffect(() => {
    if (!acreditado) { setEstado('ok'); return }
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
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, color: '#64748B', fontSize: 13 }}>
        <span className="spinner spinner-sm"/>
        Verificando logos institucionales…
      </div>
    )
  }

  // ── Bloqueado ──────────────────────────────────────────────────────────
  if (estado === 'bloqueado') {
    return <BloqueAcreditacion faltante={faltante} />
  }

  // ── Encabezado completo ────────────────────────────────────────────────
  const isPrint = modo === 'impresion' || modo === 'pdf'

  return (
    <div
      className={acreditado ? CSS_ACRED : undefined}
      style={isPrint ? S.wrapPrint : S.wrap}
    >
      {/* Franja top navy (acento visual) */}
      <div style={{ height: 4, background: BRAND.colors.navySecond }} />

      {/* Banda principal: WSS | Título | INN */}
      <div style={S.banda}>

        {/* ── Logo WSS (izquierda, fijo) ─────────────────────────────── */}
        <div style={S.logoWrap}>
          {!wssErr ? (
            <img
              src={BRAND.logoColor}
              alt="WSS Testing & Certification Chile"
              style={S.logoWSS}
              onError={() => setWssErr(true)}
            />
          ) : (
            <div style={S.logoTextFallback}>
              <span style={{ fontSize: 22, fontWeight: 900, color: BRAND.colors.navyPrimary, letterSpacing: 1 }}>WSS</span>
              <span style={{ fontSize: 9, color: '#64748B', letterSpacing: '.5px' }}>TESTING &amp; CERTIFICATION CHILE</span>
            </div>
          )}
        </div>

        {/* ── Título central ─────────────────────────────────────────── */}
        <div style={S.titleBlock}>
          {titulo && (
            <div style={S.titleText}>{titulo}</div>
          )}
          {subtitulo && (
            <div style={S.subtitleText}>{subtitulo}</div>
          )}
        </div>

        {/* ── Logo INN (derecha, solo si acreditado) ─────────────────── */}
        <div style={S.innWrap}>
          {acreditado ? (
            !innErr ? (
              <img
                src={BRAND.logoINN}
                alt={`Acreditación INN-Chile ${BRAND.inn.numero}`}
                style={S.logoINN}
                onError={() => setInnErr(true)}
              />
            ) : (
              /* Fallback texto si no carga la imagen INN */
              <div style={S.innTextFallback}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#1D4ED8', letterSpacing: '.6px', textTransform: 'uppercase' }}>
                  Sistema Nacional
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#1D4ED8', letterSpacing: '.6px', textTransform: 'uppercase' }}>
                  de Acreditación
                </div>
                <div style={{ fontSize: 9, color: '#1e3a8a', marginTop: 3 }}>INN-Chile</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a8a', marginTop: 2 }}>
                  Acred. {BRAND.inn.numero}
                </div>
              </div>
            )
          ) : (
            /* Espacio vacío para mantener simetría cuando no es acreditado */
            null
          )}
        </div>
      </div>

      {/* ── Banda secundaria: fecha + datos + badge acreditado ─────────── */}
      {(fecha || children || acreditado) && (
        <div style={S.secundario}>
          {/* Fecha */}
          {fecha && (
            <div style={S.fechaChip}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              {fecha}
            </div>
          )}

          {/* Datos adicionales (children) */}
          {children && (
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center' }}>
              {children}
            </div>
          )}

          {/* Badge acreditado */}
          {acreditado && (
            <div style={S.acredBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
              Documento Acreditado · {BRAND.inn.numero}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helper para datos de fila en el encabezado ───────────────────────────
export function DatoEncabezado({ label, valor, negrita = false }) {
  if (!valor) return null
  return (
    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', gap: 4, alignItems: 'baseline' }}>
      <span style={{ color: '#94A3B8', fontWeight: 500 }}>{label}:</span>
      <span style={{ color: '#0F172A', fontWeight: negrita ? 700 : 400 }}>{valor}</span>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────
const S = {
  wrap: {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
  },
  wrapPrint: {
    background: '#fff',
    border: '1.5px solid #1E3A5F',
    overflow: 'hidden',
    marginBottom: 16,
    pageBreakInside: 'avoid',
  },

  // Banda principal
  banda: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    gap: 0,
    background: '#fff',
    minHeight: 80,
  },

  // Área logo WSS — izquierda, ancho fijo para simetría
  logoWrap: {
    flexShrink: 0,
    width: 200,
    display: 'flex',
    alignItems: 'center',
  },
  logoWSS: {
    maxWidth: 180,
    maxHeight: 58,
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    objectPosition: 'left center',
    display: 'block',
  },
  logoTextFallback: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },

  // Bloque de título — centro, flexible
  titleBlock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 20px',
    borderLeft: '1px solid #E2E8F0',
    borderRight: '1px solid #E2E8F0',
    minHeight: 60,
  },
  titleText: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0F172A',
    letterSpacing: '.5px',
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.3,
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: '.3px',
    fontWeight: 500,
  },

  // Área logo INN — derecha, mismo ancho que logoWrap para equilibrio
  innWrap: {
    flexShrink: 0,
    width: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  logoINN: {
    maxWidth: 180,
    maxHeight: 62,
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    objectPosition: 'right center',
    display: 'block',
  },
  innTextFallback: {
    textAlign: 'right',
    lineHeight: 1.4,
  },

  // Banda secundaria
  secundario: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px 20px',
    padding: '9px 24px',
    borderTop: '1px solid #F1F5F9',
    background: '#F8FAFC',
  },
  fechaChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    color: '#64748B',
    fontWeight: 500,
    flexShrink: 0,
  },
  acredBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    color: '#92400E',
    background: '#FEF3C7',
    border: '1px solid #FCD34D',
    borderRadius: 99,
    padding: '3px 10px',
    marginLeft: 'auto',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
}
