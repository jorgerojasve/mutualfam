"""
Authorship Module Schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .models import AuthorRole

class AuthorshipBase(BaseModel):
    member_id: Optional[int] = None
    role: AuthorRole = AuthorRole.CO_AUTHOR
    external_name: Optional[str] = None

class AuthorshipCreate(AuthorshipBase):
    pass

class AuthorshipResponse(AuthorshipBase):
    id: int
    document_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class DocumentBase(BaseModel):
    title: str
    document_type: str = "paper"
    content_uri: Optional[str] = None
    abstract: Optional[str] = None
    content_hash: Optional[str] = None

class DocumentCreate(DocumentBase):
    # Optional list of authors to create immediately with the document
    authors: Optional[List[AuthorshipCreate]] = []

class DocumentResponse(DocumentBase):
    id: int
    created_at: datetime
    authorships: List[AuthorshipResponse] = []
    
    class Config:
        from_attributes = True

class PublicRecordBase(BaseModel):
    document_id: int
    signature: str
    sealed_by: str

class PublicRecordCreate(PublicRecordBase):
    pass

class PublicRecordResponse(PublicRecordBase):
    id: int
    sealed_at: datetime
    
    class Config:
        from_attributes = True
