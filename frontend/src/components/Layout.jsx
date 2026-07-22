import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

// En el celular la conexión se corta seguido. Sin este aviso, las acciones
// fallan con un toast genérico y no queda claro que el problema es la red.
function OfflineBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    const online = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null
  return <div className="offline-banner" role="status">Sin conexión — los cambios no se guardarán</div>
}

export default function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <OfflineBanner />
        <Outlet />
      </div>
    </div>
  )
}
