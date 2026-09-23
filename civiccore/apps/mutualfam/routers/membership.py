from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from civiccore.core.database import get_db
from civiccore.modules.membership.models import User, OrganizationMembership, Organization
from civiccore.core.auth import get_password_hash

# We need a dependency to get the current User.
# Since civiccore has get_current_member which expects a Member, we will create get_current_user here.
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from civiccore.core.config import settings
import os

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="No se pudo validar las credenciales")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_org_member(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org_id = request.headers.get("X-Organization-ID")
    if not org_id:
        # If no organization selected, just return user so frontend doesn't crash on initial load
        return {"user": current_user, "membership": None, "organization": None}
        
    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == current_user.id,
        OrganizationMembership.organization_id == int(org_id)
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="No perteneces a esta mutual")
        
    org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    return {"user": current_user, "membership": membership, "organization": org}

class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    identifier: str

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    hashed_pw = get_password_hash(req.password)
    
    new_user = User(
        email=req.email,
        hashed_password=hashed_pw,
        first_name=req.first_name,
        last_name=req.last_name,
        phone=""
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Lógica de auto-creación / auto-unión a la Mutual Familiar (MVP)
    org = db.query(Organization).first()
    if not org:
        org = Organization(name="Mi Mutual Familiar", description="Fondo y préstamos de nuestra familia")
        db.add(org)
        db.commit()
        db.refresh(org)
        role = "admin"
    else:
        role = "member"
        
    membership = OrganizationMembership(
        user_id=new_user.id,
        organization_id=org.id,
        role=role,
        status="active"
    )
    db.add(membership)
    db.commit()
    
    return {"message": "Usuario registrado exitosamente", "user_id": new_user.id}

@router.get("/me")
def get_me(current_org_member: dict = Depends(get_current_org_member), db: Session = Depends(get_db)):
    user = current_org_member["user"]
    membership = current_org_member["membership"]
    
    # We return data compatible with the frontend expectations
    # In MutualFam, a user might not have a membership selected initially
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": membership.role if membership else "user",
        "status": membership.status if membership else "active",
        "has_organization": membership is not None
    }
