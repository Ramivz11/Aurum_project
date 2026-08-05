import re

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from decimal import Decimal

from app.database import get_db
from app.models import Compra, CompraItem, Variante, StockSucursal, Transferencia, TipoTransferenciaEnum
from app.schemas import CompraCreate, CompraCreateConDistribucion, CompraResponse, FacturaIAResponse
from app.services.ia_facturas import procesar_factura_con_ia

router = APIRouter(prefix="/compras", tags=["Compras"])

# Las compras viejas no tienen compra_id en la transferencia y se identifican por
# el texto de la nota, igual que en _revertir_items.
_NOTA_COMPRA = re.compile(r"compra #(\d+)")


def _query_compras_completo(db: Session):
    """Query base con eager loading: sin esto, serializar N compras dispara una
    consulta por item y otra por variante."""
    return db.query(Compra).options(
        joinedload(Compra.items).joinedload(CompraItem.variante).joinedload(Variante.producto),
    )


def _distribuciones(db: Session, compras: List[Compra]) -> dict:
    """{(compra_id, variante_id): {sucursal_id: cantidad}} según cómo se repartió
    cada compra.

    El CompraItem guarda cuánto se compró, no dónde quedó: el reparto vive en las
    transferencias de ingreso. Sin esto, editar una compra distribuida la
    reescribía mandando todo a la sucursal de la compra.
    """
    ids = [c.id for c in compras]
    if not ids:
        return {}

    notas = [t for i in ids for t in (
        f"Ingreso por compra #{i}",
        f"Distribución de compra #{i}",
        f"Ingreso al depósito central — compra #{i}",
    )]
    filas = db.query(Transferencia).filter(
        or_(Transferencia.compra_id.in_(ids), Transferencia.notas.in_(notas))
    ).all()

    reparto: dict = {}
    for t in filas:
        compra_id = t.compra_id
        if compra_id is None:
            m = _NOTA_COMPRA.search(t.notas or "")
            compra_id = int(m.group(1)) if m else None
        if compra_id is None or t.sucursal_destino_id is None:
            continue
        por_sucursal = reparto.setdefault((compra_id, t.variante_id), {})
        por_sucursal[t.sucursal_destino_id] = por_sucursal.get(t.sucursal_destino_id, 0) + t.cantidad
    return reparto


def _compra_a_response(compra: Compra, reparto: dict) -> dict:
    """Agrega a cada item el nombre del producto y cómo quedó distribuido."""
    data = CompraResponse.model_validate(compra).model_dump()
    for i, item in enumerate(compra.items):
        if item.variante and item.variante.producto:
            data["items"][i]["producto_nombre"] = item.variante.producto.nombre
            data["items"][i]["producto_marca"] = item.variante.producto.marca
        data["items"][i]["distribucion"] = [
            {"sucursal_id": s, "cantidad": c}
            for s, c in sorted(reparto.get((compra.id, item.variante_id), {}).items())
        ]
    return data


def _sumar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    """Suma stock de forma atómica (UPDATE ... SET cantidad = cantidad + n)."""
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


def _restar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    """Resta stock de forma atómica. No se acota a 0: si quedara negativo, refleja
    un descuadre real (stock ya movido/vendido) en lugar de ocultarlo perdiendo unidades."""
    actualizado = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).update(
        {StockSucursal.cantidad: StockSucursal.cantidad - cantidad},
        synchronize_session=False,
    )
    if not actualizado:
        db.add(StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=-cantidad))
        db.flush()


@router.get("")
def listar_compras(
    sucursal_id: Optional[int] = Query(None),
    proveedor: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = _query_compras_completo(db)
    if sucursal_id:
        query = query.filter(Compra.sucursal_id == sucursal_id)
    if proveedor:
        query = query.filter(Compra.proveedor.ilike(f"%{proveedor}%"))
    compras = query.order_by(Compra.fecha.desc()).all()
    reparto = _distribuciones(db, compras)
    return [_compra_a_response(c, reparto) for c in compras]


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


@router.get("/{compra_id}")
def obtener_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = _query_compras_completo(db).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return _compra_a_response(compra, _distribuciones(db, [compra]))


def _registrar_items(db: Session, compra: Compra, items_data: list) -> Decimal:
    """Crea CompraItems, actualiza stock y registra transferencias. Retorna el total.

    Lo que no se distribuye explícitamente a otras sucursales queda en la sucursal
    de la compra (`compra.sucursal_id`)."""
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

        # Lo que no se distribuye explícitamente queda en la sucursal de la compra
        a_sucursal_base = item_data.cantidad - total_distribuido
        if a_sucursal_base > 0:
            _sumar_stock_sucursal(db, variante.id, compra.sucursal_id, a_sucursal_base)
            db.add(Transferencia(
                variante_id=variante.id,
                tipo=TipoTransferenciaEnum.ingreso_compra.value,
                sucursal_origen_id=None,
                sucursal_destino_id=compra.sucursal_id,
                compra_id=compra.id,
                cantidad=a_sucursal_base,
                notas=f"Ingreso por compra #{compra.id}",
            ))

        for dist in item_data.distribucion:
            if dist.cantidad > 0:
                _sumar_stock_sucursal(db, variante.id, dist.sucursal_id, dist.cantidad)
                db.add(Transferencia(
                    variante_id=variante.id,
                    tipo=TipoTransferenciaEnum.ingreso_compra.value,
                    sucursal_origen_id=None,
                    sucursal_destino_id=dist.sucursal_id,
                    compra_id=compra.id,
                    cantidad=dist.cantidad,
                    notas=f"Distribución de compra #{compra.id}",
                ))

    return total


def _revertir_items(db: Session, compra: Compra):
    """Revierte completamente el stock de una compra antes de modificarla o eliminarla."""
    # Transferencias enlazadas por FK (compras nuevas). Para compras viejas sin
    # compra_id se usa el respaldo por texto de notas (incluye los textos legados
    # del modelo con depósito central).
    transferencias = db.query(Transferencia).filter(
        (Transferencia.compra_id == compra.id) |
        Transferencia.notas.in_([
            f"Distribución de compra #{compra.id}",
            f"Ingreso por compra #{compra.id}",
            f"Ingreso al depósito central — compra #{compra.id}",
        ])
    ).all()
    for t in transferencias:
        if t.sucursal_destino_id is not None:
            _restar_stock_sucursal(db, t.variante_id, t.sucursal_destino_id, t.cantidad)
        db.delete(t)

    for item in compra.items:
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
    compra = _query_compras_completo(db).filter(Compra.id == compra.id).first()
    return _compra_a_response(compra, _distribuciones(db, [compra]))


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
    compra.sucursal_id = data.sucursal_id
    compra.metodo_pago = data.metodo_pago
    compra.notas = data.notas

    compra.total = _registrar_items(db, compra, data.items)
    db.commit()
    compra = _query_compras_completo(db).filter(Compra.id == compra.id).first()
    return _compra_a_response(compra, _distribuciones(db, [compra]))


@router.delete("/{compra_id}", status_code=204)
def eliminar_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # Revertir CORRECTAMENTE todo el stock (central + sucursales)
    _revertir_items(db, compra)
    db.delete(compra)
    db.commit()
