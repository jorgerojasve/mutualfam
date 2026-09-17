"""
DB Manager Router for Testing/Sandbox Environment
"""
import os
import shutil
from datetime import datetime
from fastapi import APIRouter, HTTPException
from ..core.config import settings

router = APIRouter()

# The database file is assumed to be in the project root if sqlite:///./civiccore.db
db_path = settings.database_url.replace("sqlite:///", "")
backup_dir = os.path.join(os.path.dirname(db_path), "backups")

@router.get("/list")
def list_backups():
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
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
        os.makedirs(backup_dir)
        
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found to backup.")
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"{name_prefix}_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_name)
    
    try:
        shutil.copy2(db_path, backup_path)
        return {"status": "success", "backup_name": backup_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore/{filename}")
def restore_backup(filename: str):
    backup_path = os.path.join(backup_dir, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup file not found.")
        
    try:
        # We perform a direct file copy. In SQLite this might cause temporary issues 
        # for active connections if not careful, but for a dev tool it's usually fine.
        shutil.copy2(backup_path, db_path)
        return {"status": "success", "message": f"Restored {filename}. You may need to restart the server if you encounter locked database errors."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
