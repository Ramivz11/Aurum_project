from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models import Venta, VentaItem, Variante, EstadoVentaEnum
from app.schemas import VentaCreate, VentaUpdate, VentaResponse

router = APIRouter(prefix="/ventas", tags=["Ventas"])


def _calcular_y_guardar_venta(db: Session, venta: Venta, items_data: list):
    """Crea los items, descuenta stock y calcula el total."""
    total = Decimal("0")
    for item_data in items_data:
        variante = db.query(Variante).filter(Variante.id == item_data.variante_id).first()
        if not variante:
            raise HTTPException(
                status_code=404,
                detail=f"Variante {item_data.variante_id} no encontrada"
            )
        if variante.stock_actual < item_data.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{variante.sabor or variante.tamanio}'. "
                       f"Disponible: {variante.stock_actual}, solicitado: {item_data.cantidad}"
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

        # Solo descuenta stock si la venta se confirma (no si queda abierta)
        if venta.estado == EstadoVentaEnum.confirmada:
            variante.stock_actual -= item_data.cantidad

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

    return query.order_by(Venta.fecha.desc()).all()


@router.get("/pedidos-abiertos", response_model=List[VentaResponse])
def listar_pedidos_abiertos(db: Session = Depends(get_db)):
    return db.query(Venta).filter(
        Venta.estado == EstadoVentaEnum.abierta
    ).order_by(Venta.fecha.desc()).all()


@router.get("/{venta_id}", response_model=VentaResponse)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return venta


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
    return venta


@router.post("/{venta_id}/confirmar", response_model=VentaResponse)
def confirmar_pedido(venta_id: int, db: Session = Depends(get_db)):
    """Confirma un pedido abierto: descuenta stock y cambia estado."""
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.estado != EstadoVentaEnum.abierta:
        raise HTTPException(status_code=400, detail="Solo se pueden confirmar pedidos abiertos")

    # Descontar stock
    for item in venta.items:
        variante = item.variante
        if variante.stock_actual < item.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para confirmar. Variante {variante.id}: "
                       f"disponible {variante.stock_actual}, necesario {item.cantidad}"
            )
        variante.stock_actual -= item.cantidad

    venta.estado = EstadoVentaEnum.confirmada
    db.commit()
    db.refresh(venta)
    return venta


@router.put("/{venta_id}", response_model=VentaResponse)
def actualizar_venta(venta_id: int, data: VentaUpdate, db: Session = Depends(get_db)):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.estado == EstadoVentaEnum.confirmada:
        raise HTTPException(
            status_code=400,
            detail="No se puede editar una venta confirmada. Eliminala y volvé a crearla."
        )

    for campo, valor in data.model_dump(exclude_unset=True, exclude={"items"}).items():
        setattr(venta, campo, valor)

    if data.items is not None:
        # Borrar items anteriores
        for item in venta.items:
            db.delete(item)
        db.flush()
        _calcular_y_guardar_venta(db, venta, data.items)

    db.commit()
    db.refresh(venta)
    return venta


@router.delete("/{venta_id}", status_code=204)
def eliminar_venta(venta_id: int, db: Session = Depends(get_db)):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    # Si estaba confirmada, devolver stock
    if venta.estado == EstadoVentaEnum.confirmada:
        for item in venta.items:
            item.variante.stock_actual += item.cantidad

    db.delete(venta)
    db.commit()
