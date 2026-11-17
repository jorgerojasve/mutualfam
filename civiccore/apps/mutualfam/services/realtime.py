"""Eventos en tiempo real (WebSocket) por mutual.

Los endpoints de FastAPI declarados con `def` corren en un threadpool, por lo que
no pueden hacer `await` directamente. `notify_org` programa el broadcast en el
event loop principal (capturado al inicio de FastAPI o cuando se conecta el WebSocket).
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
    global _loop
    if _loop is None or _loop.is_closed():
        try:
            _loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

    if _loop is None or _loop.is_closed():
        print(f"[RT] Advertencia: loop de eventos no disponible para emitir {event_type} a org {org_id}", flush=True)
        return

    message = {"type": event_type, "payload": payload or {}}
    print(f"[RT] Emitiendo evento {event_type} a mutual {org_id}: {payload}", flush=True)
    asyncio.run_coroutine_threadsafe(manager.broadcast_to_org(message, str(org_id)), _loop)

