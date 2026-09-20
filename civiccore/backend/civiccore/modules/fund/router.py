from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ...core.database import get_db
from . import schemas, service

router = APIRouter()

@router.get("/rate")
async def get_bcv_rate():
    rate = await service.BCVRateService.get_current_rate()
    return {"rate": rate}

@router.get("/summary")
async def get_summary(db: Session = Depends(get_db)):
    return await service.FundService.get_summary(db)

@router.get("/cycles", response_model=List[schemas.FundCycleResponse])
async def list_cycles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return await service.FundService.get_cycles(db, skip=skip, limit=limit)

@router.post("/cycles", response_model=schemas.FundCycleResponse)
async def open_cycle(cycle_in: schemas.FundCycleCreate, db: Session = Depends(get_db)):
    return await service.FundService.open_cycle(db, cycle_in)

@router.post("/cycles/{cycle_id}/close", response_model=schemas.FundCycleResponse)
async def close_cycle(cycle_id: int, db: Session = Depends(get_db)):
    return await service.FundService.close_cycle(db, cycle_id)

@router.post("/cycles/{cycle_id}/contributions", response_model=schemas.FundContributionResponse)
async def register_contribution(cycle_id: int, member_id: int, contrib_in: schemas.FundContributionCreate, db: Session = Depends(get_db)):
    # In a real app, member_id would come from the auth token or request body if admin
    return await service.FundService.register_contribution(db, cycle_id, member_id, contrib_in)
