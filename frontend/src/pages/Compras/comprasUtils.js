// Helpers de la sección Compras. Comparten forma con los de Ventas: son la
// misma lista leída al revés (plata que sale en vez de plata que entra).

export const METODOS = ['efectivo', 'transferencia', 'tarjeta']

export const PAGO_CORTO = {
  efectivo: 'Efectivo',
  transferencia: 'Transfer.',
  tarjeta: 'Tarjeta',
}

export const horaCorta = (fecha) =>
  new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

const claveDia = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function etiquetaDia(fecha) {
  const d = new Date(fecha)
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(hoy.getDate() - 1)

  if (claveDia(d) === claveDia(hoy)) return 'Hoy'
  if (claveDia(d) === claveDia(ayer)) return 'Ayer'

  const mismoAnio = d.getFullYear() === hoy.getFullYear()
  return d.toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(mismoAnio ? {} : { year: 'numeric' }),
  })
}

/** Agrupa la lista (ya ordenada por fecha desc) en días con su total. */
export function agruparPorDia(compras) {
  const grupos = []
  let actual = null
  for (const c of compras) {
    const clave = claveDia(new Date(c.fecha))
    if (!actual || actual.clave !== clave) {
      actual = { clave, etiqueta: etiquetaDia(c.fecha), compras: [], total: 0 }
      grupos.push(actual)
    }
    actual.compras.push(c)
    actual.total += Number(c.total || 0)
  }
  return grupos
}

/** Nombre legible de un ítem de compra, con lo que haya disponible. */
export function nombreItem(item) {
  return item.producto_nombre || item.variante?.producto?.nombre || `Variante #${item.variante_id}`
}

export function detalleItem(item) {
  return [
    item.producto_marca || item.variante?.producto?.marca,
    item.variante?.sabor,
    item.variante?.tamanio,
  ].filter(Boolean).join(' · ')
}

/**
 * Reparto efectivo de un ítem: {sucursal_id: cantidad}.
 *
 * El backend manda `distribucion` reconstruida desde las transferencias de
 * ingreso. Si viene vacía —compras viejas sin transferencias— se asume que
 * todo quedó en la sucursal de la compra, que es lo que hacía el alta.
 */
export function repartoItem(item, sucursalCompraId) {
  const dist = item.distribucion || []
  if (dist.length) {
    return dist.reduce((acc, d) => {
      acc[d.sucursal_id] = (acc[d.sucursal_id] || 0) + d.cantidad
      return acc
    }, {})
  }
  return { [sucursalCompraId]: item.cantidad }
}

/** true si la compra no quedó entera en una sola sucursal. */
export function estaRepartida(compra) {
  return (compra.items || []).some(i => {
    const claves = Object.keys(repartoItem(i, compra.sucursal_id))
    return claves.length > 1
  })
}

export function unidadesCompra(compra) {
  return (compra.items || []).reduce((s, i) => s + i.cantidad, 0)
}

/** Texto sobre el que busca el filtro de la cabecera. */
export function textoBuscable(compra, sucursalNombre) {
  const productos = (compra.items || [])
    .map(i => `${nombreItem(i)} ${detalleItem(i)}`)
    .join(' ')
  return `${compra.proveedor || 'sin proveedor'} ${sucursalNombre || ''} ${productos}`.toLowerCase()
}

/** Aplana el catálogo a variantes con etiqueta buscable. */
export function variantesDelCatalogo(productos) {
  return productos.flatMap(p =>
    (p.variantes || []).filter(v => v.activa !== false).map(v => ({
      id: v.id,
      costo: Number(v.costo || 0),
      producto: p.nombre,
      marca: p.marca || '',
      detalle: [v.sabor, v.tamanio].filter(Boolean).join(' · '),
      busqueda: [p.nombre, p.marca, v.sabor, v.tamanio].filter(Boolean).join(' ').toLowerCase(),
    }))
  )
}
