import os
import asyncio
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os

from civiccore.core.database import engine, Base
import models
from routers import auth, membership, config

# Crear todas las tablas en la base de datos SQLite aislada de MutualFam
Base.metadata.create_all(bind=engine)

load_dotenv()

app = FastAPI(title="Mutual Familiar API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(membership.router, prefix="/api/v1/membership", tags=["membership"])
app.include_router(config.router, prefix="/api/v1/config", tags=["config"])

from routers import loans, funds, upload
app.include_router(loans.router, prefix="/api/v1/loans", tags=["loans"])
app.include_router(funds.router, prefix="/api/v1/funds", tags=["funds"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["upload"])

from routers.upload import UPLOADS_DIR
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Mutual Familiar API is running"}


@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None, org_id: str = None):
    """Canal de eventos en tiempo real. Cada cliente se suscribe a su mutual activa."""
    from jose import JWTError, jwt
    from civiccore.core.config import settings
    from civiccore.core.database import SessionLocal
    from civiccore.core.websockets import manager
    from civiccore.modules.membership.models import OrganizationMembership
    from services import realtime

    if not token or not org_id or not org_id.isdigit():
        await websocket.close(code=1008)
        return
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
    except JWTError:
        user_id = None
    if not user_id:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        is_member = db.query(OrganizationMembership).filter(
            OrganizationMembership.user_id == int(user_id),
            OrganizationMembership.organization_id == int(org_id),
        ).first() is not None
    finally:
        db.close()
    if not is_member:
        await websocket.close(code=1008)
        return

    realtime.set_loop(asyncio.get_running_loop())
    await manager.connect(websocket, str(user_id), org_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, str(user_id), org_id)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8002, reload=True)
