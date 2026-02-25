from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import productos, ventas, compras, clientes, finanzas, deudas, stock
from app.routers.movimientos_sucursales import movimientos_router, sucursales_router
from app.routers import categorias_producto

# Crear tablas al iniciar (en producción usar Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Gestión de Suplementos",
    description="API para gestión de stock, ventas y finanzas",
    version="1.0.0",
)

# CORS — permite que el frontend en Railway llame a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(categorias_producto.router)  # antes de productos para evitar conflictos
app.include_router(productos.router)
app.include_router(ventas.router)
app.include_router(compras.router)
app.include_router(clientes.router)
app.include_router(finanzas.router)
app.include_router(deudas.router)
app.include_router(stock.router)
app.include_router(movimientos_router)
app.include_router(sucursales_router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "Gestión de Suplementos v1.0"}


@app.on_event("startup")
async def seed_data():
    """Carga datos iniciales si la DB está vacía."""
    from app.database import SessionLocal
    from app.models import Sucursal, CategoriaGasto, CategoriaProducto

    db = SessionLocal()
    try:
        if not db.query(Sucursal).first():
            sucursales = ["Sucursal 1", "Sucursal 2", "Sucursal 3"]
            for nombre in sucursales:
                db.add(Sucursal(nombre=nombre))

        if not db.query(CategoriaGasto).first():
            categorias = ["Publicidad", "Envío", "Alquiler", "Otros"]
            for nombre in categorias:
                db.add(CategoriaGasto(nombre=nombre))

        if not db.query(CategoriaProducto).first():
            cats_producto = [
                "Proteína", "Creatina", "Pre-workout", "Aminoácidos",
                "Vitaminas", "Colágeno", "Magnesio", "Otro"
            ]
            for nombre in cats_producto:
                db.add(CategoriaProducto(nombre=nombre))

        db.commit()
    finally:
        db.close()