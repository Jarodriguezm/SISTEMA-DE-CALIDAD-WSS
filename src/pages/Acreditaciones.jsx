import { useState } from 'react'

// ── Datos extraídos de los certificados INN ──────────────────────────────────

const ACREDITACIONES = [
  {
    id: 'OI376',
    numero: 'OI 376',
    area: 'Ensayos No Destructivos',
    sigla: 'END',
    icon: '🔬',
    colorPrimario: '#1E3A5F',
    colorSecundario: '#DBEAFE',
    norma: 'NCh-ISO 17020:2012',
    tipo: 'Organismo de Inspección Tipo A',
    vigenciaDesde: '2023-06-01',
    vigenciaHasta: '2028-06-01',
    entidad: 'Instituto Nacional de Normalización (INN)',
    alcance: [
      {
        producto: 'Calderas y sus componentes',
        procedimientos: ['PRO-DII-027 Rev. 01'],
        normas: ['ASME Secc. I:2019', 'ASME Secc. V:2017 (Art. 6, 7 y 9)', 'ASTM E-797-95:2015', 'ASTM E407-07:2017'],
        metodos: ['Inspección Visual', 'Líquidos penetrantes', 'Partículas magnéticas', 'Medición de espesores por ultrasonido', 'Ultrasonido detección de fallas'],
      },
      {
        producto: 'Estanques, recipientes, cañerías e instalaciones industriales',
        procedimientos: ['PRO-DII-012 Rev. 02'],
        normas: ['ASME Secc. I:2015', 'ASME Secc. VIII:2015', 'ASME B31.1:2014', 'ASME B31.3:2014', 'ASME B31.4:2006', 'ASME B31.8:2014', 'API 650:2013', 'API 510:2006', 'API 570:2003', 'API 620:2004'],
        metodos: ['Pruebas de Presión Hidrostáticas'],
      },
      {
        producto: 'Soldaduras y elementos estructurales de estanques de almacenamiento, transporte y recipientes a presión',
        procedimientos: ['PRO-DII-002 Rev. 02', 'PRO-DII-003 Rev. 01', 'PRO-DII-004 Rev. 01', 'PRO-DII-005 Rev. 01', 'PRO-DII-006 Rev. 01', 'PRO-DII-016 Rev. 02'],
        normas: ['ASME BPVC Secc. V:2017', 'ASME BPC Secc. VIII-1:2017', 'API 510', 'API 650:2013', 'API 653:2014', 'ASME RTP-1:2017', 'NCh2136:2003', 'NCh2190:2019', 'ASTM E-709:2015'],
        metodos: ['Inspección Visual', 'Líquidos penetrantes', 'Partículas magnéticas', 'Medición de espesores por ultrasonido', 'Ultrasonido detección de fallas', 'Ultrasonido Phased Array', 'Prueba de presión hidrostática'],
      },
      {
        producto: 'Soldaduras y elementos estructurales de líneas de transporte o conducción de líquidos (aguas, mineroductos, relaves, sustancias peligrosas)',
        procedimientos: ['PRO-DII-002 Rev. 02', 'PRO-DII-003 Rev. 01', 'PRO-DII-004 Rev. 01', 'PRO-DII-005 Rev. 01', 'PRO-DII-006 Rev. 01', 'PRO-DII-012 Rev. 02', 'PRO-DII-016 Rev. 02', 'PRO-DII-017 Rev. 01'],
        normas: ['API 570:2016', 'API 574:2016', 'ASME B31.3:2018', 'ASME B31.1:2016', 'API 1104:2013'],
        metodos: ['Inspección Visual', 'Líquidos penetrantes', 'Partículas magnéticas', 'Medición de espesores por ultrasonido', 'Ultrasonido detección de fallas', 'Ultrasonido Phased Array', 'Prueba de presión hidrostática'],
      },
      {
        producto: 'Soldaduras y elementos estructurales',
        procedimientos: ['PRO-DII-003 Rev. 01', 'PRO-DII-004 Rev. 01', 'PRO-DII-005 Rev. 01', 'PRO-DII-006 Rev. 01', 'PRO-DII-016 Rev. 02', 'PRO-DII-020 Rev. 00'],
        normas: ['ASME BPVC Secc. V:2017', 'AWS D1.1:2015', 'AWS D1.2:2014', 'AWS D1.3:2018', 'AWS D1.4:2018', 'AWS D1.5:2015', 'AWS D1.6:2017', 'ASTM E-709:2015', 'ASTM E 797:2015'],
        metodos: ['Inspección Visual', 'Líquidos penetrantes', 'Partículas magnéticas', 'Medición de espesores por ultrasonido', 'Ultrasonido detección de fallas', 'Ultrasonido Phased Array'],
      },
    ],
  },
  {
    id: 'OI377',
    numero: 'OI 377',
    area: 'Equipos de Izaje y Levante',
    sigla: 'IZAJE',
    icon: '🏗️',
    colorPrimario: '#7C3AED',
    colorSecundario: '#EDE9FE',
    norma: 'NCh-ISO 17020:2012',
    tipo: 'Organismo de Inspección Tipo A',
    vigenciaDesde: '2023-06-01',
    vigenciaHasta: '2028-06-01',
    entidad: 'Instituto Nacional de Normalización (INN)',
    alcance: [
      {
        producto: 'Alza hombre',
        procedimientos: ['PRO-DII-024 Rev. 01'],
        normas: ['ASME B30.23:2019', 'ASME Secc. V:2019'],
        metodos: ['Inspección Visual de Estructura y Componentes', 'Control Dimensional de Estructura y Componentes', 'Verificación Documental de Especificaciones técnicas', 'Realización de prueba de carga'],
      },
      {
        producto: 'Dispositivos de levante: Grilletes, Cuerdas, Ganchos, Eslingas, Cuadrantes, Vigas',
        procedimientos: ['PRO-DII-024 Rev. 01'],
        normas: ['ASME B30.9:2018', 'ASME B30.10:2019', 'ASME B30.20:2018', 'ASME B30.26:2015', 'ASME Secc. V:2019'],
        metodos: ['Inspección Visual de Componentes', 'Control Dimensional de Componentes', 'Verificación Documental de Especificaciones técnicas'],
      },
      {
        producto: 'Grúa horquilla',
        procedimientos: ['PRO-DII-028 Rev. 00'],
        normas: ['ANSI/ITSDF B56.6:2021', 'ANSI/ITSDF B56.1:2020'],
        metodos: ['Inspección Visual de Estructura y Componentes', 'Control Dimensional de Estructura y Componentes', 'Verificación Documental de Especificaciones técnicas', 'Realización de prueba de carga'],
      },
      {
        producto: 'Grúas Puente y Pórtico · Grúa Monorriel · Grúa Articulada',
        procedimientos: ['PRO-DII-024 Rev. 01'],
        normas: ['ASME B30.2:2016', 'ASME B30.3:2019', 'ASME B30.4:2015', 'ASME B30.5:2018', 'ASME B30.17:2015', 'ASME B30.18:2016', 'ASME B30.22:2016', 'ASME B30.24:2018', 'ASME Secc. V:2019'],
        metodos: ['Inspección Visual de Estructura y Componentes', 'Control Dimensional de Estructura y Componentes', 'Verificación Documental de Especificaciones técnicas', 'Realización de prueba de carga'],
      },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function diasRestantes(hasta) {
  const hoy = new Date()
  const fin  = new Date(hasta)
  return Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

function BadgeVigencia({ hasta }) {
  const dias = diasRestantes(hasta)
  const meses = Math.floor(dias / 30)
  const años  = Math.floor(dias / 365)
  if (dias < 0)    return <span style={{ ...S.badge, background: '#FEE2E2', color: '#991B1B' }}>VENCIDA</span>
  if (dias < 90)   return <span style={{ ...S.badge, background: '#FEF3C7', color: '#92400E' }}>⚠ Vence en {dias} días</span>
  return <span style={{ ...S.badge, background: '#D1FAE5', color: '#065F46' }}>✓ VIGENTE · {años > 0 ? `${años} años` : `${meses} meses`} restantes</span>
}

// ── Componente tarjeta de alcance ─────────────────────────────────────────────

function AlcanceRow({ item, index }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid #F1F5F9', overflow: 'hidden' }}>
      <button onClick={() => setAbierto(!abierto)} style={S.alcanceBtn}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={S.indexBadge}>{index + 1}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', textAlign: 'left' }}>
            {item.producto}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>
          {item.metodos.length} métodos · {abierto ? '▲' : '▼'}
        </span>
      </button>

      {abierto && (
        <div style={{ padding: '0 16px 16px', background: '#F8FAFC' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
            {/* Métodos */}
            <div>
              <div style={S.subLabel}>Métodos de inspección</div>
              {item.metodos.map((m, i) => (
                <div key={i} style={S.chipItem}>🔧 {m}</div>
              ))}
            </div>
            {/* Normas */}
            <div>
              <div style={S.subLabel}>Normas / Especificaciones</div>
              {item.normas.map((n, i) => (
                <div key={i} style={S.chipItem}>📐 {n}</div>
              ))}
            </div>
            {/* Procedimientos */}
            <div>
              <div style={S.subLabel}>Procedimientos WSS</div>
              {item.procedimientos.map((p, i) => (
                <div key={i} style={{ ...S.chipItem, color: '#1D4ED8', fontWeight: 600 }}>📋 {p}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Acreditaciones() {
  const [acreditacionActiva, setAcreditacionActiva] = useState(null)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={S.innBadge}>INN · ILAC-MRA</div>
          <div style={{ ...S.innBadge, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
            2 Acreditaciones Vigentes
          </div>
        </div>
        <h1 style={{ marginBottom: 4 }}>🏆 Servicios Acreditados</h1>
        <p style={{ color: 'var(--gris)', fontSize: 14 }}>
          World Survey Services S.A. · José Ananías N°651, Macul, Santiago ·
          Organismo de Inspección Tipo A según NCh-ISO 17020:2012
        </p>
      </div>

      {/* Cards acreditaciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: 20, marginBottom: 28 }}>
        {ACREDITACIONES.map(ac => (
          <div key={ac.id} style={S.acCard}>
            {/* Card header */}
            <div style={{ ...S.acCardHeader, background: ac.colorPrimario }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={S.acIconBox}>{ac.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginBottom: 2 }}>
                    ACREDITACIÓN {ac.numero}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{ac.area}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>{ac.norma}</div>
                </div>
              </div>
              <BadgeVigencia hasta={ac.vigenciaHasta} />
            </div>

            {/* Info rápida */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid #F1F5F9' }}>
              <div style={S.infoCell}>
                <div style={S.infoLabel}>Desde</div>
                <div style={S.infoVal}>{formatFecha(ac.vigenciaDesde)}</div>
              </div>
              <div style={{ ...S.infoCell, borderLeft: '1px solid #F1F5F9' }}>
                <div style={S.infoLabel}>Vence</div>
                <div style={S.infoVal}>{formatFecha(ac.vigenciaHasta)}</div>
              </div>
            </div>

            {/* Alcance */}
            <div style={{ padding: '12px 0 0' }}>
              <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                Alcance · {ac.alcance.length} productos / equipos
              </div>
              {ac.alcance.map((item, i) => (
                <AlcanceRow key={i} item={item} index={i} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Nota INN */}
      <div style={S.notaBox}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>🌐</div>
          <div>
            <div style={{ fontWeight: 700, color: '#1E3A5F', marginBottom: 4 }}>Reconocimiento Internacional ILAC-MRA</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              Las acreditaciones del INN son reconocidas internacionalmente a través del acuerdo de reconocimiento mutuo de ILAC (International Laboratory Accreditation Cooperation),
              lo que garantiza la equivalencia de los servicios de inspección de WSS S.A. a nivel global.
              Vigencia acreditaciones: 1° de junio 2023 — 1° de junio 2028.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  badge: {
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
  },
  innBadge: {
    background: '#1E3A5F', color: '#fff',
    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center',
  },
  acCard: {
    background: '#fff', borderRadius: 16,
    border: '1px solid #E2E8F0',
    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    overflow: 'hidden',
  },
  acCardHeader: {
    padding: '20px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
    flexWrap: 'wrap',
  },
  acIconBox: {
    width: 48, height: 48, borderRadius: 12,
    background: 'rgba(255,255,255,.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, flexShrink: 0,
  },
  infoCell: {
    padding: '12px 16px',
  },
  infoLabel: {
    fontSize: 10, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2,
  },
  infoVal: {
    fontSize: 13, fontWeight: 600, color: '#1E293B',
  },
  alcanceBtn: {
    width: '100%', background: 'none', border: 'none',
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, cursor: 'pointer',
    textAlign: 'left',
  },
  indexBadge: {
    width: 22, height: 22, borderRadius: '50%',
    background: '#1E3A5F', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  subLabel: {
    fontSize: 10, fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '.5px',
    marginBottom: 6,
  },
  chipItem: {
    fontSize: 11, color: '#334155', padding: '3px 0', lineHeight: 1.5,
  },
  notaBox: {
    background: '#EFF6FF', border: '1px solid #BFDBFE',
    borderRadius: 12, padding: '16px 20px',
  },
}
