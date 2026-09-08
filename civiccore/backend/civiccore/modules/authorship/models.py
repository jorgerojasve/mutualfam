"""
Authorship Module Models
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from ...core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class AuthorRole(str, enum.Enum):
    MAIN_AUTHOR = "main_author"
    CO_AUTHOR = "co_author"
    REVIEWER = "reviewer"
    EDITOR = "editor"
    SIGNATORY = "signatory" # For official records/actas

class Document(Base):
    """
    A document, paper, or official record.
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    document_type = Column(String(100), default="paper") # e.g., 'acta', 'paper', 'resolution'
    
    # Store the URL, CID (IPFS), or internal path
    content_uri = Column(String(500), nullable=True)
    
    # Text summary or abstract
    abstract = Column(Text, nullable=True)
    
    # Hash of the document content for immutability verification (e.g. SHA-256)
    content_hash = Column(String(64), nullable=True, index=True)
    
    created_at = Column(DateTime, default=utcnow)
    
    # Relationships
    authorships = relationship("Authorship", back_populates="document", cascade="all, delete-orphan")
    
    organization_id = Column(Integer, nullable=True, index=True)

class Authorship(Base):
    """
    Association between a Member and a Document.
    """
    __tablename__ = "authorships"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    
    role = Column(Enum(AuthorRole), default=AuthorRole.CO_AUTHOR)
    
    # Sometimes authors are external (not in our DB), this allows for fallback string names
    external_name = Column(String(150), nullable=True)
    
    created_at = Column(DateTime, default=utcnow)
    
    document = relationship("Document", back_populates="authorships")

class PublicRecord(Base):
    """
    An immutable record of a decision or event (e.g. general assembly minutes).
    Could be anchored to a blockchain or just hashed here.
    """
    __tablename__ = "public_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), unique=True, nullable=False)
    
    # The cryptographic signature or block hash
    signature = Column(String(255), nullable=False)
    
    # Who signed/sealed it (could be system admin ID or a public key)
    sealed_by = Column(String(255), nullable=False)
    
    sealed_at = Column(DateTime, default=utcnow)
