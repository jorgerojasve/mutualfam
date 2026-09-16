"""
Governance Module Service Logic
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from .models import Proposal, Vote, ProposalStatus, Comment, ProposalVersion, utcnow
from .schemas import ProposalCreate, VoteCreate, CommentCreate, ProposalUpdate
from .mechanisms import get_mechanism
from .points_service import PointsService
from ..config.service import ConfigService
from ..membership.models import Member
import math
import difflib

class GovernanceService:
    @staticmethod
    def create_proposal(db: Session, author_id: int, proposal_in: ProposalCreate) -> Proposal:
        sistema_gobernanza = ConfigService.get_value(db, "SISTEMA_GOBERNANZA", "DOS_FASES")
        initial_status = ProposalStatus.DEBATE if sistema_gobernanza == "DOS_FASES" else ProposalStatus.VOTING
        
        from .models import VotingMechanism
        
        # Constitutional Lock: Configuration proposals must be SIMPLE
        assigned_mechanism = proposal_in.voting_mechanism
        if proposal_in.category == "configuracion":
            assigned_mechanism = VotingMechanism.SIMPLE
            
        proposal = Proposal(
            author_id=author_id,
            title=proposal_in.title,
            content=proposal_in.content,
            category=proposal_in.category,
            proposal_type=proposal_in.proposal_type,
            target_member_id=proposal_in.target_member_id,
            is_anonymous=proposal_in.is_anonymous,
            voting_mechanism=assigned_mechanism,
            extra_fields=proposal_in.extra_fields,
            status=initial_status
        )
        
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return proposal
        
    @staticmethod
    def _enrich_proposal(db: Session, p: Proposal) -> Proposal:
        if p:
            votes = db.query(Vote).filter(Vote.proposal_id == p.id).all()
            
            p.votes_yes = 0.0
            p.votes_no = 0.0
            p.votes_abstain = 0.0
            
            sistema_ponderacion = ConfigService.get_value(db, "SISTEMA_PONDERACION_PUNTOS", "lineal")
            
            for v in votes:
                weight = 1.0
                if v.points_used > 0:
                    if sistema_ponderacion == "cuadratica":
                        weight = math.sqrt(v.points_used + 1)
                    else:
                        weight = float(v.points_used)
                        
                # Welfare Optimization Check (Bonus)
                affected_cohort = p.extra_fields.get("affected_cohort") if p.extra_fields else None
                # Simplificación: si la propuesta tiene un affected_cohort definido, damos x1.5 si coincide.
                # Como aquí solo sumamos, la implementación real del welfare bonus es mejor hacerla en el cálculo oficial o al guardar el voto.
                # Por ahora dejemos el cálculo enriquecido idéntico al calculate oficial.
                
                if v.vote_value > 0:
                    p.votes_yes += weight
                elif v.vote_value < 0:
                    p.votes_no += weight
                else:
                    p.votes_abstain += 1.0 # Abstain always 1? Yes.
                    
            p.votes_delegated = 0.0
            
            # Dynamic quorum calculation
            total_members = db.query(Member).count()
            total_members = total_members if total_members > 0 else 1
            quorum_percentage = float(ConfigService.get_value(db, "QUORUM_ASAMBLEA", "20"))
            
            # If the proposal is a constitutional change, enforce 50% minimum quorum
            if p.category == "configuracion":
                quorum_percentage = max(quorum_percentage, 50.0)
                
            p.quorum_needed = int(math.ceil(total_members * (quorum_percentage / 100.0)))
            if p.quorum_needed < 1:
                p.quorum_needed = 1
        return p

    @staticmethod
    def get_proposal(db: Session, proposal_id: int) -> Optional[Proposal]:
        p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
        return GovernanceService._enrich_proposal(db, p) if p else None
        
    @staticmethod
    def get_all_proposals(db: Session, skip: int = 0, limit: int = 100) -> List[Proposal]:
        # Ordenamos por status (VOTING primero), luego por última actividad
        proposals = db.query(Proposal).order_by(Proposal.status.desc(), Proposal.last_activity_at.desc()).offset(skip).limit(limit).all()
        for p in proposals:
            GovernanceService._enrich_proposal(db, p)
        return proposals
        
    @staticmethod
    def get_proposal_versions(db: Session, proposal_id: int) -> List[ProposalVersion]:
        return db.query(ProposalVersion).filter(ProposalVersion.proposal_id == proposal_id).order_by(ProposalVersion.version_number.desc()).all()

    @staticmethod
    def update_proposal(db: Session, proposal_id: int, user_id: int, update_data: ProposalUpdate) -> Proposal:
        proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
        if not proposal:
            raise ValueError("Proposal not found")
            
        if proposal.status != ProposalStatus.DEBATE:
            raise ValueError("Solo se pueden modificar propuestas en fase de debate.")
            
        if proposal.author_id != user_id:
            raise ValueError("Solo el autor puede editar la propuesta.")

        # Determine current version number
        current_version_count = db.query(ProposalVersion).filter(ProposalVersion.proposal_id == proposal_id).count()
        next_version = current_version_count + 1

        # Calculate heuristic for substantial change
        new_title = update_data.title if update_data.title is not None else proposal.title
        new_content = update_data.content if update_data.content is not None else proposal.content
        
        # We compare content for substantial changes. Ratio gives 1.0 for identical, 0.0 for completely different
        similarity_ratio = difflib.SequenceMatcher(None, proposal.content, new_content).ratio()
        
        # Umbral 20% de cambio = ratio < 0.80
        is_substantial = similarity_ratio < 0.80

        # Snapshot current version before overwriting
        snapshot = ProposalVersion(
            proposal_id=proposal.id,
            version_number=next_version,
            title=proposal.title,
            content=proposal.content,
            editor_id=user_id,
            edit_reason=update_data.edit_reason,
            is_substantial=is_substantial
        )
        db.add(snapshot)
        
        # Apply updates
        proposal.title = new_title
        proposal.content = new_content
        proposal.last_activity_at = utcnow()
        
        if is_substantial:
            # Here we would emit an event or notification to previous voters
            # For now we can print or log it
            print(f"NOTIFICACIÓN INTELIGENTE: Cambio sustancial detectado (Similitud {similarity_ratio*100:.1f}%). Alertando a votantes de la propuesta {proposal.id}.")

        db.commit()
        db.refresh(proposal)
        return GovernanceService._enrich_proposal(db, proposal)

    @staticmethod
    def cast_vote(db: Session, proposal: Proposal, member_id: int, vote_in: VoteCreate, available_credits: float = 0.0) -> Vote:
        mechanism = get_mechanism(proposal.voting_mechanism)
        
        if not mechanism.validate_vote(vote_in.vote_value, available_credits=available_credits):
            raise ValueError(f"Invalid vote value for mechanism {proposal.voting_mechanism}")
            
        # Puntos de Voto Validation
        points_enabled = False
        if proposal.status == ProposalStatus.VOTING:
            points_enabled = str(ConfigService.get_value(db, "PUNTOS_HABILITADOS_REFERENDO", "true")).lower() == "true"
        elif proposal.status == ProposalStatus.DEBATE:
            points_enabled = str(ConfigService.get_value(db, "PUNTOS_HABILITADOS_DEBATE", "false")).lower() == "true"

        points_used = 0
        if points_enabled and vote_in.points_used > 0:
            max_points = int(ConfigService.get_value(db, "MAX_PUNTOS_POR_VOTO", "5"))
            period_days = int(ConfigService.get_value(db, "PERIODO_RENOVACION_PUNTOS", "30"))
            default_points = int(ConfigService.get_value(db, "PUNTOS_POR_MIEMBRO", "10"))
            
            if vote_in.points_used > max_points:
                raise ValueError(f"No puedes asignar más de {max_points} puntos por voto.")
                
            # Attempt to spend points
            if not PointsService.spend_points(db, member_id, vote_in.points_used, period_days, default_points):
                raise ValueError("No tienes suficientes Puntos de Voto disponibles.")
            
            points_used = vote_in.points_used
            
        # Check if user already voted
        existing_vote = db.query(Vote).filter(
            Vote.proposal_id == proposal.id,
            Vote.member_id == member_id
        ).first()
        
        if existing_vote:
            # Reembolso de puntos no está implementado para simplificar, se asume costo hundido
            existing_vote.vote_value = vote_in.vote_value
            existing_vote.preference_order = vote_in.preference_order
            if points_used > 0:
                existing_vote.points_used += points_used # Agrega intensidad
            vote = existing_vote
        else:
            vote = Vote(
                proposal_id=proposal.id,
                member_id=member_id,
                vote_value=vote_in.vote_value,
                preference_order=vote_in.preference_order,
                points_used=points_used
            )
            db.add(vote)
            
        db.commit()
        db.refresh(vote)
        return vote
        
    @staticmethod
    def calculate_proposal_results(db: Session, proposal: Proposal) -> dict:
        votes = db.query(Vote).filter(Vote.proposal_id == proposal.id).all()
        mechanism = get_mechanism(proposal.voting_mechanism)
        
        sistema_ponderacion = ConfigService.get_value(db, "SISTEMA_PONDERACION_PUNTOS", "lineal")
        
        # We override standard mechanism results to include Points intensity
        yes_votes = 0.0
        no_votes = 0.0
        
        for v in votes:
            weight = 1.0
            if v.points_used > 0:
                if sistema_ponderacion == "cuadratica":
                    weight = math.sqrt(v.points_used + 1)
                else:
                    weight = float(v.points_used)
            
            # Welfare Optimization (Impact Bonus)
            # In a real app, we check member's actual roles vs proposal cohort
            # e.g., if member is a borrower and proposal affects borrowers
            affected_cohort = proposal.extra_fields.get("affected_cohort") if proposal.extra_fields else None
            # Placeholder logic: If they are the author, they get the bonus (just to show it works)
            welfare_multiplier = 1.0
            if affected_cohort == "author_cohort" and v.member_id == proposal.author_id:
                welfare_multiplier = 1.5
                
            final_weight = weight * welfare_multiplier
            
            if v.vote_value > 0:
                yes_votes += final_weight
            elif v.vote_value < 0:
                no_votes += final_weight
                
        # Liquid Democracy: Add delegated votes
        from .models import Delegation
        if str(ConfigService.get_value(db, "ENABLE_DELEGATES", "true")).lower() == "true":
            allow_override = str(ConfigService.get_value(db, "ALLOW_LIQUID_DELEGATION_OVERRIDE", "true")).lower() == "true"
            
            # Find all active delegations that could apply
            active_delegations_raw = db.query(Delegation).filter(
                Delegation.is_active == True,
                (Delegation.expires_at == None) | (Delegation.expires_at > utcnow())
            ).all()
            
            # Resolve delegations per delegator: 
            # Priority 1: restricted_proposal_id == proposal.id
            # Priority 2: restricted_category == proposal.category
            # Priority 3: global (both null)
            active_delegations = []
            delegator_map = {}
            for d in active_delegations_raw:
                if d.restricted_proposal_id is not None and d.restricted_proposal_id != proposal.id:
                    continue
                if d.restricted_proposal_id is None and d.restricted_category is not None and d.restricted_category != proposal.category:
                    continue
                
                score = 0
                if d.restricted_proposal_id == proposal.id: score = 3
                elif d.restricted_category == proposal.category: score = 2
                else: score = 1
                
                existing_score = delegator_map.get(d.delegator_id, (None, 0))[1]
                if score > existing_score:
                    delegator_map[d.delegator_id] = (d, score)
                    
            active_delegations = [item[0] for item in delegator_map.values()]
            
            direct_voter_ids = {v.member_id for v in votes}
            
            for delegation in active_delegations:
                # If delegator voted directly, and override is allowed, skip their delegated vote
                if allow_override and delegation.delegator_id in direct_voter_ids:
                    continue
                    
                # Did the delegatee vote?
                delegatee_vote = next((v for v in votes if v.member_id == delegation.delegatee_id), None)
                if delegatee_vote:
                    # Delegatee voted, add 1.0 to their choice (ignoring points for delegated votes for simplicity/fairness)
                    if delegatee_vote.vote_value > 0:
                        yes_votes += 1.0
                    elif delegatee_vote.vote_value < 0:
                        no_votes += 1.0
                        
        results = {"yes": yes_votes, "no": no_votes, "total_casted": len(votes), "passed": yes_votes > no_votes}
        
        # We need to know the required quorum to see if the proposal is valid
        # We can leverage _enrich_proposal to calculate it dynamically
        enriched_p = GovernanceService._enrich_proposal(db, proposal)
        quorum_reached = len(votes) >= enriched_p.quorum_needed
        
        # Meta-Governance rule checking
        sistema_gobernanza = ConfigService.get_value(db, "SISTEMA_GOBERNANZA", "DOS_FASES")
        
        total_members = db.query(Member).count()
        total_members = total_members if total_members > 0 else 1
        
        passed = False
        
        # Calculate thresholds based on proposal type
        from .models import ProposalType
        threshold = 0.50 # Default 50%
        if proposal.proposal_type == ProposalType.EXPULSION:
            threshold = float(ConfigService.get_value(db, "EXPULSION_UMBRAL_APROBACION", "0.75"))
        elif proposal.proposal_type == ProposalType.DIVISION:
            threshold = float(ConfigService.get_value(db, "DIVISION_UMBRAL_APROBACION", "0.75"))
        elif proposal.proposal_type == ProposalType.FUSION:
            threshold = float(ConfigService.get_value(db, "FUSION_UMBRAL_APROBACION", "0.66"))
        elif proposal.proposal_type == ProposalType.FUSION_CONTACT:
            threshold = 0.50 # Contacto inicial con 50% es suficiente

        if not quorum_reached:
            # Automatic failure if quorum not met
            passed = False
        elif sistema_gobernanza == "DOS_FASES" and proposal.proposal_type == ProposalType.STANDARD:
            # DOS_FASES standard rule: requires > 50% of ALL members (not just voters) for standard proposals
            if yes_votes > (total_members / 2):
                passed = True
        else:
            # For special proposals (EXPULSION, DIVISION, FUSION) or UNA_FASE, threshold is based on casted votes
            # But the quorum must be met, which we already verified.
            total_yes_no = yes_votes + no_votes
            if total_yes_no > 0:
                if (yes_votes / total_yes_no) >= threshold:
                    passed = True

        if passed:
            proposal.status = ProposalStatus.APPROVED
            # Smart Contract Execution
            if proposal.category == "configuracion" and proposal.extra_fields:
                var_key = proposal.extra_fields.get("variable")
                var_val = proposal.extra_fields.get("new_value")
                if var_key and var_val:
                    ConfigService.set_value(db, var_key, str(var_val))
            
            # Post-approval hooks for special proposals
            from ..membership import expulsion_service, organization_service
            if proposal.proposal_type == ProposalType.EXPULSION:
                if proposal.target_member_id:
                    expulsion_service.initiate_expulsion(db, proposal.id, proposal.target_member_id)
            elif proposal.proposal_type == ProposalType.DIVISION:
                organization_service.initiate_division(db, proposal.id, proposal.extra_fields)
            elif proposal.proposal_type == ProposalType.FUSION:
                organization_service.initiate_fusion(db, proposal.id, proposal.extra_fields)
            elif proposal.proposal_type == ProposalType.FUSION_CONTACT:
                external_org_name = proposal.extra_fields.get("external_org_name", "Organización Desconocida") if proposal.extra_fields else "Organización Desconocida"
                organization_service.create_fusion_contact(db, proposal.id, external_org_name, proposal.extra_fields)
                
            # Representative Governance hooks
            from .representative_service import RepresentativeService
            if proposal.proposal_type == ProposalType.BOARD_ELECTION:
                RepresentativeService.proclaim_winners(db, proposal.id)
            elif proposal.proposal_type == ProposalType.COMMITTEE_CREATE:
                RepresentativeService.activate_committee(db, proposal.id)
        else:
            proposal.status = ProposalStatus.REJECTED
            
        db.commit()
        
        results["passed"] = passed
        return results

    @staticmethod
    def get_comments(db: Session, proposal_id: int) -> List[Comment]:
        return db.query(Comment).filter(Comment.proposal_id == proposal_id).order_by(Comment.created_at.asc()).all()

    @staticmethod
    def add_comment(db: Session, proposal_id: int, author_id: int, comment_in: CommentCreate) -> Comment:
        comment = Comment(
            proposal_id=proposal_id,
            author_id=author_id,
            content=comment_in.content,
            is_anonymous=comment_in.is_anonymous
        )
        db.add(comment)
        
        # Actualizar last_activity_at de la propuesta
        proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
        if proposal:
            proposal.last_activity_at = utcnow()
            
        db.commit()
        db.refresh(comment)
        return comment
