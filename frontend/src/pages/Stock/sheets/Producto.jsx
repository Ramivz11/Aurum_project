import { useState } from 'react'
import { Modal } from '../../../components/ui'
import { toast } from '../../../components/Toast'
import { productosApi } from '../../../api'
import { etiquetaVariante, margenPct, estadoMargen } from '../stockUtils'

const VARIANTE_VACIA = { sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0, dias_duracion: '' }

const normalizar = (v) => ({
  sabor: v.sabor || null,
  tamanio: v.tamanio || null,
  costo: parseFloat(v.costo) || 0,
  precio_venta: parseFloat(v.precio_venta) || 0,
  stock_minimo: parseInt(v.stock_minimo, 10) || 0,
  dias_duracion: v.dias_duracion ? parseInt(v.dias_duracion, 10) : null,
})

function VarianteCard({ v, indice, onCambiar, onQuitar, onRestaurar }) {
  const margen = margenPct(v.costo, v.precio_venta)

  if (v._eliminada) {
    return (
      <div className="stk-varcard is-removed">
        <div className="stk-varcard-head">
          <span className="stk-varcard-title">
            {etiquetaVariante(v)} — se va a eliminar
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onRestaurar}>Deshacer</button>
        </div>
      </div>
    )
  }

  return (
    <div className="stk-varcard">
      <div className="stk-varcard-head">
        <span className="stk-varcard-title">{etiquetaVariante(v) || `Variante ${indice + 1}`}</span>
        <button className="btn btn-ghost btn-sm" onClick={onQuitar}>Quitar</button>
      </div>

      <div className="stk-pair" style={{ marginBottom: 12 }}>
        <div>
          <span className="stk-label">Sabor</span>
          <input className="stk-input" value={v.sabor || ''} placeholder="Chocolate"
            onChange={e => onCambiar('sabor', e.target.value)} />
        </div>
        <div>
          <span className="stk-label">Tamaño</span>
          <input className="stk-input" value={v.tamanio || ''} placeholder="1 kg"
            onChange={e => onCambiar('tamanio', e.target.value)} />
        </div>
      </div>

      <div className="stk-pair" style={{ marginBottom: 12 }}>
        <div>
          <span className="stk-label">Costo</span>
          <input className="stk-input" type="number" inputMode="decimal" value={v.costo ?? ''} placeholder="0"
            onChange={e => onCambiar('costo', e.target.value)} />
        </div>
        <div>
          <span className="stk-label">Precio de venta</span>
          <input className="stk-input" type="number" inputMode="decimal" value={v.precio_venta ?? ''} placeholder="0"
            onChange={e => onCambiar('precio_venta', e.target.value)} />
        </div>
      </div>

      {margen !== null && (
        <p className="stk-help">
          Margen: <strong className={`stk-var-margin is-${estadoMargen(margen)}`}>{margen}%</strong>
        </p>
      )}

      <div className="stk-pair" style={{ marginTop: 12 }}>
        <div>
          <span className="stk-label">Stock mínimo</span>
          <input className="stk-input" type="number" inputMode="numeric" value={v.stock_minimo ?? 0}
            onChange={e => onCambiar('stock_minimo', e.target.value)} />
        </div>
        <div>
          <span className="stk-label">Días de duración</span>
          <input className="stk-input" type="number" inputMode="numeric" value={v.dias_duracion || ''} placeholder="60"
            onChange={e => onCambiar('dias_duracion', e.target.value)} />
        </div>
      </div>
      <p className="stk-help">
        El mínimo marca cuándo avisar que hay que reponer. Los días estiman cuánto le dura al cliente.
      </p>
    </div>
  )
}

/**
 * Alta y edición de producto, en dos pasos.
 *
 * Antes era un solo formulario con las variantes plegadas detrás de un toggle y
 * cuatro campos numéricos en una fila que, en un celular de 360px, colapsaba a
 * dos columnas sin que se entendiera cuál era cuál. Ahora los datos del
 * producto y sus variantes son dos pasos separados, y cada variante es una
 * tarjeta con sus campos etiquetados.
 */
export default function ProductoSheet({ producto, categorias, onClose, onSaved }) {
  const esEdicion = !!producto?.id

  const [paso, setPaso] = useState('producto')
  const [form, setForm] = useState({
    nombre: producto?.nombre || '',
    marca: producto?.marca || '',
    categoria: producto?.categoria || '',
    imagen_url: producto?.imagen_url || '',
  })
  const [variantes, setVariantes] = useState(() =>
    producto?.variantes?.filter(v => v.activa !== false).map(v => ({
      id: v.id,
      sabor: v.sabor || '',
      tamanio: v.tamanio || '',
      costo: v.costo ?? '',
      precio_venta: v.precio_venta ?? '',
      stock_minimo: v.stock_minimo ?? 0,
      dias_duracion: v.dias_duracion ?? '',
    })) || [{ ...VARIANTE_VACIA }]
  )
  // Sólo se mandan las variantes al backend si se tocaron: evita N llamadas por
  // guardado cuando alguien entró sólo a corregir el nombre.
  const [variantesTocadas, setVariantesTocadas] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cambiarVariante = (i, campo, valor) => {
    setVariantesTocadas(true)
    setVariantes(arr => arr.map((v, idx) => (idx === i ? { ...v, [campo]: valor } : v)))
  }

  const quitarVariante = (i) => {
    setVariantesTocadas(true)
    setVariantes(arr => {
      const v = arr[i]
      // Las que ya existen se marcan para borrar (se puede deshacer); las nuevas
      // se sacan directamente.
      if (v.id) return arr.map((x, idx) => (idx === i ? { ...x, _eliminada: true } : x))
      return arr.filter((_, idx) => idx !== i)
    })
  }

  const agregarVariante = () => {
    setVariantesTocadas(true)
    setVariantes(arr => [...arr, { ...VARIANTE_VACIA }])
  }

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setPaso('producto')
      return toast.error('Poné un nombre al producto')
    }
    const vivas = variantes.filter(v => !v._eliminada)
    if (vivas.length === 0) {
      setPaso('variantes')
      return toast.error('Dejá al menos una variante')
    }

    setGuardando(true)
    try {
      if (esEdicion) {
        await productosApi.actualizar(producto.id, form)
        if (variantesTocadas) {
          await Promise.all(variantes.map(v => {
            if (v._eliminada && v.id) return productosApi.eliminarVariante(v.id)
            if (v.id) return productosApi.actualizarVariante(v.id, normalizar(v))
            return productosApi.crearVariante(producto.id, normalizar(v))
          }))
        }
        toast.success('Producto actualizado')
      } else {
        await productosApi.crear({ ...form, variantes: vivas.map(normalizar) })
        toast.success('Producto creado')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar el producto')
    } finally {
      setGuardando(false)
    }
  }

  const cantidadVivas = variantes.filter(v => !v._eliminada).length

  return (
    <Modal
      title={esEdicion ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      size="modal-lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          {paso === 'producto' ? (
            <button className="btn btn-primary" onClick={() => setPaso('variantes')}>
              Seguir con las variantes
            </button>
          ) : (
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar producto'}
            </button>
          )}
        </>
      }
    >
      <div className="stk-steps" role="tablist">
        <button
          role="tab"
          aria-selected={paso === 'producto'}
          className={`stk-steps-item${paso === 'producto' ? ' is-active' : ''}`}
          onClick={() => setPaso('producto')}
        >Producto</button>
        <button
          role="tab"
          aria-selected={paso === 'variantes'}
          className={`stk-steps-item${paso === 'variantes' ? ' is-active' : ''}`}
          onClick={() => setPaso('variantes')}
        >Variantes ({cantidadVivas})</button>
      </div>

      {paso === 'producto' ? (
        <>
          <div className="stk-field">
            <label className="stk-label" htmlFor="stk-p-nombre">Nombre</label>
            <input
              id="stk-p-nombre"
              className="stk-input"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Whey Protein"
              autoFocus
            />
          </div>

          <div className="stk-field">
            <label className="stk-label" htmlFor="stk-p-marca">Marca</label>
            <input
              id="stk-p-marca"
              className="stk-input"
              value={form.marca}
              onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
              placeholder="ENA"
            />
          </div>

          <div className="stk-field">
            <label className="stk-label" htmlFor="stk-p-cat">Categoría</label>
            <select
              id="stk-p-cat"
              className="stk-input"
              value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            >
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </div>

          <div className="stk-field">
            <label className="stk-label" htmlFor="stk-p-img">Imagen</label>
            <input
              id="stk-p-img"
              className="stk-input"
              type="url"
              inputMode="url"
              value={form.imagen_url}
              onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))}
              placeholder="https://…"
            />
            <p className="stk-help">Dirección de una foto del producto. Se puede dejar vacío.</p>
          </div>
        </>
      ) : (
        <>
          {variantes.map((v, i) => (
            <VarianteCard
              key={v.id || `nueva-${i}`}
              v={v}
              indice={i}
              onCambiar={(campo, valor) => cambiarVariante(i, campo, valor)}
              onQuitar={() => quitarVariante(i)}
              onRestaurar={() => cambiarVariante(i, '_eliminada', false)}
            />
          ))}
          <button className="btn btn-ghost" onClick={agregarVariante} style={{ width: '100%', justifyContent: 'center' }}>
            + Agregar variante
          </button>
        </>
      )}
    </Modal>
  )
}
