import base64
import json
from decimal import Decimal
import httpx

from app.config import settings
from app.schemas import FacturaIAResponse, FacturaItemIA


# Prompt mejorado basado en las facturas reales del proveedor PORT FREIGHT / Mix It Up.
# El proveedor usa un formato: MARCA - DESCRIPCION_ABREVIADA TAMANIO
# Ejemplos reales:
#   STAR - CREA MONO dpk X 300 Gr  →  Creatina monohidrato Star Nutrition 300gr
#   STAR - COLLAGEN PLUS LIMON 360GR  →  Colageno Plus Star Nutrition Limon 360gr
#   ENA - PROTEIN BAR FRUTILLA BR 16 U CT  →  Barra de proteina Ena Frutilla
#   GOLD - CREATINA MONOHIDRATO 300 GR S  →  Creatina monohidrato Gold Nutrition 300gr
#   STAR - PLAT WHEY PR VA X 2LB  →  Whey Protein Star Nutrition Vainilla 2lb
#   ENA - WHEY PROTEIN TRUEMADE CHOCOLATE 2 L  →  Whey Protein Ena Chocolate 2lb

PROMPT_FACTURA = """
Analizá esta factura o nota de pedido de suplementos deportivos.
Extraé todos los productos con sus cantidades y precios unitarios.

El proveedor usa abreviaciones. Aquí las más comunes para que puedas interpretarlas:
- STAR = Star Nutrition (marca)
- GOLD = Gold Nutrition (marca)  
- ENA = Ena (marca)
- CREA MONO = Creatina monohidrato
- COLLAGEN PLUS = Colageno Plus
- COLLAGEN SPORT = Colageno Sport
- WHEY PR / WHEY PROTEIN = Whey Protein
- PLAT WHEY = Platinum Whey Protein
- PROTEIN BAR / PR BAR = Barra de proteina
- TRUEMADE = variante del producto (ignorar en la descripción normalizada)
- dpk = display pack (ignorar)
- BR = blister (ignorar)
- U CT / U = unidades (ignorar)
- CH = Chocolate
- VA = Vainilla
- C&C = Cookies and Cream
- FR / FRUTILLA = Frutilla
- LIM / LIMON = Limon
- NAR / NARANJA = Naranja
- 2LB / 2 L = 2 libras (tamaño)
- 300 GR / 300 Gr = 300 gramos (tamaño)
- 360GR / 360 G R = 360 gramos (tamaño)
- S al final = Sin sabor / Neutro

IGNORAR completamente items que sean gastos de envío o servicios (ej: "COSTO DE ENVIO").

Respondé ÚNICAMENTE con un JSON válido con este formato exacto, sin texto adicional:
{
  "items": [
    {
      "descripcion": "nombre normalizado del producto (marca + tipo + sabor + tamaño)",
      "descripcion_original": "texto exacto como aparece en la factura",
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
- En "descripcion" usá el nombre normalizado (ej: "Creatina monohidrato Star Nutrition Neutro 300gr")
- En "descripcion_original" copiá el texto exacto de la factura
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
            "maxOutputTokens": 2000,
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
                descripcion=item.get("descripcion") or item.get("descripcion_original") or "Producto sin nombre",
                descripcion_original=item.get("descripcion_original"),
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
