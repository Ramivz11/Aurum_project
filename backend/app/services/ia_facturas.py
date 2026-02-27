import base64
import json
import logging
from decimal import Decimal
import httpx

from app.config import settings
from app.schemas import FacturaIAResponse, FacturaItemIA

logger = logging.getLogger(__name__)

PROMPT_FACTURA = """
Analizá esta factura o remito de compra de suplementos deportivos.
Extraé todos los productos con sus cantidades y precios unitarios.

Respondé ÚNICAMENTE con un JSON válido con este formato exacto, sin texto adicional:
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
- cantidad siempre es entero
- precio_unitario siempre en ARS (pesos argentinos), sin símbolo $, puede ser 0 si no se ve
- confianza entre 0 y 1 según qué tan legible está la factura
- Si no podés leer un dato, usá 0 para el precio o 1 para la cantidad
"""

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "mistralai/mistral-small-3.1-24b-instruct:free"
async def procesar_factura_con_ia(contenido: bytes, content_type: str) -> FacturaIAResponse:
    if not settings.GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY no configurada. Agregá la variable de entorno en Railway.")

    imagen_b64 = base64.standard_b64encode(contenido).decode("utf-8")

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{content_type};base64,{imagen_b64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": PROMPT_FACTURA
                    }
                ]
            }
        ],
        "max_tokens": 1500,
        "temperature": 0.1,
    }

    headers = {
        "Authorization": f"Bearer {settings.GEMINI_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vivacious-truth-production-b827.up.railway.app",
        "X-Title": "Gestion Suplementos",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(OPENROUTER_URL, json=payload, headers=headers)

        if response.status_code == 429:
            logger.error(f"OpenRouter 429: {response.text}")
            raise Exception("Límite de requests alcanzado. Esperá unos segundos e intentá de nuevo.")
        if response.status_code == 401:
            logger.error(f"OpenRouter 401: {response.text}")
            raise Exception("API Key inválida. Verificá la variable GEMINI_API_KEY en Railway.")
        if not response.is_success:
            logger.error(f"OpenRouter error {response.status_code}: {response.text}")
            raise Exception(f"Error del servicio de IA: {response.status_code}")

        data = response.json()

    try:
        texto = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        raise Exception(f"Respuesta inesperada del servicio de IA: {str(data)[:200]}")

    if texto.startswith("```"):
        partes = texto.split("```")
        texto = partes[1] if len(partes) > 1 else texto
        if texto.startswith("json"):
            texto = texto[4:]
    texto = texto.strip()

    try:
        datos = json.loads(texto)
    except json.JSONDecodeError as e:
        raise Exception(f"La IA no devolvió JSON válido: {str(e)}. Texto recibido: {texto[:200]}")

    items = []
    for item in datos.get("items", []):
        cantidad = item.get("cantidad", 1)
        precio = item.get("precio_unitario", 0)
        try:
            cantidad = max(1, int(cantidad))
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
        raise Exception("La IA no detectó ningún producto en la factura. Intentá con una imagen más clara.")

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
