import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  contarPendientes,
  sincronizarCola,
  SYNC_ESTADO,
} from '../lib/offlineDB'

export function useOfflineSync() {
  const [online, setOnline]             = useState(navigator.onLine)
  const [pendientes, setPendientes]     = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [progreso, setProgreso]         = useState(null)   // { ok, fail, total }
  const sincRef                         = useRef(false)

  // Actualizar contador de pendientes
  const refrescarContador = useCallback(async () => {
    const n = await contarPendientes()
    setPendientes(n)
  }, [])

  // Sincronizar con Supabase
  const sincronizar = useCallback(async () => {
    if (sincRef.current || !navigator.onLine) return
    sincRef.current = true
    setSincronizando(true)
    setProgreso(null)

    const result = await sincronizarCola(supabase, p => setProgreso(p))
    await refrescarContador()

    setSincronizando(false)
    sincRef.current = false
    return result
  }, [refrescarContador])

  // Listeners de conectividad
  useEffect(() => {
    refrescarContador()

    const goOnline  = () => { setOnline(true);  sincronizar() }
    const goOffline = () => { setOnline(false) }

    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [refrescarContador, sincronizar])

  return {
    online,
    pendientes,
    sincronizando,
    progreso,
    sincronizar,
    refrescarContador,
  }
}
