import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { sucursalesApi } from '../../api'

const NAV = [
  { section:'Principal', items:[
    { to:'/', icon:'◈', label:'Dashboard' },
    { to:'/stock', icon:'⬡', label:'Stock' },
  ]},
  { section:'Operaciones', items:[
    { to:'/ventas', icon:'↑', label:'Ventas', badge:true },
    { to:'/compras', icon:'↓', label:'Compras' },
    { to:'/movimientos', icon:'⇄', label:'Movimientos' },
  ]},
  { section:'Gestión', items:[
    { to:'/clientes', icon:'◯', label:'Clientes' },
    { to:'/finanzas', icon:'◇', label:'Finanzas' },
    { to:'/sucursales', icon:'⬙', label:'Sucursales' },
  ]},
]

export default function Layout({ children, pedidosAbiertos = 0 }) {
  const [sucursales, setSucursales] = useState([])
  const [activa, setActiva] = useState(null)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    sucursalesApi.listar().then(r => { setSucursales(r.data); if(r.data[0]) setActiva(r.data[0]) }).catch(()=>{})
  }, [])

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">AURUM</div>
          <div className="logo-sub">Gestión de suplementos</div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(s => (
            <div key={s.section}>
              <div className="nav-section-label">{s.section}</div>
              {s.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to==='/'} className={({isActive})=>`nav-item${isActive?' active':''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.badge && pedidosAbiertos > 0 && <span className="nav-badge">{pedidosAbiertos}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div style={{ position:'relative' }}>
            <button className="sucursal-btn" onClick={()=>setShowMenu(v=>!v)}>
              <span className="sucursal-dot" />
              <span className="sucursal-name">{activa?.nombre || 'Cargando...'}</span>
              <span className="sucursal-arrow">▾</span>
            </button>
            {showMenu && (
              <div style={{ position:'absolute',bottom:'110%',left:0,right:0,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden',zIndex:10 }}>
                {sucursales.map(s=>(
                  <button key={s.id} onClick={()=>{setActiva(s);setShowMenu(false)}}
                    style={{ display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',background:'none',border:'none',color:s.id===activa?.id?'var(--gold-light)':'var(--text)',fontSize:13,cursor:'pointer' }}>
                    <span style={{ width:7,height:7,borderRadius:'50%',background:s.id===activa?.id?'var(--gold)':'var(--surface3)',flexShrink:0 }} />
                    {s.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="main-area">{children}</div>
    </div>
  )
}
