from fastapi import APIRouter

router = APIRouter()

# Placeholder for exchange rates
@router.get("/")
def get_exchange_rates():
    return {"MTS": 1.0, "USD": 1.0, "VES": 36.5}
