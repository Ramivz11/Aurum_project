import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { finanzasApi, ventasApi } from '../api'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`

export default function Dashboard() {
  const [analisis, setAnalisis] = useState(null)
  const [liquidez, setLiquidez] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      finanzasApi.analisisMes(),
      finanzasApi.liquidez(),
      finanzasApi.productosTop({ limite: 5 }),
      ventasApi.pedidosAbiertos(),
    ]).then(([a, l, p, pd]) => {
      setAnalisis(a)
      setLiquidez(l)
      setTopProducts(p)
      setPedidos(pd)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const mes = now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  if (loading) return (
    <div className="topbar"><div className="page-title">Dashboard</div></div>
  )

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
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Ventas del mes</div>
            <div className="stat-value gold">{fmt(analisis?.ingresos)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ganancia neta</div>
            <div className={`stat-value ${analisis?.neto >= 0 ? 'green' : 'red'}`}>{fmt(analisis?.neto)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Egresos (compras)</div>
            <div className="stat-value red">{fmt(analisis?.compras)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Gastos operativos</div>
            <div className="stat-value">{fmt(analisis?.gastos)}</div>
          </div>
        </div>

        <div className="grid-3-1">
          {/* Productos top */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Productos más vendidos</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mes}</span>
            </div>
            {topProducts.length === 0
              ? <div className="empty">Sin ventas este mes</div>
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

          {/* Pedidos abiertos */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pedidos abiertos</span>
              {pedidos.length > 0 && <span className="chip chip-gold">{pedidos.length} pendientes</span>}
            </div>
            <div className="card-body" style={{ padding: '14px' }}>
              {pedidos.length === 0
                ? <div className="empty">Sin pedidos abiertos</div>
                : pedidos.slice(0, 4).map(p => (
                  <div className="pedido-card" key={p.id} onClick={() => navigate('/ventas')}>
                    <div style={{ fontSize: 20 }}>🛒</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.cliente_id ? `Cliente #${p.cliente_id}` : 'Sin cliente'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.items?.length || 0} productos</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(p.total)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Liquidez */}
        {liquidez && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Liquidez actual</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/finanzas')}>Ver finanzas</button>
            </div>
            <div className="card-body">
              <div className="liquidez-grid">
                <div className="liq-item">
                  <div className="liq-label">💵 Efectivo</div>
                  <div className="liq-val">{fmt(liquidez.efectivo)}</div>
                </div>
                <div className="liq-item">
                  <div className="liq-label">🏦 Transferencia</div>
                  <div className="liq-val">{fmt(liquidez.transferencia)}</div>
                </div>
                <div className="liq-item">
                  <div className="liq-label">💳 Tarjeta</div>
                  <div className="liq-val">{fmt(liquidez.tarjeta)}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total disponible</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--gold-light)', marginTop: 4 }}>
                  {fmt(liquidez.total)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
