from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from decimal import Decimal

from app.database import get_db
from app.models import Compra, CompraItem, Variante, StockSucursal, Transferencia, TipoTransferenciaEnum
from app.schemas import CompraCreate, CompraCreateConDistribucion, CompraResponse, FacturaIAResponse
from app.services.ia_facturas import procesar_factura_con_ia

router = APIRouter(prefix="/compras", tags=["Compras"])


def _sumar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad += cantidad
    else:
        ss = StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=cantidad)
        db.add(ss)


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


# ─── MÓDULO IA ────────────────────────────────────────────────────────────────
# IMPORTANTE: esta ruta va ANTES de /{compra_id} para que FastAPI
# no intente parsear "factura" como un entero.

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
        raise HTTPException(status_code=503, detail=str(e))
    return resultado


@router.get("/{compra_id}", response_model=CompraResponse)
def obtener_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


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

    total = Decimal("0")
    for item_data in data.items:
        variante = db.query(Variante).filter(Variante.id == item_data.variante_id).first()
        if not variante:
            raise HTTPException(status_code=404, detail=f"Variante {item_data.variante_id} no encontrada")

        subtotal = item_data.costo_unitario * item_data.cantidad
        total += subtotal

        item = CompraItem(
            compra_id=compra.id,
            variante_id=item_data.variante_id,
            cantidad=item_data.cantidad,
            costo_unitario=item_data.costo_unitario,
            subtotal=subtotal,
        )
        db.add(item)
        variante.costo = item_data.costo_unitario

        total_distribuido = sum(d.cantidad for d in item_data.distribucion)
        if total_distribuido > item_data.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"La distribución ({total_distribuido}) supera la cantidad comprada ({item_data.cantidad})"
            )

        a_central = item_data.cantidad - total_distribuido
        if a_central > 0:
            variante.stock_actual += a_central

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

    compra.total = total
    db.commit()
    db.refresh(compra)
    return compra


@router.put("/{compra_id}", response_model=CompraResponse)
def actualizar_compra(compra_id: int, data: CompraCreateConDistribucion, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # FIX: Revertir stock correctamente — central Y sucursales
    for item in compra.items:
        variante = item.variante

        # Revertir distribución a sucursales usando las transferencias registradas
        transferencias = db.query(Transferencia).filter(
            Transferencia.variante_id == variante.id,
            Transferencia.notas == f"Distribución de compra #{compra.id}",
        ).all()

        cantidad_distribuida = 0
        for t in transferencias:
            _restar_stock_sucursal(db, variante.id, t.sucursal_destino_id, t.cantidad)
            cantidad_distribuida += t.cantidad
            db.delete(t)

        # Revertir lo que fue a central
        cantidad_a_central = item.cantidad - cantidad_distribuida
        if cantidad_a_central > 0:
            variante.stock_actual = max(0, variante.stock_actual - cantidad_a_central)

        db.delete(item)

    db.flush()

    compra.proveedor = data.proveedor
    compra.metodo_pago = data.metodo_pago
    compra.notas = data.notas

    total = Decimal("0")
    for item_data in data.items:
        variante = db.query(Variante).filter(Variante.id == item_data.variante_id).first()
        if not variante:
            raise HTTPException(status_code=404, detail=f"Variante {item_data.variante_id} no encontrada")

        subtotal = item_data.costo_unitario * item_data.cantidad
        total += subtotal

        item = CompraItem(
            compra_id=compra.id,
            variante_id=item_data.variante_id,
            cantidad=item_data.cantidad,
            costo_unitario=item_data.costo_unitario,
            subtotal=subtotal,
        )
        db.add(item)
        variante.costo = item_data.costo_unitario

        total_distribuido = sum(d.cantidad for d in item_data.distribucion)
        a_central = item_data.cantidad - total_distribuido
        if a_central > 0:
            variante.stock_actual += a_central

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

    compra.total = total
    db.commit()
    db.refresh(compra)
    return compra


@router.delete("/{compra_id}", status_code=204)
def eliminar_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    for item in compra.items:
        item.variante.stock_actual -= item.cantidad

    db.delete(compra)
    db.commit()
