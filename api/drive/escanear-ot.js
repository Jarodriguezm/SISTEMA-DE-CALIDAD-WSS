// api/drive/escanear-ot.js
// Escanea las carpetas de Google Drive de una OT,
// registra/actualiza documentos_ot en Supabase.
//
// Campos reales de documentos_ot:
//   id, ot_numero, tipo, nombre_archivo, drive_file_id,
//   drive_url, observacion, subido_por, created_at
//
// POST /api/drive/escanear-ot  { ot_numero: "OT-2024-001" }

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ETAPA_NUM_A_TIPO = {
  '01': 'correo_cotizacion',
  '02': 'cotizacion',
  '03': 'envio_cotizacion',
  '04': 'orden_compra',
  '05': 'correo_oc',
  '06': null,
  '07': 'asignacion',
  '08': 'acta',
  '09': 'informe',
  '10': 'envio_informes',
  '11': 'sdf',
  '12': 'factura',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ot_numero } = req.body || {}
  if (!ot_numero) return res.status(400).json({ error: 'ot_numero es requerido' })

  try {
    const { data: ot, error: otErr } = await supabase
      .from('ots').select('ot_numero, carpetas_drive').eq('ot_numero', ot_numero).single()

    if (otErr || !ot) return res.status(404).json({ error: 'OT ' + ot_numero + ' no encontrada' })

    const carpetas = typeof ot.carpetas_drive === 'string'
      ? JSON.parse(ot.carpetas_drive) : (ot.carpetas_drive || {})

    if (!Object.keys(carpetas).length)
      return res.status(400).json({ error: 'Esta OT no tiene carpetas Drive configuradas' })

    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })
    const drive = google.drive({ version: 'v3', auth })

    const resultados = []
    const upserts = []

    for (const [numEtapa, info] of Object.entries(carpetas)) {
      const tipoDoc = ETAPA_NUM_A_TIPO[numEtapa]

      if (!tipoDoc) {
        resultados.push({ etapa: numEtapa, tipo: null, archivos: 0, omitida: true })
        continue
      }

      const folderId =
        info?.id ||
        info?.url?.split('/folders/')?.[1]?.split('?')?.[0] ||
        info?.url?.split('/drive/folders/')?.[1]?.split('?')?.[0]

      if (!folderId) {
        resultados.push({ etapa: numEtapa, tipo: tipoDoc, archivos: 0, error: 'Sin folder ID' })
        continue
      }

      try {
        const { data: filesData } = await drive.files.list({
          q: "'" + folderId + "' in parents and trashed = false",
          fields: 'files(id, name, webViewLink, mimeType, createdTime)',
          orderBy: 'createdTime desc',
          pageSize: 50,
        })

        const files = filesData?.files || []
        resultados.push({ etapa: numEtapa, tipo: tipoDoc, archivos: files.length })

        if (files.length > 0) {
          const archivo = files[0]
          upserts.push({
            ot_numero,
            tipo:           tipoDoc,
            nombre_archivo: archivo.name,
            drive_file_id:  archivo.id || null,
            drive_url:      archivo.webViewLink || info?.url || null,
            observacion:    'Archivos en Drive: ' + files.length + '. ' + files.map(f => f.name).join(', '),
            subido_por:     'Sincronizacion Drive',
          })
        }
      } catch (driveErr) {
        resultados.push({ etapa: numEtapa, tipo: tipoDoc, archivos: 0, error: driveErr.message })
      }
    }

    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from('documentos_ot').upsert(upserts, { onConflict: 'ot_numero,tipo' })
      if (upsertErr) return res.status(500).json({ error: upsertErr.message, detalle: resultados })
    }

    const etapasConDocumentos = resultados.filter(r => r.archivos > 0).length
    const totalArchivos = resultados.reduce((sum, r) => sum + (r.archivos || 0), 0)

    return res.status(200).json({
      ok: true, ot_numero,
      etapas_escaneadas: resultados.filter(r => !r.omitida).length,
      etapas_con_documentos: etapasConDocumentos,
      total_archivos: totalArchivos,
      detalle: resultados,
    })

  } catch (err) {
    console.error('escanear-ot error:', err)
    return res.status(500).json({ error: err.message })
  }
}
