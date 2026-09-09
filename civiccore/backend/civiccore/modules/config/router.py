from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ...core.database import get_db
from .schemas import SystemConfigResponse
from .service import ConfigService

router = APIRouter()

@router.get("/", response_model=List[SystemConfigResponse])
def get_config(db: Session = Depends(get_db)):
    # Initialize defaults if empty
    if not ConfigService.get_all(db):
        ConfigService.seed_defaults(db)
    return ConfigService.get_all(db)
