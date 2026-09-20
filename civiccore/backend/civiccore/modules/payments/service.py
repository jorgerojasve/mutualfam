"""
Payments Module Services and Adapters
"""
from sqlalchemy.orm import Session
from typing import List, Protocol
from datetime import datetime, timezone
from .models import PaymentPlan, Transaction, TransactionStatus, TransactionType
from .schemas import PaymentPlanCreate, TransactionCreate, TransactionUpdateStatus

def utcnow():
    return datetime.now(timezone.utc)

class CurrencyAdapter(Protocol):
    """
    Protocol for currency exchange rates.
    """
    def get_exchange_rate(self, from_currency: str, to_currency: str) -> float:
        ...

class FixedCurrencyAdapter:
    """
    Simple adapter for testing or fixed rates.
    """
    def __init__(self, rates: dict):
        self.rates = rates
        
    def get_exchange_rate(self, from_currency: str, to_currency: str) -> float:
        if from_currency == to_currency:
            return 1.0
        return self.rates.get(f"{from_currency}_{to_currency}", 1.0)


class PaymentService:
    
    @staticmethod
    def create_plan(db: Session, plan_in: PaymentPlanCreate) -> PaymentPlan:
        plan = PaymentPlan(**plan_in.model_dump())
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return plan
        
    @staticmethod
    def list_plans(db: Session) -> List[PaymentPlan]:
        return db.query(PaymentPlan).all()
        
    @staticmethod
    def create_transaction(db: Session, tx_in: TransactionCreate) -> Transaction:
        # Business logic: if it's a payment, maybe ensure amounts are positive.
        tx = Transaction(**tx_in.model_dump())
        db.add(tx)
        db.commit()
        db.refresh(tx)
        return tx
        
    @staticmethod
    def update_transaction_status(
        db: Session, tx_id: int, update_data: TransactionUpdateStatus
    ) -> Transaction:
        tx = db.query(Transaction).filter(Transaction.id == tx_id).with_for_update().first()
        if not tx:
            raise ValueError("Transaction not found")
            
        # In a real system, we would prevent modifying completed/failed transactions,
        # but for this framework, we let the implementer decide or enforce it here.
        if tx.status in [TransactionStatus.COMPLETED, TransactionStatus.FAILED]:
            # Maybe allow retry for failed? 
            pass
            
        tx.status = update_data.status
        if update_data.reference_number:
            tx.reference_number = update_data.reference_number
        if update_data.extra_fields:
            tx.extra_fields.update(update_data.extra_fields)
            
        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def list_member_transactions(db: Session, member_id: int) -> List[Transaction]:
        return db.query(Transaction).filter(Transaction.member_id == member_id).order_by(Transaction.created_at.desc()).all()

    @staticmethod
    def list_all_transactions(db: Session, status: str = None, skip: int = 0, limit: int = 100) -> List[Transaction]:
        query = db.query(Transaction)
        if status:
            query = query.filter(Transaction.status == status)
        return query.order_by(Transaction.created_at.desc()).offset(skip).limit(limit).all()

from .models import CreditRequest, CreditStatus
from .schemas import CreditRequestCreate

class CreditService:
    @staticmethod
    def create_credit_request(db: Session, member_id: int, request_in: CreditRequestCreate) -> CreditRequest:
        credit = CreditRequest(
            member_id=member_id,
            **request_in.model_dump()
        )
        db.add(credit)
        db.commit()
        db.refresh(credit)
        return credit
        
    @staticmethod
    def list_member_credits(db: Session, member_id: int) -> List[CreditRequest]:
        return db.query(CreditRequest).filter(CreditRequest.member_id == member_id).order_by(CreditRequest.created_at.desc()).all()

    @staticmethod
    def list_all_credits(db: Session, skip: int = 0, limit: int = 100) -> List[CreditRequest]:
        return db.query(CreditRequest).order_by(CreditRequest.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_credit_status(db: Session, credit_id: int, status: CreditStatus) -> CreditRequest:
        credit = db.query(CreditRequest).filter(CreditRequest.id == credit_id).with_for_update().first()
        if not credit:
            raise ValueError("Credit request not found")
            
        credit.status = status
        db.commit()
        db.refresh(credit)
        return credit

