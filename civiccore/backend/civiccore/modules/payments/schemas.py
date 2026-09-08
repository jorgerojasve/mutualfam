"""
Payments Module Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from .models import Frequency, TransactionStatus, TransactionType

class PaymentPlanBase(BaseModel):
    title: str
    description: Optional[str] = None
    amount: float = Field(gt=0)
    currency: str = "USD"
    frequency: Frequency = Frequency.ONE_TIME
    is_active: bool = True

class PaymentPlanCreate(PaymentPlanBase):
    pass

class PaymentPlanResponse(PaymentPlanBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    plan_id: Optional[int] = None
    transaction_type: TransactionType
    amount: float
    currency: str = "USD"
    reference_number: Optional[str] = None
    extra_fields: Dict[str, Any] = {}

class TransactionCreate(TransactionBase):
    member_id: int

class TransactionResponse(TransactionBase):
    id: int
    member_id: int
    status: TransactionStatus
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class TransactionUpdateStatus(BaseModel):
    status: TransactionStatus
    reference_number: Optional[str] = None
    extra_fields: Optional[Dict[str, Any]] = None

from .models import CreditStatus

class CreditRequestBase(BaseModel):
    amount_requested: float = Field(gt=0)
    currency: str = "USD"
    term_months: int = Field(gt=0, default=1)
    purpose: Optional[str] = None
    evaluation_data: Dict[str, Any] = {}

class CreditRequestCreate(CreditRequestBase):
    pass

class CreditRequestResponse(CreditRequestBase):
    id: int
    member_id: int
    interest_rate: float
    status: CreditStatus
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

