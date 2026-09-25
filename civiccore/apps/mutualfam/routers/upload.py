from fastapi import APIRouter, UploadFile, File
import shutil
import os
import uuid

router = APIRouter()

os.makedirs("uploads", exist_ok=True)

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = f"uploads/{filename}"
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/uploads/{filename}"}
