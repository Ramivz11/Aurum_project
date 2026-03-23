import { createContext, useContext, useState, useEffect } from 'react'
import { sucursalesApi } from '../api'

const SucursalContext = createContext(null)

export function SucursalProvider({ children }) {
  const [sucursales, setSucursales] = useState([])
  const [sucursalActual, setSucursalActual] = useState(null)

  const cargarSucursales = () => {
    sucursalesApi.listar()
      .then(({ data: lista }) => {
        // Excluir el depósito central del selector de sucursales de venta
        const sucursalesVenta = lista.filter(s => !s.es_central)
        setSucursales(lista)          // lista completa (para stock, transfers, etc.)
        setSucursalActual(prev => {
          if (prev) {
            const updated = sucursalesVenta.find(s => s.id === prev.id)
            return updated || (sucursalesVenta.length > 0 ? sucursalesVenta[0] : null)
          }
          return sucursalesVenta.length > 0 ? sucursalesVenta[0] : null
        })
      })
      .catch(() => {})
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
