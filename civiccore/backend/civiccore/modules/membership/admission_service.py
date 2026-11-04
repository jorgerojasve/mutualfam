"""
Admission Service - Handles member admission proposals and post-approval activation
"""
from sqlalchemy.orm import Session
from typing import Optional
import secrets
from datetime import datetime, timezone

from .models import User, OrganizationMembership, OrganizationInvite, MemberStatus, InviteStatus
from ..governance.models import Proposal, ProposalStatus, ProposalType, VotingMechanism
from ..governance.schemas import ProposalCreate
from ..governance.service import GovernanceService

INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
INVITE_CODE_LENGTH = 8

def _generate_invite_code(db: Session) -> str:
    for _ in range(10):
        code = "".join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))
        if not db.query(OrganizationInvite).filter(OrganizationInvite.token == code).first():
            return code
    return secrets.token_hex(4).upper()

def propose_member_admission(
    db: Session,
    author_id: int,
    candidate_name: str,
    organization_id: int,
    justificacion: str,
    candidate_relation: Optional[str] = None,
    candidate_phone: Optional[str] = None,
    candidate_user_id: Optional[int] = None
) -> Proposal:
    """
    Creates a MEMBER_ADMISSION proposal for a candidate to join an Organization.
    Does NOT require a pre-existing registered user account; generates an invitation token
    with 15 days expiration to be shared by instant messaging (e.g. WhatsApp).
    """
    candidate_name = (candidate_name or "").strip()
    
    # Check if author belongs to the mutual and is active
    author_membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == author_id,
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.status == MemberStatus.ACTIVE
    ).first()
    if not author_membership:
        raise ValueError("Solo los miembros activos de la mutual pueden proponer nuevos ingresos.")

    # If candidate_user_id is passed, validate user
    if candidate_user_id:
        user = db.query(User).filter(User.id == candidate_user_id).first()
        if not user:
            raise ValueError("El candidato especificado no existe o no está registrado.")

        # Check if candidate is already an active member
        existing_membership = db.query(OrganizationMembership).filter(
            OrganizationMembership.user_id == candidate_user_id,
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.status == MemberStatus.ACTIVE
        ).first()
        if existing_membership:
            raise ValueError("El candidato ya es un miembro activo de esta mutual.")

        if not candidate_name:
            candidate_name = f"{user.first_name} {user.last_name}".strip()

        # Check if an active admission proposal already exists for this candidate in this mutual
        active_proposal = db.query(Proposal).filter(
            Proposal.organization_id == organization_id,
            Proposal.target_member_id == candidate_user_id,
            Proposal.proposal_type == ProposalType.MEMBER_ADMISSION,
            Proposal.status.in_([ProposalStatus.DEBATE, ProposalStatus.VOTING])
        ).first()
        if active_proposal:
            raise ValueError("Ya existe una propuesta de admisión activa para este candidato.")
    else:
        if not candidate_name:
            raise ValueError("Debes ingresar el nombre del candidato a invitar.")
            
        # Check by name if an active proposal already exists
        active_props = db.query(Proposal).filter(
            Proposal.organization_id == organization_id,
            Proposal.proposal_type == ProposalType.MEMBER_ADMISSION,
            Proposal.status.in_([ProposalStatus.DEBATE, ProposalStatus.VOTING])
        ).all()
        for ap in active_props:
            if ap.extra_fields and ap.extra_fields.get("candidate_name", "").strip().lower() == candidate_name.lower():
                raise ValueError(f"Ya existe una propuesta de admisión activa para '{candidate_name}'.")

    # Contar miembros activos en la mutual
    active_members_count = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.status == MemberStatus.ACTIVE
    ).count()

    is_single_member = (active_members_count <= 1)

    extra_fields = {
        "candidate_name": candidate_name,
        "candidate_relation": candidate_relation or "",
        "candidate_phone": candidate_phone or "",
        "justificacion": justificacion,
    }
    if is_single_member:
        extra_fields["auto_approved_single_member"] = True

    proposal_in = ProposalCreate(
        title=f"Admisión de {candidate_name}",
        content=justificacion,
        category="admision",
        proposal_type=ProposalType.MEMBER_ADMISSION,
        target_member_id=candidate_user_id,
        organization_id=organization_id,
        voting_mechanism=VotingMechanism.SIMPLE,
        extra_fields=extra_fields
    )
    proposal = GovernanceService.create_proposal(db, author_id=author_id, proposal_in=proposal_in)

    if is_single_member:
        # APROBACIÓN INMEDIATA: No requiere asamblea ni votación cuando solo hay 1 miembro
        now = datetime.now(timezone.utc)
        proposal.status = ProposalStatus.APPROVED
        proposal.voting_starts_at = now
        proposal.voting_ends_at = now

        # Registrar voto afirmativo automático del fundador
        from ..governance.models import Vote
        auto_vote = Vote(
            proposal_id=proposal.id,
            member_id=author_id,
            vote_value=1.0
        )
        db.add(auto_vote)
        db.commit()

        # Generar invitación inmediatamente para que el fundador pueda compartirla
        generate_invite_for_approved_proposal(db, proposal, author_id)

        # Si el candidato ya es un usuario registrado en la plataforma, activar membresía
        if candidate_user_id:
            activate_proposed_member(db, proposal.id, candidate_user_id, organization_id)
    else:
        # CON MÚLTIPLES MIEMBROS: La propuesta queda en DEBATE y NO se genera enlace todavía
        db.commit()

    db.refresh(proposal)
    return proposal

def generate_invite_for_approved_proposal(
    db: Session,
    proposal: Proposal,
    author_id: Optional[int] = None
) -> Optional[OrganizationInvite]:
    """
    Genera el registro OrganizationInvite (válido por 15 días) y asigna
    invite_token e invite_code_formatted a la propuesta ÚNICAMENTE tras ser APROBADA
    (o inmediatamente cuando la mutual consta de un único miembro).
    """
    if proposal.proposal_type != ProposalType.MEMBER_ADMISSION:
        return None

    # Si ya tiene una invitación activa para esta propuesta, retornarla
    existing_invite = db.query(OrganizationInvite).filter(
        OrganizationInvite.proposal_id == proposal.id
    ).first()
    if existing_invite:
        return existing_invite

    from datetime import timedelta
    expires_at = datetime.now(timezone.utc) + timedelta(days=15)
    invite_code = _generate_invite_code(db)
    formatted_code = f"{invite_code[:4]}-{invite_code[4:]}" if len(invite_code) == 8 else invite_code

    creator_id = author_id or proposal.author_id
    invite = OrganizationInvite(
        organization_id=proposal.organization_id,
        created_by_user_id=creator_id,
        proposal_id=proposal.id,
        token=invite_code,
        max_uses=1,
        expires_at=expires_at,
        status=InviteStatus.ACTIVE
    )
    db.add(invite)

    extra = dict(proposal.extra_fields or {})
    extra["invite_token"] = invite_code
    extra["invite_code_formatted"] = formatted_code
    extra["expires_at"] = expires_at.isoformat()
    proposal.extra_fields = extra

    db.commit()
    db.refresh(proposal)
    return invite

def activate_proposed_member(
    db: Session,
    proposal_id: int,
    candidate_user_id: Optional[int] = None,
    organization_id: Optional[int] = None
) -> Optional[OrganizationMembership]:
    """
    Hook executed when a MEMBER_ADMISSION proposal is APPROVED.
    Activates the OrganizationMembership for the candidate user if already registered/claimed.
    """
    prop = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not prop:
        return None

    if organization_id is None:
        organization_id = prop.organization_id

    target_id = candidate_user_id or prop.target_member_id
    if not target_id:
        # Candidate has not claimed the link yet; it will activate upon join
        return None

    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == target_id,
        OrganizationMembership.organization_id == organization_id
    ).first()

    if membership:
        membership.status = MemberStatus.ACTIVE
        membership.role = "member"
    else:
        membership = OrganizationMembership(
            user_id=target_id,
            organization_id=organization_id,
            role="member",
            status=MemberStatus.ACTIVE
        )
        db.add(membership)

    # Mark invite as completed if exists
    invite = db.query(OrganizationInvite).filter(OrganizationInvite.proposal_id == proposal_id).first()
    if invite and not invite.uses_count:
        invite.uses_count = 1

    db.commit()
    db.refresh(membership)
    return membership

def get_pending_admission(db: Session, candidate_user_id: int, organization_id: int) -> Optional[Proposal]:
    """
    Checks if there is a pending admission proposal for a user.
    """
    return db.query(Proposal).filter(
        Proposal.organization_id == organization_id,
        Proposal.target_member_id == candidate_user_id,
        Proposal.proposal_type == ProposalType.MEMBER_ADMISSION,
        Proposal.status.in_([ProposalStatus.DEBATE, ProposalStatus.VOTING])
    ).first()
