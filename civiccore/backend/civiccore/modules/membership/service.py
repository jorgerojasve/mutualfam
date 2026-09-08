"""
Membership Module Service Logic
"""
from sqlalchemy.orm import Session
from typing import Optional, List
from .models import Member, MemberStatus
from .schemas import MemberCreate, MemberUpdate
from ...core.auth import get_password_hash

class MembershipService:
    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[Member]:
        return db.query(Member).filter(Member.email == email).first()

    @staticmethod
    def get_by_identifier(db: Session, identifier: str) -> Optional[Member]:
        return db.query(Member).filter(Member.identifier == identifier).first()

    @staticmethod
    def get_by_id(db: Session, member_id: int) -> Optional[Member]:
        return db.query(Member).filter(Member.id == member_id).first()

    @staticmethod
    def create_member(db: Session, member_in: MemberCreate) -> Member:
        # First user is typically admin/founder and active
        is_first = db.query(Member).count() == 0
        role = "admin" if is_first else "member"
        status = MemberStatus.ACTIVE if is_first else MemberStatus.PENDING

        hashed_password = get_password_hash(member_in.password)
        
        db_member = Member(
            identifier=member_in.identifier,
            email=member_in.email,
            first_name=member_in.first_name,
            last_name=member_in.last_name,
            phone=member_in.phone,
            hashed_password=hashed_password,
            role=role,
            status=status,
            extra_fields=member_in.extra_fields
        )
        
        db.add(db_member)
        db.commit()
        db.refresh(db_member)
        return db_member

    @staticmethod
    def get_all_members(db: Session, skip: int = 0, limit: int = 100) -> List[Member]:
        return db.query(Member).offset(skip).limit(limit).all()

    @staticmethod
    def update_member(db: Session, member: Member, update_data: MemberUpdate) -> Member:
        update_dict = update_data.model_dump(exclude_unset=True)
        
        # Handle extra_fields safely (merge instead of overwrite)
        if "extra_fields" in update_dict and update_dict["extra_fields"]:
            new_extras = dict(member.extra_fields) if member.extra_fields else {}
            new_extras.update(update_dict.pop("extra_fields"))
            member.extra_fields = new_extras

        for key, value in update_dict.items():
            setattr(member, key, value)
            
        db.commit()
        db.refresh(member)
        return member

    @staticmethod
    def approve_member(db: Session, member: Member) -> Member:
        member.status = MemberStatus.ACTIVE
        db.commit()
        db.refresh(member)
        return member
