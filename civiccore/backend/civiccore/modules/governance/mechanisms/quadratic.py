import math
from typing import List
from ..models import Vote, Proposal

class QuadraticVoting:
    """
    Quadratic voting mechanism.
    Cost of votes is the square of the votes cast.
    Voters allocate credits, and the actual vote weight is sqrt(credits).
    Valid vote values: any float (representing the credits allocated, positive or negative).
    """
    
    def calculate_results(self, proposal: Proposal, votes: List[Vote]) -> dict:
        total_weight_yes = 0.0
        total_weight_no = 0.0
        credits_spent = 0.0
        
        for v in votes:
            # Positive value means YES, negative means NO.
            # Weight is the square root of the absolute value of credits allocated.
            credits = abs(v.vote_value)
            weight = math.sqrt(credits)
            
            credits_spent += credits
            
            if v.vote_value > 0:
                total_weight_yes += weight
            elif v.vote_value < 0:
                total_weight_no += weight
                
        passed = total_weight_yes > total_weight_no
        
        return {
            "weight_yes": round(total_weight_yes, 2),
            "weight_no": round(total_weight_no, 2),
            "credits_spent": round(credits_spent, 2),
            "total_voters": len(votes),
            "passed": passed
        }
        
    def validate_vote(self, vote_value: float, available_credits: float = 0.0) -> bool:
        # User cannot spend more credits than they have
        return abs(vote_value) <= available_credits
