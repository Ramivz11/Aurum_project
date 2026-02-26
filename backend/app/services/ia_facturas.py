import base64
import json
from decimal import Decimal
import httpx

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
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash-exp",
]


async def _llamar_gemini(model: str, imagen_b64: str, mime_type: str, api_key: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
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

    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(url, json=payload)
        
        if response.status_code == 404:
            raise Exception(f"Modelo {model} no disponible")
        if response.status_code == 429:
            raise Exception("Límite de requests de Gemini alcanzado. Esperá unos segundos e intentá de nuevo.")
        if response.status_code == 400:
            detail = response.json().get("error", {}).get("message", "Request inválido")
            raise Exception(f"Error 400: {detail}")
        if response.status_code == 403:
            raise Exception("API Key de Gemini inválida o sin permisos. Verificá la variable GEMINI_API_KEY en Railway.")
        if not response.is_success:
            raise Exception(f"Gemini respondió con error {response.status_code}: {response.text[:300]}")
        
        return response.json()


def _extraer_texto(data: dict) -> str:
    """Extrae el texto de la respuesta de Gemini, manejando bloqueos de seguridad."""
    candidates = data.get("candidates", [])
    if not candidates:
        # Verificar si fue bloqueado por seguridad
        prompt_feedback = data.get("promptFeedback", {})
        block_reason = prompt_feedback.get("blockReason")
        if block_reason:
            raise Exception(f"La solicitud fue bloqueada por Gemini: {block_reason}. Intentá con una imagen más clara.")
        raise Exception(f"Respuesta de Gemini sin candidatos: {str(data)[:200]}")
    
    candidate = candidates[0]
    
    # Verificar finish reason
    finish_reason = candidate.get("finishReason", "")
    if finish_reason == "SAFETY":
        raise Exception("La imagen fue bloqueada por filtros de seguridad. Intentá con otra imagen.")
    if finish_reason == "RECITATION":
        raise Exception("Error de recitación en Gemini. Intentá de nuevo.")
    
    try:
        return candidate["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        raise Exception(f"Formato de respuesta inesperado: {str(data)[:300]}")


def _limpiar_json(texto: str) -> str:
    """Limpia markdown y extrae JSON puro."""
    texto = texto.strip()
    # Eliminar bloques de código markdown
    if "```" in texto:
        partes = texto.split("```")
        for parte in partes:
            parte = parte.strip()
            if parte.startswith("json"):
                parte = parte[4:].strip()
            if parte.startswith("{") and parte.endswith("}"):
                return parte
        # Fallback: tomar la parte entre los primeros ```
        if len(partes) > 1:
            parte = partes[1].strip()
            if parte.startswith("json"):
                parte = parte[4:].strip()
            return parte
    
    # Si empieza con { directamente
    if texto.startswith("{"):
        return texto
    
    # Buscar el primer { y el último }
    inicio = texto.find("{")
    fin = texto.rfind("}")
    if inicio != -1 and fin != -1 and fin > inicio:
        return texto[inicio:fin+1]
    
    return texto


async def procesar_factura_con_ia(contenido: bytes, content_type: str) -> FacturaIAResponse:
    if not settings.GEMINI_API_KEY:
        raise Exception(
            "GEMINI_API_KEY no configurada. "
            "Agregá la variable de entorno GEMINI_API_KEY en Railway con tu clave de Google AI Studio."
        )

    imagen_b64 = base64.standard_b64encode(contenido).decode("utf-8")

    # Normalizar mime type
    if content_type == "application/pdf":
        mime_type = "application/pdf"
    elif content_type in ("image/jpg", "image/jpeg"):
        mime_type = "image/jpeg"
    elif content_type == "image/png":
        mime_type = "image/png"
    elif content_type == "image/webp":
        mime_type = "image/webp"
    else:
        mime_type = content_type

    # Intentar con cada modelo
    ultimo_error = None
    for model in GEMINI_MODELS:
        try:
            data = await _llamar_gemini(model, imagen_b64, mime_type, settings.GEMINI_API_KEY)
            texto = _extraer_texto(data)
            texto_limpio = _limpiar_json(texto)
            
            try:
                datos = json.loads(texto_limpio)
            except json.JSONDecodeError as e:
                raise Exception(f"La IA no devolvió JSON válido ({model}): {str(e)}. Respuesta: {texto_limpio[:300]}")
            
            # Parsear items
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

        except Exception as e:
            ultimo_error = e
            error_msg = str(e)
            # Si es error de autenticación o límite, no intentar otros modelos
            if any(x in error_msg for x in ["inválida", "permisos", "API Key", "alcanzado", "bloqueada"]):
                break
            # Si es 404 (modelo no disponible), intentar el siguiente
            continue

    raise Exception(str(ultimo_error) if ultimo_error else "Error desconocido al procesar la factura")
