from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_config():
    # MutualFam configuration response
    return {
        "mutual_name": "Mutual Familiar",
        "currency": "USD",
        "local_currency": "VES",
        "features": {
            "loans_enabled": True,
            "funds_enabled": True
        }
    }
