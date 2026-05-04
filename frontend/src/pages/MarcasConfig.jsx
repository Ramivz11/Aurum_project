import { useEffect, useState } from 'react'
import { marcasConfigApi, stockApi } from '../api/services'
import { useMarca } from '../context/MarcaContext'
import { useToast } from '../components/Toast'

export default function MarcasConfig() {
  const toast = useToast()
  const { map, reload, getStyles } = useMarca()
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await marcasConfigApi.listar()
      setConfigs(res.data)
    } catch (e) { toast('Error al cargar', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async (nombre, color) => {
    setSaving(s => ({ ...s, [nombre]: true }))
    try {
      await marcasConfigApi.upsert(nombre, color)
      toast('Guardado')
      await reload()
      await load()
    } catch (e) { toast('Error al guardar', 'error') }
    finally { setSaving(s => ({ ...s, [nombre]: false })) }
  }

  const detectMissing = async () => {
    setLoading(true)
    try {
      const marcas = await stockApi.marcas().then(r => r.data).catch(() => [])
      const payload = (marcas || []).map(nombre => ({ nombre, color: map[nombre] || '#ff9800' }))
      if (payload.length === 0) { toast('No hay marcas detectadas'); return }
      await marcasConfigApi.batch(payload)
      toast('Marcas agregadas')
      await reload()
      await load()
    } catch (e) { toast('Error al detectar', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="page-title">Configuración · Marcas</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>Administra colores por marca</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={detectMissing}>Detectar marcas faltantes</button>
        </div>
      </div>

      <div className="page-content">
        {loading ? <div style={{ padding: 20 }}>Cargando...</div>
          : configs.length === 0 ? <div style={{ padding: 20, color: 'var(--text-muted)' }}>No hay configuraciones.</div>
          : (
            <div style={{ display: 'grid', gap: 10 }}>
              {configs.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.color}</div>
                  </div>
                  <input type="color" value={c.color} onChange={e => { const nc = e.target.value; setConfigs(cs => cs.map(x => x.id === c.id ? { ...x, color: nc } : x)) }} style={{ width: 48, height: 36, border: 'none', background: 'transparent' }} />
                  <button className="btn btn-ghost" onClick={() => save(c.nombre, c.color)} disabled={!!saving[c.nombre]}>{saving[c.nombre] ? 'Guardando...' : 'Guardar'}</button>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
