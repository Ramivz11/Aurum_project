import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { sucursalesApi, stockApi } from '../api/services'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS } from '../components/ui'

// ─── Modal crear/editar sucursal ──────────────────────────────────────────────
function ModalSucursal({ sucursal, onClose, onSaved }) {
  const [nombre, setNombre] = useState(sucursal?.nombre || '')
  const [loading, setLoading] = useState(false)

  const guardar = async () => {
    if (!nombre.trim()) return toast.error('El nombre es obligatorio')
    setLoading(true)
    try {
      if (sucursal) {
        await sucursalesApi.actualizar(sucursal.id, { nombre: nombre.trim() })
        toast.success('Sucursal actualizada')
      } else {
        await sucursalesApi.crear({ nombre: nombre.trim() })
        toast.success('Sucursal creada')
      }
      onSaved()
      onClose()
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') } finally { setLoading(false) }
  }

  return (
    <Modal
      title={sucursal ? 'Editar sucursal' : 'Nueva sucursal'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </>}
    >
      <div className="form-group">
        <label className="input-label">Nombre *</label>
        <input
          className="input"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && guardar()}
          placeholder="Ej: Centro, Norte, Depósito..."
          autoFocus
        />
      </div>
    </Modal>
  )
}

// ─── Card de sucursal con dashboard ──────────────────────────────────────────
function SucursalCard({ data, onEdit, onEliminar }) {
  const { sucursal, ventas_total, ticket_promedio, unidades_vendidas, porcentaje_del_total, rentabilidad } = data
  const [stockOpen, setStockOpen] = useState(false)
  const [stock, setStock] = useState([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [stockTotal, setStockTotal] = useState(null) // stock global para % por sucursal

  const toggleStock = async () => {
    if (stockOpen) { setStockOpen(false); return }
    setLoadingStock(true)
    try {
      const [sucRes, globalRes] = await Promise.all([
        stockApi.listar({ sucursal_id: sucursal.id }),
        stockApi.listar(),
      ])
      setStock(sucRes.data || [])
      const totalGlobal = (globalRes.data || []).reduce((a, p) =>
        a + (p.variantes?.reduce((b, v) => b + (v.stock_actual || 0), 0) || 0), 0)
      const totalSuc = (sucRes.data || []).reduce((a, p) =>
        a + (p.variantes?.reduce((b, v) => b + (v.stock_actual || 0), 0) || 0), 0)
      setStockTotal({ global: totalGlobal, sucursal: totalSuc })
      setStockOpen(true)
    } catch { toast.error('Error al cargar stock') } finally { setLoadingStock(false) }
  }

  const margen = ventas_total > 0 ? ((Number(rentabilidad) / Number(ventas_total)) * 100).toFixed(1) : 0

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div className="card-header" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏪</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>{sucursal.nombre}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sucursal activa</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-xs" onClick={() => onEdit(sucursal)}>✎ Editar</button>
          <button className="btn btn-danger btn-xs" onClick={() => onEliminar(sucursal)}>✕</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '16px 20px' }}>
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Ventas del mes</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--gold-light)' }}>{formatARS(ventas_total)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{unidades_vendidas} unidades</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Ticket promedio</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{formatARS(ticket_promedio)}</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Rentabilidad</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: Number(rentabilidad) > 0 ? 'var(--green)' : 'var(--red)' }}>
            {formatARS(rentabilidad)}
          </div>
          <div style={{ fontSize: 11, color: Number(margen) > 30 ? 'var(--green)' : 'var(--text-muted)', marginTop: 3 }}>{margen}% margen</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>% del total</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--gold-light)' }}>{porcentaje_del_total}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>de las ventas globales</div>
        </div>
      </div>

      {/* Barra de % ventas */}
      {porcentaje_del_total > 0 && (
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, porcentaje_del_total)}%`, height: '100%', background: 'var(--gold)', borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}

      {/* Botón stock */}
      <div style={{ padding: '0 20px 16px' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={toggleStock}
          disabled={loadingStock}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {loadingStock ? '⏳' : stockOpen ? '▾' : '▸'}
          {loadingStock ? 'Cargando stock...' : stockOpen ? 'Ocultar stock' : `Ver stock de ${sucursal.nombre}`}
        </button>

        {/* Panel de stock desplegable */}
        {stockOpen && (
          <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* % del stock total */}
            {stockTotal && (
              <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Stock en esta sucursal: <strong style={{ color: 'var(--text)' }}>{stockTotal.sucursal} uds</strong>
                    {' '}de {stockTotal.global} totales
                  </div>
                  <div style={{ height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${stockTotal.global > 0 ? Math.min(100, (stockTotal.sucursal / stockTotal.global) * 100) : 0}%`,
                      height: '100%', background: 'var(--gold)', borderRadius: 3
                    }} />
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--gold-light)' }}>
                  {stockTotal.global > 0 ? ((stockTotal.sucursal / stockTotal.global) * 100).toFixed(1) : 0}%
                </div>
              </div>
            )}

            {/* Lista de productos */}
            {stock.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Sin stock registrado en esta sucursal
              </div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PRODUCTO</th>
                      <th style={{ padding: '8px 14px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>VARIANTE</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>STOCK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.flatMap(p =>
                      (p.variantes || []).map(v => (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px', fontSize: 13 }}>
                            <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                            {p.marca && <div style={{ fontSize: 11, color: 'var(--gold-light)' }}>{p.marca}</div>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                            {[v.sabor, v.tamanio].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <span style={{
                              fontWeight: 700,
                              color: v.stock_actual <= (v.stock_minimo || 0) ? 'var(--red)' : 'var(--text)'
                            }}>{v.stock_actual}</span>
                            {v.stock_actual <= (v.stock_minimo || 0) && (
                              <span style={{ fontSize: 10, color: 'var(--red)', marginLeft: 4 }}>⚠ bajo</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function Sucursales() {
  const [comparacion, setComparacion] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)   // null | 'nueva' | sucursal object
  const [confirm, setConfirm] = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const r = await sucursalesApi.comparacion()
      setComparacion(r.data)
    } catch { toast.error('Error al cargar sucursales') } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const eliminar = async (sucursal) => {
    try {
      await sucursalesApi.eliminar(sucursal.id)
      toast.success('Sucursal eliminada')
      cargar()
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }

  return (<>
    <div className="topbar">
      <div className="page-title">Sucursales</div>
      <div className="topbar-actions">
        <button className="btn btn-primary" onClick={() => setModal('nueva')}>+ Nueva sucursal</button>
      </div>
    </div>

    <div className="page-content">
      {loading ? <Loading /> : comparacion.length === 0 ? (
        <EmptyState icon="🏪" text="No hay sucursales activas." action={
          <button className="btn btn-primary" onClick={() => setModal('nueva')}>+ Crear primera sucursal</button>
        } />
      ) : (
        comparacion.map(data => (
          <SucursalCard
            key={data.sucursal.id}
            data={data}
            onEdit={(s) => setModal(s)}
            onEliminar={(s) => setConfirm({
              msg: `¿Desactivar "${s.nombre}"? No se eliminarán sus datos históricos.`,
              fn: () => eliminar(s)
            })}
          />
        ))
      )}
    </div>

    {modal && (
      <ModalSucursal
        sucursal={modal === 'nueva' ? null : modal}
        onClose={() => setModal(null)}
        onSaved={cargar}
      />
    )}
    {confirm && (
      <ConfirmDialog
        message={confirm.msg}
        onConfirm={() => { confirm.fn(); setConfirm(null) }}
        onCancel={() => setConfirm(null)}
      />
    )}
  </>)
}
