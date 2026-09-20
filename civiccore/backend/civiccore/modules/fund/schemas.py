from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .models import FundCycleStatus, FundContributionStatus

class FundCycleBase(BaseModel):
    title: str
    contribution_amount_usd: float = 20.0
    reserve_percentage: float = 15.0

class FundCycleCreate(FundCycleBase):
    pass

class FundCycleResponse(FundCycleBase):
    id: int
    start_date: datetime
    end_date: Optional[datetime] = None
    status: FundCycleStatus
    bcv_rate_open: float
    total_collected_usd: float
    total_disbursed_usd: float
    total_reserve_usd: float
    total_surplus_usd: float
    organization_id: Optional[int]

    class Config:
        from_attributes = True

class FundContributionBase(BaseModel):
    amount_bs: float

class FundContributionCreate(FundContributionBase):
    pass

class FundContributionResponse(FundContributionBase):
    id: int
    cycle_id: int
    member_id: int
    bcv_rate: float
    amount_usd: float
    transaction_id: Optional[int]
    status: FundContributionStatus
    created_at: datetime
    organization_id: Optional[int]

    class Config:
        from_attributes = True

class FundCreditBase(BaseModel):
    credit_request_id: int
    installments_total: int
    interest_fee_bs: float = 0.0

class FundCreditCreate(FundCreditBase):
    pass

class FundCreditResponse(FundCreditBase):
    id: int
    cycle_id: int
    amount_usd: float
    bcv_rate_disbursement: float
    amount_bs_disbursed: float
    installments_paid: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
