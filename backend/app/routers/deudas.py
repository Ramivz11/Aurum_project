from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from decimal import Decimal

from app.database import get_db
from app.models import Deuda
from app.schemas import DeudaCreate, DeudaResponse, TipoDeuda

router = APIRouter(prefix="/deudas", tags=["Deudas"])


@router.get("", response_model=List[DeudaResponse])
def listar_deudas(
    tipo: Optional[TipoDeuda] = Query(None),
    solo_pendientes: bool = Query(True),
    db: Session = Depends(get_db)
):
    query = db.query(Deuda)
    if tipo:
        query = query.filter(Deuda.tipo == tipo)
    if solo_pendientes:
        query = query.filter(Deuda.saldada == False)
    return query.order_by(Deuda.fecha_vencimiento.asc()).all()


@router.get("/resumen")
def resumen_deudas(db: Session = Depends(get_db)):
    por_cobrar = db.query(func.sum(Deuda.monto)).filter(
        Deuda.tipo == "por_cobrar", Deuda.saldada == False
    ).scalar() or Decimal("0")

    por_pagar = db.query(func.sum(Deuda.monto)).filter(
        Deuda.tipo == "por_pagar", Deuda.saldada == False
    ).scalar() or Decimal("0")

    return {
        "por_cobrar": por_cobrar,
        "por_pagar": por_pagar,
        "balance": por_cobrar - por_pagar
    }


@router.post("", response_model=DeudaResponse, status_code=201)
def crear_deuda(data: DeudaCreate, db: Session = Depends(get_db)):
    deuda = Deuda(**data.model_dump())
    db.add(deuda)
    db.commit()
    db.refresh(deuda)
    return deuda


@router.put("/{deuda_id}", response_model=DeudaResponse)
def actualizar_deuda(deuda_id: int, data: DeudaCreate, db: Session = Depends(get_db)):
    deuda = db.query(Deuda).filter(Deuda.id == deuda_id).first()
    if not deuda:
        raise HTTPException(status_code=404, detail="Deuda no encontrada")
    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(deuda, campo, valor)
    db.commit()
    db.refresh(deuda)
    return deuda


@router.post("/{deuda_id}/saldar", response_model=DeudaResponse)
def saldar_deuda(deuda_id: int, db: Session = Depends(get_db)):
    deuda = db.query(Deuda).filter(Deuda.id == deuda_id).first()
    if not deuda:
        raise HTTPException(status_code=404, detail="Deuda no encontrada")
    deuda.saldada = True
    db.commit()
    db.refresh(deuda)
    return deuda


@router.delete("/{deuda_id}", status_code=204)
def eliminar_deuda(deuda_id: int, db: Session = Depends(get_db)):
    deuda = db.query(Deuda).filter(Deuda.id == deuda_id).first()
    if not deuda:
        raise HTTPException(status_code=404, detail="Deuda no encontrada")
    db.delete(deuda)
    db.commit()
