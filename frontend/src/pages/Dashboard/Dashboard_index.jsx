import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { finanzasApi, ventasApi, recordatoriosApi, clientesApi } from '../../api/services'
import { useMarca } from '../../context/MarcaContext'
import { useToast } from '../../components/Toast'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const PRIORIDAD_CONFIG = {
  alta:  { color: 'var(--red)',        bg: 'rgba(224,85,85,0.1)',   label: 'Alta',  dot: '🔴' },
  media: { color: 'var(--gold)',       bg: 'rgba(201,168,76,0.1)',  label: 'Media', dot: '🟡' },
  baja:  { color: 'var(--text-muted)', bg: 'rgba(122,118,114,0.1)', label: 'Baja',  dot: '⚪' },
}

function ClientesInactivos() {
  const toast = useToast()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState({})

  useEffect(() => {
    clientesApi.sinComprasRecientes(57)
      .then(r => setClientes(r.data.slice(0, 8)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || clientes.length === 0) return null

  const diasSinCompra = (ultimaCompra) => {
    if (!ultimaCompra) return null
    return Math.floor((Date.now() - new Date(ultimaCompra)) / 86400000)
  }

  const crearRecordatorio = async (cliente) => {
    if (creando[cliente.id]) return
    setCreando(c => ({ ...c, [cliente.id]: true }))
    const dias = diasSinCompra(cliente.ultima_compra)
    try {
      await recordatoriosApi.crear({
        titulo: `Contactar a ${cliente.nombre}`,
        descripcion: dias ? `Sin compras hace ${dias} días` : 'Nunca compró',
        prioridad: 'media',
      })
      toast(`Recordatorio creado para ${cliente.nombre}`)
      setClientes(c => c.filter(x => x.id !== cliente.id))
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setCreando(c => ({ ...c, [cliente.id]: false }))
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="card-title">Clientes inactivos</span>
          <span style={{ background: 'var(--gold-dim)', color: 'var(--gold-light)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
            +57 días
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{clientes.length} sin comprar</span>
      </div>
      {clientes.map(c => {
        const dias = diasSinCompra(c.ultima_compra)
        const initials = c.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div className="cliente-avatar">{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {dias ? `Hace ${dias} días` : 'Nunca compró'}
                {c.cantidad_compras > 0 && ` · ${c.cantidad_compras} compras`}
              </div>
            </div>
            <button
              onClick={() => crearRecordatorio(c)}
              disabled={creando[c.id]}
              style={{ background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 7, color: 'var(--gold-light)', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 10px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--gold-dim)' }}
            >
              {creando[c.id] ? '...' : '+ Recordatorio'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

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
          <input className="form-input" style={{ marginBottom: 8 }} placeholder="Título del recordatorio..."
            value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && crear()} autoFocus />
          <input className="form-input" style={{ marginBottom: 10 }} placeholder="Descripción (opcional)"
            value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
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
            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
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

export default function Dashboard() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [analisis, setAnalisis] = useState(null)
  const [liquidez, setLiquidez] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      finanzasApi.analisisMes({ mes, anio }),
      finanzasApi.liquidez(),
      finanzasApi.productosTop({ mes, anio, limite: 5 }),
      ventasApi.pedidosAbiertos(),
    ]).then(([a, l, p, pd]) => {
      setAnalisis(a.data); setLiquidez(l.data); setTopProducts(p.data); setPedidos(pd.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [mes, anio])

  const { getStyles } = useMarca()

  const esActual = mes === now.getMonth() + 1 && anio === now.getFullYear()

  const anios = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) anios.push(y)

  if (loading) return <div className="topbar"><div className="page-title">Dashboard</div></div>

  return (
    <>
      <div className="topbar">
        <div className="page-title">Dashboard</div>
        <div className="topbar-actions">
          {/* Selector mes/año */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select className="form-select" style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }}
              value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select className="form-select" style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }}
              value={anio} onChange={e => setAnio(Number(e.target.value))}>
              {anios.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {!esActual && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setMes(now.getMonth()+1); setAnio(now.getFullYear()) }}>
                Hoy
              </button>
            )}
          </div>
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
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{MESES[mes-1]} {anio}</span>
            </div>
            {topProducts.length === 0 ? <div className="empty">Sin ventas este período</div>
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
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      costo: {fmt(p.costo_total)} · <span style={{ color: 'var(--green)' }}>{p.margen_porcentaje}%</span>
                    </div>
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
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.cliente_nombre || (p.cliente_id ? `Cliente #${p.cliente_id}` : 'Sin cliente')}</div>
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
        <ClientesInactivos />

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
