from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json

from civiccore.core.database import get_db
from routers.membership import get_current_org_member
from models import UserPaymentConfig

router = APIRouter()

class PaymentMethodsUpdate(BaseModel):
    payment_methods_json: str

@router.get("/payment_methods")
def get_user_payment_methods(org_member: dict = Depends(get_current_org_member), db: Session = Depends(get_db)):
    config = db.query(UserPaymentConfig).filter(UserPaymentConfig.user_id == org_member["user"].id).first()
    return {"payment_methods_json": config.payment_methods_json if config else "{}"}

@router.post("/payment_methods")
def update_user_payment_methods(data: PaymentMethodsUpdate, org_member: dict = Depends(get_current_org_member), db: Session = Depends(get_db)):
    config = db.query(UserPaymentConfig).filter(UserPaymentConfig.user_id == org_member["user"].id).first()
    if not config:
        config = UserPaymentConfig(user_id=org_member["user"].id, payment_methods_json=data.payment_methods_json)
        db.add(config)
    else:
        config.payment_methods_json = data.payment_methods_json
    db.commit()
    return {"message": "Configuración actualizada"}

import urllib.request
import json

import datetime

@router.get("/")
def get_config():
    # Fetch live BCV rate
    bcv_rate = 45.50
    bcv_date = ""
    is_outdated = False
    
    try:
        req = urllib.request.Request("https://rates.dolarvzla.com/bcv/current.json", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5.0) as response:
            data = json.loads(response.read().decode())
            current = data.get("current", {})
            bcv_rate = float(current.get("usd", 45.50))
            bcv_date = current.get("date", "")
    except Exception as e:
        print(f"Error fetching BCV rate: {e}")
        pass

    # Logic to determine if outdated (BCV updates ~16:00 VET Mon-Fri)
    # VET is UTC-4
    vet_now = datetime.datetime.utcnow() - datetime.timedelta(hours=4)
    if bcv_date:
        try:
            rate_date = datetime.datetime.strptime(bcv_date, "%Y-%m-%d").date()
            # Calculate the expected valid date
            # On weekends, the valid date is Friday or Monday
            if vet_now.weekday() == 5:  # Saturday
                expected_date = vet_now.date() - datetime.timedelta(days=1)
            elif vet_now.weekday() == 6:  # Sunday
                expected_date = vet_now.date() - datetime.timedelta(days=2)
            else:
                expected_date = vet_now.date()
                
            if rate_date < expected_date:
                is_outdated = True
            elif rate_date == vet_now.date() and vet_now.weekday() < 5 and vet_now.hour >= 16:
                # On weekdays after 16:00, we expect tomorrow's rate to be published
                is_outdated = True
        except Exception:
            pass

    return {
        "mutual_name": "Mutual Familiar",
        "currency": "USD",
        "local_currency": "VES",
        "bcv_rate": bcv_rate,
        "bcv_date": bcv_date,
        "is_bcv_outdated": is_outdated,
        "features": {
            "loans_enabled": True,
            "funds_enabled": True
        }
    }

@router.get("/latest-apk")
def redirect_to_latest_apk():
    """Redirige automáticamente al usuario al enlace de descarga de la última versión del APK en GitHub"""
    fallback_url = "https://github.com/jorgerojasve/mutualfam/releases"
    try:
        # Consultamos la API pública de GitHub para obtener el release más reciente
        req = urllib.request.Request(
            "https://api.github.com/repos/jorgerojasve/mutualfam/releases/latest",
            headers={'User-Agent': 'MutualFam-Backend'}
        )
        with urllib.request.urlopen(req, timeout=5.0) as response:
            data = json.loads(response.read().decode())
            
            # Buscamos en los assets el primer archivo que termine en .apk
            for asset in data.get("assets", []):
                if asset.get("name", "").endswith(".apk"):
                    return RedirectResponse(url=asset["browser_download_url"], status_code=302)
                    
            # Si no hay assets o no hay apk, volvemos al fallback
            return RedirectResponse(url=fallback_url, status_code=302)
    except Exception as e:
        print(f"Error fetching latest release from github: {e}")
        return RedirectResponse(url=fallback_url, status_code=302)
