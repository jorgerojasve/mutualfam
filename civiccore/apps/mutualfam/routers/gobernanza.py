"""
Router de Gobernanza para MutualFam
Maneja propuestas de ingreso y expulsión de miembros, votación, debate, defensa y resolución.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import math

from civiccore.core.database import get_db
from civiccore.modules.membership.models import (
    User,
    OrganizationMembership,
    MemberStatus,
    Organization,
    OrganizationInvite,
    InviteStatus
)
from civiccore.modules.governance.models import (
    Proposal,
    ProposalStatus,
    ProposalType,
    Vote,
    VotingMechanism,
    Comment,
    utcnow
)
from civiccore.modules.governance.schemas import ProposalCreate, VoteCreate
from civiccore.modules.governance.service import GovernanceService
from civiccore.modules.membership import admission_service
from civiccore.modules.config.service import ConfigService
from civiccore.core.config import is_qa_environment
from routers.membership import get_current_org_member, get_current_user
from services.notifications import notify_users
from services.realtime import notify_org
from services.telegram_bot import send_telegram_notification, send_telegram_photo
from services.limits import (
    check_can_create_proposal,
    record_proposal_created,
    get_proposal_throttle_status
)

router = APIRouter()

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class ProponerIngresoRequest(BaseModel):
    candidate_name: Optional[str] = None
    candidate_relation: Optional[str] = None
    candidate_phone: Optional[str] = None
    candidate_user_id: Optional[int] = None
    justificacion: Optional[str] = None
    motive: Optional[str] = None

class ProponerExpulsionRequest(BaseModel):
    target_user_id: Optional[int] = None
    target_member_id: Optional[int] = None
    motivo: Optional[str] = None
    motive: Optional[str] = None

class VotarRequest(BaseModel):
    voto: str  # "si", "no", "abstencion"

class DefensaRequest(BaseModel):
    defense_text: str

class ComentarioRequest(BaseModel):
    content: str
    stance: Optional[str] = None  # "favor", "contra", "duda", "neutro"
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None  # "image", "audio", "drawing", "link"
    is_anonymous: Optional[bool] = False


# ==========================================
# HELPERS
# ==========================================

def dispatch_proposal_resolution_notifications(db: Session, proposal: Proposal, org_id: Optional[int] = None):
    """
    Despacha las notificaciones push y eventos WebSocket cuando una propuesta
    concluye y es resuelta (Aprobada o Rechazada).
    """
    try:
        oid = org_id or proposal.organization_id
        if not oid:
            return

        extra = dict(proposal.extra_fields or {})
        if extra.get("resolution_notified"):
            return  # Evitar notificaciones duplicadas
        extra["resolution_notified"] = True
        proposal.extra_fields = extra
        db.commit()

        all_members = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == oid,
            OrganizationMembership.status == MemberStatus.ACTIVE
        ).all()
        all_user_ids = [m.user_id for m in all_members]

        target_user = db.query(User).filter(User.id == proposal.target_member_id).first() if proposal.target_member_id else None
        target_name = f"{target_user.first_name} {target_user.last_name}".strip() if target_user else "Usuario"

        if proposal.status == ProposalStatus.APPROVED:
            if proposal.proposal_type == ProposalType.MEMBER_ADMISSION:
                notify_users(
                    db,
                    all_user_ids,
                    "🎉 Nuevo Miembro Admitido",
                    f"¡{target_name} ha sido admitido como nuevo miembro de la mutual!",
                    {"proposal_id": proposal.id}
                )
            elif proposal.proposal_type == ProposalType.EXPULSION:
                notify_users(
                    db,
                    all_user_ids,
                    "⚠️ Expulsión Aprobada",
                    f"{target_name} ha sido expulsado de la mutual.",
                    {"proposal_id": proposal.id}
                )
                if proposal.target_member_id:
                    motivo_text = f" Motivo: {proposal.content}" if proposal.content else ""
                    notify_users(
                        db,
                        [proposal.target_member_id],
                        "⚠️ Membresía Revocada por la Asamblea",
                        f"La asamblea familiar ha aprobado tu expulsión de la mutual.{motivo_text}",
                        {"proposal_id": proposal.id, "type": "expulsion"}
                    )
        elif proposal.status == ProposalStatus.REJECTED:
            if proposal.proposal_type == ProposalType.MEMBER_ADMISSION:
                veto_info = ""
                if proposal.extra_fields and proposal.extra_fields.get("veto_activated"):
                    veto_info = " por veto en asamblea"
                notify_users(
                    db,
                    [proposal.author_id],
                    "🚫 Admisión Rechazada",
                    f"La propuesta de ingreso de {target_name} fue rechazada{veto_info}.",
                    {"proposal_id": proposal.id}
                )
            elif proposal.proposal_type == ProposalType.EXPULSION:
                reason_info = ""
                if proposal.extra_fields and proposal.extra_fields.get("rejection_reason"):
                    reason_info = f" ({proposal.extra_fields.get('rejection_reason')})"
                notify_users(
                    db,
                    all_user_ids,
                    "🛡️ Expulsión Rechazada",
                    f"La propuesta de expulsión de {target_name} fue rechazada{reason_info}. El miembro permanece activo.",
                    {"proposal_id": proposal.id}
                )

        notify_org(oid, "PROPUESTA_RESUELTA", {
            "proposal_id": proposal.id,
            "status": proposal.status.value,
            "passed": (proposal.status == ProposalStatus.APPROVED)
        })
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Error despachando notificaciones de resolución: {e}")


def _serialize_proposal(db: Session, p: Proposal, current_user_id: int) -> Dict[str, Any]:
    GovernanceService._enrich_proposal(db, p)

    if p.status in (ProposalStatus.APPROVED, ProposalStatus.REJECTED):
        if not (p.extra_fields and p.extra_fields.get("resolution_notified")):
            dispatch_proposal_resolution_notifications(db, p, p.organization_id)
    
    author = db.query(User).filter(User.id == p.author_id).first()
    author_name = f"{author.first_name} {author.last_name}".strip() if author else "Desconocido"

    target_user = None
    target_name = None
    if p.target_member_id:
        target_user = db.query(User).filter(User.id == p.target_member_id).first()
        if target_user:
            target_name = f"{target_user.first_name} {target_user.last_name}".strip()

    candidate_name_extra = p.extra_fields.get("candidate_name") if p.extra_fields else None
    candidate_relation = p.extra_fields.get("candidate_relation") if p.extra_fields else None

    is_approved = (p.status == ProposalStatus.APPROVED)
    is_admission = (p.proposal_type == ProposalType.MEMBER_ADMISSION)
    is_author = (current_user_id == p.author_id)

    # Verificar si el miembro ya se incorporó a la mutual
    member_joined = bool(p.extra_fields and (p.extra_fields.get("member_joined") or p.extra_fields.get("redeemed_by_name")))
    redeemed_by_name = p.extra_fields.get("redeemed_by_name") if p.extra_fields else None

    invite = None
    if is_admission:
        invite = db.query(OrganizationInvite).filter(OrganizationInvite.proposal_id == p.id).first()
        if not member_joined:
            if invite and invite.uses_count and invite.uses_count > 0:
                member_joined = True
                m = db.query(OrganizationMembership).filter(
                    OrganizationMembership.organization_id == p.organization_id,
                    OrganizationMembership.invited_by_token == invite.token
                ).first()
                if m:
                    u = db.query(User).filter(User.id == m.user_id).first()
                    if u:
                        redeemed_by_name = f"{u.first_name} {u.last_name}".strip()
            elif p.target_member_id and p.organization_id:
                m = db.query(OrganizationMembership).filter(
                    OrganizationMembership.user_id == p.target_member_id,
                    OrganizationMembership.organization_id == p.organization_id,
                    OrganizationMembership.status == MemberStatus.ACTIVE
                ).first()
                if m:
                    member_joined = True

    now = utcnow()

    # Verificar si expiró la invitación (15 días sin canje) o fue cancelada
    is_invite_expired = False
    admission_cancelled = bool(p.extra_fields and (p.extra_fields.get("admission_cancelled") or p.extra_fields.get("admission_expired")))

    if is_admission and is_approved and not member_joined and not admission_cancelled:
        expires_at_dt = None
        if invite and invite.expires_at:
            expires_at_dt = invite.expires_at.replace(tzinfo=timezone.utc) if invite.expires_at.tzinfo is None else invite.expires_at
        elif p.extra_fields and p.extra_fields.get("expires_at"):
            try:
                raw_exp = p.extra_fields.get("expires_at")
                expires_at_dt = datetime.fromisoformat(raw_exp.replace("Z", "+00:00"))
                if expires_at_dt.tzinfo is None:
                    expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass

        if expires_at_dt and now >= expires_at_dt:
            is_invite_expired = True
            admission_cancelled = True
            if not (p.extra_fields and p.extra_fields.get("admission_cancelled")):
                extra = dict(p.extra_fields or {})
                extra["admission_cancelled"] = True
                extra["admission_expired"] = True
                extra["cancellation_reason"] = "Invitación expirada (15 días sin canje)"
                extra["cancelled_at"] = now.isoformat()
                p.extra_fields = extra
                if invite:
                    invite.status = InviteStatus.EXPIRED
                try:
                    db.commit()
                except Exception:
                    db.rollback()

    # El código para nuevo ingreso solo debe salir a quien hace la propuesta (el autor)
    can_see_invite = (
        is_approved
        and is_admission
        and is_author
        and not member_joined
        and not admission_cancelled
    )
    invite_token = (p.extra_fields.get("invite_token") if p.extra_fields else None) if can_see_invite else None
    invite_code_formatted = (p.extra_fields.get("invite_code_formatted") if p.extra_fields else None) if can_see_invite else None
    invite_expires_at = (p.extra_fields.get("expires_at") if p.extra_fields else None) if is_approved else None

    # No se debe pasar la propuesta al historial hasta que no ingrese el nuevo miembro,
    # mientras debe permanecer en activo. Si pasa mucho tiempo sin que ingrese se cancela su ingreso y pasa al historial.
    if is_admission and is_approved:
        is_active_proposal = (not member_joined) and (not admission_cancelled)
    else:
        is_active_proposal = (p.status in (ProposalStatus.DEBATE, ProposalStatus.VOTING))

    my_vote_record = db.query(Vote).filter(
        Vote.proposal_id == p.id,
        Vote.member_id == current_user_id
    ).first()
    
    my_vote = None
    if my_vote_record:
        if my_vote_record.vote_value == 1.0:
            my_vote = "si"
        elif my_vote_record.vote_value == -1.0:
            my_vote = "no"
        elif my_vote_record.vote_value == 0.0:
            my_vote = "abstencion"

    time_remaining_seconds = 0
    phase_label = "Debate"
    
    if p.status == ProposalStatus.DEBATE and p.voting_starts_at:
        v_start = p.voting_starts_at.replace(tzinfo=timezone.utc) if p.voting_starts_at.tzinfo is None else p.voting_starts_at
        diff = (v_start - now).total_seconds()
        time_remaining_seconds = max(0, int(diff))
        phase_label = "Fase de Debate"
    elif p.status == ProposalStatus.VOTING and p.voting_ends_at:
        v_end = p.voting_ends_at.replace(tzinfo=timezone.utc) if p.voting_ends_at.tzinfo is None else p.voting_ends_at
        diff = (v_end - now).total_seconds()
        time_remaining_seconds = max(0, int(diff))
        phase_label = "Votación Abierta"
    elif p.status == ProposalStatus.APPROVED:
        if is_admission:
            if member_joined:
                phase_label = "Ingreso Concretado"
            elif admission_cancelled:
                phase_label = "Ingreso Cancelado (Expirado)"
            else:
                phase_label = "Esperando Ingreso"
        else:
            phase_label = "Aprobada"
    elif p.status == ProposalStatus.REJECTED:
        phase_label = "Rechazada"

    # Nominative veto info
    vetantes_names = []
    if p.extra_fields and "vetantes_ids" in p.extra_fields:
        v_ids = p.extra_fields["vetantes_ids"]
        if v_ids:
            v_users = db.query(User).filter(User.id.in_(v_ids)).all()
            vetantes_names = [f"{u.first_name} {u.last_name}".strip() for u in v_users]

    # Censo total de miembros activos de la mutual
    if p.organization_id:
        total_active_members = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == p.organization_id,
            OrganizationMembership.status == MemberStatus.ACTIVE
        ).count()
    else:
        from civiccore.modules.governance.models import Member
        total_active_members = db.query(Member).count()
    total_active_members = max(total_active_members, 1)

    votes = db.query(Vote).filter(Vote.proposal_id == p.id).all()
    total_casted = len(votes)

    target_id = p.target_member_id
    is_expulsion = (p.proposal_type == ProposalType.EXPULSION)
    eligible_active_members = max(1, total_active_members - 1) if (is_expulsion and target_id and total_active_members > 1) else total_active_members
    pending_votes = max(0, (eligible_active_members if is_expulsion else total_active_members) - total_casted)

    deadline_passed = False
    if p.voting_ends_at:
        v_end = p.voting_ends_at.replace(tzinfo=timezone.utc) if p.voting_ends_at.tzinfo is None else p.voting_ends_at
        deadline_passed = (now >= v_end)

    yes_votes = float(getattr(p, "votes_yes", 0.0) or 0.0)
    no_votes = float(getattr(p, "votes_no", 0.0) or 0.0)
    abstain_votes = float(getattr(p, "votes_abstain", 0.0) or 0.0)

    # Cálculo riguroso según tipo de propuesta
    if p.proposal_type == ProposalType.MEMBER_ADMISSION:
        threshold_ratio = float(ConfigService.get_value(db, "ADMISION_UMBRAL", "0.75"))
        votes_yes_needed = int(math.ceil(total_active_members * threshold_ratio))
        veto_enabled = str(ConfigService.get_value(db, "ADMISION_VETO_HABILITADO", "true")).lower() == "true"
        has_veto = veto_enabled and (no_votes > 0)
        threshold_reached = (yes_votes >= votes_yes_needed) and (not has_veto)
        unanimidad_si = (yes_votes >= total_active_members)
        can_conclude = deadline_passed or (pending_votes == 0) or unanimidad_si
        threshold_label = f"≥{int(threshold_ratio*100)}% ({votes_yes_needed} de {total_active_members} SÍ) y 0 votos NO"
    elif p.proposal_type == ProposalType.EXPULSION:
        threshold_ratio = float(ConfigService.get_value(db, "EXPULSION_UMBRAL_APROBACION", "0.75"))
        expulsion_quorum_pct = float(ConfigService.get_value(db, "EXPULSION_QUORUM_MINIMO", "75"))
        quorum_needed = int(math.ceil(eligible_active_members * (expulsion_quorum_pct / 100.0)))
        quorum_met = (total_casted >= quorum_needed)
        votes_yes_needed = int(math.ceil(eligible_active_members * threshold_ratio))
        threshold_reached = quorum_met and (yes_votes >= votes_yes_needed)
        can_conclude = deadline_passed or (pending_votes == 0) or (yes_votes >= eligible_active_members)
        has_veto = False
        threshold_label = f"≥{int(threshold_ratio*100)}% del censo habilitado ({votes_yes_needed} de {eligible_active_members} SÍ) · Quórum mín: {quorum_needed} de {eligible_active_members}"
    else:
        quorum_needed = getattr(p, "quorum_needed", 1)
        quorum_met = (total_casted >= quorum_needed)
        threshold_reached = quorum_met and (yes_votes > no_votes)
        can_conclude = deadline_passed or (pending_votes == 0)
        votes_yes_needed = int(math.ceil(total_active_members * 0.50))
        has_veto = False
        threshold_label = f">50% mayoría simple (Quórum mín: {quorum_needed})"

    return {
        "id": p.id,
        "title": p.title,
        "content": p.content,
        "status": p.status.value,
        "proposal_type": p.proposal_type.value,
        "organization_id": p.organization_id,
        "author_id": p.author_id,
        "author_name": author_name,
        "is_author": is_author,
        "member_joined": bool(member_joined),
        "admission_cancelled": bool(admission_cancelled),
        "is_active_proposal": is_active_proposal,
        "target_member_id": p.target_member_id,
        "target_name": target_name or candidate_name_extra,
        "candidate_name": candidate_name_extra or target_name,
        "candidate_relation": candidate_relation,
        "invite_token": invite_token,
        "invite_code_formatted": invite_code_formatted,
        "invite_expires_at": invite_expires_at,
        "redeemed_by_name": redeemed_by_name,
        "defense_text": p.defense_text,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "voting_starts_at": p.voting_starts_at.isoformat() if p.voting_starts_at else None,
        "voting_ends_at": p.voting_ends_at.isoformat() if p.voting_ends_at else None,
        "votes_yes": yes_votes,
        "votes_no": no_votes,
        "votes_null": getattr(p, "votes_null", 0.0),
        "votes_abstain": abstain_votes,
        "total_active_members": eligible_active_members if is_expulsion else total_active_members,
        "eligible_members": eligible_active_members,
        "total_votes_casted": total_casted,
        "pending_votes": pending_votes,
        "votes_yes_needed": votes_yes_needed,
        "threshold_reached": threshold_reached,
        "threshold_label": threshold_label,
        "can_conclude": can_conclude,
        "has_veto": has_veto,
        "quorum_needed": quorum_needed if is_expulsion else getattr(p, "quorum_needed", 1),
        "quorum_reached": quorum_met if is_expulsion else (total_casted >= getattr(p, "quorum_needed", 1)),
        "rejection_reason": p.extra_fields.get("rejection_reason") if p.extra_fields else None,
        "my_vote": my_vote,
        "phase_label": phase_label,
        "time_remaining_seconds": time_remaining_seconds,
        "veto_activated": bool(p.extra_fields.get("veto_activated", False)) if p.extra_fields else False,
        "vetantes_names": vetantes_names,
        "extra_fields": p.extra_fields or {}
    }


# ==========================================
# ENDPOINTS
# ==========================================

@router.post("/proponer-ingreso", status_code=status.HTTP_201_CREATED)
def proponer_ingreso(
    req: ProponerIngresoRequest,
    current_org_member: dict = Depends(get_current_org_member),
    x_bypass_grace: Optional[str] = Header(None, alias="X-Bypass-Grace-Period"),
    x_bypass_rate: Optional[str] = Header(None, alias="X-Bypass-Rate-Limit"),
    db: Session = Depends(get_db)
):
    """
    Cualquier miembro activo de la mutual propone el ingreso de un candidato familiar.
    No requiere cuenta previa; genera un enlace/código de invitación de 15 días.
    La propuesta inicia en fase de DEBATE (4 días), luego pasa a VOTACIÓN (3 días).
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]
    membership = current_org_member["membership"]

    if not membership or membership.status != MemberStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Debes ser miembro activo de la mutual para proponer ingresos")

    # Inhabilitación de asamblea durante el período de gracia de creación de la mutual
    if org.grace_period_ends_at and utcnow() <= org.grace_period_ends_at.replace(tzinfo=timezone.utc) and not x_bypass_grace:
        raise HTTPException(
            status_code=400,
            detail="La asamblea está inhabilitada durante el período de gracia de 24 horas de la mutual. Durante este período, el fundador puede invitar miembros directamente sin pasar por asamblea."
        )

    # Regla 3: Límite de frecuencia, concurrencia y enfriamiento progresivo contra spam en asamblea
    throttle = check_can_create_proposal(
        db=db,
        user_id=user.id,
        org_id=org.id,
        x_bypass_rate_limit=x_bypass_rate
    )

    candidate_name = (req.candidate_name or "").strip()
    if not candidate_name and req.candidate_user_id:
        c_u = db.query(User).filter(User.id == req.candidate_user_id).first()
        if c_u:
            candidate_name = f"{c_u.first_name} {c_u.last_name}".strip()

    if not candidate_name:
        raise HTTPException(status_code=400, detail="Debes indicar el nombre del candidato a invitar")

    justificacion = (req.justificacion or req.motive or "").strip()
    if not justificacion:
        raise HTTPException(status_code=400, detail="Debes indicar la justificación o motivo del ingreso")

    try:
        proposal = admission_service.propose_member_admission(
            db=db,
            author_id=user.id,
            candidate_name=candidate_name,
            organization_id=org.id,
            justificacion=justificacion,
            candidate_relation=req.candidate_relation,
            candidate_phone=req.candidate_phone,
            candidate_user_id=req.candidate_user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Registrar propuesta creada para activar período de enfriamiento
    record_proposal_created(db=db, throttle=throttle, x_bypass=bool(x_bypass_rate))

    # Notificaciones según estado (auto-aprobado vs asamblea en debate)
    if proposal.status == ProposalStatus.APPROVED:
        notify_org(org.id, "PROPUESTA_CREADA", {"proposal_id": proposal.id, "type": "member_admission", "status": "approved"})
        notify_org(org.id, "PROPUESTA_APROBADA", {"proposal_id": proposal.id, "type": "member_admission"})
    else:
        other_members = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.status == MemberStatus.ACTIVE,
            OrganizationMembership.user_id != user.id
        ).all()
        other_user_ids = [m.user_id for m in other_members]

        is_qa = is_qa_environment()
        dias_debate = int(ConfigService.get_value(db, "QA_DIAS_DEBATE", "1")) if is_qa else int(ConfigService.get_value(db, "ADMISION_DIAS_DEBATE", "4"))
        texto_dias = "1 día" if dias_debate == 1 else f"{dias_debate} días"

        notify_users(
            db,
            other_user_ids,
            "📥 Debate de Ingreso",
            f"Se propuso el ingreso de {candidate_name}. Tienes {texto_dias} para debatir en asamblea.",
            {"proposal_id": proposal.id, "type": "member_admission"}
        )
        notify_org(org.id, "PROPUESTA_CREADA", {"proposal_id": proposal.id, "type": "member_admission"})

    return _serialize_proposal(db, proposal, user.id)


@router.post("/proponer-expulsion", status_code=status.HTTP_201_CREATED)
def proponer_expulsion(
    req: ProponerExpulsionRequest,
    current_org_member: dict = Depends(get_current_org_member),
    x_bypass_rate: Optional[str] = Header(None, alias="X-Bypass-Rate-Limit"),
    db: Session = Depends(get_db)
):
    """
    Cualquier miembro activo de la mutual propone la expulsión de un miembro activo.
    Inicia en fase de DEBATE (10 días) para que el acusado publique su defensa obligatoria.
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]
    membership = current_org_member["membership"]

    if not membership or membership.status != MemberStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Debes ser miembro activo de la mutual para proponer expulsiones")

    # Regla 3: Límite de frecuencia, concurrencia y enfriamiento progresivo contra spam en asamblea
    throttle = check_can_create_proposal(
        db=db,
        user_id=user.id,
        org_id=org.id,
        x_bypass_rate_limit=x_bypass_rate
    )

    target_user_id = req.target_user_id or req.target_member_id
    motivo = (req.motivo or req.motive or "").strip()

    if not target_user_id or not motivo:
        raise HTTPException(status_code=400, detail="Debes indicar el miembro a expulsar y el motivo")

    if target_user_id == user.id:
        raise HTTPException(status_code=400, detail="No puedes proponer tu propia expulsión")

    target_membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == target_user_id,
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.status == MemberStatus.ACTIVE
    ).first()
    if not target_membership:
        raise HTTPException(status_code=400, detail="El usuario especificado no es miembro activo de esta mutual")

    if target_membership.role == "founder":
        raise HTTPException(status_code=403, detail="No se puede proponer la expulsión del fundador de la mutual")

    # Verificar si ya existe una propuesta de expulsión activa para este miembro
    active_proposal = db.query(Proposal).filter(
        Proposal.organization_id == org.id,
        Proposal.target_member_id == target_user_id,
        Proposal.proposal_type == ProposalType.EXPULSION,
        Proposal.status.in_([ProposalStatus.DEBATE, ProposalStatus.VOTING])
    ).first()
    if active_proposal:
        raise HTTPException(status_code=400, detail="Ya existe una propuesta de expulsión activa para este miembro")

    target_user = db.query(User).filter(User.id == req.target_user_id).first()
    target_name = f"{target_user.first_name} {target_user.last_name}".strip() if target_user else "Miembro"

    # Validación informativa de Solvencia para la Asamblea
    from models import LoanRequest, LoanStatus
    active_loans = db.query(LoanRequest).filter(
        LoanRequest.organization_id == org.id,
        LoanRequest.requester_id == target_user_id,
        LoanRequest.status.in_([LoanStatus.FUNDED, LoanStatus.PARTIAL])
    ).all()
    unpaid_loans = [l for l in active_loans if l.repaid_at is None]
    total_debt = sum(l.amount_usd for l in unpaid_loans) if unpaid_loans else 0.0

    motivo_content = motivo
    if total_debt > 0:
        motivo_content += f"\n\n⚠️ Advertencia de Solvencia: Este miembro mantiene un préstamo activo de ${total_debt:,.2f} USD pendiente de pago. De aprobarse la expulsión, la deuda permanecerá en cobranza o cobertura según las normas de la mutual."

    proposal_in = ProposalCreate(
        title=f"Expulsión de {target_name}",
        content=motivo_content,
        category="expulsion",
        proposal_type=ProposalType.EXPULSION,
        target_member_id=target_user_id,
        organization_id=org.id,
        voting_mechanism=VotingMechanism.SIMPLE,
        extra_fields={
            "target_user_name": target_name,
            "target_user_email": target_user.email if target_user else "",
            "motivo": req.motivo,
            "has_active_debt": total_debt > 0,
            "active_debt_usd": round(total_debt, 2)
        }
    )
    proposal = GovernanceService.create_proposal(db, author_id=user.id, proposal_in=proposal_in)

    # Registrar propuesta creada para activar período de enfriamiento
    record_proposal_created(db=db, throttle=throttle, x_bypass=bool(x_bypass_rate))

    # Notificaciones
    other_members = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.status == MemberStatus.ACTIVE,
        OrganizationMembership.user_id != user.id
    ).all()
    other_user_ids = [m.user_id for m in other_members]

    is_qa = is_qa_environment()
    dias_debate = int(ConfigService.get_value(db, "QA_DIAS_DEBATE", "1")) if is_qa else int(ConfigService.get_value(db, "EXPULSION_DIAS_DEBATE", "10"))
    texto_dias = "1 día" if dias_debate == 1 else f"{dias_debate} días"

    notify_users(
        db,
        other_user_ids,
        "⚠️ Propuesta de Expulsión",
        f"Se propuso la expulsión de {target_name}. Inicia período de {texto_dias} para debate y defensa.",
        {"proposal_id": proposal.id, "type": "expulsion"}
    )
    notify_org(org.id, "PROPUESTA_CREADA", {"proposal_id": proposal.id, "type": "expulsion"})

    return _serialize_proposal(db, proposal, user.id)


@router.get("/throttle-status")
def get_proposal_throttle_status_endpoint(
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Retorna el estado de enfriamiento y capacidad de emitir propuestas del miembro autenticado.
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]
    return get_proposal_throttle_status(db=db, user_id=user.id, org_id=org.id)


@router.get("/propuestas")
def get_propuestas(
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Lista las propuestas de gobernanza de la mutual actual (activas e históricas).
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]

    if not org:
        return []

    proposals = db.query(Proposal).filter(
        Proposal.organization_id == org.id
    ).order_by(Proposal.created_at.desc()).all()

    return [_serialize_proposal(db, p, user.id) for p in proposals]


@router.get("/propuestas/{proposal_id}")
def get_propuesta_detalle(
    proposal_id: int,
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Retorna el detalle completo de una propuesta, incluyendo el desglose nominativo de votos.
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]

    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.organization_id == org.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    res = _serialize_proposal(db, proposal, user.id)

    # Desglose nominativo de todos los votos emitidos
    votes = db.query(Vote).filter(Vote.proposal_id == proposal.id).all()
    voters_details = []
    for v in votes:
        v_user = db.query(User).filter(User.id == v.member_id).first()
        v_name = f"{v_user.first_name} {v_user.last_name}".strip() if v_user else f"Usuario #{v.member_id}"
        choice = "abstencion"
        if v.vote_value == 1.0:
            choice = "si"
        elif v.vote_value == -1.0:
            choice = "no"

        voters_details.append({
            "member_id": v.member_id,
            "voter_name": v_name,
            "choice": choice,
            "vote_value": v.vote_value,
            "updated_at": v.updated_at.isoformat() if hasattr(v, "updated_at") and v.updated_at else None
        })

    res["votes_list"] = voters_details
    return res


@router.post("/propuestas/{proposal_id}/votar")
def votar_propuesta(
    proposal_id: int,
    req: VotarRequest,
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Emite un voto para una propuesta abierta en la fase de VOTACIÓN.
    Valores aceptados: 'si', 'no', 'abstencion'.
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]
    membership = current_org_member["membership"]

    if not membership or membership.status != MemberStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Debes ser miembro activo para votar")

    if org.grace_period_ends_at and utcnow() <= org.grace_period_ends_at.replace(tzinfo=timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="La asamblea está inhabilitada durante el período de gracia de la mutual."
        )

    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.organization_id == org.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    voto_normalizado = req.voto.strip().lower()
    mapping = {"si": 1.0, "no": -1.0, "abstencion": 0.0}
    if voto_normalizado not in mapping:
        raise HTTPException(status_code=400, detail="Voto inválido. Usa 'si', 'no' o 'abstencion'.")

    vote_val = mapping[voto_normalizado]

    try:
        GovernanceService.cast_vote(
            db=db,
            proposal=proposal,
            member_id=user.id,
            vote_in=VoteCreate(vote_value=vote_val)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    notify_org(org.id, "VOTO_EMITIDO", {"proposal_id": proposal.id, "voter_id": user.id})
    notify_org(org.id, "PROPUESTA_ACTUALIZADA", {"proposal_id": proposal.id, "status": proposal.status.value})

    # Cierre anticipado tras registrar el voto si se alcanzó unanimidad o fin de censo (Opción 3)
    db.refresh(proposal)
    if proposal.status in (ProposalStatus.APPROVED, ProposalStatus.REJECTED):
        dispatch_proposal_resolution_notifications(db, proposal, org.id)

    return {
        "message": "Voto registrado exitosamente",
        "voto": voto_normalizado,
        "proposal_status": proposal.status.value,
        "proposal": _serialize_proposal(db, proposal, user.id)
    }


@router.post("/propuestas/{proposal_id}/defensa")
def publicar_defensa(
    proposal_id: int,
    req: DefensaRequest,
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Permite al miembro acusado de una propuesta de EXPULSIÓN publicar su defensa obligatoria durante el debate.
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]

    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.organization_id == org.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    if proposal.target_member_id != user.id:
        raise HTTPException(status_code=403, detail="Solo el miembro acusado puede publicar su texto de defensa")

    if proposal.status != ProposalStatus.DEBATE:
        raise HTTPException(status_code=400, detail="La defensa solo puede publicarse durante la fase de debate")

    proposal.defense_text = req.defense_text.strip()
    db.commit()
    db.refresh(proposal)

    notify_org(org.id, "DEFENSA_PUBLICADA", {"proposal_id": proposal.id})
    return {"message": "Defensa registrada exitosamente", "proposal_id": proposal.id}


@router.post("/propuestas/{proposal_id}/cerrar")
def cerrar_propuesta(
    proposal_id: int,
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Cierra una propuesta y calcula su resultado oficial (aprobada o rechazada).
    Ejecuta hooks correspondientes (activación de membresía en ingreso o expulsión efectiva).
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]

    if org.grace_period_ends_at and utcnow() <= org.grace_period_ends_at.replace(tzinfo=timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="La asamblea está inhabilitada durante el período de gracia de la mutual."
        )

    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.organization_id == org.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    if proposal.status in (ProposalStatus.APPROVED, ProposalStatus.REJECTED):
        return _serialize_proposal(db, proposal, user.id)

    serialized = _serialize_proposal(db, proposal, user.id)
    if not serialized.get("can_conclude", False):
        pending = serialized.get("pending_votes", 1)
        raise HTTPException(
            status_code=400,
            detail=f"La votación aún está en curso. Faltan {pending} miembro(s) por emitir su voto y el plazo reglamentario no ha concluido. Cada miembro tiene derecho a deliberar y votar hasta el cierre."
        )

    results = GovernanceService.calculate_proposal_results(db, proposal)
    dispatch_proposal_resolution_notifications(db, proposal, org.id)

    return _serialize_proposal(db, proposal, user.id)


@router.post("/propuestas/{proposal_id}/cancelar-ingreso")
def cancelar_ingreso(
    proposal_id: int,
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Cancela la invitación de un nuevo ingreso aprobado antes de que se canjee.
    Solo puede realizarlo el proponente. Pasa la propuesta al historial.
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]

    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.organization_id == org.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    if proposal.proposal_type != ProposalType.MEMBER_ADMISSION:
        raise HTTPException(status_code=400, detail="Solo las propuestas de admisión de miembros pueden ser canceladas")

    if proposal.author_id != user.id:
        raise HTTPException(status_code=403, detail="Solo el proponente del ingreso puede cancelar la invitación")

    extra = dict(proposal.extra_fields or {})
    if extra.get("member_joined") or extra.get("redeemed_by_name"):
        raise HTTPException(status_code=400, detail="El miembro ya completó su ingreso a la mutual")

    extra["admission_cancelled"] = True
    extra["cancellation_reason"] = "Cancelado por el proponente"
    extra["cancelled_at"] = utcnow().isoformat()
    proposal.extra_fields = extra

    invite = db.query(OrganizationInvite).filter(OrganizationInvite.proposal_id == proposal.id).first()
    if invite:
        invite.status = InviteStatus.EXPIRED

    db.commit()
    db.refresh(proposal)
    notify_org(org.id, "PROPUESTA_ACTUALIZADA", {"proposal_id": proposal.id, "status": "cancelled"})

    return _serialize_proposal(db, proposal, user.id)


@router.get("/propuestas/{proposal_id}/comentarios")
def get_comentarios_propuesta(
    proposal_id: int,
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Obtiene el hilo de debate y deliberación de la propuesta en la asamblea familiar.
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]

    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.organization_id == org.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    comments = db.query(Comment).filter(
        Comment.proposal_id == proposal_id
    ).order_by(Comment.created_at.asc()).all()

    serialized = []
    for c in comments:
        author = db.query(User).filter(User.id == c.author_id).first()
        author_name = f"{author.first_name} {author.last_name}".strip() if author else "Familiar"
        serialized.append({
            "id": c.id,
            "proposal_id": c.proposal_id,
            "author_id": c.author_id,
            "author_name": "Anónimo" if c.is_anonymous else author_name,
            "content": c.content,
            "stance": getattr(c, "stance", None),
            "attachment_url": getattr(c, "attachment_url", None),
            "attachment_type": getattr(c, "attachment_type", None),
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "is_mine": c.author_id == user.id
        })
    return serialized


@router.post("/propuestas/{proposal_id}/comentarios", status_code=status.HTTP_201_CREATED)
def agregar_comentario_propuesta(
    proposal_id: int,
    req: ComentarioRequest,
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Publica una opinión, postura o archivo en el foro de debate de la asamblea familiar.
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]
    membership = current_org_member["membership"]

    if not membership or membership.status != MemberStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Debes ser miembro activo para participar en el debate")

    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.organization_id == org.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    text = (req.content or "").strip()
    if not text and not req.attachment_url:
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")

    comment = Comment(
        proposal_id=proposal_id,
        author_id=user.id,
        content=text or "Archivo adjunto",
        is_anonymous=bool(req.is_anonymous),
        stance=req.stance,
        attachment_url=req.attachment_url,
        attachment_type=req.attachment_type,
        created_at=utcnow()
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    author_name = f"{user.first_name} {user.last_name}".strip()
    notify_org(org.id, "PROPUESTA_COMENTADA", {
        "proposal_id": proposal_id,
        "author_name": author_name,
        "comment_id": comment.id
    })

    # Respaldo y notificación a Telegram (con imagen si fue adjuntada)
    if comment.attachment_url:
        import os
        from routers.upload import UPLOADS_DIR
        filename = os.path.basename(comment.attachment_url)
        photo_path = os.path.join(UPLOADS_DIR, filename)
        if not os.path.exists(photo_path):
            photo_path = f".{comment.attachment_url}"
        msg_foro = (
            f"🏛️ <b>Nuevo Aporte en Foro de Asamblea</b>\n\n"
            f"🎯 Propuesta: <b>{proposal.title}</b>\n"
            f"👤 Autor: {author_name}\n"
            f"💬 Postura: {comment.stance or 'Debate'}\n\n"
            f"<i>{comment.content}</i>"
        )
        if os.path.exists(photo_path):
            send_telegram_photo(msg_foro, photo_path)
        else:
            send_telegram_notification(msg_foro)

    return {
        "id": comment.id,
        "proposal_id": comment.proposal_id,
        "author_id": comment.author_id,
        "author_name": author_name,
        "content": comment.content,
        "stance": comment.stance,
        "attachment_url": comment.attachment_url,
        "attachment_type": comment.attachment_type,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "is_mine": True
    }


@router.get("/candidatos-disponibles")
def get_candidatos_disponibles(
    q: Optional[str] = Query(None),
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Retorna usuarios registrados que no forman parte de la mutual actual,
    para que los miembros puedan seleccionarlos al proponer su ingreso.
    """
    org = current_org_member["organization"]
    if not org:
        return []

    active_user_ids = db.query(OrganizationMembership.user_id).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.status == MemberStatus.ACTIVE
    ).all()
    active_ids = {uid for (uid,) in active_user_ids}

    query = db.query(User).filter(~User.id.in_(active_ids))
    if q and q.strip():
        search = f"%{q.strip()}%"
        query = query.filter((User.first_name.ilike(search)) | (User.last_name.ilike(search)) | (User.email.ilike(search)))

    candidatos = query.limit(20).all()
    return [{
        "id": u.id,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "email": u.email
    } for u in candidatos]


@router.get("/miembros-expulsables")
def get_miembros_expulsables(
    current_org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Retorna miembros activos de la mutual que pueden ser propuestos para expulsión
    (excluyendo al usuario actual y al fundador).
    """
    org = current_org_member["organization"]
    user = current_org_member["user"]
    if not org:
        return []

    memberships = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.status == MemberStatus.ACTIVE,
        OrganizationMembership.user_id != user.id,
        OrganizationMembership.role != "founder"
    ).all()

    res = []
    for m in memberships:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            res.append({
                "id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "role": m.role
            })
    return res
