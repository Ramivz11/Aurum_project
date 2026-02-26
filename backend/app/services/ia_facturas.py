import asyncio
import json
import re
from decimal import Decimal, InvalidOperation
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError

from app.config import settings
from app.schemas import FacturaIAResponse, FacturaItemIA


# ─── Modelos Pydantic para validar la respuesta de Gemini ────────────────────

class _ItemFacturaIA(BaseModel):
    descripcion: str = "Producto sin nombre"
    cantidad: int = Field(default=1, ge=1)
    precio_unitario: Decimal = Decimal("0")

    @field_validator("descripcion", mode="before")
    @classmethod
    def limpiar_descripcion(cls, v):
        return str(v).strip() if v else "Producto sin nombre"

    @field_validator("cantidad", mode="before")
    @classmethod
    def coerce_cantidad(cls, v):
        try:
            return max(1, int(float(str(v))))
        except (ValueError, TypeError):
            return 1

    @field_validator("precio_unitario", mode="before")
    @classmethod
    def coerce_precio(cls, v):
        """
        Maneja todos los formatos de precio que puede devolver la IA:
          - 15000         -> 15000
          - 15000.00      -> 15000.00
          - "15.000,50"   -> 15000.50  (formato ARS: punto de miles, coma decimal)
          - "15,000.50"   -> 15000.50  (formato ingles)
          - "$15.000"     -> 15000
          - None / ""     -> 0
        """
        if v is None or v == "":
            return Decimal("0")
        texto = str(v).strip().replace("$", "").replace(" ", "")
        # Formato argentino: punto como miles, coma como decimal -> "15.000,50"
        if re.match(r"^\d{1,3}(\.\d{3})+(,\d+)?$", texto):
            texto = texto.replace(".", "").replace(",", ".")
        # Coma como decimal sin puntos de miles -> "15000,50"
        elif re.match(r"^\d+(,\d{1,2})$", texto):
            texto = texto.replace(",", ".")
        try:
            result = Decimal(texto)
            return result if result >= 0 else Decimal("0")
        except InvalidOperation:
            return Decimal("0")


class _RespuestaFacturaIA(BaseModel):
    items: list[_ItemFacturaIA] = []
    proveedor: Optional[str] = None
    total: Optional[Decimal] = None
    confianza: float = 0.5

    @field_validator("confianza", mode="before")
    @classmethod
    def clamp_confianza(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (ValueError, TypeError):
            return 0.5

    @field_validator("total", mode="before")
    @classmethod
    def coerce_total(cls, v):
        if not v:
            return None
        texto = str(v).strip().replace("$", "").replace(" ", "")
        if re.match(r"^\d{1,3}(\.\d{3})+(,\d+)?$", texto):
            texto = texto.replace(".", "").replace(",", ".")
        elif re.match(r"^\d+(,\d{1,2})$", texto):
            texto = texto.replace(",", ".")
        try:
            result = Decimal(texto)
            return result if result > 0 else None
        except InvalidOperation:
            return None

    @field_validator("proveedor", mode="before")
    @classmethod
    def limpiar_proveedor(cls, v):
        if not v or str(v).lower() in ("null", "none", ""):
            return None
        return str(v).strip()


# ─── Prompt ───────────────────────────────────────────────────────────────────

PROMPT_FACTURA = """
Analiza esta factura o remito de compra de suplementos deportivos.
Extrae todos los productos con sus cantidades y precios unitarios.

Devuelve un JSON con este formato:
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
- precio_unitario en ARS (pesos argentinos), como numero sin simbolo $
- confianza entre 0 y 1 segun que tan legible esta la factura
- Si no podes leer un dato, usa 0 para el precio o 1 para la cantidad
"""

# ─── Modelos Gemini ───────────────────────────────────────────────────────────

GEMINI_MODELS = [
    "gemini-1.5-flash",       # Mas estable y economico para OCR
    "gemini-2.0-flash-exp",   # Experimental, puede ser inestable
]


# ─── Parseo con Pydantic ──────────────────────────────────────────────────────

def _parsear_resultado(texto: str, model: str) -> FacturaIAResponse:
    try:
        datos = json.loads(texto)
    except json.JSONDecodeError as e:
        raise Exception(
            f"JSON invalido ({model}): {e}. Respuesta: {texto[:300]}"
        )

    try:
        parsed = _RespuestaFacturaIA.model_validate(datos)
    except Exception as e:
        raise Exception(
            f"Error validando estructura de la respuesta ({model}): {e}"
        )

    if not parsed.items:
        raise Exception(
            "La IA no detecto ningun producto. "
            "Intenta con una imagen mas clara o mejor iluminada."
        )

    return FacturaIAResponse(
        items_detectados=[
            FacturaItemIA(
                descripcion=item.descripcion,
                cantidad=item.cantidad,
                costo_unitario=item.precio_unitario,
            )
            for item in parsed.items
        ],
        proveedor_detectado=parsed.proveedor,
        total_detectado=parsed.total,
        confianza=parsed.confianza,
    )


# ─── Función principal ────────────────────────────────────────────────────────

async def procesar_factura_con_ia(contenido: bytes, content_type: str) -> FacturaIAResponse:
    if not settings.GEMINI_API_KEY:
        raise Exception(
            "GEMINI_API_KEY no configurada. "
            "Agrega la variable de entorno GEMINI_API_KEY en Railway con tu clave de Google AI Studio."
        )

    mime_map = {
        "image/jpg": "image/jpeg",
        "image/jpeg": "image/jpeg",
        "image/png": "image/png",
        "image/webp": "image/webp",
        "application/pdf": "application/pdf",
    }
    mime_type = mime_map.get(content_type, content_type)

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    ultimo_error = None
    hubo_rate_limit = False

    for i, model in enumerate(GEMINI_MODELS):
        try:
            if hubo_rate_limit and i > 0:
                await asyncio.sleep(5)

            response = await client.aio.models.generate_content(
                model=model,
                contents=[
                    types.Part.from_bytes(data=contenido, mime_type=mime_type),
                    PROMPT_FACTURA,
                ],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=2000,
                    response_mime_type="application/json",
                ),
            )

            if not response.candidates:
                feedback = getattr(response, "prompt_feedback", None)
                block = getattr(feedback, "block_reason", None) if feedback else None
                if block:
                    raise Exception(
                        f"Solicitud bloqueada por Gemini: {block}. "
                        "Intenta con una imagen mas clara."
                    )
                raise Exception("Gemini no devolvio respuesta. Intenta de nuevo.")

            candidate = response.candidates[0]
            finish = getattr(candidate, "finish_reason", None)
            if finish and str(finish) == "SAFETY":
                raise Exception(
                    "La imagen fue bloqueada por filtros de seguridad. "
                    "Intenta con otra imagen."
                )

            return _parsear_resultado(response.text, model)

        except ClientError as e:
            msg = str(e)
            if "API_KEY" in msg or "PERMISSION" in msg or "403" in msg:
                raise Exception(
                    "API Key de Gemini invalida o sin permisos. "
                    "Verifica la variable GEMINI_API_KEY en Railway."
                )
            if "404" in msg or "not found" in msg.lower():
                ultimo_error = Exception(f"Modelo {model} no disponible")
                continue
            if "429" in msg or "QUOTA" in msg or "RESOURCE_EXHAUSTED" in msg:
                hubo_rate_limit = True
                ultimo_error = Exception(
                    f"Limite de requests alcanzado en {model}. "
                    "Considera usar una API key de pago en Google AI Studio para mayor volumen."
                )
                continue
            ultimo_error = Exception(f"Error en {model}: {msg}")
            continue

        except APIError as e:
            ultimo_error = Exception(f"Error de API Gemini ({model}): {str(e)}")
            continue

        except Exception as e:
            msg = str(e)
            if any(x in msg for x in ["invalida", "permisos", "API Key", "bloqueada"]):
                raise
            ultimo_error = e
            continue

    if hubo_rate_limit:
        raise Exception(
            "Se alcanzo el limite de requests en todos los modelos. "
            "La clave gratuita permite ~15 requests por minuto. "
            "Espera 1 minuto e intenta de nuevo, o usa una API key de pago."
        )

    raise Exception(
        str(ultimo_error) if ultimo_error else "Error desconocido al procesar la factura"
    )
