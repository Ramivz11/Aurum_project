import json
from decimal import Decimal

from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError

from app.config import settings
from app.schemas import FacturaIAResponse, FacturaItemIA


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

# Modelos a intentar en orden de preferencia
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]


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
        return texto[inicio:fin+1]
    return texto


def _parsear_resultado(texto: str, model: str) -> FacturaIAResponse:
    """Parsea el JSON devuelto por Gemini y lo convierte en FacturaIAResponse."""
    texto_limpio = _limpiar_json(texto)
    try:
        datos = json.loads(texto_limpio)
    except json.JSONDecodeError as e:
        raise Exception(
            f"La IA no devolvió JSON válido ({model}): {str(e)}. "
            f"Respuesta: {texto_limpio[:300]}"
        )

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

        items.append(FacturaItemIA(
            descripcion=item.get("descripcion") or "Producto sin nombre",
            cantidad=cantidad,
            costo_unitario=precio,
        ))

    if not items:
        raise Exception(
            "La IA no detectó ningún producto. "
            "Intentá con una imagen más clara o mejor iluminada."
        )

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


async def procesar_factura_con_ia(contenido: bytes, content_type: str) -> FacturaIAResponse:
    if not settings.GEMINI_API_KEY:
        raise Exception(
            "GEMINI_API_KEY no configurada. "
            "Agregá la variable de entorno GEMINI_API_KEY en Railway con tu clave de Google AI Studio."
        )

    # Normalizar mime type
    mime_map = {
        "image/jpg": "image/jpeg",
        "image/jpeg": "image/jpeg",
        "image/png": "image/png",
        "image/webp": "image/webp",
        "application/pdf": "application/pdf",
    }
    mime_type = mime_map.get(content_type, content_type)

    # Crear cliente con la API key
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    ultimo_error = None
    for model in GEMINI_MODELS:
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=[
                    types.Part.from_bytes(data=contenido, mime_type=mime_type),
                    PROMPT_FACTURA,
                ],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=2000,
                ),
            )

            # Verificar si fue bloqueado
            if not response.candidates:
                feedback = getattr(response, "prompt_feedback", None)
                block = getattr(feedback, "block_reason", None) if feedback else None
                if block:
                    raise Exception(
                        f"La solicitud fue bloqueada por Gemini: {block}. "
                        "Intentá con una imagen más clara."
                    )
                raise Exception("Gemini no devolvió respuesta. Intentá de nuevo.")

            candidate = response.candidates[0]
            finish = getattr(candidate, "finish_reason", None)
            if finish and str(finish) == "SAFETY":
                raise Exception(
                    "La imagen fue bloqueada por filtros de seguridad. "
                    "Intentá con otra imagen."
                )

            texto = response.text
            return _parsear_resultado(texto, model)

        except ClientError as e:
            # Errores del cliente: API key inválida, modelo no disponible, etc.
            msg = str(e)
            if "API_KEY" in msg or "PERMISSION" in msg or "403" in msg:
                raise Exception(
                    "API Key de Gemini inválida o sin permisos. "
                    "Verificá la variable GEMINI_API_KEY en Railway."
                )
            if "404" in msg or "not found" in msg.lower():
                ultimo_error = Exception(f"Modelo {model} no disponible")
                continue  # Probar el siguiente modelo
            if "429" in msg or "QUOTA" in msg:
                raise Exception(
                    "Límite de requests de Gemini alcanzado. "
                    "Esperá unos segundos e intentá de nuevo."
                )
            ultimo_error = Exception(f"Error en {model}: {msg}")
            continue

        except APIError as e:
            ultimo_error = Exception(f"Error de API Gemini ({model}): {str(e)}")
            continue

        except Exception as e:
            msg = str(e)
            # Errores fatales: no seguir probando modelos
            if any(x in msg for x in ["inválida", "permisos", "API Key", "alcanzado", "bloqueada"]):
                raise
            ultimo_error = e
            continue

    raise Exception(
        str(ultimo_error) if ultimo_error else "Error desconocido al procesar la factura"
    )
