from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from civiccore.core.database import get_db
from civiccore.modules.membership.models import User
from models import LoanRequest, LoanStatus, LoanContribution, ContributionStatus
from routers.membership import get_current_org_member
from services.telegram_bot import send_telegram_notification

router = APIRouter()

class LoanRequestCreate(BaseModel):
    amount_usd: float
    motive: str
    estimated_repayment_date: Optional[date] = None

class LoanRequestResponse(BaseModel):
    id: int
    amount_usd: float
    motive: str
    estimated_repayment_date: Optional[date]
    status: str
    requester_name: str
    requester_id: int
    
    class Config:
        from_attributes = True

@router.post("/", response_model=LoanRequestResponse)
def create_loan_request(
    loan: LoanRequestCreate, 
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    new_loan = LoanRequest(
        organization_id=org_member["organization"].id,
        requester_id=org_member["user"].id,
        amount_usd=loan.amount_usd,
        motive=loan.motive,
        estimated_repayment_date=loan.estimated_repayment_date,
        status=LoanStatus.PENDING
    )
    db.add(new_loan)
    db.commit()
    db.refresh(new_loan)
    
    # Notificación de Telegram real
    time_text = f"\n📅 Pago estimado: {loan.estimated_repayment_date.strftime('%d/%m/%Y')}" if loan.estimated_repayment_date else ""
    msg = f"🚨 <b>Nueva solicitud de préstamo</b>\n\n👤 {org_member['user'].first_name} solicitó <b>${loan.amount_usd}</b>\n📝 Motivo: {loan.motive}{time_text}"
    send_telegram_notification(msg)
    
    return {
        "id": new_loan.id,
        "amount_usd": new_loan.amount_usd,
        "motive": new_loan.motive,
        "estimated_repayment_date": new_loan.estimated_repayment_date,
        "status": new_loan.status.value,
        "requester_name": f'{org_member["user"].first_name} {org_member["user"].last_name}',
        "requester_id": new_loan.requester_id
    }

@router.get("/", response_model=List[LoanRequestResponse])
def get_loan_requests(
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    loans = db.query(LoanRequest).filter(
        LoanRequest.organization_id == org_member["organization"].id
    ).order_by(LoanRequest.created_at.desc()).all()
    
    response = []
    for l in loans:
        requester = db.query(User).filter(User.id == l.requester_id).first()
        response.append({
            "id": l.id,
            "amount_usd": l.amount_usd,
            "motive": l.motive,
            "estimated_repayment_date": l.estimated_repayment_date,
            "status": l.status.value,
            "requester_name": f'{requester.first_name} {requester.last_name}' if requester else "Desconocido",
            "requester_id": l.requester_id
        })
    return response

@router.delete("/{loan_id}")
def cancel_loan_request(
    loan_id: int,
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    loan = db.query(LoanRequest).filter(
        LoanRequest.id == loan_id,
        LoanRequest.organization_id == org_member["organization"].id
    ).first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
        
    if loan.requester_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="No puedes cancelar un préstamo que no solicitaste")
        
    if loan.status != LoanStatus.PENDING:
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar préstamos pendientes")
        
    loan.status = LoanStatus.CANCELLED
    db.commit()
    
    msg = f"❌ <b>Solicitud Cancelada</b>\n\n👤 {org_member['user'].first_name} ha cancelado su solicitud de ${loan.amount_usd}."
    send_telegram_notification(msg)
    
    return {"message": "Préstamo cancelado exitosamente"}

class ContributionCreate(BaseModel):
    amount_usd: float
    amount_ves: Optional[float] = None
    exchange_rate_used: Optional[float] = None
    payment_method: str
    receipt_url: Optional[str] = None

@router.post("/{loan_id}/contribute")
def contribute_to_loan(
    loan_id: int,
    contrib: ContributionCreate,
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    loan = db.query(LoanRequest).filter(
        LoanRequest.id == loan_id,
        LoanRequest.organization_id == org_member["organization"].id
    ).first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
        
    if loan.status in [LoanStatus.FUNDED, LoanStatus.REPAID, LoanStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Este préstamo ya no acepta aportes")
        
    new_contrib = LoanContribution(
        loan_request_id=loan.id,
        funder_id=org_member["user"].id,
        amount_usd=contrib.amount_usd,
        amount_ves=contrib.amount_ves,
        exchange_rate_used=contrib.exchange_rate_used,
        payment_method=contrib.payment_method,
        receipt_url=contrib.receipt_url,
        status=ContributionStatus.PENDING_PROOF
    )
    db.add(new_contrib)
    
    # Validar sumatoria de aportes
    from sqlalchemy import func
    
    total_contributed = db.query(func.sum(LoanContribution.amount_usd)).filter(
        LoanContribution.loan_request_id == loan.id,
        LoanContribution.status != ContributionStatus.REJECTED
    ).scalar() or 0.0
    
    total_contributed += contrib.amount_usd
    
    if total_contributed >= loan.amount_usd:
        loan.status = LoanStatus.FUNDED
    else:
        loan.status = LoanStatus.PARTIAL
        
    db.commit()
    db.refresh(new_contrib)
    
    msg = f"✅ <b>¡Nuevo Aporte!</b>\n\n👤 {org_member['user'].first_name} ha aportado <b>${contrib.amount_usd}</b> al préstamo de {loan.motive}."
    send_telegram_notification(msg)
    
    return {"message": "Aporte registrado exitosamente", "contribution_id": new_contrib.id}

@router.post("/{loan_id}/repay")
def repay_loan(
    loan_id: int,
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    loan = db.query(LoanRequest).filter(
        LoanRequest.id == loan_id,
        LoanRequest.organization_id == org_member["organization"].id
    ).first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
        
    if loan.requester_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="Solo el solicitante puede marcar el préstamo como pagado")
        
    if loan.status not in [LoanStatus.FUNDED, LoanStatus.PARTIAL]:
        raise HTTPException(status_code=400, detail="El préstamo no está activo o ya fue pagado")
        
    loan.status = LoanStatus.REPAID
    
    from datetime import datetime, timezone
    loan.repaid_at = datetime.now(timezone.utc)
    
    db.commit()
    
    msg = f"🎉 <b>¡Préstamo Saldado!</b>\n\n👤 {org_member['user'].first_name} ha devuelto el préstamo de <b>${loan.amount_usd}</b>."
    send_telegram_notification(msg)
    
    return {"message": "Préstamo marcado como pagado exitosamente"}
