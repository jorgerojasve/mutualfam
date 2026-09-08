"""
Authorship Module Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ...core.database import get_db
from .schemas import DocumentCreate, DocumentResponse, AuthorshipCreate, AuthorshipResponse, PublicRecordResponse
from .service import AuthorshipService

router = APIRouter()

@router.post("/documents", response_model=DocumentResponse)
def create_document(doc_in: DocumentCreate, db: Session = Depends(get_db)):
    return AuthorshipService.create_document(db, doc_in)

@router.get("/documents", response_model=List[DocumentResponse])
def get_documents(db: Session = Depends(get_db)):
    return AuthorshipService.list_documents(db)

@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = AuthorshipService.get_document(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.post("/documents/{doc_id}/authors", response_model=AuthorshipResponse)
def add_author(doc_id: int, auth_in: AuthorshipCreate, db: Session = Depends(get_db)):
    # Verify doc exists
    doc = AuthorshipService.get_document(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return AuthorshipService.add_authorship(db, doc_id, auth_in)

@router.post("/documents/{doc_id}/seal", response_model=PublicRecordResponse)
def seal_document(doc_id: int, sealed_by: str, db: Session = Depends(get_db)):
    """
    Seal a document to create an immutable public record.
    """
    try:
        return AuthorshipService.seal_document(db, doc_id, sealed_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
