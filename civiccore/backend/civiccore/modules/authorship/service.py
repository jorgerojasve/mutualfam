"""
Authorship Module Services
"""
import hashlib
from sqlalchemy.orm import Session
from typing import List
from .models import Document, Authorship, PublicRecord
from .schemas import DocumentCreate, AuthorshipCreate, PublicRecordCreate

class AuthorshipService:
    
    @staticmethod
    def calculate_hash(content: str) -> str:
        """
        Calculates SHA-256 hash of a string content.
        """
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    @staticmethod
    def create_document(db: Session, doc_in: DocumentCreate) -> Document:
        authors_in = doc_in.authors
        doc_data = doc_in.model_dump(exclude={'authors'})
        
        doc = Document(**doc_data)
        db.add(doc)
        db.flush() # flush to get doc.id
        
        if authors_in:
            for auth in authors_in:
                authorship = Authorship(document_id=doc.id, **auth.model_dump())
                db.add(authorship)
                
        db.commit()
        db.refresh(doc)
        return doc

    @staticmethod
    def get_document(db: Session, doc_id: int) -> Document:
        return db.query(Document).filter(Document.id == doc_id).first()

    @staticmethod
    def list_documents(db: Session) -> List[Document]:
        return db.query(Document).order_by(Document.created_at.desc()).all()

    @staticmethod
    def add_authorship(db: Session, doc_id: int, auth_in: AuthorshipCreate) -> Authorship:
        authorship = Authorship(document_id=doc_id, **auth_in.model_dump())
        db.add(authorship)
        db.commit()
        db.refresh(authorship)
        return authorship

    @staticmethod
    def seal_document(db: Session, doc_id: int, sealed_by: str) -> PublicRecord:
        """
        Creates an immutable public record for a document.
        """
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            raise ValueError("Document not found")
            
        if not doc.content_hash:
            raise ValueError("Document must have a content_hash before being sealed")
            
        # Create a signature (in reality, this might involve private keys)
        # Here we just create a combined hash to represent the seal
        signature = AuthorshipService.calculate_hash(f"{doc.content_hash}:{sealed_by}")
        
        record = PublicRecord(
            document_id=doc.id,
            signature=signature,
            sealed_by=sealed_by
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
