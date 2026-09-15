import json
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os

from .models import Member
from ..governance.models import Proposal, Vote
# ...

def utcnow():
    return datetime.now(timezone.utc)

def generate_mitosis_snapshot(db: Session, leaving_member_ids: list, snapshot_name: str = "mitosis_snapshot") -> str:
    """
    Generates a JSON snapshot containing the records of the members that are leaving
    to form the new organization.
    """
    snapshot = {
        "export_date": utcnow().isoformat(),
        "type": "mitosis_export",
        "members": [],
        "financial_state": {
            "total_withdrawn_capital": 0.0,
            "currency": "USD" # Replace with actual logic
        }
    }
    
    total_capital = 0.0
    
    for m_id in leaving_member_ids:
        member = db.query(Member).filter(Member.id == m_id).first()
        if member:
            # Here we would also calculate their actual shares/credits from the finance module
            # Mocking a fixed capital per member for the snapshot
            member_capital = 100.0 
            total_capital += member_capital
            
            snapshot["members"].append({
                "identifier": member.identifier,
                "email": member.email,
                "first_name": member.first_name,
                "last_name": member.last_name,
                "role": member.role,
                "capital_share": member_capital
            })
            
    snapshot["financial_state"]["total_withdrawn_capital"] = total_capital
    
    # Save to file
    file_path = f"/tmp/{snapshot_name}_{int(utcnow().timestamp())}.json"
    with open(file_path, "w") as f:
        json.dump(snapshot, f, indent=2)
        
    return file_path
