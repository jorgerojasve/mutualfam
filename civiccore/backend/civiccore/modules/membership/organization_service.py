"""
Organization Events Service
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone
from typing import Dict, Any
from .models import OrganizationEvent, FusionProcess, FusionStage

def utcnow():
    return datetime.now(timezone.utc)

def initiate_division(db: Session, proposal_id: int, metadata: Dict[str, Any] = None) -> OrganizationEvent:
    """
    Initiates a division process after a DIVISION proposal is approved.
    Generates a snapshot of the departing members and creates a withdrawal request for their funds.
    """
    from .mitosis_export import generate_mitosis_snapshot
    from .withdrawal_service import create_withdrawal_request
    
    metadata = metadata or {}
    leaving_members = metadata.get("leaving_member_ids", [])
    
    # Generate the snapshot
    snapshot_path = generate_mitosis_snapshot(db, leaving_members)
    metadata["snapshot_path"] = snapshot_path
    
    # Auto-withdraw leaving members
    for m_id in leaving_members:
        # In a real mitosis, they are marked as WITHDRAWN or similar
        create_withdrawal_request(db, m_id)
        
    event = OrganizationEvent(
        event_type="division",
        proposal_id=proposal_id,
        metadata_=metadata,
        status="completed"
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def initiate_fusion(db: Session, proposal_id: int, metadata: Dict[str, Any] = None) -> OrganizationEvent:
    """
    Initiates a fusion process after a FUSION proposal is approved.
    """
    event = OrganizationEvent(
        event_type="fusion",
        proposal_id=proposal_id,
        metadata_=metadata or {}
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def get_organization_events(db: Session):
    """
    Returns all organization events (divisions, fusions).
    """
    return db.query(OrganizationEvent).order_by(OrganizationEvent.initiated_at.desc()).all()

def execute_fusion(db: Session, snapshot_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes a fusion process, assimilating members and funds from the snapshot.
    """
    from .fusion_import import process_fusion_snapshot
    
    result = process_fusion_snapshot(db, snapshot_dict)
    
    event = OrganizationEvent(
        event_type="fusion",
        proposal_id=0, # 0 means direct fusion without proposal (could be linked if needed)
        metadata_=result,
        status="completed"
    )
    db.add(event)
    db.commit()
    
    return result

# --- Progressive Fusion Process Functions ---

def create_fusion_contact(db: Session, proposal_id: int, external_org_name: str, external_data: Dict = None) -> FusionProcess:
    process = FusionProcess(
        initiator_proposal_id=proposal_id,
        external_org_name=external_org_name,
        stage=FusionStage.INTENTION,
        external_data=external_data or {},
        internal_data={},
        conflict_points={}
    )
    db.add(process)
    db.commit()
    db.refresh(process)
    return process

def get_fusion_processes(db: Session):
    return db.query(FusionProcess).order_by(FusionProcess.updated_at.desc()).all()

def get_fusion_process(db: Session, process_id: int) -> FusionProcess:
    return db.query(FusionProcess).filter(FusionProcess.id == process_id).first()

def advance_fusion_stage(db: Session, process_id: int, new_stage: FusionStage) -> FusionProcess:
    process = get_fusion_process(db, process_id)
    if not process:
        raise ValueError("Fusion process not found")
    process.stage = new_stage
    db.commit()
    db.refresh(process)
    return process

def update_fusion_data(db: Session, process_id: int, external_data: Dict = None, internal_data: Dict = None, conflict_points: Dict = None) -> FusionProcess:
    process = get_fusion_process(db, process_id)
    if not process:
        raise ValueError("Fusion process not found")
        
    if external_data is not None:
        # Merge dicts
        process.external_data = {**process.external_data, **external_data}
    if internal_data is not None:
        process.internal_data = {**process.internal_data, **internal_data}
    if conflict_points is not None:
        process.conflict_points = conflict_points
        
    db.commit()
    db.refresh(process)
    return process
