"""
Governance Module Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ...core.database import get_db
from ..membership.router import get_current_user
from ..membership.models import Member
from .models import Proposal, ProposalStatus
from .schemas import ProposalCreate, ProposalResponse, VoteCreate, VoteResponse
from .service import GovernanceService

router = APIRouter()

@router.post("/proposals", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
def create_proposal(
    request: ProposalCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    return GovernanceService.create_proposal(db, author_id=current_user.id, proposal_in=request)

@router.get("/proposals", response_model=List[ProposalResponse])
def get_proposals(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    return GovernanceService.get_all_proposals(db, skip=skip, limit=limit)

@router.get("/proposals/{proposal_id}", response_model=ProposalResponse)
def get_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    proposal = GovernanceService.get_proposal(db, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal

@router.post("/proposals/{proposal_id}/vote", response_model=VoteResponse)
def vote_on_proposal(
    proposal_id: int,
    request: VoteCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    proposal = GovernanceService.get_proposal(db, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    # Example constraint: can only vote if in voting status (in reality could be configurable)
    # For now, allow voting if not approved/rejected
    if proposal.status in (ProposalStatus.APPROVED, ProposalStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Proposal is already resolved")
        
    try:
        # Pass available_credits if mechanism is quadratic/credits. 
        # Usually this comes from another table (e.g. VoteCredit balance).
        # We mock it to 100.0 for now.
        return GovernanceService.cast_vote(
            db, 
            proposal, 
            member_id=current_user.id, 
            vote_in=request, 
            available_credits=100.0
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/proposals/{proposal_id}/results")
def calculate_results(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # Depending on config, anyone or only admins can trigger result calculation
    proposal = GovernanceService.get_proposal(db, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    results = GovernanceService.calculate_proposal_results(db, proposal)
    return results
