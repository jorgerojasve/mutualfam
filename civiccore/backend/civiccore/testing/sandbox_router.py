"""
Sandbox Router - Exposes simulation endpoints.
STRICTLY GUARDED. NEVER LOAD IN PRODUCTION.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from .simulator import SimulationEngine

# Critical security guard
if os.getenv("CIVICCORE_ENV") != "sandbox":
    # If someone tries to import this module without the sandbox env, we explode.
    raise RuntimeError("CRITICAL SECURITY ERROR: Attempted to load sandbox_router outside of sandbox environment.")

router = APIRouter()

def _get_sqlite_db_path() -> str:
    from ..core.config import settings
    url = settings.database_url
    if url.startswith("sqlite:////"):
        return "/" + url[len("sqlite:////"):]
    elif url.startswith("sqlite:///"):
        return url[len("sqlite:///"):]
    return url

@router.post("/seed")
def seed_environment(members_count: int = 50, db: Session = Depends(get_db)):
    members = SimulationEngine.seed_synthetic_members(db, members_count)
    return {"status": "success", "seeded_members": len(members)}

@router.post("/clear")
def clear_environment(db: Session = Depends(get_db)):
    SimulationEngine.clear_synthetic_data(db)
    return {"status": "success", "message": "Synthetic data cleared"}

@router.post("/snapshot")
def create_snapshot():
    """Crea un snapshot atómico en caliente de la base de datos de QA previo a las pruebas."""
    import sqlite3
    db_path = _get_sqlite_db_path()
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Archivo de base de datos no encontrado.")
    snap_path = f"{db_path}.pretest_snapshot"
    try:
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(snap_path)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()
        return {"status": "success", "message": "Snapshot capturado exitosamente.", "snapshot_path": snap_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando snapshot: {e}")

@router.post("/restore")
def restore_snapshot():
    """Restituye atómicamente la base de datos al estado previo al snapshot de pruebas."""
    import sqlite3
    from ..core.database import engine
    db_path = _get_sqlite_db_path()
    snap_path = f"{db_path}.pretest_snapshot"
    if not os.path.exists(snap_path):
        raise HTTPException(status_code=404, detail="No se encontró snapshot previo para restituir.")
    try:
        engine.dispose()
        src = sqlite3.connect(snap_path)
        dst = sqlite3.connect(db_path)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()
        return {"status": "success", "message": "Base de datos restituida al estado previo a las pruebas exitosamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error restituyendo snapshot: {e}")

@router.post("/reset-all")
def reset_all_database(db: Session = Depends(get_db)):
    """Limpia completamente todas las tablas de la base de datos de QA/Sandbox para comenzar desde cero."""
    from sqlalchemy import text
    try:
        db.execute(text("PRAGMA foreign_keys = OFF;"))
        tables = [row[0] for row in db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")).fetchall()]
        deleted = []
        for table in tables:
            db.execute(text(f"DELETE FROM {table};"))
            deleted.append(table)
        try:
            db.execute(text("DELETE FROM sqlite_sequence;"))
        except Exception:
            pass
        db.execute(text("PRAGMA foreign_keys = ON;"))
        db.commit()
        return {"status": "success", "message": "Base de datos de QA limpiada completamente.", "tables_cleared": deleted}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error limpiando base de datos: {e}")
