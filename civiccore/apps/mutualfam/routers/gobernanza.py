"""
Router de Gobernanza para MutualFam
Maneja propuestas de ingreso y expulsión de miembros, votación, debate, defensa y resolución.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from civiccore.core.database import get_db
from civiccore.modules.membership.models import (
    User,
    OrganizationMembership,
    MemberStatus,
    Organization
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
from routers.membership import get_current_org_member, get_current_user
from services.notifications import notify_users
from services.realtime import notify_org

router = APIRouter()

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class ProponerIngresoRequest(BaseModel):
    candidate_name: Optional[str] = None
    candidate_relation: Optional[str] = None
    candidate_phone: Optional[str] = None
    candidate_user_id: Optional[int] = None
    justificacion: str

class ProponerExpulsionRequest(BaseModel):
    target_user_id: int
    motivo: str

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

def _serialize_proposal(db: Session, p: Proposal, current_user_id: int) -> Dict[str, Any]:
    GovernanceService._enrich_proposal(db, p)
    
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

    # Solo exponer el token y código de invitación si la propuesta fue efectivamente aprobada
    is_approved = (p.status == ProposalStatus.APPROVED)
    invite_token = (p.extra_fields.get("invite_token") if p.extra_fields else None) if is_approved else None
    invite_code_formatted = (p.extra_fields.get("invite_code_formatted") if p.extra_fields else None) if is_approved else None
    invite_expires_at = (p.extra_fields.get("expires_at") if p.extra_fields else None) if is_approved else None
    redeemed_by_name = p.extra_fields.get("redeemed_by_name") if p.extra_fields else None

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

    now = utcnow()
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

    return {
        "id": p.id,
        "title": p.title,
        "content": p.content,
        "status": p.status.value,
        "proposal_type": p.proposal_type.value,
        "organization_id": p.organization_id,
        "author_id": p.author_id,
        "author_name": author_name,
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
        "votes_yes": getattr(p, "votes_yes", 0.0),
        "votes_no": getattr(p, "votes_no", 0.0),
        "votes_null": getattr(p, "votes_null", 0.0),
        "votes_abstain": getattr(p, "votes_abstain", 0.0),
        "quorum_needed": getattr(p, "quorum_needed", 1),
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

    candidate_name = (req.candidate_name or "").strip()
    if not candidate_name and req.candidate_user_id:
        c_u = db.query(User).filter(User.id == req.candidate_user_id).first()
        if c_u:
            candidate_name = f"{c_u.first_name} {c_u.last_name}".strip()

    if not candidate_name:
        raise HTTPException(status_code=400, detail="Debes indicar el nombre del candidato a invitar")

    try:
        proposal = admission_service.propose_member_admission(
            db=db,
            author_id=user.id,
            candidate_name=candidate_name,
            organization_id=org.id,
            justificacion=req.justificacion,
            candidate_relation=req.candidate_relation,
            candidate_phone=req.candidate_phone,
            candidate_user_id=req.candidate_user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Notificaciones según estado (auto-aprobado vs asamblea en debate)
    if proposal.status == ProposalStatus.APPROVED:
        notify_org(org.id, "PROPUESTA_APROBADA", {"proposal_id": proposal.id, "type": "member_admission"})
    else:
        other_members = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.status == MemberStatus.ACTIVE,
            OrganizationMembership.user_id != user.id
        ).all()
        other_user_ids = [m.user_id for m in other_members]

        notify_users(
            db,
            other_user_ids,
            "📥 Debate de Ingreso",
            f"Se propuso el ingreso de {candidate_name}. Tienes 4 días para debatir en asamblea.",
            {"proposal_id": proposal.id, "type": "member_admission"}
        )
        notify_org(org.id, "PROPUESTA_CREADA", {"proposal_id": proposal.id, "type": "member_admission"})

    return _serialize_proposal(db, proposal, user.id)


@router.post("/proponer-expulsion", status_code=status.HTTP_201_CREATED)
def proponer_expulsion(
    req: ProponerExpulsionRequest,
    current_org_member: dict = Depends(get_current_org_member),
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

    if req.target_user_id == user.id:
        raise HTTPException(status_code=400, detail="No puedes proponer tu propia expulsión")

    target_membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == req.target_user_id,
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
        Proposal.target_member_id == req.target_user_id,
        Proposal.proposal_type == ProposalType.EXPULSION,
        Proposal.status.in_([ProposalStatus.DEBATE, ProposalStatus.VOTING])
    ).first()
    if active_proposal:
        raise HTTPException(status_code=400, detail="Ya existe una propuesta de expulsión activa para este miembro")

    target_user = db.query(User).filter(User.id == req.target_user_id).first()
    target_name = f"{target_user.first_name} {target_user.last_name}".strip() if target_user else "Miembro"

    proposal_in = ProposalCreate(
        title=f"Expulsión de {target_name}",
        content=req.motivo,
        category="expulsion",
        proposal_type=ProposalType.EXPULSION,
        target_member_id=req.target_user_id,
        organization_id=org.id,
        voting_mechanism=VotingMechanism.SIMPLE,
        extra_fields={
            "target_user_name": target_name,
            "target_user_email": target_user.email if target_user else "",
            "motivo": req.motivo
        }
    )
    proposal = GovernanceService.create_proposal(db, author_id=user.id, proposal_in=proposal_in)

    # Notificaciones
    other_members = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.status == MemberStatus.ACTIVE,
        OrganizationMembership.user_id != user.id
    ).all()
    other_user_ids = [m.user_id for m in other_members]

    notify_users(
        db,
        other_user_ids,
        "⚠️ Propuesta de Expulsión",
        f"Se propuso la expulsión de {target_name}. Inicia período de 10 días para debate y defensa.",
        {"proposal_id": proposal.id, "type": "expulsion"}
    )
    notify_org(org.id, "PROPUESTA_CREADA", {"proposal_id": proposal.id, "type": "expulsion"})

    return _serialize_proposal(db, proposal, user.id)


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
    return {"message": "Voto registrado exitosamente", "voto": voto_normalizado}


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

    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.organization_id == org.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")

    if proposal.status in (ProposalStatus.APPROVED, ProposalStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Esta propuesta ya fue cerrada y resuelta")

    results = GovernanceService.calculate_proposal_results(db, proposal)

    # Notificaciones según resultado
    all_members = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.status == MemberStatus.ACTIVE
    ).all()
    all_user_ids = [m.user_id for m in all_members]

    target_user = db.query(User).filter(User.id == proposal.target_member_id).first() if proposal.target_member_id else None
    target_name = f"{target_user.first_name} {target_user.last_name}".strip() if target_user else "Usuario"

    if results.get("passed"):
        if proposal.proposal_type == ProposalType.MEMBER_ADMISSION:
            admission_service.generate_invite_for_approved_proposal(db, proposal, proposal.author_id)
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
                "📋 Expulsión Aprobada",
                f"{target_name} ha sido expulsado de la mutual.",
                {"proposal_id": proposal.id}
            )
    else:
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
            notify_users(
                db,
                all_user_ids,
                "✅ Expulsión Rechazada",
                f"La propuesta de expulsión de {target_name} fue rechazada. El miembro permanece activo.",
                {"proposal_id": proposal.id}
            )

    notify_org(org.id, "PROPUESTA_RESUELTA", {
        "proposal_id": proposal.id,
        "status": proposal.status.value,
        "passed": results.get("passed")
    })

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
