"""
Representative Governance Service
Handles logic for Board Slates, Committees, and Delegations.
"""
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from .models import (
    Proposal, ProposalStatus, ProposalType, VotingMechanism, 
    BoardSlate, BoardCandidate, BoardPositionState, 
    Committee, CommitteeMember, 
    Delegation, utcnow
)
from .schemas import (
    BoardSlateCreate, CommitteeCreate, DelegationCreate
)
from ..config.service import ConfigService

class RepresentativeService:
    
    # --- BOARD SLATES (PLANCHAS) ---
    
    @staticmethod
    def create_board_slate(db: Session, author_id: int, slate_in: BoardSlateCreate) -> Proposal:
        """
        Creates a new proposal of type BOARD_ELECTION containing a full slate (plancha) of candidates.
        """
        # Create Proposal first
        proposal = Proposal(
            author_id=author_id,
            title=f"Elección de Junta Directiva: Plancha '{slate_in.name}'",
            content=f"Propuesta para elegir a la Plancha '{slate_in.name}' para los cargos de la Junta Directiva.",
            category="general",
            proposal_type=ProposalType.BOARD_ELECTION,
            voting_mechanism=VotingMechanism.SIMPLE,
            status=ProposalStatus.DEBATE
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        
        # Create Slate
        slate = BoardSlate(
            name=slate_in.name,
            proposal_id=proposal.id
        )
        db.add(slate)
        db.commit()
        db.refresh(slate)
        
        # Add candidates
        for cand in slate_in.candidates:
            candidate = BoardCandidate(
                slate_id=slate.id,
                member_id=cand.member_id,
                position=cand.position,
                bio=cand.bio
            )
            db.add(candidate)
            
        db.commit()
        return proposal

    @staticmethod
    def proclaim_winners(db: Session, proposal_id: int):
        """
        Called when a BOARD_ELECTION proposal is approved.
        Deactivates current board and activates the new slate.
        """
        slate = db.query(BoardSlate).filter(BoardSlate.proposal_id == proposal_id).first()
        if not slate:
            return
            
        term_years = int(ConfigService.get_value(db, "BOARD_TERM_YEARS", "2"))
        expires_at = utcnow() + timedelta(days=365 * term_years)
        
        # Deactivate all current positions
        db.query(BoardPositionState).filter(BoardPositionState.active == True).update({"active": False})
        
        # Insert new winners
        candidates = db.query(BoardCandidate).filter(BoardCandidate.slate_id == slate.id).all()
        for cand in candidates:
            pos_state = BoardPositionState(
                position=cand.position,
                member_id=cand.member_id,
                elected_at=utcnow(),
                expires_at=expires_at,
                active=True
            )
            db.add(pos_state)
            
        db.commit()

    @staticmethod
    def get_current_board(db: Session) -> List[BoardPositionState]:
        return db.query(BoardPositionState).filter(BoardPositionState.active == True).all()


    # --- COMMITTEES ---

    @staticmethod
    def propose_committee(db: Session, author_id: int, committee_in: CommitteeCreate) -> Proposal:
        """
        Creates a proposal to form a new committee.
        """
        proposal = Proposal(
            author_id=author_id,
            title=f"Creación del Comité: {committee_in.name}",
            content=f"Se propone la creación del comité de {committee_in.area or committee_in.name}.",
            category="general",
            proposal_type=ProposalType.COMMITTEE_CREATE,
            voting_mechanism=VotingMechanism.SIMPLE,
            status=ProposalStatus.DEBATE
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        
        # Save pending committee
        committee = Committee(
            name=committee_in.name,
            area=committee_in.area,
            proposal_id=proposal.id,
            is_active=False # Pending approval
        )
        db.add(committee)
        db.commit()
        db.refresh(committee)
        
        # Add initial lead member
        member = CommitteeMember(
            committee_id=committee.id,
            member_id=committee_in.lead_member_id,
            role="leader"
        )
        db.add(member)
        db.commit()
        
        return proposal

    @staticmethod
    def activate_committee(db: Session, proposal_id: int):
        """
        Called when a COMMITTEE_CREATE proposal is approved.
        """
        db.query(Committee).filter(Committee.proposal_id == proposal_id).update({"is_active": True})
        db.commit()

    @staticmethod
    def get_active_committees(db: Session) -> List[Committee]:
        return db.query(Committee).filter(Committee.is_active == True).all()


    # --- DELEGATIONS (LIQUID DEMOCRACY) ---

    @staticmethod
    def assign_delegation(db: Session, delegator_id: int, delegation_in: DelegationCreate) -> Delegation:
        """
        Assigns or updates a delegation.
        """
        if delegator_id == delegation_in.delegatee_id:
            raise ValueError("No puedes delegar el voto en ti mismo.")
            
        # Revoke existing active delegations of the same category
        existing = db.query(Delegation).filter(
            Delegation.delegator_id == delegator_id,
            Delegation.restricted_category == delegation_in.restricted_category,
            Delegation.is_active == True
        ).all()
        for e in existing:
            e.is_active = False
            
        delegation = Delegation(
            delegator_id=delegator_id,
            delegatee_id=delegation_in.delegatee_id,
            restricted_category=delegation_in.restricted_category,
            expires_at=delegation_in.expires_at,
            is_active=True
        )
        db.add(delegation)
        db.commit()
        db.refresh(delegation)
        return delegation

    @staticmethod
    def get_delegated_weight(db: Session, delegatee_id: int, category: Optional[str] = None) -> int:
        """
        Calculates how many active delegated votes a member holds.
        """
        query = db.query(Delegation).filter(
            Delegation.delegatee_id == delegatee_id,
            Delegation.is_active == True
        )
        # Handle expiration
        query = query.filter(
            (Delegation.expires_at == None) | (Delegation.expires_at > utcnow())
        )
        
        # Simplified: if we want to be strict about categories
        if category:
            query = query.filter(
                (Delegation.restricted_category == None) | (Delegation.restricted_category == category)
            )
            
        # In a real liquid democracy, we'd also check if the delegator has already voted directly.
        # This function just returns the raw count. The actual logic runs during calculate_proposal_results.
        return query.count()
