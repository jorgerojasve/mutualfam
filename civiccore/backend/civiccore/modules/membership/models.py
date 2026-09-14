"""
Membership Module Models
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, JSON, ForeignKey
from datetime import datetime, timezone
import enum
from ...core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class MemberStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"
    WITHDRAWAL_REQUESTED = "withdrawal_requested"
    WITHDRAWN = "withdrawn"
    EXPELLED = "expelled"
    ON_APPEAL = "on_appeal"
    DECEASED = "deceased"
    MOROSO_BAJA = "moroso_baja"

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    # Generic identifier (could be National ID, Passport, Student ID)
    identifier = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    
    # Basic info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    
    # Status and role
    status = Column(Enum(MemberStatus), default=MemberStatus.PENDING)
    role = Column(String(50), default="member") # Configurable role via string, e.g. "admin", "founder", "member"
    
    # Extensible field for domain-specific attributes (e.g. 'department' for scientists, 'reputation' for mutuals)
    extra_fields = Column(JSON, default=dict)
    
    # Audit
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    # Optional multi-tenant field
    organization_id = Column(Integer, nullable=True, index=True)

    def __repr__(self):
        return f"<Member {self.identifier} - {self.first_name} {self.last_name}>"

class MemberWithdrawalRequest(Base):
    __tablename__ = "member_withdrawal_requests"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    requested_at = Column(DateTime, default=utcnow)
    effective_at = Column(DateTime, nullable=False)
    status = Column(String(50), default="pending")  # pending, executed, cancelled
    cancellation_reason = Column(String(255), nullable=True)

class MemberExpulsionProcess(Base):
    __tablename__ = "member_expulsion_processes"

    id = Column(Integer, primary_key=True, index=True)
    target_member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    proposal_id = Column(Integer, nullable=False)  # We don't want a hard foreign key to governance from membership
    appeal_deadline = Column(DateTime, nullable=False)
    appeal_notes = Column(String(500), nullable=True)
    final_status = Column(String(50), default="on_appeal")  # on_appeal, expelled, appeal_won

class OrganizationEvent(Base):
    __tablename__ = "organization_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False)  # division, fusion
    proposal_id = Column(Integer, nullable=False)
    initiated_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="in_progress")  # in_progress, completed, failed
    metadata_ = Column("metadata", JSON, default=dict)

