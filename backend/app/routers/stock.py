from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, distinct
from typing import Optional, List

from app.database import get_db
from app.models import (
    Producto, Variante, StockSucursal, Sucursal,
    Transferencia, TipoTransferenciaEnum
)
from app.schemas import (
    ProductoConStockResponse, VarianteConStockResponse, StockSucursalResponse,
    TransferenciaCreate, TransferenciaResponse
)

router = APIRouter(prefix="/stock", tags=["Stock"])


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _sumar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    """Suma stock a una sucursal de forma atómica, creando el registro si no existe."""
    actualizado = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).update(
        {StockSucursal.cantidad: StockSucursal.cantidad + cantidad},
        synchronize_session=False,
    )
    if not actualizado:
        db.add(StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=cantidad))
        db.flush()  # materializa la fila para que un UPDATE posterior de la misma clave la encuentre


def _get_variante_con_stock(variante: Variante) -> VarianteConStockResponse:
    """Construye el response de variante con desglose de stock por sucursal.

    Se devuelven todas las sucursales activas con registro, incluidas las que
    están en cero o en negativo. Filtrarlas obligaba al cliente a deducir el
    cero por ausencia y hacía invisible el stock negativo, que es justamente el
    caso que hay que mirar: significa que el inventario quedó descuadrado.
    """
    stock_sucursales = []
    stock_total = 0

    for ss in variante.stocks_sucursal:
        if ss.sucursal and ss.sucursal.activa:
            stock_total += ss.cantidad
            stock_sucursales.append(StockSucursalResponse(
                sucursal_id=ss.sucursal_id,
                sucursal_nombre=ss.sucursal.nombre,
                cantidad=ss.cantidad,
            ))

    return VarianteConStockResponse(
        id=variante.id,
        producto_id=variante.producto_id,
        sabor=variante.sabor,
        tamanio=variante.tamanio,
        sku=variante.sku,
        costo=variante.costo,
        precio_venta=variante.precio_venta,
        stock_total=stock_total,
        stock_minimo=variante.stock_minimo,
        activa=variante.activa,
        creado_en=variante.creado_en,
        stocks_sucursal=stock_sucursales,
    )


# ─── ENDPOINTS DE STOCK ───────────────────────────────────────────────────────

@router.get("/marcas", response_model=List[str])
def listar_marcas(db: Session = Depends(get_db)):
    """Retorna la lista de marcas distintas de productos activos."""
    rows = (
        db.query(distinct(Producto.marca))
        .filter(Producto.activo == True, Producto.marca != None, Producto.marca != "")
        .order_by(Producto.marca)
        .all()
    )
    return [r[0] for r in rows]


@router.get("", response_model=List[ProductoConStockResponse])
def listar_stock(
    busqueda: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    marca: Optional[str] = Query(None, description="Filtrar por marca"),
    sucursal_id: Optional[int] = Query(None, description="Filtrar por sucursal específica"),
    db: Session = Depends(get_db)
):
    """Lista todos los productos con stock desglosado por sucursal."""
    query = db.query(Producto).filter(Producto.activo == True)

    if categoria:
        query = query.filter(Producto.categoria.ilike(f"%{categoria}%"))
    if marca:
        query = query.filter(Producto.marca.ilike(f"%{marca}%"))
    if busqueda:
        # Los clientes preguntan por sabor ("¿tenés whey de chocolate?"), así que
        # la búsqueda también mira sabor y tamaño de las variantes. Se usa any()
        # en vez de un join para no duplicar el producto cuando coincide más de
        # una de sus variantes.
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                Producto.nombre.ilike(patron),
                Producto.marca.ilike(patron),
                Producto.variantes.any(
                    and_(
                        Variante.activa == True,
                        or_(Variante.sabor.ilike(patron), Variante.tamanio.ilike(patron)),
                    )
                ),
            )
        )

    productos = query.order_by(Producto.nombre).all()

    result = []
    for prod in productos:
        variantes_activas = [v for v in prod.variantes if v.activa]

        if sucursal_id:
            variantes_activas = [
                v for v in variantes_activas
                if any(ss.sucursal_id == sucursal_id and ss.cantidad > 0 for ss in v.stocks_sucursal)
            ]
            if not variantes_activas:
                continue

        result.append(ProductoConStockResponse(
            id=prod.id,
            nombre=prod.nombre,
            marca=prod.marca,
            categoria=prod.categoria,
            imagen_url=prod.imagen_url,
            activo=prod.activo,
            creado_en=prod.creado_en,
            variantes=[_get_variante_con_stock(v) for v in variantes_activas],
        ))

    return result


@router.get("/variante/{variante_id}", response_model=VarianteConStockResponse)
def stock_variante(variante_id: int, db: Session = Depends(get_db)):
    variante = db.query(Variante).filter(Variante.id == variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    return _get_variante_con_stock(variante)


# ─── AJUSTE MANUAL DE STOCK ──────────────────────────────────────────────────

from pydantic import BaseModel as PydanticBase

class AjusteStockManual(PydanticBase):
    cantidad: int
    sucursal_id: int

@router.put("/variante/{variante_id}/ajuste")
def ajustar_stock_manual(
    variante_id: int,
    data: AjusteStockManual,
    db: Session = Depends(get_db)
):
    """Ajusta el stock de forma manual (para correcciones)."""
    variante = db.query(Variante).filter(Variante.id == variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    sucursal = db.query(Sucursal).filter(
        Sucursal.id == data.sucursal_id, Sucursal.activa == True
    ).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    sucursal_id = data.sucursal_id

    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad = data.cantidad
    else:
        db.add(StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=data.cantidad))

    db.commit()
    variante = db.query(Variante).filter(Variante.id == variante_id).first()
    return _get_variante_con_stock(variante)


# ─── TRANSFERENCIAS ──────────────────────────────────────────────────────────

@router.post("/transferencia", response_model=TransferenciaResponse, status_code=201)
def crear_transferencia(data: TransferenciaCreate, db: Session = Depends(get_db)):
    """Transfiere stock entre dos sucursales. Origen y destino son obligatorios."""
    variante = db.query(Variante).filter(Variante.id == data.variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    if data.sucursal_origen_id is None or data.sucursal_destino_id is None:
        raise HTTPException(status_code=400, detail="Origen y destino son obligatorios")

    origen_id = data.sucursal_origen_id
    destino_id = data.sucursal_destino_id

    if origen_id == destino_id:
        raise HTTPException(status_code=400, detail="El origen y destino no pueden ser la misma sucursal")

    # Validar que ambas sucursales existan y estén activas
    sucursales_validas = {
        s.id for s in db.query(Sucursal).filter(
            Sucursal.id.in_([origen_id, destino_id]), Sucursal.activa == True
        ).all()
    }
    if origen_id not in sucursales_validas or destino_id not in sucursales_validas:
        raise HTTPException(status_code=404, detail="Sucursal de origen o destino no encontrada")

    # Verificar stock en origen
    ss_origen = db.query(StockSucursal).filter(
        StockSucursal.variante_id == data.variante_id,
        StockSucursal.sucursal_id == origen_id
    ).first()
    disponible = ss_origen.cantidad if ss_origen else 0
    if disponible < data.cantidad:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente en origen. Disponible: {disponible}, solicitado: {data.cantidad}"
        )

    # Descuento atómico del origen y suma al destino
    db.query(StockSucursal).filter(
        StockSucursal.variante_id == data.variante_id,
        StockSucursal.sucursal_id == origen_id
    ).update(
        {StockSucursal.cantidad: StockSucursal.cantidad - data.cantidad},
        synchronize_session=False,
    )
    _sumar_stock_sucursal(db, data.variante_id, destino_id, data.cantidad)

    transferencia = Transferencia(
        variante_id=data.variante_id,
        tipo=TipoTransferenciaEnum.entre_sucursales.value,
        sucursal_origen_id=origen_id,
        sucursal_destino_id=destino_id,
        cantidad=data.cantidad,
        notas=data.notas,
    )
    db.add(transferencia)
    db.commit()
    db.refresh(transferencia)
    return transferencia


@router.get("/transferencias", response_model=List[TransferenciaResponse])
def listar_transferencias(
    variante_id: Optional[int] = Query(None),
    sucursal_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Transferencia)
    if variante_id:
        query = query.filter(Transferencia.variante_id == variante_id)
    if sucursal_id:
        query = query.filter(
            (Transferencia.sucursal_origen_id == sucursal_id) |
            (Transferencia.sucursal_destino_id == sucursal_id)
        )
    return query.order_by(Transferencia.fecha.desc()).all()
