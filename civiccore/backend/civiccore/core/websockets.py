from typing import Dict, Set, Any
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps user email/sub to a set of active websocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # We can also add an org-based broadcast if needed
        self.org_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, email: str, org_id: str = None):
        await websocket.accept()
        if email not in self.active_connections:
            self.active_connections[email] = set()
        self.active_connections[email].add(websocket)
        
        if org_id:
            if org_id not in self.org_connections:
                self.org_connections[org_id] = set()
            self.org_connections[org_id].add(websocket)

    def disconnect(self, websocket: WebSocket, email: str, org_id: str = None):
        if email in self.active_connections:
            self.active_connections[email].discard(websocket)
            if not self.active_connections[email]:
                del self.active_connections[email]
                
        if org_id and org_id in self.org_connections:
            self.org_connections[org_id].discard(websocket)
            if not self.org_connections[org_id]:
                del self.org_connections[org_id]

    async def send_personal_message(self, message: dict, email: str):
        if email in self.active_connections:
            for connection in list(self.active_connections[email]):
                try:
                    await connection.send_json(message)
                except Exception:
                    # Ignore failing connections (e.g. disconnected abruptly)
                    pass

    async def broadcast_to_org(self, message: dict, org_id: str):
        sent = 0
        for connection in list(self.org_connections.get(org_id, [])):
            try:
                await connection.send_json(message)
                sent += 1
            except Exception:
                # Conexión muerta: descartarla para no acumular zombis
                self.org_connections[org_id].discard(connection)
                for conns in self.active_connections.values():
                    conns.discard(connection)
        print(f"[WS] {message.get('type')} -> org {org_id}: {sent} cliente(s)", flush=True)
                    
    async def broadcast_to_all(self, message: dict):
        for connections in self.active_connections.values():
            for connection in list(connections):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()
