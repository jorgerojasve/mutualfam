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

# --- Progressive Fusion Routes ---
from .schemas import FusionProcessResponse, FusionProcessAdvanceRequest, FusionProcessDataUpdate

@router.get("/organization/fusion-processes", response_model=List[FusionProcessResponse])
def get_fusion_processes(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    return organization_service.get_fusion_processes(db)

@router.get("/organization/fusion-processes/{process_id}", response_model=FusionProcessResponse)
def get_fusion_process(process_id: int, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    process = organization_service.get_fusion_process(db, process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Fusion process not found")
    return process

@router.post("/organization/fusion-processes/{process_id}/advance", response_model=FusionProcessResponse)
def advance_fusion(
    process_id: int, 
    request: FusionProcessAdvanceRequest,
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can advance fusion stages")
    from .models import FusionStage
    try:
        stage_enum = FusionStage(request.stage)
        return organization_service.advance_fusion_stage(db, process_id, stage_enum)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/organization/fusion-processes/{process_id}/data", response_model=FusionProcessResponse)
def update_fusion_data(
    process_id: int, 
    request: FusionProcessDataUpdate,
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update fusion data")
    try:
        return organization_service.update_fusion_data(
            db, 
            process_id, 
            external_data=request.external_data,
            internal_data=request.internal_data,
            conflict_points=request.conflict_points
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/organization/fusion-processes/{process_id}/upload")
async def upload_fusion_snapshot(
    process_id: int,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can perform fusion")
        
    try:
        contents = await file.read()
        snapshot_dict = json.loads(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
        
    try:
        # Execute the fusion (integration) and also mark process as COMPLETED
        result = organization_service.execute_fusion(db, snapshot_dict)
        from .models import FusionStage
        organization_service.advance_fusion_stage(db, process_id, FusionStage.COMPLETED)
        # Store result in external_data for record
        organization_service.update_fusion_data(db, process_id, external_data={"integration_result": result})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


