import { useState, useEffect } from 'react'
import { finanzasApi } from '../api'
import { useToast } from '../components/Toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`

// ─── MODAL GASTO ──────────────────────────────────────────────────────────────

function ModalGasto({ categorias, liquidez, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    concepto: '',
    categoria_id: '',
    monto: '',
    metodo_pago: 'efectivo',
    notas: '',
  })
  const [saving, setSaving] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const CUENTAS = [
    {
      key: 'efectivo',
      label: 'Efectivo',
      icon: '💵',
      saldo: liquidez?.efectivo ?? null,
    },
    {
      key: 'transferencia',
      label: 'Transferencia',
      icon: '🏦',
      saldo: liquidez?.transferencia ?? null,
    },
    {
      key: 'tarjeta',
      label: 'Tarjeta',
      icon: '💳',
      saldo: liquidez?.tarjeta ?? null,
    },
  ]

  const save = async () => {
    if (!form.concepto || !form.monto) return toast('Completá concepto y monto', 'error')
    setSaving(true)
    try {
      await finanzasApi.crearGasto({
        ...form,
        monto: parseFloat(form.monto),
        categoria_id: form.categoria_id || null,
      })
      toast('Gasto registrado')
      onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const montoNum = parseFloat(form.monto) || 0
  const cuentaSeleccionada = CUENTAS.find(c => c.key === form.metodo_pago)
  const saldoPostGasto =
    cuentaSeleccionada?.saldo != null ? Number(cuentaSeleccionada.saldo) - montoNum : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Registrar gasto</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Concepto */}
          <div className="form-group">
            <label className="form-label">Concepto *</label>
            <input
              className="form-input"
              value={form.concepto}
              onChange={e => setF('concepto', e.target.value)}
              placeholder="Ej: Publicidad Instagram"
              autoFocus
            />
          </div>

          {/* Categoría + Monto */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select
                className="form-select"
                value={form.categoria_id}
                onChange={e => setF('categoria_id', e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Monto ($) *</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="100"
                value={form.monto}
                onChange={e => setF('monto', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* ── Cuenta a debitar ── */}
          <div className="form-group">
            <label className="form-label">Descontar de</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {CUENTAS.map(c => {
                const activa = form.metodo_pago === c.key
                const saldoTras = c.saldo != null ? Number(c.saldo) - montoNum : null
                const insuficiente = saldoTras != null && saldoTras < 0

                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setF('metodo_pago', c.key)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 10,
                      border: activa
                        ? '1px solid rgba(255,152,0,0.55)'
                        : '1px solid var(--border)',
                      background: activa
                        ? 'rgba(255,152,0,0.1)'
                        : 'var(--surface2)',
                      color: activa ? 'var(--gold-light)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.label}</span>
                    {c.saldo != null && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: insuficiente
                            ? 'var(--red)'
                            : activa
                            ? 'var(--gold)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {fmt(c.saldo)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Preview saldo resultante */}
            {montoNum > 0 && cuentaSeleccionada?.saldo != null && (
              <div
                style={{
                  marginTop: 10,
                  padding: '9px 14px',
                  borderRadius: 8,
                  background: saldoPostGasto < 0
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(255,152,0,0.06)',
                  border: `1px solid ${saldoPostGasto < 0
                    ? 'rgba(239,68,68,0.25)'
                    : 'rgba(255,152,0,0.15)'}`,
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  {cuentaSeleccionada.icon} {cuentaSeleccionada.label} quedaría en
                </span>
                <span
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: 14,
                    color: saldoPostGasto < 0 ? 'var(--red)' : 'var(--green)',
                  }}
                >
                  {fmt(saldoPostGasto)}
                  {saldoPostGasto < 0 && ' ⚠'}
                </span>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea
              className="form-textarea"
              value={form.notas}
              onChange={e => setF('notas', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Registrar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PÁGINA FINANZAS ──────────────────────────────────────────────────────────

export function Finanzas() {
  const toast = useToast()
  const [liquidez, setLiquidez] = useState(null)
  const [analisis, setAnalisis] = useState(null)
  const [top, setTop] = useState([])
  const [gastos, setGastos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [valorStock, setValorStock] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalGasto, setModalGasto] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [ajuste, setAjuste] = useState({ tipo: 'efectivo', monto_nuevo: '', nota: '' })
  const [limpiandoGanancia, setLimpiandoGanancia] = useState(false)

  const handleLimpiarGanancia = async () => {
    if (limpiandoGanancia) return
    if (!liquidez || Number(liquidez.ganancia_acumulada) <= 0)
      return toast('No hay ganancia para limpiar', 'error')
    if (!window.confirm('¿Confirmas separar la ganancia acumulada?')) return
    setLimpiandoGanancia(true)
    try {
      const res = await finanzasApi.limpiarGanancia(null)
      if (res?.data?.ok) {
        toast(`Se separaron ${fmt(res.data.monto_extraido)}`)
        cargar()
      } else {
        toast('No se pudo separar la ganancia', 'error')
      }
    } catch (e) {
      toast(e.message || 'Error al separar la ganancia', 'error')
    } finally {
      setLimpiandoGanancia(false)
    }
  }

  const cargar = () => {
    setLoading(true)
    Promise.all([
      finanzasApi.liquidez(),
      finanzasApi.analisisMes(),
      finanzasApi.productosTop(),
      finanzasApi.listarGastos(),
      finanzasApi.categoriasGasto(),
      finanzasApi.valorStock(),
    ])
      .then(([l, a, t, g, c, vs]) => {
        setLiquidez(l.data)
        setAnalisis(a.data)
        setTop(t.data)
        setGastos(g.data)
        setCategorias(c.data)
        setValorStock(vs.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const guardarAjuste = async () => {
    try {
      const valid = ['efectivo', 'transferencia', 'tarjeta', 'ganancia']
      if (!valid.includes(ajuste.tipo))
        return toast('Tipo inválido', 'error')
      const monto = parseFloat(ajuste.monto_nuevo)
      if (isNaN(monto)) return toast('Ingresá un monto numérico válido', 'error')
      await finanzasApi.ajustarSaldo({ tipo: ajuste.tipo, monto_nuevo: monto, nota: ajuste.nota })
      toast('Saldo ajustado')
      setModalAjuste(false)
      cargar()
    } catch (e) {
      toast(e?.message || 'Error al ajustar saldo', 'error')
    }
  }

  const handleExportarPDF = () => {
    try {
      if (!analisis) return toast('Cargando datos...', 'error')
      const doc = new jsPDF()
      const periodo = analisis.periodo || 'Mes actual'

      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('Reporte Financiero Aurum', 14, 20)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`Período: ${periodo} | Generado el: ${new Date().toLocaleDateString('es-AR')}`, 14, 28)

      let yPos = 40

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Resumen del Mes', 14, yPos)
      yPos += 6

      autoTable(doc, {
        startY: yPos,
        head: [['Concepto', 'Monto ($)']],
        body: [
          ['Ingresos (Ventas)', fmt(analisis.ingresos)],
          ['Egresos (Compras)', `-${fmt(analisis.compras)}`],
          ['Gastos Operativos', `-${fmt(analisis.gastos)}`],
          ['Neto Final', fmt(analisis.neto)],
          ['Ganancia Bruta', fmt(analisis.ganancia)],
          ['Margen Promedio', `${analisis.margen_promedio}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 41, 41] },
        margin: { left: 14 },
      })

      yPos = doc.lastAutoTable.finalY + 15

      if (liquidez) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Estado de Cuentas (Liquidez)', 14, yPos)
        yPos += 6

        autoTable(doc, {
          startY: yPos,
          head: [['Cuenta', 'Saldo ($)']],
          body: [
            ['Efectivo', fmt(liquidez.efectivo)],
            ['Banco / Transferencia', fmt(liquidez.transferencia)],
            ['Tarjeta', fmt(liquidez.tarjeta)],
            ['Total en Cuentas', fmt(liquidez.total)],
            ['Ganancia Acumulada', fmt(liquidez.ganancia_acumulada)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [41, 41, 41] },
          margin: { left: 14 },
        })

        yPos = doc.lastAutoTable.finalY + 15
      }

      if (yPos > 200) { doc.addPage(); yPos = 20 }

      if (top?.length > 0) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Productos Más Rentables del Mes', 14, yPos)
        yPos += 6

        autoTable(doc, {
          startY: yPos,
          head: [['Producto', 'Detalle', 'Vendidos', 'Ingreso', 'Ganancia', 'Margen']],
          body: top.map(p => [
            p.nombre_producto,
            [p.sabor, p.tamanio].filter(Boolean).join(' · '),
            `${p.cantidad_vendida} ud.`,
            fmt(p.ingreso_total),
            fmt(p.ganancia),
            `${p.margen_porcentaje}%`,
          ]),
          theme: 'striped',
          headStyles: { fillColor: [41, 41, 41] },
          margin: { left: 14 },
        })

        yPos = doc.lastAutoTable.finalY + 15
      }

      if (yPos > 200) { doc.addPage(); yPos = 20 }

      if (gastos?.length > 0) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Listado de Gastos', 14, yPos)
        yPos += 6

        autoTable(doc, {
          startY: yPos,
          head: [['Fecha', 'Concepto', 'Cuenta', 'Monto']],
          body: gastos.map(g => [
            new Date(g.fecha).toLocaleDateString('es-AR'),
            g.concepto,
            g.metodo_pago,
            fmt(g.monto),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [41, 41, 41] },
          margin: { left: 14 },
        })
      }

      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(10)
        doc.setTextColor(150)
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        )
      }

      doc.save(`Reporte_Financiero_Aurum_${periodo.replace('/', '_')}.pdf`)
      toast('Reporte PDF generado')
    } catch (e) {
      alert('Error al generar PDF: ' + e.message)
    }
  }

  const maxIngreso = Math.max(Number(analisis?.ingresos || 0), 1)

  return (
    <>
      <div className="topbar">
        <div className="page-title">Finanzas</div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={handleExportarPDF}>Exportar PDF</button>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="liq-val">{fmt(liquidez.ganancia_acumulada)}</div>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                      onClick={handleLimpiarGanancia}
                      disabled={limpiandoGanancia || Number(liquidez.ganancia_acumulada) <= 0}
                    >
                      {limpiandoGanancia ? 'Separando...' : 'Separar'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total en cuentas</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--gold-light)', marginTop: 4 }}>
                  {fmt(liquidez.total)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid-2">
          {/* Análisis del mes */}
          {analisis && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Análisis del mes — {analisis.periodo}</span>
              </div>
              <div className="card-body">
                <div className="fin-row">
                  <div className="fin-label">Ingresos</div>
                  <div className="fin-bar-wrap"><div className="fin-bar" style={{ width: '100%', background: 'var(--green)' }} /></div>
                  <div className="fin-amount" style={{ color: 'var(--green)' }}>{fmt(analisis.ingresos)}</div>
                </div>
                <div className="fin-row">
                  <div className="fin-label">Compras</div>
                  <div className="fin-bar-wrap">
                    <div className="fin-bar" style={{ width: `${Math.min(100, (analisis.compras / maxIngreso) * 100)}%`, background: 'var(--red)' }} />
                  </div>
                  <div className="fin-amount" style={{ color: 'var(--red)' }}>-{fmt(analisis.compras)}</div>
                </div>
                <div className="fin-row">
                  <div className="fin-label">Gastos</div>
                  <div className="fin-bar-wrap">
                    <div className="fin-bar" style={{ width: `${Math.min(100, (analisis.gastos / maxIngreso) * 100)}%`, background: 'var(--gold)' }} />
                  </div>
                  <div className="fin-amount" style={{ color: 'var(--gold)' }}>-{fmt(analisis.gastos)}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>Neto</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: analisis.neto >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmt(analisis.neto)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Valor del Stock */}
          {valorStock && (
            <div className="card">
              <div className="card-header"><span className="card-title">Valor del Stock</span></div>
              <div className="card-body">
                <div className="fin-row">
                  <div className="fin-label">Valor a costo</div>
                  <div className="fin-bar-wrap"><div className="fin-bar" style={{ width: '100%', background: 'rgba(139,92,246,0.3)' }} /></div>
                  <div className="fin-amount" style={{ color: 'rgb(139,92,246)' }}>{fmt(valorStock.total_valor_costo)}</div>
                </div>
                <div className="fin-row">
                  <div className="fin-label">Valor a venta</div>
                  <div className="fin-bar-wrap"><div className="fin-bar" style={{ width: '100%', background: 'rgba(34,197,94,0.3)' }} /></div>
                  <div className="fin-amount" style={{ color: 'rgb(34,197,94)' }}>{fmt(valorStock.total_valor_venta)}</div>
                </div>
                <div className="fin-row">
                  <div className="fin-label">Cant. unidades</div>
                  <div style={{ flex: 1 }} />
                  <div className="fin-amount" style={{ color: 'var(--text-muted)' }}>
                    {Number(valorStock.cantidad_total_unidades).toLocaleString('es-AR')} ud
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>Ganancia potencial</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: valorStock.diferencia_ganancia_potencial >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmt(valorStock.diferencia_ganancia_potencial)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gastos recientes */}
          <div className="card">
            <div className="card-header"><span className="card-title">Gastos recientes</span></div>
            {gastos.length === 0
              ? <div className="empty">Sin gastos registrados</div>
              : gastos.slice(0, 5).map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{g.concepto}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(g.fecha).toLocaleDateString('es-AR')}
                      {' · '}
                      <span style={{ textTransform: 'capitalize' }}>{g.metodo_pago}</span>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--red)' }}>-{fmt(g.monto)}</div>
                </div>
              ))
            }
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
                  <div className="rank-sub">
                    {[p.sabor, p.tamanio].filter(Boolean).join(' · ')} · {p.cantidad_vendida} unidades
                  </div>
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

      {/* Modal gasto — recibe liquidez para mostrar saldos */}
      {modalGasto && (
        <ModalGasto
          categorias={categorias}
          liquidez={liquidez}
          onClose={() => setModalGasto(false)}
          onSaved={() => { setModalGasto(false); cargar() }}
        />
      )}

      {/* Modal ajuste saldo */}
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
