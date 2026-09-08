"""
Governance Module Service Logic
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from .models import Proposal, Vote, ProposalStatus
from .schemas import ProposalCreate, VoteCreate
from .mechanisms import get_mechanism

class GovernanceService:
    @staticmethod
    def create_proposal(db: Session, author_id: int, proposal_in: ProposalCreate) -> Proposal:
        proposal = Proposal(
            author_id=author_id,
            title=proposal_in.title,
            content=proposal_in.content,
            category=proposal_in.category,
            is_anonymous=proposal_in.is_anonymous,
            voting_mechanism=proposal_in.voting_mechanism,
            extra_fields=proposal_in.extra_fields,
            status=ProposalStatus.DRAFT
        )
        
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return proposal
        
    @staticmethod
    def get_proposal(db: Session, proposal_id: int) -> Optional[Proposal]:
        return db.query(Proposal).filter(Proposal.id == proposal_id).first()
        
    @staticmethod
    def get_all_proposals(db: Session, skip: int = 0, limit: int = 100) -> List[Proposal]:
        return db.query(Proposal).offset(skip).limit(limit).all()
        
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
        
        # Optional: Auto-update status if voting period ended
        if results.get("passed", False):
            proposal.status = ProposalStatus.APPROVED
        else:
            proposal.status = ProposalStatus.REJECTED
            
        db.commit()
        
        return results
