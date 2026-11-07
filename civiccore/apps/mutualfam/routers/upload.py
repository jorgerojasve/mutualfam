from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import shutil
import os
import uuid
import json
from services.telegram_bot import send_telegram_photo, download_telegram_file

router = APIRouter()

UPLOADS_DIR = os.getenv("UPLOADS_DIR", "/app/data/uploads" if os.path.exists("/app/data") else "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

MAP_FILE = os.path.join(UPLOADS_DIR, "uploads_telegram_map.json")

def _save_telegram_mapping(filename: str, file_id: str):
    try:
        mapping = {}
        if os.path.exists(MAP_FILE):
            try:
                with open(MAP_FILE, "r") as f:
                    mapping = json.load(f)
            except Exception:
                mapping = {}
        mapping[filename] = file_id
        with open(MAP_FILE, "w") as f:
            json.dump(mapping, f)
    except Exception as e:
        print(f"Error guardando mapeo telegram: {e}")

def _get_telegram_file_id(filename: str):
    try:
        if os.path.exists(MAP_FILE):
            with open(MAP_FILE, "r") as f:
                mapping = json.load(f)
                return mapping.get(filename)
    except Exception:
        pass
    return None

def get_or_restore_file(filename: str) -> str:
    """
    Retorna la ruta física del archivo. Si no existe en disco,
    intenta descargarlo y recuperarlo desde Telegram mediante su file_id.
    """
    filepath = os.path.join(UPLOADS_DIR, filename)
    if os.path.exists(filepath):
        return filepath
    
    file_id = _get_telegram_file_id(filename)
    if file_id:
        if download_telegram_file(file_id, filepath):
            return filepath
    return None

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Respaldo automático en Telegram
    telegram_file_id = None
    try:
        res = send_telegram_photo(f"📎 Comprobante/Imagen: {filename}", filepath)
        if isinstance(res, str):
            telegram_file_id = res
            _save_telegram_mapping(filename, telegram_file_id)
    except Exception as e:
        print(f"Advertencia: no se pudo respaldar imagen en Telegram: {e}")

    url_path = f"/uploads/{filename}"
    return {
        "url": url_path,
        "file_url": url_path,
        "telegram_file_id": telegram_file_id
    }

@router.get("/get/{filename}")
def retrieve_file(filename: str):
    path = get_or_restore_file(filename)
    if path and os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="Archivo no encontrado")
