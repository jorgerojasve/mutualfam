"""
CivicCore Application Factory
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .core.config import settings
from .core.database import engine, Base

def create_app(
    include_membership: bool = True,
    include_governance: bool = True,
    include_payments: bool = False,
    include_authorship: bool = False,
    include_config: bool = True,
    include_fusion: bool = True,
    include_fund: bool = False,
    include_media: bool = True
) -> FastAPI:
    """
    Creates and configures a FastAPI instance with the selected CivicCore modules.
    """
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # In a real setup, we would use Alembic. 
        # For this base implementation we just create all.
        Base.metadata.create_all(bind=engine)
        yield
        
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="CivicCore Framework API",
        lifespan=lifespan,
    )
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Core Auth routes
    from .core.router import router as auth_router
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
    # Optional modules
    if include_membership:
        from .modules.membership.router import router as membership_router
        app.include_router(membership_router, prefix="/api/v1/membership", tags=["Membership"])
        
    if include_governance:
        from .modules.governance.router import router as governance_router
        app.include_router(governance_router, prefix="/api/v1/governance", tags=["Governance"])
        
    if include_payments:
        from .modules.payments.router import router as payments_router
        app.include_router(payments_router, prefix="/api/v1/payments", tags=["Payments"])
        
    if include_authorship:
        from .modules.authorship.router import router as authorship_router
        app.include_router(authorship_router, prefix="/api/v1/authorship", tags=["Authorship"])
        
    if include_config:
        from .modules.config.router import router as config_router
        app.include_router(config_router, prefix="/api/v1/config", tags=["System Config"])
        
    if include_fusion:
        from .modules.fusion.router import router as fusion_router
        app.include_router(fusion_router, prefix="/api/v1/fusion", tags=["Fusion"])
        
    if include_fund:
        from .modules.fund.router import router as fund_router
        app.include_router(fund_router, prefix="/api/v1/fund", tags=["Fund"])
        
    if include_media:
        from .modules.media.router import router as media_router
        app.include_router(media_router, prefix="/api/v1/media", tags=["Media"])
        
    import os
    if os.getenv("CIVICCORE_ENV") == "sandbox" or True: # Force enable for testing phase
        from .testing.sandbox_router import router as sandbox_router
        from .testing.db_manager import router as db_manager_router
        app.include_router(sandbox_router, prefix="/api/v1/sandbox", tags=["Sandbox"])
        app.include_router(db_manager_router, prefix="/api/v1/sandbox/db-manager", tags=["DB Manager"])
        
    @app.get("/health", tags=["Health"])
    def health_check():
        return {"status": "ok", "framework": "CivicCore"}
        
    return app
