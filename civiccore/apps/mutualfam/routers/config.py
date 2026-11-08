from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse, StreamingResponse
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

# Cache de releases de GitHub (en memoria y persistente en disco)
_github_releases_cache = {
    "timestamp": 0,
    "releases": []
}

def _get_releases_cache_path() -> str:
    if os.path.isdir("/app/data"):
        return "/app/data/github_releases_cache.json"
    local_data = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"))
    if os.path.isdir(local_data):
        return os.path.join(local_data, "github_releases_cache.json")
    return os.path.join(os.path.dirname(__file__), "github_releases_cache.json")

def _load_disk_releases_cache() -> list:
    cache_path = _get_releases_cache_path()
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception as e:
            logger.warning(f"Error leyendo cache de releases en disco: {e}")
    return []

def _save_disk_releases_cache(releases: list):
    cache_path = _get_releases_cache_path()
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(releases, f, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Error guardando cache de releases en disco: {e}")

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
    """Obtiene el listado reciente de releases desde GitHub con cache en memoria y disco."""
    now = time.time()
    if _github_releases_cache["releases"] and (now - _github_releases_cache["timestamp"] < 90):
        return _github_releases_cache["releases"]

    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/jorgerojasve/mutualfam/releases?per_page=10",
            headers={'User-Agent': 'MutualFam-Backend'}
        )
        with urllib.request.urlopen(req, timeout=3.5) as response:
            releases = json.loads(response.read().decode())
            if isinstance(releases, list) and len(releases) > 0:
                _github_releases_cache["releases"] = releases
                _github_releases_cache["timestamp"] = now
                _save_disk_releases_cache(releases)
                return releases
    except Exception as e:
        logger.warning(f"No se pudo consultar GitHub Releases en vivo: {e}")

    # Fallback 1: cache en memoria existente
    if _github_releases_cache["releases"]:
        return _github_releases_cache["releases"]

    # Fallback 2: cache persistido en disco (sobrevive reinicios/suspensiones de Fly.io)
    disk_cache = _load_disk_releases_cache()
    if disk_cache:
        _github_releases_cache["releases"] = disk_cache
        _github_releases_cache["timestamp"] = now
        return disk_cache

    return []

def get_target_release_and_apk(is_qa: bool = None):
    """
    Encuentra el release y el asset APK correspondiente según el entorno (QA o Producción).
    Retorna (rel_con_apk, apk_asset, latest_matching_rel).
    """
    if is_qa is None:
        is_qa = is_qa_environment()

    releases = fetch_github_releases()
    latest_matching_rel = None
    for rel in releases:
        tag = rel.get("tag_name", "").lower()
        if is_qa:
            if "-qa" in tag:
                latest_matching_rel = rel
                break
        else:
            if "-qa" not in tag:
                latest_matching_rel = rel
                break

    for rel in releases:
        tag = rel.get("tag_name", "").lower()
        assets = rel.get("assets", [])
        if is_qa:
            # En QA buscamos releases con tag -qa o que contengan un APK de QA
            if "-qa" in tag or any(a.get("name", "").startswith("mutualfam-qa") for a in assets):
                # Priorizar asset con prefijo mutualfam-qa que termine en .apk
                for a in assets:
                    if a.get("name", "").startswith("mutualfam-qa") and a.get("name", "").endswith(".apk"):
                        return rel, a, latest_matching_rel
                for a in assets:
                    if a.get("name", "").endswith(".apk"):
                        return rel, a, latest_matching_rel
        else:
            # En Producción aseguramos que ni el tag ni el asset contengan -qa
            if "-qa" not in tag:
                for a in assets:
                    name = a.get("name", "")
                    if name.endswith(".apk") and "-qa" not in name:
                        return rel, a, latest_matching_rel
    return None, None, latest_matching_rel

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
        "latest_version": os.getenv("LATEST_APP_VERSION", "1.0.18"),
        "min_version": os.getenv("MIN_APP_VERSION", "1.0.0"),
        "download_url": download_url,
        "release_notes": "Mejoras de rendimiento, estabilidad y nuevas funciones.",
        "is_compiling": False,
        "pending_version": None,
    }

    target_info = get_target_release_and_apk(is_qa)
    rel = target_info[0] if (target_info and len(target_info) > 0) else None
    latest_matching_rel = target_info[2] if (target_info and len(target_info) > 2) else None
    if latest_matching_rel and (not rel or latest_matching_rel.get("tag_name") != rel.get("tag_name")):
        # Hay un tag más nuevo cuyo APK aún se está compilando o subiendo en GitHub Actions
        info["is_compiling"] = True
        info["pending_version"] = latest_matching_rel.get("tag_name", "").lstrip("v")

    if rel:
        tag_name = rel.get("tag_name", "").lstrip("v")
        if tag_name:
            info["latest_version"] = tag_name
        if rel.get("body"):
            info["release_notes"] = rel.get("body").strip()
    elif not info["is_compiling"]:
        info["error"] = "No se pudo obtener información de releases en este momento."

    from services.limits import get_app_phase_summary
    phase_summary = get_app_phase_summary()
    info["is_beta"] = phase_summary["is_beta"]
    info["phase_label"] = phase_summary["phase_label"]
    info["app_phase"] = phase_summary

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

    from services.limits import get_limits_summary, get_app_phase_summary, set_limit_override, reset_limit_overrides

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
        "limits": get_limits_summary(),
        "app_phase": get_app_phase_summary(),
        "app_version": get_latest_release_info(),
        "banks": VENEZUELAN_BANKS,
        "firebase_distribution": {
            "enabled": True,
            "invite_url": os.getenv("FIREBASE_INVITE_URL_QA" if is_qa_environment() else "FIREBASE_INVITE_URL", ""),
            "app_id": "1:833486393039:android:b88cb4bc152b114c04f1ba" if is_qa_environment() else "1:833486393039:android:452c1bd61f9024de04f1ba",
        }
    }

@router.get("/firebase-tester-url")
def get_firebase_tester_url():
    """Retorna el enlace de invitación de Firebase App Distribution para testers."""
    is_qa = is_qa_environment()
    url = os.getenv("FIREBASE_INVITE_URL_QA" if is_qa else "FIREBASE_INVITE_URL", "")
    app_id = "1:833486393039:android:b88cb4bc152b114c04f1ba" if is_qa else "1:833486393039:android:452c1bd61f9024de04f1ba"
    return {
        "url": url,
        "app_id": app_id,
        "has_custom_url": bool(url),
        "app_tester_playstore": "https://play.google.com/store/apps/details?id=com.google.android.apps.internal.betterbug"
    }

class LimitsUpdate(BaseModel):
    max_members_per_mutual: int = None
    extra_mutuals_first_mutual: int = None
    contact_email: str = None
    is_beta: bool = None

class PhaseUpdate(BaseModel):
    is_beta: bool

@router.get("/phase")
def get_phase():
    """Retorna la fase actual de la aplicación (Beta vs Estable) y directivas asociadas."""
    from services.limits import get_app_phase_summary
    return get_app_phase_summary()

@router.post("/phase")
def update_phase_qa(data: PhaseUpdate):
    """Permite conmutar la fase de la aplicación en caliente (exclusivo para QA/Sandbox)."""
    from fastapi import HTTPException
    if not is_qa_environment():
        raise HTTPException(status_code=403, detail="Modificación de fase en caliente solo disponible en entorno QA")
    from services.limits import set_limit_override, get_app_phase_summary
    set_limit_override("is_beta", data.is_beta)
    return {"message": "Fase de la aplicación actualizada para QA", "app_phase": get_app_phase_summary()}

@router.get("/limits")
def get_limits():
    """Retorna los límites vigentes del sistema para miembros y mutuales."""
    from services.limits import get_limits_summary
    return get_limits_summary()

@router.post("/limits")
def update_limits_qa(data: LimitsUpdate):
    """Permite ajustar los límites en tiempo de ejecución (exclusivo para QA/Sandbox)."""
    from fastapi import HTTPException
    if not is_qa_environment():
        raise HTTPException(status_code=403, detail="Modificación de límites en caliente solo disponible en entorno QA")
    from services.limits import set_limit_override, get_limits_summary
    if data.max_members_per_mutual is not None:
        set_limit_override("max_members_per_mutual", data.max_members_per_mutual)
    if data.extra_mutuals_first_mutual is not None:
        set_limit_override("extra_mutuals_first_mutual", data.extra_mutuals_first_mutual)
    if data.contact_email is not None:
        set_limit_override("contact_email", data.contact_email)
    if data.is_beta is not None:
        set_limit_override("is_beta", data.is_beta)
    return {"message": "Límites actualizados para pruebas en QA", "limits": get_limits_summary()}

@router.delete("/limits")
def reset_limits_qa():
    """Restaura los límites a sus valores por defecto / variables de entorno (exclusivo para QA/Sandbox)."""
    from fastapi import HTTPException
    if not is_qa_environment():
        raise HTTPException(status_code=403, detail="Reinicio de límites solo disponible en entorno QA")
    from services.limits import reset_limit_overrides, get_limits_summary
    reset_limit_overrides()
    return {"message": "Límites restaurados a valores por defecto", "limits": get_limits_summary()}


VENEZUELAN_BANKS = [
    {"code": "0102", "name": "Banco de Venezuela"},
    {"code": "0104", "name": "Venezolano de Crédito"},
    {"code": "0105", "name": "Banco Mercantil"},
    {"code": "0108", "name": "BBVA Provincial"},
    {"code": "0114", "name": "Bancaribe"},
    {"code": "0115", "name": "Banco Exterior"},
    {"code": "0128", "name": "Banco Caroní"},
    {"code": "0134", "name": "Banesco"},
    {"code": "0137", "name": "Banco Sofitasa"},
    {"code": "0138", "name": "Banco Plaza"},
    {"code": "0146", "name": "Bangente"},
    {"code": "0151", "name": "BFC Banco Fondo Común"},
    {"code": "0156", "name": "100% Banco"},
    {"code": "0157", "name": "DelSur Banco Universal"},
    {"code": "0163", "name": "Banco del Tesoro"},
    {"code": "0166", "name": "Banco Agrícola de Venezuela"},
    {"code": "0168", "name": "Bancrecer"},
    {"code": "0169", "name": "Mi Banco"},
    {"code": "0171", "name": "Banco Activo"},
    {"code": "0172", "name": "Bancamiga"},
    {"code": "0173", "name": "Banco Internacional de Desarrollo"},
    {"code": "0174", "name": "Banplus"},
    {"code": "0175", "name": "Banco Digital de los Trabajadores (BDT)"},
    {"code": "0177", "name": "BANFANB"},
    {"code": "0178", "name": "N58 Banco Digital"},
    {"code": "0191", "name": "Banco Nacional de Crédito (BNC)"},
    {"code": "0601", "name": "Instituto Municipal de Crédito Popular (IMCP)"},
]

@router.get("/banks")
def get_banks():
    """Retorna la lista oficial de bancos en Venezuela con sus códigos SUDEBAN/BCV para Pago Móvil"""
    return VENEZUELAN_BANKS

@router.get("/version")
def get_app_version():
    """Retorna información sobre la última versión de la app y requerimiento mínimo"""
    return get_latest_release_info()

def stream_apk_download(download_url: str):
    """Generador que transmite el APK por chunks desde GitHub/S3 para evitar redirecciones cross-origin en el cliente."""
    req = urllib.request.Request(
        download_url,
        headers={"User-Agent": "MutualFam-Backend"}
    )
    with urllib.request.urlopen(req, timeout=30.0) as resp:
        while True:
            chunk = resp.read(64 * 1024)
            if not chunk:
                break
            yield chunk

@router.api_route("/latest-apk", methods=["GET", "HEAD"])
@router.api_route("/latest-apk/", methods=["GET", "HEAD"])
def download_latest_apk(request: Request, redirect: bool = False):
    """
    Entrega el último APK del entorno correspondiente.
    Por defecto transmite directamente el archivo (StreamingResponse) con cabeceras MIME
    específicas de Android y Content-Disposition para evitar que Chrome Safe Browsing
    se quede colgado esperando por redirecciones a dominios externos no verificados.
    Permite ?redirect=true como opción alternativa o de depuración.
    """
    fallback_url = "https://github.com/jorgerojasve/mutualfam/releases"
    try:
        is_qa = is_qa_environment()
        target_info = get_target_release_and_apk(is_qa)
        asset = target_info[1] if (target_info and len(target_info) > 1) else None
        if asset and asset.get("browser_download_url"):
            target_url = asset["browser_download_url"]
            if redirect:
                return RedirectResponse(url=target_url, status_code=302)

            filename = asset.get("name") or "mutualfam.apk"
            size = asset.get("size")

            headers = {
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "application/vnd.android.package-archive",
                "Cache-Control": "public, max-age=300",
            }
            if size:
                headers["Content-Length"] = str(size)

            if request.method == "HEAD":
                return Response(status_code=200, headers=headers, media_type="application/vnd.android.package-archive")

            return StreamingResponse(
                stream_apk_download(target_url),
                media_type="application/vnd.android.package-archive",
                headers=headers
            )
    except Exception as e:
        logger.error(f"Error sirviendo último APK para descarga directa: {e}")

    return RedirectResponse(url=fallback_url, status_code=302)


