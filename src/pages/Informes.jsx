import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

// Mapeo método END → REG-DII (debe coincidir con TabAsignaciones y NuevoInforme)
const END_MAP = {
  VT:  { reg: 'REG-DII-003', desc: 'Inspección Visual' },
  PT:  { reg: 'REG-DII-004', desc: 'Líquidos Penetrantes' },
  MT:  { reg: 'REG-DII-005', desc: 'Partículas Magnéticas' },
  UTT: { reg: 'REG-DII-006', desc: 'UT — Medición Espesores' },
  UT:  { reg: 'REG-DII-007', desc: 'Ultrasonido (Def. Fallas)' },
  CD:  { reg: 'REG-DII-009', desc: 'Control Dimensional' },
  CG:  { reg: 'REG-DII-011', desc: 'Cert. Equipo de Izaje' },
  PH:  { reg: 'REG-DII-026', desc: 'Prueba Hidrostática' },
  CTK: { reg: 'REG-DII-049', desc: 'Integridad de Tanques' },
  CS:  { reg: 'REG-DII-054', desc: 'Calificación de Soldador' },
  T:   { reg: 'REG-DII-057', desc: 'Termografía' },
  PN:  { reg: 'REG-DII-062', desc: 'Prueba Neumática' },
  CV:  { reg: 'REG-DII-063', desc: 'Cámara de Vacío' },
}

const ESTADO_BADGE = {
  BORRADOR:    { label: 'Borrador',    bg: '#F1F5F9', color: '#475569' },
  EN_REVISION: { label: 'En revisión', bg: '#FEF3C7', color: '#92400E' },
  APROBADO:    { label: 'Aprobado',    bg: '#D1FAE5', color: '#065F46' },
  RECHAZADO:   { label: 'Rechazado',   bg: '#FEE2E2', color: '#991B1B' },
}

export default function Informes() {
  const navigate    = useNavigate()
  const { usuario } = useAuth()
  const [tab, setTab]               = useState('COLA')
  const [cargando, setCargando]     = useState(true)
  const [asignaciones, setAsig]     = useState([])
  const [informesDB, setInformesDB] = useState([])
  const [errorTabla, setErrorTabla] = useState(false)
  const [busqueda, setBusqueda]     = useState('')
  const [filtroEstado, setFiltro]   = useState('TODOS')

  useEffect(() => { cargarDatos() }, [usuario])

  async function cargarDatos() {
    if (!usuario) return
    setCargando(true)
    const nombre = usuario.nombre_completo || usuario.nombre || ''

    try {
      // 1. Asignaciones donde aparece este inspector
      const { data: asigs } = await supabase
        .from('asignaciones')
        .select('id,ot_numero,inspectores_asignados,supervisor,fecha_inspeccion,tipos_inspeccion')
        .ilike('inspectores_asignados', `%${nombre}%`)
        .order('fecha_inspeccion', { ascending: false })
        .limit(60)
      setAsig(asigs || [])

      // 2. Enriquecer con nombre de cliente desde OTs
      const otNums = [...new Set((asigs || []).map(a => a.ot_numero).filter(Boolean))]
      let clienteMap = {}
      if (otNums.length > 0) {
        const { data: otsData } = await supabase
          .from('ots').select('ot_numero,cliente').in('ot_numero', otNums)
        ;(otsData || []).forEach(o => { clienteMap[o.ot_numero] = o.cliente })
      }
      // Inyectar cliente en asignaciones
      setAsig((asigs || []).map(a => ({ ...a, cliente: clienteMap[a.ot_numero] || '' })))

      // 3. Informes ya creados (puede no existir la tabla aún)
      const { data: infs, error: eInf } = await supabase
        .from('informes')
        .select('id,numero,reg_dii_numero,metodo_end_cod,ot_numero,cliente_nombre,estado,resultado,fecha_inspeccion,created_at')
        .order('created_at', { ascending: false })
      if (eInf) setErrorTabla(true)
      setInformesDB(infs || [])
    } catch (e) {
      console.error('[Informes] cargarDatos:', e)
    } finally {
      setCargando(false)
    }
  }

  // ── Cola de trabajo: asignaciones × métodos END → pendientes / completados ──
  const colaItems = asignaciones.flatMap(asig => {
    const tipos = (asig.tipos_inspeccion || '')
      .toUpperCase().split(/[,\s]+/).map(t => t.trim()).filter(Boolean)
    return tipos.flatMap(cod => {
      const metodo = END_MAP[cod]
      if (!metodo) return []
      const existente = informesDB.find(
        i => i.ot_numero === asig.ot_numero && i.reg_dii_numero === metodo.reg
      )
      return [{ key: `${asig.ot_numero}-${cod}`, asig, cod, reg: metodo.reg, desc: metodo.desc, completado: existente || null }]
    })
  })

  const pendientes   = colaItems.filter(i => !i.completado)
  const completadosQ = colaItems.filter(i => i.completado)

  // ── Filtros tabla "Todos" ──
  const filtrados = informesDB.filter(i => {
    if (filtroEstado !== 'TODOS' && i.estado !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return [i.numero, i.ot_numero, i.cliente_nombre, i.reg_dii_numero].some(v => (v||'').toLowerCase().includes(q))
    }
    return true
  })

  const contadores = {
    TODOS: informesDB.length,
    BORRADOR:    informesDB.filter(i => i.estado === 'BORRADOR').length,
    EN_REVISION: informesDB.filter(i => i.estado === 'EN_REVISION').length,
    APROBADO:    informesDB.filter(i => i.estado === 'APROBADO').length,
    RECHAZADO:   informesDB.filter(i => i.estado === 'RECHAZADO').length,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0 }}>📋 Informes de Inspección</h1>
          <p style={{ color:'var(--gris)', fontSize:14, marginTop:4 }}>
            {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''} · {informesDB.length} registrado{informesDB.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/informes/nuevo')}>
          + Nuevo Informe
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'2px solid #E2E8F0' }}>
        {[
          { id:'COLA',  label:`Cola de trabajo`,        count: pendientes.length,   icon:'🔧' },
          { id:'TODOS', label:`Todos los informes`,     count: informesDB.length,   icon:'📄' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer',
            border:'none', background:'transparent',
            borderBottom: tab===t.id ? '3px solid #1E3A5F' : '3px solid transparent',
            color: tab===t.id ? '#1E3A5F' : '#94A3B8',
            marginBottom:-2,
          }}>
            {t.icon} {t.label}
            <span style={{ marginLeft:6, fontSize:11, padding:'1px 7px', borderRadius:20, fontWeight:800,
              background: tab===t.id ? '#1E3A5F' : '#E2E8F0',
              color: tab===t.id ? '#fff' : '#94A3B8' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ textAlign:'center', padding:48, color:'#aaa' }}>Cargando...</div>
      ) : tab === 'COLA' ? (
        <ColaTrabajo
          pendientes={pendientes}
          completados={completadosQ}
          errorTabla={errorTabla}
          navigate={navigate}
        />
      ) : (
        <TodosInformes
          filtrados={filtrados}
          informesDB={informesDB}
          filtroEstado={filtroEstado}
          setFiltroEstado={setFiltro}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          contadores={contadores}
          errorTabla={errorTabla}
          navigate={navigate}
        />
      )}
    </div>
  )
}

// ── Cola de trabajo ─────────────────────────────────────────────────────────────

function ColaTrabajo({ pendientes, completados, errorTabla, navigate }) {
  if (errorTabla && pendientes.length === 0 && completados.length === 0) {
    return (
      <div className="card" style={{ padding:32, textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
        <div style={{ fontWeight:'bold', color:'#475569', marginBottom:8, fontSize:15 }}>Tabla de informes no encontrada</div>
        <div style={{ fontSize:13, color:'#94A3B8' }}>
          Ejecuta <code style={{ background:'#F1F5F9', padding:'2px 6px', borderRadius:4 }}>sql_informes.sql</code> en el editor SQL de Supabase para crear la tabla.
        </div>
      </div>
    )
  }

  if (pendientes.length === 0 && completados.length === 0) {
    return (
      <div className="card" style={{ padding:48, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
        <div style={{ fontWeight:'bold', fontSize:16, color:'#475569' }}>Sin pendientes</div>
        <div style={{ fontSize:13, color:'#94A3B8', marginTop:6 }}>
          Los informes aparecen aquí cuando el supervisor asigna métodos END en una OT.
        </div>
      </div>
    )
  }

  return (
    <div>
      {pendientes.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={S.seccionLabel}>Por hacer — {pendientes.length} informe(s)</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pendientes.map(item => <TarjetaItem key={item.key} item={item} navigate={navigate} />)}
          </div>
        </div>
      )}
      {completados.length > 0 && (
        <div>
          <div style={S.seccionLabel}>Completados en esta asignación — {completados.length}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {completados.map(item => <TarjetaItem key={item.key} item={item} navigate={navigate} completado />)}
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaItem({ item, navigate, completado = false }) {
  const { asig, cod, reg, desc } = item
  const fecha = asig.fecha_inspeccion
    ? new Date(asig.fecha_inspeccion + 'T00:00:00').toLocaleDateString('es-CL')
    : 'Sin fecha'
  const estadoBadge = item.completado?.estado ? ESTADO_BADGE[item.completado.estado] : null

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
      background:'#fff',
      border:`1.5px solid ${completado ? '#D1FAE5' : '#E2E8F0'}`,
      borderLeft:`4px solid ${completado ? '#10B981' : '#1E3A5F'}`,
      borderRadius:10,
    }}>
      <div style={{ fontSize:20, flexShrink:0 }}>{completado ? '✅' : '⬜'}</div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontWeight:800, fontSize:13, color:'#1E3A5F', fontFamily:'monospace' }}>{reg}</span>
          <span style={{ fontSize:12, color:'#475569' }}>— {desc}</span>
          <span style={{ fontSize:10, background:'#F1F5F9', color:'#64748B', padding:'2px 7px', borderRadius:20, fontWeight:700 }}>{cod}</span>
          {estadoBadge && (
            <span style={{ fontSize:10, background:estadoBadge.bg, color:estadoBadge.color, padding:'2px 7px', borderRadius:20, fontWeight:700 }}>
              {estadoBadge.label}
            </span>
          )}
        </div>
        <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>
          <b style={{ color:'#475569' }}>{asig.ot_numero}</b>
          {asig.cliente ? ` · ${asig.cliente}` : ''}
          {` · 📅 ${fecha}`}
          {asig.supervisor ? ` · Sup: ${asig.supervisor}` : ''}
        </div>
      </div>

      {!completado ? (
        <button
          onClick={() => navigate(`/informes/nuevo?ot=${asig.ot_numero}&reg=${reg}&cod=${cod}`)}
          style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'#1E3A5F', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>
          Iniciar →
        </button>
      ) : (
        <button
          onClick={() => item.completado?.id && navigate(`/informes/${item.completado.id}`)}
          style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid #10B981', background:'#F0FDF4', color:'#065F46', cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>
          Ver →
        </button>
      )}
    </div>
  )
}

// ── Todos los informes ──────────────────────────────────────────────────────────

function TodosInformes({ filtrados, informesDB, filtroEstado, setFiltroEstado, busqueda, setBusqueda, contadores, errorTabla, navigate }) {
  if (errorTabla) {
    return (
      <div className="card" style={{ padding:32, textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
        <div style={{ fontWeight:'bold', color:'#475569', marginBottom:8 }}>Tabla de informes no encontrada</div>
        <div style={{ fontSize:13, color:'#94A3B8' }}>
          Ejecuta <code style={{ background:'#F1F5F9', padding:'2px 6px', borderRadius:4 }}>sql_informes.sql</code> en el editor SQL de Supabase.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {['TODOS','BORRADOR','EN_REVISION','APROBADO','RECHAZADO'].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)} style={{
            padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
            border: filtroEstado===e ? '1px solid #1E3A5F' : '1px solid #CBD5E1',
            background: filtroEstado===e ? '#1E3A5F' : '#fff',
            color: filtroEstado===e ? '#fff' : '#475569',
          }}>
            {e === 'TODOS' ? 'Todos' : ESTADO_BADGE[e]?.label} ({contadores[e]||0})
          </button>
        ))}
        <input className="input" placeholder="Buscar OT, cliente, REG-DII..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ fontSize:12, padding:'5px 12px', height:32, minWidth:200, marginLeft:8 }} />
      </div>

      {filtrados.length === 0 ? (
        <div className="card" style={{ padding:48, textAlign:'center', color:'#94A3B8' }}>
          {informesDB.length === 0 ? 'Sin informes aún. Usa "Iniciar →" en la cola de trabajo.' : 'Sin resultados para los filtros seleccionados.'}
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F8FAFC', borderBottom:'2px solid #E2E8F0' }}>
                {['N° Informe','REG-DII','OT','Cliente','Fecha','Estado',''].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((inf, i) => {
                const est = ESTADO_BADGE[inf.estado] || ESTADO_BADGE.BORRADOR
                return (
                  <tr key={inf.id} style={{ borderBottom:'1px solid #F1F5F9', background: i%2===0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:700, color:'#1E3A5F' }}>{inf.numero || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, fontWeight:700, color:'#7C3AED', fontFamily:'monospace' }}>{inf.reg_dii_numero || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#475569' }}>{inf.ot_numero || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12 }}>{inf.cliente_nombre || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#475569' }}>
                      {inf.fecha_inspeccion ? new Date(inf.fecha_inspeccion).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ ...S.badge, background:est.bg, color:est.color }}>{est.label}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/informes/${inf.id}`)}>Ver</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const S = {
  badge:       { display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 },
  seccionLabel: { fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 },
}
