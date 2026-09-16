import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import json
import os

from civiccore.core.database import Base, get_db
from civiccore.modules.membership.models import Member
from civiccore.modules.payments.models import Transaction, TransactionType
from civiccore.modules.membership.fusion_import import process_fusion_snapshot
from civiccore.modules.membership.mitosis_export import generate_mitosis_snapshot

from app import app
from main_test import override_get_db, TestingSessionLocal

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_fusion_import():
    db = TestingSessionLocal()
    try:
        # Create a mock snapshot
        snapshot = {
            "export_date": datetime.now(timezone.utc).isoformat(),
            "type": "mitosis_export",
            "financial_state": {
                "total_withdrawn_capital": 250.0,
                "currency": "USD"
            },
            "members": [
                {
                    "identifier": "EXT-1",
                    "email": "ext1@test.com",
                    "first_name": "External",
                    "last_name": "One",
                    "role": "member",
                    "capital_share": 100.0
                },
                {
                    "identifier": "EXT-2",
                    "email": "ext2@test.com",
                    "first_name": "External",
                    "last_name": "Two",
                    "role": "member",
                    "capital_share": 150.0
                }
            ]
        }
        
        # Test the process_fusion_snapshot directly
        result = process_fusion_snapshot(db, snapshot)
        
        assert result["members_imported"] == 2
        assert result["capital_imported"] == 250.0
        
        # Check DB
        members = db.query(Member).filter(Member.identifier.startswith("EXT-")).all()
        assert len(members) == 2
        
        transactions = db.query(Transaction).filter(Transaction.transaction_type == TransactionType.PAYMENT).all()
        assert len(transactions) == 2
        total_tx = sum(t.amount for t in transactions)
        assert total_tx == 250.0

        # Now test what happens if we import the SAME snapshot again (duplicates)
        result2 = process_fusion_snapshot(db, snapshot)
        assert result2["members_imported"] == 0
        assert result2["members_updated"] == 2
        
    finally:
        db.close()
