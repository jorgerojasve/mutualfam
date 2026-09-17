from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
import enum
import datetime

from ...core.database import Base

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

class FusionStage(str, enum.Enum):
    EXPLORATION = "exploration"
    DUE_DILIGENCE = "due_diligence"
    VOTING = "voting"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class FusionProcess(Base):
    __tablename__ = "fusion_processes"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), unique=True, nullable=False)
    target_organization_name = Column(String(200), nullable=False)
    is_external = Column(Boolean, default=True) # True if they don't use MutualSol natively
    
    current_stage = Column(Enum(FusionStage), default=FusionStage.EXPLORATION)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    documents = relationship("civiccore.modules.fusion.models.FusionDocument", back_populates="process", cascade="all, delete-orphan")

class FusionDocument(Base):
    __tablename__ = "fusion_documents"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("fusion_processes.id"), nullable=False)
    
    title = Column(String(200), nullable=False)
    document_type = Column(String(50)) # e.g. "statutes", "financials", "members"
    stage_required = Column(Enum(FusionStage), default=FusionStage.EXPLORATION)
    
    file_path = Column(String(500), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("members.id"), nullable=True) # Could be null if uploaded via external vault
    
    uploaded_at = Column(DateTime, default=utcnow)
    
    process = relationship("civiccore.modules.fusion.models.FusionProcess", back_populates="documents")
