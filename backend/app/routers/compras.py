from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from decimal import Decimal

from app.database import get_db
from app.models import Compra, CompraItem, Variante, StockSucursal, Transferencia, TipoTransferenciaEnum
from app.schemas import CompraCreate, CompraCreateConDistribucion, CompraResponse, FacturaIAResponse
from app.services.ia_facturas import procesar_factura_con_ia

router = APIRouter(prefix="/compras", tags=["Compras"])


def _sumar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad += cantidad
    else:
        ss = StockSucursal(variante_id=variante_id, sucursal_id=sucursal_id, cantidad=cantidad)
        db.add(ss)


def _restar_stock_sucursal(db: Session, variante_id: int, sucursal_id: int, cantidad: int):
    ss = db.query(StockSucursal).filter(
        StockSucursal.variante_id == variante_id,
        StockSucursal.sucursal_id == sucursal_id
    ).first()
    if ss:
        ss.cantidad = max(0, ss.cantidad - cantidad)


@router.get("", response_model=List[CompraResponse])
def listar_compras(
    sucursal_id: Optional[int] = Query(None),
    proveedor: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Compra)
    if sucursal_id:
        query = query.filter(Compra.sucursal_id == sucursal_id)
    if proveedor:
        query = query.filter(Compra.proveedor.ilike(f"%{proveedor}%"))
    return query.order_by(Compra.fecha.desc()).all()


@router.get("/{compra_id}", response_model=CompraResponse)
def obtener_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


@router.post("", response_model=CompraResponse, status_code=201)
def registrar_compra(data: CompraCreateConDistribucion, db: Session = Depends(get_db)):
    compra = Compra(
        proveedor=data.proveedor,
        sucursal_id=data.sucursal_id,
        metodo_pago=data.metodo_pago,
        notas=data.notas,
    )
    db.add(compra)
    db.flush()

    total = Decimal("0")
    for item_data in data.items:
        variante = db.query(Variante).filter(Variante.id == item_data.variante_id).first()
        if not variante:
            raise HTTPException(status_code=404, detail=f"Variante {item_data.variante_id} no encontrada")

        subtotal = item_data.costo_unitario * item_data.cantidad
        total += subtotal

        item = CompraItem(
            compra_id=compra.id,
            variante_id=item_data.variante_id,
            cantidad=item_data.cantidad,
            costo_unitario=item_data.costo_unitario,
            subtotal=subtotal,
        )
        db.add(item)
        variante.costo = item_data.costo_unitario

        # Distribuir stock
        total_distribuido = sum(d.cantidad for d in item_data.distribucion)
        if total_distribuido > item_data.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"La distribución ({total_distribuido}) supera la cantidad comprada ({item_data.cantidad})"
            )

        # Lo que va a central = total - distribuido a sucursales
        a_central = item_data.cantidad - total_distribuido
        if a_central > 0:
            variante.stock_actual += a_central

        # Distribuir a sucursales
        for dist in item_data.distribucion:
            if dist.cantidad > 0:
                _sumar_stock_sucursal(db, variante.id, dist.sucursal_id, dist.cantidad)
                # Registrar transferencia
                db.add(Transferencia(
                    variante_id=variante.id,
                    tipo=TipoTransferenciaEnum.central_a_sucursal,
                    sucursal_origen_id=None,
                    sucursal_destino_id=dist.sucursal_id,
                    cantidad=dist.cantidad,
                    notas=f"Distribución de compra #{compra.id}",
                ))

    compra.total = total
    db.commit()
    db.refresh(compra)
    return compra


@router.put("/{compra_id}", response_model=CompraResponse)
def actualizar_compra(compra_id: int, data: CompraCreateConDistribucion, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    # Revertir stock de items anteriores: central y todas las sucursales
    for item in compra.items:
        # Revertir central
        item.variante.stock_actual = max(0, item.variante.stock_actual - item.cantidad)
        # Revertir sucursales (descontar lo distribuido)
        for ss in item.variante.stocks_sucursal:
            ss.cantidad = max(0, ss.cantidad - item.cantidad)
        db.delete(item)

    db.flush()

    compra.proveedor = data.proveedor
    compra.metodo_pago = data.metodo_pago
    compra.notas = data.notas

    total = Decimal("0")
    for item_data in data.items:
        variante = db.query(Variante).filter(Variante.id == item_data.variante_id).first()
        if not variante:
            raise HTTPException(status_code=404, detail=f"Variante {item_data.variante_id} no encontrada")

        subtotal = item_data.costo_unitario * item_data.cantidad
        total += subtotal

        item = CompraItem(
            compra_id=compra.id,
            variante_id=item_data.variante_id,
            cantidad=item_data.cantidad,
            costo_unitario=item_data.costo_unitario,
            subtotal=subtotal,
        )
        db.add(item)
        variante.costo = item_data.costo_unitario

        total_distribuido = sum(d.cantidad for d in item_data.distribucion)
        a_central = item_data.cantidad - total_distribuido
        if a_central > 0:
            variante.stock_actual += a_central

        for dist in item_data.distribucion:
            if dist.cantidad > 0:
                _sumar_stock_sucursal(db, variante.id, dist.sucursal_id, dist.cantidad)

    compra.total = total
    db.commit()
    db.refresh(compra)
    return compra


@router.delete("/{compra_id}", status_code=204)
def eliminar_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(Compra).filter(Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    for item in compra.items:
        # Revertir stock central
        item.variante.stock_actual = max(0, item.variante.stock_actual - item.cantidad)
        # Revertir stock en sucursales
        for ss in item.variante.stocks_sucursal:
            ss.cantidad = max(0, ss.cantidad - item.cantidad)

    db.delete(compra)
    db.commit()


# ─── MÓDULO IA ────────────────────────────────────────────────────────────────

@router.post("/ia/factura", response_model=FacturaIAResponse)
async def analizar_factura_con_ia(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not archivo.content_type.startswith(("image/", "application/pdf")):
        raise HTTPException(status_code=400, detail="Solo se aceptan imágenes o PDF")
    contenido = await archivo.read()
    try:
        resultado = await procesar_factura_con_ia(contenido, archivo.content_type)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    return resultado


@router.get("/ia/diagnostico")
async def diagnostico_ia():
    """Verifica el estado de la configuración de IA usando el SDK oficial de Google."""
    from google import genai
    from google.genai.errors import ClientError
    from app.config import settings
    from app.services.ia_facturas import GEMINI_MODELS

    key = settings.GEMINI_API_KEY
    if not key:
        return {
            "estado": "error",
            "problema": "GEMINI_API_KEY no configurada en las variables de entorno de Railway.",
            "solucion": "Agregá GEMINI_API_KEY en Railway → Variables con tu clave de Google AI Studio (aistudio.google.com)."
        }

    client = genai.Client(api_key=key)
    resultados_modelos = []

    for model in GEMINI_MODELS:
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=["Respondé solo con: OK"],
            )
            if response.text:
                resultados_modelos.append({"modelo": model, "estado": "✅ disponible"})
            else:
                resultados_modelos.append({"modelo": model, "estado": "⚠️ sin respuesta"})
        except ClientError as e:
            msg = str(e)
            if "API_KEY" in msg or "PERMISSION" in msg or "403" in msg:
                resultados_modelos.append({"modelo": model, "estado": "❌ API key inválida o sin permisos"})
                break
            elif "404" in msg or "not found" in msg.lower():
                resultados_modelos.append({"modelo": model, "estado": "⚠️ modelo no disponible"})
            elif "429" in msg or "QUOTA" in msg:
                resultados_modelos.append({"modelo": model, "estado": "⚠️ límite de requests alcanzado"})
                break
            else:
                resultados_modelos.append({"modelo": model, "estado": f"❌ {msg[:80]}"})
        except Exception as e:
            resultados_modelos.append({"modelo": model, "estado": f"❌ {str(e)[:80]}"})

    disponibles = [m for m in resultados_modelos if "✅" in m["estado"]]
    return {
        "estado": "ok" if disponibles else "error",
        "api_key_configurada": True,
        "api_key_preview": f"{key[:8]}...{key[-4:]}",
        "modelos": resultados_modelos,
        "conclusion": (
            f"{len(disponibles)} de {len(GEMINI_MODELS)} modelos disponibles."
            if disponibles else
            "Ningún modelo disponible. Verificá la API key."
        )
    }
