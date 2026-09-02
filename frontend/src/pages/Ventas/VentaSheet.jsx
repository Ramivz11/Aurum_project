import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from '../../components/Toast'
import { ventasApi, clientesApi, stockApi } from '../../api'
import { Modal, formatARS, formatDateTime } from '../../components/ui'
import { useSucursal } from '../../context/SucursalContext'
import { PAGO_CORTO } from './ventasUtils'

const METODOS = ['efectivo', 'transferencia', 'tarjeta']

/**
 * Alta y edición de una venta.
 *
 * Editar ya no está limitado a los pedidos abiertos: el backend revierte el
 * stock que la venta había descontado y lo vuelve a aplicar con los datos
 * nuevos, así que una venta confirmada mal cargada se corrige en lugar de
 * borrarse y rehacerse.
 */
export default function VentaSheet({ onClose, onSaved, ventaEditar = null, sucursales = [] }) {
  const edicion = ventaEditar !== null
  const confirmada = ventaEditar?.estado === 'confirmada'

  // La sucursal viene de la que está elegida en el menú, que es donde el
  // usuario ya dijo desde dónde está trabajando. Antes había que repetirlo en
  // cada venta, y con eso la sección de datos tenía que abrirse siempre.
  const { sucursalActual } = useSucursal()
  const sucursalPorDefecto = ventaEditar
    ? String(ventaEditar.sucursal_id)
    : (sucursalActual ? String(sucursalActual.id) : (sucursales.length === 1 ? String(sucursales[0].id) : ''))

  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState({
    cliente_id: ventaEditar?.cliente_id ? String(ventaEditar.cliente_id) : '',
    sucursal_id: sucursalPorDefecto,
    metodo_pago: ventaEditar?.metodo_pago || 'efectivo',
    notas: ventaEditar?.notas || '',
  })
  const [carrito, setCarrito] = useState(() =>
    (ventaEditar?.items || []).map(it => ({
      key: `v${it.variante_id}`,
      variante_id: it.variante_id,
      cantidad: it.cantidad,
      precio_unitario: Number(it.precio_unitario),
      nombre: it.producto_nombre || it.variante?.producto?.nombre || `Variante #${it.variante_id}`,
      detalle: [
        it.producto_marca || it.variante?.producto?.marca,
        it.variante_sabor || it.variante?.sabor,
        it.variante_tamanio || it.variante?.tamanio,
      ].filter(Boolean).join(' · '),
    }))
  )
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Los datos de la venta arrancan plegados: la mayoría va a efectivo, sin
  // cliente y a la sucursal de siempre, y desplegados empujaban el buscador de
  // productos —lo primero que se toca— fuera de pantalla. Se abren sólo si
  // falta elegir la sucursal, o en una edición, que es cuando se entra
  // justamente a corregir alguno de estos campos.
  const [datosAbiertos, setDatosAbiertos] = useState(edicion || !sucursalPorDefecto)
  const buscador = useRef(null)
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [formCliente, setFormCliente] = useState({ nombre: '', ubicacion: '', telefono: '' })

  // El teclado se abre solo sobre el buscador: registrar una venta empieza
  // siempre por cargar el primer producto. Al editar no, porque ahí la hoja se
  // abre para mirar lo que ya está cargado.
  useEffect(() => {
    if (edicion) return
    const id = setTimeout(() => buscador.current?.focus(), 250)
    return () => clearTimeout(id)
  }, [edicion])

  // El contexto de sucursales carga por su cuenta: si la hoja se abrió antes de
  // que llegara, se completa acá en vez de dejar el campo vacío.
  useEffect(() => {
    if (edicion || !sucursalActual) return
    setForm(f => (f.sucursal_id ? f : { ...f, sucursal_id: String(sucursalActual.id) }))
  }, [edicion, sucursalActual])

  useEffect(() => {
    clientesApi.listar().then(r => setClientes(r.data)).catch(() => {})
    stockApi.listar().then(r => setProductos(r.data)).catch(() => toast.error('No se pudo cargar el catálogo'))
  }, [])

  const total = carrito.reduce((a, i) => a + i.precio_unitario * (Number(i.cantidad) || 0), 0)

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    const filas = []
    for (const p of productos) {
      for (const v of (p.variantes || []).filter(v => v.activa !== false)) {
        const texto = [p.nombre, p.marca, v.sabor, v.tamanio].filter(Boolean).join(' ').toLowerCase()
        if (texto.includes(q)) filas.push({ producto: p, variante: v })
      }
      if (filas.length >= 40) break
    }
    return filas
  }, [busqueda, productos])

  const stockDe = (variante) => {
    const ss = variante.stocks_sucursal?.find(s => s.sucursal_id === Number(form.sucursal_id))
    return ss ? ss.cantidad : 0
  }

  // Agregar no borra la búsqueda. Vender tres gustos de la misma marca era
  // escribirla tres veces; ahora la lista queda abierta y cada toque suma uno,
  // con la cantidad ya cargada a la vista en la propia fila del resultado.
  const agregar = (producto, variante) => {
    const key = `v${variante.id}`
    setCarrito(c => c.find(i => i.key === key)
      ? c.map(i => i.key === key ? { ...i, cantidad: (Number(i.cantidad) || 0) + 1 } : i)
      : [...c, {
          key,
          variante_id: variante.id,
          cantidad: 1,
          precio_unitario: Number(variante.precio_venta),
          nombre: producto.nombre,
          detalle: [producto.marca, variante.sabor, variante.tamanio].filter(Boolean).join(' · '),
        }])
  }

  const cambiarCantidad = (key, delta) =>
    setCarrito(c => c.map(i => i.key === key ? { ...i, cantidad: Math.max(1, (Number(i.cantidad) || 0) + delta) } : i))

  // Cargar una docena a golpe de "+" son doce toques: la cantidad también se
  // escribe. Se admite vacío mientras se tipea y se normaliza al salir.
  const escribirCantidad = (key, texto) =>
    setCarrito(c => c.map(i => i.key === key ? { ...i, cantidad: texto === '' ? '' : Math.max(0, parseInt(texto, 10) || 0) } : i))

  const normalizarCantidad = (key) =>
    setCarrito(c => c.map(i => i.key === key ? { ...i, cantidad: Math.max(1, parseInt(i.cantidad, 10) || 1) } : i))

  const enCarrito = (varianteId) =>
    carrito.find(i => i.variante_id === varianteId)?.cantidad || 0

  const crearCliente = async () => {
    if (!formCliente.nombre.trim()) return toast.error('El nombre es obligatorio')
    setCreandoCliente(true)
    try {
      const { data } = await clientesApi.crear(formCliente)
      setClientes(c => [...c, data])
      setForm(f => ({ ...f, cliente_id: String(data.id) }))
      setFormCliente({ nombre: '', ubicacion: '', telefono: '' })
      setNuevoCliente(false)
      toast.success('Cliente creado')
    } catch (e) {
      toast.error(e.message || 'No se pudo crear el cliente')
    } finally {
      setCreandoCliente(false)
    }
  }

  const guardar = async (estado) => {
    if (!form.sucursal_id) return toast.error('Elegí una sucursal')
    if (!carrito.length) return toast.error('Agregá al menos un producto')
    if (carrito.some(i => !(i.precio_unitario > 0))) return toast.error('Hay un producto sin precio')
    if (carrito.some(i => !(Number(i.cantidad) > 0))) return toast.error('Hay un producto sin cantidad')

    setGuardando(true)
    const payload = {
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      sucursal_id: Number(form.sucursal_id),
      metodo_pago: form.metodo_pago,
      // Al editar se respeta el estado que la venta ya tenía, salvo que se
      // pida confirmarla explícitamente. Antes toda edición la devolvía a
      // "abierta", que es lo que hacía imposible corregir una venta cerrada.
      estado,
      notas: form.notas.trim() || null,
      items: carrito.map(i => ({
        variante_id: i.variante_id,
        cantidad: Number(i.cantidad),
        precio_unitario: i.precio_unitario,
      })),
    }
    try {
      if (edicion) {
        await ventasApi.actualizar(ventaEditar.id, payload)
        toast.success(estado === 'confirmada' && ventaEditar.estado !== 'confirmada' ? 'Venta confirmada' : 'Cambios guardados')
      } else {
        await ventasApi.crear(payload)
        toast.success(estado === 'confirmada' ? 'Venta registrada' : 'Pedido guardado')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  // Lo que dice el encabezado plegado: alcanza para confirmar de un vistazo que
  // la venta va como siempre, sin abrir la sección.
  // Orden por lo que hay que verificar: de dónde sale el stock, cómo se cobra
  // y, sólo si se eligió uno, a quién. "Sin cliente" es el caso por defecto y
  // ocupaba el lugar que necesita el nombre de la sucursal.
  const resumenDatos = useMemo(() => {
    const partes = []
    if (sucursales.length > 1) {
      const suc = sucursales.find(s => String(s.id) === form.sucursal_id)
      partes.push(suc ? suc.nombre : 'Elegí sucursal')
    }
    partes.push(PAGO_CORTO[form.metodo_pago])
    const cli = clientes.find(c => String(c.id) === form.cliente_id)
    if (cli) partes.push(cli.nombre)
    return partes.join(' · ')
  }, [form.metodo_pago, form.cliente_id, form.sucursal_id, clientes, sucursales])

  const estadoActual = ventaEditar?.estado || 'confirmada'
  const puedeConfirmar = !edicion || estadoActual === 'abierta'

  return (
    <Modal
      title={edicion ? 'Editar venta' : 'Registrar venta'}
      onClose={onClose}
      size="modal-lg"
      footer={<div className="vta-foot">
        {/* Tres botones apilados a lo ancho se comían un tercio de la hoja en
            el celular. Los secundarios comparten una fila y la acción
            principal queda sola abajo, que es donde llega el pulgar. */}
        <div className="vta-foot-row">
          <button className="btn btn-ghost" onClick={onClose} disabled={guardando}>Cancelar</button>
          {!edicion && (
            <button className="btn btn-ghost" onClick={() => guardar('abierta')} disabled={guardando}>
              Guardar como pedido
            </button>
          )}
          {edicion && puedeConfirmar && (
            <button className="btn btn-ghost" onClick={() => guardar('confirmada')} disabled={guardando}>
              Confirmar venta
            </button>
          )}
        </div>
        {edicion ? (
          <button className="btn btn-primary" onClick={() => guardar(estadoActual)} disabled={guardando}>
            {guardando ? 'Guardando…' : `Guardar cambios · ${formatARS(total)}`}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => guardar('confirmada')} disabled={guardando}>
            {guardando ? 'Registrando…' : `Confirmar · ${formatARS(total)}`}
          </button>
        )}
      </div>}
    >
      {edicion && (
        <div className={`vta-sheet-ctx${confirmada ? ' is-warn' : ''}`}>
          <div className="vta-sheet-ctx-title">
            Venta #{ventaEditar.id} · {formatDateTime(ventaEditar.fecha)}
          </div>
          {confirmada
            ? 'Esta venta ya descontó stock. Al guardar, el inventario se ajusta con la diferencia.'
            : 'Pedido abierto: todavía no descontó stock.'}
        </div>
      )}

      {/* Primero los productos. Una venta se carga buscando lo que el cliente
          pidió; sucursal, pago y cliente son el trámite que viene después y
          antes empujaban el buscador debajo del pliegue en cada alta. */}
      <div className="vta-field">
        <label className="vta-label" htmlFor="vta-buscar">Productos</label>
        <div className="vta-search-wrap">
          <input
            id="vta-buscar"
            ref={buscador}
            className="vta-input"
            type="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, marca o sabor…"
            autoComplete="off"
          />
          {busqueda && (
            <button className="vta-search-x" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">✕</button>
          )}
        </div>

        {busqueda.trim() && (
          <div className="vta-results">
            {resultados.length === 0 && <div className="vta-result" style={{ cursor: 'default' }}>Sin resultados</div>}
            {resultados.map(({ producto, variante }) => {
              const stock = stockDe(variante)
              const puestos = enCarrito(variante.id)
              return (
                <button key={variante.id} className={`vta-result${puestos ? ' is-added' : ''}`} onClick={() => agregar(producto, variante)}>
                  <span className="vta-result-main">
                    <span className="vta-result-name">
                      {producto.nombre}{producto.marca ? ` · ${producto.marca}` : ''}
                    </span>
                    <span className="vta-result-sub">
                      {[variante.sabor, variante.tamanio].filter(Boolean).join(' · ') || 'Única'}
                      {form.sucursal_id && <> — stock <span className={`vta-result-stock${stock <= 0 ? ' is-out' : ''}`}>{stock}</span></>}
                    </span>
                  </span>
                  <span className="vta-result-price">{formatARS(variante.precio_venta)}</span>
                  {/* Cuántas van cargadas de este producto: sin esto, con la
                      lista abierta no había forma de saber cuántas veces se
                      tocó, y se cargaba de más o se volvía a buscar. */}
                  <span className="vta-result-add" aria-hidden="true">{puestos ? `×${puestos}` : '+'}</span>
                </button>
              )
            })}
          </div>
        )}

        {carrito.length === 0 ? (
          <div className="vta-empty-cart">Buscá un producto arriba para agregarlo.</div>
        ) : (
          <>
            {carrito.map(item => (
              <div className="vta-cart-line" key={item.key}>
                <div className="vta-cart-head">
                  <div className="vta-cart-name">
                    {item.nombre}
                    {item.detalle && <div className="vta-cart-sub">{item.detalle}</div>}
                  </div>
                  <div className="vta-cart-sub-total">
                    {formatARS(item.precio_unitario * (Number(item.cantidad) || 0))}
                  </div>
                </div>
                <div className="vta-cart-controls">
                  <div className="vta-step">
                    <button className="vta-step-btn" onClick={() => cambiarCantidad(item.key, -1)}
                      disabled={Number(item.cantidad) <= 1} aria-label="Quitar uno">−</button>
                    {/* Escribible: cargar una docena a golpe de "+" son doce toques. */}
                    <input
                      className="vta-step-qty"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={item.cantidad}
                      onChange={e => escribirCantidad(item.key, e.target.value)}
                      onFocus={e => e.target.select()}
                      onBlur={() => normalizarCantidad(item.key)}
                      aria-label={`Cantidad de ${item.nombre}`}
                    />
                    <button className="vta-step-btn" onClick={() => cambiarCantidad(item.key, 1)} aria-label="Agregar uno">+</button>
                  </div>
                  <input
                    className="vta-cart-price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={item.precio_unitario}
                    aria-label={`Precio unitario de ${item.nombre}`}
                    onFocus={e => e.target.select()}
                    onChange={e => setCarrito(c => c.map(i =>
                      i.key === item.key ? { ...i, precio_unitario: Number(e.target.value) } : i))}
                  />
                  <button className="vta-cart-del" onClick={() => setCarrito(c => c.filter(i => i.key !== item.key))}
                    aria-label={`Quitar ${item.nombre}`}>✕</button>
                </div>
              </div>
            ))}
            <div className="vta-cart-total">
              <span className="vta-cart-total-label">Total</span>
              <span className="vta-cart-total-value">{formatARS(total)}</span>
            </div>
          </>
        )}
      </div>

      {/* El resto de la venta, plegado. El encabezado dice lo que quedó elegido,
          así no hay que abrirlo para verificar que la venta va a efectivo y a la
          sucursal de siempre. */}
      <section className={`vta-fold${datosAbiertos ? ' is-open' : ''}`}>
        <button
          type="button"
          className="vta-fold-head"
          onClick={() => setDatosAbiertos(a => !a)}
          aria-expanded={datosAbiertos}
        >
          <span className="vta-fold-title">Datos de la venta</span>
          <span className="vta-fold-sum">{resumenDatos}</span>
          <span className="vta-fold-chev" aria-hidden="true">⌄</span>
        </button>

        {datosAbiertos && (
          <div className="vta-fold-body">
            {sucursales.length > 1 && (
              <div className="vta-field">
                <label className="vta-label">Sucursal *</label>
                <div className="vta-picker">
                  {sucursales.map(s => (
                    <button
                      key={s.id}
                      className={`vta-opt${String(s.id) === form.sucursal_id ? ' is-active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, sucursal_id: String(s.id) }))}
                    >{s.nombre}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="vta-field">
              <label className="vta-label">Método de pago</label>
              <div className="vta-picker">
                {METODOS.map(m => (
                  <button
                    key={m}
                    className={`vta-opt${form.metodo_pago === m ? ' is-active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, metodo_pago: m }))}
                  >{PAGO_CORTO[m]}</button>
                ))}
              </div>
            </div>

            <div className="vta-field">
              <label className="vta-label" htmlFor="vta-cliente">Cliente</label>
              <div className="vta-row-inline">
                <select
                  id="vta-cliente"
                  className="vta-input"
                  value={form.cliente_id}
                  onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                >
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button className="vta-act" style={{ flex: 'none' }} onClick={() => setNuevoCliente(n => !n)}>
                  {nuevoCliente ? 'Cerrar' : '+ Nuevo'}
                </button>
              </div>

              {nuevoCliente && (
                <div style={{ marginTop: 10 }}>
                  <input className="vta-input" placeholder="Nombre *" value={formCliente.nombre}
                    onChange={e => setFormCliente(n => ({ ...n, nombre: e.target.value }))} />
                  <input className="vta-input" style={{ marginTop: 8 }} placeholder="Ubicación" value={formCliente.ubicacion}
                    onChange={e => setFormCliente(n => ({ ...n, ubicacion: e.target.value }))} />
                  <input className="vta-input" style={{ marginTop: 8 }} placeholder="Teléfono" inputMode="tel" value={formCliente.telefono}
                    onChange={e => setFormCliente(n => ({ ...n, telefono: e.target.value }))} />
                  <button className="vta-act is-primary" style={{ marginTop: 8 }} onClick={crearCliente} disabled={creandoCliente}>
                    {creandoCliente ? 'Creando…' : 'Crear cliente'}
                  </button>
                </div>
              )}
            </div>

            <div className="vta-field" style={{ marginBottom: 0 }}>
              <label className="vta-label" htmlFor="vta-notas">Notas</label>
              <input
                id="vta-notas"
                className="vta-input"
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>
        )}
      </section>
    </Modal>
  )
}
