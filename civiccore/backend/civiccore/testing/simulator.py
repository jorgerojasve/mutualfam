"""
Simulation Engine for testing governance scenarios.
"""
from sqlalchemy.orm import Session
from ..modules.membership.models import Member, MemberStatus
from ..modules.governance.models import Proposal, Vote
from ..modules.governance.service import GovernanceService
from ..modules.governance.schemas import VoteCreate
from ..core.auth import get_password_hash
import random

class SimulationEngine:
    @staticmethod
    def seed_synthetic_members(db: Session, count: int) -> list[Member]:
        members = []
        for i in range(count):
            # Create synthetic members with a standard password
            member = Member(
                identifier=f"SIM_ID_{random.randint(100000, 999999)}_{i}",
                email=f"sim_{random.randint(1000, 9999)}_member_{i}@mutualsol.org",
                first_name=f"SimUser",
                last_name=f"{i}",
                phone="0000000000",
                hashed_password=get_password_hash("simpass123"),
                role="member",
                status=MemberStatus.ACTIVE,
                extra_fields={"is_synthetic": True}
            )
            db.add(member)
            members.append(member)
        db.commit()
        for m in members:
            db.refresh(m)
        return members

    @staticmethod
    def simulate_votes(db: Session, proposal: Proposal, members: list[Member], yes_ratio: float, no_ratio: float, abstain_ratio: float):
        total = len(members)
        yes_count = int(total * yes_ratio)
        no_count = int(total * no_ratio)
        abstain_count = int(total * abstain_ratio)
        
        # We randomize the members to avoid patterns
        random.shuffle(members)
        
        for i, member in enumerate(members):
            if i < yes_count:
                val = 1
            elif i < yes_count + no_count:
                val = -1
            elif i < yes_count + no_count + abstain_count:
                val = 0
            else:
                continue # Did not vote
                
            vote_in = VoteCreate(vote_value=val, points_used=0, preference_order=None)
            try:
                GovernanceService.cast_vote(db, proposal, member.id, vote_in)
            except ValueError:
                pass # ignore mechanism validations for simulation if any fail

    @staticmethod
    def clear_synthetic_data(db: Session):
        # Delete votes from synthetic members
        synthetic_members = db.query(Member).filter(Member.email.like("sim_%_member_%@mutualsol.org")).all()
        member_ids = [m.id for m in synthetic_members]
        if member_ids:
            db.query(Vote).filter(Vote.member_id.in_(member_ids)).delete(synchronize_session=False)
            db.query(Member).filter(Member.id.in_(member_ids)).delete(synchronize_session=False)
            db.commit()
