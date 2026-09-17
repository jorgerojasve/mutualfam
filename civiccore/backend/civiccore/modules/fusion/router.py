from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ...core.database import get_db
from ..membership.router import get_current_user
from ..membership.models import Member
from .schemas import FusionProcessCreate, FusionProcessResponse, FusionDocumentBase, FusionDocumentResponse
from .service import FusionService
from .models import FusionStage

router = APIRouter()

@router.post("/", response_model=FusionProcessResponse)
def create_process(
    process_in: FusionProcessCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # En un sistema real verificaríamos si el usuario es admin o de la junta
    return FusionService.create_process(db, process_in)

@router.get("/", response_model=List[FusionProcessResponse])
def list_processes(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    from .models import FusionProcess
    processes = db.query(FusionProcess).all()
    return processes

@router.get("/proposal/{proposal_id}", response_model=FusionProcessResponse)
def get_process_by_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    process = FusionService.get_process_by_proposal(db, proposal_id)
    if not process:
        raise HTTPException(status_code=404, detail="Proceso de fusión no encontrado para esta propuesta")
    return process

@router.post("/{process_id}/stage", response_model=FusionProcessResponse)
def advance_stage(
    process_id: int,
    new_stage: FusionStage,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    process = FusionService.advance_stage(db, process_id, new_stage)
    if not process:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")
    return process

@router.post("/{process_id}/documents", response_model=FusionDocumentResponse)
def upload_document(
    process_id: int,
    doc_in: FusionDocumentBase,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    return FusionService.add_document(db, process_id, doc_in, current_user.id)
