from typing import Protocol, List
from ..models import Vote, Proposal

class VotingMechanism(Protocol):
    """
    Base protocol for voting mechanisms.
    """
    def calculate_results(self, proposal: Proposal, votes: List[Vote]) -> dict:
        """
        Calculate the results of a vote.
        Returns a dictionary with the results.
        """
        ...
    
    def validate_vote(self, vote_value: float, **kwargs) -> bool:
        """
        Validate if a vote value is valid for this mechanism.
        """
        ...
