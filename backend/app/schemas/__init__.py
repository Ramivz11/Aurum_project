from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from enum import Enum


# ─── ENUMS ───────────────────────────────────────────────────────────────────

class MetodoPago(str, Enum):
    efectivo = "efectivo"
    transferencia = "transferencia"
    tarjeta = "tarjeta"


class EstadoVenta(str, Enum):
    abierta = "abierta"
    confirmada = "confirmada"
    cancelada = "cancelada"


class TipoDeuda(str, Enum):
    por_cobrar = "por_cobrar"
    por_pagar = "por_pagar"


# ─── VARIANTES ───────────────────────────────────────────────────────────────

class VarianteBase(BaseModel):
    sabor: Optional[str] = None
    tamanio: Optional[str] = None
    sku: Optional[str] = None
    costo: Decimal = Decimal("0")
    precio_venta: Decimal = Decimal("0")
    stock_minimo: int = 0

class VarianteCreate(VarianteBase):
    pass

class VarianteUpdate(BaseModel):
    sabor: Optional[str] = None
    tamanio: Optional[str] = None
    sku: Optional[str] = None
    costo: Optional[Decimal] = None
    precio_venta: Optional[Decimal] = None
    stock_minimo: Optional[int] = None
    activa: Optional[bool] = None

class VarianteResponse(VarianteBase):
    id: int
    producto_id: int
    stock_actual: int
    activa: bool
    creado_en: datetime

    class Config:
        from_attributes = True


# ─── PRODUCTOS ───────────────────────────────────────────────────────────────

class ProductoBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    marca: Optional[str] = None
    categoria: Optional[str] = None
    imagen_url: Optional[str] = None

class ProductoCreate(ProductoBase):
    variantes: List[VarianteCreate] = []

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    marca: Optional[str] = None
    categoria: Optional[str] = None
    imagen_url: Optional[str] = None
    activo: Optional[bool] = None

class ProductoResponse(ProductoBase):
    id: int
    activo: bool
    creado_en: datetime
    variantes: List[VarianteResponse] = []

    class Config:
        from_attributes = True

class ProductoListResponse(ProductoBase):
    """Versión liviana sin variantes para listados"""
    id: int
    activo: bool
    variantes_count: int = 0
    stock_total: int = 0

    class Config:
        from_attributes = True


# ─── EDICIÓN POR LOTE ────────────────────────────────────────────────────────

class ModoAjustePrecio(str, Enum):
    porcentaje = "porcentaje"      # +/- % sobre precio actual
    margen_deseado = "margen_deseado"  # calcula precio desde costo
    precio_fijo = "precio_fijo"    # sobreescribe con valor manual

class AjustePrecioLote(BaseModel):
    producto_id: int
    variante_ids: Optional[List[int]] = None  # None = todas las variantes
    modo: ModoAjustePrecio
    valor: Decimal = Field(..., description="+/-% | margen% | precio fijo en ARS")


# ─── CLIENTES ────────────────────────────────────────────────────────────────

class ClienteBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    ubicacion: Optional[str] = None
    telefono: Optional[str] = None

class ClienteCreate(ClienteBase):
    pass

class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    ubicacion: Optional[str] = None
    telefono: Optional[str] = None
    activo: Optional[bool] = None

class ClienteResponse(ClienteBase):
    id: int
    activo: bool
    creado_en: datetime

    class Config:
        from_attributes = True

class ClienteConResumen(ClienteResponse):
    total_gastado: Decimal = Decimal("0")
    cantidad_compras: int = 0


# ─── VENTAS ──────────────────────────────────────────────────────────────────

class VentaItemCreate(BaseModel):
    variante_id: int
    cantidad: int = Field(..., gt=0)
    precio_unitario: Decimal = Field(..., gt=0)

class VentaItemResponse(BaseModel):
    id: int
    variante_id: int
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    variante: Optional[VarianteResponse] = None

    class Config:
        from_attributes = True

class VentaCreate(BaseModel):
    cliente_id: Optional[int] = None
    sucursal_id: int
    metodo_pago: MetodoPago
    estado: EstadoVenta = EstadoVenta.confirmada
    notas: Optional[str] = None
    items: List[VentaItemCreate] = Field(..., min_length=1)

class VentaUpdate(BaseModel):
    cliente_id: Optional[int] = None
    metodo_pago: Optional[MetodoPago] = None
    estado: Optional[EstadoVenta] = None
    notas: Optional[str] = None
    items: Optional[List[VentaItemCreate]] = None

class VentaResponse(BaseModel):
    id: int
    cliente_id: Optional[int]
    sucursal_id: int
    fecha: datetime
    metodo_pago: MetodoPago
    estado: EstadoVenta
    notas: Optional[str]
    total: Decimal
    items: List[VentaItemResponse] = []

    class Config:
        from_attributes = True


# ─── COMPRAS ─────────────────────────────────────────────────────────────────

class CompraItemCreate(BaseModel):
    variante_id: int
    cantidad: int = Field(..., gt=0)
    costo_unitario: Decimal = Field(..., gt=0)

class CompraItemResponse(BaseModel):
    id: int
    variante_id: int
    cantidad: int
    costo_unitario: Decimal
    subtotal: Decimal
    variante: Optional[VarianteResponse] = None

    class Config:
        from_attributes = True

class CompraCreate(BaseModel):
    proveedor: Optional[str] = None
    sucursal_id: int
    metodo_pago: MetodoPago
    notas: Optional[str] = None
    items: List[CompraItemCreate] = Field(..., min_length=1)

class CompraResponse(BaseModel):
    id: int
    proveedor: Optional[str]
    sucursal_id: int
    fecha: datetime
    metodo_pago: MetodoPago
    factura_url: Optional[str]
    notas: Optional[str]
    total: Decimal
    items: List[CompraItemResponse] = []

    class Config:
        from_attributes = True

class FacturaIAResponse(BaseModel):
    """Lo que devuelve la IA antes de confirmar la compra"""
    items_detectados: List[CompraItemCreate]
    proveedor_detectado: Optional[str] = None
    total_detectado: Optional[Decimal] = None
    confianza: float = Field(..., ge=0, le=1)


# ─── GASTOS ──────────────────────────────────────────────────────────────────

class GastoCreate(BaseModel):
    concepto: str = Field(..., min_length=1)
    categoria_id: Optional[int] = None
    monto: Decimal = Field(..., gt=0)
    metodo_pago: MetodoPago
    sucursal_id: Optional[int] = None
    notas: Optional[str] = None

class GastoResponse(BaseModel):
    id: int
    concepto: str
    categoria_id: Optional[int]
    monto: Decimal
    metodo_pago: MetodoPago
    sucursal_id: Optional[int]
    fecha: datetime
    notas: Optional[str]

    class Config:
        from_attributes = True


# ─── FINANZAS ────────────────────────────────────────────────────────────────

class LiquidezResponse(BaseModel):
    efectivo: Decimal
    transferencia: Decimal
    tarjeta: Decimal
    total: Decimal

class AjusteSaldoCreate(BaseModel):
    tipo: MetodoPago
    monto_nuevo: Decimal = Field(..., ge=0)
    nota: Optional[str] = None

class AjusteSaldoResponse(BaseModel):
    id: int
    tipo: MetodoPago
    monto_anterior: Decimal
    monto_nuevo: Decimal
    nota: Optional[str]
    fecha: datetime

    class Config:
        from_attributes = True

class AnalisisMesResponse(BaseModel):
    periodo: str
    ingresos: Decimal
    compras: Decimal
    gastos: Decimal
    neto: Decimal

class ProductoTopResponse(BaseModel):
    variante_id: int
    nombre_producto: str
    sabor: Optional[str]
    tamanio: Optional[str]
    cantidad_vendida: int
    ingreso_total: Decimal
    costo_total: Decimal
    ganancia: Decimal
    margen_porcentaje: float


# ─── SUCURSALES ──────────────────────────────────────────────────────────────

class SucursalCreate(BaseModel):
    nombre: str = Field(..., min_length=1)

class SucursalResponse(BaseModel):
    id: int
    nombre: str
    activa: bool

    class Config:
        from_attributes = True

class SucursalComparacionResponse(BaseModel):
    sucursal: SucursalResponse
    ventas_total: Decimal
    ticket_promedio: Decimal
    unidades_vendidas: int
    porcentaje_del_total: float
    rentabilidad: Decimal


# ─── DEUDAS ──────────────────────────────────────────────────────────────────

class DeudaCreate(BaseModel):
    tipo: TipoDeuda
    cliente_proveedor: str = Field(..., min_length=1)
    monto: Decimal = Field(..., gt=0)
    fecha_vencimiento: Optional[datetime] = None
    concepto: Optional[str] = None
    notas: Optional[str] = None

class DeudaResponse(BaseModel):
    id: int
    tipo: TipoDeuda
    cliente_proveedor: str
    monto: Decimal
    fecha_vencimiento: Optional[datetime]
    concepto: Optional[str]
    notas: Optional[str]
    saldada: bool
    creado_en: datetime

    class Config:
        from_attributes = True


# ─── MOVIMIENTOS ─────────────────────────────────────────────────────────────

class MovimientoFiltros(BaseModel):
    tipo: Optional[str] = None  # venta | compra
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    sucursal_id: Optional[int] = None
    metodo_pago: Optional[MetodoPago] = None
    cliente_id: Optional[int] = None

class ResumenPeriodo(BaseModel):
    total_ventas: Decimal
    cantidad_ventas: int
    ticket_promedio: Decimal
    producto_mas_vendido: Optional[str] = None


# ─── STOCK POR SUCURSAL ──────────────────────────────────────────────────────

class StockSucursalResponse(BaseModel):
    sucursal_id: int
    sucursal_nombre: str
    cantidad: int

    class Config:
        from_attributes = True

class VarianteConStockResponse(BaseModel):
    """Variante con stock desglosado por sucursal"""
    id: int
    producto_id: int
    sabor: Optional[str]
    tamanio: Optional[str]
    sku: Optional[str]
    costo: Decimal
    precio_venta: Decimal
    stock_central: int           # depósito central
    stock_total: int             # suma de todo (central + sucursales)
    stock_minimo: int
    activa: bool
    creado_en: datetime
    stocks_sucursal: List[StockSucursalResponse] = []

    class Config:
        from_attributes = True

class ProductoConStockResponse(BaseModel):
    id: int
    nombre: str
    marca: Optional[str]
    categoria: Optional[str]
    imagen_url: Optional[str]
    activo: bool
    creado_en: datetime
    variantes: List[VarianteConStockResponse] = []

    class Config:
        from_attributes = True


# ─── DISTRIBUCIÓN EN COMPRA ──────────────────────────────────────────────────

class DistribucionSucursal(BaseModel):
    sucursal_id: int
    cantidad: int = Field(..., ge=0)

class CompraItemConDistribucion(BaseModel):
    variante_id: int
    cantidad: int = Field(..., gt=0)
    costo_unitario: Decimal = Field(..., gt=0)
    distribucion: List[DistribucionSucursal] = []  # si vacío, va todo a central

class CompraCreateConDistribucion(BaseModel):
    proveedor: Optional[str] = None
    sucursal_id: int
    metodo_pago: MetodoPago
    notas: Optional[str] = None
    items: List[CompraItemConDistribucion] = Field(..., min_length=1)


# ─── TRANSFERENCIAS ──────────────────────────────────────────────────────────

class TransferenciaCreate(BaseModel):
    variante_id: int
    cantidad: int = Field(..., gt=0)
    sucursal_origen_id: Optional[int] = None   # None = central
    sucursal_destino_id: Optional[int] = None  # None = central
    notas: Optional[str] = None

class TransferenciaResponse(BaseModel):
    id: int
    variante_id: int
    tipo: str
    sucursal_origen_id: Optional[int]
    sucursal_destino_id: Optional[int]
    cantidad: int
    notas: Optional[str]
    fecha: datetime

    class Config:
        from_attributes = True
