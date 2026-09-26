from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from civiccore.core.database import get_db
from civiccore.modules.membership.models import User
import json
from models import LoanRequest, LoanStatus, LoanContribution, ContributionStatus, UserPaymentConfig
from routers.membership import get_current_org_member
from services.telegram_bot import send_telegram_notification

router = APIRouter()

class LoanRequestCreate(BaseModel):
    amount_usd: float
    motive: str
    estimated_repayment_date: Optional[date] = None
    accepted_payment_methods: List[str] = []

class ContributionResponse(BaseModel):
    id: int
    funder_name: str
    funder_id: int
    amount_usd: float
    status: str
    payment_method: Optional[str]
    receipt_url: Optional[str]
    
    class Config:
        from_attributes = True

class LoanRequestResponse(BaseModel):
    id: int
    amount_usd: float
    motive: str
    estimated_repayment_date: Optional[date]
    status: str
    requester_name: str
    requester_id: int
    
    accepted_payment_methods: List[str] = []
    requester_payment_methods_json: str = "{}"
    
    amount_pledged: float = 0.0
    amount_paid: float = 0.0
    amount_verified: float = 0.0
    contributions: List[ContributionResponse] = []
    
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
        status=LoanStatus.PENDING,
        accepted_payment_methods=json.dumps(loan.accepted_payment_methods)
    )
    db.add(new_loan)
    db.commit()
    db.refresh(new_loan)
    
    # Notificación de Telegram real
    time_text = f"\n📅 Pago estimado: {loan.estimated_repayment_date.strftime('%d/%m/%Y')}" if loan.estimated_repayment_date else ""
    msg = f"🚨 <b>Nueva solicitud de préstamo</b>\n\n👤 {org_member['user'].first_name} solicitó <b>${loan.amount_usd}</b>\n📝 Motivo: {loan.motive}{time_text}"
    send_telegram_notification(msg)
    
    requester_config = db.query(UserPaymentConfig).filter(UserPaymentConfig.user_id == org_member["user"].id).first()
    
    return {
        "id": new_loan.id,
        "amount_usd": new_loan.amount_usd,
        "motive": new_loan.motive,
        "estimated_repayment_date": new_loan.estimated_repayment_date,
        "status": new_loan.status.value,
        "requester_name": f'{org_member["user"].first_name} {org_member["user"].last_name}',
        "requester_id": new_loan.requester_id,
        "accepted_payment_methods": loan.accepted_payment_methods,
        "requester_payment_methods_json": requester_config.payment_methods_json if requester_config else "{}",
        "amount_pledged": 0.0,
        "amount_paid": 0.0,
        "amount_verified": 0.0,
        "contributions": []
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
        
        db_contribs = db.query(LoanContribution).filter(LoanContribution.loan_request_id == l.id).all()
        contributions = []
        amt_pledged = 0.0
        amt_paid = 0.0
        amt_verified = 0.0
        
        for c in db_contribs:
            funder = db.query(User).filter(User.id == c.funder_id).first()
            if c.status == ContributionStatus.PLEDGED:
                amt_pledged += c.amount_usd
            elif c.status == ContributionStatus.PAID:
                amt_paid += c.amount_usd
            elif c.status == ContributionStatus.VERIFIED:
                amt_verified += c.amount_usd
                
            contributions.append({
                "id": c.id,
                "funder_name": f'{funder.first_name} {funder.last_name}' if funder else "Desconocido",
                "funder_id": c.funder_id,
                "amount_usd": c.amount_usd,
                "status": c.status.value,
                "payment_method": c.payment_method,
                "receipt_url": c.receipt_url
            })
            
        requester_config = db.query(UserPaymentConfig).filter(UserPaymentConfig.user_id == l.requester_id).first()
        
        try:
            accepted_pm = json.loads(l.accepted_payment_methods)
        except:
            accepted_pm = []
            
        response.append({
            "id": l.id,
            "amount_usd": l.amount_usd,
            "motive": l.motive,
            "estimated_repayment_date": l.estimated_repayment_date,
            "status": l.status.value,
            "requester_name": f'{requester.first_name} {requester.last_name}' if requester else "Desconocido",
            "requester_id": l.requester_id,
            "accepted_payment_methods": accepted_pm,
            "requester_payment_methods_json": requester_config.payment_methods_json if requester_config else "{}",
            "amount_pledged": amt_pledged,
            "amount_paid": amt_paid,
            "amount_verified": amt_verified,
            "contributions": contributions
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

class ContributionNotify(BaseModel):
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
        status=ContributionStatus.PLEDGED
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
    
    msg = f"✅ <b>¡Nuevo Aporte Prometido!</b>\n\n👤 {org_member['user'].first_name} se comprometió a aportar <b>${contrib.amount_usd}</b> al préstamo de {loan.motive}."
    send_telegram_notification(msg)
    
    return {"message": "Aporte prometido exitosamente", "contribution_id": new_contrib.id}

@router.post("/contributions/{contrib_id}/notify_payment")
def notify_payment(
    contrib_id: int,
    notify: ContributionNotify,
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    contrib = db.query(LoanContribution).filter(LoanContribution.id == contrib_id).first()
    if not contrib:
        raise HTTPException(status_code=404, detail="Aporte no encontrado")
        
    if contrib.funder_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="Solo el aportante puede notificar el pago")
        
    if contrib.status != ContributionStatus.PLEDGED:
        raise HTTPException(status_code=400, detail="Solo se puede notificar pago de aportes prometidos")
        
    contrib.status = ContributionStatus.PAID
    contrib.payment_method = notify.payment_method
    contrib.receipt_url = notify.receipt_url
    db.commit()
    
    msg = f"💸 <b>¡Pago Notificado!</b>\n\n👤 {org_member['user'].first_name} ha pagado su aporte de <b>${contrib.amount_usd}</b>."
    send_telegram_notification(msg)
    
    return {"message": "Pago notificado exitosamente"}

@router.post("/contributions/{contrib_id}/verify_payment")
def verify_payment(
    contrib_id: int,
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    contrib = db.query(LoanContribution).filter(LoanContribution.id == contrib_id).first()
    if not contrib:
        raise HTTPException(status_code=404, detail="Aporte no encontrado")
        
    loan = db.query(LoanRequest).filter(LoanRequest.id == contrib.loan_request_id).first()
    if not loan or loan.requester_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="Solo el solicitante del préstamo puede verificar los pagos")
        
    if contrib.status != ContributionStatus.PAID:
        raise HTTPException(status_code=400, detail="Solo se pueden verificar aportes que hayan notificado pago")
        
    contrib.status = ContributionStatus.VERIFIED
    db.commit()
    
    msg = f"👍 <b>¡Pago Verificado!</b>\n\n👤 {org_member['user'].first_name} confirmó recibir el aporte de <b>${contrib.amount_usd}</b>."
    send_telegram_notification(msg)
    
    return {"message": "Pago verificado exitosamente"}

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
