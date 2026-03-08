import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, engine, SessionLocal
from app.routers import productos, ventas, compras, clientes, finanzas, deudas, stock, recordatorios
from app.routers.movimientos_sucursales import movimientos_router, sucursales_router
from app.routers import categorias_productos

Base.metadata.create_all(bind=engine)


def _run_migrations():
    """Migraciones SQL manuales — safe para DB ya existentes."""
    with engine.connect() as conn:
        # Agregar es_central si no existe (no rompe DB existentes)
        # SQLAlchemy 2.x requiere text() para SQL crudo
        conn.execute(
            text("ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS es_central BOOLEAN DEFAULT FALSE NOT NULL")
        )
        conn.commit()


async def _seed_and_migrate():
    """Carga datos iniciales y migra variante.stock_actual → StockSucursal(central)."""
    from app.models import Sucursal, CategoriaGasto, CategoriaProducto, Variante, StockSucursal

    # Primero la migración DDL
    _run_migrations()

    db = SessionLocal()
    try:
        # ── Depósito Central ─────────────────────────────────────────────────
        central = db.query(Sucursal).filter(Sucursal.es_central == True).first()
        if not central:
            central = Sucursal(nombre="Depósito Central", es_central=True)
            db.add(central)
            db.flush()

        # ── Sucursales de ejemplo (solo si no existen aún) ───────────────────
        if db.query(Sucursal).filter(Sucursal.es_central == False).count() == 0:
            for nombre in ["Sucursal 1", "Sucursal 2", "Sucursal 3"]:
                db.add(Sucursal(nombre=nombre))

        # ── Categorías de gasto ──────────────────────────────────────────────
        if not db.query(CategoriaGasto).first():
            for nombre in ["Publicidad", "Envío", "Alquiler", "Otros"]:
                db.add(CategoriaGasto(nombre=nombre))

        # ── Categorías de producto ───────────────────────────────────────────
        if not db.query(CategoriaProducto).first():
            for nombre in ["Proteína", "Creatina", "Pre-workout", "Aminoácidos",
                           "Vitaminas", "Colágeno", "Magnesio", "Otro"]:
                db.add(CategoriaProducto(nombre=nombre))

        db.commit()

        # ── Migración one-time: variante.stock_actual → StockSucursal(central)
        central = db.query(Sucursal).filter(Sucursal.es_central == True).first()
        variantes_con_stock = db.query(Variante).filter(Variante.stock_actual > 0).all()
        for variante in variantes_con_stock:
            ss = db.query(StockSucursal).filter(
                StockSucursal.variante_id == variante.id,
                StockSucursal.sucursal_id == central.id
            ).first()
            if ss:
                ss.cantidad += variante.stock_actual
            else:
                db.add(StockSucursal(
                    variante_id=variante.id,
                    sucursal_id=central.id,
                    cantidad=variante.stock_actual,
                ))
            variante.stock_actual = 0

        if variantes_con_stock:
            db.commit()

    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _seed_and_migrate()
    yield


app = FastAPI(
    title="Gestión de Suplementos",
    description="API para gestión de stock, ventas y finanzas",
    version="1.1.0",
    lifespan=lifespan,
)

# CORS — en producción, setear ALLOWED_ORIGINS en variables de entorno
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categorias_productos.router)
app.include_router(productos.router)
app.include_router(ventas.router)
app.include_router(compras.router)
app.include_router(clientes.router)
app.include_router(finanzas.router)
app.include_router(deudas.router)
app.include_router(stock.router)
app.include_router(recordatorios.router)
app.include_router(movimientos_router)
app.include_router(sucursales_router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "Gestión de Suplementos v1.1"}
