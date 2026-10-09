from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from civiccore.core.database import get_db
from civiccore.modules.membership.models import User, OrganizationMembership, Organization, OrganizationInvite, InviteStatus, MemberStatus
from civiccore.core.auth import get_password_hash
import uuid
import secrets
from datetime import datetime, timedelta, timezone

from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from civiccore.core.config import settings
import os

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def utcnow():
    return datetime.now(timezone.utc)

# --- Códigos de invitación cortos y legibles ---
# Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para que se puedan dictar y escribir a mano.
INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
INVITE_CODE_LENGTH = 8  # 31^8 ≈ 8.5e11 combinaciones

def generate_invite_code(db: Session) -> str:
    for _ in range(10):
        code = "".join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))
        if not db.query(OrganizationInvite).filter(OrganizationInvite.token == code).first():
            return code
    raise HTTPException(status_code=500, detail="No se pudo generar un código de invitación único")

def extract_invite_candidate(raw: str) -> str:
    """Acepta el código, el token antiguo o el enlace completo pegado por el usuario."""
    text = (raw or "").strip()
    if "token=" in text:
        text = text.split("token=", 1)[1].split("&", 1)[0]
    elif "join/" in text:
        text = text.split("join/", 1)[1].split("?", 1)[0]
    return text.strip().strip("/")

def find_invite(db: Session, raw: str):
    candidate = extract_invite_candidate(raw)
    if not candidate:
        return None
    # 1) Coincidencia exacta (tokens antiguos token_urlsafe son sensibles a mayúsculas)
    invite = db.query(OrganizationInvite).filter(OrganizationInvite.token == candidate).first()
    if invite:
        return invite
    # 2) Código corto normalizado: sin espacios/guiones y en mayúsculas
    compact = candidate.replace("-", "").replace(" ", "").upper()
    if len(compact) == INVITE_CODE_LENGTH and all(c in INVITE_CODE_ALPHABET for c in compact):
        return db.query(OrganizationInvite).filter(OrganizationInvite.token == compact).first()
    return None

def format_invite_code(code: str) -> str:
    if len(code) == INVITE_CODE_LENGTH:
        return f"{code[:4]}-{code[4:]}"
    return code

def invite_is_expired(invite: OrganizationInvite, db: Session) -> bool:
    """Las invitaciones directas del fundador viven solo durante el período de gracia.
    Para invitaciones antiguas sin expires_at se usa el período de gracia de la mutual,
    salvo las creadas por una propuesta de gobernanza (proposal_id)."""
    expires_at = invite.expires_at
    if expires_at is None and invite.proposal_id is None:
        org = db.query(Organization).filter(Organization.id == invite.organization_id).first()
        expires_at = org.grace_period_ends_at if org else None
    return bool(expires_at and utcnow() > expires_at.replace(tzinfo=timezone.utc))

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
    full_name: str

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    hashed_pw = get_password_hash(req.password)
    parts = req.full_name.split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""
    
    new_user = User(
        email=req.email,
        hashed_password=hashed_pw,
        first_name=first_name,
        last_name=last_name,
        phone=""
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "Usuario registrado exitosamente", "user_id": new_user.id}

class CreateOrgRequest(BaseModel):
    name: str
    description: str = ""

@router.post("/organizations/create")
def create_organization(req: CreateOrgRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = Organization(
        name=req.name, 
        description=req.description,
        founder_user_id=current_user.id,
        grace_period_ends_at=utcnow() + timedelta(hours=24)
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    
    membership = OrganizationMembership(
        user_id=current_user.id,
        organization_id=org.id,
        role="founder",
        status=MemberStatus.ACTIVE
    )
    db.add(membership)
    db.commit()
    
    return {"message": "Mutual creada", "organization_id": org.id}

@router.post("/organizations/{org_id}/invites")
def create_invite(org_id: int, current_org_member: dict = Depends(get_current_org_member), db: Session = Depends(get_db)):
    membership = current_org_member["membership"]
    org = current_org_member["organization"]
    
    if not membership or membership.role != "founder":
        raise HTTPException(status_code=403, detail="Solo el fundador puede invitar directamente")
        
    if not org.grace_period_ends_at or utcnow() > org.grace_period_ends_at.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=403, detail="El período de gracia de 24 horas ha expirado. Debe proponerse en asamblea.")
        
    token = generate_invite_code(db)
    invite = OrganizationInvite(
        organization_id=org.id,
        created_by_user_id=current_org_member["user"].id,
        token=token,
        max_uses=None,
        expires_at=org.grace_period_ends_at,
        status=InviteStatus.ACTIVE
    )
    db.add(invite)
    db.commit()
    
    return {"token": token, "code": format_invite_code(token), "expires_at": invite.expires_at}

class JoinRequest(BaseModel):
    token: str

@router.post("/organizations/join")
def join_organization(req: JoinRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invite = find_invite(db, req.token)
    
    if not invite or invite.status != InviteStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Invitación inválida o inactiva")
        
    if invite_is_expired(invite, db):
        raise HTTPException(status_code=400, detail="Invitación expirada. Pídele a quien te invitó que te envíe una nueva.")
        
    if invite.max_uses and invite.uses_count >= invite.max_uses:
        raise HTTPException(status_code=400, detail="Invitación agotada")
        
    existing_membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == current_user.id,
        OrganizationMembership.organization_id == invite.organization_id
    ).first()
    
    if existing_membership:
        raise HTTPException(status_code=400, detail="Ya perteneces a esta mutual")
        
    invite.uses_count += 1
    
    membership = OrganizationMembership(
        user_id=current_user.id,
        organization_id=invite.organization_id,
        role="member",
        status=MemberStatus.ACTIVE,
        invited_by_token=invite.token
    )
    db.add(membership)
    db.commit()
    
    return {"message": "Te has unido exitosamente a la mutual", "organization_id": invite.organization_id}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == current_user.id).all()
    orgs = []
    for m in memberships:
        org = db.query(Organization).filter(Organization.id == m.organization_id).first()
        orgs.append({
            "id": org.id,
            "name": org.name,
            "role": m.role,
            "status": m.status,
            "grace_period_ends_at": org.grace_period_ends_at
        })
        
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "organizations": orgs
    }

@router.get("/invites/{token}")
def get_invite_info(token: str, db: Session = Depends(get_db)):
    invite = find_invite(db, token)
    if not invite or invite.status != InviteStatus.ACTIVE:
        raise HTTPException(status_code=404, detail="Invitación inválida o expirada")
    if invite_is_expired(invite, db):
        raise HTTPException(status_code=404, detail="Invitación expirada")
        
    org = db.query(Organization).filter(Organization.id == invite.organization_id).first()
    
    return {
        "organization_name": org.name,
        "organization_id": org.id,
        "token": invite.token,
        "code": format_invite_code(invite.token)
    }

@router.get("/members")
def get_organization_members(org_member: dict = Depends(get_current_org_member), db: Session = Depends(get_db)):
    org_id = org_member["organization"].id
    memberships = db.query(OrganizationMembership).filter(OrganizationMembership.organization_id == org_id).all()
    
    result = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            result.append({
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": m.role,
                "status": m.status,
                "joined_at": str(m.joined_at) if m.joined_at else None
            })
    return result
