// ============================================================
// /api/crear-usuario — Alta de usuarios del portal
//
// CORRECCIÓN DE SEGURIDAD
//   La versión anterior no verificaba quién la llamaba: no pedía
//   sesión, aceptaba llamadas desde cualquier sitio (CORS *) y
//   cualquier rol, incluido ADMIN. Como usa la clave de servicio de la
//   base, cualquiera que conociera esta dirección —visible en el código
//   del portal— podía crearse una cuenta de administrador.
//
// AHORA
//   1. Exige el token de sesión del usuario que llama.
//   2. Valida ese token contra Supabase (no se confía en lo que diga el
//      navegador sobre quién es).
//   3. Verifica en la tabla usuarios que sea ADMIN o ADMINISTRADOR y
//      que esté activo.
//   4. Solo acepta roles de una lista conocida.
//   5. Sin CORS abierto: solo el propio portal puede llamarla.
// ============================================================
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://labxvesmcfbrdtftkwtg.supabase.co'

const ROLES_PERMITIDOS = new Set([
  'ADMIN', 'SUPERVISOR', 'COMERCIAL', 'INSPECTOR', 'FACTURACION',
  'AUDITOR', 'APR', 'SECRETARIA', 'RRHH',
])
const ROLES_QUE_CREAN = new Set(['ADMIN', 'ADMINISTRADOR'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return res.status(500).json({ error: 'Servicio no configurado' })

  const supabaseAdmin = createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1 y 2: ¿quién llama? ───────────────────────────────────
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Sesión requerida' })

  const { data: quien, error: errQuien } = await supabaseAdmin.auth.getUser(token)
  if (errQuien || !quien?.user?.email) {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' })
  }

  // ── 3: ¿tiene permiso para crear usuarios? ─────────────────
  const { data: perfil } = await supabaseAdmin
    .from('usuarios')
    .select('rol, activo')
    .eq('email', quien.user.email.toLowerCase())
    .maybeSingle()

  const rolLlamante = String(perfil?.rol || '').toUpperCase()
  if (!perfil || perfil.activo === false || !ROLES_QUE_CREAN.has(rolLlamante)) {
    return res.status(403).json({ error: 'Solo administración puede crear usuarios' })
  }

  // ── 4: validar los datos ───────────────────────────────────
  const { email, password, nombre, apellido, rol, sede, telefono_whatsapp } = req.body || {}

  if (!email || !password || !nombre || !rol) {
    return res.status(400).json({ error: 'Faltan campos: email, contraseña, nombre y rol son requeridos' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }
  const rolNuevo = String(rol).toUpperCase()
  if (!ROLES_PERMITIDOS.has(rolNuevo)) {
    return res.status(400).json({ error: `Rol no válido: ${rol}` })
  }

  let userId = null
  try {
    // Crear en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password,
      email_confirm: true,
    })
    if (authError) throw new Error(authError.message)
    userId = authData.user.id

    // Insertar en tabla usuarios
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: userId,
        email: String(email).trim().toLowerCase(),
        nombre: String(nombre).trim(),
        apellido: String(apellido || '').trim(),
        rol: rolNuevo,
        sede: sede || 'SCL',
        telefono_whatsapp: telefono_whatsapp ? String(telefono_whatsapp).trim() : null,
        activo: true,
      })

    if (dbError) {
      // Revertir: no dejar una cuenta de acceso sin ficha en el portal
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw new Error(dbError.message)
    }

    return res.status(200).json({ ok: true, userId })
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }
}
