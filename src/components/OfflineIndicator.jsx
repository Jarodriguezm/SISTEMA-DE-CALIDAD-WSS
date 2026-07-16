import { useState, useEffect } from 'react'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { obtenerPendientes } from '../lib/offlineDB'

export default function OfflineIndicator() {
  const { online, pendientes, sincronizando, progreso, sincronizar } = useOfflineSync()
  const [detalle, setDetalle] = useState(false)
  const [lista, setLista]     = useState([])

  useEffect(() => {
    if (detalle) {
      obtenerPendientes().then(setLista)
    }
  }, [detalle, pendientes])

  // No mostrar nada si hay conexión y nada pendiente
  if (online && pendientes === 0) return null

  return (
    <>
      <style>{`
        @keyframes wss-slide-up {
          from { transform:translateX(-50%) translateY(16px); opacity:0 }
          to   { transform:translateX(-50%) translateY(0);    opacity:1 }
        }
        @keyframes wss-spin {
          to { transform:rotate(360deg) }
        }
      `}</style>

      {/* Banner inferior */}
      <div style={{
        position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)',
        zIndex:9999, minWidth:320, maxWidth:480,
        background: online ? '#1E3A5F' : '#1C1C2E',
        color:'#fff', borderRadius:12, padding:'12px 18px',
        fontSize:13, boxShadow:'0 6px 24px rgba(0,0,0,0.35)',
        animation:'wss-slide-up 0.3s ease',
        display:'flex', alignItems:'center', gap:12,
      }}>

        {/* Ícono */}
        <span style={{ fontSize:22, flexShrink:0 }}>
          {!online ? '📡' : sincronizando ? '⏳' : '🔄'}
        </span>

        {/* Texto */}
        <div style={{ flex:1, minWidth:0 }}>
          {!online ? (
            <>
              <div style={{ fontWeight:600 }}>Sin conexión — modo offline</div>
              <div style={{ fontSize:11, opacity:0.75, marginTop:1 }}>
                Los informes se guardan en el dispositivo y se subirán al recuperar señal
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight:600 }}>
                {sincronizando
                  ? `Sincronizando… ${progreso ? `(${progreso.ok}/${progreso.total})` : ''}`
                  : `${pendientes} informe${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''} de subir`}
              </div>
              <div style={{ fontSize:11, opacity:0.75, marginTop:1 }}>
                {sincronizando
                  ? 'Subiendo a la nube...'
                  : 'Conexión recuperada — listos para sincronizar'}
              </div>
            </>
          )}
        </div>

        {/* Acciones */}
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          {online && pendientes > 0 && !sincronizando && (
            <button onClick={sincronizar}
              style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:7,
                color:'#fff', padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              ↑ Subir
            </button>
          )}
          {pendientes > 0 && (
            <button onClick={() => setDetalle(d => !d)}
              style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:7,
                color:'#fff', padding:'5px 10px', cursor:'pointer', fontSize:12 }}>
              {detalle ? '✕' : '···'}
            </button>
          )}
        </div>
      </div>

      {/* Panel detalle */}
      {detalle && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          zIndex:9998, width:420, maxHeight:320, overflowY:'auto',
          background:'var(--surface-2, #fff)', border:'1px solid #E2E8F0',
          borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.15)',
          padding:14,
        }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:10, color:'#1E3A5F' }}>
            Informes guardados localmente
          </div>
          {lista.length === 0 ? (
            <div style={{ fontSize:12, color:'#94A3B8' }}>No hay informes pendientes</div>
          ) : lista.map(item => (
            <div key={item.id} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'7px 10px', marginBottom:6, borderRadius:7,
              background: item.estado === 'error' ? '#FEF2F2' :
                          item.estado === 'completado' ? '#F0FDF4' : '#F8FAFC',
              border:'1px solid',
              borderColor: item.estado === 'error' ? '#FECACA' :
                           item.estado === 'completado' ? '#BBF7D0' : '#E2E8F0',
              fontSize:12,
            }}>
              <div>
                <div style={{ fontWeight:600, color:'#0F172A' }}>
                  {item.ot_numero} — {item.tipo_equipo}
                </div>
                <div style={{ color:'#64748B', fontSize:11 }}>
                  {new Date(item.creado_en).toLocaleString('es-CL')}
                </div>
                {item.error_msg && (
                  <div style={{ color:'#DC2626', fontSize:10, marginTop:2 }}>
                    ⚠ {item.error_msg}
                  </div>
                )}
              </div>
              <span style={{
                fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:5,
                background: item.estado === 'error'     ? '#FEE2E2' :
                            item.estado === 'completado' ? '#DCFCE7' :
                            item.estado === 'sincronizando' ? '#EFF6FF' : '#F1F5F9',
                color: item.estado === 'error'     ? '#991B1B' :
                       item.estado === 'completado' ? '#166534' :
                       item.estado === 'sincronizando' ? '#1D4ED8' : '#475569',
              }}>
                {item.estado === 'pendiente'     ? '⏸ Pendiente' :
                 item.estado === 'sincronizando' ? '⏳ Subiendo'  :
                 item.estado === 'completado'    ? '✅ Subido'    : '❌ Error'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
