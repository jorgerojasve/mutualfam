"""
Governance Module Models
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, JSON
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone
from ...core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class ProposalStatus(str, enum.Enum):
    DRAFT = "draft"
    DEBATE = "debate"
    VOTING = "voting"
    APPROVED = "approved"
    REJECTED = "rejected"
    MERGED = "merged"

class VotingMechanism(str, enum.Enum):
    SIMPLE = "simple"
    QUADRATIC = "quadratic"
    PREFERENTIAL = "preferential"
    CREDITS = "credits"

class ProposalType(str, enum.Enum):
    STANDARD = "standard"
    EXPULSION = "expulsion"
    DIVISION = "division"
    FUSION = "fusion"
    BOARD_ELECTION = "board_election"
    COMMITTEE_CREATE = "committee_create"

class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    
    # Generic category config
    category = Column(String(50), default="general")
    status = Column(Enum(ProposalStatus, values_callable=lambda x: [e.value for e in x]), default=ProposalStatus.DRAFT)
    proposal_type = Column(Enum(ProposalType, values_callable=lambda x: [e.value for e in x]), default=ProposalType.STANDARD)
    
    # Used for EXPULSION proposals
    target_member_id = Column(Integer, nullable=True)
    
    is_anonymous = Column(Boolean, default=False)
    voting_mechanism = Column(Enum(VotingMechanism, values_callable=lambda x: [e.value for e in x]), default=VotingMechanism.SIMPLE)
    
    # Domain specific extra data
    extra_fields = Column(JSON, default=dict)
    
    # Coalescence (Gambetta)
    merged_into_id = Column(Integer, ForeignKey("proposals.id"), nullable=True)
    cited_proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=True)

    created_at = Column(DateTime, default=utcnow)
    last_activity_at = Column(DateTime, default=utcnow)
    voting_starts_at = Column(DateTime, nullable=True)
    voting_ends_at = Column(DateTime, nullable=True)
    
    # Optional multi-tenant field
    organization_id = Column(Integer, nullable=True, index=True)

    author = relationship("Member", foreign_keys=[author_id])
    comments = relationship("Comment", back_populates="proposal")
    votes = relationship("Vote", back_populates="proposal")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    
    content = Column(Text, nullable=False)
    is_anonymous = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    proposal = relationship("Proposal", back_populates="comments")
    author = relationship("Member", foreign_keys=[author_id])

class MemberVotingPoints(Base):
    __tablename__ = "member_voting_points"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), unique=True, nullable=False)
    balance = Column(Integer, default=10, nullable=False)
    last_renewed_at = Column(DateTime, default=utcnow)
    total_ever_allocated = Column(Integer, default=0)

    member = relationship("Member", foreign_keys=[member_id])

class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    
    # Simple voting: 1.0 (yes), 0.0 (abstain), -1.0 (no)
    # Quadratic / Points: actual value invested
    vote_value = Column(Float, nullable=False, default=1.0)
    preference_order = Column(Integer, nullable=True)
    
    # Points assigned to this vote to signal intensity
    points_used = Column(Integer, default=0, nullable=False)
    
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    proposal = relationship("Proposal", back_populates="votes")
    member = relationship("Member", foreign_keys=[member_id])

class Delegation(Base):
    __tablename__ = "delegations"

    id = Column(Integer, primary_key=True, index=True)
    delegator_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    delegatee_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    
    # If null, it's a global delegation
    restricted_category = Column(String(50), nullable=True)
    
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    delegator = relationship("Member", foreign_keys=[delegator_id])
    delegatee = relationship("Member", foreign_keys=[delegatee_id])

class ProposalVersion(Base):
    __tablename__ = "proposal_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    
    # Snapshot fields
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    
    # Meta fields
    editor_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    edit_reason = Column(String(500), nullable=True)
    is_substantial = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    
    proposal = relationship("Proposal")
    editor = relationship("Member", foreign_keys=[editor_id])

class BoardSlate(Base):
    __tablename__ = "board_slates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)
    
    proposal = relationship("Proposal")
    candidates = relationship("BoardCandidate", back_populates="slate")

class BoardCandidate(Base):
    __tablename__ = "board_candidates"
    id = Column(Integer, primary_key=True, index=True)
    slate_id = Column(Integer, ForeignKey("board_slates.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    position = Column(String(100), nullable=False)
    bio = Column(Text, nullable=True)
    
    slate = relationship("BoardSlate", back_populates="candidates")
    member = relationship("Member")

class BoardPositionState(Base):
    """Tracks currently active board members (the actual winners)"""
    __tablename__ = "board_position_states"
    id = Column(Integer, primary_key=True, index=True)
    position = Column(String(100), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    elected_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)
    
    member = relationship("Member")

class Committee(Base):
    __tablename__ = "committees"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    area = Column(String(100), nullable=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False) # Proposal that created it
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    proposal = relationship("Proposal")
    members = relationship("CommitteeMember", back_populates="committee")

class CommitteeMember(Base):
    __tablename__ = "committee_members"
    id = Column(Integer, primary_key=True, index=True)
    committee_id = Column(Integer, ForeignKey("committees.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    role = Column(String(50), default="member") # leader, member, secretary
    joined_at = Column(DateTime, default=utcnow)
    
    committee = relationship("Committee", back_populates="members")
    member = relationship("Member")

