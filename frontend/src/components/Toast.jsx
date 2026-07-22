import { createContext, useContext, useState, useEffect } from 'react'

const ToastCtx = createContext(null)

// Emisor a nivel de módulo: permite usar `toast(...)` fuera de componentes
// (p.ej. en páginas que antes usaban react-hot-toast) sin pasar por contexto.
let emitter = null
let nextId = 1

function emit(msg, type = 'success') {
  if (emitter) emitter(msg, type)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    emitter = (msg, type) => {
      const id = nextId++
      setToasts(t => [...t, { id, msg, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }
    return () => { emitter = null }
  }, [])

  return (
    <ToastCtx.Provider value={emit}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'success' ? '✓' : '✕'}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

// API estilo react-hot-toast: toast(msg, 'error') o toast.success(msg) / toast.error(msg)
function toastCallable(msg, type = 'success') { emit(msg, type) }
toastCallable.success = (msg) => emit(msg, 'success')
toastCallable.error = (msg) => emit(msg, 'error')
export const toast = toastCallable
