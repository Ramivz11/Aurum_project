import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-area">
        {/* Mobile topbar with hamburger */}
        <div className="mobile-topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
            <span /><span /><span />
          </button>
          <div className="logo-text" style={{ fontSize: 16 }}>AURUM</div>
          <div style={{ width: 36 }} />
        </div>
        <Outlet />
      </div>
    </div>
  )
}
