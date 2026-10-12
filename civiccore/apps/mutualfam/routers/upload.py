from fastapi import APIRouter, UploadFile, File
import shutil
import os
import uuid

router = APIRouter()

UPLOADS_DIR = os.getenv("UPLOADS_DIR", "/app/data/uploads" if os.path.exists("/app/data") else "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/uploads/{filename}"}
