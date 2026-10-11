import json
import logging
import urllib.request

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def send_push_notification(token: str, title: str, body: str, data: dict = None):
    """
    Envía una notificación push a un token específico usando la API REST de Expo.
    Utiliza urllib estándar de Python para evitar dependencias externas.
    """
    if not token or not token.startswith("ExponentPushToken"):
        logger.warning(f"Token de push inválido ignorado: {token}")
        return

    payload = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
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
    except Exception as exc:
        logger.error(f"Error enviando push notification a {token}: {exc}")

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
        print(f"ℹ️ [PUSH NOTIFICACIÓN] Ningún usuario de {user_ids} tiene token push registrado (esperable en Expo Go).", flush=True)
        return

    messages = []
    for t in tokens:
        if t.token and t.token.startswith("ExponentPushToken"):
            messages.append({
                "to": t.token,
                "title": title,
                "body": body,
                "sound": "default",
                "data": data or {}
            })

    if not messages:
        print(f"ℹ️ [PUSH NOTIFICACIÓN] Tokens encontrados pero ninguno con formato ExponentPushToken.", flush=True)
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
    except Exception as exc:
        logger.error(f"Error enviando push notifications batch: {exc}")
