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
    """
    event = OrganizationEvent(
        event_type="division",
        proposal_id=proposal_id,
        metadata_=metadata or {}
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
