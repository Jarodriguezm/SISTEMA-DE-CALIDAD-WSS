import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://labxvesmcfbrdtftkwtg.supabase.co'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en Vercel' })

  const supabaseAdmin = createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { email, password, nombre, apellido, rol, sede, telefono_whatsapp } = req.body || {}

  if (!email || !password || !nombre || !rol) {
    return res.status(400).json({ error: 'Faltan campos: email, contraseña, nombre y rol son requeridos' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }

  let userId = null
  try {
    // 1. Crear en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })
    if (authError) throw new Error(authError.message)
    userId = authData.user.id

    // 2. Insertar en tabla usuarios
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: userId,
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        apellido: (apellido || '').trim(),
        rol,
        sede: sede || 'SCL',
        telefono_whatsapp: telefono_whatsapp?.trim() || null,
        activo: true,
      })

    if (dbError) {
      // rollback: eliminar el usuario de auth
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw new Error(dbError.message)
    }

    return res.status(200).json({ ok: true, userId })
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }
}
