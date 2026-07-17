// ============================================================
// WssUI.jsx — Componentes UI reutilizables WSS
// Tabla enterprise: StatusBadge, ProgressBar, SummaryStrip, etc.
// ============================================================
import { useState, useRef, useEffect } from 'react'

// ── Constantes de estilo compartidas ─────────────────────────────────────
export const TH = {
  padding: '10px 16px',
  background: '#F8FAFC',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#64748B',
  letterSpacing: '.6px',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  border: 'none',
  borderBottom: '1.5px solid #E2E8F0',
  userSelect: 'none',
}

export const TD = {
  padding: '14px 16px',
  verticalAlign: 'middle',
  border: 'none',
  borderBottom: '1px solid #F1F5F9',
  fontSize: 13,
  color: '#0F172A',
}

export const PAGE_CARD = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,.06)',
}

// ── Helper: formato fecha legible ─────────────────────────────────────────
export function fmtFecha(str) {
  if (!str) return '—'
  try {
    const d = new Date(str.includes('T') ? str : str + 'T00:00:00')
    if (isNaN(d)) return str
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return str }
}

// ── Helper: parsear lista de texto separada por comas/puntos y coma ───────
export function parseLista(str) {
  if (!str || str === '—') return []
  return str.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
}

// ── StatusBadge ────────────────────────────────────────────────────────────
const BADGE_MAP = {
  'Pendiente de asignación': { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5', dot: '#DC2626' },
  'Sin inspector':            { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5', dot: '#DC2626' },
  'Asignado':                 { bg: '#FEF3C7', color: '#78350F', border: '#FCD34D', dot: '#D97706' },
  'Asignada':                 { bg: '#FEF3C7', color: '#78350F', border: '#FCD34D', dot: '#D97706' },
  'En proceso':               { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  'Acta cargada':             { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  'Informe cargado':          { bg: '#F0FDFA', color: '#0F766E', border: '#5EEAD4', dot: '#14B8A6' },
  'Informe enviado':          { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7', dot: '#059669' },
  'Factura cargada':          { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7', dot: '#059669' },
  'Cerrada documentalmente':  { bg: '#F0FDF4', color: '#166534', border: '#86EFAC', dot: '#22C55E' },
  'Programada':               { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  'Realizada':                { bg: '#F0FDF4', color: '#166534', border: '#86EFAC', dot: '#22C55E' },
  'Cancelada':                { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5', dot: '#DC2626' },
  'Pendiente':                { bg: '#FEF3C7', color: '#78350F', border: '#FCD34D', dot: '#D97706' },
}

export function StatusBadge({ estado }) {
  const s = BADGE_MAP[estado] || { bg: '#F9FAFB', color: '#374151', border: '#D1D5DB', dot: '#9CA3AF' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 9px', borderRadius: 99,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '.1px',
      lineHeight: 1.2,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {estado || '—'}
    </span>
  )
}

// ── SedeBadge ─────────────────────────────────────────────────────────────
const SEDE_MAP = {
  ANF: { bg: '#F0F9FF', color: '#0369A1', border: '#BAE6FD' },
  SCL: { bg: '#F5F3FF', color: '#5B21B6', border: '#DDD6FE' },
  CCP: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
}
export function SedeBadge({ sede }) {
  const s = SEDE_MAP[sede] || { bg: '#F9FAFB', color: '#374151', border: '#D1D5DB' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 8px', borderRadius: 6,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: 11, fontWeight: 700, letterSpacing: '.4px',
    }}>{sede || '—'}</span>
  )
}

// ── ProgressBar ────────────────────────────────────────────────────────────
export function ProgressBar({ value }) {
  const v = Math.min(100, Math.max(0, Number(value) || 0))
  const color = v >= 100 ? '#22C55E' : v >= 70 ? '#3B82F6' : v >= 30 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: v >= 100 ? '#166534' : '#475569', minWidth: 28, textAlign: 'right' }}>
        {v}%
      </span>
    </div>
  )
}

// ── PersonList — muestra hasta N nombres, +resto ──────────────────────────
export function PersonList({ text, max = 2 }) {
  if (!text || text === '—' || text.trim() === '') {
    return <span style={{ color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>Sin asignar</span>
  }
  const names = parseLista(text)
  if (!names.length) return <span style={{ color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>Sin asignar</span>
  const shown = names.slice(0, max)
  const rest  = names.length - max
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {shown.map((n, i) => (
        <span key={i} style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {n}
        </span>
      ))}
      {rest > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#64748B',
          background: '#F1F5F9', borderRadius: 99,
          padding: '1px 7px', display: 'inline-block', alignSelf: 'flex-start',
        }}>
          +{rest}
        </span>
      )}
    </div>
  )
}

// ── TechniqueList — badges compactos para técnicas NDT ────────────────────
const TECH_COLORS = {
  VT:    ['#EFF6FF', '#1E40AF'],
  PT:    ['#FFF7ED', '#C2410C'],
  LP:    ['#FFF7ED', '#C2410C'],
  MT:    ['#F5F3FF', '#5B21B6'],
  UT:    ['#ECFDF5', '#065F46'],
  RT:    ['#FEF2F2', '#991B1B'],
  ET:    ['#F0FDF4', '#166534'],
  IV:    ['#EFF6FF', '#1E40AF'],
  IVS:   ['#EFF6FF', '#1E40AF'],
  IZAJE: ['#FEF3C7', '#78350F'],
  EAI:   ['#F0FDF4', '#166534'],
  ESI:   ['#F5F3FF', '#5B21B6'],
}
export function TechniqueList({ text }) {
  if (!text || text === '—') return <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>
  const techs = parseLista(text)
  if (!techs.length) return <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {techs.map((t, i) => {
        const key = t.toUpperCase().replace(/\s/g, '')
        const [bg, fg] = TECH_COLORS[key] || ['#F1F5F9', '#475569']
        return (
          <span key={i} style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.4px',
            padding: '2px 6px', borderRadius: 4,
            background: bg, color: fg,
          }}>{t}</span>
        )
      })}
    </div>
  )
}

// ── RowActions — botón "Ver" + menú contextual 3 puntos ──────────────────
export function RowActions({ onView, onDelete, canDelete, viewLabel = 'Ver detalle' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} ref={ref}>
      <button
        onClick={onView}
        style={{
          padding: '5px 10px', borderRadius: 6,
          border: '1px solid #E2E8F0', background: '#fff',
          color: '#334155', fontSize: 12, fontWeight: 500,
          cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.background = '#F8FAFC' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff' }}
      >
        {viewLabel}
      </button>

      {canDelete && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(v => !v)}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid #E2E8F0', background: '#fff',
              color: '#94A3B8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.color = '#475569' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.8"/>
              <circle cx="12" cy="12" r="1.8"/>
              <circle cx="12" cy="19" r="1.8"/>
            </svg>
          </button>
          {open && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100,
              background: '#fff', border: '1px solid #E2E8F0',
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
              minWidth: 150, overflow: 'hidden',
            }}>
              <button
                onClick={() => { setOpen(false); onDelete() }}
                style={{
                  width: '100%', padding: '10px 14px', background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', fontSize: 13, color: '#DC2626', textAlign: 'left',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                </svg>
                Eliminar OT
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────
export function EmptyState({ title = 'Sin resultados', desc, onClear }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '56px 20px', gap: 12, textAlign: 'center',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{title}</div>
      {desc && <div style={{ fontSize: 13, color: '#64748B', maxWidth: 320, lineHeight: 1.5 }}>{desc}</div>}
      {onClear && (
        <button
          onClick={onClear}
          style={{
            marginTop: 4, padding: '7px 16px', borderRadius: 7,
            border: '1px solid #CBD5E1', background: '#fff',
            fontSize: 13, fontWeight: 500, color: '#334155', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────
export function Pagination({ pagina, totalPaginas, totalRegistros, porPagina, onChange }) {
  if (totalPaginas <= 1) return null
  const inicio = pagina * porPagina + 1
  const fin    = Math.min((pagina + 1) * porPagina, totalRegistros)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderTop: '1px solid #F1F5F9',
      fontSize: 12, color: '#64748B',
    }}>
      <span>{inicio}–{fin} de {totalRegistros}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <PBtn disabled={pagina === 0} onClick={() => onChange(pagina - 1)}>← Anterior</PBtn>
        <span style={{ padding: '4px 10px', fontSize: 12, color: '#475569', fontWeight: 600 }}>
          {pagina + 1} / {totalPaginas}
        </span>
        <PBtn disabled={pagina >= totalPaginas - 1} onClick={() => onChange(pagina + 1)}>Siguiente →</PBtn>
      </div>
    </div>
  )
}
function PBtn({ disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '5px 11px', borderRadius: 6, border: '1px solid #E2E8F0',
        background: '#fff', fontSize: 12, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#CBD5E1' : '#334155',
        fontFamily: 'inherit',
      }}
    >{children}</button>
  )
}

// ── TableSkeleton ──────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 6, cols = 8 }) {
  return (
    <div>
      {Array(rows).fill(0).map((_, r) => (
        <div key={r} style={{
          display: 'flex', gap: 16, padding: '16px 20px',
          borderBottom: r < rows - 1 ? '1px solid #F8FAFC' : 'none',
          alignItems: 'center',
        }}>
          {Array(cols).fill(0).map((_, c) => (
            <div key={c} style={{
              height: 12, borderRadius: 4, background: '#F1F5F9',
              animation: 'pulse-sk 1.5s ease-in-out infinite',
              flex: c === 1 ? 2 : 1,
              opacity: c === 0 ? 1 : c === 1 ? .9 : .7,
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── SummaryStrip — fila de métricas clicables ─────────────────────────────
export function SummaryStrip({ items, activeKey, onSelect }) {
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid #F1F5F9',
      overflowX: 'auto', flexShrink: 0,
    }}>
      {items.map(item => {
        const active = activeKey === item.key
        return (
          <button
            key={String(item.key)}
            onClick={() => onSelect(active ? null : item.key)}
            style={{
              flex: 1, minWidth: 80, border: 'none', background: 'transparent',
              cursor: 'pointer', padding: '14px 16px',
              borderBottom: active ? `2px solid ${item.color}` : '2px solid transparent',
              transition: 'all .15s', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3,
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, color: active ? item.color : '#1E293B', lineHeight: 1 }}>
              {item.count}
            </span>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? item.color : '#64748B', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Select estilizado inline ───────────────────────────────────────────────
export const SELECT_STYLE = {
  height: 36, width: '100%', padding: '0 28px 0 10px',
  border: '1.5px solid #E2E8F0', borderRadius: 7,
  fontSize: 13, color: '#334155', cursor: 'pointer',
  background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E") no-repeat right 10px center`,
  WebkitAppearance: 'none', appearance: 'none',
  fontFamily: 'inherit',
}
