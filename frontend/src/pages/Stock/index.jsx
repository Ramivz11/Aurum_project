import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { productosApi, stockApi, categoriasProductoApi, finanzasApi, sucursalesApi } from '../../api/services'
import { Modal, Loading, EmptyState, ConfirmDialog, formatARS } from '../../components/ui'

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data = [], color = '#ff9800', width = 240, height = 44 }) {
  const points = data.length >= 2 ? data : [0.3,0.5,0.4,0.65,0.5,0.7,0.55,0.75,0.6,0.8,0.65,0.85,0.7,0.9]
  const max = Math.max(...points), min = Math.min(...points), range = max - min || 1, pad = 4
  const pts = points.map((v,i) => `${(i/(points.length-1))*width},${height-pad-((v-min)/range)*(height-pad*2)}`)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{overflow:'visible'}}>
      <path d={`M${pts.join('L')}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Modal Categorías ─────────────────────────────────────────────────────────
function ModalCategorias({ onClose }) {
  const [categorias,setCategorias]=useState([])
  const [nueva,setNueva]=useState('')
  const [editando,setEditando]=useState(null)
  const [confirm,setConfirm]=useState(null)
  const cargar=()=>categoriasProductoApi.listar().then(r=>setCategorias(r.data))
  useEffect(()=>{cargar()},[])
  const crear=async()=>{if(!nueva.trim())return toast.error('Ingresá un nombre');try{await categoriasProductoApi.crear({nombre:nueva.trim()});setNueva('');cargar();toast.success('Categoría creada')}catch(e){toast.error(e.response?.data?.detail||'Error')}}
  const guardar=async()=>{if(!editando?.nombre.trim())return;try{await categoriasProductoApi.actualizar(editando.id,{nombre:editando.nombre.trim()});setEditando(null);cargar();toast.success('Actualizada')}catch(e){toast.error(e.response?.data?.detail||'Error')}}
  const eliminar=async(id)=>{await categoriasProductoApi.eliminar(id);cargar();toast.success('Eliminada')}
  return (
    <Modal title="Gestionar categorías" onClose={onClose} footer={<button className="btn btn-ghost" onClick={onClose}>Cerrar</button>}>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <input className="input" placeholder="Nueva categoría..." value={nueva} onChange={e=>setNueva(e.target.value)} onKeyDown={e=>e.key==='Enter'&&crear()}/>
        <button className="btn btn-primary" style={{whiteSpace:'nowrap'}} onClick={crear}>+ Agregar</button>
      </div>
      {categorias.map(cat=>(
        <div key={cat.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
          {editando?.id===cat.id
            ?<><input className="input" style={{flex:1}} value={editando.nombre} onChange={e=>setEditando(ed=>({...ed,nombre:e.target.value}))} autoFocus/><button className="btn btn-primary btn-sm" onClick={guardar}>Guardar</button><button className="btn btn-ghost btn-sm" onClick={()=>setEditando(null)}>Cancelar</button></>
            :<><span style={{flex:1,fontSize:14}}>{cat.nombre}</span><button className="btn btn-ghost btn-xs" onClick={()=>setEditando({id:cat.id,nombre:cat.nombre})}>Editar</button><button className="btn btn-danger btn-xs" onClick={()=>setConfirm({msg:`¿Eliminar "${cat.nombre}"?`,fn:()=>eliminar(cat.id)})}>✕</button></>
          }
        </div>
      ))}
      {confirm&&<ConfirmDialog message={confirm.msg} onConfirm={()=>{confirm.fn();setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}
    </Modal>
  )
}

// ─── Modal Producto ───────────────────────────────────────────────────────────
function ModalProducto({ producto, categorias, onClose, onSaved }) {
  const isEdit=!!producto?.id
  const [form,setForm]=useState({nombre:producto?.nombre||'',marca:producto?.marca||'',categoria:producto?.categoria||'',imagen_url:producto?.imagen_url||''})
  const [variantes,setVariantes]=useState(producto?.variantes?.length?producto.variantes:[{sabor:'',tamanio:'',costo:'',precio_venta:'',stock_minimo:0}])
  const [loading,setLoading]=useState(false)
  const addVar=()=>setVariantes(v=>[...v,{sabor:'',tamanio:'',costo:'',precio_venta:'',stock_minimo:0}])
  const rmVar=i=>setVariantes(v=>v.filter((_,idx)=>idx!==i))
  const upVar=(i,f,v)=>setVariantes(arr=>arr.map((item,idx)=>idx===i?{...item,[f]:v}:item))
  const submit=async()=>{
    if(!form.nombre.trim())return toast.error('El nombre es obligatorio')
    setLoading(true)
    try{
      if(isEdit){await productosApi.actualizar(producto.id,form);toast.success('Actualizado')}
      else{await productosApi.crear({...form,variantes});toast.success('Creado')}
      onSaved();onClose()
    }catch(e){toast.error(e.response?.data?.detail||'Error')}finally{setLoading(false)}
  }
  return (
    <Modal title={isEdit?'Editar producto':'Nuevo producto'} onClose={onClose} size="modal-lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={loading}>{loading?'Guardando...':'Guardar'}</button></>}>
      <div className="grid-2" style={{marginBottom:0}}>
        <div className="form-group"><label className="input-label">Nombre *</label><input className="input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></div>
        <div className="form-group"><label className="input-label">Marca</label><input className="input" value={form.marca} onChange={e=>setForm(f=>({...f,marca:e.target.value}))}/></div>
      </div>
      <div className="grid-2" style={{marginBottom:0}}>
        <div className="form-group">
          <label className="input-label">Categoría</label>
          <select className="input" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
            <option value="">Seleccionar...</option>
            {categorias.map(c=><option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="input-label">URL imagen</label><input className="input" value={form.imagen_url} onChange={e=>setForm(f=>({...f,imagen_url:e.target.value}))}/></div>
      </div>
      {!isEdit&&(<>
        <hr className="divider"/>
        <div className="flex items-center justify-between mb-12">
          <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.06em',color:'var(--text-muted)',textTransform:'uppercase'}}>Variantes</div>
          <button className="btn btn-ghost btn-sm" onClick={addVar}>+ Agregar</button>
        </div>
        {variantes.map((v,i)=>(
          <div key={i} style={{background:'var(--surface2)',borderRadius:8,padding:14,marginBottom:10}}>
            <div className="grid-2" style={{marginBottom:8}}>
              <div><label className="input-label">Sabor</label><input className="input" value={v.sabor} onChange={e=>upVar(i,'sabor',e.target.value)}/></div>
              <div><label className="input-label">Tamaño</label><input className="input" value={v.tamanio} onChange={e=>upVar(i,'tamanio',e.target.value)}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:10,alignItems:'end'}}>
              <div><label className="input-label">Costo $</label><input className="input" type="number" value={v.costo} onChange={e=>upVar(i,'costo',e.target.value)}/></div>
              <div><label className="input-label">Precio $</label><input className="input" type="number" value={v.precio_venta} onChange={e=>upVar(i,'precio_venta',e.target.value)}/></div>
              <div><label className="input-label">Stock mín.</label><input className="input" type="number" value={v.stock_minimo} onChange={e=>upVar(i,'stock_minimo',e.target.value)}/></div>
              {variantes.length>1&&<button className="btn btn-danger btn-sm" onClick={()=>rmVar(i)}>✕</button>}
            </div>
          </div>
        ))}
      </>)}
    </Modal>
  )
}

// ─── Modal Lote ───────────────────────────────────────────────────────────────
function ModalLote({ producto, onClose, onSaved }) {
  const [modo,setModo]=useState('porcentaje')
  const [valor,setValor]=useState('')
  const [loading,setLoading]=useState(false)
  const modos=[{key:'porcentaje',label:'+/- %'},{key:'margen_deseado',label:'Margen %'},{key:'precio_fijo',label:'Precio fijo $'}]
  const aplicar=async()=>{
    if(!valor)return toast.error('Ingresá un valor')
    setLoading(true)
    try{await productosApi.ajustarPrecioLote({producto_id:producto.id,modo,valor:parseFloat(valor)});toast.success('Precios actualizados');onSaved();onClose()}
    catch(e){toast.error(e.response?.data?.detail||'Error')}finally{setLoading(false)}
  }
  return (
    <Modal title={`Ajuste por lote — ${producto.nombre}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={aplicar} disabled={loading}>{loading?'Aplicando...':'Aplicar'}</button></>}>
      <div style={{marginBottom:20}}>
        <label className="input-label">Modo de ajuste</label>
        <div style={{display:'flex',gap:8}}>{modos.map(m=><button key={m.key} className={`btn btn-sm ${modo===m.key?'btn-primary':'btn-ghost'}`} onClick={()=>setModo(m.key)}>{m.label}</button>)}</div>
      </div>
      <div className="form-group"><label className="input-label">Valor</label><input className="input" type="number" value={valor} onChange={e=>setValor(e.target.value)}/></div>
      <div style={{padding:'12px 14px',background:'var(--surface2)',borderRadius:8,fontSize:12,color:'var(--text-muted)'}}>
        Afecta <strong style={{color:'var(--text)'}}>{producto.variantes?.length||0} variantes</strong>
      </div>
    </Modal>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ p, onEdit, onDelete, onLote }) {
  const variantes = p.variantes || []
  const costoMin = variantes.length ? Math.min(...variantes.map(v=>Number(v.costo||0))) : 0
  const precioMin = variantes.length ? Math.min(...variantes.map(v=>Number(v.precio_venta||0))) : 0
  const margen = costoMin>0&&precioMin>0 ? Math.round(((precioMin-costoMin)/precioMin)*100) : 0
  const stockTotal = variantes.reduce((a,v)=>a+(v.stock_total||0),0)
  const hayBajo = variantes.some(v=>v.stock_total<=v.stock_minimo)
  const statusColor = stockTotal===0?'var(--red)':hayBajo?'var(--warning)':'var(--green)'
  const primerVar = variantes[0]
  const varLabel = primerVar?[primerVar.sabor,primerVar.tamanio].filter(Boolean).join(' · '):null

  // Agregar stock por sucursal de todas las variantes
  const stockPorSucursal = {}
  variantes.forEach(v=>{
    stockPorSucursal['CTR'] = (stockPorSucursal['CTR']||0)+(v.stock_central||0)
    ;(v.stocks_sucursal||[]).forEach(ss=>{
      const key = ss.sucursal_nombre?.substring(0,3).toUpperCase()||`S${ss.sucursal_id}`
      stockPorSucursal[key] = (stockPorSucursal[key]||0)+ss.cantidad
    })
  })
  const sucursalKeys = Object.keys(stockPorSucursal)

  return (
    <div
      style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:'18px 18px 16px',display:'flex',flexDirection:'column',position:'relative',transition:'border-color 0.2s,box-shadow 0.2s,transform 0.18s',cursor:'default',minHeight:170}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,152,0,0.3)';e.currentTarget.style.boxShadow='0 8px 28px rgba(255,152,0,0.08)';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.querySelector('.pca').style.opacity='1'}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='translateY(0)';e.currentTarget.querySelector('.pca').style.opacity='0'}}
    >
      <div style={{position:'absolute',inset:0,borderRadius:'inherit',boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.04)',pointerEvents:'none'}}/>
      {/* Actions */}
      <div className="pca" style={{position:'absolute',top:12,right:12,display:'flex',gap:4,opacity:0,transition:'opacity 0.15s'}}>
        {[{icon:'%',fn:onLote,hc:'var(--gold-light)'},{icon:'✎',fn:onEdit,hc:'var(--gold-light)'},{icon:'✕',fn:onDelete,hc:'var(--red)'}].map(({icon,fn,hc})=>(
          <button key={icon} onClick={fn} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,width:26,height:26,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-muted)',fontSize:12,transition:'color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.color=hc} onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>{icon}</button>
        ))}
      </div>
      {/* Nombre + dot */}
      <div style={{display:'flex',alignItems:'flex-start',gap:8,paddingRight:88,marginBottom:8}}>
        <span style={{fontWeight:700,fontSize:14,color:'var(--text)',lineHeight:1.3,flex:1}}>{p.nombre}</span>
        <span style={{width:7,height:7,borderRadius:'50%',background:statusColor,flexShrink:0,marginTop:5,boxShadow:`0 0 6px ${statusColor}`}}/>
      </div>
      {/* Marca + variante */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:10}}>
        {p.marca&&<span style={{background:'rgba(255,152,0,0.15)',color:'var(--gold-light)',border:'1px solid rgba(255,152,0,0.22)',borderRadius:6,fontSize:10,fontWeight:700,padding:'2px 8px',letterSpacing:'0.05em',textTransform:'uppercase'}}>{p.marca}</span>}
        {varLabel&&<span style={{fontSize:11,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:150}}>{varLabel}{variantes.length>1?` +${variantes.length-1}`:''}</span>}
      </div>
      {/* Divider */}
      <div style={{height:1,background:'var(--border)',marginBottom:10}}/>
      {/* Precio */}
      <div style={{display:'flex',alignItems:'baseline',gap:5,marginBottom:10}}>
        <span style={{fontSize:10,color:'var(--text-dim)',fontWeight:500}}>c</span>
        <span style={{fontSize:12,color:'var(--text-muted)',fontWeight:500}}>{costoMin>0?formatARS(costoMin):'—'}</span>
        <span style={{fontSize:10,color:'var(--text-dim)',marginLeft:6,fontWeight:500}}>v</span>
        <span style={{fontSize:20,fontWeight:700,color:'var(--text)',fontFamily:'Syne,sans-serif',letterSpacing:'-0.02em',lineHeight:1}}>{formatARS(precioMin)}</span>
        {margen>0&&<span style={{marginLeft:'auto',fontSize:11,fontWeight:700,color:'var(--gold-light)',background:'var(--gold-dim)',borderRadius:6,padding:'2px 7px'}}>{margen}%</span>}
      </div>
      {/* Stock por sucursal */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {sucursalKeys.length===0
            ?<span style={{fontSize:11,color:'var(--text-dim)'}}>Sin stock</span>
            :sucursalKeys.map(key=>{
              const cant=stockPorSucursal[key]
              return (
                <div key={key} style={{display:'flex',alignItems:'center',gap:3}}>
                  <span style={{width:5,height:5,borderRadius:'50%',flexShrink:0,background:cant===0?'var(--red)':'transparent',border:cant>0?'1px solid var(--text-dim)':'none'}}/>
                  <span style={{fontSize:9,color:'var(--text-dim)',letterSpacing:'0.05em'}}>{key}</span>
                  <span style={{fontSize:12,fontWeight:700,color:cant===0?'var(--red)':'var(--text)',marginLeft:1}}>{cant}</span>
                </div>
              )
            })
          }
        </div>
        <span style={{fontSize:14,fontWeight:700,fontFamily:'Syne,sans-serif',color:stockTotal===0?'var(--red)':'var(--text)'}}>{stockTotal}</span>
      </div>
    </div>
  )
}

// ─── Stats Footer ─────────────────────────────────────────────────────────────
function StatsFooter({ resumen }) {
  const ingresos=resumen?.ingresos_hoy??0, delta=resumen?.delta_hoy??null
  const tendencia=resumen?.tendencia_mensual??[], margen=resumen?.margen_promedio??0
  return (
    <div style={{marginTop:24,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:'20px 28px',display:'grid',gridTemplateColumns:'1fr 1.6fr 1fr',alignItems:'center'}}>
      {/* Ingresos */}
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:44,height:44,borderRadius:12,background:'rgba(255,152,0,0.15)',border:'1px solid rgba(255,152,0,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'var(--gold-light)',flexShrink:0}}>$</div>
        <div>
          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3}}>INGRESOS DEL DIA</div>
          <div style={{display:'flex',alignItems:'baseline',gap:10}}>
            <span style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:'var(--text)',letterSpacing:'-0.02em',lineHeight:1}}>{formatARS(ingresos)}</span>
            {delta!=null&&<span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,background:delta>=0?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',color:delta>=0?'var(--green)':'var(--red)'}}>{delta>=0?'↗':'↘'} {delta>=0?'+':''}{delta}%</span>}
          </div>
        </div>
      </div>
      {/* Tendencia */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,borderLeft:'1px solid var(--border)',borderRight:'1px solid var(--border)',padding:'0 28px'}}>
        <span style={{fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.12em'}}>TENDENCIA MENSUAL</span>
        <Sparkline data={tendencia} color="#ff9800" width={240} height={44}/>
      </div>
      {/* Margen */}
      <div style={{display:'flex',alignItems:'center',gap:14,justifyContent:'flex-end'}}>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3}}>MARGEN PROMEDIO</div>
          <div style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:'var(--gold-light)',letterSpacing:'-0.02em',lineHeight:1}}>{margen>0?`${margen}%`:'—'}</div>
        </div>
        <div style={{width:44,height:44,borderRadius:12,background:'rgba(255,152,0,0.15)',border:'1px solid rgba(255,152,0,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📊</div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Stock() {
  const [productos,setProductos]=useState([])
  const [categorias,setCategorias]=useState([])
  const [sucursales,setSucursales]=useState([])
  const [resumenDia,setResumenDia]=useState(null)
  const [loading,setLoading]=useState(true)
  const [busqueda,setBusqueda]=useState('')
  const [categoria,setCategoria]=useState('')
  const [modalProd,setModalProd]=useState(null)
  const [modalLote,setModalLote]=useState(null)
  const [modalCats,setModalCats]=useState(false)
  const [confirm,setConfirm]=useState(null)

  const cargarCategorias=()=>categoriasProductoApi.listar().then(r=>setCategorias(r.data))
  const cargar=()=>{
    setLoading(true)
    stockApi.listar({busqueda:busqueda||undefined,categoria:categoria==='stock_bajo'?undefined:categoria||undefined})
      .then(r=>setProductos(r.data)).finally(()=>setLoading(false))
  }

  useEffect(()=>{
    cargarCategorias()
    sucursalesApi.listar().then(r=>setSucursales(r.data)).catch(()=>{})
    finanzasApi.resumenDia().then(r=>setResumenDia(r.data)).catch(()=>{})
  },[])
  useEffect(()=>{cargar()},[busqueda,categoria])

  const eliminar=async(id)=>{await productosApi.eliminar(id);toast.success('Eliminado');cargar()}

  const chips=[
    {key:'',label:'Todo'},
    {key:'stock_bajo',label:'Stock Bajo'},
    ...categorias.map(c=>({key:c.nombre,label:c.nombre}))
  ]

  const productosFiltrados = categoria==='stock_bajo'
    ? productos.filter(p=>p.variantes?.some(v=>v.stock_total<=v.stock_minimo))
    : productos

  return (<>
    {/* Header */}
    <div style={{padding:'0 28px',borderBottom:'1px solid var(--border)',background:'rgba(10,16,33,0.7)',backdropFilter:'blur(12px)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:60}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,background:'rgba(255,152,0,0.15)',border:'1px solid rgba(255,152,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>⚡</div>
          <div>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:17,lineHeight:1}}>
              <span style={{color:'var(--text)'}}>Aurum </span>
              <span style={{background:'linear-gradient(135deg,#ffb74d,#ff9800)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Suplementos</span>
            </div>
            <div style={{fontSize:10,color:'var(--text-dim)',letterSpacing:'0.1em',textTransform:'uppercase',marginTop:2}}>Panel de Control</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:18,position:'relative',padding:4,lineHeight:1}}>
            🔔<span style={{position:'absolute',top:4,right:4,width:6,height:6,borderRadius:'50%',background:'var(--warning)',display:'block'}}/>
          </button>
          <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:18,padding:4}}>⚙</button>
          <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,#ff9800,#e65100)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',cursor:'pointer'}}>JD</div>
        </div>
      </div>
    </div>

    <div className="page-content">
      {/* Título */}
      <div style={{marginBottom:20}}>
        <h1 style={{fontFamily:'Syne,sans-serif',fontSize:26,fontWeight:800,color:'var(--text)',letterSpacing:'-0.02em',marginBottom:3}}>Gestion de Inventario</h1>
        <p style={{fontSize:12,color:'var(--text-muted)'}}>{productosFiltrados.length} productos en {sucursales.length||3} sucursales</p>
      </div>

      {/* Search */}
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <div
          style={{flex:1,display:'flex',alignItems:'center',gap:10,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'0 16px',height:46,transition:'border-color 0.2s'}}
          onFocusCapture={e=>e.currentTarget.style.borderColor='rgba(255,152,0,0.4)'}
          onBlurCapture={e=>e.currentTarget.style.borderColor='var(--border)'}
        >
          <span style={{fontSize:15,color:'var(--text-dim)',flexShrink:0}}>⌕</span>
          <input style={{flex:1,background:'none',border:'none',outline:'none',color:'var(--text)',fontSize:13,fontFamily:'inherit'}}
            placeholder="Buscar productos, marcas, categorías..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
        </div>
        <button onClick={()=>setModalCats(true)} title="Gestionar categorías"
          style={{width:46,height:46,borderRadius:12,background:'var(--surface)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-muted)',fontSize:18,transition:'border-color 0.2s,color 0.2s',flexShrink:0}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,152,0,0.4)';e.currentTarget.style.color='var(--gold-light)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>≡</button>
        <button onClick={()=>setModalProd({})} className="btn btn-primary" style={{height:46,borderRadius:12,paddingInline:20,whiteSpace:'nowrap',flexShrink:0}}>+ Nuevo producto</button>
      </div>

      {/* Chips */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:22}}>
        {chips.map(chip=>(
          <button key={chip.key} onClick={()=>setCategoria(chip.key)} style={{
            padding:'5px 16px',borderRadius:999,fontSize:12,fontWeight:600,border:'1px solid',cursor:'pointer',transition:'all 0.15s',
            ...(categoria===chip.key?{background:'var(--gold)',borderColor:'var(--gold)',color:'#1a1000'}:{background:'transparent',borderColor:'var(--border)',color:'var(--text-muted)'})
          }}
            onMouseEnter={e=>{if(categoria!==chip.key){e.currentTarget.style.borderColor='rgba(255,152,0,0.4)';e.currentTarget.style.color='var(--text)'}}}
            onMouseLeave={e=>{if(categoria!==chip.key){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}}
          >{chip.label}</button>
        ))}
      </div>

      {/* Grid */}
      {loading?<Loading/>:productosFiltrados.length===0?<EmptyState icon="⬡" text="Sin productos."/>:(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
          {productosFiltrados.map(p=>(
            <ProductCard key={p.id} p={p}
              onEdit={()=>setModalProd(p)}
              onDelete={()=>setConfirm({msg:`¿Eliminar "${p.nombre}"?`,fn:()=>eliminar(p.id)})}
              onLote={()=>setModalLote(p)}/>
          ))}
        </div>
      )}

      {/* Footer stats */}
      {!loading&&productosFiltrados.length>0&&<StatsFooter resumen={resumenDia}/>}
    </div>

    {modalProd!==null&&<ModalProducto producto={modalProd} categorias={categorias} onClose={()=>setModalProd(null)} onSaved={cargar}/>}
    {modalLote&&<ModalLote producto={modalLote} onClose={()=>setModalLote(null)} onSaved={cargar}/>}
    {modalCats&&<ModalCategorias onClose={()=>{setModalCats(false);cargarCategorias()}}/>}
    {confirm&&<ConfirmDialog message={confirm.msg} onConfirm={()=>{confirm.fn();setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}

    <style>{`
      @media(max-width:1280px){.stock-g{grid-template-columns:repeat(3,1fr)!important}}
      @media(max-width:960px){.stock-g{grid-template-columns:repeat(2,1fr)!important}}
      @media(max-width:600px){.stock-g{grid-template-columns:1fr!important}}
    `}</style>
  </>)
}
