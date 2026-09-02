import { useState, useEffect, useRef } from 'react'

// Cuenta cuántas capas (modal, confirm, drawer) piden bloquear el scroll de
// fondo. Con un booleano, cerrar un ConfirmDialog abierto sobre un Modal
// desbloquearía el fondo mientras el Modal sigue visible.
let lockCount = 0

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    lockCount++
    document.body.classList.add('scroll-locked')
    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) document.body.classList.remove('scroll-locked')
    }
  }, [active])
}

// ─── TECLADO VIRTUAL ────────────────────────────────────────────────────────
// El overlay es position: fixed, así que vive en el viewport de layout. En iOS
// (y en Android cuando el teclado no reflowea la página) ese viewport NO se
// achica al abrir el teclado: la hoja anclada abajo queda tapada y los botones
// del footer desaparecen debajo de las teclas. visualViewport dice cuánto tapa;
// lo publicamos en --kb y el CSS descuenta esa altura. Cuando el navegador sí
// achica el layout, la cuenta da 0 y no se descuenta dos veces.
let vvCount = 0
let vvHandler = null

function medirTeclado() {
  const vv = window.visualViewport
  if (!vv) return
  const tapado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
  document.documentElement.style.setProperty('--kb', `${Math.round(tapado)}px`)
}

export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    vvCount++
    if (vvCount === 1) {
      vvHandler = medirTeclado
      vv.addEventListener('resize', vvHandler)
      vv.addEventListener('scroll', vvHandler)
    }
    medirTeclado()
    return () => {
      vvCount = Math.max(0, vvCount - 1)
      if (vvCount > 0) return
      vv.removeEventListener('resize', vvHandler)
      vv.removeEventListener('scroll', vvHandler)
      vvHandler = null
      document.documentElement.style.setProperty('--kb', '0px')
    }
  }, [])
}

// ─── CIERRE CON ESCAPE Y BOTÓN ATRÁS ────────────────────────────────────────
// Pila de capas abiertas; la última es la de arriba. Escape y "atrás" solo
// deben cerrar esa: con un listener por capa, un ConfirmDialog abierto sobre
// un Modal se llevaba puestos a los dos de un solo toque.
let capas = []
// history.back() disparados por nosotros al desmontar una capa. También llegan
// como popstate y, sin descontarlos, cerrarían la capa de abajo.
let backsPropios = 0
let popEnganchado = false

function alPop() {
  if (backsPropios > 0) { backsPropios--; return }
  const capa = capas[capas.length - 1]
  if (!capa) return
  capa.consumida = true  // el navegador ya sacó nuestra entrada del historial
  capa.cerrar()
}

export function useDismissable(onClose) {
  // onClose suele ser una arrow inline: guardarla en una ref permite montar
  // el efecto una sola vez. Con [onClose] se reapilaría una entrada de
  // historial en cada render del padre.
  const cb = useRef(onClose)
  cb.current = onClose

  useEffect(() => {
    const capa = { cerrar: () => cb.current(), consumida: false }
    capas.push(capa)

    const onKey = (e) => {
      if (e.key === 'Escape' && capas[capas.length - 1] === capa) cb.current()
    }
    document.addEventListener('keydown', onKey)

    // El botón atrás solo se engancha en producción: en dev, StrictMode monta
    // el efecto dos veces y el history.back() del primer cleanup llegaría al
    // listener ya remontado, cerrando el modal apenas se abre.
    const conHistorial = import.meta.env.PROD
    if (conHistorial) {
      if (!popEnganchado) { window.addEventListener('popstate', alPop); popEnganchado = true }
      window.history.pushState({ modal: true }, '')
    }

    return () => {
      capas = capas.filter(c => c !== capa)
      document.removeEventListener('keydown', onKey)
      if (!conHistorial) return
      // Si se cerró con la X o el overlay, hay que consumir la entrada que
      // agregamos; si se cerró con "atrás", el navegador ya la sacó.
      if (!capa.consumida) { backsPropios++; window.history.back() }
    }
  }, [])
}

// Arrastrar la hoja hacia abajo para cerrarla. El tirador ya se dibujaba en
// móvil pero no hacía nada: la afordancia prometía un gesto que no existía.
function useSwipeToClose(onClose) {
  const hoja = useRef(null)
  const gesto = useRef(null)

  const empezar = (e) => {
    // Con mouse el gesto no aplica (en desktop no hay hoja, hay modal centrado)
    if (e.pointerType === 'mouse') return
    if (e.target.closest('button, a, input, select, textarea')) return
    gesto.current = { y0: e.clientY, t0: Date.now(), dy: 0 }
  }

  const mover = (e) => {
    const g = gesto.current
    if (!g) return
    // Solo hacia abajo: tirar hacia arriba no debe despegar la hoja del borde
    g.dy = Math.max(0, e.clientY - g.y0)
    if (hoja.current) {
      hoja.current.style.transition = 'none'
      hoja.current.style.transform = `translateY(${g.dy}px)`
    }
  }

  const soltar = () => {
    const g = gesto.current
    if (!g) return
    gesto.current = null
    // Un flick corto pero rápido también cierra: esperar 110px de recorrido
    // se siente pesado con el pulgar.
    const flick = g.dy > 40 && Date.now() - g.t0 < 250
    if (g.dy > 110 || flick) return onClose()
    if (hoja.current) {
      hoja.current.style.transition = 'transform 0.18s ease'
      hoja.current.style.transform = ''
    }
  }

  return {
    ref: hoja,
    handlers: { onPointerDown: empezar, onPointerMove: mover, onPointerUp: soltar, onPointerCancel: soltar },
  }
}

// Fondo oscuro + comportamiento común a toda capa modal. Los modales que
// arman su propio contenido (encabezados con pestañas, etc.) lo usan directo;
// el resto va por <Modal>.
export function Overlay({ onClose, children }) {
  useScrollLock()
  useKeyboardInset()
  useDismissable(onClose)
  // Cerrar en el click a secas cerraba la hoja al soltar afuera un arrastre
  // que había empezado adentro (scrollear una lista, arrastrar un campo) y se
  // perdía lo cargado. El gesto tiene que empezar Y terminar en el fondo.
  const desdeElFondo = useRef(false)

  return (
    <div
      className="modal-overlay"
      onPointerDown={(e) => { desdeElFondo.current = e.target === e.currentTarget }}
      onClick={(e) => { if (desdeElFondo.current && e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, size = '' }) {
  const swipe = useSwipeToClose(onClose)
  return (
    <Overlay onClose={onClose}>
      <div ref={swipe.ref} className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-grab" {...swipe.handlers}>
          <div className="modal-drag-handle" />
          <div className="modal-header">
            <span className="modal-title">{title}</span>
            <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </Overlay>
  )
}

// Hook para ramificar el render cuando el CSS solo no alcanza (p.ej. elegir
// entre <table> y lista de DataCard). Se mantiene sincronizado con el
// breakpoint móvil usado en globals.css (768px).
export function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px)`
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return isMobile
}

// Botón flotante para la acción primaria de una página en móvil (solo se
// muestra bajo 768px vía CSS; en desktop queda oculto).
export function FAB({ onClick, icon = '+', title }) {
  return <button className="fab" onClick={onClick} title={title} aria-label={title}>{icon}</button>
}

// Menú "⋮" con acciones — reemplaza filas de botones que en touch no caben
// o que dependían de :hover para mostrarse.
export function DropdownMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [open])

  const visibles = items.filter(it => !it.hidden)
  if (visibles.length === 0) return null

  return (
    <div className="dropdown" ref={ref} onClick={e => e.stopPropagation()}>
      <button className="data-card-menu-btn" onClick={() => setOpen(o => !o)} aria-label="Más acciones">⋮</button>
      {open && (
        <div className="dropdown-menu">
          {visibles.map((it, i) => (
            <div
              key={i}
              className={`dropdown-item${it.danger ? ' danger' : ''}`}
              onClick={() => { setOpen(false); it.onClick() }}
            >{it.label}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// Fila-card genérica para listas en móvil (reemplazo de <tr>): título +
// subtítulo, metadatos libres (chips, fechas), un valor destacado a la
// derecha y un menú de acciones siempre alcanzable en touch.
export function DataCard({ title, subtitle, value, valueColor, meta, actions, onClick }) {
  return (
    <div className="data-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="data-card-body">
        <div className="data-card-title">{title}</div>
        {subtitle && <div className="data-card-subtitle">{subtitle}</div>}
        {meta && <div className="data-card-meta">{meta}</div>}
      </div>
      {value !== undefined && value !== null && (
        <div className="data-card-value" style={{ color: valueColor }}>{value}</div>
      )}
      {actions && <DropdownMenu items={actions} />}
    </div>
  )
}

export function Chip({ children, color = 'gray' }) {
  return <span className={`chip chip-${color}`}>{children}</span>
}

export function Loading() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}>
      <div style={{ width:28,height:28,border:'2px solid var(--surface3)',borderTopColor:'var(--gold)',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} />
      <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
    </div>
  )
}

export function EmptyState({ icon = '◈', text = 'Sin datos', action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-text">{text}</div>
      {action && <div style={{ marginTop:16 }}>{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, delta, deltaUp, color = '' }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
      {delta && <div className={`stat-delta ${deltaUp ? 'up' : 'down'}`}>{deltaUp ? '↑' : '↓'} {delta}</div>}
    </div>
  )
}

export function ConfirmDialog({ message, onConfirm, onCancel }) {
  // Va por <Overlay> como el resto de las capas: hereda el cierre por Escape y
  // por el botón atrás apilados, y el descarte que sólo cuenta cuando el toque
  // empieza y termina en el fondo. Con el onClick suelto que tenía antes, un
  // arrastre que empezaba adentro y soltaba afuera cancelaba la confirmación.
  return (
    <Overlay onClose={onCancel}>
      <div className="modal modal-confirm" role="dialog" aria-modal="true">
        <div className="modal-body" style={{ textAlign:'center', padding:'32px 24px' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
          <div style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.6 }}>{message}</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </Overlay>
  )
}

export const formatARS = (n) =>
  new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(n || 0)

export const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })

export const formatDateTime = (d) =>
  new Date(d).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })

export const METODO_PAGO_COLOR = { efectivo:'green', transferencia:'blue', tarjeta:'gray' }
export const METODO_PAGO_LABEL = { efectivo:'Efectivo', transferencia:'Transferencia', tarjeta:'Tarjeta' }
