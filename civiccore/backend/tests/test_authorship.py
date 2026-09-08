import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from civiccore.core.database import Base
from civiccore.modules.authorship.schemas import DocumentCreate, AuthorshipCreate
from civiccore.modules.authorship.models import AuthorRole
from civiccore.modules.authorship.service import AuthorshipService

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_hashing_logic():
    content = "This is a secret document content"
    hash1 = AuthorshipService.calculate_hash(content)
    hash2 = AuthorshipService.calculate_hash(content)
    hash3 = AuthorshipService.calculate_hash(content + " modified")
    
    assert hash1 == hash2
    assert hash1 != hash3
    assert len(hash1) == 64  # SHA-256 hex length

def test_document_creation_and_authorship(db_session):
    doc_in = DocumentCreate(
        title="Research Paper 2026",
        document_type="paper",
        content_hash="dummyhash123",
        authors=[
            AuthorshipCreate(member_id=1, role=AuthorRole.MAIN_AUTHOR),
            AuthorshipCreate(external_name="Dr. External", role=AuthorRole.REVIEWER)
        ]
    )
    doc = AuthorshipService.create_document(db_session, doc_in)
    
    assert doc.id is not None
    assert doc.title == "Research Paper 2026"
    assert len(doc.authorships) == 2
    assert doc.authorships[0].role == AuthorRole.MAIN_AUTHOR
    assert doc.authorships[1].external_name == "Dr. External"

def test_document_sealing(db_session):
    # 1. Create document
    doc_in = DocumentCreate(
        title="Official Resolution",
        document_type="resolution",
        content_hash="realhash456"
    )
    doc = AuthorshipService.create_document(db_session, doc_in)
    
    # 2. Seal it
    record = AuthorshipService.seal_document(db_session, doc.id, sealed_by="admin_sig")
    
    assert record.id is not None
    assert record.document_id == doc.id
    assert record.sealed_by == "admin_sig"
    assert record.signature is not None
    
    # Check that signature matches expected
    expected_sig = AuthorshipService.calculate_hash(f"realhash456:admin_sig")
    assert record.signature == expected_sig

def test_seal_document_without_hash_fails(db_session):
    doc_in = DocumentCreate(title="Draft")
    doc = AuthorshipService.create_document(db_session, doc_in)
    
    with pytest.raises(ValueError):
        AuthorshipService.seal_document(db_session, doc.id, sealed_by="admin_sig")
