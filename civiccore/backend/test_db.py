import sys
sys.path.append("/home/caracas2025/Documentos/mutual/civiccore/backend")
from civiccore.core.database import SessionLocal
from civiccore.modules.governance.models import Proposal

db = SessionLocal()
p = db.query(Proposal).filter(Proposal.id == 8).first()
if p:
    print(f"extra_fields type: {type(p.extra_fields)}, value: {repr(p.extra_fields)}")
    print(f"status type: {type(p.status)}, value: {repr(p.status)}")
    print(f"voting_mechanism type: {type(p.voting_mechanism)}, value: {repr(p.voting_mechanism)}")
else:
    print("Not found")
