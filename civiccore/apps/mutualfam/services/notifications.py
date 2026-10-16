import json
import logging
import threading
import time
import urllib.request

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"

def is_valid_expo_push_token(token: str) -> bool:
    """Verifica si el token tiene un formato válido de Expo Push."""
    if not token or not isinstance(token, str):
        return False
    return token.startswith("ExponentPushToken") or token.startswith("ExpoPushToken")

def _track_push_receipts(res_data: dict):
    """
    Consulta a Expo 4 segundos después de enviar para verificar si Google FCM
    entregó exitosamente el mensaje o si hubo un error (credenciales, dispositivo, etc.).
    """
    try:
        data = res_data.get("data", [])
        if isinstance(data, dict):
            data = [data]
        ids = [item.get("id") for item in data if isinstance(item, dict) and item.get("status") == "ok" and item.get("id")]
        if not ids:
            return

        def check():
            time.sleep(4)
            try:
                req = urllib.request.Request(
                    EXPO_RECEIPTS_URL,
                    data=json.dumps({"ids": ids}).encode("utf-8"),
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10) as response:
                    receipts = json.loads(response.read().decode("utf-8")).get("data", {})
                    for rid, rinfo in receipts.items():
                        if rinfo.get("status") == "ok":
                            print(f"🎉 [PUSH RECIBO] ID {rid}: ¡Entregado exitosamente a Google FCM!", flush=True)
                        else:
                            print(f"❌ [PUSH RECIBO] ID {rid}: Error de entrega en Google FCM: {rinfo}", flush=True)
            except Exception as e:
                print(f"⚠️ [PUSH RECIBO] No se pudo verificar recibo: {e}", flush=True)

        threading.Thread(target=check, daemon=True).start()
    except Exception:
        pass

def send_push_notification(token: str, title: str, body: str, data: dict = None):
    """
    Envía una notificación push a un token específico usando la API REST de Expo.
    Utiliza urllib estándar de Python para evitar dependencias externas.
    """
    if not is_valid_expo_push_token(token):
        logger.warning(f"Token de push inválido ignorado: {token}")
        return

    payload = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "channelId": "default",
        "priority": "high",
        "data": data or {}
    }

    try:
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            logger.info(f"Push enviada a {token}: {res_data}")
            print(f"✅ [PUSH NOTIFICACIÓN] Enviada a {token}: {res_data}", flush=True)
            _track_push_receipts(res_data)
    except Exception as exc:
        logger.error(f"Error enviando push notification a {token}: {exc}")
        print(f"❌ [PUSH NOTIFICACIÓN] Error enviando a {token}: {exc}", flush=True)

def notify_users(db, user_ids: list, title: str, body: str, data: dict = None):
    """
    Envía una notificación push en lote a todos los tokens registrados de los usuarios indicados.
    """
    from models import UserPushToken
    if not user_ids:
        return

    print(f"🔔 [PUSH NOTIFICACIÓN] Para user_ids={user_ids} | Título: \"{title}\" | Mensaje: \"{body}\"", flush=True)

    tokens = db.query(UserPushToken).filter(UserPushToken.user_id.in_(user_ids)).all()
    if not tokens:
        print(f"ℹ️ [PUSH NOTIFICACIÓN] Ningún usuario de {user_ids} tiene token push registrado.", flush=True)
        return

    messages = []
    for t in tokens:
        if is_valid_expo_push_token(t.token):
            messages.append({
                "to": t.token,
                "title": title,
                "body": body,
                "sound": "default",
                "channelId": "default",
                "priority": "high",
                "data": data or {}
            })

    if not messages:
        print(f"ℹ️ [PUSH NOTIFICACIÓN] Tokens encontrados pero ninguno con formato ExpoPushToken válido.", flush=True)
        return

    print(f"🚀 [PUSH NOTIFICACIÓN] Enviando {len(messages)} mensaje(s) a Expo Push Service...", flush=True)

    try:
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=json.dumps(messages).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            logger.info(f"Push notifications batch enviadas ({len(messages)} mensajes): {res_data}")
            print(f"✅ [PUSH NOTIFICACIÓN] Respuesta de Expo Push Service: {res_data}", flush=True)
            _track_push_receipts(res_data)
    except Exception as exc:
        logger.error(f"Error enviando push notifications batch: {exc}")
        print(f"❌ [PUSH NOTIFICACIÓN] Error enviando a Expo Push Service: {exc}", flush=True)


