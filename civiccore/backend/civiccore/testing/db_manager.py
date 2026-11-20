"""
DB Manager Router for Testing/Sandbox Environment
"""
import os
import sqlite3
from datetime import datetime
from fastapi import APIRouter, HTTPException
from ..core.config import settings
from ..core.database import engine

router = APIRouter()

def _get_sqlite_db_path() -> str:
    url = settings.database_url
    if url.startswith("sqlite:////"):
        return "/" + url[len("sqlite:////"):]
    elif url.startswith("sqlite:///"):
        return url[len("sqlite:///"):]
    return url

db_path = _get_sqlite_db_path()
backup_dir = os.path.join(os.path.dirname(db_path), "backups")

@router.get("/list")
def list_backups():
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir, exist_ok=True)
    
    backups = []
    for f in os.listdir(backup_dir):
        if f.endswith(".db") or f.endswith(".sqlite"):
            filepath = os.path.join(backup_dir, f)
            stat = os.stat(filepath)
            backups.append({
                "name": f,
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
    # Sort by created_at desc
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return {"status": "success", "backups": backups}

@router.post("/backup")
def create_backup(name_prefix: str = "manual"):
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir, exist_ok=True)
        
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found to backup.")
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"{name_prefix}_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_name)
    
    try:
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(backup_path)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()
        return {"status": "success", "backup_name": backup_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore/{filename}")
def restore_backup(filename: str):
    backup_path = os.path.join(backup_dir, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup file not found.")
        
    try:
        engine.dispose()
        src = sqlite3.connect(backup_path)
        dst = sqlite3.connect(db_path)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()
        return {"status": "success", "message": f"Restored {filename} atomically using SQLite backup API."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset")
def reset_database():
    """Vacía completamente todas las tablas de la base de datos SQLite."""
    try:
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys = OFF;")
            tables = [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';").fetchall()]
            for table in tables:
                cursor.execute(f"DELETE FROM {table};")
            try:
                cursor.execute("DELETE FROM sqlite_sequence;")
            except Exception:
                pass
            cursor.execute("PRAGMA foreign_keys = ON;")
            conn.commit()
            cursor.execute("VACUUM;")
            conn.close()
            return {"status": "success", "message": "Base de datos reseteada a 0", "tables_cleared": tables}
        else:
            return {"status": "success", "message": "Archivo de base de datos no encontrado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
