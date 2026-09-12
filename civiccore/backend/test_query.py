from civiccore.database import SessionLocal
from civiccore.modules.governance.models import Proposal, ProposalStatus

db = SessionLocal()
active_count = db.query(Proposal).filter(Proposal.status == ProposalStatus.VOTING).count()
print(f"Active count: {active_count}")
