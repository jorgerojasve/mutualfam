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
    include_authorship: bool = False
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
        
    @app.get("/health", tags=["Health"])
    def health_check():
        return {"status": "ok", "framework": "CivicCore"}
        
    return app
