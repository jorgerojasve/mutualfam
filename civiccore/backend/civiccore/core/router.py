from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .auth import create_access_token, create_refresh_token, decode_access_token
from ..modules.membership.service import MembershipService

router = APIRouter()

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Authenticate member
    member = MembershipService.get_by_email(db, email=form_data.username)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # In a real app we'd check hashed password. For this prototype we accept any password for valid users, 
    # or just do a simple check.
    # if not verify_password(form_data.password, member.hashed_password):
    #     raise HTTPException(...)
    
    access_token = create_access_token(data={"sub": member.email})
    refresh_token = create_refresh_token(data={"sub": member.email})
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh")
def refresh_token(token: str = Depends(OAuth2PasswordBearer(tokenUrl="api/v1/auth/login"))):
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    
    email = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token payload")
        
    new_access_token = create_access_token(data={"sub": email})
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.get("/me")
def get_me(db: Session = Depends(get_db), token: str = Depends(OAuth2PasswordBearer(tokenUrl="api/v1/auth/login"))):
    from .auth import decode_access_token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    member = MembershipService.get_by_email(db, email=payload.get("sub"))
    if not member:
        raise HTTPException(status_code=404, detail="User not found")
    return member
