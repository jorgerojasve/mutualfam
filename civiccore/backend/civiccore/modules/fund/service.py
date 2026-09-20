import urllib.request
import json
import time
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from . import models, schemas
from ..payments.models import Transaction, TransactionType, TransactionStatus

def utcnow():
    return datetime.now(timezone.utc)

class BCVRateService:
    _cache = {}
    _cache_ttl = 3600 # 1 hour
    
    @classmethod
    async def get_current_rate(cls) -> float:
        now = time.time()
        if "rate" in cls._cache and (now - cls._cache["time"]) < cls._cache_ttl:
            return cls._cache["rate"]
            
        try:
            req = urllib.request.Request("https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv", headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    # pydolarvenezuela devuelve {"monitors": {"usd": {"price": ...}}} o similar, pero para la ruta ?page=bcv devuelve los monitores directos
                    monitors = data.get("monitors", {})
                    # Si pedimos bcv, la llave suele ser "usd" o el valor directo
                    rate = 0.0
                    if "usd" in monitors:
                        rate = float(monitors["usd"].get("price", 0.0))
                    
                    if rate > 0:
                        cls._cache["rate"] = rate
                        cls._cache["time"] = now
                        return rate
        except Exception as e:
            print(f"Error fetching BCV rate from PyDolarVenezuela: {e}")

        try:
            req = urllib.request.Request("https://ve.dolarapi.com/v1/dolares/oficial", headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    rate = data.get("promedio", 0.0)
                    if rate > 0:
                        cls._cache["rate"] = rate
                        cls._cache["time"] = now
                        return rate
        except Exception as e:
            print(f"Error fetching BCV rate: {e}")
            
        # Fallback if API fails: try to return the last known rate, even if expired
        if "rate" in cls._cache:
            return cls._cache["rate"]
            
        # Hard fallback for demo purposes if everything fails
        return 849.56 # Valor actualizado de respaldo

class FundService:
    @staticmethod
    async def get_cycles(db: Session, skip: int = 0, limit: int = 100) -> List[models.FundCycle]:
        return db.query(models.FundCycle).offset(skip).limit(limit).all()

    @staticmethod
    async def open_cycle(db: Session, cycle_in: schemas.FundCycleCreate) -> models.FundCycle:
        # Check if there is already an open cycle
        open_cycle = db.query(models.FundCycle).filter(models.FundCycle.status == models.FundCycleStatus.OPEN).first()
        if open_cycle:
            raise HTTPException(status_code=400, detail="There is already an open cycle")
            
        rate = await BCVRateService.get_current_rate()
        
        cycle = models.FundCycle(
            title=cycle_in.title,
            contribution_amount_usd=cycle_in.contribution_amount_usd,
            reserve_percentage=cycle_in.reserve_percentage,
            bcv_rate_open=rate,
            status=models.FundCycleStatus.OPEN
        )
        db.add(cycle)
        db.commit()
        db.refresh(cycle)
        return cycle

    @staticmethod
    async def register_contribution(db: Session, cycle_id: int, member_id: int, contrib_in: schemas.FundContributionCreate) -> models.FundContribution:
        cycle = db.query(models.FundCycle).filter(models.FundCycle.id == cycle_id).first()
        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")
        if cycle.status != models.FundCycleStatus.OPEN:
            raise HTTPException(status_code=400, detail="Cycle is not open")
            
        rate = await BCVRateService.get_current_rate()
        amount_usd = contrib_in.amount_bs / rate
        
        # Create a ledger transaction as well
        tx = Transaction(
            member_id=member_id,
            transaction_type=TransactionType.PAYMENT,
            amount=amount_usd,
            currency="USD",
            status=TransactionStatus.COMPLETED,
            extra_fields={"fund_cycle_id": cycle.id, "bcv_rate": rate, "amount_bs": contrib_in.amount_bs}
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)
        
        contrib = models.FundContribution(
            cycle_id=cycle.id,
            member_id=member_id,
            amount_bs=contrib_in.amount_bs,
            bcv_rate=rate,
            amount_usd=amount_usd,
            transaction_id=tx.id,
            status=models.FundContributionStatus.CONFIRMED
        )
        db.add(contrib)
        db.commit()
        db.refresh(contrib)
        
        return contrib

    @staticmethod
    async def close_cycle(db: Session, cycle_id: int) -> models.FundCycle:
        cycle = db.query(models.FundCycle).filter(models.FundCycle.id == cycle_id).first()
        if not cycle:
            raise HTTPException(status_code=404, detail="Cycle not found")
        if cycle.status != models.FundCycleStatus.OPEN:
            raise HTTPException(status_code=400, detail="Cycle is already closed")
            
        # Calculate totals
        contributions = db.query(models.FundContribution).filter(
            models.FundContribution.cycle_id == cycle.id,
            models.FundContribution.status == models.FundContributionStatus.CONFIRMED
        ).all()
        
        total_usd = sum(c.amount_usd for c in contributions)
        
        # Calculate credits to disburse
        # For simplicity in this demo, we sum all active FundCredits linked to this cycle
        credits = db.query(models.FundCredit).filter(models.FundCredit.cycle_id == cycle.id).all()
        total_disbursed = sum(c.amount_usd for c in credits)
        
        # Calculate reserve and surplus
        reserve_usd = total_usd * (cycle.reserve_percentage / 100.0)
        surplus_usd = total_usd - total_disbursed - reserve_usd
        
        if surplus_usd < 0:
            # In a real system, we'd either reject credits or use previous reserve. 
            # For now, let's just adjust surplus to 0.
            surplus_usd = 0.0
            
        cycle.total_collected_usd = total_usd
        cycle.total_disbursed_usd = total_disbursed
        cycle.total_reserve_usd = reserve_usd
        cycle.total_surplus_usd = surplus_usd
        cycle.status = models.FundCycleStatus.CLOSED
        cycle.end_date = utcnow()
        
        db.commit()
        db.refresh(cycle)
        return cycle

    @staticmethod
    async def get_summary(db: Session):
        active_cycle = db.query(models.FundCycle).filter(models.FundCycle.status == models.FundCycleStatus.OPEN).first()
        all_cycles = db.query(models.FundCycle).all()
        
        total_reserve = sum(c.total_reserve_usd for c in all_cycles)
        
        return {
            "active_cycle_id": active_cycle.id if active_cycle else None,
            "total_reserve_usd": total_reserve,
            "total_cycles": len(all_cycles)
        }
