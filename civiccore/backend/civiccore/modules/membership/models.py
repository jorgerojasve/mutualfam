"""
Membership Module Models
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, JSON
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
