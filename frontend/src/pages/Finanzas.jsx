import { useState, useEffect } from 'react'
import { finanzasApi } from '../api'
import { useToast } from '../components/Toast'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`

function ModalGasto({ categorias, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ concepto: '', categoria_id: '', monto: '', metodo_pago: 'efectivo', notas: '' })
  const [saving, setSaving] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.concepto || !form.monto) return toast('Completá concepto y monto', 'error')
    setSaving(true)
    try {
      await finanzasApi.crearGasto({ ...form, monto: parseFloat(form.monto), categoria_id: form.categoria_id || null })
      toast('Gasto registrado')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Registrar gasto</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Concepto *</label>
            <input className="form-input" value={form.concepto} onChange={e => setF('concepto', e.target.value)} placeholder="Ej: Publicidad Instagram" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.categoria_id} onChange={e => setF('categoria_id', e.target.value)}>
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Monto ($) *</label>
              <input className="form-input" type="number" value={form.monto} onChange={e => setF('monto', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Método de pago</label>
            <select className="form-select" value={form.metodo_pago} onChange={e => setF('metodo_pago', e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
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

export function Finanzas() {
  const toast = useToast()
  const [liquidez, setLiquidez] = useState(null)
  const [analisis, setAnalisis] = useState(null)
  const [top, setTop] = useState([])
  const [gastos, setGastos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalGasto, setModalGasto] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [ajuste, setAjuste] = useState({ tipo: 'efectivo', monto_nuevo: '', nota: '' })
  const [gananciaNota, setGananciaNota] = useState('')
  const [limpiandoGanancia, setLimpiandoGanancia] = useState(false)

  const handleLimpiarGanancia = async () => {
    if (limpiandoGanancia) return
    if (!liquidez || Number(liquidez.ganancia_acumulada) <= 0) return toast('No hay ganancia para limpiar', 'error')
    if (!window.confirm('¿Confirmas separar la ganancia acumulada?')) return
    setLimpiandoGanancia(true)
    try {
      const nota = gananciaNota.trim() || null
      const res = await finanzasApi.limpiarGanancia(nota)
      if (res?.data?.ok) {
        toast(`Se separaron ${fmt(res.data.monto_extraido)}`)
        setGananciaNota('')
        cargar()
      } else {
        toast('No se pudo separar la ganancia', 'error')
      }
    } catch (e) {
      console.error('Error al limpiar ganancia:', e)
      toast(e.message || 'Error al separar la ganancia', 'error')
    } finally {
      setLimpiandoGanancia(false)
    }
  }

  const cargar = () => {
    setLoading(true)
    Promise.all([finanzasApi.liquidez(), finanzasApi.analisisMes(), finanzasApi.productosTop(), finanzasApi.listarGastos(), finanzasApi.categoriasGasto()])
      .then(([l, a, t, g, c]) => { setLiquidez(l.data); setAnalisis(a.data); setTop(t.data); setGastos(g.data); setCategorias(c.data) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [])

  const guardarAjuste = async () => {
    try {
      const valid = ['efectivo', 'transferencia', 'tarjeta', 'ganancia']
      if (!valid.includes(ajuste.tipo)) return toast('Tipo inválido. Seleccioná efectivo, transferencia, tarjeta o ganancia', 'error')
      const monto = parseFloat(ajuste.monto_nuevo)
      if (isNaN(monto)) return toast('Ingresá un monto numérico válido', 'error')
      await finanzasApi.ajustarSaldo({ tipo: ajuste.tipo, monto_nuevo: monto, nota: ajuste.nota })
      toast('Saldo ajustado')
      setModalAjuste(false)
      cargar()
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data || e?.message || 'Error al ajustar saldo'
      toast(msg, 'error')
    }
  }

  const maxIngreso = Math.max(Number(analisis?.ingresos || 0), 1)

  return (
    <>
      <div className="topbar">
        <div className="page-title">Finanzas</div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setModalAjuste(true)}>Ajustar saldo</button>
          <button className="btn btn-primary" onClick={() => setModalGasto(true)}>+ Registrar gasto</button>
        </div>
      </div>
      <div className="content page-enter">
        {/* Liquidez */}
        {liquidez && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Liquidez actual</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>saldos calculados desde el inicio</span>
            </div>
            <div className="card-body">

              {/* Cuentas principales */}
              <div className="liquidez-grid">
                <div className="liq-item">
                  <div className="liq-label">💵 Efectivo</div>
                  <div className="liq-val">{fmt(liquidez.efectivo)}</div>
                </div>
                <div className="liq-item">
                  <div className="liq-label">🏦 Banco / Transferencia</div>
                  <div className="liq-val">{fmt(liquidez.transferencia)}</div>
                </div>
                <div className="liq-item">
                  <div className="liq-label">💳 Tarjeta</div>
                  <div className="liq-val">{fmt(liquidez.tarjeta)}</div>
                </div>
                <div className="liq-item">
                  <div className="liq-label">💰 Ganancia neta</div>
                  <div className="liq-val">{fmt(liquidez.ganancia_acumulada)}</div>
                </div>
              </div>

              {/* Desglose de ganancia */}
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,152,0,0.06)', borderRadius: 10, border: '1px solid rgba(255,152,0,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Desglose de ganancia</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ganancia bruta del mes</span>
                    <span style={{ fontWeight: 600, color: '#ffb74d' }}>{fmt(liquidez.ganancia_bruta_mes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ganancia bruta total (histórica)</span>
                    <span style={{ fontWeight: 600, color: '#ff9800' }}>{fmt(liquidez.ganancia_bruta_total)}</span>
                  </div>
                  {Number(liquidez.total_retirado) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total retirado</span>
                      <span style={{ fontWeight: 600, color: '#a855f7' }}>-{fmt(liquidez.total_retirado)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid rgba(255,152,0,0.15)', paddingTop: 6, marginTop: 2 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>= Ganancia acumulada neta</span>
                    <span style={{ fontWeight: 700, color: '#4ade80' }}>{fmt(liquidez.ganancia_acumulada)}</span>
                  </div>
                </div>
              </div>

              {/* Total general */}
              <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total en cuentas</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--gold-light)', marginTop: 4 }}>{fmt(liquidez.total)}</div>
              </div>

            </div>
          </div>
        )}

        <div className="grid-2">
          {/* Análisis del mes */}
          {analisis && (
            <div className="card">
              <div className="card-header"><span className="card-title">Análisis del mes — {analisis.periodo}</span></div>
              <div className="card-body">
                <div className="fin-row">
                  <div className="fin-label">Ingresos</div>
                  <div className="fin-bar-wrap"><div className="fin-bar" style={{ width: '100%', background: 'var(--green)' }} /></div>
                  <div className="fin-amount" style={{ color: 'var(--green)' }}>{fmt(analisis.ingresos)}</div>
                </div>
                <div className="fin-row">
                  <div className="fin-label">Compras</div>
                  <div className="fin-bar-wrap"><div className="fin-bar" style={{ width: `${Math.min(100, (analisis.compras / maxIngreso) * 100)}%`, background: 'var(--red)' }} /></div>
                  <div className="fin-amount" style={{ color: 'var(--red)' }}>-{fmt(analisis.compras)}</div>
                </div>
                <div className="fin-row">
                  <div className="fin-label">Gastos</div>
                  <div className="fin-bar-wrap"><div className="fin-bar" style={{ width: `${Math.min(100, (analisis.gastos / maxIngreso) * 100)}%`, background: 'var(--gold)' }} /></div>
                  <div className="fin-amount" style={{ color: 'var(--gold)' }}>-{fmt(analisis.gastos)}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>Neto</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: analisis.neto >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(analisis.neto)}</div>
                </div>

                {/* ── Ganancias bruta ── */}
                {analisis.ganancia !== undefined && (
                  <div style={{
                    marginTop: 16, padding: '14px 16px',
                    background: 'linear-gradient(135deg, rgba(255,152,0,0.10), rgba(255,152,0,0.04))',
                    border: '1px solid rgba(255,152,0,0.22)', borderRadius: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                        Ganancia bruta
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>precio – costo × unidades</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: '#ffb74d', lineHeight: 1 }}>
                        {fmt(analisis.ganancia)}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#ff9800', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
                          {Number(analisis.margen_promedio ?? 0).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>margen prom.</div>
                      </div>
                    </div>
                    {/* Barra de margen */}
                    <div style={{ marginTop: 10, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, transition: 'width 0.5s ease',
                        width: `${Math.min(Number(analisis.margen_promedio ?? 0), 100)}%`,
                        background: Number(analisis.margen_promedio) >= 30
                          ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                          : Number(analisis.margen_promedio) >= 15
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : 'linear-gradient(90deg, #ef4444, #f87171)',
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: Number(analisis.margen_promedio) >= 30 ? '#22c55e' : Number(analisis.margen_promedio) >= 15 ? '#f59e0b' : '#ef4444', marginTop: 5, fontWeight: 600 }}>
                      {Number(analisis.margen_promedio) >= 30 ? '✓ Buen margen' : Number(analisis.margen_promedio) >= 15 ? '⚠ Margen ajustado' : '↓ Margen bajo'}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input
                        placeholder="Nota (opcional)"
                        value={gananciaNota}
                        onChange={e => setGananciaNota(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)' }}
                      />
                      <button className="btn btn-primary" onClick={handleLimpiarGanancia} disabled={limpiandoGanancia}>
                        {limpiandoGanancia ? 'Separando...' : 'Separar ganancia'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gastos recientes */}
          <div className="card">
            <div className="card-header"><span className="card-title">Gastos recientes</span></div>
            {gastos.length === 0 ? <div className="empty">Sin gastos registrados</div> : gastos.slice(0, 5).map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{g.concepto}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(g.fecha).toLocaleDateString('es-AR')}</div>
                </div>
                <div style={{ fontWeight: 600, color: 'var(--red)' }}>-{fmt(g.monto)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Productos top */}
        {top.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Productos más rentables</span></div>
            {top.map((p, i) => (
              <div className="product-rank" key={p.variante_id}>
                <div className={`rank-num${i === 0 ? ' gold' : ''}`}>{i + 1}</div>
                <div className="rank-info">
                  <div className="rank-name">{p.nombre_producto}</div>
                  <div className="rank-sub">{[p.sabor, p.tamanio].filter(Boolean).join(' · ')} · {p.cantidad_vendida} unidades</div>
                </div>
                <div className="rank-metrics">
                  <div className="rank-ingreso">{fmt(p.ingreso_total)}</div>
                  <div className="rank-margen">{p.margen_porcentaje}% margen · ganancia {fmt(p.ganancia)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalGasto && <ModalGasto categorias={categorias} onClose={() => setModalGasto(false)} onSaved={() => { setModalGasto(false); cargar() }} />}

      {modalAjuste && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAjuste(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Ajustar saldo</div>
              <button className="modal-close" onClick={() => setModalAjuste(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={ajuste.tipo} onChange={e => setAjuste(a => ({ ...a, tipo: e.target.value }))}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="ganancia">Ganancia acumulada</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nuevo saldo ($)</label>
                <input className="form-input" type="number" value={ajuste.monto_nuevo} onChange={e => setAjuste(a => ({ ...a, monto_nuevo: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Nota</label>
                <input className="form-input" value={ajuste.nota} onChange={e => setAjuste(a => ({ ...a, nota: e.target.value }))} placeholder="Ej: Conteo de caja" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalAjuste(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarAjuste}>Guardar ajuste</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
