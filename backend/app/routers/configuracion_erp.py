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

        # Excluir productos sin ninguna venta en la ventana de análisis:
        # no tiene sentido reponer algo que no se vende.
        if total_vendido == 0:
            continue

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


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS — ajuste de presupuesto
# ═══════════════════════════════════════════════════════════════════════════════

def _ajustar_al_presupuesto(resultado: dict, presupuesto: float) -> dict:
    """
    Garantiza que la lista de productos sugeridos no supere el presupuesto
    y a su vez maximiza el uso del presupuesto disponible.

    Paso 1 — Recorte: incluye productos en orden de prioridad hasta agotar el presupuesto.
    Paso 2 — Expansión: con el presupuesto restante, aumenta cantidades en orden de prioridad.
    """
    ORDEN_PRIORIDAD = {"critico": 0, "alto": 1, "medio": 2, "bajo": 3}

    # Ordenar por prioridad (por si la IA no lo hizo)
    productos_ia = sorted(
        resultado.get("productos", []),
        key=lambda p: ORDEN_PRIORIDAD.get(p.get("prioridad", "bajo"), 99)
    )

    disponible = presupuesto
    productos_ajustados = []

    # ── Paso 1: incluir lo que entra ─────────────────────────────────────────
    for p in productos_ia:
        costo_u = float(p.get("costo_unitario", 0))
        if costo_u <= 0:
            continue

        cant = int(p.get("cantidad_sugerida", 0))
        if cant <= 0:
            continue
        subtotal = costo_u * cant

        if subtotal <= disponible:
            p["subtotal"] = round(subtotal, 2)
            productos_ajustados.append(p)
            disponible -= subtotal
        elif disponible >= costo_u:
            cant_ajustada = int(disponible / costo_u)
            if cant_ajustada >= 1:
                p["cantidad_sugerida"] = cant_ajustada
                p["subtotal"] = round(costo_u * cant_ajustada, 2)
                productos_ajustados.append(p)
                disponible -= p["subtotal"]
        # Si no cabe ni 1 unidad, se omite

    # ── Paso 2: redistribuir sobrante aumentando cantidades ──────────────────
    # Umbral: solo redistribuir si queda más del 5% del presupuesto sin usar
    umbral = presupuesto * 0.05
    if disponible >= umbral and productos_ajustados:
        for p in productos_ajustados:  # ya están ordenados por prioridad
            costo_u = float(p.get("costo_unitario", 0))
            if costo_u <= 0:
                continue
            unidades_extra = int(disponible / costo_u)
            if unidades_extra >= 1:
                p["cantidad_sugerida"] = int(p["cantidad_sugerida"]) + unidades_extra
                p["subtotal"] = round(p["cantidad_sugerida"] * costo_u, 2)
                disponible -= unidades_extra * costo_u
            if disponible < costo_u:
                break  # Ya no entra ni 1 unidad más de nada

    # ── Totales finales ───────────────────────────────────────────────────────
    total_usado = round(presupuesto - disponible, 2)
    cantidad_original = len(productos_ia)
    cantidad_final = len(productos_ajustados)

    resultado["productos"] = productos_ajustados
    resultado["total_estimado"] = total_usado
    resultado["presupuesto_restante"] = round(max(disponible, 0), 2)

    # Si se eliminaron productos por presupuesto, avisar en el resumen
    if cantidad_final < cantidad_original:
        nota = (
            f" ⚠️ Nota: el análisis inicial identificó {cantidad_original} productos, "
            f"pero se muestran {cantidad_final} luego de ajustar al presupuesto disponible. "
            f"Los de menor prioridad fueron excluidos o reducidos para no superar el límite."
        )
        resultado["resumen_ia"] = resultado.get("resumen_ia", "") + nota
        if not resultado.get("alerta_presupuesto"):
            resultado["alerta_presupuesto"] = (
                f"Presupuesto ajustado: se muestran {cantidad_final} de "
                f"{cantidad_original} productos sugeridos originalmente."
            )

    return resultado


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

    # ── Ajuste de seguridad: garantizar que el total no supere el presupuesto ──
    resultado = _ajustar_al_presupuesto(resultado, float(body.presupuesto_disponible))

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
