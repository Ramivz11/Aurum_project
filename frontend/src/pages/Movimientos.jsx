import { useState, useEffect } from 'react'
import { movimientosApi } from '../api'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const CHIP = { efectivo: 'chip-green', transferencia: 'chip-blue', tarjeta: 'chip-gray' }

const TIPO_CHIP = {
  venta: { clase: 'chip-green', label: '↑ Venta' },
  compra: { clase: 'chip-red', label: '↓ Compra' },
  gasto: { clase: 'chip-yellow', label: '⬇ Gasto' },
  ganancia: { clase: 'chip-purple', label: '★ Retiro' },
}

export function Movimientos() {
  const [ventas, setVentas] = useState([])
  const [compras, setCompras] = useState([])
  const [otros, setOtros] = useState([])
  const [resumen, setResumen] = useState(null)
  const [tipo, setTipo] = useState('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([movimientosApi.ventas(), movimientosApi.compras(), movimientosApi.otros(), movimientosApi.resumen()])
      .then(([v, c, o, r]) => { setVentas(v.data); setCompras(c.data); setOtros(o.data); setResumen(r.data) })
      .catch(err => { console.error('Error cargando movimientos:', err) })
      .finally(() => setLoading(false))
  }, [])

  const buildList = () => {
    const ventasMapped = ventas.map(v => ({ ...v, _tipo: 'venta' }))
    const comprasMapped = compras.map(c => ({ ...c, _tipo: 'compra' }))
    const otrosMapped = otros.map(x => ({ ...x, _tipo: x.tipo }))

    let lista
    switch (tipo) {
      case 'ventas': lista = ventasMapped; break
      case 'compras': lista = comprasMapped; break
      case 'gastos': lista = otrosMapped.filter(x => x._tipo === 'gasto'); break
      case 'retiros': lista = otrosMapped.filter(x => x._tipo === 'ganancia'); break
      case 'otros': lista = otrosMapped; break
      default: lista = [...ventasMapped, ...comprasMapped, ...otrosMapped]; break
    }

    return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }

  const lista = buildList()

  // Calcular totales para las tarjetas de resumen
  const totalGastos = otros.filter(x => x.tipo === 'gasto').reduce((acc, x) => acc + Number(x.monto || 0), 0)
  const totalRetiros = otros.filter(x => x.tipo === 'ganancia').reduce((acc, x) => acc + Number(x.monto || 0), 0)

  const getDescripcion = (m) => {
    switch (m._tipo) {
      case 'venta':
        return m.cliente_nombre || (m.cliente_id ? `Cliente #${m.cliente_id}` : '—')
      case 'compra':
        return m.proveedor || '—'
      case 'gasto':
        return m.descripcion || m.concepto || '—'
      case 'ganancia':
        return m.descripcion || m.nota || 'Retiro de ganancia'
      default:
        return m.descripcion || m.nota || '—'
    }
  }

  const getChipInfo = (tipoMov) => {
    return TIPO_CHIP[tipoMov] || { clase: 'chip-gray', label: tipoMov || '—' }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Movimientos</div>
        <div className="topbar-actions">
          <button className={`btn ${tipo === 'todos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipo('todos')}>Todos</button>
          <button className={`btn ${tipo === 'ventas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipo('ventas')}>Ventas</button>
          <button className={`btn ${tipo === 'compras' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipo('compras')}>Compras</button>
          <button className={`btn ${tipo === 'gastos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipo('gastos')}>Gastos</button>
          <button className={`btn ${tipo === 'retiros' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTipo('retiros')}>Retiros</button>
        </div>
      </div>
      <div className="content page-enter">
        {resumen && (
          <div className="stats-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
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
              <div className="stat-label">Total gastos</div>
              <div className="stat-value" style={{ color: 'var(--warning, #f59e0b)' }}>{fmt(totalGastos)}</div>
              <div className="stat-delta">{otros.filter(x => x.tipo === 'gasto').length} gastos</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Retiros de ganancia</div>
              <div className="stat-value" style={{ color: 'var(--purple, #a855f7)' }}>{fmt(totalRetiros)}</div>
              <div className="stat-delta">{otros.filter(x => x.tipo === 'ganancia').length} retiros</div>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-header"><span className="card-title">Listado de movimientos</span></div>
          {loading ? <div className="loading">Cargando...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>Fecha</th><th>Descripción</th><th>Pago</th><th>Monto</th></tr></thead>
                <tbody>
                  {lista.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Sin movimientos</td></tr>}
                  {lista.map((m, i) => {
                    const chipInfo = getChipInfo(m._tipo)
                    return (
                      <tr key={`${m._tipo}-${m.id}-${i}`}>
                        <td><span className={`chip ${chipInfo.clase}`}>{chipInfo.label}</span></td>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td>{getDescripcion(m)}</td>
                        <td>{m.metodo_pago ? <span className={`chip ${CHIP[m.metodo_pago] || 'chip-gray'}`}>{m.metodo_pago}</span> : <span className="chip chip-gray">—</span>}</td>
                        <td><strong style={{ color: m._tipo === 'venta' ? 'var(--success, #22c55e)' : 'var(--text)' }}>{fmt(m.total || m.monto)}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
