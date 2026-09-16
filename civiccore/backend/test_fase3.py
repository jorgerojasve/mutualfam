import os
import sys

# Setup environment to load the backend modules
backend_path = "/home/caracas2025/Documentos/mutual/civiccore/backend"
sys.path.append(backend_path)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from civiccore.core.database import Base, get_db
from civiccore.modules.membership.models import Member, MemberStatus, MemberExpulsionProcess, MemberWithdrawalRequest, OrganizationEvent
from civiccore.modules.governance.models import Proposal, ProposalStatus, ProposalType, Vote, VotingMechanism
from civiccore.modules.governance.service import GovernanceService
from civiccore.modules.governance.schemas import ProposalCreate, VoteCreate
from civiccore.modules.config.service import ConfigService

# Use a test SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/test_svmm.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Initialize basic config
    ConfigService.set_value(db, "EXPULSION_UMBRAL_APROBACION", "0.66")
    ConfigService.set_value(db, "DIVISION_UMBRAL_APROBACION", "0.66")
    ConfigService.set_value(db, "SISTEMA_GOBERNANZA", "UNA_FASE") # For immediate results
    db.commit()
    
    return db

def teardown_db():
    Base.metadata.drop_all(bind=engine)

def test_expulsion_flow():
    db = setup_db()
    print("\n--- TEST: FLUJO DE EXPULSIÓN Y DEFENSA ---")
    
    # 1. Crear usuarios
    admin = Member(identifier="A001", email="admin@svmm.org", hashed_password="pw", first_name="Admin", last_name="User", status=MemberStatus.ACTIVE, role="admin")
    target = Member(identifier="T001", email="target@svmm.org", hashed_password="pw", first_name="Target", last_name="User", status=MemberStatus.ACTIVE)
    voter = Member(identifier="V001", email="voter@svmm.org", hashed_password="pw", first_name="Voter", last_name="User", status=MemberStatus.ACTIVE)
    
    db.add_all([admin, target, voter])
    db.commit()
    db.refresh(admin)
    db.refresh(target)
    db.refresh(voter)
    
    print(f"✅ Usuarios creados: Admin ({admin.id}), Acusado ({target.id}), Votante ({voter.id})")
    
    # 2. Crear Propuesta de Expulsión
    prop_in = ProposalCreate(
        title="Expulsión de Target por violar código de ética",
        content="Se propone la expulsión según artículo X.",
        proposal_type="expulsion",
        target_member_id=target.id,
        voting_mechanism=VotingMechanism.SIMPLE
    )
    proposal = GovernanceService.create_proposal(db, admin.id, prop_in)
    print(f"✅ Propuesta creada: ID {proposal.id} (Status: {proposal.status})")
    
    # 3. Target añade su defensa
    proposal.defense_text = "No es cierto, fue un malentendido."
    proposal.status = ProposalStatus.VOTING
    db.commit()
    print(f"✅ Defensa añadida: '{proposal.defense_text}'")
    
    # 4. Votación a favor de la expulsión
    v_admin = VoteCreate(vote_value=1.0)
    v_voter = VoteCreate(vote_value=1.0)
    
    GovernanceService.cast_vote(db, proposal, admin.id, v_admin, 100)
    GovernanceService.cast_vote(db, proposal, voter.id, v_voter, 100)
    print("✅ Votos emitidos a favor de la expulsión.")
    
    # 5. Calcular Resultados
    results = GovernanceService.calculate_proposal_results(db, proposal)
    print(f"✅ Resultados calculados: Passed={results['passed']}")
    
    assert results["passed"] == True
    
    # 6. Verificar efectos de la expulsión
    db.refresh(target)
    assert target.status == MemberStatus.EXPELLED, f"El estado debe ser EXPELLED, pero es {target.status}"
    print(f"✅ Estado del acusado actualizado a: {target.status}")
    
    # Verificar retiro automático
    withdrawal = db.query(MemberWithdrawalRequest).filter(MemberWithdrawalRequest.member_id == target.id).first()
    assert withdrawal is not None, "No se generó la solicitud de retiro."
    assert withdrawal.status == "pending", "La solicitud de retiro no está pendiente."
    print(f"✅ Solicitud de retiro automático generada con fecha efectiva: {withdrawal.effective_at}")
    
    db.close()
    teardown_db()

def test_mitosis_flow():
    db = setup_db()
    print("\n--- TEST: FLUJO DE MITOSIS Y SNAPSHOT ---")
    
    # 1. Crear usuarios
    admin = Member(identifier="A002", email="admin2@svmm.org", hashed_password="pw", first_name="Admin", last_name="User", status=MemberStatus.ACTIVE, role="admin")
    leaving_1 = Member(identifier="L001", email="l1@svmm.org", hashed_password="pw", first_name="Leaving", last_name="One", status=MemberStatus.ACTIVE)
    leaving_2 = Member(identifier="L002", email="l2@svmm.org", hashed_password="pw", first_name="Leaving", last_name="Two", status=MemberStatus.ACTIVE)
    
    db.add_all([admin, leaving_1, leaving_2])
    db.commit()
    db.refresh(admin)
    db.refresh(leaving_1)
    db.refresh(leaving_2)
    
    # 2. Crear Propuesta de Mitosis
    metadata = {
        "leaving_member_ids": [leaving_1.id, leaving_2.id],
        "reason": "Creación de capítulo regional"
    }
    
    prop_in = ProposalCreate(
        title="División de la organización para capítulo regional",
        content="Se separan 2 miembros con sus fondos.",
        proposal_type="division",
        extra_fields=metadata,
        voting_mechanism=VotingMechanism.SIMPLE
    )
    proposal = GovernanceService.create_proposal(db, admin.id, prop_in)
    proposal.status = ProposalStatus.VOTING
    db.commit()
    
    # 3. Votación
    GovernanceService.cast_vote(db, proposal, admin.id, VoteCreate(vote_value=1.0), 100)
    
    # 4. Calcular Resultados
    results = GovernanceService.calculate_proposal_results(db, proposal)
    print(f"✅ Resultados Mitosis calculados: Passed={results['passed']}")
    
    assert results["passed"] == True
    
    # 5. Verificar evento de organización y snapshot
    event = db.query(OrganizationEvent).filter(OrganizationEvent.proposal_id == proposal.id).first()
    assert event is not None, "No se generó el evento de organización."
    
    snapshot_path = event.metadata_.get("snapshot_path")
    assert snapshot_path is not None, "No se registró la ruta del snapshot."
    print(f"✅ Snapshot generado en: {snapshot_path}")
    
    assert os.path.exists(snapshot_path), "El archivo de snapshot no se creó."
    
    import json
    with open(snapshot_path, "r") as f:
        data = json.load(f)
        assert len(data["members"]) == 2, "El snapshot debe contener 2 miembros."
        print(f"✅ Datos del snapshot validados correctamente ({data['financial_state']['total_withdrawn_capital']} capital extraído).")
    
    # Verificar retiro automático
    for m_id in [leaving_1.id, leaving_2.id]:
        withdrawal = db.query(MemberWithdrawalRequest).filter(MemberWithdrawalRequest.member_id == m_id).first()
        assert withdrawal is not None, f"No se generó retiro para {m_id}"
    
    print("✅ Solicitudes de retiro automático generadas para miembros salientes.")
    
    db.close()
    teardown_db()

if __name__ == "__main__":
    try:
        test_expulsion_flow()
        test_mitosis_flow()
        print("\n🎉 TODOS LOS TESTS DE LA FASE 3 PASARON EXITOSAMENTE 🎉")
    except AssertionError as e:
        print(f"\n❌ ERROR DE TEST: {e}")
    except Exception as e:
        import traceback
        traceback.print_exc()

