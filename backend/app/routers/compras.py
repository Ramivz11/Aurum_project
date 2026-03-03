from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from decimal import Decimal

from app.database import get_db
from app.models import Compra, CompraItem, Variante, StockSucursal, Sucursal, Transferencia, TipoTransferenciaEnum
from app.schemas import CompraCreate, CompraCreateConDistribucion, CompraResponse, FacturaIAResponse
from app.services.ia_facturas import procesar_factura_con_ia

router = APIRouter(prefix="/compras", tags=["Compras"])


def _get_central(db: Session) -> Sucursal:
    """Retorna el depósito central. Lanza 500 si no existe (no debería ocurrir)."""
    central = db.query(Sucursal).filter(Sucursal.es_central == True, Sucursal.activa == True).first()
    if not central:
        raise HTTPException(status_code=500, detail="Depósito central no configurado")
    return central


def _sumar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad += cantidad
    else:
        db.add(StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=cantidad))


def _restar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad = max(0, ss.cantidad - cantidad)


@router.get("", response_model=List[CompraResponse])
def listar_compras(
    sucursal_id: Optional[int] = Query(None),
    proveedor: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Compra)
    if sucursal_id:
        query = query.filter(Compra.sucursal_id == sucursal_id)
    if proveedor:
        query = query.filter(Compra.proveedor.ilike(f"%{proveedor}%"))
    return query.order_by(Compra.fecha.desc()).all()


# IMPORTANTE: esta ruta va ANTES de /{compra_id}
@router.post("/factura/ia", response_model=FacturaIAResponse)
async def analizar_factura_con_ia(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not archivo.content_type.startswith(("image/", "application/pdf")):
        raise HTTPException(status_code=400, detail="Solo se aceptan imágenes o PDF")
    contenido = await archivo.read()
    try:
        resultado = await procesar_factura_con_ia(contenido, archivo.content_type)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    return resultado


@router.get("/{compra_id}", response_model=CompraResponse)
def obtener_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


def _registrar_items(db: Session, compra: Compra, items_data: list) -> Decimal:
    """Crea CompraItems, actualiza stock y registra transferencias. Retorna el total."""
    central = _get_central(db)
    total = Decimal("0")

    for item_data in items_data:
        variante = db.query(Variante).filter(Variante.id == item_data.variante_id).first()
        if not variante:
            raise HTTPException(status_code=404, detail=f"Variante {item_data.variante_id} no encontrada")

        # Validar que la distribución no supere la cantidad comprada
        total_distribuido = sum(d.cantidad for d in item_data.distribucion)
        if total_distribuido > item_data.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"La distribución ({total_distribuido}) supera la cantidad comprada ({item_data.cantidad})"
            )

        subtotal = item_data.costo_unitario * item_data.cantidad
        total += subtotal

        db.add(CompraItem(
            compra_id=compra.id,
            variante_id=item_data.variante_id,
            cantidad=item_data.cantidad,
            costo_unitario=item_data.costo_unitario,
            subtotal=subtotal,
        ))
        variante.costo = item_data.costo_unitario

        # Lo que no se distribuye explícitamente va al depósito central
        a_central = item_data.cantidad - total_distribuido
        if a_central > 0:
            _sumar_stock_sucursal(db, variante.id, central.id, a_central)
            db.add(Transferencia(
                variante_id=variante.id,
                tipo=TipoTransferenciaEnum.central_a_sucursal,
                sucursal_origen_id=None,
                sucursal_destino_id=central.id,
                cantidad=a_central,
                notas=f"Ingreso al depósito central — compra #{compra.id}",
            ))

        for dist in item_data.distribucion:
            if dist.cantidad > 0:
                _sumar_stock_sucursal(db, variante.id, dist.sucursal_id, dist.cantidad)
                db.add(Transferencia(
                    variante_id=variante.id,
                    tipo=TipoTransferenciaEnum.central_a_sucursal,
                    sucursal_origen_id=None,
                    sucursal_destino_id=dist.sucursal_id,
                    cantidad=dist.cantidad,
                    notas=f"Distribución de compra #{compra.id}",
                ))

    return total


def _revertir_items(db: Session, compra: Compra):
    """Revierte completamente el stock de una compra antes de modificarla o eliminarla."""
    for item in compra.items:
        # Revertir todas las transferencias asociadas a esta compra
        transferencias = db.query(Transferencia).filter(
            Transferencia.variante_id == item.variante_id,
            Transferencia.notas.in_([
                f"Distribución de compra #{compra.id}",
                f"Ingreso al depósito central — compra #{compra.id}",
            ])
        ).all()
        for t in transferencias:
            _restar_stock_sucursal(db, item.variante_id, t.sucursal_destino_id, t.cantidad)
            db.delete(t)

        db.delete(item)


@router.post("", response_model=CompraResponse, status_code=201)
def registrar_compra(data: CompraCreateConDistribucion, db: Session = Depends(get_db)):
    compra = Compra(
        proveedor=data.proveedor,
        sucursal_id=data.sucursal_id,
        metodo_pago=data.metodo_pago,
        notas=data.notas,
    )
    db.add(compra)
    db.flush()
    compra.total = _registrar_items(db, compra, data.items)
    db.commit()
    db.refresh(compra)
    return compra


@router.put("/{compra_id}", response_model=CompraResponse)
def actualizar_compra(compra_id: int, data: CompraCreateConDistribucion, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # Revertir stock e items anteriores
    _revertir_items(db, compra)
    db.flush()

    # Actualizar campos del encabezado
    compra.proveedor = data.proveedor
    compra.metodo_pago = data.metodo_pago
    compra.notas = data.notas

    compra.total = _registrar_items(db, compra, data.items)
    db.commit()
    db.refresh(compra)
    return compra


@router.delete("/{compra_id}", status_code=204)
def eliminar_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # Revertir CORRECTAMENTE todo el stock (central + sucursales)
    _revertir_items(db, compra)
    db.delete(compra)
    db.commit()
