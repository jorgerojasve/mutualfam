"""
MutualSol - Punto de entrada FastAPI
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.core.database import engine
from app.models.models import Base
from app.api import socios, auth, creditos, transacciones, mercado, tasas


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crear tablas al iniciar (en producción usar Alembic)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API de la Mutual Solidaria de Crédito - Open Source",
    lifespan=lifespan,
)

# CORS (para la app Android y PWA)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas
app.include_router(auth.router,          prefix="/api/v1/auth",         tags=["Autenticación"])
app.include_router(socios.router,        prefix="/api/v1/socios",       tags=["Socios"])
app.include_router(creditos.router,      prefix="/api/v1/creditos",     tags=["Créditos"])
app.include_router(transacciones.router, prefix="/api/v1/transacciones",tags=["Transacciones"])
app.include_router(mercado.router,       prefix="/api/v1/mercado",      tags=["Mercado Solidario"])
app.include_router(tasas.router,         prefix="/api/v1/tasas",        tags=["Tasas de Cambio"])


@app.get("/", tags=["Estado"])
async def raiz():
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "mensaje": "¡La mutual está en línea! 🤝",
        "docs": "/docs",
    }


@app.get("/health", tags=["Estado"])
async def health():
    return {"status": "ok"}
