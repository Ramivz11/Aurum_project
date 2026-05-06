import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, engine, SessionLocal
from app.routers import productos, ventas, compras, clientes, finanzas, deudas, stock, recordatorios
from app.routers.movimientos_sucursales import movimientos_router, sucursales_router
from app.routers import categorias_productos
from app.routers import marcas_config as marcas_config_router
from app.routers.configuracion_erp import config_router, sugerencias_router

Base.metadata.create_all(bind=engine)


def _run_migrations():
    with engine.connect() as conn:
        conn.execute(
            text("ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS es_central BOOLEAN DEFAULT FALSE NOT NULL")
        )
        # Tabla de ajustes de ganancia
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ganancia_ajuste (
                id SERIAL PRIMARY KEY,
                monto_extraido NUMERIC(12,2) NOT NULL,
                nota TEXT,
                fecha TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        # Tabla de configuración de colores por marca
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS marca_config (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                color VARCHAR(20) NOT NULL DEFAULT '#ff9800',
                creado_en TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        # Tabla de configuración ERP (parámetros logísticos)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS configuraciones_erp (
                id INTEGER PRIMARY KEY DEFAULT 1,
                dias_demora_proveedor INTEGER NOT NULL DEFAULT 3,
                dias_stock_seguridad INTEGER NOT NULL DEFAULT 5,
                ventana_dias_analisis_ventas INTEGER NOT NULL DEFAULT 30,
                umbral_ventas_producto_estrella INTEGER NOT NULL DEFAULT 15,
                actualizado_en TIMESTAMPTZ
            )
        """))
        # Insertar fila singleton si no existe (valores explícitos para NOT NULL)
        conn.execute(text("""
            INSERT INTO configuraciones_erp (
                id, dias_demora_proveedor, dias_stock_seguridad,
                ventana_dias_analisis_ventas, umbral_ventas_producto_estrella
            ) VALUES (1, 3, 5, 30, 15)
            ON CONFLICT (id) DO NOTHING
        """))
        conn.commit()


async def _seed_and_migrate():
    from app.models import Sucursal, CategoriaGasto, CategoriaProducto, Variante, StockSucursal

    _run_migrations()

    db = SessionLocal()
    try:
        # ── Depósito Central ─────────────────────────────────────────────────
        central = db.query(Sucursal).filter(Sucursal.es_central == True).first()
        if not central:
            central = Sucursal(nombre="Depósito Central", es_central=True)
            db.add(central)
            db.flush()

        # ── Sucursales de ejemplo ─────────────────────────────────────────────
        if db.query(Sucursal).filter(Sucursal.es_central == False).count() == 0:
            for nombre in ["Sucursal 1", "Sucursal 2", "Sucursal 3"]:
                db.add(Sucursal(nombre=nombre))

        # ── Categorías de gasto ───────────────────────────────────────────────
        if not db.query(CategoriaGasto).first():
            for nombre in ["Publicidad", "Envío", "Alquiler", "Otros"]:
                db.add(CategoriaGasto(nombre=nombre))

        # ── Categorías de producto ────────────────────────────────────────────
        if not db.query(CategoriaProducto).first():
            for nombre in ["Proteína", "Creatina", "Pre-workout", "Aminoácidos",
                           "Vitaminas", "Colágeno", "Magnesio", "Otro"]:
                db.add(CategoriaProducto(nombre=nombre))

        db.commit()

        # ── Migración one-time: variante.stock_actual → StockSucursal(central) ─
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
    version="1.2.0",
    lifespan=lifespan,
)

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
app.include_router(marcas_config_router.router)
app.include_router(config_router)
app.include_router(sugerencias_router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "Gestión de Suplementos v1.2"}
