// ============================================================
// brandingConfig.js — Configuración centralizada de marca WSS
// Single source of truth para logos, colores y acreditación INN
// ============================================================

// ── Rutas de assets ──────────────────────────────────────────────────────
export const BRAND = {
  // Logo WSS horizontal para fondos oscuros (sidebar, PDFs portada oscura)
  logoBlanco:       '/assets/wss-logo-horizontal-white.png',
  // Logo WSS horizontal para fondos claros (documentos, informes)
  logoColor:        '/assets/wss-logo-horizontal-color.png',
  // Marca INN-Chile acreditación (obligatoria en documentos acreditados)
  logoINN:          '/assets/inn-acreditacion.png',
  // Fallback SVG inline si no cargan las imágenes
  logoFallbackSvg:  null,     // Se completa con <WssLogoSvg /> si se provee

  // ── Paleta institucional ─────────────────────────────────────────────
  colors: {
    navyPrimary:  '#0E2A45',
    navySecond:   '#1E3A5F',
    navyLight:    '#2D5080',
    gold:         '#B8860B',
    goldLight:    '#D4A017',
    white:        '#FFFFFF',
    fondo:        '#F0F4F9',
  },

  // ── Datos legales WSS ─────────────────────────────────────────────────
  legal: {
    razonSocial:  'WSS Inspección Industrial S.A.',
    rut:          '76.XXX.XXX-X',             // Completar con RUT real
    direccion:    'Av. Pedro de Valdivia XXXX, Santiago, Chile',
    fono:         '+56 2 XXXX XXXX',
    email:        'calidad@wss.cl',
    web:          'www.wss.cl',
  },

  // ── Acreditación INN ─────────────────────────────────────────────────
  inn: {
    numero:       'INN-XXXX',                 // Número de acreditación
    alcance:      'Ensayos No Destructivos',
    norma:        'ISO/IEC 17020:2012',
    vigencia:     '2026-12-31',               // Actualizar según certificado
  },
}

// ── Caché de disponibilidad de logos ────────────────────────────────────
// Evita recargas innecesarias. Se llena en runtime.
const _logoCache = {}

/**
 * Verifica si una imagen está disponible (cargable).
 * Retorna Promise<boolean>.
 */
export async function verificarLogo(src) {
  if (src in _logoCache) return _logoCache[src]
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => { _logoCache[src] = true;  resolve(true)  }
    img.onerror = () => { _logoCache[src] = false; resolve(false) }
    img.src = src
  })
}

/**
 * Verifica si AMBOS logos necesarios para documentos acreditados están disponibles.
 * Si alguno falta → retorna { ok: false, faltante: 'wss' | 'inn' }
 * Si ambos OK    → retorna { ok: true }
 */
export async function verificarLogosAcreditacion() {
  const [wss, inn] = await Promise.all([
    verificarLogo(BRAND.logoColor),
    verificarLogo(BRAND.logoINN),
  ])
  if (!wss) return { ok: false, faltante: 'wss',  msg: 'Logo WSS no disponible. No se puede generar documento acreditado.' }
  if (!inn) return { ok: false, faltante: 'inn',  msg: 'Marca INN-Chile no disponible. No se puede generar documento acreditado.' }
  return { ok: true }
}

/**
 * Convierte una URL de imagen a base64 (para embeber en PDF/DOCX).
 * Retorna string base64 o null si falla.
 */
export async function logoABase64(src) {
  try {
    const resp = await fetch(src)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Determina si un tipo de documento requiere logos de acreditación.
 * Tipos acreditados: certificados de calibración, informes END con acreditación.
 */
export function esDocumentoAcreditado(tipoDoc) {
  const ACREDITADOS = [
    'INFORME_END_ACREDITADO',
    'CERTIFICADO_CALIBRACION',
    'ACTA_ACREDITADA',
    'INFORME_INN',
  ]
  return ACREDITADOS.includes((tipoDoc || '').toUpperCase())
}

/**
 * Estilos CSS para el anillo de acreditación (borde dorado).
 * Úsalo en el className del contenedor del documento.
 */
export const CSS_ACRED = 'acred-ring'
