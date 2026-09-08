import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from civiccore.core.database import Base
from civiccore.modules.payments.models import PaymentPlan, Transaction, Frequency, TransactionStatus, TransactionType
from civiccore.modules.payments.schemas import PaymentPlanCreate, TransactionCreate, TransactionUpdateStatus
from civiccore.modules.payments.service import PaymentService, FixedCurrencyAdapter

# In-memory DB setup for testing
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

def test_currency_adapter():
    adapter = FixedCurrencyAdapter(rates={"USD_EUR": 0.9, "EUR_USD": 1.1})
    assert adapter.get_exchange_rate("USD", "EUR") == 0.9
    assert adapter.get_exchange_rate("USD", "USD") == 1.0
    assert adapter.get_exchange_rate("GBP", "USD") == 1.0 # default fallback

def test_create_payment_plan(db_session):
    plan_in = PaymentPlanCreate(
        title="Annual Fee 2026",
        amount=150.0,
        currency="USD",
        frequency=Frequency.YEARLY
    )
    plan = PaymentService.create_plan(db_session, plan_in)
    
    assert plan.id is not None
    assert plan.title == "Annual Fee 2026"
    assert plan.amount == 150.0
    
    plans = PaymentService.list_plans(db_session)
    assert len(plans) == 1

def test_transaction_lifecycle(db_session):
    # Create fake member dependency
    # Usually we would create a member here, but we can just use an arbitrary ID since sqlite doesn't enforce FKs strictly by default
    tx_in = TransactionCreate(
        member_id=1,
        transaction_type=TransactionType.CHARGE,
        amount=150.0,
        currency="USD"
    )
    tx = PaymentService.create_transaction(db_session, tx_in)
    
    assert tx.id is not None
    assert tx.status == TransactionStatus.PENDING
    
    # Update status to completed
    update_in = TransactionUpdateStatus(
        status=TransactionStatus.COMPLETED,
        reference_number="BANK-REF-123",
        extra_fields={"receipt": "http://link.to.receipt"}
    )
    tx_updated = PaymentService.update_transaction_status(db_session, tx.id, update_in)
    
    assert tx_updated.status == TransactionStatus.COMPLETED
    assert tx_updated.reference_number == "BANK-REF-123"
    assert tx_updated.extra_fields["receipt"] == "http://link.to.receipt"
    
    # List transactions
    txs = PaymentService.list_member_transactions(db_session, 1)
    assert len(txs) == 1
    assert txs[0].id == tx.id
