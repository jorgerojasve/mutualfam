"""
Governance Module Service Logic
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from .models import Proposal, Vote, ProposalStatus, Comment
from .schemas import ProposalCreate, VoteCreate
from .mechanisms import get_mechanism
from ..config.service import ConfigService
from ..membership.models import Member

class GovernanceService:
    @staticmethod
    def create_proposal(db: Session, author_id: int, proposal_in: ProposalCreate) -> Proposal:
        sistema_gobernanza = ConfigService.get_value(db, "SISTEMA_GOBERNANZA", "DOS_FASES")
        initial_status = ProposalStatus.DEBATE if sistema_gobernanza == "DOS_FASES" else ProposalStatus.VOTING
        
        proposal = Proposal(
            author_id=author_id,
            title=proposal_in.title,
            content=proposal_in.content,
            category=proposal_in.category,
            is_anonymous=proposal_in.is_anonymous,
            voting_mechanism=proposal_in.voting_mechanism,
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
            p.votes_yes = sum(v.vote_value for v in votes if v.vote_value > 0)
            p.votes_no = sum(abs(v.vote_value) for v in votes if v.vote_value < 0)
            p.votes_abstain = sum(1.0 for v in votes if v.vote_value == 0)
            p.votes_delegated = 0.0
            p.quorum_needed = 100
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
            
        # Check if user already voted
        existing_vote = db.query(Vote).filter(
            Vote.proposal_id == proposal.id,
            Vote.member_id == member_id
        ).first()
        
        if existing_vote:
            # Update existing vote (Fearon: allowing vote change before closing)
            existing_vote.vote_value = vote_in.vote_value
            existing_vote.preference_order = vote_in.preference_order
            vote = existing_vote
        else:
            vote = Vote(
                proposal_id=proposal.id,
                member_id=member_id,
                vote_value=vote_in.vote_value,
                preference_order=vote_in.preference_order
            )
            db.add(vote)
            
        db.commit()
        db.refresh(vote)
        return vote
        
    @staticmethod
    def calculate_proposal_results(db: Session, proposal: Proposal) -> dict:
        votes = db.query(Vote).filter(Vote.proposal_id == proposal.id).all()
        mechanism = get_mechanism(proposal.voting_mechanism)
        
        results = mechanism.calculate_results(proposal, votes)
        
        # Meta-Governance rule checking
        sistema_gobernanza = ConfigService.get_value(db, "SISTEMA_GOBERNANZA", "DOS_FASES")
        
        total_members = db.query(Member).count()
        total_members = total_members if total_members > 0 else 1
        
        yes_votes = results.get("yes", 0)
        
        passed = False
        
        if sistema_gobernanza == "DOS_FASES":
            # Requiere > 50% de los miembros
            if yes_votes > (total_members / 2):
                passed = True
        else:
            # UNA_FASE_TIEMPO o UNA_FASE_MANUAL usan mayoría simple y quórum estándar
            if results.get("passed", False):
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
        
        return results
