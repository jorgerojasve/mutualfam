"""
Governance Module Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ...core.database import get_db
from ..membership.router import get_current_user
from ..membership.models import Member
from .models import Proposal, ProposalStatus, Vote
from .schemas import ProposalCreate, ProposalResponse, VoteCreate, VoteResponse
from typing import List, Optional
from datetime import timedelta
from sqlalchemy import or_
from .service import GovernanceService
from .models import utcnow

router = APIRouter()

@router.post("/proposals", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
def create_proposal(
    request: ProposalCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    return GovernanceService.create_proposal(db, author_id=current_user.id, proposal_in=request)

@router.get("/proposals/search", response_model=List[ProposalResponse])
def search_proposals(
    q: str,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    if not q:
        return []
    search_term = f"%{q}%"
    proposals = db.query(Proposal).filter(
        or_(Proposal.title.ilike(search_term), Proposal.content.ilike(search_term))
    ).all()
    for p in proposals:
        GovernanceService._enrich_proposal(db, p)
    return proposals

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

@router.get("/proposals/{proposal_id}/my-vote", response_model=Optional[VoteResponse])
def get_my_vote(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    vote = db.query(Vote).filter(Vote.proposal_id == proposal_id, Vote.member_id == current_user.id).first()
    return vote

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
    # For now, allow voting if not approved/rejected, including DRAFT
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

from pydantic import BaseModel
class MergeRequest(BaseModel):
    target_proposal_id: int
    as_citation: bool = False

@router.post("/proposals/{proposal_id}/merge")
def merge_proposal(
    proposal_id: int,
    request: MergeRequest,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    proposal = GovernanceService.get_proposal(db, proposal_id)
    if not proposal or proposal.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    target = GovernanceService.get_proposal(db, request.target_proposal_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
        
    if request.as_citation:
        proposal.cited_proposal_id = target.id
    else:
        proposal.merged_into_id = target.id
        proposal.status = ProposalStatus.MERGED
        
    db.commit()
    return {"status": "ok"}

@router.post("/proposals/{proposal_id}/start-referendum")
def start_referendum(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    proposal = GovernanceService.get_proposal(db, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
        
    proposal.status = ProposalStatus.VOTING
    proposal.voting_starts_at = utcnow()
    proposal.voting_ends_at = utcnow() + timedelta(days=7) # Por defecto 1 semana
    db.commit()
    return {"status": "voting"}
