import base64
import json
from decimal import Decimal
import httpx

from app.config import settings
from app.schemas import FacturaIAResponse, FacturaItemIA


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


async def procesar_factura_con_ia(contenido: bytes, content_type: str) -> FacturaIAResponse:
    if not settings.GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY no configurada. Agregá la variable de entorno en Railway.")

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
        if response.status_code == 429:
            raise Exception("Límite de requests de Gemini alcanzado. Esperá unos segundos e intentá de nuevo.")
        if response.status_code == 400:
            detail = response.json().get("error", {}).get("message", "Request inválido a Gemini")
            raise Exception(f"Error Gemini 400: {detail}")
        if response.status_code == 403:
            raise Exception("API Key de Gemini inválida o sin permisos. Verificá la variable GEMINI_API_KEY en Railway.")
        if not response.is_success:
            raise Exception(f"Gemini respondió con error {response.status_code}: {response.text[:200]}")
        data = response.json()

    # Extraer texto de la respuesta
    try:
        texto = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError) as e:
        raise Exception(f"Respuesta de Gemini inesperada: {str(data)[:200]}")

    # Limpiar markdown si viene con ```json ... ```
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