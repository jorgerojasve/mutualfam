"""
Membership Module Router
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import json

from ...core.database import get_db
from ...core.auth import oauth2_scheme, decode_access_token
from ...core.permissions import require_role
from .models import Member, MemberStatus
from .schemas import MemberCreate, MemberResponse, MemberUpdate
from .service import MembershipService

router = APIRouter()

# Dependency to get current user
def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> Member:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    
    user = MembershipService.get_by_email(db, email=email)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    forbidden_states = [MemberStatus.WITHDRAWN, MemberStatus.EXPELLED, MemberStatus.MOROSO_BAJA]
    if user.status in forbidden_states:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=f"User account is in restricted state: {user.status}"
        )
        
    return user

@router.post("/register", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def register(request: MemberCreate, db: Session = Depends(get_db)):
    if MembershipService.get_by_email(db, request.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if MembershipService.get_by_identifier(db, request.identifier):
        raise HTTPException(status_code=400, detail="Identifier already registered")
        
    return MembershipService.create_member(db, request)

@router.get("/me", response_model=MemberResponse)
def get_me(current_user: Member = Depends(get_current_user)):
    return current_user

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Member).count()
    return {"total_members": total}

@router.patch("/me", response_model=MemberResponse)
def update_me(
    update_data: MemberUpdate, 
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    return MembershipService.update_member(db, current_user, update_data)

@router.get("/", response_model=List[MemberResponse])
def get_members(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    # Depending on configuration, any active member or only admins could see the directory
    # For now, we allow any logged in member to see the directory
    return MembershipService.get_all_members(db, skip=skip, limit=limit)

@router.patch("/{member_id}/approve", response_model=MemberResponse)
def approve_member(
    member_id: int, 
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    # Only admins can approve
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        
    member = MembershipService.get_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    if member.status != MemberStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Member is not pending, status is {member.status}")
        
    return MembershipService.approve_member(db, member)

# --- Withdrawal Endpoints ---
from . import withdrawal_service
from .schemas import MemberWithdrawalRequestResponse

@router.post("/withdrawal/request", response_model=MemberWithdrawalRequestResponse)
def request_withdrawal(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    return withdrawal_service.request_withdrawal(db, current_user.id)

@router.post("/withdrawal/cancel", response_model=MemberWithdrawalRequestResponse)
def cancel_withdrawal(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    return withdrawal_service.cancel_withdrawal(db, current_user.id)

@router.get("/withdrawal/status", response_model=MemberWithdrawalRequestResponse)
def get_withdrawal_status(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    status_record = withdrawal_service.get_withdrawal_status(db, current_user.id)
    if not status_record:
        raise HTTPException(status_code=404, detail="No withdrawal request found")
    return status_record

# --- Expulsion Endpoints ---
from . import expulsion_service
from .schemas import MemberExpulsionResponse

@router.get("/expulsion/{member_id}", response_model=MemberExpulsionResponse)
def get_expulsion_status(member_id: int, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    from .models import MemberExpulsionProcess
    process = db.query(MemberExpulsionProcess).filter(MemberExpulsionProcess.target_member_id == member_id).order_by(MemberExpulsionProcess.id.desc()).first()
    if not process:
        raise HTTPException(status_code=404, detail="No expulsion process found for member")
    return process

@router.post("/expulsion/{process_id}/finalize", response_model=MemberExpulsionResponse)
def finalize_expulsion(process_id: int, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return expulsion_service.finalize_expulsion(db, process_id)

# --- Organization Events ---
from . import organization_service
from .schemas import OrganizationEventResponse

@router.get("/organization/events", response_model=List[OrganizationEventResponse])
def get_organization_events(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    return organization_service.get_organization_events(db)

# --- Mitosis Endpoints ---
from . import mitosis_export
from pydantic import BaseModel

class MitosisExportRequest(BaseModel):
    leaving_member_ids: List[int]
    snapshot_name: str = "mitosis_snapshot"

@router.post("/mitosis/export")
def export_mitosis_snapshot(request: MitosisExportRequest, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    file_path = mitosis_export.generate_mitosis_snapshot(db, request.leaving_member_ids, request.snapshot_name)
    return {"status": "success", "file_path": file_path}


