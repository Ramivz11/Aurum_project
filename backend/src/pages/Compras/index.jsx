import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { comprasApi, productosApi, sucursalesApi } from '../../api/services'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS, formatDate, METODO_PAGO_COLOR, METODO_PAGO_LABEL } from '../../components/ui'

export default function Compras() {
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const cargar = () => { setLoading(true); comprasApi.listar().then(r=>setCompras(r.data)).finally(()=>setLoading(false)) }
  useEffect(()=>{cargar()},[])

  const eliminar = async(id)=>{ await comprasApi.eliminar(id); toast.success('Eliminada, stock revertido'); cargar() }

  return (<>
    <div className="topbar">
      <div className="page-title">Compras</div>
      <div className="topbar-actions">
        <button className="btn btn-ghost" onClick={()=>toast('Módulo IA — próximamente con API key configurada')}>🤖 Cargar con IA</button>
        <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Registrar compra</button>
      </div>
    </div>
    <div className="page-content">
      <div className="card" style={{marginBottom:20,borderColor:'var(--gold-border)',background:'rgba(201,168,76,0.04)'}}>
        <div className="card-body" style={{display:'flex',alignItems:'center',gap:20}}>
          <div style={{fontSize:36}}>🤖</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,marginBottom:4}}>Carga inteligente de facturas</div>
            <div style={{fontSize:13,color:'var(--text-muted)'}}>Subí una foto o PDF de tu factura y la IA detecta automáticamente los productos, cantidades y precios.</div>
          </div>
          <button className="btn btn-primary" onClick={()=>toast('Configurá OPENAI_API_KEY en el .env para activar este módulo')}>Subir factura</button>
        </div>
      </div>
      {loading?<Loading/>:compras.length===0?<EmptyState icon="↓" text="Sin compras registradas."/>:(
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Proveedor</th><th>Sucursal</th><th>Pago</th><th>Total</th><th></th></tr></thead>
          <tbody>{compras.map(c=>(
            <tr key={c.id}>
              <td style={{color:'var(--text-muted)'}}>{formatDate(c.fecha)}</td>
              <td><strong>{c.proveedor||'—'}</strong></td>
              <td style={{color:'var(--text-muted)'}}>#{c.sucursal_id}</td>
              <td><Chip color={METODO_PAGO_COLOR[c.metodo_pago]}>{METODO_PAGO_LABEL[c.metodo_pago]}</Chip></td>
              <td><strong>{formatARS(c.total)}</strong></td>
              <td><button className="btn btn-danger btn-xs" onClick={()=>setConfirm({msg:`¿Eliminar compra? Se revertirá el stock.`,fn:()=>eliminar(c.id)})}>✕</button></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
    </div>
    {confirm&&<ConfirmDialog message={confirm.msg} onConfirm={()=>{confirm.fn();setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}
  </>)
}
