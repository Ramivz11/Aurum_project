from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from app.database import get_db
from app.models import Recordatorio, PrioridadEnum

router = APIRouter(prefix="/recordatorios", tags=["Recordatorios"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class RecordatorioCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=300)
    descripcion: Optional[str] = None
    prioridad: PrioridadEnum = PrioridadEnum.media


class RecordatorioUpdate(BaseModel):
    titulo: Optional[str] = Field(None, min_length=1, max_length=300)
    descripcion: Optional[str] = None
    prioridad: Optional[PrioridadEnum] = None
    completado: Optional[bool] = None


class RecordatorioResponse(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str]
    prioridad: str
    completado: bool
    creado_en: datetime

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[RecordatorioResponse])
def listar_recordatorios(
    solo_pendientes: bool = True,
    prioridad: Optional[PrioridadEnum] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Recordatorio)
    if solo_pendientes:
        query = query.filter(Recordatorio.completado == False)
    if prioridad:
        query = query.filter(Recordatorio.prioridad == prioridad)
    # Orden: alta → media → baja, luego por fecha
    from sqlalchemy import case
    orden = case(
        {"alta": 0, "media": 1, "baja": 2},
        value=Recordatorio.prioridad
    )
    return query.order_by(orden, Recordatorio.creado_en.desc()).all()


@router.post("", response_model=RecordatorioResponse, status_code=201)
def crear_recordatorio(data: RecordatorioCreate, db: Session = Depends(get_db)):
    r = Recordatorio(**data.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/{recordatorio_id}", response_model=RecordatorioResponse)
def actualizar_recordatorio(
    recordatorio_id: int, data: RecordatorioUpdate, db: Session = Depends(get_db)
):
    r = db.query(Recordatorio).filter(Recordatorio.id == recordatorio_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(r, campo, valor)
    db.commit()
    db.refresh(r)
    return r


@router.post("/{recordatorio_id}/completar", response_model=RecordatorioResponse)
def completar_recordatorio(recordatorio_id: int, db: Session = Depends(get_db)):
    r = db.query(Recordatorio).filter(Recordatorio.id == recordatorio_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    r.completado = True
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{recordatorio_id}", status_code=204)
def eliminar_recordatorio(recordatorio_id: int, db: Session = Depends(get_db)):
    r = db.query(Recordatorio).filter(Recordatorio.id == recordatorio_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    db.delete(r)
    db.commit()
