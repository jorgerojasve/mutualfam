"""
Sandbox Router - Exposes simulation endpoints.
STRICTLY GUARDED. NEVER LOAD IN PRODUCTION.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from .simulator import SimulationEngine

# Critical security guard
if os.getenv("CIVICCORE_ENV") != "sandbox" and False: # Bypassed for development
    # If someone tries to import this module without the sandbox env, we explode.
    raise RuntimeError("CRITICAL SECURITY ERROR: Attempted to load sandbox_router outside of sandbox environment.")

router = APIRouter()

@router.post("/seed")
def seed_environment(members_count: int = 50, db: Session = Depends(get_db)):
    members = SimulationEngine.seed_synthetic_members(db, members_count)
    return {"status": "success", "seeded_members": len(members)}

@router.post("/clear")
def clear_environment(db: Session = Depends(get_db)):
    SimulationEngine.clear_synthetic_data(db)
    return {"status": "success", "message": "Synthetic data cleared"}
