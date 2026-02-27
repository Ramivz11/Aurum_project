from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.models import Venta, Compra, VentaItem, Sucursal, StockSucursal, Variante
from pydantic import BaseModel
from app.schemas import (
    VentaResponse, CompraResponse, ResumenPeriodo,
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
            producto_mas_vendido=None
        )

    total = sum(v.total for v in ventas)
    cantidad = len(ventas)

    # Producto más vendido
    conteo = {}
    for venta in ventas:
        for item in venta.items:
            nombre = item.variante.producto.nombre
            conteo[nombre] = conteo.get(nombre, 0) + item.cantidad

    mas_vendido = max(conteo, key=conteo.get) if conteo else None

    return ResumenPeriodo(
        total_ventas=total,
        cantidad_ventas=cantidad,
        ticket_promedio=round(total / cantidad, 2),
        producto_mas_vendido=mas_vendido
    )


@movimientos_router.get("/ventas")
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

    ventas = query.order_by(Venta.fecha.desc()).all()
    result = []
    for v in ventas:
        data = VentaResponse.model_validate(v).model_dump()
        data["cliente_nombre"] = v.cliente.nombre if v.cliente else None
        result.append(data)
    return result


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
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    sucursal.nombre = data.nombre
    db.commit()
    db.refresh(sucursal)
    return sucursal


@sucursales_router.delete("/{sucursal_id}", status_code=204)
def eliminar_sucursal(sucursal_id: int, db: Session = Depends(get_db)):
    sucursal = db.query(Sucursal).filter(Sucursal.id == sucursal_id).first()
    if not sucursal:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    sucursal.activa = False
    db.commit()


@sucursales_router.get("/{sucursal_id}/dashboard")
def dashboard_sucursal(
    sucursal_id: int,
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Dashboard completo para una sucursal: ventas, stock, producto top."""
    from fastapi import HTTPException
    sucursal = db.query(Sucursal).filter(Sucursal.id == sucursal_id, Sucursal.activa == True).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    now = datetime.now()
    mes = mes or now.month
    anio = anio or now.year

    # ── Ventas del mes ───────────────────────────────────────────────────────
    ventas = db.query(Venta).filter(
        Venta.sucursal_id == sucursal_id,
        Venta.estado == "confirmada",
        extract("month", Venta.fecha) == mes,
        extract("year", Venta.fecha) == anio,
    ).all()

    total_ventas = sum(v.total for v in ventas) or Decimal("0")
    cantidad_ventas = len(ventas)
    ticket_promedio = round(total_ventas / cantidad_ventas, 2) if cantidad_ventas else Decimal("0")

    # ── Porcentaje del total global ───────────────────────────────────────────
    total_global = db.query(func.sum(Venta.total)).filter(
        Venta.estado == "confirmada",
        extract("month", Venta.fecha) == mes,
        extract("year", Venta.fecha) == anio,
    ).scalar() or Decimal("1")
    porcentaje = float(total_ventas / total_global * 100) if total_global > 0 else 0.0

    # ── Rentabilidad ─────────────────────────────────────────────────────────
    costo_total = sum(
        item.variante.costo * item.cantidad
        for v in ventas
        for item in v.items
    )
    rentabilidad = total_ventas - costo_total

    # ── Producto más vendido ─────────────────────────────────────────────────
    conteo: dict = {}
    for venta in ventas:
        for item in venta.items:
            key = item.variante_id
            conteo[key] = conteo.get(key, 0) + item.cantidad

    producto_mas_vendido = None
    if conteo:
        top_variante_id = max(conteo, key=conteo.get)
        top_variante = db.query(Variante).filter(Variante.id == top_variante_id).first()
        if top_variante:
            producto_mas_vendido = {
                "nombre": top_variante.producto.nombre,
                "marca": top_variante.producto.marca,
                "sabor": top_variante.sabor,
                "tamanio": top_variante.tamanio,
                "unidades_vendidas": conteo[top_variante_id],
            }

    # ── Stock en sucursal ────────────────────────────────────────────────────
    stocks = db.query(StockSucursal).filter(StockSucursal.sucursal_id == sucursal_id).all()
    stock_total_sucursal = sum(s.cantidad for s in stocks)

    # Stock total global (todas las sucursales + central)
    stock_total_global_sucursales = db.query(func.sum(StockSucursal.cantidad)).scalar() or 0
    stock_total_central = db.query(func.sum(Variante.stock_actual)).filter(Variante.activa == True).scalar() or 0
    stock_total_global = int(stock_total_global_sucursales) + int(stock_total_central)
    porcentaje_stock = float(stock_total_sucursal / stock_total_global * 100) if stock_total_global > 0 else 0.0

    # Desglose de stock por producto
    stock_detalle = []
    for s in stocks:
        v = s.variante
        stock_detalle.append({
            "variante_id": v.id,
            "producto": v.producto.nombre,
            "marca": v.producto.marca,
            "sabor": v.sabor,
            "tamanio": v.tamanio,
            "cantidad": s.cantidad,
        })
    stock_detalle.sort(key=lambda x: x["cantidad"], reverse=True)

    return {
        "sucursal": {"id": sucursal.id, "nombre": sucursal.nombre},
        "periodo": f"{mes}/{anio}",
        "ventas": {
            "total": total_ventas,
            "cantidad": cantidad_ventas,
            "ticket_promedio": ticket_promedio,
            "porcentaje_del_total": round(porcentaje, 2),
            "rentabilidad": rentabilidad,
        },
        "stock": {
            "total_unidades": stock_total_sucursal,
            "porcentaje_del_total": round(porcentaje_stock, 2),
            "detalle": stock_detalle,
        },
        "producto_mas_vendido": producto_mas_vendido,
    }
