import { createContext, useContext, useState, useEffect } from 'react'
import { sucursalesApi } from '../api'

const SucursalContext = createContext(null)

export function SucursalProvider({ children }) {
  const [sucursales, setSucursales] = useState([])
  const [sucursalActual, setSucursalActual] = useState(null)

  const cargarSucursales = () => {
    sucursalesApi.listar()
      .then(({ data: lista }) => {
        setSucursales(lista)
        setSucursalActual(prev => {
          if (prev) {
            const updated = lista.find(s => s.id === prev.id)
            return updated || (lista.length > 0 ? lista[0] : null)
          }
          return lista.length > 0 ? lista[0] : null
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
