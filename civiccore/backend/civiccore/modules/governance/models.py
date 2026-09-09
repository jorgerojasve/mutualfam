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

class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    
    # Generic category config
    category = Column(String(50), default="general")
    status = Column(Enum(ProposalStatus), default=ProposalStatus.DRAFT)
    
    is_anonymous = Column(Boolean, default=False)
    voting_mechanism = Column(Enum(VotingMechanism), default=VotingMechanism.SIMPLE)
    
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

class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    
    # Simple voting: 1.0 (yes), 0.0 (abstain), -1.0 (no)
    # Quadratic / Credits: actual value invested
    vote_value = Column(Float, nullable=False, default=1.0)
    preference_order = Column(Integer, nullable=True)
    
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
    created_at = Column(DateTime, default=utcnow)

    delegator = relationship("Member", foreign_keys=[delegator_id])
    delegatee = relationship("Member", foreign_keys=[delegatee_id])
