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

// Cierra la capa con Escape (desktop) y con el botón atrás del sistema
// (Android): sin esto, "atrás" saca al usuario de la pantalla en vez de
// cerrar el modal, que es lo que espera en una app nativa.
export function useDismissable(onClose) {
  // onClose suele ser una arrow inline: guardarla en una ref permite montar
  // el efecto una sola vez. Con [onClose] se reapilaría una entrada de
  // historial en cada render del padre.
  const cb = useRef(onClose)
  cb.current = onClose

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cb.current() }
    document.addEventListener('keydown', onKey)

    // El botón atrás solo se engancha en producción: en dev, StrictMode monta
    // el efecto dos veces y el history.back() del primer cleanup llegaría al
    // listener ya remontado, cerrando el modal apenas se abre.
    const conHistorial = import.meta.env.PROD
    let cerradoPorPop = false
    let onPop

    if (conHistorial) {
      window.history.pushState({ modal: true }, '')
      onPop = () => { cerradoPorPop = true; cb.current() }
      window.addEventListener('popstate', onPop)
    }

    return () => {
      document.removeEventListener('keydown', onKey)
      if (!conHistorial) return
      window.removeEventListener('popstate', onPop)
      // Si se cerró con la X o el overlay, hay que consumir la entrada que
      // agregamos; si se cerró con "atrás", el navegador ya la sacó.
      if (!cerradoPorPop) window.history.back()
    }
  }, [])
}

export function Modal({ title, onClose, children, footer, size = '' }) {
  useScrollLock()
  useDismissable(onClose)
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-drag-handle" />
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
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
  useScrollLock()
  useDismissable(onCancel)
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth:360 }} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign:'center', padding:'32px 24px' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
          <div style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.6 }}>{message}</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
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
