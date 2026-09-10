from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional
from .models import MemberVotingPoints

def utcnow():
    return datetime.now(timezone.utc)

class PointsService:
    
    @staticmethod
    def get_or_create_balance(db: Session, member_id: int, default_balance: int = 10) -> MemberVotingPoints:
        record = db.query(MemberVotingPoints).filter(MemberVotingPoints.member_id == member_id).first()
        if not record:
            record = MemberVotingPoints(member_id=member_id, balance=default_balance)
            db.add(record)
            db.commit()
            db.refresh(record)
        return record

    @staticmethod
    def renew_points_if_needed(db: Session, member_id: int, period_days: int, default_balance: int) -> MemberVotingPoints:
        record = PointsService.get_or_create_balance(db, member_id, default_balance)
        
        now = utcnow()
        # Ensure timezone-aware comparison if needed
        last_renewed = record.last_renewed_at
        if last_renewed.tzinfo is None:
            last_renewed = last_renewed.replace(tzinfo=timezone.utc)
            
        time_since_renewal = now - last_renewed
        
        if time_since_renewal >= timedelta(days=period_days):
            record.balance = default_balance
            record.last_renewed_at = now
            db.commit()
            db.refresh(record)
            
        return record

    @staticmethod
    def spend_points(db: Session, member_id: int, amount: int, period_days: int, default_balance: int) -> bool:
        if amount <= 0:
            return True
            
        # First ensure we renew if needed
        record = PointsService.renew_points_if_needed(db, member_id, period_days, default_balance)
        
        if record.balance >= amount:
            record.balance -= amount
            record.total_ever_allocated += amount
            db.commit()
            return True
        return False
