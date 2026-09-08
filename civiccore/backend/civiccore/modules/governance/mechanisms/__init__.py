from .simple import SimpleVoting
from .quadratic import QuadraticVoting
from ..models import VotingMechanism

def get_mechanism(mechanism_type: VotingMechanism):
    mechanisms = {
        VotingMechanism.SIMPLE: SimpleVoting(),
        VotingMechanism.QUADRATIC: QuadraticVoting(),
        # Add others as needed
    }
    
    if mechanism_type not in mechanisms:
        # Fallback to simple
        return mechanisms[VotingMechanism.SIMPLE]
        
    return mechanisms[mechanism_type]
