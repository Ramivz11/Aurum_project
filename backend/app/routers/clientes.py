from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

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
        total = sum(v.total for v in cliente.ventas if v.estado == "confirmada") or Decimal("0")
        resultado.append(ClienteConResumen(
            **ClienteResponse.model_validate(cliente).model_dump(),
            total_gastado=total,
            cantidad_compras=len([v for v in cliente.ventas if v.estado == "confirmada"])
        ))

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
            func.count(Venta.id).label("cantidad_compras")
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
            cantidad_compras=cantidad
        )
        for cliente, total, cantidad in resultados
    ]


@router.get("/{cliente_id}", response_model=ClienteConResumen)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    total = sum(v.total for v in cliente.ventas if v.estado == "confirmada") or Decimal("0")
    return ClienteConResumen(
        **ClienteResponse.model_validate(cliente).model_dump(),
        total_gastado=total,
        cantidad_compras=len([v for v in cliente.ventas if v.estado == "confirmada"])
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
