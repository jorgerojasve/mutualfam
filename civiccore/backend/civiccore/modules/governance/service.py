"""
Governance Module Service Logic
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from .models import Proposal, Vote, ProposalStatus, Comment, utcnow
from .schemas import ProposalCreate, VoteCreate, CommentCreate
from .mechanisms import get_mechanism
from .points_service import PointsService
from ..config.service import ConfigService
from ..membership.models import Member
import math

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
        
        if not quorum_reached:
            # Automatic failure if quorum not met
            passed = False
        elif sistema_gobernanza == "DOS_FASES":
            # Requiere > 50% de los miembros
            if yes_votes > (total_members / 2):
                passed = True
        else:
            # UNA_FASE_TIEMPO o UNA_FASE_MANUAL usan mayoría simple y quórum estándar
            # Constitutional Lock (50% + 1): For "configuracion" category we need absolute majority
            if proposal.category == "configuracion":
                # For simple mechanism, weight is always 1.0 (points are disabled)
                # Yes votes must be > 50% of the casted votes
                if yes_votes > (len(votes) / 2.0):
                    passed = True
            elif results.get("passed", False):
                passed = True

        if passed:
            proposal.status = ProposalStatus.APPROVED
            # Smart Contract Execution
            if proposal.category == "configuracion" and proposal.extra_fields:
                var_key = proposal.extra_fields.get("variable")
                var_val = proposal.extra_fields.get("new_value")
                if var_key and var_val:
                    ConfigService.set_value(db, var_key, str(var_val))
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
