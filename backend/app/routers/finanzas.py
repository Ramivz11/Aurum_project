from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.models import (
    Venta, Compra, Gasto, AjusteSaldo, VentaItem, Variante,
    MetodoPagoEnum, CategoriaGasto, GananciaAjuste
)
from app.schemas import (
    LiquidezResponse, AjusteSaldoCreate, AjusteSaldoResponse,
    AnalisisMesResponse, ProductoTopResponse, GastoCreate, GastoResponse
)

router = APIRouter(prefix="/finanzas", tags=["Finanzas"])


# ─── HELPERS: ganancia ─────────────────────────────────────────────────────────

def _calcular_ganancia_bruta(db: Session, mes: int = None, anio: int = None) -> Decimal:
    """Ganancia bruta (precio_venta - costo) × unidades, opcionalmente filtrada por mes."""
    from app.models import VentaItem as VI, Variante as Var
    query = (
        db.query(VI, Var)
        .join(Venta, Venta.id == VI.venta_id)
        .join(Var, Var.id == VI.variante_id)
        .filter(Venta.estado == "confirmada")
    )
    if mes and anio:
        query = query.filter(
            extract("month", Venta.fecha) == mes,
            extract("year", Venta.fecha) == anio,
        )
    items = query.all()
    return sum(
        (item.precio_unitario - (item.costo_unitario if item.costo_unitario is not None else variante.costo)) * item.cantidad
        for item, variante in items
    ) if items else Decimal("0")


def _calcular_ganancia_neta(db: Session) -> Decimal:
    """Ganancia bruta total MENOS lo ya extraído/retirado."""
    ganancia_total = _calcular_ganancia_bruta(db)
    total_extraido = db.query(func.sum(GananciaAjuste.monto_extraido)).scalar() or Decimal("0")
    return max(Decimal("0"), ganancia_total - total_extraido)


# ─── LIQUIDEZ ────────────────────────────────────────────────────────────────

@router.get("/liquidez", response_model=LiquidezResponse)
def obtener_liquidez(db: Session = Depends(get_db)):
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

        ultimo_ajuste = db.query(AjusteSaldo).filter(
            AjusteSaldo.tipo == metodo
        ).order_by(AjusteSaldo.fecha.desc()).first()

        if ultimo_ajuste:
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

    now = datetime.now()
    ganancia_bruta_total = _calcular_ganancia_bruta(db)
    ganancia_bruta_mes = _calcular_ganancia_bruta(db, mes=now.month, anio=now.year)
    total_retirado = db.query(func.sum(GananciaAjuste.monto_extraido)).scalar() or Decimal("0")
    ganancia_acumulada = max(Decimal("0"), ganancia_bruta_total - total_retirado)

    return LiquidezResponse(
        efectivo=efectivo,
        transferencia=transferencia,
        tarjeta=tarjeta,
        total=efectivo + transferencia + tarjeta,
        ganancia_acumulada=ganancia_acumulada,
        ganancia_bruta_total=ganancia_bruta_total,
        ganancia_bruta_mes=ganancia_bruta_mes,
        total_retirado=total_retirado,
    )


# ─── LIMPIAR GANANCIA ────────────────────────────────────────────────────────

@router.post("/ganancia/limpiar")
def limpiar_ganancia(nota: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Registra que el usuario separó/extrajo la ganancia acumulada.
    El contador vuelve a 0 y empieza a contar desde cero.
    """
    ganancia_actual = _calcular_ganancia_neta(db)
    if ganancia_actual <= 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No hay ganancia positiva para limpiar")

    ajuste = GananciaAjuste(
        monto_extraido=ganancia_actual,
        nota=nota or f"Extracción del {datetime.now().strftime('%d/%m/%Y %H:%M')}",
    )
    db.add(ajuste)
    db.commit()
    return {"ok": True, "monto_extraido": float(ganancia_actual)}


# ─── AJUSTE SALDO ────────────────────────────────────────────────────────────

@router.post("/ajuste-saldo", response_model=AjusteSaldoResponse, status_code=201)
def ajustar_saldo(data: AjusteSaldoCreate, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    from pydantic import BaseModel
    
    # Validar y convertir tipo
    tipos_validos = ['efectivo', 'transferencia', 'tarjeta', 'ganancia']
    if data.tipo not in tipos_validos:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Debe ser uno de: {', '.join(tipos_validos)}")
    
    monto_nuevo = Decimal(str(data.monto_nuevo))
    
    # Si es ganancia, registrar en GananciaAjuste
    if data.tipo == 'ganancia':
        ganancia_actual = _calcular_ganancia_neta(db)
        # monto_nuevo es el saldo deseado; la diferencia es lo que se "extrae"
        diferencia = ganancia_actual - monto_nuevo
        if diferencia == 0:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="El saldo ya es el indicado")
        ajuste_ganancia = GananciaAjuste(
            monto_extraido=diferencia,
            nota=data.nota or "Ajuste manual de ganancia",
        )
        db.add(ajuste_ganancia)
        db.commit()
        db.refresh(ajuste_ganancia)
        return AjusteSaldoResponse(
            id=ajuste_ganancia.id,
            tipo='ganancia',
            monto_anterior=ganancia_actual,
            monto_nuevo=monto_nuevo,
            nota=ajuste_ganancia.nota,
            fecha=ajuste_ganancia.fecha or datetime.now(),
        )
    
    tipo_enum = MetodoPagoEnum(data.tipo)
    liquidez = obtener_liquidez(db)
    saldo_actual = getattr(liquidez, tipo_enum.value)

    ajuste = AjusteSaldo(
        tipo=tipo_enum,
        monto_anterior=saldo_actual,
        monto_nuevo=monto_nuevo,
        nota=data.nota,
    )
    db.add(ajuste)
    db.commit()
    db.refresh(ajuste)
    return ajuste


# ─── ANÁLISIS DEL MES ────────────────────────────────────────────────────────

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

    ganancia = _calcular_ganancia_bruta(db, mes=mes, anio=anio)

    margen_promedio = float(ganancia / ingresos * 100) if ingresos > 0 else 0.0

    return AnalisisMesResponse(
        periodo=f"{mes:02d}/{anio}",
        ingresos=ingresos,
        compras=compras,
        gastos=gastos,
        neto=ingresos - compras - gastos,
        ganancia=ganancia,
        margen_promedio=round(margen_promedio, 1),
    )


# ─── PRODUCTOS TOP ────────────────────────────────────────────────────────────

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


# ─── RESUMEN DEL DÍA ─────────────────────────────────────────────────────────

@router.get("/resumen-dia")
def resumen_del_dia(db: Session = Depends(get_db)):
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

    if ingresos_ayer > 0:
        delta = round(float((ingresos_hoy - ingresos_ayer) / ingresos_ayer * 100), 1)
    else:
        delta = None

    primer_dia = datetime.combine(hoy.replace(day=1), datetime.min.time())
    ventas_mes = db.query(
        func.date(Venta.fecha).label("dia"),
        func.sum(Venta.total).label("total")
    ).filter(
        Venta.estado == "confirmada",
        Venta.fecha >= primer_dia
    ).group_by(func.date(Venta.fecha)).order_by("dia").all()

    tendencia = [float(row.total) for row in ventas_mes]

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


# ─── EXPORTAR CSV ────────────────────────────────────────────────────────────

@router.get("/exportar-csv")
def exportar_csv(
    mes: Optional[int] = Query(None),
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera un CSV con el resumen financiero del mes y los movimientos."""
    from fastapi.responses import StreamingResponse
    import io, csv

    now = datetime.now()
    mes = mes or now.month
    anio = anio or now.year

    # Obtener análisis
    analisis = analisis_del_mes(mes=mes, anio=anio, db=db)
    top = productos_mas_vendidos(mes=mes, anio=anio, limite=20, db=db)
    gastos_list = listar_gastos(mes=mes, anio=anio, db=db)

    output = io.StringIO()
    writer = csv.writer(output)

    # Resumen
    writer.writerow(["RESUMEN FINANCIERO", f"{mes:02d}/{anio}"])
    writer.writerow([])
    writer.writerow(["Concepto", "Monto"])
    writer.writerow(["Ingresos (ventas)", float(analisis.ingresos)])
    writer.writerow(["Compras", float(analisis.compras)])
    writer.writerow(["Gastos operativos", float(analisis.gastos)])
    writer.writerow(["Neto", float(analisis.neto)])
    writer.writerow(["Ganancia bruta", float(analisis.ganancia)])
    writer.writerow(["Margen promedio %", analisis.margen_promedio])
    writer.writerow([])

    # Productos top
    writer.writerow(["PRODUCTOS MÁS VENDIDOS"])
    writer.writerow(["Producto", "Marca", "Sabor", "Tamaño", "Unidades", "Ingreso", "Costo", "Ganancia", "Margen %"])
    for p in top:
        writer.writerow([p.nombre_producto, p.marca or "", p.sabor or "", p.tamanio or "",
                         p.cantidad_vendida, float(p.ingreso_total), float(p.costo_total),
                         float(p.ganancia), p.margen_porcentaje])
    writer.writerow([])

    # Gastos
    writer.writerow(["GASTOS DEL MES"])
    writer.writerow(["Fecha", "Concepto", "Monto", "Método de pago"])
    for g in gastos_list:
        writer.writerow([
            g.fecha.strftime("%d/%m/%Y") if g.fecha else "",
            g.concepto, float(g.monto),
            g.metodo_pago.value if hasattr(g.metodo_pago, 'value') else g.metodo_pago
        ])

    output.seek(0)
    filename = f"finanzas_{mes:02d}_{anio}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

