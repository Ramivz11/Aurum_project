import { useState, useEffect } from 'react'
import { sucursalesApi, deudasApi } from '../api'
import { useToast } from '../components/Toast'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`

function ModalDeuda({ onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ tipo: 'por_cobrar', cliente_proveedor: '', monto: '', concepto: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.cliente_proveedor || !form.monto) return toast('Completá los campos obligatorios', 'error')
    setSaving(true)
    try {
      await deudasApi.crear({ ...form, monto: parseFloat(form.monto) })
      toast('Deuda registrada')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Nueva deuda</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={form.tipo} onChange={e => setF('tipo', e.target.value)}>
              <option value="por_cobrar">Por cobrar</option>
              <option value="por_pagar">Por pagar</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cliente / Proveedor *</label>
            <input className="form-input" value={form.cliente_proveedor} onChange={e => setF('cliente_proveedor', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Monto ($) *</label>
            <input className="form-input" type="number" value={form.monto} onChange={e => setF('monto', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Concepto</label>
            <input className="form-input" value={form.concepto} onChange={e => setF('concepto', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={form.notas} onChange={e => setF('notas', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

export function Sucursales() {
  const toast = useToast()
  const [comparacion, setComparacion] = useState([])
  const [deudas, setDeudas] = useState([])
  const [resumenDeudas, setResumenDeudas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalDeuda, setModalDeuda] = useState(false)

  const cargar = () => {
    setLoading(true)
    Promise.all([sucursalesApi.comparacion(), deudasApi.listar(), deudasApi.resumen()])
      .then(([c, d, r]) => { setComparacion(c); setDeudas(d); setResumenDeudas(r) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [])

  const saldar = async (id) => {
    try { await deudasApi.saldar(id); toast('Deuda saldada'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const eliminarDeuda = async (id) => {
    if (!confirm('¿Eliminar esta deuda?')) return
    try { await deudasApi.eliminar(id); toast('Deuda eliminada'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Sucursales</div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setModalDeuda(true)}>+ Nueva deuda</button>
        </div>
      </div>
      <div className="content page-enter">
        {/* Comparación */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Comparación — mes actual</span></div>
          <div style={{ padding: '16px 20px' }}>
            {loading ? <div className="loading">Cargando...</div> : comparacion.length === 0 ? <div className="empty">Sin datos</div> : comparacion.map((s, i) => (
              <div className="suc-card" key={s.sucursal.id}>
                <div className={`suc-rank${i === 0 ? ' first' : ''}`}>{i + 1}</div>
                <div className="suc-details">
                  <div className="suc-name">{s.sucursal.nombre}</div>
                  <div className="suc-metrics">
                    <div><div className="suc-metric-val" style={{ color: i === 0 ? 'var(--gold-light)' : 'inherit' }}>{fmt(s.ventas_total)}</div><div className="suc-metric-label">Ventas</div></div>
                    <div><div className="suc-metric-val">{fmt(s.ticket_promedio)}</div><div className="suc-metric-label">Ticket prom.</div></div>
                    <div><div className="suc-metric-val">{s.unidades_vendidas}</div><div className="suc-metric-label">Unidades</div></div>
                    <div><div className="suc-metric-val" style={{ color: 'var(--green)' }}>{fmt(s.rentabilidad)}</div><div className="suc-metric-label">Rentabilidad</div></div>
                    <div><div className="suc-metric-val">{s.porcentaje_del_total}%</div><div className="suc-metric-label">% del total</div></div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${s.porcentaje_del_total}%`, background: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--blue)' : 'var(--text-dim)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deudas */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Gestión de deudas</span>
            {resumenDeudas && (
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span style={{ color: 'var(--green)' }}>↑ Por cobrar: <strong>{fmt(resumenDeudas.por_cobrar)}</strong></span>
                <span style={{ color: 'var(--red)' }}>↓ Por pagar: <strong>{fmt(resumenDeudas.por_pagar)}</strong></span>
              </div>
            )}
          </div>
          {deudas.length === 0 ? <div className="empty">Sin deudas pendientes</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>Cliente/Proveedor</th><th>Monto</th><th>Concepto</th><th></th></tr></thead>
                <tbody>
                  {deudas.map(d => (
                    <tr key={d.id}>
                      <td><span className={`chip ${d.tipo === 'por_cobrar' ? 'chip-green' : 'chip-red'}`}>{d.tipo === 'por_cobrar' ? 'Por cobrar' : 'Por pagar'}</span></td>
                      <td><strong>{d.cliente_proveedor}</strong></td>
                      <td><strong>{fmt(d.monto)}</strong></td>
                      <td style={{ color: 'var(--text-muted)' }}>{d.concepto || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => saldar(d.id)}>Saldar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => eliminarDeuda(d.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {modalDeuda && <ModalDeuda onClose={() => setModalDeuda(false)} onSaved={() => { setModalDeuda(false); cargar() }} />}
    </>
  )
}
