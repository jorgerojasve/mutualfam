from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from civiccore.core.database import Base
from civiccore.modules.governance.models import Proposal, ProposalStatus, VotingMechanism
from civiccore.modules.governance.schemas import ProposalCreate
from civiccore.modules.governance.service import GovernanceService
from civiccore.modules.config.service import ConfigService
from civiccore.testing.simulator import SimulationEngine

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)
db = TestingSessionLocal()
ConfigService.set_value(db, "QUORUM_ASAMBLEA", "20")
ConfigService.set_value(db, "SISTEMA_GOBERNANZA", "UNA_FASE_MANUAL")

members = SimulationEngine.seed_synthetic_members(db, 100)
author = members[0]

proposal_in = ProposalCreate(
    title="Reducir Quorum",
    content="El quorum debe ser 1%",
    category="configuracion", 
    voting_mechanism=VotingMechanism.QUADRATIC,
    extra_fields={"variable": "QUORUM_ASAMBLEA", "new_value": "1"}
)

proposal = GovernanceService.create_proposal(db, author.id, proposal_in)
proposal.status = ProposalStatus.VOTING
db.commit()

enriched_prop = GovernanceService._enrich_proposal(db, proposal)
print(f"Quorum Needed: {enriched_prop.quorum_needed}")
print(f"Total Members in DB: {db.query(Member).count() if 'Member' in globals() else 'Need import'}")
