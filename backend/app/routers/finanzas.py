from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.models import (
    Venta, Compra, Gasto, AjusteSaldo, VentaItem, Variante,
    MetodoPagoEnum, CategoriaGasto
)
from app.schemas import (
    LiquidezResponse, AjusteSaldoCreate, AjusteSaldoResponse,
    AnalisisMesResponse, ProductoTopResponse, GastoCreate, GastoResponse
)

router = APIRouter(prefix="/finanzas", tags=["Finanzas"])


@router.get("/liquidez", response_model=LiquidezResponse)
def obtener_liquidez(db: Session = Depends(get_db)):
    """
    Calcula el saldo disponible por método de pago.
    Ingresos (ventas) - Egresos (compras + gastos) + Ajustes manuales.
    """
    def saldo_metodo(metodo: str) -> Decimal:
        ingresos = db.query(func.sum(Venta.total)).filter(
            Venta.metodo_pago == metodo,
            Venta.estado == "confirmada"
        ).scalar() or Decimal("0")

        egresos_compras = db.query(func.sum(Compra.total)).filter(
            Compra.metodo_pago == metodo
        ).scalar() or Decimal("0")

        egresos_gastos = db.query(func.sum(Gasto.monto)).filter(
            Gasto.metodo_pago == metodo
        ).scalar() or Decimal("0")

        # Último ajuste manual (si existe, sobreescribe el calculado)
        ultimo_ajuste = db.query(AjusteSaldo).filter(
            AjusteSaldo.tipo == metodo
        ).order_by(AjusteSaldo.fecha.desc()).first()

        if ultimo_ajuste:
            # Desde el ajuste hasta ahora
            ingresos_post = db.query(func.sum(Venta.total)).filter(
                Venta.metodo_pago == metodo,
                Venta.estado == "confirmada",
                Venta.fecha > ultimo_ajuste.fecha
            ).scalar() or Decimal("0")

            egresos_post = (
                (db.query(func.sum(Compra.total)).filter(
                    Compra.metodo_pago == metodo,
                    Compra.fecha > ultimo_ajuste.fecha
                ).scalar() or Decimal("0"))
                +
                (db.query(func.sum(Gasto.monto)).filter(
                    Gasto.metodo_pago == metodo,
                    Gasto.fecha > ultimo_ajuste.fecha
                ).scalar() or Decimal("0"))
            )

            return ultimo_ajuste.monto_nuevo + ingresos_post - egresos_post

        return ingresos - egresos_compras - egresos_gastos

    efectivo = saldo_metodo(MetodoPagoEnum.efectivo)
    transferencia = saldo_metodo(MetodoPagoEnum.transferencia)
    tarjeta = saldo_metodo(MetodoPagoEnum.tarjeta)

    return LiquidezResponse(
        efectivo=efectivo,
        transferencia=transferencia,
        tarjeta=tarjeta,
        total=efectivo + transferencia + tarjeta
    )


@router.post("/ajuste-saldo", response_model=AjusteSaldoResponse, status_code=201)
def ajustar_saldo(data: AjusteSaldoCreate, db: Session = Depends(get_db)):
    """Permite corregir manualmente el saldo de un método de pago (ej: contar caja)."""
    liquidez = obtener_liquidez(db)
    saldo_actual = getattr(liquidez, data.tipo.value)

    ajuste = AjusteSaldo(
        tipo=data.tipo,
        monto_anterior=saldo_actual,
        monto_nuevo=data.monto_nuevo,
        nota=data.nota,
    )
    db.add(ajuste)
    db.commit()
    db.refresh(ajuste)
    return ajuste


@router.get("/analisis-mes", response_model=AnalisisMesResponse)
def analisis_del_mes(
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    now = datetime.now()
    mes = mes or now.month
    anio = anio or now.year

    def filtrar_mes(query, modelo):
        return query.filter(
            extract("month", modelo.fecha) == mes,
            extract("year", modelo.fecha) == anio,
        )

    ingresos = filtrar_mes(
        db.query(func.sum(Venta.total)).filter(Venta.estado == "confirmada"),
        Venta
    ).scalar() or Decimal("0")

    compras = filtrar_mes(
        db.query(func.sum(Compra.total)),
        Compra
    ).scalar() or Decimal("0")

    gastos = filtrar_mes(
        db.query(func.sum(Gasto.monto)),
        Gasto
    ).scalar() or Decimal("0")

    return AnalisisMesResponse(
        periodo=f"{mes:02d}/{anio}",
        ingresos=ingresos,
        compras=compras,
        gastos=gastos,
        neto=ingresos - compras - gastos
    )


@router.get("/productos-top", response_model=List[ProductoTopResponse])
def productos_mas_vendidos(
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    limite: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    now = datetime.now()
    mes = mes or now.month
    anio = anio or now.year

    resultados = (
        db.query(
            VentaItem.variante_id,
            func.sum(VentaItem.cantidad).label("cantidad_vendida"),
            func.sum(VentaItem.subtotal).label("ingreso_total"),
        )
        .join(Venta, Venta.id == VentaItem.venta_id)
        .filter(
            Venta.estado == "confirmada",
            extract("month", Venta.fecha) == mes,
            extract("year", Venta.fecha) == anio,
        )
        .group_by(VentaItem.variante_id)
        .order_by(func.sum(VentaItem.subtotal).desc())
        .limit(limite)
        .all()
    )

    lista = []
    for variante_id, cantidad, ingreso in resultados:
        variante = db.query(Variante).filter(Variante.id == variante_id).first()
        if not variante:
            continue

        costo_total = variante.costo * cantidad
        ganancia = ingreso - costo_total
        margen = float(ganancia / ingreso * 100) if ingreso > 0 else 0.0

        lista.append(ProductoTopResponse(
            variante_id=variante_id,
            nombre_producto=variante.producto.nombre,
            marca=variante.producto.marca,
            sabor=variante.sabor,
            tamanio=variante.tamanio,
            cantidad_vendida=cantidad,
            ingreso_total=ingreso,
            costo_total=costo_total,
            ganancia=ganancia,
            margen_porcentaje=round(margen, 2)
        ))

    return lista


# ─── GASTOS ──────────────────────────────────────────────────────────────────

@router.post("/gastos", response_model=GastoResponse, status_code=201)
def registrar_gasto(data: GastoCreate, db: Session = Depends(get_db)):
    from app.models import Gasto
    gasto = Gasto(**data.model_dump())
    db.add(gasto)
    db.commit()
    db.refresh(gasto)
    return gasto


@router.get("/gastos", response_model=List[GastoResponse])
def listar_gastos(
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    categoria_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    from app.models import Gasto
    query = db.query(Gasto)

    if mes:
        query = query.filter(extract("month", Gasto.fecha) == mes)
    if anio:
        query = query.filter(extract("year", Gasto.fecha) == anio)
    if categoria_id:
        query = query.filter(Gasto.categoria_id == categoria_id)

    return query.order_by(Gasto.fecha.desc()).all()


@router.get("/categorias-gasto")
def listar_categorias(db: Session = Depends(get_db)):
    return db.query(CategoriaGasto).filter(CategoriaGasto.activa == True).all()


@router.post("/categorias-gasto", status_code=201)
def crear_categoria(nombre: str, db: Session = Depends(get_db)):
    cat = CategoriaGasto(nombre=nombre)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ─── RESUMEN DEL DÍA (para footer de Stock) ──────────────────────────────────

@router.get("/resumen-dia")
def resumen_del_dia(db: Session = Depends(get_db)):
    """
    Devuelve ingresos de hoy, variación vs ayer, tendencia mensual diaria,
    y margen promedio global del mes.
    """
    from datetime import date, timedelta
    from app.models import Variante as VarianteModel

    hoy = date.today()
    ayer = hoy - timedelta(days=1)

    def ingresos_dia(d):
        inicio = datetime.combine(d, datetime.min.time())
        fin = datetime.combine(d, datetime.max.time())
        return db.query(func.sum(Venta.total)).filter(
            Venta.estado == "confirmada",
            Venta.fecha >= inicio,
            Venta.fecha <= fin
        ).scalar() or Decimal("0")

    ingresos_hoy = ingresos_dia(hoy)
    ingresos_ayer = ingresos_dia(ayer)

    # Delta porcentual vs ayer
    if ingresos_ayer > 0:
        delta = round(float((ingresos_hoy - ingresos_ayer) / ingresos_ayer * 100), 1)
    else:
        delta = None

    # Tendencia mensual: ingresos por día del mes actual
    primer_dia = datetime.combine(hoy.replace(day=1), datetime.min.time())
    ventas_mes = db.query(
        func.date(Venta.fecha).label("dia"),
        func.sum(Venta.total).label("total")
    ).filter(
        Venta.estado == "confirmada",
        Venta.fecha >= primer_dia
    ).group_by(func.date(Venta.fecha)).order_by("dia").all()

    tendencia = [float(row.total) for row in ventas_mes]

    # Margen promedio global (todas las variantes activas con precio > 0)
    variantes = db.query(VarianteModel).filter(
        VarianteModel.activa == True,
        VarianteModel.precio_venta > 0,
        VarianteModel.costo > 0
    ).all()
    if variantes:
        margenes = [
            float((v.precio_venta - v.costo) / v.precio_venta * 100)
            for v in variantes
        ]
        margen_promedio = round(sum(margenes) / len(margenes), 1)
    else:
        margen_promedio = 0.0

    return {
        "ingresos_hoy": float(ingresos_hoy),
        "ingresos_ayer": float(ingresos_ayer),
        "delta_hoy": delta,
        "tendencia_mensual": tendencia,
        "margen_promedio": margen_promedio,
    }
