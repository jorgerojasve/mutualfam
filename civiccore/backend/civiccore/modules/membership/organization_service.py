"""
Organization Events Service
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone
from typing import Dict, Any
from .models import OrganizationEvent

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


