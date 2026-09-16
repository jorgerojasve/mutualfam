import json
import uuid
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from .models import Member
from ..payments.models import Transaction, TransactionType, TransactionStatus

def utcnow():
    return datetime.now(timezone.utc)

def process_fusion_snapshot(db: Session, snapshot_dict: dict) -> dict:
    """
    Imports a mitosis snapshot into the current organization.
    Resolves member ID conflicts by matching identifier/email.
    Returns a summary of the import.
    """
    if snapshot_dict.get("type") != "mitosis_export":
        raise ValueError("Invalid snapshot format. Must be a mitosis_export.")

    imported_members_count = 0
    updated_members_count = 0
    total_capital_imported = 0.0

    members = snapshot_dict.get("members", [])
    
    for m in members:
        identifier = m.get("identifier")
        email = m.get("email")
        
        # 1. Check if member already exists
        existing_member = db.query(Member).filter(
            (Member.identifier == identifier) | (Member.email == email)
        ).first()

        if existing_member:
            member_id = existing_member.id
            updated_members_count += 1
        else:
            # 2. Create new member
            new_member = Member(
                identifier=identifier,
                email=email,
                first_name=m.get("first_name", "Imported"),
                last_name=m.get("last_name", "User"),
                role=m.get("role", "member"),
                status="active",
                hashed_password="fusion_placeholder_hash"
            )
            db.add(new_member)
            db.commit()
            db.refresh(new_member)
            member_id = new_member.id
            imported_members_count += 1

        # 3. Import capital as a PAYMENT transaction
        capital = m.get("capital_share", 0.0)
        if capital > 0:
            tx = Transaction(
                member_id=member_id,
                transaction_type=TransactionType.PAYMENT,
                amount=capital,
                currency="USD",
                status=TransactionStatus.COMPLETED,
                reference_number=f"FUSION-{uuid.uuid4().hex[:8]}"
            )
            db.add(tx)
            total_capital_imported += capital
            
    db.commit()
    
    return {
        "members_imported": imported_members_count,
        "members_updated": updated_members_count,
        "capital_imported": total_capital_imported,
        "currency": snapshot_dict.get("financial_state", {}).get("currency", "USD")
    }
