import sys
sys.path.append("/home/caracas2025/Documentos/mutual/civiccore/backend")
from civiccore.core.database import SessionLocal
from civiccore.modules.governance.models import Proposal
from civiccore.modules.governance.schemas import ProposalResponse
from civiccore.modules.governance.service import GovernanceService

db = SessionLocal()
proposals = GovernanceService.get_all_proposals(db)

for p in proposals:
    try:
        res = ProposalResponse.model_validate(p)
        print(f"Prop {p.id} OK")
    except Exception as e:
        print(f"Prop {p.id} ERROR: {e}")
