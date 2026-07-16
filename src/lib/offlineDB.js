import Dexie from 'dexie'

// Base de datos local IndexedDB para funcionamiento offline
export const db = new Dexie('WSSInspecciones')

db.version(1).stores({
  // Informes completos guardados offline, pendientes de subir a Supabase
  cola_sync: '++id, ot_numero, tipo_equipo, estado, creado_en',
})

export const SYNC_ESTADO = {
  PENDIENTE:     'pendiente',
  SINCRONIZANDO: 'sincronizando',
  COMPLETADO:    'completado',
  ERROR:         'error',
}

// Guardar informe en cola local
export async function encolarInforme(payload) {
  const id = await db.cola_sync.add({
    payload:     JSON.stringify(payload),
    ot_numero:   payload.ot_numero  || 'sin-OT',
    tipo_equipo: payload.tipo_equipo || '',
    estado:      SYNC_ESTADO.PENDIENTE,
    creado_en:   new Date().toISOString(),
    error_msg:   '',
  })
  return id
}

// Cantidad de informes pendientes
export async function contarPendientes() {
  return db.cola_sync.where('estado').equals(SYNC_ESTADO.PENDIENTE).count()
}

// Obtener todos los pendientes (para la pantalla de gestión)
export async function obtenerPendientes() {
  return db.cola_sync
    .orderBy('creado_en')
    .reverse()
    .toArray()
}

// Sincronizar todos los pendientes con Supabase
export async function sincronizarCola(supabase, onProgreso) {
  const items = await db.cola_sync
    .where('estado').anyOf([SYNC_ESTADO.PENDIENTE, SYNC_ESTADO.ERROR])
    .toArray()

  let ok = 0, fail = 0

  for (const item of items) {
    await db.cola_sync.update(item.id, { estado: SYNC_ESTADO.SINCRONIZANDO })
    try {
      const payload = JSON.parse(item.payload)
      const { error } = await supabase.from('informes').insert(payload)
      if (error) throw error
      await db.cola_sync.update(item.id, { estado: SYNC_ESTADO.COMPLETADO })
      ok++
    } catch (e) {
      await db.cola_sync.update(item.id, { estado: SYNC_ESTADO.ERROR, error_msg: e.message })
      fail++
    }
    onProgreso?.({ ok, fail, total: items.length })
  }

  return { ok, fail }
}
