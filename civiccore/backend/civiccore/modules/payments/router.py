"""
Payments Module Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.permissions import require_role
from .schemas import PaymentPlanCreate, PaymentPlanResponse, TransactionCreate, TransactionResponse, TransactionUpdateStatus
from .service import PaymentService

router = APIRouter()

@router.post("/plans", response_model=PaymentPlanResponse)
def create_payment_plan(plan_in: PaymentPlanCreate, db: Session = Depends(get_db)):
    """
    Create a new payment plan/fee structure.
    Usually requires admin role, but we leave the endpoint open or configurable for the framework.
    """
    return PaymentService.create_plan(db, plan_in)

@router.get("/plans", response_model=List[PaymentPlanResponse])
def get_payment_plans(db: Session = Depends(get_db)):
    return PaymentService.list_plans(db)

@router.post("/transactions", response_model=TransactionResponse)
def create_transaction(tx_in: TransactionCreate, db: Session = Depends(get_db)):
    return PaymentService.create_transaction(db, tx_in)

@router.get("/transactions", response_model=List[TransactionResponse])
def get_all_transactions(status: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return PaymentService.list_all_transactions(db, status, skip, limit)

@router.get("/transactions/{member_id}", response_model=List[TransactionResponse])
def get_member_transactions(member_id: int, db: Session = Depends(get_db)):
    return PaymentService.list_member_transactions(db, member_id)

@router.patch("/transactions/{tx_id}/status", response_model=TransactionResponse)
def update_transaction_status(tx_id: int, update_in: TransactionUpdateStatus, db: Session = Depends(get_db)):
    try:
        return PaymentService.update_transaction_status(db, tx_id, update_in)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

from .schemas import CreditRequestCreate, CreditRequestResponse
from .models import CreditStatus
from .service import CreditService

@router.post("/credits", response_model=CreditRequestResponse)
def create_credit_request(request_in: CreditRequestCreate, member_id: int, db: Session = Depends(get_db)):
    return CreditService.create_credit_request(db, member_id, request_in)

@router.get("/credits/{member_id}", response_model=List[CreditRequestResponse])
def get_member_credits(member_id: int, db: Session = Depends(get_db)):
    return CreditService.list_member_credits(db, member_id)

@router.get("/credits", response_model=List[CreditRequestResponse])
def get_all_credits(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return CreditService.list_all_credits(db, skip, limit)

@router.patch("/credits/{credit_id}/status", response_model=CreditRequestResponse)
def update_credit_status(credit_id: int, status: CreditStatus, db: Session = Depends(get_db)):
    try:
        return CreditService.update_credit_status(db, credit_id, status)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

