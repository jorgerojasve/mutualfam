"""
Payments Module Models
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from ...core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Frequency(str, enum.Enum):
    ONE_TIME = "one_time"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TransactionType(str, enum.Enum):
    CHARGE = "charge"      # An invoice/charge to the user
    PAYMENT = "payment"    # A payment made by the user
    REFUND = "refund"      # A refund to the user

class PaymentPlan(Base):
    """
    Defines a fee structure, such as 'Annual Membership 2026' or 'Conference Ticket'
    """
    __tablename__ = "payment_plans"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(String(500))
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="USD")
    frequency = Column(Enum(Frequency), default=Frequency.ONE_TIME)
    
    is_active = Column(Integer, default=1)  # using Integer as boolean for sqlite compatibility if needed, or Boolean
    created_at = Column(DateTime, default=utcnow)
    
    # Optional multi-tenant field
    organization_id = Column(Integer, nullable=True, index=True)

class Transaction(Base):
    """
    Immutable ledger of charges, payments, and refunds.
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("payment_plans.id"), nullable=True)
    
    transaction_type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="USD")
    
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING)
    reference_number = Column(String(100), unique=True, index=True, nullable=True)
    
    # Extensible field for receipts, bank confirmation details, etc.
    extra_fields = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Multi-tenant
    organization_id = Column(Integer, nullable=True, index=True)

class CreditStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    PAID = "paid"
    DEFAULTED = "defaulted"

class CreditRequest(Base):
    """
    Generic model for a line of credit or loan request.
    Can be used by Mutuals, Microfinance institutions, etc.
    """
    __tablename__ = "credit_requests"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    
    amount_requested = Column(Float, nullable=False)
    currency = Column(String(10), default="USD")
    interest_rate = Column(Float, default=0.0)
    term_months = Column(Integer, default=1)
    
    purpose = Column(String(500), nullable=True)
    status = Column(Enum(CreditStatus), default=CreditStatus.PENDING)
    
    # Financial metrics for evaluation (e.g., credit score, guarantees)
    evaluation_data = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    organization_id = Column(Integer, nullable=True, index=True)
