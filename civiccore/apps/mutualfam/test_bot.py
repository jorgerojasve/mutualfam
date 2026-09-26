import urllib.request
import urllib.parse
import os

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send_telegram_photo(message: str, photo_path: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
    
    try:
        boundary = 'wL36Yn8afVp8Ag7AmP8qZ0SA4n1v9T'
        headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}
        
        body = bytearray()
        
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n{TELEGRAM_CHAT_ID}\r\n'.encode('utf-8'))
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n{message}\r\n'.encode('utf-8'))
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n'.encode('utf-8'))
        
        filename = os.path.basename(photo_path)
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode('utf-8'))
        
        with open(photo_path, 'rb') as f:
            body.extend(f.read())
            
        body.extend(f'\r\n--{boundary}--\r\n'.encode('utf-8'))
        
        req = urllib.request.Request(url, data=bytes(body), headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            print(response.status)
            return response.status == 200
    except Exception as e:
        print(f"Error enviando foto a Telegram: {e}")
        if hasattr(e, 'read'):
            print(e.read())
        return False

# create a dummy image
with open('dummy.jpg', 'wb') as f:
    f.write(b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00\xFF\xD9')

from dotenv import load_dotenv
load_dotenv()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
send_telegram_photo("Test", "dummy.jpg")
