"""
Governance Module Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from .models import ProposalStatus, VotingMechanism

class ProposalBase(BaseModel):
    title: str
    content: str
    category: Optional[str] = "general"
    is_anonymous: Optional[bool] = False
    voting_mechanism: Optional[VotingMechanism] = VotingMechanism.SIMPLE
    extra_fields: Optional[Dict[str, Any]] = {}

class ProposalCreate(ProposalBase):
    pass

class ProposalResponse(ProposalBase):
    id: int
    author_id: int
    status: ProposalStatus
    merged_into_id: Optional[int] = None
    created_at: datetime
    voting_starts_at: Optional[datetime] = None
    voting_ends_at: Optional[datetime] = None
    
    votes_yes: Optional[float] = 0.0
    votes_no: Optional[float] = 0.0
    votes_abstain: Optional[float] = 0.0
    votes_delegated: Optional[float] = 0.0
    quorum_needed: Optional[int] = 100

    class Config:
        from_attributes = True

class VoteBase(BaseModel):
    vote_value: float
    preference_order: Optional[int] = None

class VoteCreate(VoteBase):
    pass

class VoteResponse(VoteBase):
    id: int
    proposal_id: int
    member_id: int
    updated_at: datetime

    class Config:
        from_attributes = True
