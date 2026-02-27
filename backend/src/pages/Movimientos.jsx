import { useState, useEffect } from 'react'
import { movimientosApi } from '../api'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const CHIP = { efectivo: 'chip-green', transferencia: 'chip-blue', tarjeta: 'chip-gray' }

export function Movimientos() {
  const [ventas, setVentas] = useState([])
  const [compras, setCompras] = useState([])
  const [resumen, setResumen] = useState(null)
  const [tipo, setTipo] = useState('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([movimientosApi.ventas(), movimientosApi.compras(), movimientosApi.resumen()])
      .then(([v, c, r]) => { setVentas(v); setCompras(c); setResumen(r) })
      .finally(() => setLoading(false))
  }, [])

  const lista = tipo === 'ventas' ? ventas.map(v => ({ ...v, _tipo: 'venta' }))
    : tipo === 'compras' ? compras.map(c => ({ ...c, _tipo: 'compra' }))
    : [...ventas.map(v => ({ ...v, _tipo: 'venta' })), ...compras.map(c => ({ ...c, _tipo: 'compra' }))]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  return (
    <>
      <div className="topbar">
        <div className="page-title">Movimientos</div>
        <div className="topbar-actions">
          <button className={`btn ${tipo === 'todos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipo('todos')}>Todos</button>
          <button className={`btn ${tipo === 'ventas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipo('ventas')}>Ventas</button>
          <button className={`btn ${tipo === 'compras' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipo('compras')}>Compras</button>
        </div>
      </div>
      <div className="content page-enter">
        {resumen && (
          <div className="stats-grid-3">
            <div className="stat-card">
              <div className="stat-label">Total ventas</div>
              <div className="stat-value gold">{fmt(resumen.total_ventas)}</div>
              <div className="stat-delta">{resumen.cantidad_ventas} ventas</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Ticket promedio</div>
              <div className="stat-value">{fmt(resumen.ticket_promedio)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Producto más vendido</div>
              <div className="stat-value" style={{ fontSize: 16 }}>{resumen.producto_mas_vendido || '—'}</div>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-header"><span className="card-title">Listado de movimientos</span></div>
          {loading ? <div className="loading">Cargando...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>Fecha</th><th>Cliente/Proveedor</th><th>Pago</th><th>Total</th></tr></thead>
                <tbody>
                  {lista.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Sin movimientos</td></tr>}
                  {lista.map((m, i) => (
                    <tr key={`${m._tipo}-${m.id}-${i}`}>
                      <td><span className={`chip ${m._tipo === 'venta' ? 'chip-green' : 'chip-red'}`}>{m._tipo === 'venta' ? '↑ Venta' : '↓ Compra'}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{m._tipo === 'venta' ? (m.cliente_nombre || (m.cliente_id ? `Cliente #${m.cliente_id}` : '—')) : (m.proveedor || '—')}</td>
                      <td><span className={`chip ${CHIP[m.metodo_pago]}`}>{m.metodo_pago}</span></td>
                      <td><strong>{fmt(m.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}