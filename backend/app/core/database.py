"""
MutualSol - Conexión a la base de datos PostgreSQL
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,          # Verifica la conexión antes de usarla
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency de FastAPI para obtener sesión de BD."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
