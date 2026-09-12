from civiccore.core.database import SessionLocal
from civiccore.modules.governance.service import GovernanceService
from civiccore.modules.governance.schemas import ProposalResponse

db = SessionLocal()
try:
    proposals = GovernanceService.get_all_proposals(db)
    print("Fetched from DB:", len(proposals))
    for p in proposals:
        # Pydantic validation simulation
        res = ProposalResponse.model_validate(p)
        print("Validated:", res.id)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
