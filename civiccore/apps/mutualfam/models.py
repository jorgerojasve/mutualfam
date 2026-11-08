from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from civiccore.core.database import Base
from civiccore.modules.membership.models import User

def utcnow():
    return datetime.now(timezone.utc)

class LoanStatus(str, enum.Enum):
    PENDING = "pending"       # Esperando financiamiento
    PARTIAL = "partial"       # Parcialmente financiado (para "vacas")
    FUNDED = "funded"         # 100% financiado
    REPAID = "repaid"         # Pagado de vuelta
    CANCELLED = "cancelled"   # Cancelado

class UserPaymentConfig(Base):
    __tablename__ = "mutualfam_user_payment_configs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, unique=True)
    payment_methods_json = Column(Text, default="{}")

class LoanRequest(Base):
    __tablename__ = "loan_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    amount_usd = Column(Float, nullable=False)
    motive = Column(String(255), nullable=False)
    estimated_repayment_date = Column(Date, nullable=True)
    
    status = Column(Enum(LoanStatus), default=LoanStatus.PENDING)
    accepted_payment_methods = Column(Text, default="[]")
    
    created_at = Column(DateTime, default=utcnow)
    funded_at = Column(DateTime, nullable=True)
    repaid_at = Column(DateTime, nullable=True)
    last_repayment_reminder_date = Column(Date, nullable=True)


class ContributionStatus(str, enum.Enum):
    PLEDGED = "pledged"     # Prometió pagar
    PAID = "paid"           # Notificó el pago
    VERIFIED = "verified"   # El receptor confirmó recibirlo
    REPAY_NOTIFIED = "repay_notified" # El prestatario notificó que devolvió el dinero
    REPAID = "repaid"       # El aportante confirmó que recibió la devolución
    REJECTED = "rejected"   # El receptor indica que no lo recibió

class LoanContribution(Base):
    """
    Rastrea quién financia el préstamo. Permite el Caso 1 (1 financiador) 
    o el Caso 2 (varios financiadores para una 'vaca').
    """
    __tablename__ = "loan_contributions"
    
    id = Column(Integer, primary_key=True, index=True)
    loan_request_id = Column(Integer, ForeignKey("loan_requests.id"), nullable=False)
    funder_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    amount_usd = Column(Float, nullable=False)
    amount_ves = Column(Float, nullable=True) # Monto equivalente si pagó en Bs
    exchange_rate_used = Column(Float, nullable=True) # Tasa BCV usada
    
    payment_method = Column(String(50)) # ej. "pago_movil", "zelle"
    receipt_url = Column(String(500), nullable=True) # URL de imagen en Telegram CDN
    reference_text = Column(String(255), nullable=True) # Texto de referencia del pago
    
    status = Column(Enum(ContributionStatus), default=ContributionStatus.PLEDGED)
    
    created_at = Column(DateTime, default=utcnow)

class FundType(str, enum.Enum):
    EMERGENCY = "emergency" # Fondo común familiar para emergencias
    SAVINGS = "savings"     # Ahorro individual (ahorro cripto)

class Fund(Base):
    __tablename__ = "funds"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    
    name = Column(String(100), nullable=False) # ej. "Fondo de Emergencia Abuela"
    fund_type = Column(Enum(FundType), default=FundType.EMERGENCY)
    target_monthly_contribution_usd = Column(Float, nullable=True) # Cuota mensual sugerida (ej. $5)
    
    created_at = Column(DateTime, default=utcnow)

class FundContribution(Base):
    __tablename__ = "fund_contributions"
    
    id = Column(Integer, primary_key=True, index=True)
    fund_id = Column(Integer, ForeignKey("funds.id"), nullable=False)
    contributor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    amount_usd = Column(Float, nullable=False)
    amount_ves = Column(Float, nullable=True)
    exchange_rate_used = Column(Float, nullable=True)
    
    payment_method = Column(String(50))
    receipt_url = Column(String(500), nullable=True)
    status = Column(Enum(ContributionStatus), default=ContributionStatus.PLEDGED)
    
    created_at = Column(DateTime, default=utcnow)

class RepaymentStatus(str, enum.Enum):
    PAID = "paid"
    VERIFIED = "verified"
    REJECTED = "rejected"

class LoanRepayment(Base):
    __tablename__ = "loan_repayments"
    id = Column(Integer, primary_key=True, index=True)
    contribution_id = Column(Integer, ForeignKey("loan_contributions.id"), nullable=False)
    amount_usd = Column(Float, nullable=False)
    payment_method = Column(String(50))
    receipt_url = Column(String(500), nullable=True)
    reference_text = Column(String(255), nullable=True)
    status = Column(Enum(RepaymentStatus), default=RepaymentStatus.PAID)
    created_at = Column(DateTime, default=utcnow)
    verified_at = Column(DateTime, nullable=True)

class UserPushToken(Base):
    __tablename__ = "mutualfam_user_push_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    token = Column(String(255), unique=True, index=True)


# ==========================================
# MODELOS DE COLECTAS SOLIDARIAS ("VACAS")
# ==========================================

class EstadoColecta(str, enum.Enum):
    PROPUESTA = "propuesta"       # Creada, esperando alcanzar el 100% de la meta en promesas
    ACTIVA = "activa"             # Quorum alcanzado (100%+ prometido), lista para pagos
    CERRADA = "cerrada"           # Aportes completados, en espera de validación de gasto
    COMPLETADA = "completada"     # Gasto validado por el beneficiario (con o sin comprobante)
    CANCELADA = "cancelada"       # Cancelada por el proponente


class TipoTasaColecta(str, enum.Enum):
    BCV = "bcv"                   # Tasa oficial BCV (por defecto)
    USDT = "usdt"                 # Tasa USDT / Binance P2P
    EURO = "euro"                 # Tasa Euro BCV
    PARALELO = "paralelo"         # Monitor paralelo
    FIJA = "fija"                 # Tasa fija numérica acordada al crear


class EstadoCompromiso(str, enum.Enum):
    PROMETIDO = "prometido"       # Socio prometió aportar
    NOTIFICADO = "notificado"     # Notificado con monto en Bs
    PAGADO = "pagado"             # Pago confirmado con comprobante (En validación)
    VALIDADO = "validado"         # Pago verificado por el gestor de la colecta
    DEVUELTO = "devuelto"         # Aporte devuelto al socio por cancelación/fuerza mayor
    CANCELADO = "cancelado"       # Cancelado antes del pago


class Colecta(Base):
    """
    Propuesta de colecta solidaria ('vaca') para un fin específico.
    Financiada mediante aportes voluntarios de los socios de la mutual.
    """
    __tablename__ = "colectas"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    proponente_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Información básica
    titulo = Column(String(200), nullable=False)
    proposito = Column(Text, nullable=False)

    # Metas financieras (Base USD y Contravalor VES)
    monto_meta_usd = Column(Float, nullable=False)
    monto_meta_ves = Column(Float, nullable=True)
    monto_prometido_usd = Column(Float, default=0.0)
    monto_recaudado_usd = Column(Float, default=0.0)
    moneda_origen = Column(String(10), default="USD")  # 'USD' | 'VES'

    # Tasa de cambio acordada
    tipo_tasa = Column(Enum(TipoTasaColecta), default=TipoTasaColecta.BCV, nullable=False)
    tasa_fija_valor = Column(Float, nullable=True)  # Solo si tipo_tasa == FIJA

    # Datos del beneficiario (por defecto el proponente; extensible a externos)
    beneficiario_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    beneficiario_nombre = Column(String(200), nullable=True)
    beneficiario_datos_pago = Column(Text, default="{}")  # JSON string con datos bancarios/pago móvil

    # Validación de gasto por el beneficiario (obligatoria para COMPLETADA, comprobante adjunto opcional)
    gasto_validado = Column(Boolean, default=False)
    descripcion_gasto = Column(Text, nullable=True)
    comprobante_gasto_url = Column(String(500), nullable=True)

    # Fechas
    fecha_pago = Column(Date, nullable=False)
    fecha_limite_aportes = Column(Date, nullable=True)

    # Parámetros preparados para futuros Smart Contracts
    limite_cancelacion_horas = Column(Integer, nullable=True, default=None)

    # Estado general
    estado = Column(Enum(EstadoColecta), default=EstadoColecta.PROPUESTA, nullable=False)
    motivo_cancelacion = Column(Text, nullable=True)
    fecha_cancelacion = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relaciones
    compromisos = relationship("CompromisoColecta", back_populates="colecta", cascade="all, delete-orphan")
    proponente = relationship("User", foreign_keys=[proponente_id])
    beneficiario = relationship("User", foreign_keys=[beneficiario_id])


class CompromisoColecta(Base):
    """
    Compromiso de aporte voluntario de un socio a una colecta.
    """
    __tablename__ = "compromisos_colecta"

    id = Column(Integer, primary_key=True, index=True)
    colecta_id = Column(Integer, ForeignKey("colectas.id"), nullable=False, index=True)
    socio_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Monto comprometido (Base USD)
    monto_usd = Column(Float, nullable=False)

    # Conversión al momento de notificación / cobro en Bs
    monto_bs = Column(Float, nullable=True)
    tasa_usada = Column(Float, nullable=True)
    tipo_tasa_usada = Column(String(50), nullable=True)

    # Comprobante de pago del aportante
    payment_method = Column(String(50), nullable=True)
    referencia_pago = Column(String(100), nullable=True)
    comprobante_url = Column(String(500), nullable=True)
    nota_pago = Column(Text, nullable=True)

    # Estado del aporte
    estado = Column(Enum(EstadoCompromiso), default=EstadoCompromiso.PROMETIDO, nullable=False)

    fecha_compromiso = Column(DateTime, default=utcnow)
    fecha_notificacion = Column(DateTime, nullable=True)
    fecha_pago = Column(DateTime, nullable=True)
    fecha_validacion = Column(DateTime, nullable=True)
    fecha_cancelacion = Column(DateTime, nullable=True)

    # Devolución por cancelación de colecta
    fecha_devolucion = Column(DateTime, nullable=True)
    monto_devuelto = Column(Float, nullable=True)
    moneda_devolucion = Column(String(10), nullable=True)  # 'VES' | 'USD'
    metodo_devolucion = Column(String(50), nullable=True)
    referencia_devolucion = Column(String(100), nullable=True)
    comprobante_devolucion_url = Column(String(500), nullable=True)
    comision_descontada = Column(Float, default=0.0)

    # Relaciones
    colecta = relationship("Colecta", back_populates="compromisos")
    socio = relationship("User", foreign_keys=[socio_id])

