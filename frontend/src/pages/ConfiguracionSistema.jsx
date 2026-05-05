import { useState, useEffect } from 'react'
import { configuracionErpApi } from '../api/services'
import { useToast } from '../components/Toast'

const CAMPOS = [
  {
    key: 'dias_demora_proveedor',
    label: 'Lead Time (días demora proveedor)',
    icon: '🚚',
    desc: 'Días que demora el proveedor en entregar la mercadería.',
    min: 0,
  },
  {
    key: 'dias_stock_seguridad',
    label: 'Stock de Seguridad (días)',
    icon: '🛡',
    desc: 'Días extra de cobertura como colchón de seguridad.',
    min: 0,
  },
  {
    key: 'ventana_dias_analisis_ventas',
    label: 'Ventana de Análisis (días)',
    icon: '📊',
    desc: 'Período de ventas para calcular la velocidad promedio de salida.',
    min: 1,
  },
  {
    key: 'umbral_ventas_producto_estrella',
    label: 'Umbral Producto Estrella (unidades)',
    icon: '⭐',
    desc: 'Mínimo de unidades vendidas en la ventana para considerar un producto como estrella.',
    min: 1,
  },
]

export default function ConfiguracionSistema() {
  const toast = useToast()
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await configuracionErpApi.obtener()
      setConfig(data)
      setForm(data)
      setDirty(false)
    } catch (e) {
      toast(e.message || 'Error al cargar configuración', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (key, value) => {
    const num = parseInt(value) || 0
    setForm(prev => ({ ...prev, [key]: num }))
    setDirty(true)
  }

  const guardar = async () => {
    // Solo enviar campos que cambiaron
    const cambios = {}
    for (const campo of CAMPOS) {
      if (form[campo.key] !== config[campo.key]) {
        cambios[campo.key] = form[campo.key]
      }
    }
    if (!Object.keys(cambios).length) {
      return toast('No hay cambios para guardar', 'error')
    }

    setSaving(true)
    try {
      const { data } = await configuracionErpApi.actualizar(cambios)
      setConfig(data)
      setForm(data)
      setDirty(false)
      toast('Configuración actualizada correctamente')
    } catch (e) {
      toast(e.message || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const resetear = () => {
    setForm({ ...config })
    setDirty(false)
  }

  if (loading) {
    return <div className="loading">Cargando configuración...</div>
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="topbar" style={{ marginBottom: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div className="page-title">⚙ Configuración del Sistema</div>
        <div className="topbar-actions">
          {dirty && (
            <button className="btn btn-ghost btn-sm" onClick={resetear}>
              Descartar
            </button>
          )}
          <button
            id="btn-guardar-config"
            className="btn btn-primary"
            onClick={guardar}
            disabled={saving || !dirty}
          >
            {saving ? 'Guardando...' : '💾 Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="ia-banner" style={{ marginBottom: 24 }}>
        <div className="ia-banner-icon">📐</div>
        <div className="ia-banner-text">
          <div className="ia-banner-title">Reglas de Negocio</div>
          <div className="ia-banner-desc">
            Estos parámetros alimentan al Sugeridor de Compras Inteligente.
            Se leen dinámicamente de la base de datos, no están hardcodeados.
          </div>
        </div>
      </div>

      {/* Campos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {CAMPOS.map(campo => {
          const changed = form[campo.key] !== config[campo.key]
          return (
            <div key={campo.key} className="card" style={{
              marginBottom: 0,
              borderColor: changed ? 'rgba(255,152,0,0.35)' : undefined,
              transition: 'border-color 0.2s',
            }}>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>{campo.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{campo.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {campo.desc}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    id={`config-${campo.key}`}
                    className="form-input"
                    type="number"
                    min={campo.min}
                    value={form[campo.key] ?? ''}
                    onChange={e => handleChange(campo.key, e.target.value)}
                    style={{
                      fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                      textAlign: 'center', maxWidth: 120, padding: '10px 14px',
                    }}
                  />
                  {changed && (
                    <div style={{
                      fontSize: 11, color: 'var(--gold)', fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span>●</span>
                      era {config[campo.key]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
