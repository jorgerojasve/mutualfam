from sqlalchemy.orm import Session
from .models import FusionProcess, FusionDocument, FusionStage
from .schemas import FusionProcessCreate, FusionDocumentBase
from typing import List

class FusionService:
    @staticmethod
    def create_process(db: Session, process_in: FusionProcessCreate) -> FusionProcess:
        process = FusionProcess(
            proposal_id=process_in.proposal_id,
            target_organization_name=process_in.target_organization_name,
            is_external=process_in.is_external
        )
        db.add(process)
        db.commit()
        db.refresh(process)
        return process

    @staticmethod
    def get_process(db: Session, process_id: int) -> FusionProcess:
        return db.query(FusionProcess).filter(FusionProcess.id == process_id).first()
        
    @staticmethod
    def get_process_by_proposal(db: Session, proposal_id: int) -> FusionProcess:
        return db.query(FusionProcess).filter(FusionProcess.proposal_id == proposal_id).first()

    @staticmethod
    def advance_stage(db: Session, process_id: int, new_stage: FusionStage) -> FusionProcess:
        process = db.query(FusionProcess).filter(FusionProcess.id == process_id).first()
        if process:
            process.current_stage = new_stage
            db.commit()
            db.refresh(process)
        return process

    @staticmethod
    def add_document(db: Session, process_id: int, doc_in: FusionDocumentBase, uploader_id: int = None) -> FusionDocument:
        doc = FusionDocument(
            process_id=process_id,
            title=doc_in.title,
            document_type=doc_in.document_type,
            stage_required=doc_in.stage_required,
            file_path=doc_in.file_path,
            uploaded_by=uploader_id
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc
