from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ...core.database import get_db
from .schemas import SystemConfigResponse
from .service import ConfigService

router = APIRouter()

@router.get("/", response_model=List[SystemConfigResponse])
def get_config(db: Session = Depends(get_db)):
    if not ConfigService.get_all(db):
        ConfigService.seed_defaults(db)
    return ConfigService.get_all(db)

@router.get("/maturity")
def get_module_maturity():
    from civiccore.core.maturity import FRAMEWORK_MATURITY, MODULE_MATURITY
    return {
        "framework": FRAMEWORK_MATURITY,
        "modules": MODULE_MATURITY
    }
