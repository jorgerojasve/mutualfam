from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from civiccore.core.database import Base
from civiccore.modules.governance.models import Proposal, ProposalStatus, VotingMechanism
from civiccore.modules.governance.schemas import ProposalCreate
from civiccore.modules.governance.service import GovernanceService
from civiccore.modules.config.service import ConfigService
from civiccore.testing.simulator import SimulationEngine
from civiccore.modules.membership.models import Member

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# TEST 1
Base.metadata.create_all(bind=engine)
db = TestingSessionLocal()
ConfigService.set_value(db, "QUORUM_ASAMBLEA", "20")
ConfigService.set_value(db, "SISTEMA_GOBERNANZA", "UNA_FASE_MANUAL")
SimulationEngine.seed_synthetic_members(db, 100)
print(f"Members after test 1: {db.query(Member).count()}")
db.close()
# Base.metadata.drop_all(bind=engine) # FORGOT TO DROP

# TEST 2
# Base.metadata.create_all(bind=engine) # creates nothing if already exists
db2 = TestingSessionLocal()
SimulationEngine.seed_synthetic_members(db2, 100)
print(f"Members after test 2: {db2.query(Member).count()}")
db2.close()
