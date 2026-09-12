import os
import sys
sys.path.append(os.path.abspath("/home/caracas2025/Documentos/mutual/civiccore/backend"))

from civiccore.core.database import SessionLocal
from civiccore.modules.governance.service import GovernanceService

db = SessionLocal()
try:
    proposals = GovernanceService.get_all_proposals(db)
    print("Success. Total proposals:", len(proposals))
except Exception as e:
    import traceback
    traceback.print_exc()
