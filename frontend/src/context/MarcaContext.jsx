import { createContext, useContext, useState, useEffect } from 'react'
import { marcasConfigApi, stockApi } from '../api/services'

const MarcaContext = createContext(null)

// Helpers
const hashString = (s) => s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0)
const hslToHex = (h, s, l) => {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const color = l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function MarcaProvider({ children }) {
  const [map, setMap] = useState({})

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [configsRes, marcasRes] = await Promise.all([
          marcasConfigApi.listar().then(r => r.data).catch(() => []),
          stockApi.marcas().then(r => r.data).catch(() => []),
        ])
        if (!mounted) return
        const m = {}
        ;(configsRes || []).forEach(c => { m[c.nombre] = c.color })
        ;(marcasRes || []).forEach(name => {
          if (!name) return
          if (!m[name]) {
            const h = hashString(name) % 360
            m[name] = hslToHex(h, 70, 48)
          }
        })
        setMap(m)
      } catch (e) { }
    }
    load()
    return () => { mounted = false }
  }, [])

  const getColor = (nombre) => {
    if (!nombre) return 'var(--text-muted)'
    return map[nombre] || '#ff9800'
  }

  const hexToRgba = (hex, alpha = 0.12) => {
    if (!hex) return `rgba(255,152,0,${alpha})`
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0,2),16)
    const g = parseInt(h.substring(2,4),16)
    const b = parseInt(h.substring(4,6),16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  const getStyles = (nombre) => {
    const color = getColor(nombre)
    return {
      color,
      background: hexToRgba(color, 0.10),
      border: hexToRgba(color, 0.22),
    }
  }

  const reload = async () => {
    try {
      const configs = await marcasConfigApi.listar().then(r => r.data).catch(() => [])
      const marcas = await stockApi.marcas().then(r => r.data).catch(() => [])
      const m = {}
      ;(configs || []).forEach(c => { m[c.nombre] = c.color })
      ;(marcas || []).forEach(name => {
        if (!name) return
        if (!m[name]) {
          const h = hashString(name) % 360
          m[name] = hslToHex(h, 70, 48)
        }
      })
      setMap(m)
    } catch (e) {}
  }

  return (
    <MarcaContext.Provider value={{ map, getColor, getStyles, reload }}>
      {children}
    </MarcaContext.Provider>
  )
}

export function useMarca() { return useContext(MarcaContext) }
