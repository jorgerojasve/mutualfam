"""Eventos en tiempo real (WebSocket) por mutual.

Los endpoints de FastAPI declarados con `def` corren en un threadpool, por lo que
no pueden hacer `await` directamente. `notify_org` programa el broadcast en el
event loop principal (capturado cuando se conecta el primer WebSocket).
"""
import asyncio
from typing import Optional

from civiccore.core.websockets import manager

_loop: Optional[asyncio.AbstractEventLoop] = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def notify_org(org_id, event_type: str, payload: Optional[dict] = None) -> None:
    """Avisa a todos los clientes conectados a la mutual `org_id` que algo cambió."""
    if _loop is None or _loop.is_closed():
        return  # Nadie conectado todavía
    message = {"type": event_type, "payload": payload or {}}
    asyncio.run_coroutine_threadsafe(manager.broadcast_to_org(message, str(org_id)), _loop)
