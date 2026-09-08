from fastapi import APIRouter

router = APIRouter()

# Placeholder for market endpoints
@router.get("/")
def get_market_items():
    return [{"id": 1, "item": "Curso de React Native", "price": 50, "currency": "MTS"}]
