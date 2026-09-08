from fastapi.middleware.cors import CORSMiddleware
from civiccore.factory import create_app
from civiccore.core.database import Base, engine, SessionLocal
import uvicorn
from contextlib import asynccontextmanager

# Import mutual-specific routers
from api import mercado, tasas

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    # We can add mock seed data for MutualSol here if needed
    yield

app = create_app(
    include_membership=True,
    include_governance=False,  # We don't need Governance for MutualSol base
    include_payments=True,     # Payments now includes Credits and Transactions
    include_authorship=False
)

app.router.lifespan_context = lifespan

# Mount custom MutualSol routers
app.include_router(mercado.router, prefix="/api/v1/mercado", tags=["Mercado Solidario (MutualSol)"])
app.include_router(tasas.router, prefix="/api/v1/tasas", tags=["Tasas de Cambio (MutualSol)"])

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
