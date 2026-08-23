"""
MutualSol - Servicio de Tasa de Cambio BCV
Consulta la tasa USD/VES de múltiples fuentes y la cachea en la BD.
"""
import httpx
import logging
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.models import TasaCambio

logger = logging.getLogger(__name__)

# Tasa de respaldo (por si todas las fuentes fallan)
TASA_FALLBACK = 40.0  # Se actualiza manualmente si es necesario


async def obtener_tasa_dolarapi() -> float | None:
    """
    Fuente primaria: ve.dolarapi.com - API comunitaria venezolana, muy confiable.
    Devuelve la tasa BCV oficial (USD a Bs).
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://ve.dolarapi.com/v1/dolares/oficial")
            resp.raise_for_status()
            data = resp.json()
            # La API devuelve {"nombre":"Oficial","fuente":"BCV","promedio": X, ...}
            tasa = float(data.get("promedio") or data.get("ventaBcv", 0))
            if tasa > 0:
                logger.info(f"Tasa BCV obtenida de dolarapi.com: {tasa}")
                return tasa
    except Exception as e:
        logger.warning(f"dolarapi.com no disponible: {e}")
    return None


async def obtener_tasa_bcv_scraping() -> float | None:
    """
    Fuente secundaria: Scraping directo de bcv.org.ve
    """
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; MutualSol/1.0)"}
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            resp = await client.get("https://www.bcv.org.ve")
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            # El sitio del BCV tiene el tipo de cambio en un elemento con id "dolar"
            dolar_div = soup.find("div", {"id": "dolar"})
            if dolar_div:
                strong = dolar_div.find("strong")
                if strong:
                    tasa_str = strong.text.strip().replace(",", ".")
                    tasa = float(tasa_str)
                    logger.info(f"Tasa BCV obtenida por scraping: {tasa}")
                    return tasa
    except Exception as e:
        logger.warning(f"Scraping BCV no disponible: {e}")
    return None


async def actualizar_tasa(db: Session) -> TasaCambio:
    """
    Intenta obtener la tasa de cambio en orden de prioridad.
    Guarda en BD y marca la anterior como no vigente.
    """
    tasa_valor = await obtener_tasa_dolarapi()
    fuente = "dolarapi"

    if not tasa_valor:
        tasa_valor = await obtener_tasa_bcv_scraping()
        fuente = "bcv_scraping"

    if not tasa_valor:
        logger.error("No se pudo obtener la tasa. Usando fallback.")
        tasa_valor = TASA_FALLBACK
        fuente = "fallback"

    # Marcar la tasa anterior como no vigente
    db.query(TasaCambio).filter(TasaCambio.es_vigente == True).update(
        {"es_vigente": False}
    )

    nueva_tasa = TasaCambio(
        fuente=fuente,
        tasa_bs_por_usd=tasa_valor,
        fecha=datetime.now(timezone.utc),
        es_vigente=True,
    )
    db.add(nueva_tasa)
    db.commit()
    db.refresh(nueva_tasa)
    return nueva_tasa


def obtener_tasa_vigente(db: Session) -> float:
    """
    Retorna la tasa BCV vigente desde la BD.
    Si no hay ninguna, retorna el fallback.
    """
    tasa = db.query(TasaCambio).filter(
        TasaCambio.es_vigente == True
    ).order_by(TasaCambio.fecha.desc()).first()

    return tasa.tasa_bs_por_usd if tasa else TASA_FALLBACK


def bs_a_usd(monto_bs: float, tasa: float) -> float:
    """Convierte bolívares a USD usando la tasa dada."""
    if tasa <= 0:
        raise ValueError("Tasa de cambio inválida")
    return round(monto_bs / tasa, 8)


def usd_a_bs(monto_usd: float, tasa: float) -> float:
    """Convierte USD a bolívares usando la tasa dada."""
    return round(monto_usd * tasa, 2)
