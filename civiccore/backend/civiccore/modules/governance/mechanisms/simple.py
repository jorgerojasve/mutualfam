from typing import List
from ..models import Vote, Proposal

class SimpleVoting:
    """
    Simple voting mechanism: 1 member = 1 vote.
    Valid vote values: 1.0 (yes), -1.0 (no), 0.0 (abstain)
    """
    
    def calculate_results(self, proposal: Proposal, votes: List[Vote]) -> dict:
        yes = sum(1 for v in votes if v.vote_value == 1.0)
        no = sum(1 for v in votes if v.vote_value == -1.0)
        abstain = sum(1 for v in votes if v.vote_value == 0.0)
        
        total = yes + no + abstain
        passed = yes > no if total > 0 else False
        
        return {
            "yes": yes,
            "no": no,
            "abstain": abstain,
            "total_votes": total,
            "passed": passed
        }
        
    def validate_vote(self, vote_value: float, **kwargs) -> bool:
        return vote_value in (1.0, -1.0, 0.0)
