
export function Modal({ title, onClose, children, footer, size = '' }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
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
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth:360 }} onClick={e => e.stopPropagation()}>
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
