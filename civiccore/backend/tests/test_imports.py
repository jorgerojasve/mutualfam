import pytest

def test_imports():
    from civiccore.factory import create_app
    from civiccore.modules.membership.router import router as membership_router
    from civiccore.modules.governance.router import router as governance_router
    
    app = create_app()
    assert app is not None
    assert app.title == "CivicCore Application"

def test_mechanisms():
    from civiccore.modules.governance.mechanisms import get_mechanism
    from civiccore.modules.governance.models import VotingMechanism
    
    mech = get_mechanism(VotingMechanism.SIMPLE)
    assert mech is not None
