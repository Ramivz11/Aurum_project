from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.models import Venta, Compra, VentaItem, Sucursal
from pydantic import BaseModel
from app.schemas import (
    VentaResponse, CompraResponse, ResumenPeriodo, ProductoMasVendido,
    SucursalCreate, SucursalResponse, SucursalComparacionResponse
)

class SucursalUpdate(BaseModel):
    nombre: str

# ─── MOVIMIENTOS ─────────────────────────────────────────────────────────────

movimientos_router = APIRouter(prefix="/movimientos", tags=["Movimientos"])


@movimientos_router.get("/resumen")
def resumen_periodo(
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    sucursal_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Venta).filter(Venta.estado == "confirmada")

    if fecha_desde:
        query = query.filter(Venta.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Venta.fecha <= fecha_hasta)
    if sucursal_id:
        query = query.filter(Venta.sucursal_id == sucursal_id)

    ventas = query.all()

    if not ventas:
        return ResumenPeriodo(
            total_ventas=Decimal("0"),
            cantidad_ventas=0,
            ticket_promedio=Decimal("0"),
            producto_mas_vendido=None,
            producto_top=None
        )

    total = sum(v.total for v in ventas)
    cantidad = len(ventas)

    # Producto más vendido - track full details by variante_id
    conteo = {}  # variante_id -> {cantidad, nombre, marca, sabor, tamanio}
    for venta in ventas:
        for item in venta.items:
            vid = item.variante_id
            if vid not in conteo:
                prod = item.variante.producto
                conteo[vid] = {
                    "cantidad": 0,
                    "nombre": prod.nombre,
                    "marca": prod.marca,
                    "sabor": item.variante.sabor,
                    "tamanio": item.variante.tamanio,
                }
            conteo[vid]["cantidad"] += item.cantidad

    producto_top = None
    mas_vendido = None
    if conteo:
        top = max(conteo.values(), key=lambda x: x["cantidad"])
        mas_vendido = top["nombre"]
        producto_top = ProductoMasVendido(
            nombre=top["nombre"],
            marca=top["marca"],
            variante=top["sabor"],
            tamanio=top["tamanio"],
            cantidad=top["cantidad"],
        )

    return ResumenPeriodo(
        total_ventas=total,
        cantidad_ventas=cantidad,
        ticket_promedio=round(total / cantidad, 2),
        producto_mas_vendido=mas_vendido,
        producto_top=producto_top
    )


@movimientos_router.get("/ventas", response_model=List[VentaResponse])
def movimientos_ventas(
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    sucursal_id: Optional[int] = Query(None),
    metodo_pago: Optional[str] = Query(None),
    cliente_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Venta).filter(Venta.estado == "confirmada")

    if fecha_desde:
        query = query.filter(Venta.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Venta.fecha <= fecha_hasta)
    if sucursal_id:
        query = query.filter(Venta.sucursal_id == sucursal_id)
    if metodo_pago:
        query = query.filter(Venta.metodo_pago == metodo_pago)
    if cliente_id:
        query = query.filter(Venta.cliente_id == cliente_id)

    return query.order_by(Venta.fecha.desc()).all()


@movimientos_router.get("/compras", response_model=List[CompraResponse])
def movimientos_compras(
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    sucursal_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Compra)

    if fecha_desde:
        query = query.filter(Compra.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Compra.fecha <= fecha_hasta)
    if sucursal_id:
        query = query.filter(Compra.sucursal_id == sucursal_id)

    return query.order_by(Compra.fecha.desc()).all()


# ─── SUCURSALES ──────────────────────────────────────────────────────────────

sucursales_router = APIRouter(prefix="/sucursales", tags=["Sucursales"])


@sucursales_router.get("", response_model=List[SucursalResponse])
def listar_sucursales(db: Session = Depends(get_db)):
    return db.query(Sucursal).filter(Sucursal.activa == True).all()


@sucursales_router.post("", response_model=SucursalResponse, status_code=201)
def crear_sucursal(data: SucursalCreate, db: Session = Depends(get_db)):
    sucursal = Sucursal(nombre=data.nombre)
    db.add(sucursal)
    db.commit()
    db.refresh(sucursal)
    return sucursal


@sucursales_router.get("/comparacion", response_model=List[SucursalComparacionResponse])
def comparar_sucursales(
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    now = datetime.now()
    mes = mes or now.month
    anio = anio or now.year

    sucursales = db.query(Sucursal).filter(Sucursal.activa == True).all()

    # Total global del período para calcular %
    total_global = db.query(func.sum(Venta.total)).filter(
        Venta.estado == "confirmada",
        extract("month", Venta.fecha) == mes,
        extract("year", Venta.fecha) == anio,
    ).scalar() or Decimal("1")

    resultado = []
    for sucursal in sucursales:
        ventas = db.query(Venta).filter(
            Venta.sucursal_id == sucursal.id,
            Venta.estado == "confirmada",
            extract("month", Venta.fecha) == mes,
            extract("year", Venta.fecha) == anio,
        ).all()

        total = sum(v.total for v in ventas) or Decimal("0")
        cantidad = len(ventas)
        ticket = round(total / cantidad, 2) if cantidad else Decimal("0")
        porcentaje = float(total / total_global * 100) if total_global > 0 else 0.0

        # Rentabilidad = ingresos - costos de los items vendidos
        costo_total = sum(
            item.variante.costo * item.cantidad
            for v in ventas
            for item in v.items
        )
        rentabilidad = total - costo_total

        unidades = sum(item.cantidad for v in ventas for item in v.items)

        resultado.append(SucursalComparacionResponse(
            sucursal=SucursalResponse.model_validate(sucursal),
            ventas_total=total,
            ticket_promedio=ticket,
            unidades_vendidas=unidades,
            porcentaje_del_total=round(porcentaje, 2),
            rentabilidad=rentabilidad
        ))

    return sorted(resultado, key=lambda x: x.ventas_total, reverse=True)


@sucursales_router.put("/{sucursal_id}", response_model=SucursalResponse)
def actualizar_sucursal(sucursal_id: int, data: SucursalUpdate, db: Session = Depends(get_db)):
    sucursal = db.query(Sucursal).filter(Sucursal.id == sucursal_id).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    sucursal.nombre = data.nombre
    db.commit()
    db.refresh(sucursal)
    return sucursal


@sucursales_router.delete("/{sucursal_id}", status_code=204)
def eliminar_sucursal(sucursal_id: int, db: Session = Depends(get_db)):
    sucursal = db.query(Sucursal).filter(Sucursal.id == sucursal_id).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    sucursal.activa = False
    db.commit()