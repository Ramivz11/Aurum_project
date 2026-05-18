from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import CategoriaProducto

router = APIRouter(prefix="/categorias-producto", tags=["Categorías Producto"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CategoriaProductoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)

class CategoriaProductoUpdate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)

class CategoriaProductoResponse(BaseModel):
    id: int
    nombre: str
    activa: bool

    class Config:
        from_attributes = True


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[CategoriaProductoResponse])
def listar_categorias(db: Session = Depends(get_db)):
    return (
        db.query(CategoriaProducto)
        .filter(CategoriaProducto.activa == True)
        .order_by(CategoriaProducto.nombre)
        .all()
    )


@router.post("", response_model=CategoriaProductoResponse, status_code=201)
def crear_categoria(data: CategoriaProductoCreate, db: Session = Depends(get_db)):
    existe = db.query(CategoriaProducto).filter(
        CategoriaProducto.nombre.ilike(data.nombre)
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    cat = CategoriaProducto(nombre=data.nombre)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{categoria_id}", response_model=CategoriaProductoResponse)
def actualizar_categoria(
    categoria_id: int, data: CategoriaProductoUpdate, db: Session = Depends(get_db)
):
    cat = db.query(CategoriaProducto).filter(CategoriaProducto.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cat.nombre = data.nombre
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{categoria_id}", status_code=204)
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    cat = db.query(CategoriaProducto).filter(CategoriaProducto.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cat.activa = False
    db.commit()