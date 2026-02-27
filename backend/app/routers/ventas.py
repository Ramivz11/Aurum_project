from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models import Venta, VentaItem, Variante, StockSucursal, EstadoVentaEnum
from app.schemas import VentaCreate, VentaUpdate, VentaResponse

router = APIRouter(prefix="/ventas", tags=["Ventas"])


def _venta_a_response(venta: Venta) -> dict:
    """Convierte una Venta ORM en dict con cliente_nombre incluido."""
    data = VentaResponse.model_validate(venta).model_dump()
    data["cliente_nombre"] = venta.cliente.nombre if venta.cliente else None
    return data


def _get_stock_disponible(db: Session, variante_id: int, sucursal_id: int) -> int:
    """Stock disponible en una sucursal específica."""
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    return ss.cantidad if ss else 0


def _descontar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    """Descuenta stock de una sucursal. Si no hay suficiente, intenta del central."""
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    disponible_sucursal = ss.cantidad if ss else 0

    if disponible_sucursal >= cantidad:
        ss.cantidad -= cantidad
    else:
        # No hay suficiente en sucursal, intentar combinar con central
        variante = db.query(Variante).filter(Variante.id == variante_id).first()
        faltante = cantidad - disponible_sucursal
        if (disponible_sucursal + variante.stock_actual) < cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente. En sucursal: {disponible_sucursal}, en central: {variante.stock_actual}, solicitado: {cantidad}"
            )
        if ss:
            ss.cantidad = 0
        variante.stock_actual -= faltante


def _restaurar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    """Devuelve stock a la sucursal al eliminar/revertir una venta."""
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad += cantidad
    else:
        ss = StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=cantidad)
        db.add(ss)


def _calcular_y_guardar_venta(db: Session, venta: Venta, items_data: list):
    total = Decimal("0")
    for item_data in items_data:
        variante = db.query(Variante).filter(Variante.id == item_data.variante_id).first()
        if not variante:
            raise HTTPException(status_code=404, detail=f"Variante {item_data.variante_id} no encontrada")

        # Verificar stock disponible (sucursal + central)
        disponible_sucursal = _get_stock_disponible(db, item_data.variante_id, venta.sucursal_id)
        disponible_total = disponible_sucursal + variante.stock_actual

        if venta.estado == EstadoVentaEnum.confirmada and disponible_total < item_data.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para variante {item_data.variante_id}. "
                       f"En sucursal: {disponible_sucursal}, en central: {variante.stock_actual}, solicitado: {item_data.cantidad}"
            )

        subtotal = item_data.precio_unitario * item_data.cantidad
        total += subtotal

        item = VentaItem(
            venta_id=venta.id,
            variante_id=item_data.variante_id,
            cantidad=item_data.cantidad,
            precio_unitario=item_data.precio_unitario,
            subtotal=subtotal,
        )
        db.add(item)

        if venta.estado == EstadoVentaEnum.confirmada:
            _descontar_stock_sucursal(db, item_data.variante_id, venta.sucursal_id, item_data.cantidad)

    venta.total = total


@router.get("", response_model=List[VentaResponse])
def listar_ventas(
    estado: Optional[str] = Query(None),
    sucursal_id: Optional[int] = Query(None),
    cliente_id: Optional[int] = Query(None),
    metodo_pago: Optional[str] = Query(None),
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Venta)
    if estado:
        query = query.filter(Venta.estado == estado)
    if sucursal_id:
        query = query.filter(Venta.sucursal_id == sucursal_id)
    if cliente_id:
        query = query.filter(Venta.cliente_id == cliente_id)
    if metodo_pago:
        query = query.filter(Venta.metodo_pago == metodo_pago)
    if fecha_desde:
        query = query.filter(Venta.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Venta.fecha <= fecha_hasta)
    ventas = query.order_by(Venta.fecha.desc()).all()
    return [_venta_a_response(v) for v in ventas]


@router.get("/pedidos-abiertos", response_model=List[VentaResponse])
def listar_pedidos_abiertos(db: Session = Depends(get_db)):
    ventas = db.query(Venta).filter(Venta.estado == EstadoVentaEnum.abierta).order_by(Venta.fecha.desc()).all()
    return [_venta_a_response(v) for v in ventas]


@router.get("/{venta_id}", response_model=VentaResponse)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return _venta_a_response(venta)


@router.post("", response_model=VentaResponse, status_code=201)
def crear_venta(data: VentaCreate, db: Session = Depends(get_db)):
    venta = Venta(
        cliente_id=data.cliente_id,
        sucursal_id=data.sucursal_id,
        metodo_pago=data.metodo_pago,
        estado=data.estado,
        notas=data.notas,
    )
    db.add(venta)
    db.flush()
    _calcular_y_guardar_venta(db, venta, data.items)
    db.commit()
    db.refresh(venta)
    return _venta_a_response(venta)


@router.post("/{venta_id}/confirmar", response_model=VentaResponse)
def confirmar_pedido(venta_id: int, db: Session = Depends(get_db)):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.estado != EstadoVentaEnum.abierta:
        raise HTTPException(status_code=400, detail="Solo se pueden confirmar pedidos abiertos")

    for item in venta.items:
        _descontar_stock_sucursal(db, item.variante_id, venta.sucursal_id, item.cantidad)

    venta.estado = EstadoVentaEnum.confirmada
    db.commit()
    db.refresh(venta)
    return _venta_a_response(venta)


@router.put("/{venta_id}", response_model=VentaResponse)
def actualizar_venta(venta_id: int, data: VentaUpdate, db: Session = Depends(get_db)):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.estado == EstadoVentaEnum.confirmada:
        raise HTTPException(status_code=400, detail="No se puede editar una venta confirmada.")

    for campo, valor in data.model_dump(exclude_unset=True, exclude={"items"}).items():
        setattr(venta, campo, valor)

    if data.items is not None:
        for item in venta.items:
            db.delete(item)
        db.flush()
        _calcular_y_guardar_venta(db, venta, data.items)

    db.commit()
    db.refresh(venta)
    return _venta_a_response(venta)


@router.delete("/{venta_id}", status_code=204)
def eliminar_venta(venta_id: int, db: Session = Depends(get_db)):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if venta.estado == EstadoVentaEnum.confirmada:
        for item in venta.items:
            _restaurar_stock_sucursal(db, item.variante_id, venta.sucursal_id, item.cantidad)

    db.delete(venta)
    db.commit()
