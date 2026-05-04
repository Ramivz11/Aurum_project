from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import MarcaConfig

router = APIRouter(prefix="/marcas-config", tags=["Marcas Config"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class MarcaConfigResponse(BaseModel):
    id: int
    nombre: str
    color: str

    class Config:
        from_attributes = True


class MarcaConfigUpsert(BaseModel):
    color: str = Field(..., pattern=r'^#[0-9a-fA-F]{6}$')


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[MarcaConfigResponse])
def listar_marcas_config(db: Session = Depends(get_db)):
    """Retorna colores configurados para cada marca."""
    return db.query(MarcaConfig).order_by(MarcaConfig.nombre).all()


@router.put("/{nombre}", response_model=MarcaConfigResponse)
def upsert_marca_config(nombre: str, data: MarcaConfigUpsert, db: Session = Depends(get_db)):
    """Crea o actualiza el color de una marca (upsert)."""
    config = db.query(MarcaConfig).filter(MarcaConfig.nombre == nombre).first()
    if config:
        config.color = data.color
    else:
        config = MarcaConfig(nombre=nombre, color=data.color)
        db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.post("/batch", response_model=List[MarcaConfigResponse])
def batch_upsert(marcas: List[dict], db: Session = Depends(get_db)):
    """Crea configs para marcas nuevas que no tienen color asignado."""
    resultado = []
    for m in marcas:
        nombre = m.get("nombre", "").strip()
        color = m.get("color", "#ff9800")
        if not nombre:
            continue
        config = db.query(MarcaConfig).filter(MarcaConfig.nombre == nombre).first()
        if not config:
            config = MarcaConfig(nombre=nombre, color=color)
            db.add(config)
            db.flush()
        resultado.append(config)
    db.commit()
    for c in resultado:
        db.refresh(c)
    return resultado
