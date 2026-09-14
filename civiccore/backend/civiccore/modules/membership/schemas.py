"""
Membership Module Schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime
from .models import MemberStatus

class MemberBase(BaseModel):
    identifier: str
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    extra_fields: Optional[Dict[str, Any]] = {}

class MemberCreate(MemberBase):
    password: str

class MemberUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    extra_fields: Optional[Dict[str, Any]] = None

class MemberResponse(MemberBase):
    id: int
    status: MemberStatus
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MemberWithdrawalRequestResponse(BaseModel):
    id: int
    member_id: int
    requested_at: datetime
    effective_at: datetime
    status: str
    cancellation_reason: Optional[str] = None
    
    class Config:
        from_attributes = True

class MemberExpulsionResponse(BaseModel):
    id: int
    target_member_id: int
    proposal_id: int
    appeal_deadline: datetime
    appeal_notes: Optional[str] = None
    final_status: str

    class Config:
        from_attributes = True

class OrganizationEventResponse(BaseModel):
    id: int
    event_type: str
    proposal_id: int
    initiated_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    metadata_: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
