// ============================================================
// DetalleInforme.jsx — Vista completa de un informe DII
// WSS · Sistema de Calidad
// ============================================================
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const ESTADO_BADGE = {
  BORRADOR:    { label: 'Borrador',    bg: '#F1F5F9', color: '#475569' },
  EN_REVISION: { label: 'En revisión', bg: '#FEF3C7', color: '#92400E' },
  APROBADO:    { label: 'Aprobado',    bg: '#D1FAE5', color: '#065F46' },
  RECHAZADO:   { label: 'Rechazado',   bg: '#FEE2E2', color: '#991B1B' },
}

const RESULTADO_BADGE = {
  CONFORME:      { label: '✅ Conforme',      bg: '#D1FAE5', color: '#065F46' },
  NO_CONFORME:   { label: '❌ No conforme',   bg: '#FEE2E2', color: '#991B1B' },
  CONDICIONADO:  { label: '⚠️ Condicionado',  bg: '#FEF3C7', color: '#92400E' },
}

const SECCIONES_IA = [
  { key: 'introduccion',       label: 'Introducción' },
  { key: 'descripcion_equipo', label: 'Descripción del equipo' },
  { key: 'end_realizados',     label: 'Ensayos realizados' },
  { key: 'hallazgos',          label: 'Hallazgos' },
  { key: 'evaluacion',         label: 'Evaluación' },
  { key: 'conclusion',         label: 'Conclusión' },
  { key: 'recomendaciones',    label: 'Recomendaciones' },
]

export default function DetalleInforme() {
  const { id }          = useParams()
  const navigate        = useNavigate()
  const { usuario }     = useAuth()

  const [informe, setInforme]     = useState(null)
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [enviando, setEnviando]   = useState(false)
  const [msgEnvio, setMsgEnvio]   = useState('')

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setCargando(true)
    setError('')
    const { data, error: e } = await supabase
      .from('informes')
      .select('*')
      .eq('id', id)
      .single()
    if (e) setError(e.message)
    else    setInforme(data)
    setCargando(false)
  }

  async function enviarARevision() {
    setEnviando(true)
    setMsgEnvio('')
    const { error: e } = await supabase
      .from('informes')
      .update({ estado: 'EN_REVISION', updated_at: new Date().toISOString() })
      .eq('id', id)
    setEnviando(false)
    if (e) { setMsgEnvio('Error: ' + e.message); return }
    setMsgEnvio('✅ Informe enviado a revisión')
    setInforme(prev => ({ ...prev, estado: 'EN_REVISION' }))
  }

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (cargando) return <div style={{ padding: 48, textAlign: 'center', color: '#aaa' }}>Cargando informe...</div>
  if (error)    return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ color: '#DC2626', marginBottom: 16 }}>Error: {error}</div>
      <button onClick={() => navigate('/informes')} style={S.btnSecundario}>← Volver</button>
    </div>
  )
  if (!informe) return null

  const est      = ESTADO_BADGE[informe.estado]  || ESTADO_BADGE.BORRADOR
  const resBadge = RESULTADO_BADGE[informe.resultado]
  const esMio    = informe.inspector_id === usuario?.id
  const puedeEnviar = informe.estado === 'BORRADOR'
    && (esMio || usuario?.rol === 'ADMIN')

  const hallazgos   = Array.isArray(informe.hallazgos) ? informe.hallazgos : []
  const textoIA     = informe.texto_ia || {}
  const hayTextoIA  = SECCIONES_IA.some(s => textoIA[s.key])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── Navegación ── */}
      <button
        onClick={() => navigate('/informes')}
        style={{ background: 'none', border: 'none', color: 'var(--gris)', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        ← Volver a informes
      </button>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1E3A5F' }}>
            {informe.numero || 'Informe sin número'}
          </h1>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            {informe.reg_dii_numero && <span style={{ fontFamily: 'monospace', color: '#7C3AED', fontWeight: 700 }}>{informe.reg_dii_numero}</span>}
            {informe.metodo_end_cod && <span style={{ color: '#94A3B8', marginLeft: 8 }}>({informe.metodo_end_cod})</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ ...S.badge, background: est.bg, color: est.color, fontSize: 13 }}>
            {est.label}
          </span>
          {resBadge && (
            <span style={{ ...S.badge, background: resBadge.bg, color: resBadge.color, fontSize: 13 }}>
              {resBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Metadata ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px 24px' }}>
          <Campo label="OT"                valor={informe.ot_numero} />
          <Campo label="Cliente"           valor={informe.cliente_nombre} />
          <Campo label="Tipo equipo"       valor={informe.tipo_equipo} />
          <Campo label="Lugar"             valor={informe.lugar} />
          <Campo label="Fecha inspección"  valor={informe.fecha_inspeccion
            ? new Date(informe.fecha_inspeccion + 'T00:00:00').toLocaleDateString('es-CL')
            : null} />
          <Campo label="Inspector"         valor={informe.inspector_nombre} />
          <Campo label="Supervisor"        valor={informe.supervisor_nombre} />
          <Campo label="Resultado"         valor={resBadge?.label || informe.resultado} />
        </div>
      </div>

      {/* ── Comentario supervisor (si fue rechazado) ── */}
      {informe.estado === 'RECHAZADO' && informe.comentario_supervisor && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>
            ❌ Observación del supervisor
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#7F1D1D', lineHeight: 1.6 }}>
            {informe.comentario_supervisor}
          </p>
          {informe.fecha_revision && (
            <div style={{ fontSize: 11, color: '#EF4444', marginTop: 8 }}>
              Revisado el {new Date(informe.fecha_revision).toLocaleDateString('es-CL')} por {informe.supervisor_nombre || 'supervisor'}
            </div>
          )}
        </div>
      )}

      {/* ── Aprobado (info) ── */}
      {informe.estado === 'APROBADO' && (
        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4 }}>
            ✅ Aprobado
          </div>
          <div style={{ fontSize: 13, color: '#166534' }}>
            Por {informe.supervisor_nombre || 'supervisor'}
            {informe.fecha_aprobacion && ` el ${new Date(informe.fecha_aprobacion).toLocaleDateString('es-CL')}`}
          </div>
        </div>
      )}

      {/* ── PDF del informe ── */}
      {informe.drive_pdf_id && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={S.seccionLabel}>Documento PDF</div>
          <iframe
            src={`/api/drive/proxy-pdf?fileId=${informe.drive_pdf_id}`}
            style={{ width: '100%', height: 500, border: '1px solid #E2E8F0', borderRadius: 8 }}
            title="Informe PDF"
          />
        </div>
      )}

      {/* ── Hallazgos ── */}
      {hallazgos.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={S.seccionLabel}>Hallazgos ({hallazgos.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hallazgos.map((h, i) => (
              <div key={i} style={{
                padding: '12px 16px', borderRadius: 8,
                background: h.criticidad === 'CRITICO' ? '#FEF2F2' : h.criticidad === 'MAYOR' ? '#FFFBEB' : '#F8FAFC',
                border: `1px solid ${h.criticidad === 'CRITICO' ? '#FECACA' : h.criticidad === 'MAYOR' ? '#FDE68A' : '#E2E8F0'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1E3A5F' }}>Hallazgo #{i + 1}</span>
                  {h.criticidad && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: h.criticidad === 'CRITICO' ? '#DC2626' : h.criticidad === 'MAYOR' ? '#D97706' : '#6B7280',
                      color: '#fff',
                    }}>{h.criticidad}</span>
                  )}
                </div>
                {h.descripcion && <p style={{ margin: '4px 0', fontSize: 13, color: '#374151' }}>{h.descripcion}</p>}
                {h.ubicacion  && <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>Ubicación: {h.ubicacion}</p>}
                {h.norma      && <p style={{ margin: 0, fontSize: 12, color: '#7C3AED', fontFamily: 'monospace' }}>Norma: {h.norma}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Texto IA ── */}
      {hayTextoIA && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={S.seccionLabel}>Contenido del informe (generado por IA)</div>
          {SECCIONES_IA.map(sec => textoIA[sec.key] ? (
            <div key={sec.key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', marginBottom: 6 }}>{sec.label}</div>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {textoIA[sec.key]}
              </p>
            </div>
          ) : null)}
        </div>
      )}

      {/* ── Acciones ── */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 32, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/informes')} style={S.btnSecundario}>
          ← Volver
        </button>

        {puedeEnviar && (
          <button
            onClick={enviarARevision}
            disabled={enviando}
            style={{
              ...S.btnPrimario,
              opacity: enviando ? .7 : 1,
              cursor: enviando ? 'not-allowed' : 'pointer',
            }}
          >
            {enviando ? 'Enviando...' : '📤 Enviar a revisión'}
          </button>
        )}
      </div>

      {msgEnvio && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16,
          background: msgEnvio.startsWith('✅') ? '#F0FDF4' : '#FEF2F2',
          color: msgEnvio.startsWith('✅') ? '#166534' : '#991B1B',
          border: `1px solid ${msgEnvio.startsWith('✅') ? '#BBF7D0' : '#FECACA'}`,
        }}>
          {msgEnvio}
        </div>
      )}
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#1E3A5F', fontWeight: 600 }}>
        {valor || <span style={{ color: '#CBD5E1' }}>—</span>}
      </div>
    </div>
  )
}

const S = {
  badge: { display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 20, fontWeight: 700 },
  seccionLabel: { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 14 },
  btnSecundario: { padding: '9px 20px', borderRadius: 8, border: '1.5px solid #CBD5E1', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnPrimario:   { padding: '9px 24px', borderRadius: 8, border: 'none', background: '#1E3A5F', color: '#fff', fontSize: 13, fontWeight: 700 },
}
