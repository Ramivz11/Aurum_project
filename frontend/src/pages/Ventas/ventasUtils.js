// Helpers de la sección Ventas. Viven acá y no en el índice para que la página
// quede en lo suyo: cargar, filtrar y pintar.

export const ESTADO_META = {
  confirmada: { clase: 'is-confirmada', etiqueta: 'Confirmada' },
  abierta: { clase: 'is-abierta', etiqueta: 'Pedido' },
  cancelada: { clase: 'is-cancelada', etiqueta: 'Cancelada' },
}

// Los métodos van abreviados: en una fila de dos renglones "Transferencia"
// entera empujaba el importe.
export const PAGO_CORTO = {
  efectivo: 'Efectivo',
  transferencia: 'Transfer.',
  tarjeta: 'Tarjeta',
}

// Reloj de 24 horas: "08:54 a. m." son cinco caracteres de más en una fila que
// ya pelea por el ancho con el importe.
export const horaCorta = (fecha) =>
  new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

// Clave de día en hora local, para que una venta de las 22:30 no caiga en el
// día siguiente por el desfasaje de UTC.
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

/** Agrupa la lista (que ya viene ordenada por fecha desc) en días con su total. */
export function agruparPorDia(ventas) {
  const grupos = []
  let actual = null

  for (const v of ventas) {
    const clave = claveDia(new Date(v.fecha))
    if (!actual || actual.clave !== clave) {
      actual = { clave, etiqueta: etiquetaDia(v.fecha), ventas: [], total: 0 }
      grupos.push(actual)
    }
    actual.ventas.push(v)
    // Lo cancelado no suma al día: el total del encabezado es plata real.
    if (v.estado !== 'cancelada') actual.total += Number(v.total || 0)
  }
  return grupos
}

/** Texto sobre el que busca el filtro de la cabecera. */
export function textoBuscable(venta, clienteNombre, sucursalNombre) {
  const productos = (venta.items || [])
    .map(i => [i.producto_nombre, i.producto_marca, i.variante_sabor, i.variante_tamanio].filter(Boolean).join(' '))
    .join(' ')
  return `${clienteNombre || 'sin cliente'} ${sucursalNombre || ''} ${productos}`.toLowerCase()
}
