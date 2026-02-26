import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { finanzasApi, ventasApi, recordatoriosApi, clientesApi } from '../api'
import { useToast } from '../components/Toast'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`

const PRIORIDAD_CONFIG = {
  alta:  { color: 'var(--red)',        bg: 'rgba(224,85,85,0.1)',     label: 'Alta',  dot: '🔴' },
  media: { color: 'var(--gold)',       bg: 'rgba(201,168,76,0.1)',    label: 'Media', dot: '🟡' },
  baja:  { color: 'var(--text-muted)', bg: 'rgba(122,118,114,0.1)',   label: 'Baja',  dot: '⚪' },
}

function Recordatorios() {
  const toast = useToast()
  const [todos, setTodos] = useState([])
  const [expandido, setExpandido] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', prioridad: 'alta' })
  const [saving, setSaving] = useState(false)

  const cargar = () => {
    recordatoriosApi.listar({ solo_pendientes: true }).then(setTodos).catch(() => {})
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
          {altas.length > 0 && (
            <span style={{ background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
              {altas.length}
            </span>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕' : '+ Nuevo'}
        </button>
      </div>

      {showForm && (
        <div style={{ margin: '0 20px 12px', padding: 14, background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <input
            className="form-input" style={{ marginBottom: 8 }}
            placeholder="Título del recordatorio..."
            value={form.titulo}
            onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && crear()}
            autoFocus
          />
          <input
            className="form-input" style={{ marginBottom: 10 }}
            placeholder="Descripción (opcional)"
            value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {['alta', 'media', 'baja'].map(p => (
              <button key={p} onClick={() => setForm(f => ({ ...f, prioridad: p }))} style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                borderColor: form.prioridad === p ? PRIORIDAD_CONFIG[p].color : 'var(--border)',
                background: form.prioridad === p ? PRIORIDAD_CONFIG[p].bg : 'transparent',
                color: form.prioridad === p ? PRIORIDAD_CONFIG[p].color : 'var(--text-muted)',
              }}>
                {PRIORIDAD_CONFIG[p].dot} {PRIORIDAD_CONFIG[p].label}
              </button>
            ))}
            <button className="btn btn-primary btn-sm" onClick={crear} disabled={saving} style={{ marginLeft: 4 }}>
              {saving ? '...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      <div>
        {altas.length === 0 && !expandido && (
          <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            Sin recordatorios de alta prioridad 🎉
          </div>
        )}
        {visibles.map(r => {
          const cfg = PRIORIDAD_CONFIG[r.prioridad]
          return (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '11px 20px', borderBottom: '1px solid var(--border)',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 4, background: cfg.color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.titulo}</div>
                {r.descripcion && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.descripcion}
                  </div>
                )}
                <div style={{ fontSize: 10, color: cfg.color, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  {cfg.label}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => completar(r.id)} title="Completar"
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--green)', cursor: 'pointer', padding: '4px 8px', fontSize: 11 }}>✓</button>
                <button onClick={() => eliminar(r.id)} title="Eliminar"
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 6px', fontSize: 13 }}>✕</button>
              </div>
            </div>
          )
        })}
      </div>

      {mediaYBaja.length > 0 && (
        <button onClick={() => setExpandido(v => !v)} style={{
          width: '100%', padding: '10px 20px', background: 'none', border: 'none',
          borderTop: '1px solid var(--border)', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 12, textAlign: 'left',
        }}>
          {expandido ? '▲ Mostrar solo alta prioridad' : `▼ Ver ${mediaYBaja.length} más (media y baja)`}
        </button>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [analisis, setAnalisis] = useState(null)
  const [liquidez, setLiquidez] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      finanzasApi.analisisMes(),
      finanzasApi.liquidez(),
      finanzasApi.productosTop({ limite: 5 }),
      ventasApi.pedidosAbiertos(),
      clientesApi.listar(),
    ]).then(([a, l, p, pd, cli]) => {
      setAnalisis(a); setLiquidez(l); setTopProducts(p); setPedidos(pd)

      const mapa = {}
      ;(cli || []).forEach((c) => {
        mapa[c.id] = c.nombre
        mapa[String(c.id)] = c.nombre
      })
      setClientes(mapa)
      setAnalisis(a); setLiquidez(l); setTopProducts(p); setPedidos(pd)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const mes = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  if (loading) return <div className="topbar"><div className="page-title">Dashboard</div></div>

  return (
    <>
      <div className="topbar">
        <div className="page-title">Dashboard</div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" style={{ textTransform: 'capitalize' }}>{mes}</button>
          <button className="btn btn-primary" onClick={() => navigate('/ventas')}>+ Nueva venta</button>
        </div>
      </div>

      <div className="content page-enter">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Ventas del mes</div><div className="stat-value gold">{fmt(analisis?.ingresos)}</div></div>
          <div className="stat-card"><div className="stat-label">Ganancia neta</div><div className={`stat-value ${analisis?.neto >= 0 ? 'green' : 'red'}`}>{fmt(analisis?.neto)}</div></div>
          <div className="stat-card"><div className="stat-label">Egresos (compras)</div><div className="stat-value red">{fmt(analisis?.compras)}</div></div>
          <div className="stat-card"><div className="stat-label">Gastos operativos</div><div className="stat-value">{fmt(analisis?.gastos)}</div></div>
        </div>

        <div className="grid-3-1">
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
                    <div className="rank-sub">{[p.sabor, p.tamanio].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="rank-metrics">
                    <div className="rank-ingreso">{fmt(p.ingreso_total)}</div>
                    <div className="rank-margen">{p.margen_porcentaje}% margen</div>
                  </div>
                </div>
              ))
            }
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pedidos abiertos</span>
              {pedidos.length > 0 && <span className="chip chip-gold">{pedidos.length} pendientes</span>}
            </div>
            <div className="card-body" style={{ padding: '14px' }}>
              {pedidos.length === 0 ? <div className="empty">Sin pedidos abiertos</div>
                : pedidos.slice(0, 4).map(p => (
                  <div className="pedido-card" key={p.id} onClick={() => navigate('/ventas')}>
                    <div style={{ fontSize: 20 }}>🛒</div>
                                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {p.cliente_nombre || (p.cliente_id ? (clientes[p.cliente_id] || clientes[String(p.cliente_id)] || `Cliente #${p.cliente_id}`) : 'Sin cliente')}
                      </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.items?.length || 0} productos</div>
                    </div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(p.total)}</div></div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        <Recordatorios />

        {liquidez && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Liquidez actual</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/finanzas')}>Ver finanzas</button>
            </div>
            <div className="card-body">
              <div className="liquidez-grid">
                <div className="liq-item"><div className="liq-label">💵 Efectivo</div><div className="liq-val">{fmt(liquidez.efectivo)}</div></div>
                <div className="liq-item"><div className="liq-label">🏦 Transferencia</div><div className="liq-val">{fmt(liquidez.transferencia)}</div></div>
                <div className="liq-item"><div className="liq-label">💳 Tarjeta</div><div className="liq-val">{fmt(liquidez.tarjeta)}</div></div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total disponible</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--gold-light)', marginTop: 4 }}>{fmt(liquidez.total)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
