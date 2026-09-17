import os
import sys
import shutil
import datetime

# Setup paths
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.insert(0, backend_dir)

from civiccore.core.database import SessionLocal, Base, engine
from civiccore.modules.membership.models import Member
from civiccore.modules.governance.models import Proposal, ProposalStatus, ProposalType, VotingMechanism
from civiccore.modules.fusion.models import FusionProcess, FusionDocument, FusionStage

def get_db_path():
    from civiccore.core.config import settings
    return settings.database_url.replace("sqlite:///", "")

def save_backup(suffix):
    db_path = get_db_path()
    backup_dir = os.path.join(os.path.dirname(db_path), "backups")
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    backup_path = os.path.join(backup_dir, f"fusion_{suffix}.db")
    shutil.copy2(db_path, backup_path)
    print(f"Saved {backup_path}")

def run_seed():
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS fusion_documents"))
            conn.execute(text("DROP TABLE IF EXISTS fusion_processes"))
            conn.commit()
    except Exception as e:
        print("Warning dropping tables:", e)
        
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        db.query(FusionDocument).delete()
        db.query(FusionProcess).delete()
        db.query(Proposal).filter(Proposal.title.like("%Fusión%")).delete()
        db.commit()
    except Exception as e:
        print("Warning clearing data:", e)
        db.rollback()
    
    # 3. Ensure we have an author
    author = db.query(Member).first()
    if not author:
        author = Member(first_name="Admin", last_name="Prueba", email="admin@prueba.com", identifier="admin123", hashed_password="xxx")
        db.add(author)
        db.commit()
        db.refresh(author)
        
    print("--- Generando Escenario 1: Exploración ---")
    proposal = Proposal(
        author_id=author.id,
        title="Fusión con Cooperativa 'La Esperanza'",
        content="Acuerdo inicial para explorar una fusión estratégica con la Cooperativa La Esperanza para expandir nuestros servicios.",
        category="configuracion",
        proposal_type=ProposalType.STANDARD,
        voting_mechanism=VotingMechanism.SIMPLE,
        status=ProposalStatus.DEBATE
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    
    process = FusionProcess(
        proposal_id=proposal.id,
        target_organization_name="Cooperativa La Esperanza",
        is_external=True,
        current_stage=FusionStage.EXPLORATION
    )
    db.add(process)
    db.commit()
    db.refresh(process)
    
    save_backup("stage_1_exploracion")
    
    print("--- Generando Escenario 2: Due Diligence ---")
    process.current_stage = FusionStage.DUE_DILIGENCE
    
    doc1 = FusionDocument(
        process_id=process.id,
        title="Estatutos Originales La Esperanza",
        document_type="statutes",
        stage_required=FusionStage.DUE_DILIGENCE,
        file_path="/dummy/path/estatutos.pdf",
        uploaded_by=author.id
    )
    doc2 = FusionDocument(
        process_id=process.id,
        title="Estados Financieros 2025",
        document_type="financials",
        stage_required=FusionStage.DUE_DILIGENCE,
        file_path="/dummy/path/finanzas.pdf",
        uploaded_by=author.id
    )
    db.add_all([doc1, doc2])
    db.commit()
    
    save_backup("stage_2_due_diligence")
    
    print("--- Generando Escenario 3: Votación ---")
    process.current_stage = FusionStage.VOTING
    proposal.status = ProposalStatus.VOTING
    proposal.voting_starts_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    proposal.voting_ends_at = proposal.voting_starts_at + datetime.timedelta(days=7)
    db.commit()
    
    save_backup("stage_3_votacion")
    
    print("Escenarios generados con éxito.")

if __name__ == "__main__":
    run_seed()
