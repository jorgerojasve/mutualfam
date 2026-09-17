from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .models import FusionStage

class FusionDocumentBase(BaseModel):
    title: str
    document_type: str
    stage_required: FusionStage
    file_path: str

class FusionDocumentResponse(FusionDocumentBase):
    id: int
    process_id: int
    uploaded_by: Optional[int]
    uploaded_at: datetime
    
    class Config:
        from_attributes = True

class FusionProcessBase(BaseModel):
    target_organization_name: str
    is_external: bool = True

class FusionProcessCreate(FusionProcessBase):
    proposal_id: int

class FusionProcessResponse(FusionProcessBase):
    id: int
    proposal_id: int
    current_stage: FusionStage
    created_at: datetime
    updated_at: datetime
    documents: List[FusionDocumentResponse] = []
    
    class Config:
        from_attributes = True
