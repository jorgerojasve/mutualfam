"""
MutualFam - Servicio Multi-Tasa de Cambio (Venezuela)
Maneja tasas oficiales (BCV), paralelo, USDT (Binance/Cripto), Euro y Fija,
con cache en memoria y valores de respaldo ante contingencias.
"""
import json
import logging
import time
import urllib.request
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Cache en memoria: { key: { "rate": float, "updated_at": float } }
_RATES_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutos

# Tasas de respaldo si las APIs externas no están disponibles (ej. pruebas offline)
FALLBACK_RATES = {
    "bcv": 36.80,
    "paralelo": 44.50,
    "usdt": 44.00,
    "euro": 40.20,
}

LABELS = {
    "bcv": "Oficial BCV (USD)",
    "usdt": "USDT / Binance P2P",
    "euro": "Euro Oficial BCV",
    "fija": "Tasa Fija Acordada",
}


def _fetch_json(url: str, timeout: int = 6) -> Optional[dict]:
    """Descarga JSON de forma segura usando la librería estándar urllib."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "MutualFam/1.0 (Mobile App; MultiRateService)",
                "Accept": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        logger.debug(f"[TasaCambio] Error al consultar {url}: {e}")
    return None


def get_rate(tipo: str, tasa_fija_valor: Optional[float] = None) -> float:
    """
    Obtiene el valor numérico de la tasa solicitada.
    Tipos soportados: 'bcv', 'usdt', 'euro', 'paralelo', 'fija'.
    """
    tipo_norm = str(tipo).lower().strip()
    if tipo_norm.endswith(".fija") or tipo_norm == "fija":
        if tasa_fija_valor is not None and tasa_fija_valor > 0:
            return float(tasa_fija_valor)
        return FALLBACK_RATES["bcv"]

    # Quitar posibles prefijos de enum (ej. TipoTasaColecta.BCV -> bcv)
    if "." in tipo_norm:
        tipo_norm = tipo_norm.split(".")[-1]

    now = time.time()
    cached = _RATES_CACHE.get(tipo_norm)
    if cached and (now - cached["updated_at"] < CACHE_TTL_SECONDS):
        return cached["rate"]

    rate = None

    if tipo_norm == "bcv":
        # 1. DolarAPI Oficial
        data = _fetch_json("https://ve.dolarapi.com/v1/dolares/oficial")
        if data and isinstance(data, dict):
            rate = float(data.get("promedio") or data.get("ventaBcv") or data.get("precio", 0))

    elif tipo_norm in ("usdt", "paralelo"):
        # Primero intentamos USDT/Binance vía PyDolar o DolarAPI paralelo
        data = _fetch_json("https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=binance")
        if data and isinstance(data, dict):
            monitors = data.get("monitors", {})
            binance_data = monitors.get("binance", {})
            if binance_data and "price" in binance_data:
                rate = float(binance_data["price"])

        if not rate or rate <= 0:
            # Fallback a paralelo si Binance API no responde
            data_paralelo = _fetch_json("https://ve.dolarapi.com/v1/dolares/paralelo")
            if data_paralelo and isinstance(data_paralelo, dict):
                rate = float(data_paralelo.get("promedio") or data_paralelo.get("precio", 0))

    elif tipo_norm == "euro":
        # DolarAPI Euro Oficial
        data = _fetch_json("https://ve.dolarapi.com/v1/euros/oficial")
        if data and isinstance(data, dict):
            rate = float(data.get("promedio") or data.get("precio", 0))

    if rate and rate > 0:
        _RATES_CACHE[tipo_norm] = {"rate": rate, "updated_at": now}
        logger.info(f"[TasaCambio] Tasa actualizada {tipo_norm}: {rate} VES")
        return rate

    # Si falló la consulta pero tenemos un valor en cache previo (aunque expirado)
    if cached and cached.get("rate"):
        return cached["rate"]

    # Fallback predeterminado
    fallback = FALLBACK_RATES.get(tipo_norm, FALLBACK_RATES["bcv"])
    logger.warning(f"[TasaCambio] Usando fallback para {tipo_norm}: {fallback} VES")
    return fallback


def get_all_rates(tasa_fija_valor: Optional[float] = None) -> Dict[str, Any]:
    """
    Retorna un diccionario con todas las tasas vigentes y sus etiquetas.
    Útil para el selector de tasas en la app móvil.
    """
    result = {}
    for key, label in LABELS.items():
        if key == "fija":
            val = float(tasa_fija_valor) if (tasa_fija_valor and tasa_fija_valor > 0) else None
        else:
            val = get_rate(key)
        result[key] = {
            "key": key,
            "label": label,
            "rate": val,
            "currency": "VES"
        }
    return result


def calculate_ves_amount(amount_usd: float, tipo: str, tasa_fija_valor: Optional[float] = None) -> Dict[str, Any]:
    """
    Calcula el monto equivalente en Bolívares para un monto en USD.
    """
    rate = get_rate(tipo, tasa_fija_valor)
    amount_ves = round(amount_usd * rate, 2)
    return {
        "amount_usd": float(amount_usd),
        "rate": rate,
        "rate_type": tipo,
        "amount_ves": amount_ves,
        "formatted_ves": f"Bs {amount_ves:,.2f}"
    }
