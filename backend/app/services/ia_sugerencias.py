"""
Servicio de IA — Sugerencia de Compra Inteligente.

Responsabilidades:
  • Construir el prompt inyectando datos de inventario + reglas de negocio de la DB.
  • Llamar a Anthropic (Claude) y forzar respuesta JSON.
  • Parsear / validar la respuesta y devolver un DTO tipado.
"""

import json
import logging
from decimal import Decimal
from typing import Any

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-haiku-4-5-20251001"


def _get_client() -> anthropic.Anthropic:
    """Inicializa y devuelve el cliente de Anthropic.  Lanza si falta la key."""
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY no configurada. "
            "Agregá la variable de entorno ANTHROPIC_API_KEY."
        )
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _build_prompt(
    presupuesto: Decimal,
    config: dict,
    inventario: list[dict],
) -> str:
    """
    Construye el prompt de sistema + usuario para Claude.

    `config`     — diccionario con las reglas de negocio de `configuraciones_erp`.
    `inventario` — lista de dicts con datos por variante (stock, costo, velocidad).
    """

    reglas = (
        f"- Lead Time del proveedor: {config['dias_demora_proveedor']} días.\n"
        f"- Stock de seguridad: {config['dias_stock_seguridad']} días de cobertura mínima.\n"
        f"- Ventana de análisis de ventas: últimos {config['ventana_dias_analisis_ventas']} días.\n"
        f"- Producto estrella: ≥ {config['umbral_ventas_producto_estrella']} unidades vendidas en la ventana.\n"
    )

    inventario_json = json.dumps(inventario, ensure_ascii=False, default=str)

    return f"""Sos un analista de compras experto en suplementos deportivos.
Tu objetivo es sugerir qué productos reponer para un negocio llamado "Aurum Suplementos"
dado un presupuesto de ${presupuesto:,.2f} ARS.

## REGLAS DE NEGOCIO (obtenidas de la base de datos del ERP)
{reglas}

## DATOS DE INVENTARIO (stock actual, costo unitario, velocidad de ventas diaria)
{inventario_json}

## INSTRUCCIONES
1. Calculá los "días de cobertura" de cada variante: stock_actual / velocidad_diaria.
2. Un producto con cobertura menor a (lead_time + stock_seguridad) está en RIESGO de quiebre.
3. Priorizá los productos según:
   - "critico": cobertura < lead_time  (ya se va a quedar sin stock antes de que llegue la reposición)
   - "alto": cobertura < lead_time + stock_seguridad
   - "medio": producto estrella con cobertura < 2× (lead_time + stock_seguridad)
   - "bajo": resto que convenga reponer
4. Calculá la cantidad sugerida para llevar cada producto a al menos (lead_time + stock_seguridad) × velocidad_diaria.
5. NO superes el presupuesto total de ${presupuesto:,.2f} ARS.
6. Si el presupuesto no alcanza para cubrir todos los quiebres críticos, incluí una alerta en "alerta_presupuesto".

## FORMATO DE RESPUESTA
Respondé ÚNICAMENTE con un JSON válido (sin texto extra, sin bloques de código) con esta estructura exacta:
{{
  "productos": [
    {{
      "variante_id": 123,
      "producto": "nombre del producto",
      "sabor": "sabor o null",
      "tamanio": "tamaño o null",
      "stock_actual": 5,
      "velocidad_diaria": 2.3,
      "dias_cobertura": 2.17,
      "cantidad_sugerida": 20,
      "costo_unitario": 15000.00,
      "subtotal": 300000.00,
      "prioridad": "critico",
      "justificacion": "Cobertura de 2.2 días, menor al lead time de 3 días. Producto estrella con 25 uds vendidas."
    }}
  ],
  "total_estimado": 300000.00,
  "presupuesto_disponible": 500000.00,
  "presupuesto_restante": 200000.00,
  "alerta_presupuesto": null,
  "resumen_ia": "Se priorizaron 5 productos críticos..."
}}

Reglas estrictas del JSON:
- Todos los montos en ARS con punto como decimal (formato JSON estándar).
- cantidad_sugerida siempre entero positivo.
- prioridad es uno de: "critico", "alto", "medio", "bajo".
- Si no hay productos que reponer, devolvé "productos": [] con resumen_ia explicando.
- La lista debe estar ordenada por prioridad (critico → alto → medio → bajo).
"""


def _limpiar_json(texto: str) -> str:
    """Extrae JSON puro de la respuesta de Claude."""
    texto = texto.strip()

    # Quitar bloques de código markdown
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


async def generar_sugerencia_compra(
    presupuesto: Decimal,
    config: dict,
    inventario: list[dict],
) -> dict[str, Any]:
    """
    Llama a Claude con el prompt construido y devuelve el dict parseado.

    Parámetros:
      presupuesto  — monto en ARS disponible para la compra.
      config       — dict con campos de `configuraciones_erp`.
      inventario   — lista de dicts con datos de cada variante.

    Retorna:
      dict con la estructura SugerenciaCompraResponse.

    Lanza:
      RuntimeError / Exception con mensajes amigables.
    """
    client = _get_client()
    prompt = _build_prompt(presupuesto, config, inventario)

    try:
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.AuthenticationError:
        raise RuntimeError(
            "ANTHROPIC_API_KEY inválida. Verificá la variable de entorno."
        )
    except anthropic.RateLimitError:
        raise RuntimeError(
            "Límite de requests alcanzado en Anthropic. Esperá unos segundos."
        )
    except anthropic.APIError as e:
        logger.error("Anthropic API error: %s", e)
        raise RuntimeError(f"Error del servicio de IA: {e}")

    texto = message.content[0].text.strip()
    texto_limpio = _limpiar_json(texto)

    try:
        datos = json.loads(texto_limpio)
    except json.JSONDecodeError as e:
        logger.error("JSON inválido de Claude: %s", texto_limpio[:500])
        raise RuntimeError(
            f"La IA no devolvió JSON válido: {e}. Intentá de nuevo."
        )

    return datos
