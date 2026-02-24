from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List
from decimal import Decimal

from app.database import get_db
from app.models import Producto, Variante
from app.schemas import (
    ProductoCreate, ProductoUpdate, ProductoResponse,
    VarianteCreate, VarianteUpdate, VarianteResponse,
    AjustePrecioLote, ModoAjustePrecio
)

router = APIRouter(prefix="/productos", tags=["Productos"])


# ─── PRODUCTOS ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[ProductoResponse])
def listar_productos(
    busqueda: Optional[str] = Query(None, description="Buscar por nombre, marca o categoría"),
    categoria: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    solo_activos: bool = Query(True),
    con_stock_bajo: bool = Query(False, description="Solo productos bajo stock mínimo"),
    db: Session = Depends(get_db)
):
    query = db.query(Producto)

    if solo_activos:
        query = query.filter(Producto.activo == True)
    if categoria:
        query = query.filter(Producto.categoria.ilike(f"%{categoria}%"))
    if marca:
        query = query.filter(Producto.marca.ilike(f"%{marca}%"))
    if busqueda:
        query = query.filter(
            or_(
                Producto.nombre.ilike(f"%{busqueda}%"),
                Producto.marca.ilike(f"%{busqueda}%"),
                Producto.categoria.ilike(f"%{busqueda}%")
            )
        )

    productos = query.order_by(Producto.nombre).all()

    if con_stock_bajo:
        productos = [
            p for p in productos
            if any(v.stock_actual <= v.stock_minimo for v in p.variantes if v.activa)
        ]

    return productos


@router.get("/{producto_id}", response_model=ProductoResponse)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@router.post("", response_model=ProductoResponse, status_code=201)
def crear_producto(data: ProductoCreate, db: Session = Depends(get_db)):
    producto = Producto(
        nombre=data.nombre,
        marca=data.marca,
        categoria=data.categoria,
        imagen_url=data.imagen_url,
    )
    db.add(producto)
    db.flush()  # para tener el id antes del commit

    for v in data.variantes:
        variante = Variante(
            producto_id=producto.id,
            sabor=v.sabor,
            tamanio=v.tamanio,
            sku=v.sku,
            costo=v.costo,
            precio_venta=v.precio_venta,
            stock_minimo=v.stock_minimo,
        )
        db.add(variante)

    db.commit()
    db.refresh(producto)
    return producto


@router.put("/{producto_id}", response_model=ProductoResponse)
def actualizar_producto(
    producto_id: int, data: ProductoUpdate, db: Session = Depends(get_db)
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(producto, campo, valor)

    db.commit()
    db.refresh(producto)
    return producto


@router.delete("/{producto_id}", status_code=204)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Soft delete: no borramos de la DB para preservar historial
    producto.activo = False
    for v in producto.variantes:
        v.activa = False
    db.commit()


# ─── VARIANTES ───────────────────────────────────────────────────────────────

@router.get("/{producto_id}/variantes", response_model=List[VarianteResponse])
def listar_variantes(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return [v for v in producto.variantes if v.activa]


@router.post("/{producto_id}/variantes", response_model=VarianteResponse, status_code=201)
def crear_variante(
    producto_id: int, data: VarianteCreate, db: Session = Depends(get_db)
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    variante = Variante(producto_id=producto_id, **data.model_dump())
    db.add(variante)
    db.commit()
    db.refresh(variante)
    return variante


@router.put("/variantes/{variante_id}", response_model=VarianteResponse)
def actualizar_variante(
    variante_id: int, data: VarianteUpdate, db: Session = Depends(get_db)
):
    variante = db.query(Variante).filter(Variante.id == variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(variante, campo, valor)

    db.commit()
    db.refresh(variante)
    return variante


@router.delete("/variantes/{variante_id}", status_code=204)
def eliminar_variante(variante_id: int, db: Session = Depends(get_db)):
    variante = db.query(Variante).filter(Variante.id == variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    variante.activa = False
    db.commit()


# ─── AJUSTE DE PRECIOS POR LOTE ──────────────────────────────────────────────

@router.post("/lote/precio", response_model=List[VarianteResponse])
def ajustar_precio_lote(data: AjustePrecioLote, db: Session = Depends(get_db)):
    """
    Ajusta el precio de venta de múltiples variantes de un producto.

    Modos:
    - porcentaje: precio_nuevo = precio_actual * (1 + valor/100)
    - margen_deseado: precio_nuevo = costo / (1 - valor/100)
    - precio_fijo: precio_nuevo = valor
    """
    query = db.query(Variante).filter(
        Variante.producto_id == data.producto_id,
        Variante.activa == True
    )

    if data.variante_ids:
        query = query.filter(Variante.id.in_(data.variante_ids))

    variantes = query.all()

    if not variantes:
        raise HTTPException(status_code=404, detail="No se encontraron variantes para ajustar")

    for variante in variantes:
        if data.modo == ModoAjustePrecio.porcentaje:
            factor = 1 + (data.valor / 100)
            variante.precio_venta = round(variante.precio_venta * factor, 2)

        elif data.modo == ModoAjustePrecio.margen_deseado:
            if data.valor >= 100:
                raise HTTPException(status_code=400, detail="El margen no puede ser 100% o más")
            variante.precio_venta = round(variante.costo / (1 - data.valor / 100), 2)

        elif data.modo == ModoAjustePrecio.precio_fijo:
            variante.precio_venta = data.valor

    db.commit()
    for v in variantes:
        db.refresh(v)

    return variantes


# ─── AJUSTE DE STOCK DIRECTO ─────────────────────────────────────────────────

from pydantic import BaseModel as PydanticBase

class StockAjuste(PydanticBase):
    stock_actual: int


@router.put("/variantes/{variante_id}/stock", response_model=VarianteResponse)
def ajustar_stock(variante_id: int, data: StockAjuste, db: Session = Depends(get_db)):
    variante = db.query(Variante).filter(Variante.id == variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    variante.stock_actual = data.stock_actual
    db.commit()
    db.refresh(variante)
    return variante
