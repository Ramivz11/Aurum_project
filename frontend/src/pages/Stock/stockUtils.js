// Cálculos de stock compartidos por la lista, el resumen y las hojas.
// Antes vivían duplicados dentro de cada componente de la página.

export const fmtN = (n) => Number(n ?? 0).toLocaleString('es-AR')

// El backend arma stocks_sucursal por variante. Una sucursal puede no figurar
// (nunca tuvo movimiento), y eso equivale a cero.
export const cantidadEn = (variante, sucursalId) =>
  (variante?.stocks_sucursal || []).find(s => s.sucursal_id === sucursalId)?.cantidad ?? 0

export const variantesActivas = (producto) =>
  (producto?.variantes || []).filter(v => v.activa !== false)

export const totalVariante = (variante) =>
  (variante?.stocks_sucursal || []).reduce((a, s) => a + s.cantidad, 0)

export const totalProducto = (producto) =>
  variantesActivas(producto).reduce((a, v) => a + totalVariante(v), 0)

// Cuatro estados, en orden de gravedad. El negativo indica un descuadre de
// inventario: hay que verlo distinto del cero, que es simplemente "no queda".
export function estadoStock(cantidad, minimo = 0) {
  if (cantidad < 0) return 'neg'
  if (cantidad === 0) return 'out'
  if (cantidad <= minimo) return 'low'
  return 'ok'
}

// El color solo no alcanza: quien no distingue verde de ámbar necesita otra
// señal, así que cada estado tiene además una forma propia.
export const MARCA_ESTADO = { ok: '●', low: '◐', out: '○', neg: '✕' }

export const ETIQUETA_ESTADO = {
  ok: 'con stock',
  low: 'bajo el mínimo',
  out: 'sin stock',
  neg: 'stock negativo',
}

export const etiquetaVariante = (v) =>
  [v?.sabor, v?.tamanio].filter(Boolean).join(' · ') || 'Única'

export function margenPct(costo, precio) {
  const c = Number(costo || 0)
  const p = Number(precio || 0)
  if (c <= 0 || p <= 0) return null
  return Math.round(((p - c) / p) * 100)
}

export const estadoMargen = (m) => (m >= 25 ? 'ok' : m >= 15 ? 'low' : 'out')

// Un producto está bajo mínimo si alguna variante lo está en alguna sucursal.
// Se evalúa sobre la lista de sucursales activas y no sobre stocks_sucursal,
// porque una sucursal ausente cuenta como cero.
export function productoBajoMinimo(producto, sucursales) {
  return variantesActivas(producto).some(v =>
    sucursales.some(s => {
      const q = cantidadEn(v, s.id)
      return q >= 0 && q <= (v.stock_minimo ?? 0)
    })
  )
}

export const productoAgotado = (producto) => {
  const vs = variantesActivas(producto)
  return vs.length > 0 && vs.every(v => totalVariante(v) <= 0)
}
