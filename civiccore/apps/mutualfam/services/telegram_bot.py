import os
import json
import urllib.request
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("TELEGRAM_STORAGE_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID") or os.getenv("TELEGRAM_STORAGE_CHAT_ID")

def send_telegram_notification(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram bot not configured. Message would have been:", message)
        return False
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }
    
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200
    except Exception as e:
        print(f"Error enviando mensaje a Telegram: {e}")
        return False

def send_telegram_photo(message: str, photo_path: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram bot not configured. Photo message would have been:", message)
        return False
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
    
    try:
        boundary = 'wL36Yn8afVp8Ag7AmP8qZ0SA4n1v9T'
        headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}
        
        body = bytearray()
        
        # Add chat_id
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n{TELEGRAM_CHAT_ID}\r\n'.encode('utf-8'))
        
        # Add caption
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n{message}\r\n'.encode('utf-8'))
        
        # Add parse_mode
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n'.encode('utf-8'))
        
        # Add photo
        filename = os.path.basename(photo_path)
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="{filename}"\r\nContent-Type: image/jpeg\r\n\r\n'.encode('utf-8'))
        
        with open(photo_path, 'rb') as f:
            body.extend(f.read())
            
        body.extend(f'\r\n--{boundary}--\r\n'.encode('utf-8'))
        
        req = urllib.request.Request(url, data=bytes(body), headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                try:
                    res_json = json.loads(response.read().decode('utf-8'))
                    if res_json.get("ok"):
                        photos = res_json.get("result", {}).get("photo", [])
                        if photos:
                            return photos[-1].get("file_id")
                        doc = res_json.get("result", {}).get("document", {})
                        if doc:
                            return doc.get("file_id")
                except Exception:
                    pass
                return True
            return False
    except Exception as e:
        error_body = ""
        if hasattr(e, 'read'):
            error_body = e.read().decode('utf-8', errors='ignore')
        print(f"Error enviando foto a Telegram: {e} - Response: {error_body}")
        return False

def download_telegram_file(file_id: str, dest_path: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not file_id:
        return False
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=12) as response:
            if response.status != 200:
                return False
            data = json.loads(response.read().decode('utf-8'))
            if not data.get("ok"):
                return False
            file_path = data["result"]["file_path"]

        download_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}"
        dl_req = urllib.request.Request(download_url)
        with urllib.request.urlopen(dl_req, timeout=25) as dl_resp:
            if dl_resp.status != 200:
                return False
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with open(dest_path, "wb") as f:
                f.write(dl_resp.read())
            return True
    except Exception as e:
        print(f"Error descargando archivo de Telegram {file_id}: {e}")
        return False
