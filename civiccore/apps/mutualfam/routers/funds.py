from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from civiccore.core.database import get_db
from models import Fund, FundType, FundContribution, ContributionStatus
from routers.membership import get_current_org_member
from services.telegram_bot import send_telegram_notification

router = APIRouter()

class FundResponse(BaseModel):
    id: int
    name: str
    fund_type: str
    target_monthly_contribution_usd: Optional[float]
    
    class Config:
        from_attributes = True

class CreateFundRequest(BaseModel):
    name: str
    fund_type: str = "emergency"
    target_monthly_contribution_usd: Optional[float] = None

@router.post("/", response_model=FundResponse)
def create_fund(
    req: CreateFundRequest,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    if org_member["membership"].role != "founder":
        raise HTTPException(status_code=403, detail="Solo los fundadores pueden crear fondos")
        
    new_fund = Fund(
        organization_id=org_member["organization"].id,
        name=req.name,
        fund_type=req.fund_type,
        target_monthly_contribution_usd=req.target_monthly_contribution_usd
    )
    db.add(new_fund)
    db.commit()
    db.refresh(new_fund)
    
    msg = f"🏦 <b>¡Nuevo Fondo Creado!</b>\n\n👤 {org_member['user'].first_name} ha creado el fondo <i>{new_fund.name}</i> para la mutual."
    send_telegram_notification(msg)
    
    return new_fund

@router.get("/", response_model=List[FundResponse])
def get_funds(
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    funds = db.query(Fund).filter(
        Fund.organization_id == org_member["organization"].id
    ).all()
    
    return funds

class FundContributionCreate(BaseModel):
    amount_usd: float
    payment_method: str
    receipt_url: Optional[str] = None

@router.post("/{fund_id}/contribute")
def contribute_to_fund(
    fund_id: int,
    contrib: FundContributionCreate,
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    fund = db.query(Fund).filter(
        Fund.id == fund_id,
        Fund.organization_id == org_member["organization"].id
    ).first()
    
    if not fund:
        raise HTTPException(status_code=404, detail="Fondo no encontrado")
        
    new_contrib = FundContribution(
        fund_id=fund.id,
        contributor_id=org_member["user"].id,
        amount_usd=contrib.amount_usd,
        payment_method=contrib.payment_method,
        receipt_url=contrib.receipt_url,
        status=ContributionStatus.PLEDGED
    )
    db.add(new_contrib)
    db.commit()
    db.refresh(new_contrib)
    
    msg = f"💰 <b>¡Nuevo Aporte al Fondo!</b>\n\n👤 {org_member['user'].first_name} aportó <b>${contrib.amount_usd}</b> a <i>{fund.name}</i>."
    send_telegram_notification(msg)
    
    return {"message": "Aporte al fondo registrado exitosamente", "contribution_id": new_contrib.id}
