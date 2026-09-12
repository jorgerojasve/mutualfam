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

def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Initialize basic config
    ConfigService.set_value(db, "QUORUM_ASAMBLEA", "20")
    ConfigService.set_value(db, "SISTEMA_GOBERNANZA", "UNA_FASE_MANUAL")
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_ataque_gobernanza_regla_constitucional(db_session):
    # Seed 100 members
    members = SimulationEngine.seed_synthetic_members(db_session, 100)
    author = members[0]
    
    # Author creates a configuration proposal to lower the quorum
    proposal_in = ProposalCreate(
        title="Reducir Quorum",
        content="El quorum debe ser 1%",
        category="configuracion", # This should trigger the constitutional lock
        voting_mechanism=VotingMechanism.QUADRATIC, # This should be overridden to SIMPLE
        extra_fields={"variable": "QUORUM_ASAMBLEA", "new_value": "1"}
    )
    
    proposal = GovernanceService.create_proposal(db_session, author.id, proposal_in)
    
    # The mechanism must be forced to SIMPLE
    assert proposal.voting_mechanism == VotingMechanism.SIMPLE
    
    # Status to VOTING
    proposal.status = ProposalStatus.VOTING
    db_session.commit()
    
    # Check quorum needed (must be at least 50% for configuracion, even though QUORUM_ASAMBLEA=20)
    enriched_prop = GovernanceService._enrich_proposal(db_session, proposal)
    assert enriched_prop.quorum_needed == 50
    
    # Simulate a governance attack: only 30 people vote (below 50% quorum)
    SimulationEngine.simulate_votes(db_session, proposal, members[:30], yes_ratio=1.0, no_ratio=0.0, abstain_ratio=0.0)
    
    # Calculate results
    results = GovernanceService.calculate_proposal_results(db_session, proposal)
    
    # Should fail due to quorum
    assert results["passed"] == False
    assert proposal.status == ProposalStatus.REJECTED

def test_quorum_normal(db_session):
    # Seed 100 members
    members = SimulationEngine.seed_synthetic_members(db_session, 100)
    author = members[0]
    
    proposal_in = ProposalCreate(
        title="Gasto normal",
        content="Gastar 100",
        category="general",
        voting_mechanism=VotingMechanism.SIMPLE,
    )
    
    proposal = GovernanceService.create_proposal(db_session, author.id, proposal_in)
    proposal.status = ProposalStatus.VOTING
    db_session.commit()
    
    enriched_prop = GovernanceService._enrich_proposal(db_session, proposal)
    assert enriched_prop.quorum_needed == 20 # General proposal uses standard 20% quorum
    
    # 25 people vote yes
    SimulationEngine.simulate_votes(db_session, proposal, members[:25], yes_ratio=1.0, no_ratio=0.0, abstain_ratio=0.0)
    
    results = GovernanceService.calculate_proposal_results(db_session, proposal)
    assert results["passed"] == True
    assert proposal.status == ProposalStatus.APPROVED

if __name__ == "__main__":
    db_gen = db_session()
    db = next(db_gen)
    test_quorum_normal(db)
    print("test_quorum_normal PASSED")
    try: next(db_gen)
    except StopIteration: pass
    
    db_gen2 = db_session()
    db2 = next(db_gen2)
    test_ataque_gobernanza_regla_constitucional(db2)
    print("test_ataque_gobernanza_regla_constitucional PASSED")
    try: next(db_gen2)
    except StopIteration: pass
    
    print("ALL TESTS PASSED")
