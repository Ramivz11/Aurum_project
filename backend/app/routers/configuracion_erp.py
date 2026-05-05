"""
Router — Configuración del ERP y Sugerencia de Compra Inteligente.

Endpoints:
  GET  /api/configuracion       → Lee los parámetros logísticos.
  PUT  /api/configuracion       → Actualiza los parámetros.
  POST /api/compras/sugerencias → Genera la sugerencia de compra con IA.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ConfiguracionERP,
    Producto,
    Variante,
    VentaItem,
    Venta,
    EstadoVentaEnum,
    StockSucursal,
)
from app.schemas import (
    ConfiguracionERPResponse,
    ConfiguracionERPUpdate,
    SugerenciaCompraRequest,
    SugerenciaCompraResponse,
    ProductoSugerido,
)
from app.services.ia_sugerencias import generar_sugerencia_compra

# ─── Sub-routers ──────────────────────────────────────────────────────────────

config_router = APIRouter(prefix="/api/configuracion", tags=["Configuración ERP"])
sugerencias_router = APIRouter(prefix="/api/compras", tags=["Sugerencia de Compra IA"])


# ═══════════════════════════════════════════════════════════════════════════════
# REPOSITORIO — acceso a datos de configuración
# ═══════════════════════════════════════════════════════════════════════════════

def _obtener_config(db: Session) -> ConfiguracionERP:
    """Devuelve la fila singleton (id=1) o la crea con defaults."""
    config = db.query(ConfiguracionERP).filter(ConfiguracionERP.id == 1).first()
    if not config:
        config = ConfiguracionERP(id=1)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _config_a_dict(config: ConfiguracionERP) -> dict:
    return {
        "dias_demora_proveedor": config.dias_demora_proveedor,
        "dias_stock_seguridad": config.dias_stock_seguridad,
        "ventana_dias_analisis_ventas": config.ventana_dias_analisis_ventas,
        "umbral_ventas_producto_estrella": config.umbral_ventas_producto_estrella,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS — Configuración ERP
# ═══════════════════════════════════════════════════════════════════════════════

@config_router.get("", response_model=ConfiguracionERPResponse)
def leer_configuracion(db: Session = Depends(get_db)):
    """Devuelve los parámetros logísticos actuales."""
    return _obtener_config(db)


@config_router.put("", response_model=ConfiguracionERPResponse)
def actualizar_configuracion(data: ConfiguracionERPUpdate, db: Session = Depends(get_db)):
    """Actualiza solo los campos enviados (PATCH semántico)."""
    config = _obtener_config(db)
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No se enviaron campos para actualizar")
    for campo, valor in update_data.items():
        setattr(config, campo, valor)
    db.commit()
    db.refresh(config)
    return config


# ═══════════════════════════════════════════════════════════════════════════════
# REPOSITORIO — datos de inventario y velocidad de ventas
# ═══════════════════════════════════════════════════════════════════════════════

def _obtener_inventario_con_velocidad(db: Session, ventana_dias: int) -> list[dict]:
    """
    Consulta variantes activas con su stock total (central + sucursales),
    costo unitario y velocidad de ventas (unidades/día) calculada
    estrictamente dentro de la ventana de análisis.
    """
    fecha_inicio = datetime.now(timezone.utc) - timedelta(days=ventana_dias)

    # Subconsulta: total vendido por variante en la ventana
    ventas_sub = (
        db.query(
            VentaItem.variante_id,
            sqlfunc.coalesce(sqlfunc.sum(VentaItem.cantidad), 0).label("total_vendido"),
        )
        .join(Venta, Venta.id == VentaItem.venta_id)
        .filter(
            Venta.estado == EstadoVentaEnum.confirmada,
            Venta.fecha >= fecha_inicio,
        )
        .group_by(VentaItem.variante_id)
        .subquery()
    )

    # Subconsulta: stock total por variante (todas las sucursales)
    stock_sub = (
        db.query(
            StockSucursal.variante_id,
            sqlfunc.coalesce(sqlfunc.sum(StockSucursal.cantidad), 0).label("stock_total"),
        )
        .group_by(StockSucursal.variante_id)
        .subquery()
    )

    # Query principal
    rows = (
        db.query(
            Variante.id,
            Producto.nombre,
            Variante.sabor,
            Variante.tamanio,
            Variante.costo,
            sqlfunc.coalesce(stock_sub.c.stock_total, 0).label("stock_actual"),
            sqlfunc.coalesce(ventas_sub.c.total_vendido, 0).label("total_vendido"),
        )
        .join(Producto, Producto.id == Variante.producto_id)
        .outerjoin(stock_sub, stock_sub.c.variante_id == Variante.id)
        .outerjoin(ventas_sub, ventas_sub.c.variante_id == Variante.id)
        .filter(Variante.activa == True, Producto.activo == True)
        .all()
    )

    inventario = []
    for row in rows:
        total_vendido = int(row.total_vendido)
        velocidad = round(total_vendido / ventana_dias, 2) if ventana_dias > 0 else 0.0
        inventario.append({
            "variante_id": row.id,
            "producto": row.nombre,
            "sabor": row.sabor,
            "tamanio": row.tamanio,
            "stock_actual": int(row.stock_actual),
            "costo_unitario": float(row.costo) if row.costo else 0.0,
            "total_vendido_ventana": total_vendido,
            "velocidad_diaria": velocidad,
        })

    return inventario


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT — Sugerencia de Compra Inteligente
# ═══════════════════════════════════════════════════════════════════════════════

@sugerencias_router.post("/sugerencias", response_model=SugerenciaCompraResponse)
async def sugerir_compra(body: SugerenciaCompraRequest, db: Session = Depends(get_db)):
    """
    Flujo:
      1. Leer configuración ERP (parámetros dinámicos).
      2. Consultar inventario + velocidad de ventas.
      3. Construir prompt para Claude inyectando presupuesto + reglas.
      4. Parsear respuesta JSON → SugerenciaCompraResponse.
    """
    # 1. Parámetros dinámicos
    config = _obtener_config(db)
    config_dict = _config_a_dict(config)

    # 2. Inventario con velocidad de ventas
    inventario = _obtener_inventario_con_velocidad(
        db, config.ventana_dias_analisis_ventas
    )

    if not inventario:
        raise HTTPException(
            status_code=404,
            detail="No hay productos activos para analizar. Creá productos primero.",
        )

    # 3 & 4. Llamar a la IA
    try:
        resultado = await generar_sugerencia_compra(
            presupuesto=body.presupuesto_disponible,
            config=config_dict,
            inventario=inventario,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Validar y mapear la respuesta
    productos_sugeridos = []
    for p in resultado.get("productos", []):
        try:
            productos_sugeridos.append(ProductoSugerido(
                variante_id=p["variante_id"],
                producto=p.get("producto", "Sin nombre"),
                sabor=p.get("sabor"),
                tamanio=p.get("tamanio"),
                stock_actual=int(p.get("stock_actual", 0)),
                velocidad_diaria=float(p.get("velocidad_diaria", 0)),
                dias_cobertura=float(p.get("dias_cobertura", 0)),
                cantidad_sugerida=int(p.get("cantidad_sugerida", 0)),
                costo_unitario=Decimal(str(p.get("costo_unitario", 0))),
                subtotal=Decimal(str(p.get("subtotal", 0))),
                prioridad=p.get("prioridad", "bajo"),
                justificacion=p.get("justificacion", ""),
            ))
        except (ValueError, KeyError) as e:
            logger.warning("Producto inválido en respuesta IA: %s — %s", p, e)
            continue

    return SugerenciaCompraResponse(
        productos=productos_sugeridos,
        total_estimado=Decimal(str(resultado.get("total_estimado", 0))),
        presupuesto_disponible=body.presupuesto_disponible,
        presupuesto_restante=Decimal(str(resultado.get("presupuesto_restante", 0))),
        alerta_presupuesto=resultado.get("alerta_presupuesto"),
        resumen_ia=resultado.get("resumen_ia", "Sin resumen disponible."),
    )
