// ============================================================
// Vercel Serverless Function: /api/drive/crear-carpetas
// Crea la estructura de carpetas en Google Drive para una OT
//
// Variables de entorno requeridas en Vercel:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   — email de la service account
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — clave privada (con \n reales)
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — para guardar en DB
// ============================================================

import { createSign } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase con service role (para guardar sin restricciones RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Configuración ─────────────────────────────────────────────────────────────

const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const CARPETAS_12 = [
  '01 - Correo solicitud cotización',
  '02 - Cotización',
  '03 - Envío cotización',
  '04 - Orden de compra (OC)',
  '05 - Correo recepción OC',
  '06 - Creación OT',
  '07 - Asignación de actividades',
  '08 - Acta de trabajo',
  '09 - Informe(s)',
  '10 - Envío informes',
  '11 - SDF Solicitud factura',
  '12 - Factura',
]

// IDs de carpetas raíz por sede
const FOLDERS_RAIZ = {
  SCL: '1bmG-L9JC0dBzsHxxUZQvMoBJwC5QzTbC',
  ANF: '16VmPA_nHsVyud9ELF9x4dLPsOI93s6Fw',
  CCP: null, // Agregar cuando exista
}

// ── Handler principal ─────────────────────────────────────────────────────────

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  try {
    const { ot_numero, cliente, sede, anio, mes } = req.body

    if (!ot_numero || !sede || !cliente) {
      return res.status(400).json({ ok: false, error: 'Parámetros requeridos: ot_numero, cliente, sede' })
    }

    const raizId = FOLDERS_RAIZ[sede]
    if (!raizId) {
      return res.status(400).json({ ok: false, error: `Sede "${sede}" no tiene carpeta raíz configurada en Drive` })
    }

    // Obtener token de Google
    const token = await getGoogleToken()

    // ── 1. Carpeta del mes ────────────────────────────────────────────────────
    const mesNum  = Number(mes) || (new Date().getMonth() + 1)
    const anioNum = anio || new Date().getFullYear()
    const nombreMes = `${anioNum}-${String(mesNum).padStart(2, '0')} ${MESES_ES[mesNum - 1]}`
    const mesId = await findOrCreateFolder(token, nombreMes, raizId)

    // ── 2. Carpeta de la OT ───────────────────────────────────────────────────
    const nombreOT   = `${ot_numero} - ${cliente}`
    const otFolderId = await findOrCreateFolder(token, nombreOT, mesId)
    const otFolderUrl = `https://drive.google.com/drive/folders/${otFolderId}`

    // ── 3. Las 12 subcarpetas ─────────────────────────────────────────────────
    const subcarpetas = {}
    for (const nombre of CARPETAS_12) {
      const num = nombre.split(' - ')[0].trim()   // '01', '02', ...
      const id  = await createFolder(token, nombre, otFolderId)
      subcarpetas[num] = {
        id,
        nombre,
        url: `https://drive.google.com/drive/folders/${id}`,
      }
    }

    // ── 4. Guardar en Supabase directamente (respaldo — ModalCrearOT también lo hace)
    if (ot_numero && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await supabase
          .from('ots')
          .update({
            carpeta_drive_url: otFolderUrl,
            carpetas_drive:    subcarpetas,
          })
          .eq('ot_numero', ot_numero)
        console.log(`[crear-carpetas] carpetas_drive guardadas para ${ot_numero}`)
      } catch (sbErr) {
        // No es fatal — el frontend también guarda
        console.warn(`[crear-carpetas] Supabase update falló para ${ot_numero}:`, sbErr.message)
      }
    }

    return res.status(200).json({
      ok: true,
      carpeta_ot_id:  otFolderId,
      carpeta_ot_url: otFolderUrl,
      subcarpetas,
    })

  } catch (err) {
    console.error('[crear-carpetas] Error:', err.message)
    return res.status(500).json({ ok: false, error: err.message })
  }
}

// ── Google Auth ───────────────────────────────────────────────────────────────

async function getGoogleToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error('Variables GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY no configuradas en Vercel')
  }

  const privateKey = rawKey.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)

  const header  = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({
    iss:   email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey, 'base64url')

  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const data = await tokenRes.json()

  if (!data.access_token) {
    throw new Error('No se pudo obtener token de Google: ' + JSON.stringify(data))
  }

  return data.access_token
}

function toBase64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// ── Drive API helpers ─────────────────────────────────────────────────────────

async function findOrCreateFolder(token, name, parentId) {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const { files } = await searchRes.json()
  if (files?.length > 0) return files[0].id

  return createFolder(token, name, parentId)
}

async function createFolder(token, name, parentId) {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  )
  const data = await res.json()
  if (!data.id) {
    throw new Error(`No se pudo crear la carpeta "${name}": ${JSON.stringify(data)}`)
  }
  return data.id
}
