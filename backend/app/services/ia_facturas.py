import base64
import json
from decimal import Decimal
import httpx

from app.config import settings
from app.schemas import FacturaIAResponse, CompraItemCreate


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
- precio_unitario siempre en ARS (pesos argentinos), sin símbolo $
- confianza entre 0 y 1 según qué tan legible está la factura
- Si no podés leer un dato, omitilo del item
"""


async def procesar_factura_con_ia(contenido: bytes, content_type: str) -> FacturaIAResponse:
    imagen_b64 = base64.standard_b64encode(contenido).decode("utf-8")

    if content_type == "application/pdf":
        mime_type = "application/pdf"
    else:
        mime_type = content_type

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.GEMINI_API_KEY}"

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": imagen_b64
                        }
                    },
                    {
                        "text": PROMPT_FACTURA
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 1500,
        }
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    texto = data["candidates"][0]["content"]["parts"][0]["text"].strip()

    if texto.startswith("```"):
        texto = texto.split("```")[1]
        if texto.startswith("json"):
            texto = texto[4:]

    datos = json.loads(texto)

    items = []
    for item in datos.get("items", []):
        if item.get("cantidad") and item.get("precio_unitario"):
            items.append(
                CompraItemCreate(
                    variante_id=0,
                    cantidad=int(item["cantidad"]),
                    costo_unitario=Decimal(str(item["precio_unitario"]))
                )
            )

    return FacturaIAResponse(
        items_detectados=items,
        proveedor_detectado=datos.get("proveedor"),
        total_detectado=Decimal(str(datos["total"])) if datos.get("total") else None,
        confianza=float(datos.get("confianza", 0.5)),
    )