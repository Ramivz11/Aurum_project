import { useState, useEffect } from 'react'
import { finanzasApi, ventasApi, clientesApi } from '../../api'
import { StatCard, Loading, formatARS, formatDateTime } from '../../components/ui'
import { useToast } from '../../components/Toast'

export default function Dashboard() {
  const [liquidez, setLiquidez] = useState(null)
  const [analisis, setAnalisis] = useState(null)
  const [topProductos, setTopProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState({})
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    Promise.all([
      finanzasApi.liquidez(),
      finanzasApi.analisisMes(),
      finanzasApi.productosTop({ limite: 5 }),
      ventasApi.pedidosAbiertos(),
      clientesApi.listar(),
    ])
      .then(([liq, ana, top, ped, cli]) => {
        setLiquidez(liq.data)
        setAnalisis(ana.data)
        setTopProductos(top.data)
        setPedidos(ped.data)
        // Mapa id → nombre para lookup rápido
        const mapa = {}
        ;(cli.data || []).forEach(c => {
          mapa[c.id] = c.nombre
          mapa[String(c.id)] = c.nombre
        })
        setClientes(mapa)
      })
      .catch(() => {
        toast('No se pudo cargar el dashboard', 'error')
      })
      .finally(() => setLoading(false))
  }, [toast])

  if (loading) return <div className="page-content"><Loading /></div>

  return (
    <div className="page-content">
      <div className="grid-4">
        <StatCard label="Ingresos del mes" value={formatARS(analisis?.ingresos)} color="gold" />
        <StatCard label="Ganancia neta"    value={formatARS(analisis?.neto)}     color="green" />
        <StatCard label="Compras"          value={formatARS(analisis?.compras)}  color="red" />
        <StatCard label="Gastos"           value={formatARS(analisis?.gastos)} />
      </div>

      <div className="grid-3-1">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Productos más vendidos</span>
            <span className="text-sm text-muted">{analisis?.periodo}</span>
          </div>
          {topProductos.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)" }}>Sin ventas este mes</div>
          ) : topProductos.map((p, i) => (
            <div key={p.variante_id} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 20px", borderBottom: i < topProductos.length-1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:18, color: i===0?"var(--gold)":"var(--text-dim)", width:22 }}>{i+1}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13.5 }}>{p.nombre_producto}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)" }}>{[p.sabor,p.tamanio].filter(Boolean).join(" · ")}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:600 }}>{formatARS(p.ingreso_total)}</div>
                <div style={{ fontSize:11, color:"var(--green)" }}>{p.margen_porcentaje}% margen</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Pedidos abiertos</span>
            {pedidos.length > 0 && <span className="chip chip-gold">{pedidos.length} pendientes</span>}
          </div>
          <div style={{ padding:"12px" }}>
            {pedidos.length === 0 ? (
              <div style={{ padding:"24px 8px", textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>Sin pedidos abiertos 🎉</div>
            ) : pedidos.map(p => (
              <div key={p.id} style={{ background:"var(--surface2)", border:"1px solid rgba(201,168,76,0.2)", borderLeft:"3px solid var(--gold)", borderRadius:8, padding:"12px 14px", marginBottom:8, display:"flex", gap:12, alignItems:"center" }}>
                <span style={{ fontSize:18 }}>🛒</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>
                    {p.cliente_nombre || (p.cliente_id ? (clientes[p.cliente_id] || clientes[String(p.cliente_id)] || `Cliente #${p.cliente_id}`) : "Sin cliente")}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{p.items?.length||0} productos</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:600 }}>{formatARS(p.total)}</div>
                  <div style={{ fontSize:10, color:"var(--text-muted)" }}>{formatDateTime(p.fecha)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Liquidez actual</span></div>
        <div className="card-body">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[["💵 Efectivo", liquidez?.efectivo],["🏦 Transferencia", liquidez?.transferencia],["💳 Tarjeta", liquidez?.tarjeta]].map(([label,val])=>(
              <div key={label} style={{ background:"var(--surface2)", borderRadius:10, padding:16, textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>{label}</div>
                <div style={{ fontFamily:"var(--font-display)", fontSize:20, fontWeight:700, color:"var(--gold-light)" }}>{formatARS(val)}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center", marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}>
            <div style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.1em" }}>Total disponible</div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:32, fontWeight:800, color:"var(--gold-light)", marginTop:4 }}>{formatARS(liquidez?.total)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
