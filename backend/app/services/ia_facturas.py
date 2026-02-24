import base64
import json
from decimal import Decimal
from typing import Optional
from openai import AsyncOpenAI

from app.config import settings
from app.schemas import FacturaIAResponse, CompraItemCreate


def get_client():
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

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


async def procesar_factura_con_ia(
    contenido: bytes,
    content_type: str
) -> FacturaIAResponse:
    """
    Envía la imagen/PDF a GPT-4o Vision y parsea la respuesta.
    Devuelve FacturaIAResponse con los items detectados.
    """
    # Encodear a base64
    imagen_b64 = base64.standard_b64encode(contenido).decode("utf-8")

    # Para PDF, usamos el primer approach de imagen
    # Si es PDF habría que convertir a imagen primero (Pillow/pdf2image)
    if content_type == "application/pdf":
        media_type = "image/jpeg"  # Railway: usar pdf2image si se necesita
    else:
        media_type = content_type

    client = get_client()
    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1500,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{imagen_b64}",
                            "detail": "high"
                        }
                    },
                    {
                        "type": "text",
                        "text": PROMPT_FACTURA
                    }
                ]
            }
        ]
    )

    texto = response.choices[0].message.content.strip()

    # Limpiar posibles backticks de markdown
    if texto.startswith("```"):
        texto = texto.split("```")[1]
        if texto.startswith("json"):
            texto = texto[4:]

    datos = json.loads(texto)

    # Construir respuesta — los variante_id se dejan en 0
    # El frontend los matchea manualmente antes de confirmar
    items = []
    for item in datos.get("items", []):
        if item.get("cantidad") and item.get("precio_unitario"):
            items.append(
                CompraItemCreate(
                    variante_id=0,  # el usuario los asigna en el frontend
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
