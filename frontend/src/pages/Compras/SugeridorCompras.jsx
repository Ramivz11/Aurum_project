import { useState } from 'react'
import { sugerenciasCompraApi } from '../../api/services'
import { useToast } from '../../components/Toast'

const PRIORIDAD_STYLES = {
  critico: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: '⚠ Crítico' },
  alto:    { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: '↑ Alto' },
  medio:   { bg: 'rgba(91,143,232,0.12)', color: '#5b8fe8', label: '● Medio' },
  bajo:    { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: '○ Bajo' },
}

const fmt = (n) => {
  const num = parseFloat(n)
  return isNaN(num) ? '$0' : `$${num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function SugeridorCompras() {
  const toast = useToast()
  const [presupuesto, setPresupuesto] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)

  const generar = async () => {
    const valor = parseFloat(presupuesto)
    if (!valor || valor <= 0) return toast('Ingresá un presupuesto válido', 'error')

    setLoading(true)
    setResultado(null)
    try {
      const { data } = await sugerenciasCompraApi.generar(valor)
      setResultado(data)
    } catch (e) {
      toast(e.message || 'Error al generar sugerencias', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter">
      {/* ── BANNER IA ── */}
      <div className="ia-banner" style={{ marginBottom: 24 }}>
        <div className="ia-banner-icon">🧠</div>
        <div className="ia-banner-text">
          <div className="ia-banner-title">Sugeridor de Compras Inteligente</div>
          <div className="ia-banner-desc">
            Ingresá tu presupuesto y la IA analizará tu inventario, velocidad de ventas y reglas de negocio
            para sugerirte qué productos reponer, priorizando quiebres de stock.
          </div>
        </div>
      </div>

      {/* ── INPUT PRESUPUESTO ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Presupuesto a Invertir (ARS)</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--gold)', fontWeight: 700, fontSize: 16, fontFamily: "'Syne', sans-serif"
                }}>$</span>
                <input
                  id="input-presupuesto"
                  className="form-input"
                  type="number"
                  min="1"
                  step="1000"
                  placeholder="500000"
                  value={presupuesto}
                  onChange={e => setPresupuesto(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generar()}
                  style={{ paddingLeft: 32, fontSize: 18, fontWeight: 600, fontFamily: "'Syne', sans-serif" }}
                />
              </div>
            </div>
            <button
              id="btn-generar-sugerencias"
              className="btn btn-primary"
              onClick={generar}
              disabled={loading}
              style={{ height: 48, minWidth: 180, fontSize: 14 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{
                    width: 16, height: 16, border: '2px solid rgba(2,6,23,0.3)',
                    borderTop: '2px solid #020617', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite', display: 'inline-block'
                  }} />
                  Analizando...
                </span>
              ) : '🧠 Generar Sugerencia'}
            </button>
          </div>
        </div>
      </div>

      {/* ── LOADING STATE ── */}
      {loading && (
        <div style={{
          textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>🧠</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Analizando inventario y calculando prioridades...</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            La IA está evaluando stock, velocidad de ventas y reglas de negocio
          </div>
        </div>
      )}

      {/* ── RESULTADO ── */}
      {resultado && !loading && (
        <div style={{ animation: 'slideUp 0.3s ease' }}>
          {/* Resumen cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">Presupuesto</div>
              <div className="stat-value gold">{fmt(resultado.presupuesto_disponible)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Estimado</div>
              <div className="stat-value" style={{ color: 'var(--text)' }}>{fmt(resultado.total_estimado)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Restante</div>
              <div className="stat-value green">{fmt(resultado.presupuesto_restante)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Productos</div>
              <div className="stat-value" style={{ color: 'var(--blue)' }}>{resultado.productos.length}</div>
            </div>
          </div>

          {/* Alerta si presupuesto insuficiente */}
          {resultado.alerta_presupuesto && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 18,
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--red)', fontSize: 13, marginBottom: 2 }}>
                  Presupuesto Insuficiente
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {resultado.alerta_presupuesto}
                </div>
              </div>
            </div>
          )}

          {/* Resumen IA */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">🤖 Análisis de la IA</div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
                {resultado.resumen_ia}
              </p>
            </div>
          </div>

          {/* Tabla de productos */}
          {resultado.productos.length > 0 ? (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Productos a Reponer</div>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Ordenados por prioridad
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Prioridad</th>
                      <th style={{ textAlign: 'right' }}>Stock</th>
                      <th style={{ textAlign: 'right' }}>Vel. Diaria</th>
                      <th style={{ textAlign: 'right' }}>Cobertura</th>
                      <th style={{ textAlign: 'right' }}>Cant. Sugerida</th>
                      <th style={{ textAlign: 'right' }}>Costo Unit.</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.productos.map((p, i) => {
                      const pStyle = PRIORIDAD_STYLES[p.prioridad] || PRIORIDAD_STYLES.bajo
                      return (
                        <tr key={p.variante_id || i} title={p.justificacion}>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{p.producto}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {[p.sabor, p.tamanio].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </td>
                          <td>
                            <span className="chip" style={{
                              background: pStyle.bg, color: pStyle.color, fontWeight: 600, fontSize: 10
                            }}>
                              {pStyle.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                            {p.stock_actual}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                            {p.velocidad_diaria.toFixed(1)}/d
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                              color: p.dias_cobertura < 3 ? 'var(--red)' : p.dias_cobertura < 8 ? 'var(--warning)' : 'var(--green)'
                            }}>
                              {p.dias_cobertura.toFixed(1)}d
                            </span>
                          </td>
                          <td style={{
                            textAlign: 'right', fontWeight: 700, fontSize: 14,
                            fontFamily: "'Syne', sans-serif", color: 'var(--gold-light)'
                          }}>
                            {p.cantidad_sugerida}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                            {fmt(p.costo_unitario)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                            {fmt(p.subtotal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan="5" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>
                        TOTAL
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: "'Syne', sans-serif", color: 'var(--gold)' }}>
                        {resultado.productos.reduce((s, p) => s + p.cantidad_sugerida, 0)} uds.
                      </td>
                      <td></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, fontFamily: "'Syne', sans-serif", color: 'var(--gold-light)' }}>
                        {fmt(resultado.total_estimado)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Tooltip hint */}
              <div style={{ padding: '10px 20px', fontSize: 11, color: 'var(--text-dim)', borderTop: '1px solid var(--border)' }}>
                💡 Pasá el mouse sobre cada fila para ver la justificación de la IA.
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body empty">
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div>Tu stock está saludable. No se necesitan reposiciones urgentes.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* spinner animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
