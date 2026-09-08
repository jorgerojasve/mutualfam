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
