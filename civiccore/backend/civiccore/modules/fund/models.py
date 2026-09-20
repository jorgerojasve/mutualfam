"""
Fund Module Models
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from ...core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class FundCycleStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    SETTLING = "settling"

class FundContributionStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REFUNDED = "refunded"

class FundCycle(Base):
    """A bi-weekly (or configurable) cycle of the mutual fund"""
    __tablename__ = "fund_cycles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    start_date = Column(DateTime, default=utcnow)
    end_date = Column(DateTime, nullable=True)
    
    status = Column(Enum(FundCycleStatus), default=FundCycleStatus.OPEN)
    bcv_rate_open = Column(Float, nullable=False) # Rate at the time of opening
    
    # Financials populated at closing
    total_collected_usd = Column(Float, default=0.0)
    total_disbursed_usd = Column(Float, default=0.0)
    total_reserve_usd = Column(Float, default=0.0)
    total_surplus_usd = Column(Float, default=0.0)
    
    # Config parameters for this cycle (set by governance/smart contract)
    contribution_amount_usd = Column(Float, nullable=False, default=20.0)
    reserve_percentage = Column(Float, nullable=False, default=15.0)
    
    organization_id = Column(Integer, nullable=True, index=True)

class FundContribution(Base):
    """A member's contribution to a specific cycle"""
    __tablename__ = "fund_contributions"

    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("fund_cycles.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    
    amount_bs = Column(Float, nullable=False)
    bcv_rate = Column(Float, nullable=False) # Rate exactly at the moment of payment
    amount_usd = Column(Float, nullable=False) # amount_bs / bcv_rate
    
    # We reference a global transaction to keep the ledger unified
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    
    status = Column(Enum(FundContributionStatus), default=FundContributionStatus.PENDING)
    created_at = Column(DateTime, default=utcnow)
    organization_id = Column(Integer, nullable=True, index=True)

class FundCredit(Base):
    """Links a CreditRequest to the cycle that funded it"""
    __tablename__ = "fund_credits"

    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("fund_cycles.id"), nullable=False)
    credit_request_id = Column(Integer, ForeignKey("credit_requests.id"), nullable=False)
    
    amount_usd = Column(Float, nullable=False)
    bcv_rate_disbursement = Column(Float, nullable=False)
    amount_bs_disbursed = Column(Float, nullable=False)
    
    installments_total = Column(Integer, default=1)
    installments_paid = Column(Integer, default=0)
    interest_fee_bs = Column(Float, default=0.0) # Fixed fee in Bolivares
    
    status = Column(String(50), default="active") # active, paid, defaulted
    
    created_at = Column(DateTime, default=utcnow)
    organization_id = Column(Integer, nullable=True, index=True)
