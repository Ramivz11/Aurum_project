from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Cliente, Venta, VentaItem
from app.schemas import (
    ClienteCreate, ClienteUpdate, ClienteResponse, ClienteConResumen
)

router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get("", response_model=List[ClienteConResumen])
def listar_clientes(
    busqueda: Optional[str] = Query(None),
    ubicacion: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Cliente).filter(Cliente.activo == True)
    if busqueda:
        query = query.filter(Cliente.nombre.ilike(f"%{busqueda}%"))
    if ubicacion:
        query = query.filter(Cliente.ubicacion.ilike(f"%{ubicacion}%"))

    clientes = query.order_by(Cliente.nombre).all()

    resultado = []
    for cliente in clientes:
        ventas_conf = [v for v in cliente.ventas if v.estado == "confirmada"]
        total = sum(v.total for v in ventas_conf) or Decimal("0")
        ultima = max((v.fecha for v in ventas_conf), default=None)
        resultado.append(ClienteConResumen(
            **ClienteResponse.model_validate(cliente).model_dump(),
            total_gastado=total,
            cantidad_compras=len(ventas_conf),
            ultima_compra=ultima,
        ))

    return resultado


@router.get("/sin-compras-recientes", response_model=List[ClienteConResumen])
def clientes_sin_compras_recientes(
    dias: int = Query(57, ge=1),
    db: Session = Depends(get_db)
):
    """Clientes activos cuya última compra fue hace más de `dias` días (o nunca compraron)."""
    limite = datetime.now() - timedelta(days=dias)
    clientes = db.query(Cliente).filter(Cliente.activo == True).all()

    resultado = []
    for cliente in clientes:
        ventas_conf = [v for v in cliente.ventas if v.estado == "confirmada"]
        ultima = max((v.fecha for v in ventas_conf), default=None)
        # Incluir si nunca compró o última compra fue antes del límite
        if ultima is None or ultima < limite:
            total = sum(v.total for v in ventas_conf) or Decimal("0")
            resultado.append(ClienteConResumen(
                **ClienteResponse.model_validate(cliente).model_dump(),
                total_gastado=total,
                cantidad_compras=len(ventas_conf),
                ultima_compra=ultima,
            ))

    resultado.sort(key=lambda x: (x.ultima_compra is not None, x.ultima_compra or datetime.min))
    return resultado


@router.get("/top-mes", response_model=List[ClienteConResumen])
def top_clientes_del_mes(
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
            Cliente,
            func.sum(Venta.total).label("total_gastado"),
            func.count(Venta.id).label("cantidad_compras"),
            func.max(Venta.fecha).label("ultima_compra"),
        )
        .join(Venta, Venta.cliente_id == Cliente.id)
        .filter(
            Venta.estado == "confirmada",
            extract("month", Venta.fecha) == mes,
            extract("year", Venta.fecha) == anio,
        )
        .group_by(Cliente.id)
        .order_by(func.sum(Venta.total).desc())
        .limit(limite)
        .all()
    )

    return [
        ClienteConResumen(
            **ClienteResponse.model_validate(cliente).model_dump(),
            total_gastado=total or Decimal("0"),
            cantidad_compras=cantidad,
            ultima_compra=ultima,
        )
        for cliente, total, cantidad, ultima in resultados
    ]


@router.get("/top-historico", response_model=List[ClienteConResumen])
def top_clientes_historico(
    limite: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    resultados = (
        db.query(
            Cliente,
            func.sum(Venta.total).label("total_gastado"),
            func.count(Venta.id).label("cantidad_compras"),
            func.max(Venta.fecha).label("ultima_compra"),
        )
        .join(Venta, Venta.cliente_id == Cliente.id)
        .filter(Venta.estado == "confirmada", Cliente.activo == True)
        .group_by(Cliente.id)
        .order_by(func.sum(Venta.total).desc())
        .limit(limite)
        .all()
    )

    return [
        ClienteConResumen(
            **ClienteResponse.model_validate(cliente).model_dump(),
            total_gastado=total or Decimal("0"),
            cantidad_compras=cantidad,
            ultima_compra=ultima,
        )
        for cliente, total, cantidad, ultima in resultados
    ]


@router.get("/{cliente_id}", response_model=ClienteConResumen)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    ventas_conf = [v for v in cliente.ventas if v.estado == "confirmada"]
    total = sum(v.total for v in ventas_conf) or Decimal("0")
    ultima = max((v.fecha for v in ventas_conf), default=None)
    return ClienteConResumen(
        **ClienteResponse.model_validate(cliente).model_dump(),
        total_gastado=total,
        cantidad_compras=len(ventas_conf),
        ultima_compra=ultima,
    )


@router.post("", response_model=ClienteResponse, status_code=201)
def crear_cliente(data: ClienteCreate, db: Session = Depends(get_db)):
    cliente = Cliente(**data.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.put("/{cliente_id}", response_model=ClienteResponse)
def actualizar_cliente(cliente_id: int, data: ClienteUpdate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(cliente, campo, valor)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=204)
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    cliente.activo = False
    db.commit()


# ─── PERFIL DE CLIENTE ───────────────────────────────────────────────────────

@router.get("/{cliente_id}/perfil")
def perfil_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Dashboard individual del cliente: historial, favoritos, gasto por mes."""
    from app.models import Variante, Producto

    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    ventas_conf = [v for v in cliente.ventas if v.estado == "confirmada"]
    total_gastado = sum(v.total for v in ventas_conf) or Decimal("0")

    # Historial de compras (últimas 20)
    historial = sorted(ventas_conf, key=lambda v: v.fecha, reverse=True)[:20]
    historial_data = [{
        "id": v.id, "fecha": v.fecha.isoformat(), "total": float(v.total),
        "metodo_pago": v.metodo_pago.value if hasattr(v.metodo_pago, 'value') else v.metodo_pago,
        "items": len(v.items),
    } for v in historial]

    # Productos favoritos (más comprados)
    from collections import Counter
    product_counts = Counter()
    product_info = {}
    for v in ventas_conf:
        for item in v.items:
            variante = item.variante
            if variante and variante.producto:
                key = variante.producto.nombre
                product_counts[key] += item.cantidad
                if key not in product_info:
                    product_info[key] = {
                        "nombre": key, "marca": variante.producto.marca,
                        "sabor": variante.sabor, "tamanio": variante.tamanio,
                    }
    favoritos = [
        {**product_info[nombre], "cantidad_total": cant}
        for nombre, cant in product_counts.most_common(5)
    ]

    # Gasto por mes (últimos 6 meses)
    from collections import defaultdict
    gasto_mes = defaultdict(float)
    for v in ventas_conf:
        key = f"{v.fecha.year}-{v.fecha.month:02d}"
        gasto_mes[key] += float(v.total)
    meses_ordenados = sorted(gasto_mes.items())[-6:]

    return {
        "cliente": {
            "id": cliente.id, "nombre": cliente.nombre,
            "ubicacion": cliente.ubicacion, "telefono": cliente.telefono,
        },
        "total_gastado": float(total_gastado),
        "cantidad_compras": len(ventas_conf),
        "ticket_promedio": float(total_gastado / len(ventas_conf)) if ventas_conf else 0,
        "historial": historial_data,
        "favoritos": favoritos,
        "gasto_por_mes": [{"mes": m, "total": t} for m, t in meses_ordenados],
    }

