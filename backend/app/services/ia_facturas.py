import base64
import json
import logging
from decimal import Decimal

import anthropic

from app.config import settings
from app.schemas import FacturaIAResponse, FacturaItemIA

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-haiku-4-5-20251001"

PROMPT_FACTURA = """
Analizá esta factura o remito de compra de suplementos deportivos.
Extraé todos los productos con sus cantidades y precios unitarios.

Respondé ÚNICAMENTE con un JSON válido con este formato exacto, sin texto adicional, sin bloques de código:
{
  "items": [
    {
      "descripcion": "nombre del producto tal como aparece en la factura",
      "cantidad": 2,
      "precio_unitario": 15000.00
    }
  ],
  "proveedor": "nombre del proveedor si aparece, o null",
  "total": 30000.00,
  "confianza": 0.9
}

Reglas:
- cantidad siempre es entero positivo
- precio_unitario siempre en ARS (pesos argentinos), sin símbolo $, puede ser 0 si no se ve
- confianza entre 0 y 1 según qué tan legible está la factura
- Si no podés leer un dato, usá 0 para el precio o 1 para la cantidad
- NO incluyas texto antes ni después del JSON
"""


def _limpiar_json(texto: str) -> str:
    """Limpia markdown y extrae JSON puro."""
    texto = texto.strip()
    if "```" in texto:
        partes = texto.split("```")
        for parte in partes:
            parte = parte.strip()
            if parte.startswith("json"):
                parte = parte[4:].strip()
            if parte.startswith("{") and parte.endswith("}"):
                return parte
        if len(partes) > 1:
            parte = partes[1].strip()
            if parte.startswith("json"):
                parte = parte[4:].strip()
            return parte

    if texto.startswith("{"):
        return texto

    inicio = texto.find("{")
    fin = texto.rfind("}")
    if inicio != -1 and fin != -1 and fin > inicio:
        return texto[inicio:fin + 1]

    return texto


async def procesar_factura_con_ia(contenido: bytes, content_type: str) -> FacturaIAResponse:
    if not settings.ANTHROPIC_API_KEY:
        raise Exception(
            "ANTHROPIC_API_KEY no configurada. "
            "Agregá la variable de entorno ANTHROPIC_API_KEY en Railway con tu clave de Anthropic."
        )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    imagen_b64 = base64.standard_b64encode(contenido).decode("utf-8")

    # Normalizar content_type
    if content_type in ("image/jpg", "image/jpeg"):
        media_type = "image/jpeg"
    elif content_type == "image/png":
        media_type = "image/png"
    elif content_type == "image/webp":
        media_type = "image/webp"
    elif content_type == "image/gif":
        media_type = "image/gif"
    elif content_type == "application/pdf":
        media_type = "application/pdf"
    else:
        media_type = content_type

    # Construir el bloque de contenido según el tipo
    if media_type == "application/pdf":
        archivo_bloque = {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": imagen_b64,
            },
        }
    else:
        archivo_bloque = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": imagen_b64,
            },
        }

    try:
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1500,
            messages=[
                {
                    "role": "user",
                    "content": [
                        archivo_bloque,
                        {
                            "type": "text",
                            "text": PROMPT_FACTURA,
                        },
                    ],
                }
            ],
        )
    except anthropic.AuthenticationError:
        raise Exception("ANTHROPIC_API_KEY inválida. Verificá la variable de entorno en Railway.")
    except anthropic.RateLimitError:
        raise Exception("Límite de requests alcanzado. Esperá unos segundos e intentá de nuevo.")
    except anthropic.BadRequestError as e:
        raise Exception(f"La imagen no pudo ser procesada: {str(e)}")
    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        raise Exception(f"Error del servicio de IA: {str(e)}")

    texto = message.content[0].text.strip()
    texto_limpio = _limpiar_json(texto)

    try:
        datos = json.loads(texto_limpio)
    except json.JSONDecodeError as e:
        raise Exception(f"La IA no devolvió JSON válido: {str(e)}. Respuesta: {texto_limpio[:300]}")

    items = []
    for item in datos.get("items", []):
        cantidad = item.get("cantidad", 1)
        precio = item.get("precio_unitario", 0)
        try:
            cantidad = max(1, int(float(str(cantidad))))
            precio = Decimal(str(precio)) if precio else Decimal("0")
        except Exception:
            cantidad = 1
            precio = Decimal("0")

        items.append(
            FacturaItemIA(
                descripcion=item.get("descripcion") or "Producto sin nombre",
                cantidad=cantidad,
                costo_unitario=precio,
            )
        )

    if not items:
        raise Exception("La IA no detectó ningún producto. Intentá con una imagen más clara o mejor iluminada.")

    total = None
    if datos.get("total"):
        try:
            total = Decimal(str(datos["total"]))
        except Exception:
            pass

    return FacturaIAResponse(
        items_detectados=items,
        proveedor_detectado=datos.get("proveedor"),
        total_detectado=total,
        confianza=float(datos.get("confianza", 0.5)),
    )
