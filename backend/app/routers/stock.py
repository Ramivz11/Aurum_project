from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
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


def _get_variante_con_stock(variante: Variante) -> VarianteConStockResponse:
    """Construye el response de variante con desglose de stock."""
    stock_sucursales = []
    for ss in variante.stocks_sucursal:
        if ss.sucursal and ss.sucursal.activa and ss.cantidad > 0:
            stock_sucursales.append(StockSucursalResponse(
                sucursal_id=ss.sucursal_id,
                sucursal_nombre=ss.sucursal.nombre,
                cantidad=ss.cantidad,
            ))

    stock_total_sucursales = sum(ss.cantidad for ss in variante.stocks_sucursal)
    stock_total = variante.stock_actual + stock_total_sucursales

    return VarianteConStockResponse(
        id=variante.id,
        producto_id=variante.producto_id,
        sabor=variante.sabor,
        tamanio=variante.tamanio,
        sku=variante.sku,
        costo=variante.costo,
        precio_venta=variante.precio_venta,
        stock_central=variante.stock_actual,
        stock_total=stock_total,
        stock_minimo=variante.stock_minimo,
        activa=variante.activa,
        creado_en=variante.creado_en,
        stocks_sucursal=stock_sucursales,
    )


@router.get("", response_model=List[ProductoConStockResponse])
def listar_stock(
    busqueda: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    sucursal_id: Optional[int] = Query(None, description="Filtrar por sucursal específica"),
    db: Session = Depends(get_db)
):
    """Lista todos los productos con stock desglosado por sucursal."""
    query = db.query(Producto).filter(Producto.activo == True)

    if categoria:
        query = query.filter(Producto.categoria.ilike(f"%{categoria}%"))
    if busqueda:
        query = query.filter(
            or_(Producto.nombre.ilike(f"%{busqueda}%"), Producto.marca.ilike(f"%{busqueda}%"))
        )

    productos = query.order_by(Producto.nombre).all()

    result = []
    for prod in productos:
        variantes_activas = [v for v in prod.variantes if v.activa]

        # Si filtramos por sucursal, solo incluir variantes con stock en esa sucursal
        if sucursal_id:
            variantes_con_stock = []
            for v in variantes_activas:
                ss = next((s for s in v.stocks_sucursal if s.sucursal_id == sucursal_id), None)
                if ss and ss.cantidad > 0:
                    variantes_con_stock.append(v)
            if not variantes_con_stock:
                continue
            variantes_activas = variantes_con_stock

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
    sucursal_id: Optional[int] = None  # None = central

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

    if data.sucursal_id is None:
        # Ajustar central
        variante.stock_actual = data.cantidad
    else:
        # Ajustar sucursal específica
        ss = db.query(StockSucursal).filter(
            StockSucursal.variante_id == variante_id,
            StockSucursal.sucursal_id == data.sucursal_id
        ).first()
        if ss:
            ss.cantidad = data.cantidad
        else:
            ss = StockSucursal(variante_id=variante_id, sucursal_id=data.sucursal_id, cantidad=data.cantidad)
            db.add(ss)

    db.commit()
    return _get_variante_con_stock(db.query(Variante).filter(Variante.id == variante_id).first())


# ─── TRANSFERENCIAS ──────────────────────────────────────────────────────────

@router.post("/transferencia", response_model=TransferenciaResponse, status_code=201)
def crear_transferencia(data: TransferenciaCreate, db: Session = Depends(get_db)):
    """
    Transfiere stock entre central y sucursal, o entre dos sucursales.
    - origen=None, destino=sucursal → central a sucursal
    - origen=sucursal, destino=None → sucursal a central
    - origen=sucursal, destino=sucursal → entre sucursales
    """
    variante = db.query(Variante).filter(Variante.id == data.variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    # Determinar tipo
    if data.sucursal_origen_id is None and data.sucursal_destino_id is not None:
        tipo = TipoTransferenciaEnum.central_a_sucursal
        # Verificar stock central
        if variante.stock_actual < data.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock central insuficiente. Disponible: {variante.stock_actual}, solicitado: {data.cantidad}"
            )
        variante.stock_actual -= data.cantidad
        # Sumar a sucursal destino
        _sumar_stock_sucursal(db, data.variante_id, data.sucursal_destino_id, data.cantidad)

    elif data.sucursal_origen_id is not None and data.sucursal_destino_id is None:
        tipo = TipoTransferenciaEnum.sucursal_a_central
        # Verificar stock en sucursal origen
        ss_origen = db.query(StockSucursal).filter(
            StockSucursal.variante_id == data.variante_id,
            StockSucursal.sucursal_id == data.sucursal_origen_id
        ).first()
        disponible = ss_origen.cantidad if ss_origen else 0
        if disponible < data.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en sucursal origen. Disponible: {disponible}, solicitado: {data.cantidad}"
            )
        ss_origen.cantidad -= data.cantidad
        variante.stock_actual += data.cantidad

    elif data.sucursal_origen_id is not None and data.sucursal_destino_id is not None:
        tipo = TipoTransferenciaEnum.entre_sucursales
        # Verificar stock en sucursal origen
        ss_origen = db.query(StockSucursal).filter(
            StockSucursal.variante_id == data.variante_id,
            StockSucursal.sucursal_id == data.sucursal_origen_id
        ).first()
        disponible = ss_origen.cantidad if ss_origen else 0
        if disponible < data.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en sucursal origen. Disponible: {disponible}, solicitado: {data.cantidad}"
            )
        ss_origen.cantidad -= data.cantidad
        _sumar_stock_sucursal(db, data.variante_id, data.sucursal_destino_id, data.cantidad)
    else:
        raise HTTPException(status_code=400, detail="Debe especificar al menos un origen o destino")

    transferencia = Transferencia(
        variante_id=data.variante_id,
        tipo=tipo,
        sucursal_origen_id=data.sucursal_origen_id,
        sucursal_destino_id=data.sucursal_destino_id,
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


def _sumar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    """Helper para sumar stock a una sucursal, creando el registro si no existe."""
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad += cantidad
    else:
        ss = StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=cantidad)
        db.add(ss)
