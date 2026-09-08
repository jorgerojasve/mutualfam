"""
Membership Module Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

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
