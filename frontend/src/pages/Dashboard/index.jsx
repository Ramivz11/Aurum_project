import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { finanzasApi, ventasApi, recordatoriosApi, deudasApi } from '../../api'
import { useMarca } from '../../context/MarcaContext'
import { useToast } from '../../components/Toast'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0'

const PRIORIDAD_CONFIG = {
  alta:  { color: 'var(--red)',        bg: 'rgba(224,85,85,0.1)',   label: 'Alta',  dot: '🔴' },
  media: { color: 'var(--gold)',       bg: 'rgba(201,168,76,0.1)',  label: 'Media', dot: '🟡' },
  baja:  { color: 'var(--text-muted)', bg: 'rgba(122,118,114,0.1)', label: 'Baja',  dot: '⚪' },
}

/* ═══════════════════════════════════════════════════════════════════════════
   MINI BAR CHART — barras verticales con animación
   ═══════════════════════════════════════════════════════════════════════════ */
function MiniBarChart({ data = [], color = 'var(--gold)', height = 48 }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, width: '100%' }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.label}: ${fmt(d.value)}`} style={{
          flex: 1, borderRadius: '3px 3px 0 0', minWidth: 4, cursor: 'default',
          height: `${Math.max(4, (d.value / max) * 100)}%`,
          background: color, opacity: 0.25 + (d.value / max) * 0.75,
          transition: 'height 0.5s ease',
        }} />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO STAT — tarjeta destacada con icono, valor y delta
   ═══════════════════════════════════════════════════════════════════════════ */
function HeroStat({ icon, label, value, sub, accent, gradient, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={{
      background: gradient || undefined, cursor: onClick ? 'pointer' : 'default',
      borderColor: accent ? `${accent}33` : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span className="stat-label" style={{ margin: 0 }}>{label}</span>
      </div>
      <div className="stat-value" style={{ color: accent || 'var(--gold-light)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: accent ? `${accent}99` : 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sub}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECORDATORIOS
   ═══════════════════════════════════════════════════════════════════════════ */
function Recordatorios() {
  const toast = useToast()
  const [todos, setTodos] = useState([])
  const [expandido, setExpandido] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', prioridad: 'alta' })
  const [saving, setSaving] = useState(false)

  const cargar = () => {
    recordatoriosApi.listar({ solo_pendientes: true }).then(res => setTodos(res.data)).catch(() => {})
  }
  useEffect(() => { cargar() }, [])

  const altas = todos.filter(r => r.prioridad === 'alta')
  const mediaYBaja = todos.filter(r => r.prioridad !== 'alta')
  const visibles = expandido ? todos : altas

  const completar = async (id) => {
    try { await recordatoriosApi.completar(id); setTodos(p => p.filter(r => r.id !== id)) }
    catch (e) { toast(e.message, 'error') }
  }
  const eliminar = async (id) => {
    try { await recordatoriosApi.eliminar(id); setTodos(p => p.filter(r => r.id !== id)) }
    catch (e) { toast(e.message, 'error') }
  }
  const crear = async () => {
    if (!form.titulo.trim()) return toast('Escribí un título', 'error')
    setSaving(true)
    try {
      await recordatoriosApi.crear(form)
      toast('Recordatorio creado')
      setForm({ titulo: '', descripcion: '', prioridad: 'alta' })
      setShowForm(false)
      cargar()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="card-title">Recordatorios</span>
          {altas.length > 0 && <span style={{ background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{altas.length}</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(v => !v)}>{showForm ? '✕' : '+ Nuevo'}</button>
      </div>
      {showForm && (
        <div style={{ margin: '0 20px 12px', padding: 14, background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <input className="form-input" style={{ marginBottom: 8 }} placeholder="Título del recordatorio..." value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} onKeyDown={e => e.key === 'Enter' && crear()} autoFocus />
          <input className="form-input" style={{ marginBottom: 10 }} placeholder="Descripción (opcional)" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {['alta', 'media', 'baja'].map(p => (
              <button key={p} onClick={() => setForm(f => ({ ...f, prioridad: p }))} style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                borderColor: form.prioridad === p ? PRIORIDAD_CONFIG[p].color : 'var(--border)',
                background: form.prioridad === p ? PRIORIDAD_CONFIG[p].bg : 'transparent',
                color: form.prioridad === p ? PRIORIDAD_CONFIG[p].color : 'var(--text-muted)',
              }}>{PRIORIDAD_CONFIG[p].dot} {PRIORIDAD_CONFIG[p].label}</button>
            ))}
            <button className="btn btn-primary btn-sm" onClick={crear} disabled={saving} style={{ marginLeft: 4 }}>{saving ? '...' : 'Agregar'}</button>
          </div>
        </div>
      )}
      <div>
        {altas.length === 0 && !expandido && <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: 13 }}>Sin recordatorios de alta prioridad 🎉</div>}
        {visibles.map(r => {
          const cfg = PRIORIDAD_CONFIG[r.prioridad]
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 4, background: cfg.color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.titulo}</div>
                {r.descripcion && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion}</div>}
                <div style={{ fontSize: 10, color: cfg.color, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{cfg.label}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => completar(r.id)} title="Completar" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--green)', cursor: 'pointer', padding: '4px 8px', fontSize: 11 }}>✓</button>
                <button onClick={() => eliminar(r.id)} title="Eliminar" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 6px', fontSize: 13 }}>✕</button>
              </div>
            </div>
          )
        })}
      </div>
      {mediaYBaja.length > 0 && (
        <button onClick={() => setExpandido(v => !v)} style={{ width: '100%', padding: '10px 20px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
          {expandido ? '▲ Mostrar solo alta prioridad' : `▼ Ver ${mediaYBaja.length} más (media y baja)`}
        </button>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [analisis, setAnalisis] = useState(null)
  const [liquidez, setLiquidez] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [resumenDia, setResumenDia] = useState(null)
  const [gastos, setGastos] = useState([])
  const [deudas, setDeudas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const navigate = useNavigate()
  const { getStyles } = useMarca()

  useEffect(() => {
    setLoading(true)
    const [year, month] = selectedMonth.split('-').map(Number)
    Promise.all([
      finanzasApi.analisisMes({ mes: month, anio: year }),
      finanzasApi.liquidez(),
      finanzasApi.productosTop({ limite: 5, mes: month, anio: year }),
      ventasApi.pedidosAbiertos(),
      finanzasApi.resumenDia(),
      finanzasApi.listarGastos({ mes: month, anio: year }),
      deudasApi.resumen().catch(() => ({ data: null })),
    ]).then(([a, l, p, pd, rd, g, de]) => {
      setAnalisis(a.data); setLiquidez(l.data); setTopProducts(p.data)
      setPedidos(pd.data); setResumenDia(rd.data); setGastos(g.data)
      setDeudas(de.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [selectedMonth])

  const [selYear, selMonth] = selectedMonth.split('-').map(Number)
  const mes = new Date(selYear, selMonth - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    const d = new Date(selYear, selMonth - 2, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(selYear, selMonth, 1)
    const now = new Date()
    if (d <= new Date(now.getFullYear(), now.getMonth() + 1, 0)) {
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12, animation: 'fadeIn 0.5s' }}>◈</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando dashboard...</div>
      </div>
    </div>
  )

  // Datos procesados
  const ingresos = Number(analisis?.ingresos || 0)
  const compras = Number(analisis?.compras || 0)
  const gastosTotal = Number(analisis?.gastos || 0)
  const neto = Number(analisis?.neto || 0)
  const ganancia = Number(analisis?.ganancia || 0)
  const margen = Number(analisis?.margen_promedio || 0)
  const gananciaNeta = Number(liquidez?.ganancia_acumulada || 0)
  const ingresosHoy = Number(resumenDia?.ingresos_hoy || 0)
  const tendencia = resumenDia?.tendencia_mensual || []

  // Mini chart data
  const chartData = tendencia.map((v, i) => ({ label: `Día ${i + 1}`, value: v }))

  return (
    <>
      <div className="topbar">
        <div className="page-title">Dashboard</div>
        <div className="topbar-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="btn btn-ghost" style={{ padding: '6px 8px', fontSize: 16 }} onClick={prevMonth}>◀</button>
            <button className="btn btn-ghost" style={{ textTransform: 'capitalize', minWidth: 140, justifyContent: 'center' }}
              onClick={() => document.getElementById('dash-month-input')?.showPicker?.() || document.getElementById('dash-month-input')?.click()}>
              {mes}
            </button>
            <input id="dash-month-input" type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ display: 'none' }} />
            <button className="btn btn-ghost" style={{ padding: '6px 8px', fontSize: 16 }} onClick={nextMonth}>▶</button>
            <button className="btn btn-primary" onClick={() => navigate('/ventas')}>+ Nueva venta</button>
          </div>
        </div>
      </div>

      <div className="content page-enter">

        {/* ─── FILA 1: KPIs HERO ──────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
          <HeroStat icon="💰" label="Ventas del mes" value={fmt(ingresos)} sub={`${analisis?.periodo || ''}`} accent="#ffb74d" />
          <HeroStat icon="📊" label="Neto" value={fmt(neto)} sub={neto >= 0 ? 'positivo' : 'negativo'} accent={neto >= 0 ? '#22c55e' : '#ef4444'} />
          <HeroStat icon="📈" label="Ganancia bruta" value={fmt(ganancia)}
            sub={`${margen}% margen`}
            accent="#22c55e"
            gradient="linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))" />
          <HeroStat icon="🏷️" label="Compras" value={fmt(compras)} accent="#ef4444" />
          <HeroStat icon="⚡" label="Gastos operativos" value={fmt(gastosTotal)} accent="#f59e0b" />
          {gananciaNeta > 0 && (
            <HeroStat icon="💎" label="Ganancia acumulada" value={fmt(gananciaNeta)}
              sub="disponible para extraer" accent="#3b82f6"
              gradient="linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))"
              onClick={() => navigate('/finanzas')} />
          )}
        </div>

        {/* ─── FILA 2: INGRESOS HOY + TENDENCIA ──────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18, marginBottom: 18 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Hoy</span></div>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Ingresos del día</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--gold-light)' }}>{fmt(ingresosHoy)}</div>
              {resumenDia?.delta_hoy != null && (
                <div style={{ fontSize: 12, marginTop: 8, color: resumenDia.delta_hoy >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {resumenDia.delta_hoy >= 0 ? '▲' : '▼'} {Math.abs(resumenDia.delta_hoy)}% vs ayer
                </div>
              )}
              {resumenDia?.margen_promedio > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Margen catálogo: {resumenDia.margen_promedio}%</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Tendencia mensual</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tendencia.length} días</span>
            </div>
            <div className="card-body">
              {chartData.length > 0
                ? <MiniBarChart data={chartData} color="var(--gold)" height={80} />
                : <div className="empty">Sin datos de tendencia</div>
              }
            </div>
          </div>
        </div>

        {/* ─── FILA 3: PRODUCTOS TOP + PEDIDOS + LIQUIDEZ ────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Productos más vendidos</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mes}</span>
            </div>
            {topProducts.length === 0 ? <div className="empty">Sin ventas este mes</div>
              : topProducts.map((p, i) => (
                <div className="product-rank" key={p.variante_id}>
                  <div className={`rank-num${i === 0 ? ' gold' : ''}`}>{i + 1}</div>
                  <div className="rank-info">
                    <div className="rank-name">{p.nombre_producto}</div>
                    <div className="rank-sub">
                      {p.marca && (() => { const s = getStyles(p.marca); return <span className="brand-badge" style={{ '--brand-color': s.color, '--brand-bg': s.background, '--brand-border': s.border, marginRight: 4 }}>{p.marca}</span> })()}
                      {[p.sabor, p.tamanio].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="rank-metrics">
                    <div className="rank-ingreso">{fmt(p.ingreso_total)}</div>
                    <div className="rank-margen">{p.margen_porcentaje}% margen</div>
                  </div>
                </div>
              ))
            }
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Pedidos abiertos */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <span className="card-title">Pedidos abiertos</span>
                {pedidos.length > 0 && <span className="chip chip-gold">{pedidos.length}</span>}
              </div>
              <div className="card-body" style={{ padding: 14 }}>
                {pedidos.length === 0 ? <div className="empty" style={{ padding: '20px 10px' }}>Sin pedidos abiertos</div>
                  : pedidos.slice(0, 3).map(p => (
                    <div className="pedido-card" key={p.id} onClick={() => navigate('/ventas')}>
                      <div style={{ fontSize: 18 }}>🛒</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.cliente_nombre || 'Sin cliente'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.items?.length || 0} productos</div>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(p.total)}</div>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Gastos recientes */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <span className="card-title">Últimos gastos</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/finanzas')}>Ver todos</button>
              </div>
              {gastos.length === 0 ? <div className="empty" style={{ padding: '16px 10px' }}>Sin gastos</div>
                : gastos.slice(0, 3).map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{g.concepto}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(g.fecha).toLocaleDateString('es-AR')}</div>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--red)', fontSize: 13 }}>-{fmt(g.monto)}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* ─── FILA 4: LIQUIDEZ + RECORDATORIOS ──────────────────────── */}
        <div className="grid-2">
          {liquidez && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Liquidez actual</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/finanzas')}>Finanzas</button>
              </div>
              <div className="card-body">
                <div className="liquidez-grid">
                  <div className="liq-item"><div className="liq-label">💵 Efectivo</div><div className="liq-val">{fmt(liquidez.efectivo)}</div></div>
                  <div className="liq-item"><div className="liq-label">🏦 Transferencia</div><div className="liq-val">{fmt(liquidez.transferencia)}</div></div>
                  <div className="liq-item"><div className="liq-label">💳 Tarjeta</div><div className="liq-val">{fmt(liquidez.tarjeta)}</div></div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total disponible</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--gold-light)', marginTop: 4 }}>{fmt(liquidez.total)}</div>
                </div>
              </div>
            </div>
          )}

          <Recordatorios />
        </div>

        {/* ─── FILA 5: DEUDAS RESUMEN (si existe) ────────────────────── */}
        {deudas && (Number(deudas.total_por_cobrar || 0) > 0 || Number(deudas.total_por_pagar || 0) > 0) && (
          <div className="card" onClick={() => navigate('/finanzas')} style={{ cursor: 'pointer' }}>
            <div className="card-header"><span className="card-title">Deudas pendientes</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
                {Number(deudas.total_por_cobrar || 0) > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Por cobrar</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{fmt(deudas.total_por_cobrar)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{deudas.cantidad_por_cobrar || 0} pendientes</div>
                  </div>
                )}
                {Number(deudas.total_por_pagar || 0) > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Por pagar</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>{fmt(deudas.total_por_pagar)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{deudas.cantidad_por_pagar || 0} pendientes</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
