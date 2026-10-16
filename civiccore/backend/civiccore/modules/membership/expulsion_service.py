"""
Expulsion Service
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
from ...core.config import settings
from .models import Member, MemberStatus, MemberExpulsionProcess

def utcnow():
    return datetime.now(timezone.utc)

def initiate_expulsion(db: Session, proposal_id: int, target_member_id: int) -> MemberExpulsionProcess:
    """
    Called when an EXPULSION proposal is approved.
    Changes member status to EXPELLED immediately and creates a withdrawal request.
    Supports both Member (CivicCore standard) and OrganizationMembership/User (MutualFam).
    """
    member = db.query(Member).filter(Member.id == target_member_id).first()
    from .models import OrganizationMembership, User
    user = db.query(User).filter(User.id == target_member_id).first()
    
    if not member and not user:
        raise ValueError("Target member not found")
        
    if member:
        member.status = MemberStatus.EXPELLED
        
    # Update organization memberships if target is a user in organizations
    org_memberships = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == target_member_id
    ).all()
    for om in org_memberships:
        om.status = MemberStatus.EXPELLED
    
    # Create the process record for history
    process = MemberExpulsionProcess(
        target_member_id=target_member_id,
        proposal_id=proposal_id,
        appeal_deadline=utcnow(),
        final_status="expelled"
    )
    db.add(process)
    
    # Generate automatic withdrawal request (Liquidation) if Member exists
    if member:
        try:
            from .withdrawal_service import create_withdrawal_request
            create_withdrawal_request(db, target_member_id)
        except Exception:
            pass
    
    db.commit()
    db.refresh(process)
    
    return process

def finalize_expulsion(db: Session, process_id: int) -> MemberExpulsionProcess:
    """
    Manually called (or by a cron job) to finalize expulsion after deadline.
    """
    process = db.query(MemberExpulsionProcess).filter(MemberExpulsionProcess.id == process_id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Expulsion process not found")
        
    if process.final_status != "on_appeal":
        raise HTTPException(status_code=400, detail="Process is not in appeal state")
        
    member = db.query(Member).filter(Member.id == process.target_member_id).first()
    
    process.final_status = "expelled"
    if member:
        member.status = MemberStatus.EXPELLED
        
    db.commit()
    db.refresh(process)
    return process

def cancel_expulsion(db: Session, process_id: int, reason: str) -> MemberExpulsionProcess:
    """
    Called if an appeal is won.
    """
    process = db.query(MemberExpulsionProcess).filter(MemberExpulsionProcess.id == process_id).first()
    if not process:
        raise HTTPException(status_code=404, detail="Expulsion process not found")
        
    if process.final_status != "on_appeal":
        raise HTTPException(status_code=400, detail="Process is not in appeal state")
        
    member = db.query(Member).filter(Member.id == process.target_member_id).first()
    
    process.final_status = "appeal_won"
    process.appeal_notes = reason
    if member:
        member.status = MemberStatus.ACTIVE
        
    db.commit()
    db.refresh(process)
    return process
