import { createContext, useContext, useState, useEffect } from 'react'
import { sucursalesApi } from '../api'

const SucursalContext = createContext(null)

export function SucursalProvider({ children }) {
  const [sucursales, setSucursales] = useState([])
  const [sucursalActual, setSucursalActual] = useState(null)

  const cargarSucursales = () => {
    sucursalesApi.listar().then(r => {
      const d = Array.isArray(r) ? r : []      
      setSucursales(d)
      setSucursalActual(prev => {
        if (prev) {
          const updated = d.find(s => s.id === prev.id)
          return updated || (d.length > 0 ? d[0] : null)
        }
        return d.length > 0 ? d[0] : null
      })
    }).catch(() => {})
  }

  useEffect(() => { cargarSucursales() }, [])

  return (
    <SucursalContext.Provider value={{ sucursales, sucursalActual, setSucursalActual, cargarSucursales }}>
      {children}
    </SucursalContext.Provider>
  )
}

export function useSucursal() {
  return useContext(SucursalContext)
}