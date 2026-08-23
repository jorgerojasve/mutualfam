"""
MutualSol - Modelos SQLAlchemy (Base de Datos)
Todas las cantidades monetarias se almacenan en USD (float).
Los bolívares se convierten SIEMPRE al momento de la transacción.
"""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Enum, Text
)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, timezone
import enum

Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────
# Enumeraciones
# ─────────────────────────────────────────────

class EstadoSocio(str, enum.Enum):
    PENDIENTE = "pendiente"       # Esperando aprobación
    ACTIVO = "activo"
    SUSPENDIDO = "suspendido"
    INACTIVO = "inactivo"


class RolSocio(str, enum.Enum):
    SOCIO = "socio"
    FUNDADOR = "fundador"         # Tiene voto de aprobación
    ADMINISTRADOR = "administrador"


class EstadoCredito(str, enum.Enum):
    SOLICITADO = "solicitado"
    EN_VOTACION = "en_votacion"
    APROBADO = "aprobado"
    DESEMBOLSADO = "desembolsado"
    AL_DIA = "al_dia"
    EN_MORA = "en_mora"
    CANCELADO = "cancelado"
    RECHAZADO = "rechazado"


class TipoTransaccion(str, enum.Enum):
    APORTE = "aporte"             # Socio aporta al fondo
    CREDITO = "credito"           # Desembolso de crédito
    CUOTA = "cuota"               # Pago de cuota de crédito
    ESPECIE = "especie"           # Transacción en el Mercado Solidario
    INTERES = "interes"           # Interés acreditado al fondo
    EGRESO = "egreso"             # Gasto operativo


class MetodoPago(str, enum.Enum):
    BOLIVARES = "bolivares"       # Pago móvil o transferencia en Bs
    USDT = "usdt"                 # Tether TRC-20 o similar
    ESPECIE = "especie"           # Bien o servicio del Mercado Solidario
    BINANCE = "binance"           # Binance Pay


class CategoriaEspecie(str, enum.Enum):
    CONSTRUCCION = "construccion"
    SERVICIOS = "servicios"
    ALIMENTACION = "alimentacion"
    MANUFACTURA = "manufactura"
    PROFESIONAL = "profesional"
    OTRO = "otro"


# ─────────────────────────────────────────────
# Tabla de Tasas de Cambio (USD/VES)
# ─────────────────────────────────────────────

class TasaCambio(Base):
    """Historial de tasas BCV consultadas automáticamente."""
    __tablename__ = "tasas_cambio"

    id = Column(Integer, primary_key=True)
    fuente = Column(String(50))                    # "bcv" | "dolarapi"
    tasa_bs_por_usd = Column(Float, nullable=False) # Cuántos Bs vale 1 USD
    fecha = Column(DateTime, default=utcnow)
    es_vigente = Column(Boolean, default=True)


# ─────────────────────────────────────────────
# Socios
# ─────────────────────────────────────────────

class Socio(Base):
    __tablename__ = "socios"

    id = Column(Integer, primary_key=True)
    cedula = Column(String(15), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    telefono = Column(String(20))
    hashed_password = Column(String(255), nullable=False)

    rol = Column(Enum(RolSocio), default=RolSocio.SOCIO)
    estado = Column(Enum(EstadoSocio), default=EstadoSocio.PENDIENTE)

    # Perfil financiero
    saldo_usd = Column(Float, default=0.0)           # Ahorros en el fondo (USD)
    credito_maximo_usd = Column(Float, default=0.0)  # Calculado: ej. 3x saldo
    reputacion = Column(Float, default=5.0)          # 0-5 estrellas

    fecha_ingreso = Column(DateTime, default=utcnow)
    ultimo_aporte = Column(DateTime, nullable=True)

    # Relaciones
    transacciones = relationship("Transaccion", back_populates="socio")
    creditos = relationship("Credito", back_populates="solicitante",
                            foreign_keys="Credito.solicitante_id")
    ofertas_especie = relationship("OfertaEspecie", back_populates="ofertante")
    votos = relationship("Voto", back_populates="socio")

    def __repr__(self):
        return f"<Socio {self.cedula} - {self.nombre} {self.apellido}>"


# ─────────────────────────────────────────────
# Transacciones
# ─────────────────────────────────────────────

class Transaccion(Base):
    """Registro inmutable de todas las operaciones financieras en USD."""
    __tablename__ = "transacciones"

    id = Column(Integer, primary_key=True)
    socio_id = Column(Integer, ForeignKey("socios.id"), nullable=False)
    tipo = Column(Enum(TipoTransaccion), nullable=False)
    metodo_pago = Column(Enum(MetodoPago))

    # SIEMPRE en USD
    monto_usd = Column(Float, nullable=False)

    # Para trazabilidad cuando se paga en Bs
    monto_bs = Column(Float, nullable=True)          # Monto original en Bs
    tasa_bcv_usada = Column(Float, nullable=True)    # Tasa en el momento del pago

    descripcion = Column(Text)
    referencia = Column(String(100))                 # Número de referencia bancaria
    comprobante_url = Column(String(255))            # Foto del comprobante (opcional)

    verificado = Column(Boolean, default=False)
    verificado_por_id = Column(Integer, ForeignKey("socios.id"), nullable=True)
    fecha = Column(DateTime, default=utcnow)

    # Relaciones
    socio = relationship("Socio", back_populates="transacciones",
                         foreign_keys=[socio_id])
    credito_id = Column(Integer, ForeignKey("creditos.id"), nullable=True)
    credito = relationship("Credito", back_populates="transacciones")


# ─────────────────────────────────────────────
# Créditos
# ─────────────────────────────────────────────

class Credito(Base):
    __tablename__ = "creditos"

    id = Column(Integer, primary_key=True)
    solicitante_id = Column(Integer, ForeignKey("socios.id"), nullable=False)

    monto_usd = Column(Float, nullable=False)        # Monto en USD
    plazo_meses = Column(Integer, nullable=False)    # 3, 6, 12 meses
    tasa_mensual = Column(Float, default=0.02)       # 2% mensual por defecto
    cuota_mensual_usd = Column(Float)                # Calculada automáticamente
    proposito = Column(Text)

    estado = Column(Enum(EstadoCredito), default=EstadoCredito.SOLICITADO)
    es_en_especie = Column(Boolean, default=False)   # ¿El desembolso es en especie?
    oferta_especie_id = Column(Integer, ForeignKey("ofertas_especie.id"), nullable=True)

    fecha_solicitud = Column(DateTime, default=utcnow)
    fecha_aprobacion = Column(DateTime, nullable=True)
    fecha_desembolso = Column(DateTime, nullable=True)
    fecha_vencimiento = Column(DateTime, nullable=True)

    cuotas_pagadas = Column(Integer, default=0)
    saldo_pendiente_usd = Column(Float)

    # Relaciones
    solicitante = relationship("Socio", back_populates="creditos",
                               foreign_keys=[solicitante_id])
    transacciones = relationship("Transaccion", back_populates="credito")
    votos = relationship("Voto", back_populates="credito")
    oferta_especie = relationship("OfertaEspecie", foreign_keys=[oferta_especie_id])


# ─────────────────────────────────────────────
# Votaciones (Gobernanza Democrática)
# ─────────────────────────────────────────────

class Voto(Base):
    """Registro de votos para aprobación de créditos y decisiones de la mutual."""
    __tablename__ = "votos"

    id = Column(Integer, primary_key=True)
    socio_id = Column(Integer, ForeignKey("socios.id"), nullable=False)
    credito_id = Column(Integer, ForeignKey("creditos.id"), nullable=True)
    aprueba = Column(Boolean, nullable=False)
    comentario = Column(Text, nullable=True)
    fecha = Column(DateTime, default=utcnow)

    socio = relationship("Socio", back_populates="votos")
    credito = relationship("Credito", back_populates="votos")


# ─────────────────────────────────────────────
# Mercado Solidario (Pagos en Especie)
# ─────────────────────────────────────────────

class OfertaEspecie(Base):
    """
    Bienes y servicios que los socios ofrecen dentro de la mutual.
    Valorados y transaccionados en USD.
    """
    __tablename__ = "ofertas_especie"

    id = Column(Integer, primary_key=True)
    ofertante_id = Column(Integer, ForeignKey("socios.id"), nullable=False)

    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text)
    categoria = Column(Enum(CategoriaEspecie), nullable=False)

    precio_usd = Column(Float, nullable=False)       # Precio siempre en USD
    cantidad_disponible = Column(Integer, default=1) # -1 para servicios ilimitados
    imagen_url = Column(String(255))

    disponible = Column(Boolean, default=True)
    fecha_publicacion = Column(DateTime, default=utcnow)
    fecha_actualizacion = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Calificaciones
    calificacion_promedio = Column(Float, default=0.0)
    total_calificaciones = Column(Integer, default=0)

    # Relaciones
    ofertante = relationship("Socio", back_populates="ofertas_especie")
    calificaciones = relationship("CalificacionEspecie", back_populates="oferta")


class CalificacionEspecie(Base):
    """Reputación de los proveedores del Mercado Solidario."""
    __tablename__ = "calificaciones_especie"

    id = Column(Integer, primary_key=True)
    oferta_id = Column(Integer, ForeignKey("ofertas_especie.id"), nullable=False)
    calificador_id = Column(Integer, ForeignKey("socios.id"), nullable=False)
    puntuacion = Column(Integer, nullable=False)      # 1-5
    comentario = Column(Text)
    fecha = Column(DateTime, default=utcnow)

    oferta = relationship("OfertaEspecie", back_populates="calificaciones")
