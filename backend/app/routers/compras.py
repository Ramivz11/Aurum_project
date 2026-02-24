from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from decimal import Decimal

from app.database import get_db
from app.models import Compra, CompraItem, Variante
from app.schemas import CompraCreate, CompraResponse, FacturaIAResponse
from app.services.ia_facturas import procesar_factura_con_ia

router = APIRouter(prefix="/compras", tags=["Compras"])


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


@router.get("/{compra_id}", response_model=CompraResponse)
def obtener_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


@router.post("", response_model=CompraResponse, status_code=201)
def registrar_compra(data: CompraCreate, db: Session = Depends(get_db)):
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
            raise HTTPException(
                status_code=404,
                detail=f"Variante {item_data.variante_id} no encontrada"
            )

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

        # Sumar al stock
        variante.stock_actual += item_data.cantidad

        # Actualizar costo de la variante con el último precio de compra
        variante.costo = item_data.costo_unitario

    compra.total = total
    db.commit()
    db.refresh(compra)
    return compra


@router.put("/{compra_id}", response_model=CompraResponse)
def actualizar_compra(compra_id: int, data: CompraCreate, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # Revertir stock de los items anteriores
    for item in compra.items:
        item.variante.stock_actual -= item.cantidad
        db.delete(item)

    db.flush()

    # Actualizar campos
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
        variante.stock_actual += item_data.cantidad
        variante.costo = item_data.costo_unitario

    compra.total = total
    db.commit()
    db.refresh(compra)
    return compra


@router.delete("/{compra_id}", status_code=204)
def eliminar_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # Revertir stock
    for item in compra.items:
        item.variante.stock_actual -= item.cantidad

    db.delete(compra)
    db.commit()


# ─── MÓDULO IA ────────────────────────────────────────────────────────────────

@router.post("/factura/ia", response_model=FacturaIAResponse)
async def analizar_factura_con_ia(
    archivo: UploadFile = File(..., description="Foto o PDF de la factura"),
    db: Session = Depends(get_db)
):
    """
    Recibe una imagen o PDF de factura y usa IA para detectar
    productos, cantidades y precios. Retorna un preview editable
    ANTES de confirmar la compra.
    """
    if not archivo.content_type.startswith(("image/", "application/pdf")):
        raise HTTPException(
            status_code=400,
            detail="Solo se aceptan imágenes (JPG, PNG) o PDF"
        )

    contenido = await archivo.read()
    try:
        resultado = await procesar_factura_con_ia(contenido, archivo.content_type)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    
    return resultado