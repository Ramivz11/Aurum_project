from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime,
    ForeignKey, Enum, Text, func
)
from sqlalchemy.orm import relationship
import enum
from app.database import Base


# ─── ENUMS ───────────────────────────────────────────────────────────────────

class MetodoPagoEnum(str, enum.Enum):
    efectivo = "efectivo"
    transferencia = "transferencia"
    tarjeta = "tarjeta"


class EstadoVentaEnum(str, enum.Enum):
    abierta = "abierta"
    confirmada = "confirmada"
    cancelada = "cancelada"


class TipoMovimientoEnum(str, enum.Enum):
    venta = "venta"
    compra = "compra"


class TipoDeudaEnum(str, enum.Enum):
    por_cobrar = "por_cobrar"
    por_pagar = "por_pagar"


# ─── SUCURSALES ───────────────────────────────────────────────────────────────

class Sucursal(Base):
    __tablename__ = "sucursales"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    activa = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    ventas = relationship("Venta", back_populates="sucursal")
    compras = relationship("Compra", back_populates="sucursal")
    gastos = relationship("Gasto", back_populates="sucursal")


# ─── CATEGORÍAS DE GASTO ─────────────────────────────────────────────────────

class CategoriaGasto(Base):
    __tablename__ = "categorias_gasto"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False, unique=True)
    activa = Column(Boolean, default=True)

    gastos = relationship("Gasto", back_populates="categoria")


# ─── PRODUCTOS / STOCK ────────────────────────────────────────────────────────

class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    marca = Column(String(100))
    categoria = Column(String(100))  # proteina, creatina, otro
    imagen_url = Column(String(500))
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())

    variantes = relationship("Variante", back_populates="producto", cascade="all, delete-orphan")


class Variante(Base):
    __tablename__ = "variantes"

    id = Column(Integer, primary_key=True, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    sabor = Column(String(100))
    tamanio = Column(String(100))  # 1kg, 2kg, 30 servicios, etc.
    sku = Column(String(100), unique=True)
    costo = Column(Numeric(12, 2), nullable=False, default=0)
    precio_venta = Column(Numeric(12, 2), nullable=False, default=0)
    stock_actual = Column(Integer, default=0)
    stock_minimo = Column(Integer, default=0)  # para alertas de stock bajo
    activa = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())

    producto = relationship("Producto", back_populates="variantes")
    items_venta = relationship("VentaItem", back_populates="variante")
    items_compra = relationship("CompraItem", back_populates="variante")


# ─── CLIENTES ─────────────────────────────────────────────────────────────────

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    ubicacion = Column(String(200))
    telefono = Column(String(50))
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    ventas = relationship("Venta", back_populates="cliente")


# ─── VENTAS ───────────────────────────────────────────────────────────────────

class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    metodo_pago = Column(Enum(MetodoPagoEnum), nullable=False)
    estado = Column(Enum(EstadoVentaEnum), default=EstadoVentaEnum.confirmada)
    notas = Column(Text)
    total = Column(Numeric(12, 2), default=0)

    cliente = relationship("Cliente", back_populates="ventas")
    sucursal = relationship("Sucursal", back_populates="ventas")
    items = relationship("VentaItem", back_populates="venta", cascade="all, delete-orphan")


class VentaItem(Base):
    __tablename__ = "venta_items"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    variante_id = Column(Integer, ForeignKey("variantes.id"), nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    venta = relationship("Venta", back_populates="items")
    variante = relationship("Variante", back_populates="items_venta")


# ─── COMPRAS ──────────────────────────────────────────────────────────────────

class Compra(Base):
    __tablename__ = "compras"

    id = Column(Integer, primary_key=True, index=True)
    proveedor = Column(String(200))  # no obligatorio
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"), nullable=False)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    metodo_pago = Column(Enum(MetodoPagoEnum), nullable=False)
    factura_url = Column(String(500))  # para el módulo de IA
    notas = Column(Text)
    total = Column(Numeric(12, 2), default=0)

    sucursal = relationship("Sucursal", back_populates="compras")
    items = relationship("CompraItem", back_populates="compra", cascade="all, delete-orphan")


class CompraItem(Base):
    __tablename__ = "compra_items"

    id = Column(Integer, primary_key=True, index=True)
    compra_id = Column(Integer, ForeignKey("compras.id"), nullable=False)
    variante_id = Column(Integer, ForeignKey("variantes.id"), nullable=False)
    cantidad = Column(Integer, nullable=False)
    costo_unitario = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    compra = relationship("Compra", back_populates="items")
    variante = relationship("Variante", back_populates="items_compra")


# ─── GASTOS ───────────────────────────────────────────────────────────────────

class Gasto(Base):
    __tablename__ = "gastos"

    id = Column(Integer, primary_key=True, index=True)
    concepto = Column(String(300), nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias_gasto.id"), nullable=True)
    monto = Column(Numeric(12, 2), nullable=False)
    metodo_pago = Column(Enum(MetodoPagoEnum), nullable=False)
    sucursal_id = Column(Integer, ForeignKey("sucursales.id"), nullable=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    notas = Column(Text)

    categoria = relationship("CategoriaGasto", back_populates="gastos")
    sucursal = relationship("Sucursal", back_populates="gastos")


# ─── AJUSTES DE SALDO ────────────────────────────────────────────────────────

class AjusteSaldo(Base):
    __tablename__ = "ajustes_saldo"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(Enum(MetodoPagoEnum), nullable=False)
    monto_anterior = Column(Numeric(12, 2), nullable=False)
    monto_nuevo = Column(Numeric(12, 2), nullable=False)
    nota = Column(Text)
    fecha = Column(DateTime(timezone=True), server_default=func.now())


# ─── DEUDAS ───────────────────────────────────────────────────────────────────

class Deuda(Base):
    __tablename__ = "deudas"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(Enum(TipoDeudaEnum), nullable=False)
    cliente_proveedor = Column(String(200), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    fecha_vencimiento = Column(DateTime(timezone=True))
    concepto = Column(Text)
    notas = Column(Text)
    saldada = Column(Boolean, default=False)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
