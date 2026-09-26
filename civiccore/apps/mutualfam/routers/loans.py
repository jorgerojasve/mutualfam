from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from civiccore.core.database import get_db
from civiccore.modules.membership.models import User
import json
from models import LoanRequest, LoanStatus, LoanContribution, ContributionStatus, UserPaymentConfig, RepaymentStatus, LoanRepayment
from routers.membership import get_current_org_member
from services.telegram_bot import send_telegram_notification, send_telegram_photo

router = APIRouter()

class LoanRequestCreate(BaseModel):
    amount_usd: float
    motive: str
    estimated_repayment_date: Optional[date] = None
    accepted_payment_methods: List[str] = []

class RepaymentResponse(BaseModel):
    id: int
    amount_usd: float
    status: str
    payment_method: Optional[str]
    receipt_url: Optional[str]
    reference_text: Optional[str] = None

    class Config:
        from_attributes = True

class ContributionResponse(BaseModel):
    id: int
    funder_name: str
    funder_id: int
    amount_usd: float
    status: str
    payment_method: Optional[str]
    receipt_url: Optional[str]
    reference_text: Optional[str] = None
    funder_payment_methods_json: str = "{}"
    repayments: List[RepaymentResponse] = []
    
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
            funder_config = db.query(UserPaymentConfig).filter(UserPaymentConfig.user_id == funder.id).first() if funder else None
            
            if c.status == ContributionStatus.PLEDGED:
                amt_pledged += c.amount_usd
            elif c.status == ContributionStatus.PAID:
                amt_paid += c.amount_usd
            elif c.status == ContributionStatus.VERIFIED:
                amt_verified += c.amount_usd
                
            db_repayments = db.query(LoanRepayment).filter(LoanRepayment.contribution_id == c.id).all()
            repayments_data = []
            for r in db_repayments:
                repayments_data.append({
                    "id": r.id,
                    "amount_usd": r.amount_usd,
                    "status": r.status.value,
                    "payment_method": r.payment_method,
                    "receipt_url": r.receipt_url,
                    "reference_text": r.reference_text
                })

            contributions.append({
                "id": c.id,
                "funder_name": f'{funder.first_name} {funder.last_name}' if funder else "Desconocido",
                "funder_id": c.funder_id,
                "amount_usd": c.amount_usd,
                "status": c.status.value,
                "payment_method": c.payment_method,
                "receipt_url": c.receipt_url,
                "reference_text": c.reference_text,
                "funder_payment_methods_json": funder_config.payment_methods_json if funder_config else "{}",
                "repayments": repayments_data
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
    reference_text: Optional[str] = None

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

@router.delete("/contributions/{contrib_id}")
def cancel_contribution(
    contrib_id: int,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    contrib = db.query(LoanContribution).filter(LoanContribution.id == contrib_id).first()
    if not contrib:
        raise HTTPException(status_code=404, detail="Aporte no encontrado")
        
    if contrib.funder_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="No puedes cancelar un aporte que no es tuyo")
        
    if contrib.status != ContributionStatus.PLEDGED:
        raise HTTPException(status_code=400, detail="Solo puedes cancelar aportes prometidos que no hayan sido pagados")
        
    loan = db.query(LoanRequest).filter(LoanRequest.id == contrib.loan_request_id).first()
    
    amount = contrib.amount_usd
    db.delete(contrib)
    db.commit()
    
    # Recalcular estatus del préstamo
    if loan:
        from sqlalchemy import func
        total_contributed = db.query(func.sum(LoanContribution.amount_usd)).filter(
            LoanContribution.loan_request_id == loan.id,
            LoanContribution.status != ContributionStatus.REJECTED
        ).scalar() or 0.0
        
        if total_contributed >= loan.amount_usd:
            loan.status = LoanStatus.FUNDED
        elif total_contributed > 0:
            loan.status = LoanStatus.PARTIAL
        else:
            loan.status = LoanStatus.PENDING
            
        db.commit()
        
    msg = f"❌ <b>Aporte Cancelado</b>\n\n👤 {org_member['user'].first_name} ha cancelado su promesa de aporte de <b>${amount}</b>."
    send_telegram_notification(msg)
    
    return {"message": "Aporte cancelado exitosamente"}

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
    contrib.reference_text = notify.reference_text
    db.commit()
    
    msg = f"💸 <b>¡Pago Notificado!</b>\n\n👤 {org_member['user'].first_name} ha pagado su aporte de <b>${contrib.amount_usd}</b>."
    if notify.reference_text:
        msg += f"\n📝 Referencia: {notify.reference_text}"
        
    if notify.receipt_url:
        import os
        photo_path = f".{notify.receipt_url}"
        if os.path.exists(photo_path):
            send_telegram_photo(msg, photo_path)
        else:
            send_telegram_notification(msg)
    else:
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

class RepaymentNotify(BaseModel):
    amount_usd: float
    payment_method: str
    receipt_url: Optional[str] = None
    reference_text: Optional[str] = None

@router.post("/contributions/{contrib_id}/repay")
def notify_return_payment(
    contrib_id: int,
    repay: RepaymentNotify,
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
        raise HTTPException(status_code=403, detail="Solo el solicitante del préstamo puede devolver pagos")
        
    if contrib.status != ContributionStatus.VERIFIED:
        raise HTTPException(status_code=400, detail="Solo se puede devolver aportes que hayan sido validados por ti")
        
    new_repay = LoanRepayment(
        contribution_id=contrib.id,
        amount_usd=repay.amount_usd,
        payment_method=repay.payment_method,
        receipt_url=repay.receipt_url,
        reference_text=repay.reference_text,
        status=RepaymentStatus.PAID
    )
    db.add(new_repay)
    
    contrib.status = ContributionStatus.REPAY_NOTIFIED
    db.commit()
    
    funder = db.query(User).filter(User.id == contrib.funder_id).first()
    msg = f"💸 <b>¡Devolución Notificada!</b>\n\n👤 {org_member['user'].first_name} ha notificado la devolución de <b>${repay.amount_usd}</b> a {funder.first_name}."
    
    if repay.reference_text:
        msg += f"\n📝 Referencia: {repay.reference_text}"
        
    if repay.receipt_url:
        import os
        photo_path = f".{repay.receipt_url}"
        if os.path.exists(photo_path):
            send_telegram_photo(msg, photo_path)
        else:
            send_telegram_notification(msg)
    else:
        send_telegram_notification(msg)
    
    return {"message": "Devolución notificada exitosamente"}

@router.post("/repayments/{repay_id}/verify")
def verify_return_payment(
    repay_id: int,
    org_member: dict = Depends(get_current_org_member), 
    db: Session = Depends(get_db)
):
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")
        
    repay = db.query(LoanRepayment).filter(LoanRepayment.id == repay_id).first()
    if not repay:
        raise HTTPException(status_code=404, detail="Devolución no encontrada")
        
    contrib = db.query(LoanContribution).filter(LoanContribution.id == repay.contribution_id).first()
    
    if contrib.funder_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="Solo el aportante puede verificar que recibió la devolución")
        
    if repay.status != RepaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Esta devolución ya fue procesada")
        
    from datetime import datetime, timezone
    repay.status = RepaymentStatus.VERIFIED
    repay.verified_at = datetime.now(timezone.utc)
    
    # Flush para que el SUM en la DB tome en cuenta este repayment ya verificado
    db.flush()
    
    from sqlalchemy import func
    total_verified = db.query(func.sum(LoanRepayment.amount_usd)).filter(
        LoanRepayment.contribution_id == contrib.id,
        LoanRepayment.status == RepaymentStatus.VERIFIED
    ).scalar() or 0.0
    
    if total_verified >= contrib.amount_usd:
        contrib.status = ContributionStatus.REPAID
        
    db.commit()
    
    loan = db.query(LoanRequest).filter(LoanRequest.id == contrib.loan_request_id).first()
    all_contribs = db.query(LoanContribution).filter(
        LoanContribution.loan_request_id == loan.id,
        LoanContribution.status != ContributionStatus.REJECTED
    ).all()
    
    all_repaid = True
    for c in all_contribs:
        if c.status != ContributionStatus.REPAID:
            all_repaid = False
            break
            
    if all_repaid and len(all_contribs) > 0:
        loan.status = LoanStatus.REPAID
        loan.repaid_at = datetime.now(timezone.utc)
        db.commit()
        msg = f"🎉 <b>¡Préstamo Saldado!</b>\n\n👤 El préstamo de {loan.amount_usd} de la mutual ha sido devuelto en su totalidad."
        send_telegram_notification(msg)
    else:
        msg = f"👍 <b>¡Devolución Verificada!</b>\n\n👤 {org_member['user'].first_name} confirmó recibir <b>${repay.amount_usd}</b>."
        send_telegram_notification(msg)
    
    return {"message": "Devolución verificada exitosamente"}
