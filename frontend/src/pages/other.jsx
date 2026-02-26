// ── MOVIMIENTOS ──────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { movimientosApi } from '../../api'
import { Loading, EmptyState, Chip, StatCard, formatARS, formatDateTime, METODO_PAGO_COLOR, METODO_PAGO_LABEL } from '../../components/ui'

export function Movimientos() {
  const [ventas, setVentas] = useState([])
  const [compras, setCompras] = useState([])
  const [resumen, setResumen] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('todos') // todos | ventas | compras

  useEffect(() => {
    Promise.all([
      movimientosApi.ventas(),
      movimientosApi.compras(),
      movimientosApi.resumen(),
    ]).then(([v, c, r]) => {
      setVentas(v.data)
      setCompras(c.data)
      setResumen(r.data)
    }).finally(() => setLoading(false))
  }, [])

  const filas = tab === 'ventas' ? ventas.map(v => ({ ...v, _tipo: 'venta' }))
    : tab === 'compras' ? compras.map(c => ({ ...c, _tipo: 'compra' }))
    : [
        ...ventas.map(v => ({ ...v, _tipo: 'venta' })),
        ...compras.map(c => ({ ...c, _tipo: 'compra' })),
      ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  return (
    <>
      <div className="topbar">
        <div className="page-title">Movimientos</div>
        <div className="topbar-actions">
          {['todos','ventas','compras'].map(t => (
            <button key={t} className={`btn btn-sm ${tab===t?'btn-primary':'btn-ghost'}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
        {resumen && (
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <StatCard label="Total ventas"    value={formatARS(resumen.total_ventas)} color="gold" />
            <StatCard label="Cantidad"        value={resumen.cantidad_ventas} />
            <StatCard label="Ticket promedio" value={formatARS(resumen.ticket_promedio)} />
            <StatCard label="Producto top"    value={resumen.producto_mas_vendido || '—'} />
          </div>
        )}

        {loading ? <Loading /> : filas.length === 0 ? (
          <EmptyState icon="⇄" text="Sin movimientos." />
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Tipo</th><th>Fecha</th><th>Cliente/Proveedor</th><th>Sucursal</th><th>Pago</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i}>
                      <td>
                        <Chip color={f._tipo === 'venta' ? 'green' : 'red'}>
                          {f._tipo === 'venta' ? '↑ Venta' : '↓ Compra'}
                        </Chip>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(f.fecha)}</td>
                      <td>{f.cliente_id ? `Cliente #${f.cliente_id}` : f.proveedor || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>#{f.sucursal_id}</td>
                      <td><Chip color={METODO_PAGO_COLOR[f.metodo_pago]}>{METODO_PAGO_LABEL[f.metodo_pago]}</Chip></td>
                      <td><strong>{formatARS(f.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── CLIENTES ─────────────────────────────────────────────────────────────────
import { clientesApi } from '../../api'
import { Modal, ConfirmDialog } from '../../components/ui'
import { useToast } from '../components/Toast'

export function Clientes() {
  const [clientes, setClientes] = useState([])
  const [top, setTop] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState({ nombre: '', ubicacion: '', telefono: '' })

  const cargar = () => {
    setLoading(true)
    Promise.all([
      clientesApi.listar({ busqueda: busqueda || undefined }),
      clientesApi.topMes(),
    ]).then(([c, t]) => { setClientes(c.data); setTop(t.data) })
    .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [busqueda])

  const guardar = async () => {
    if (!form.nombre.trim()) return toast('El nombre es obligatorio', 'error')
    try {
      if (modal?.id) {
        await clientesApi.actualizar(modal.id, form)
        toast('Cliente actualizado')
      } else {
        await clientesApi.crear(form)
        toast('Cliente creado')
      }
      setModal(null)
      cargar()
    } catch { toast('Error al guardar', 'error') }
  }

  const eliminar = async (id) => {
    await clientesApi.eliminar(id)
    toast('Cliente eliminado')
    cargar()
  }

  const abrirEditar = (c) => {
    setForm({ nombre: c.nombre, ubicacion: c.ubicacion || '', telefono: c.telefono || '' })
    setModal(c)
  }

  const abrirNuevo = () => {
    setForm({ nombre: '', ubicacion: '', telefono: '' })
    setModal({})
  }

  const initials = (nombre) => nombre.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()

  return (
    <>
      <div className="topbar">
        <div className="page-title">Clientes</div>
        <div className="topbar-actions">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Buscar cliente..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo cliente</button>
        </div>
      </div>

      <div className="page-content">
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><span className="card-title">Top clientes del mes</span></div>
            {top.slice(0,5).map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 20px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:36,height:36,borderRadius:'50%',background:'var(--gold-dim)',border:'1px solid var(--gold-border)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontWeight:700,fontSize:13,color:'var(--gold-light)',flexShrink:0 }}>
                  {initials(c.nombre)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500 }}>{c.nombre}</div>
                  <div style={{ fontSize:11,color:'var(--text-muted)' }}>{c.ubicacion || '—'}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:600 }}>{formatARS(c.total_gastado)}</div>
                  <div style={{ fontSize:10,color:'var(--text-muted)' }}>este mes</div>
                </div>
              </div>
            ))}
            {top.length === 0 && <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Sin ventas este mes</div>}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Directorio ({clientes.length})</span></div>
            {loading ? <Loading /> : clientes.length === 0 ? <EmptyState icon="◯" text="Sin clientes." /> :
              clientes.map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <div style={{ width:34,height:34,borderRadius:'50%',background:'var(--surface3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0 }}>
                    {initials(c.nombre)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:500,fontSize:13 }}>{c.nombre}</div>
                    <div style={{ fontSize:11,color:'var(--text-muted)' }}>
                      {c.ubicacion && `📍 ${c.ubicacion}`}
                      {c.telefono && ` · ${c.telefono}`}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => abrirEditar(c)}>Editar</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ msg:`¿Eliminar "${c.nombre}"?`, fn:()=>eliminar(c.id) })}>✕</button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {modal !== null && (
        <Modal title={modal.id ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setModal(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
          <div className="form-group"><label className="input-label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} /></div>
          <div className="form-group"><label className="input-label">Ubicación</label><input className="input" value={form.ubicacion} onChange={e=>setForm(f=>({...f,ubicacion:e.target.value}))} placeholder="Ej: Córdoba Capital" /></div>
          <div className="form-group"><label className="input-label">Teléfono</label><input className="input" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} placeholder="351 XXXXXXX" /></div>
        </Modal>
      )}
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{confirm.fn();setConfirm(null)}} onCancel={()=>setConfirm(null)} />}
    </>
  )
}

// ── FINANZAS ─────────────────────────────────────────────────────────────────
import { finanzasApi } from '../../api'

export function Finanzas() {
  const [liquidez, setLiquidez] = useState(null)
  const [analisis, setAnalisis] = useState(null)
  const [topProductos, setTopProductos] = useState([])
  const [gastos, setGastos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalGasto, setModalGasto] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [formGasto, setFormGasto] = useState({ concepto:'', categoria_id:'', monto:'', metodo_pago:'efectivo' })
  const [formAjuste, setFormAjuste] = useState({ tipo:'efectivo', monto_nuevo:'', nota:'' })

  const cargar = () => {
    setLoading(true)
    Promise.all([
      finanzasApi.liquidez(),
      finanzasApi.analisisMes(),
      finanzasApi.productosTop(),
      finanzasApi.listarGastos(),
      finanzasApi.categoriasGasto(),
    ]).then(([l,a,t,g,c]) => {
      setLiquidez(l.data); setAnalisis(a.data)
      setTopProductos(t.data); setGastos(g.data); setCategorias(c.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const guardarGasto = async () => {
    if (!formGasto.concepto || !formGasto.monto) return toast('Completá los campos obligatorios', 'error')
    try {
      await finanzasApi.crearGasto({ ...formGasto, monto: Number(formGasto.monto), categoria_id: formGasto.categoria_id || null })
      toast('Gasto registrado'); setModalGasto(false); cargar()
    } catch { toast('Error al registrar', 'error') }
  }

  const guardarAjuste = async () => {
    if (!formAjuste.monto_nuevo) return toast('Ingresá el monto', 'error')
    try {
      await finanzasApi.ajustarSaldo({ ...formAjuste, monto_nuevo: Number(formAjuste.monto_nuevo) })
      toast('Saldo ajustado'); setModalAjuste(false); cargar()
    } catch { toast('Error al ajustar', 'error') }
  }

  if (loading) return <div className="page-content"><Loading /></div>

  const barMax = Math.max(Number(analisis?.ingresos||0), Number(analisis?.compras||0), Number(analisis?.gastos||0), 1)

  return (
    <>
      <div className="topbar">
        <div className="page-title">Finanzas</div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setModalAjuste(true)}>Ajustar saldo</button>
          <button className="btn btn-primary" onClick={() => setModalGasto(true)}>+ Registrar gasto</button>
        </div>
      </div>

      <div className="page-content">
        {/* Liquidez */}
        <div className="card mb-20">
          <div className="card-header"><span className="card-title">Liquidez actual</span></div>
          <div className="card-body">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[['💵 Efectivo','efectivo',liquidez?.efectivo],['🏦 Transferencia','transferencia',liquidez?.transferencia],['💳 Tarjeta','tarjeta',liquidez?.tarjeta]].map(([label,,val])=>(
                <div key={label} style={{ background:'var(--surface2)', borderRadius:10, padding:16, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>{label}</div>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--gold-light)' }}>{formatARS(val)}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign:'center', marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Total disponible</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:800, color:'var(--gold-light)', marginTop:4 }}>{formatARS(liquidez?.total)}</div>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Análisis del mes */}
          <div className="card">
            <div className="card-header"><span className="card-title">Análisis del mes</span><span className="text-sm text-muted">{analisis?.periodo}</span></div>
            <div className="card-body">
              {[
                { label:'Ingresos', val:analisis?.ingresos, color:'var(--green)' },
                { label:'Compras',  val:analisis?.compras,  color:'var(--red)', prefix:'-' },
                { label:'Gastos',   val:analisis?.gastos,   color:'var(--gold)', prefix:'-' },
              ].map(({label,val,color,prefix=''})=>(
                <div key={label} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                  <div style={{ width:90, fontSize:12, color:'var(--text-muted)' }}>{label}</div>
                  <div style={{ flex:1, height:6, background:'var(--surface2)', borderRadius:6, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(Number(val)/barMax)*100}%`, background:color, borderRadius:6 }} />
                  </div>
                  <div style={{ width:100, textAlign:'right', fontSize:13, fontWeight:500, color }}>{prefix}{formatARS(val)}</div>
                </div>
              ))}
              <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:600 }}>Neto</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--green)' }}>{formatARS(analisis?.neto)}</div>
              </div>
            </div>
          </div>

          {/* Top productos */}
          <div className="card">
            <div className="card-header"><span className="card-title">Productos más vendidos</span></div>
            {topProductos.slice(0,5).map((p,i) => (
              <div key={p.variante_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, color:i===0?'var(--gold)':'var(--text-dim)', width:20 }}>{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{p.nombre_producto}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{[p.sabor,p.tamanio].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:600 }}>{formatARS(p.ingreso_total)}</div>
                  <div style={{ fontSize:11, color:'var(--green)' }}>{p.margen_porcentaje}% margen</div>
                </div>
              </div>
            ))}
            {topProductos.length === 0 && <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Sin datos este mes</div>}
          </div>
        </div>

        {/* Gastos */}
        {gastos.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Gastos del mes</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Concepto</th><th>Categoría</th><th>Pago</th><th>Monto</th><th>Fecha</th></tr></thead>
                <tbody>
                  {gastos.map(g => (
                    <tr key={g.id}>
                      <td>{g.concepto}</td>
                      <td><Chip color="gray">{categorias.find(c=>c.id===g.categoria_id)?.nombre || '—'}</Chip></td>
                      <td><Chip color={METODO_PAGO_COLOR[g.metodo_pago]}>{METODO_PAGO_LABEL[g.metodo_pago]}</Chip></td>
                      <td style={{ color:'var(--red)', fontWeight:600 }}>-{formatARS(g.monto)}</td>
                      <td style={{ color:'var(--text-muted)' }}>{formatDateTime(g.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modalGasto && (
        <Modal title="Registrar gasto" onClose={() => setModalGasto(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setModalGasto(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardarGasto}>Registrar</button></>}>
          <div className="form-group"><label className="input-label">Concepto *</label><input className="input" value={formGasto.concepto} onChange={e=>setFormGasto(f=>({...f,concepto:e.target.value}))} placeholder="Ej: Publicidad en Instagram" /></div>
          <div className="form-group"><label className="input-label">Categoría</label>
            <select className="input" value={formGasto.categoria_id} onChange={e=>setFormGasto(f=>({...f,categoria_id:e.target.value}))}>
              <option value="">Sin categoría</option>
              {categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="input-label">Monto $ *</label><input className="input" type="number" value={formGasto.monto} onChange={e=>setFormGasto(f=>({...f,monto:e.target.value}))} /></div>
          <div className="form-group"><label className="input-label">Método de pago</label>
            <div style={{ display:'flex', gap:8 }}>
              {['efectivo','transferencia','tarjeta'].map(m=>(
                <button key={m} className={`btn btn-sm ${formGasto.metodo_pago===m?'btn-primary':'btn-ghost'}`} onClick={()=>setFormGasto(f=>({...f,metodo_pago:m}))}>
                  {METODO_PAGO_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {modalAjuste && (
        <Modal title="Ajustar saldo" onClose={() => setModalAjuste(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setModalAjuste(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardarAjuste}>Ajustar</button></>}>
          <div className="form-group"><label className="input-label">Tipo de saldo</label>
            <div style={{ display:'flex', gap:8 }}>
              {['efectivo','transferencia','tarjeta'].map(m=>(
                <button key={m} className={`btn btn-sm ${formAjuste.tipo===m?'btn-primary':'btn-ghost'}`} onClick={()=>setFormAjuste(f=>({...f,tipo:m}))}>
                  {METODO_PAGO_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group"><label className="input-label">Monto real actual $</label><input className="input" type="number" value={formAjuste.monto_nuevo} onChange={e=>setFormAjuste(f=>({...f,monto_nuevo:e.target.value}))} placeholder="Contá la caja e ingresá el total" /></div>
          <div className="form-group"><label className="input-label">Nota (opcional)</label><input className="input" value={formAjuste.nota} onChange={e=>setFormAjuste(f=>({...f,nota:e.target.value}))} placeholder="Ej: Conteo de caja al cierre" /></div>
        </Modal>
      )}
    </>
  )
}

// ── SUCURSALES ────────────────────────────────────────────────────────────────
import { sucursalesApi, deudasApi } from '../../api'

export function Sucursales() {
  const [comparacion, setComparacion] = useState([])
  const [deudas, setDeudas] = useState([])
  const [resumenDeudas, setResumenDeudas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalDeuda, setModalDeuda] = useState(false)
  const [formDeuda, setFormDeuda] = useState({ tipo:'por_cobrar', cliente_proveedor:'', monto:'', concepto:'', notas:'' })

  const cargar = () => {
    setLoading(true)
    Promise.all([
      sucursalesApi.comparacion(),
      deudasApi.listar(),
      deudasApi.resumen(),
    ]).then(([c,d,r]) => { setComparacion(c.data); setDeudas(d.data); setResumenDeudas(r.data) })
    .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const guardarDeuda = async () => {
    if (!formDeuda.cliente_proveedor || !formDeuda.monto) return toast('Completá los campos', 'error')
    try {
      await deudasApi.crear({ ...formDeuda, monto: Number(formDeuda.monto) })
      toast('Deuda registrada'); setModalDeuda(false); cargar()
    } catch { toast('Error al registrar', 'error') }
  }

  const saldar = async (id) => {
    await deudasApi.saldar(id)
    toast('Deuda saldada')
    cargar()
  }

  if (loading) return <div className="page-content"><Loading /></div>

  return (
    <>
      <div className="topbar">
        <div className="page-title">Sucursales</div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setModalDeuda(true)}>+ Registrar deuda</button>
        </div>
      </div>

      <div className="page-content">
        <div className="mb-20">
          {comparacion.map((s, i) => (
            <div key={s.sucursal.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20, display:'flex', gap:20, alignItems:'center', marginBottom:12, cursor:'pointer', transition:'border-color 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold-border)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:32, color:i===0?'var(--gold)':'var(--text-dim)', width:40 }}>{i+1}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, marginBottom:4 }}>{s.sucursal.nombre}</div>
                <div style={{ display:'flex', gap:24 }}>
                  {[
                    { label:'ventas',      val:formatARS(s.ventas_total), color:i===0?'var(--gold-light)':undefined },
                    { label:'ticket prom.',val:formatARS(s.ticket_promedio) },
                    { label:'unidades',    val:s.unidades_vendidas },
                    { label:'del total',   val:`${s.porcentaje_del_total}%` },
                    { label:'rentabilidad',val:formatARS(s.rentabilidad), color:'var(--green)' },
                  ].map(({label,val,color})=>(
                    <div key={label}>
                      <div style={{ fontSize:14, fontWeight:600, color:color||'var(--text)' }}>{val}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height:4, background:'var(--surface2)', borderRadius:4, overflow:'hidden', marginTop:10 }}>
                  <div style={{ height:'100%', width:`${s.porcentaje_del_total}%`, background:i===0?'var(--gold)':i===1?'var(--blue)':'var(--surface3)', borderRadius:4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Deudas */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Gestión de deudas</span>
            {resumenDeudas && (
              <div style={{ display:'flex', gap:16, fontSize:13 }}>
                <span style={{ color:'var(--green)' }}>↑ Por cobrar: <strong>{formatARS(resumenDeudas.por_cobrar)}</strong></span>
                <span style={{ color:'var(--red)' }}>↓ Por pagar: <strong>{formatARS(resumenDeudas.por_pagar)}</strong></span>
              </div>
            )}
          </div>
          {deudas.length === 0 ? (
            <EmptyState icon="◇" text="Sin deudas pendientes." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>Cliente/Proveedor</th><th>Monto</th><th>Concepto</th><th></th></tr></thead>
                <tbody>
                  {deudas.map(d=>(
                    <tr key={d.id}>
                      <td><Chip color={d.tipo==='por_cobrar'?'green':'red'}>{d.tipo==='por_cobrar'?'Por cobrar':'Por pagar'}</Chip></td>
                      <td><strong>{d.cliente_proveedor}</strong></td>
                      <td style={{ fontWeight:600, color:d.tipo==='por_cobrar'?'var(--green)':'var(--red)' }}>{formatARS(d.monto)}</td>
                      <td style={{ color:'var(--text-muted)' }}>{d.concepto||'—'}</td>
                      <td><button className="btn btn-ghost btn-xs" onClick={()=>saldar(d.id)}>Saldar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalDeuda && (
        <Modal title="Registrar deuda" onClose={() => setModalDeuda(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setModalDeuda(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardarDeuda}>Registrar</button></>}>
          <div className="form-group"><label className="input-label">Tipo</label>
            <div style={{ display:'flex', gap:8 }}>
              <button className={`btn btn-sm ${formDeuda.tipo==='por_cobrar'?'btn-primary':'btn-ghost'}`} onClick={()=>setFormDeuda(f=>({...f,tipo:'por_cobrar'}))}>Por cobrar</button>
              <button className={`btn btn-sm ${formDeuda.tipo==='por_pagar'?'btn-primary':'btn-ghost'}`} onClick={()=>setFormDeuda(f=>({...f,tipo:'por_pagar'}))}>Por pagar</button>
            </div>
          </div>
          <div className="form-group"><label className="input-label">Cliente / Proveedor *</label><input className="input" value={formDeuda.cliente_proveedor} onChange={e=>setFormDeuda(f=>({...f,cliente_proveedor:e.target.value}))} /></div>
          <div className="form-group"><label className="input-label">Monto $ *</label><input className="input" type="number" value={formDeuda.monto} onChange={e=>setFormDeuda(f=>({...f,monto:e.target.value}))} /></div>
          <div className="form-group"><label className="input-label">Concepto</label><input className="input" value={formDeuda.concepto} onChange={e=>setFormDeuda(f=>({...f,concepto:e.target.value}))} /></div>
          <div className="form-group"><label className="input-label">Notas</label><input className="input" value={formDeuda.notas} onChange={e=>setFormDeuda(f=>({...f,notas:e.target.value}))} /></div>
        </Modal>
      )}
    </>
  )
}
