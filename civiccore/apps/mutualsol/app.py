from fastapi.middleware.cors import CORSMiddleware
from civiccore.factory import create_app
from civiccore.core.database import Base, engine, SessionLocal
import uvicorn
from contextlib import asynccontextmanager
from civiccore.core.config import settings

from manifest import MANIFEST
settings.manifest = MANIFEST

# Import mutual-specific routers
from api import mercado, tasas

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    
    # Seed Terminology config for MutualSol
    db = SessionLocal()
    try:
        from civiccore.modules.config.models import SystemConfig
        terms = {
            "TERM_GOVERNANCE": "Asamblea",
            "TERM_TRANSPARENCY": "Transparencia",
            # Salida voluntaria
            "SALIDA_MEMBRESIA_MINIMA_DIAS": "15",
            "SALIDA_PERIODO_ESPERA_DIAS": "90",
            "SALIDA_REINTEGRO_APORTE": "ninguno",
            "SALIDA_BLOQUEADA_POR_MORA": "true",
            "SALIDA_BLOQUEADA_POR_CREDITO_ACTIVO": "true",
            "FONDOS_INDIVIDUALIZADOS": "false",
            "SALIDA_ANULA_VOTOS_ACTIVOS": "true",
            # Mora
            "MORA_PERIODOS_PARA_SUSPENSION": "2",
            "MORA_PERIODOS_PARA_BAJA": "4",
            "MORA_PLAZO_REGULARIZACION_DIAS": "15",
            # Expulsión
            "EXPULSION_FIRMANTES_MINIMOS": "5",
            "EXPULSION_UMBRAL_APROBACION": "0.75",
            "EXPULSION_PERIODO_DEBATE_DIAS": "14",
            "EXPULSION_PERIODO_APELACION_DIAS": "30",
            # División
            "DIVISION_FIRMANTES_MINIMOS_PCT": "0.20",
            "DIVISION_UMBRAL_APROBACION": "0.75",
            "DIVISION_PERIODO_DEBATE_DIAS": "21",
            "DIVISION_PERIODO_TRANSICION_DIAS": "60",
            "DIVISION_DISTRIBUCION_FONDOS": "proporcional_miembros",
            # Fusión
            "FUSION_UMBRAL_APROBACION": "0.66",
            "FUSION_PERIODO_INTEGRACION_DIAS": "90",
            
            # Junta Directiva
            "ENABLE_BOARD": "true",
            "BOARD_TERM_YEARS": "2",
            "BOARD_REELECTION_ALLOWED": "true",
            "BOARD_MAX_REELECTIONS": "1",
            "BOARD_SPENDING_LIMIT_USD": "500",
            "BOARD_VOTE_NOMINAL": "true",
            "BOARD_POSITIONS": '["Presidente","Secretario","Tesorero","Vocal 1","Vocal 2"]',
            
            # Delegados
            "ENABLE_DELEGATES": "true",
            "DELEGATE_MODE": "liquid",
            "DELEGATE_TERM_MONTHS": "12",
            "DELEGATE_RECALL_THRESHOLD": "0.25",
            "ALLOW_LIQUID_DELEGATION_OVERRIDE": "true",
            
            # Comités
            "ENABLE_COMMITTEES": "true",
            "COMMITTEE_RATIFICATION": "simple_majority"
        }
        for k, v in terms.items():
            if not db.query(SystemConfig).filter_by(key=k).first():
                db.add(SystemConfig(key=k, value=v, description="Terminología de la UI"))
        db.commit()
    finally:
        db.close()
        
    yield

from fastapi import Request
from fastapi.responses import JSONResponse
import time
from collections import defaultdict

# Rate Limiting configuration
RATE_LIMIT_DB = defaultdict(list)
RATE_LIMIT = 100 # requests per window
RATE_WINDOW = 60 # seconds

app = create_app(
    include_membership=True,
    include_governance=True,
    include_payments=True,
    include_authorship=False,
    include_fund=True
)

@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    # 1. Rate Limiting (DDoS & Brute Force protection)
    if request.method != "OPTIONS":
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        RATE_LIMIT_DB[ip] = [t for t in RATE_LIMIT_DB[ip] if now - t < RATE_WINDOW]
        if len(RATE_LIMIT_DB[ip]) >= RATE_LIMIT:
            return JSONResponse(
                status_code=429, 
                content={"detail": "Too Many Requests - Rate limit exceeded"}
            )
        RATE_LIMIT_DB[ip].append(now)

    # 2. Process request
    response = await call_next(request)

    # 3. Security Headers (Helmet-like)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    
    return response

app.router.lifespan_context = lifespan

app.include_router(mercado.router, prefix="/api/v1/mercado", tags=["Mercado Solidario (MutualSol)"])
app.include_router(tasas.router, prefix="/api/v1/tasas", tags=["Tasas de Cambio (MutualSol)"])

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
