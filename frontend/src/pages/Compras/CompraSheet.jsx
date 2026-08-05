import { useState, useMemo } from 'react'
import { toast } from '../../components/Toast'
import { comprasApi } from '../../api'
import { Modal, formatARS, formatDateTime } from '../../components/ui'
import Distribuidor from './Distribuidor'
import { METODOS, PAGO_CORTO, variantesDelCatalogo, repartoItem } from './comprasUtils'

/**
 * Alta y edición de una compra.
 *
 * Dos arreglos de fondo respecto de la versión anterior:
 *
 * 1. Editar ya no borra el reparto. El editor se llenaba con `distribucion: []`
 *    para todos los ítems, así que guardar una compra repartida mandaba todo a
 *    la sucursal de la compra y movía stock que nadie pidió mover. Ahora el
 *    backend devuelve cómo quedó repartida y el editor arranca con eso.
 *
 * 2. El carrito ya no se cae. Al pintar un producto con marca llamaba a
 *    getStyles(), que en este modal nunca se había traído del contexto: agregar
 *    al carrito cualquier producto con marca tiraba la pantalla entera.
 */
export default function CompraSheet({ compra = null, sucursales, productos, onClose, onSaved }) {
  const edicion = compra !== null

  const catalogo = useMemo(() => variantesDelCatalogo(productos), [productos])
  const porId = useMemo(() => Object.fromEntries(catalogo.map(v => [v.id, v])), [catalogo])

  const [proveedor, setProveedor] = useState(compra?.proveedor || '')
  const [sucursalId, setSucursalId] = useState(String(compra?.sucursal_id || sucursales[0]?.id || ''))
  const [metodo, setMetodo] = useState(compra?.metodo_pago || 'efectivo')
  const [notas, setNotas] = useState(compra?.notas || '')
  const [paso, setPaso] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [items, setItems] = useState(() =>
    (compra?.items || []).map(i => {
      const reparto = repartoItem(i, compra.sucursal_id)
      return {
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        costo_unitario: Number(i.costo_unitario),
        // Sólo las sucursales distintas a la de la compra: lo que queda ahí es
        // el resto, igual que en el backend.
        distribucion: Object.entries(reparto)
          .filter(([sucId, cant]) => cant > 0 && Number(sucId) !== compra.sucursal_id)
          .map(([sucId, cant]) => ({ sucursal_id: Number(sucId), cantidad: cant })),
      }
    })
  )

  const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.costo_unitario), 0)
  const unidades = items.reduce((s, i) => s + Number(i.cantidad), 0)
  const variasSucursales = sucursales.length > 1

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    return catalogo.filter(v => v.busqueda.includes(q)).slice(0, 40)
  }, [busqueda, catalogo])

  const agregar = (variante) => {
    setItems(prev => prev.find(i => i.variante_id === variante.id)
      ? prev.map(i => i.variante_id === variante.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      : [...prev, { variante_id: variante.id, cantidad: 1, costo_unitario: variante.costo, distribucion: [] }])
    setBusqueda('')
  }

  const setCampo = (varianteId, campo, valor) =>
    setItems(prev => prev.map(i => i.variante_id === varianteId ? { ...i, [campo]: valor } : i))

  const cambiarCantidad = (varianteId, delta) =>
    setItems(prev => prev.map(i => {
      if (i.variante_id !== varianteId) return i
      const cantidad = Math.max(1, i.cantidad + delta)
      // Al bajar la cantidad, un reparto viejo puede quedar por encima del
      // total. Se recorta acá y no al guardar, donde el backend lo rechazaría
      // con un error que no dice qué producto lo causó.
      const distribucion = recortarReparto(i.distribucion, cantidad)
      return { ...i, cantidad, distribucion }
    }))

  const quitar = (varianteId) => setItems(prev => prev.filter(i => i.variante_id !== varianteId))

  // Cambiar la sucursal que recibe obliga a limpiar el reparto que la nombraba:
  // lo que va a la sucursal de la compra es el resto, y contarlo dos veces
  // dejaría la suma por encima de lo comprado.
  const elegirSucursal = (id) => {
    setSucursalId(String(id))
    setItems(prev => prev.map(i => ({
      ...i,
      distribucion: (i.distribucion || []).filter(d => d.sucursal_id !== Number(id)),
    })))
  }

  const guardar = async () => {
    if (!sucursalId) return toast.error('Elegí una sucursal')
    if (!items.length) return toast.error('Agregá al menos un producto')
    if (items.some(i => !(Number(i.costo_unitario) > 0))) return toast.error('Hay un producto sin costo')

    const excedido = items.find(i => sumar(i.distribucion) > i.cantidad)
    if (excedido) {
      setPaso(2)
      return toast.error(`El reparto de ${porId[excedido.variante_id]?.producto || 'un producto'} supera lo comprado`)
    }

    setGuardando(true)
    const payload = {
      proveedor: proveedor.trim() || null,
      sucursal_id: Number(sucursalId),
      metodo_pago: metodo,
      notas: notas.trim() || null,
      items: items.map(i => ({
        variante_id: Number(i.variante_id),
        cantidad: Number(i.cantidad),
        costo_unitario: Number(i.costo_unitario),
        distribucion: (i.distribucion || []).filter(d => d.cantidad > 0),
      })),
    }
    try {
      if (edicion) {
        await comprasApi.actualizar(compra.id, payload)
        toast.success('Cambios guardados')
      } else {
        await comprasApi.crear(payload)
        toast.success('Compra registrada')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={edicion ? 'Editar compra' : 'Registrar compra'}
      onClose={onClose}
      size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={guardando}>Cancelar</button>
        {paso === 1 && variasSucursales && items.length > 0 && (
          <button className="btn btn-ghost" onClick={() => setPaso(2)}>Repartir por sucursal →</button>
        )}
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : `${edicion ? 'Guardar cambios' : 'Registrar'} · ${formatARS(total)}`}
        </button>
      </>}
    >
      {edicion && (
        <div className="cmp-sheet-ctx is-warn">
          <div className="cmp-sheet-ctx-title">Compra #{compra.id} · {formatDateTime(compra.fecha)}</div>
          Al guardar se revierte el stock de esta compra y se vuelve a aplicar con los datos nuevos.
        </div>
      )}

      {variasSucursales && (
        <div className="cmp-steps">
          <button
            className={`cmp-steps-item${paso === 1 ? ' is-active' : ''}`}
            onClick={() => setPaso(1)}
          >1 · Productos</button>
          <button
            className={`cmp-steps-item${paso === 2 ? ' is-active' : ''}`}
            onClick={() => setPaso(2)}
            disabled={items.length === 0}
          >2 · Reparto</button>
        </div>
      )}

      {paso === 1 ? (
        <>
          {variasSucursales && (
            <div className="cmp-field">
              <label className="cmp-label">Sucursal que recibe *</label>
              <div className="cmp-picker">
                {sucursales.map(s => (
                  <button
                    key={s.id}
                    className={`cmp-opt${String(s.id) === sucursalId ? ' is-active' : ''}`}
                    onClick={() => elegirSucursal(s.id)}
                  >{s.nombre}</button>
                ))}
              </div>
            </div>
          )}

          <div className="cmp-field">
            <label className="cmp-label">Método de pago</label>
            <div className="cmp-picker">
              {METODOS.map(m => (
                <button
                  key={m}
                  className={`cmp-opt${metodo === m ? ' is-active' : ''}`}
                  onClick={() => setMetodo(m)}
                >{PAGO_CORTO[m]}</button>
              ))}
            </div>
          </div>

          <div className="cmp-field">
            <label className="cmp-label" htmlFor="cmp-proveedor">Proveedor</label>
            <input
              id="cmp-proveedor"
              className="cmp-input"
              value={proveedor}
              onChange={e => setProveedor(e.target.value)}
              placeholder="Opcional — ej. Nutri Argentina"
            />
          </div>

          <div className="cmp-field">
            <label className="cmp-label" htmlFor="cmp-buscar">Agregar producto</label>
            <input
              id="cmp-buscar"
              className="cmp-input"
              type="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Nombre, marca o sabor…"
            />
            {busqueda.trim() && (
              <div className="cmp-results">
                {resultados.length === 0 && <div className="cmp-result" style={{ cursor: 'default' }}>Sin resultados</div>}
                {resultados.map(v => (
                  <button key={v.id} className="cmp-result" onClick={() => agregar(v)}>
                    <span className="cmp-result-main">
                      <span className="cmp-result-name">{v.producto}{v.marca ? ` · ${v.marca}` : ''}</span>
                      <span className="cmp-result-sub">{v.detalle || 'Única'} — último costo</span>
                    </span>
                    <span className="cmp-result-price">{formatARS(v.costo)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="cmp-field">
            <label className="cmp-label">Productos de la compra</label>
            {items.length === 0 ? (
              <div className="cmp-empty-cart">Buscá un producto arriba para agregarlo.</div>
            ) : (
              <>
                {items.map(item => {
                  const v = porId[item.variante_id]
                  const anterior = v?.costo || 0
                  const delta = anterior > 0 && item.costo_unitario > 0
                    ? Math.round(((item.costo_unitario - anterior) / anterior) * 100)
                    : 0
                  return (
                    <div className="cmp-cart-line" key={item.variante_id}>
                      <div className="cmp-cart-head">
                        <div className="cmp-cart-name">
                          {v ? `${v.producto}${v.marca ? ` · ${v.marca}` : ''}` : `Variante #${item.variante_id}`}
                          {v?.detalle && <div className="cmp-cart-sub">{v.detalle}</div>}
                        </div>
                        <div className="cmp-cart-subtotal">{formatARS(item.cantidad * item.costo_unitario)}</div>
                      </div>
                      <div className="cmp-cart-controls">
                        <div className="cmp-step">
                          <button className="cmp-step-btn" onClick={() => cambiarCantidad(item.variante_id, -1)}
                            disabled={item.cantidad <= 1} aria-label="Quitar uno">−</button>
                          <span className="cmp-step-qty">{item.cantidad}</span>
                          <button className="cmp-step-btn" onClick={() => cambiarCantidad(item.variante_id, 1)}
                            aria-label="Agregar uno">+</button>
                        </div>
                        <div className="cmp-cart-cost">
                          <span className="cmp-cart-cost-label">Costo c/u</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={item.costo_unitario}
                            aria-label={`Costo unitario de ${v?.producto || 'producto'}`}
                            onChange={e => setCampo(item.variante_id, 'costo_unitario', Number(e.target.value))}
                          />
                        </div>
                        <button className="cmp-cart-del" onClick={() => quitar(item.variante_id)}
                          aria-label="Quitar producto">✕</button>
                      </div>
                      {/* Comprar más caro que la última vez se come el margen de
                          todo lo que se venda después; hasta ahora pasaba mudo. */}
                      {delta !== 0 && (
                        <div className={`cmp-cart-delta ${delta > 0 ? 'is-up' : 'is-down'}`}>
                          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}% vs. último costo ({formatARS(anterior)})
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="cmp-cart-total">
                  <span className="cmp-cart-total-label">{unidades} u. · Total</span>
                  <span className="cmp-cart-total-value">{formatARS(total)}</span>
                </div>
              </>
            )}
          </div>

          <div className="cmp-field">
            <label className="cmp-label" htmlFor="cmp-notas">Notas</label>
            <textarea
              id="cmp-notas"
              className="cmp-input"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </>
      ) : (
        <>
          <div className="cmp-sheet-ctx">
            Lo que no repartas queda en <strong style={{ color: 'var(--s-text)' }}>
              {sucursales.find(s => String(s.id) === sucursalId)?.nombre || 'la sucursal de la compra'}
            </strong>.
          </div>
          {items.map(item => {
            const v = porId[item.variante_id]
            return (
              <Distribuidor
                key={item.variante_id}
                nombre={v ? `${v.producto}${v.marca ? ` · ${v.marca}` : ''}` : `Variante #${item.variante_id}`}
                detalle={v?.detalle}
                cantidad={item.cantidad}
                sucursales={sucursales}
                sucursalBaseId={sucursalId}
                distribucion={item.distribucion}
                onChange={dist => setCampo(item.variante_id, 'distribucion', dist)}
              />
            )
          })}
        </>
      )}
    </Modal>
  )
}

const sumar = (dist) => (dist || []).reduce((s, d) => s + (d.cantidad || 0), 0)

/** Recorta un reparto para que no supere la cantidad comprada. */
function recortarReparto(distribucion, cantidad) {
  let disponible = cantidad
  const recortado = []
  for (const d of distribucion || []) {
    const cant = Math.min(d.cantidad, disponible)
    if (cant > 0) recortado.push({ ...d, cantidad: cant })
    disponible -= cant
  }
  return recortado
}
