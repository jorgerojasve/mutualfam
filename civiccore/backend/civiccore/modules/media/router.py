from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx

from ...core.database import get_db
from ...core.config import settings
from ...modules.membership.router import get_current_user
from ...modules.membership.models import Member

router = APIRouter()

async def get_telegram_client():
    async with httpx.AsyncClient() as client:
        yield client

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    current_user: Member = Depends(get_current_user),
    client: httpx.AsyncClient = Depends(get_telegram_client)
):
    try:
        if not settings.telegram_bot_token or not settings.telegram_storage_chat_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                detail="Telegram integration is not configured."
            )

        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB.")

        content_type = file.content_type or "application/octet-stream"

        if content_type.startswith('image/'):
            url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendPhoto"
            files = {'photo': (file.filename, content, content_type)}
        elif content_type.startswith('video/'):
            url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendVideo"
            files = {'video': (file.filename, content, content_type)}
        else:
            url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendDocument"
            files = {'document': (file.filename, content, content_type)}

        data = {'chat_id': settings.telegram_storage_chat_id}

        print(f"Uploading to Telegram: {url} with chat_id {data['chat_id']}")
        response = await client.post(url, data=data, files=files, timeout=60.0)
        print(f"Telegram Response: {response.status_code} {response.text}")
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Telegram API Error: {response.text}")

        result = response.json().get('result', {})
        
        file_id = None
        if 'photo' in result:
            file_id = result['photo'][-1]['file_id']
        elif 'video' in result:
            file_id = result['video']['file_id']
        elif 'document' in result:
            file_id = result['document']['file_id']
        else:
            raise HTTPException(status_code=500, detail="Could not extract file_id from Telegram response")

        return {"file_id": file_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}")
async def get_media(file_id: str, client: httpx.AsyncClient = Depends(get_telegram_client)):
    if not settings.telegram_bot_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Telegram integration is not configured."
        )

    # 1. Get file path from Telegram
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/getFile?file_id={file_id}"
    response = await client.get(url, timeout=10.0)
    
    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="File not found on Telegram")
        
    data = response.json()
    if not data.get("ok"):
        raise HTTPException(status_code=404, detail="File not found on Telegram")
        
    file_path = data["result"]["file_path"]
    
    # 2. Stream the file directly to the client
    download_url = f"https://api.telegram.org/file/bot{settings.telegram_bot_token}/{file_path}"
    
    # Stream the response via httpx generator
    async def proxy_stream():
        async with client.stream("GET", download_url) as stream_response:
            async for chunk in stream_response.aiter_bytes():
                yield chunk

    # We don't have the exact content type here easily without an extra HEAD request,
    # but the browser can usually infer it or we could use generic application/octet-stream
    return StreamingResponse(proxy_stream(), media_type="application/octet-stream")
