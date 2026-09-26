from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, Enum, ForeignKey, Text
from datetime import datetime, timezone
import enum
from civiccore.core.database import Base

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
