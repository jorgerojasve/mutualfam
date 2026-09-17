from fastapi.middleware.cors import CORSMiddleware
from civiccore.factory import create_app
from civiccore.core.database import Base, engine, SessionLocal
import uvicorn
from contextlib import asynccontextmanager
from civiccore.core.config import settings

from manifest import MANIFEST
settings.manifest = MANIFEST

# Domain-specific startup to populate some dummy data
@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Pre-populate member if empty
    from civiccore.modules.membership.models import Member, MemberStatus
    if db.query(Member).count() == 0:
        founder = Member(
            identifier="DOC-001",
            email="founder@svmm.org.ve",
            hashed_password="mockhash",
            first_name="Dr. Jacinto",
            last_name="Convit",
            status=MemberStatus.ACTIVE,
            role="admin",
            extra_fields={"department": "Microscopía Electrónica"}
        )
        db.add(founder)
        
        # Add some mock resolutions (authorship)
        from civiccore.modules.authorship.models import Document
        doc = Document(
            title="Resolución 2026-001: Cuota Anual 2026",
            document_type="resolution",
            content_hash="abc123hash"
        )
        db.add(doc)
        
        # Add some mock proposals (governance)
        from civiccore.modules.governance.models import Proposal, ProposalStatus
        from datetime import datetime, timezone, timedelta
        prop = Proposal(
            author_id=1,
            title="Elecciones de Junta Directiva 2026-2028",
            content="Apertura de proceso de elecciones para la nueva directiva de la SVMM.",
            status=ProposalStatus.VOTING,
            voting_ends_at=datetime.now(timezone.utc) + timedelta(days=15)
        )
        db.add(prop)
        
        # Seed SVMM Terminology
        from civiccore.modules.config.models import SystemConfig
        db.add(SystemConfig(key="TERM_GOVERNANCE", value="Asamblea"))
        db.add(SystemConfig(key="TERM_TRANSPARENCY", value="Transparencia"))
        db.add(SystemConfig(key="TERM_MEMBERS", value="Investigadores"))
        
        db.commit()
    db.close()
    yield

app = create_app(
    include_membership=True,
    include_governance=True,
    include_payments=True,
    include_authorship=True
)

app.router.lifespan_context = lifespan

# Enable CORS for React Native Web / Expo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/society/stats", tags=["Scientific Society"])
def get_society_stats():
    return {
        "active_researchers": 120,
        "published_papers": 45,
        "ongoing_proposals": 2
    }

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
