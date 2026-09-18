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
    proposal_type: Optional[str] = "standard"
    target_member_id: Optional[int] = None
    is_anonymous: Optional[bool] = False
    voting_mechanism: Optional[VotingMechanism] = VotingMechanism.SIMPLE
    extra_fields: Optional[Dict[str, Any]] = {}

class ProposalCreate(ProposalBase):
    pass

class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    edit_reason: Optional[str] = None

class ProposalDefenseUpdate(BaseModel):
    defense_text: str

class ProposalResponse(ProposalBase):
    id: int
    author_id: int
    status: ProposalStatus
    proposal_type: str
    target_member_id: Optional[int] = None
    defense_text: Optional[str] = None
    merged_into_id: Optional[int] = None
    created_at: datetime
    voting_starts_at: Optional[datetime] = None
    voting_ends_at: Optional[datetime] = None
    
    votes_yes: Optional[float] = 0.0
    votes_no: Optional[float] = 0.0
    votes_null: Optional[float] = 0.0
    votes_abstain: Optional[float] = 0.0
    votes_delegated: Optional[float] = 0.0
    quorum_needed: Optional[int] = 100

    class Config:
        from_attributes = True

class ProposalVersionResponse(BaseModel):
    id: int
    proposal_id: int
    version_number: int
    title: str
    content: str
    editor_id: int
    edit_reason: Optional[str] = None
    is_substantial: bool
    created_at: datetime

    class Config:
        from_attributes = True

class MemberVotingPointsResponse(BaseModel):
    member_id: int
    balance: int
    last_renewed_at: datetime
    total_ever_allocated: int

    class Config:
        from_attributes = True

class VoteCreate(BaseModel):
    vote_value: float
    preference_order: Optional[int] = None
    points_used: int = 0

class VoteResponse(BaseModel):
    id: int
    proposal_id: int
    member_id: int
    vote_value: float
    preference_order: Optional[int]
    points_used: int
    updated_at: datetime

    class Config:
        from_attributes = True

class CommentBase(BaseModel):
    content: str
    is_anonymous: Optional[bool] = False

class CommentCreate(CommentBase):
    pass

class CommentResponse(CommentBase):
    id: int
    proposal_id: int
    author_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Representative Governance Schemas ---

class BoardCandidateBase(BaseModel):
    position: str
    bio: Optional[str] = None

class BoardCandidateCreate(BoardCandidateBase):
    member_id: int

class BoardCandidateResponse(BoardCandidateBase):
    id: int
    slate_id: int
    member_id: int
    
    class Config:
        from_attributes = True

class BoardSlateCreate(BaseModel):
    name: str
    candidates: List[BoardCandidateCreate]

class BoardSlateResponse(BaseModel):
    id: int
    name: str
    proposal_id: int
    created_at: datetime
    candidates: List[BoardCandidateResponse] = []

    class Config:
        from_attributes = True

class BoardPositionStateResponse(BaseModel):
    id: int
    position: str
    member_id: int
    elected_at: datetime
    expires_at: Optional[datetime]
    active: bool

    class Config:
        from_attributes = True

class CommitteeMemberResponse(BaseModel):
    id: int
    committee_id: int
    member_id: int
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True

class CommitteeBase(BaseModel):
    name: str
    area: Optional[str] = None

class CommitteeCreate(CommitteeBase):
    lead_member_id: int

class CommitteeResponse(CommitteeBase):
    id: int
    proposal_id: int
    is_active: bool
    created_at: datetime
    members: List[CommitteeMemberResponse] = []

    class Config:
        from_attributes = True

class DelegationBase(BaseModel):
    delegatee_id: int
    restricted_category: Optional[str] = None
    restricted_proposal_id: Optional[int] = None
    expires_at: Optional[datetime] = None

class DelegationCreate(DelegationBase):
    pass

class DelegationResponse(DelegationBase):
    id: int
    delegator_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
