"""
Withdrawal Service
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
from ...core.config import settings
from .models import Member, MemberStatus, MemberWithdrawalRequest

def utcnow():
    return datetime.now(timezone.utc)

def request_withdrawal(db: Session, member_id: int) -> MemberWithdrawalRequest:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    if member.status in [MemberStatus.WITHDRAWAL_REQUESTED, MemberStatus.WITHDRAWN]:
        raise HTTPException(status_code=400, detail="Member already requested withdrawal or is withdrawn")

    # Fetch configuration or defaults
    min_days = int(settings.get_value("SALIDA_MEMBRESIA_MINIMA_DIAS", "15"))
    wait_days = int(settings.get_value("SALIDA_PERIODO_ESPERA_DIAS", "90"))
    block_if_debt = settings.get_value("SALIDA_BLOQUEADA_POR_CREDITO_ACTIVO", "true") == "true"
    
    # 1. Validate minimum membership
    membership_duration = (utcnow() - member.created_at.replace(tzinfo=timezone.utc)).days
    if membership_duration < min_days:
        raise HTTPException(status_code=400, detail=f"Cannot withdraw. Minimum membership period is {min_days} days. You have been a member for {membership_duration} days.")
        
    # 2. Validate pending commitments (dummy implementation - should check external modules)
    # e.g., if block_if_debt and has_active_loan(db, member_id):
    #     raise HTTPException(400, "Cannot withdraw while having active loans.")
    
    # Change member status
    member.status = MemberStatus.WITHDRAWAL_REQUESTED
    
    # Create request
    effective_date = utcnow() + timedelta(days=wait_days)
    request_record = MemberWithdrawalRequest(
        member_id=member.id,
        effective_at=effective_date,
        status="pending"
    )
    db.add(request_record)
    db.commit()
    db.refresh(request_record)
    
    # Note: "SALIDA_ANULA_VOTOS_ACTIVOS" implies we should annul active votes. 
    # Since votes are in the governance module, we should dispatch an event or call a cross-module function.
    # For now, we assume a background job or event listener handles it.
    
    return request_record

def create_withdrawal_request(db: Session, member_id: int) -> MemberWithdrawalRequest:
    """Creates a withdrawal request for forced exits (e.g. expulsion) with a 6 month max deadline"""
    request_record = MemberWithdrawalRequest(
        member_id=member_id,
        effective_at=utcnow() + timedelta(days=180), # 6 meses plazo máximo de liquidación según LEAC
        status="pending"
    )
    db.add(request_record)
    return request_record

def cancel_withdrawal(db: Session, member_id: int) -> MemberWithdrawalRequest:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member or member.status != MemberStatus.WITHDRAWAL_REQUESTED:
        raise HTTPException(status_code=400, detail="No active withdrawal request found.")
        
    request_record = db.query(MemberWithdrawalRequest).filter(
        MemberWithdrawalRequest.member_id == member.id,
        MemberWithdrawalRequest.status == "pending"
    ).first()
    
    if not request_record:
        raise HTTPException(status_code=404, detail="Pending request not found.")
        
    request_record.status = "cancelled"
    request_record.cancellation_reason = "Cancelled by user"
    member.status = MemberStatus.ACTIVE
    
    db.commit()
    db.refresh(request_record)
    
    return request_record

def get_withdrawal_status(db: Session, member_id: int) -> MemberWithdrawalRequest:
    return db.query(MemberWithdrawalRequest).filter(
        MemberWithdrawalRequest.member_id == member_id
    ).order_by(MemberWithdrawalRequest.id.desc()).first()
