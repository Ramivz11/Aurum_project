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


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _sumar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    """Suma stock a una sucursal, creando el registro si no existe."""
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad += cantidad
    else:
        db.add(StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=cantidad))


def _get_central(db: Session) -> Sucursal:
    """Retorna el depósito central."""
    central = db.query(Sucursal).filter(Sucursal.es_central == True, Sucursal.activa == True).first()
    if not central:
        raise HTTPException(status_code=500, detail="Depósito central no configurado")
    return central


def _resolve_sucursal(db: Session, sucursal_id: Optional[int]) -> int:
    """None → ID del depósito central. Permite compatibilidad con el frontend existente."""
    if sucursal_id is None:
        return _get_central(db).id
    return sucursal_id


def _get_variante_con_stock(variante: Variante) -> VarianteConStockResponse:
    """Construye el response de variante con desglose de stock por sucursal."""
    stock_sucursales = []
    stock_total = 0
    stock_central = 0

    for ss in variante.stocks_sucursal:
        if ss.sucursal and ss.sucursal.activa:
            stock_total += ss.cantidad
            if ss.sucursal.es_central:
                stock_central = ss.cantidad
            if ss.cantidad > 0:
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
        stock_central=stock_central,
        stock_total=stock_total,
        stock_minimo=variante.stock_minimo,
        activa=variante.activa,
        creado_en=variante.creado_en,
        stocks_sucursal=stock_sucursales,
    )


# ─── ENDPOINTS DE STOCK ───────────────────────────────────────────────────────

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
    sucursal_id: Optional[int] = None  # None = depósito central

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

    sucursal_id = _resolve_sucursal(db, data.sucursal_id)

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
    """
    Transfiere stock entre sucursales (incluyendo el depósito central).
    - sucursal_origen_id=None  → desde el depósito central
    - sucursal_destino_id=None → hacia el depósito central
    """
    variante = db.query(Variante).filter(Variante.id == data.variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    origen_id = _resolve_sucursal(db, data.sucursal_origen_id)
    destino_id = _resolve_sucursal(db, data.sucursal_destino_id)

    if origen_id == destino_id:
        raise HTTPException(status_code=400, detail="El origen y destino no pueden ser la misma sucursal")

    # Determinar tipo de transferencia
    central = _get_central(db)
    if origen_id == central.id:
        tipo = TipoTransferenciaEnum.central_a_sucursal
    elif destino_id == central.id:
        tipo = TipoTransferenciaEnum.sucursal_a_central
    else:
        tipo = TipoTransferenciaEnum.entre_sucursales

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

    ss_origen.cantidad -= data.cantidad
    _sumar_stock_sucursal(db, data.variante_id, destino_id, data.cantidad)

    transferencia = Transferencia(
        variante_id=data.variante_id,
        tipo=tipo,
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
