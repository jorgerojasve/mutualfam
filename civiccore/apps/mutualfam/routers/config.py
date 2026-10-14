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
import os
import time
import logging

logger = logging.getLogger(__name__)

_github_releases_cache = {
    "timestamp": 0,
    "releases": []
}

def is_qa_environment() -> bool:
    """Detecta si el backend está ejecutándose en el entorno de QA/Sandbox."""
    if os.getenv("CIVICCORE_ENV") == "sandbox":
        return True
    fly_app = os.getenv("FLY_APP_NAME", "")
    if "qa" in fly_app.lower():
        return True
    backend_url = os.getenv("BACKEND_PUBLIC_URL", "")
    if "qa" in backend_url.lower():
        return True
    return False

def fetch_github_releases():
    """Obtiene el listado reciente de releases desde GitHub con cache de 5 minutos."""
    now = time.time()
    if _github_releases_cache["releases"] and (now - _github_releases_cache["timestamp"] < 300):
        return _github_releases_cache["releases"]

    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/jorgerojasve/mutualfam/releases?per_page=10",
            headers={'User-Agent': 'MutualFam-Backend'}
        )
        with urllib.request.urlopen(req, timeout=5.0) as response:
            releases = json.loads(response.read().decode())
            if isinstance(releases, list):
                _github_releases_cache["releases"] = releases
                _github_releases_cache["timestamp"] = now
                return releases
    except Exception as e:
        logger.warning(f"No se pudo consultar GitHub Releases: {e}")
        if _github_releases_cache["releases"]:
            return _github_releases_cache["releases"]

    return []

def get_target_release_and_apk(is_qa: bool = None):
    """
    Encuentra el release y el asset APK correspondiente según el entorno (QA o Producción).
    """
    if is_qa is None:
        is_qa = is_qa_environment()

    releases = fetch_github_releases()
    for rel in releases:
        tag = rel.get("tag_name", "").lower()
        assets = rel.get("assets", [])
        if is_qa:
            # En QA buscamos releases con tag -qa o que contengan un APK de QA
            if "-qa" in tag or any(a.get("name", "").startswith("mutualfam-qa") for a in assets):
                # Priorizar asset con prefijo mutualfam-qa que termine en .apk
                for a in assets:
                    if a.get("name", "").startswith("mutualfam-qa") and a.get("name", "").endswith(".apk"):
                        return rel, a
                for a in assets:
                    if a.get("name", "").endswith(".apk"):
                        return rel, a
        else:
            # En Producción aseguramos que ni el tag ni el asset contengan -qa
            if "-qa" not in tag:
                for a in assets:
                    name = a.get("name", "")
                    if name.endswith(".apk") and "-qa" not in name:
                        return rel, a
    return None, None

def get_latest_release_info():
    """
    Obtiene la última versión disponible de la app para el entorno actual.
    Retorna latest_version, min_version, download_url y release_notes.
    """
    is_qa = is_qa_environment()
    default_base = "https://mutualfam-qa-backend.fly.dev/api/v1" if is_qa else "https://mutualfam-backend.fly.dev/api/v1"
    backend_base = os.getenv("BACKEND_PUBLIC_URL", default_base)
    download_url = f"{backend_base}/config/latest-apk"

    info = {
        "latest_version": os.getenv("LATEST_APP_VERSION", "1.0.15"),
        "min_version": os.getenv("MIN_APP_VERSION", "1.0.0"),
        "download_url": download_url,
        "release_notes": "Mejoras de rendimiento, estabilidad y nuevas funciones."
    }

    rel, _ = get_target_release_and_apk(is_qa)
    if rel:
        tag_name = rel.get("tag_name", "").lstrip("v")
        if tag_name:
            info["latest_version"] = tag_name
        if rel.get("body"):
            info["release_notes"] = rel.get("body").strip()

    return info

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
        },
        "app_version": get_latest_release_info()
    }

@router.get("/version")
def get_app_version():
    """Retorna información sobre la última versión de la app y requerimiento mínimo"""
    return get_latest_release_info()

@router.api_route("/latest-apk", methods=["GET", "HEAD"])
def redirect_to_latest_apk():
    """Redirige automáticamente al usuario al enlace de descarga de la última versión del APK en GitHub según el entorno"""
    fallback_url = "https://github.com/jorgerojasve/mutualfam/releases"
    try:
        is_qa = is_qa_environment()
        _, asset = get_target_release_and_apk(is_qa)
        if asset and asset.get("browser_download_url"):
            return RedirectResponse(url=asset["browser_download_url"], status_code=302)
    except Exception as e:
        logger.error(f"Error resolviendo último APK para redirección: {e}")

    return RedirectResponse(url=fallback_url, status_code=302)

