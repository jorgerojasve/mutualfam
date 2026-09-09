import os
import time
import subprocess
from datetime import datetime

# Requires: pip install google-genai pillow
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Por favor instala las dependencias: pip install google-genai pillow")
    exit(1)

def get_emulator_screenshot():
    # Use adb to take a screenshot and return the bytes
    try:
        # Check if adb is available
        result = subprocess.run(['adb', 'devices'], capture_output=True, text=True)
        if "emulator" not in result.stdout:
            print("No se encontró ningún emulador corriendo.")
            return None
            
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Capturando pantalla del emulador...")
        screenshot_result = subprocess.run(
            ['adb', 'exec-out', 'screencap', '-p'],
            capture_output=True
        )
        
        if screenshot_result.returncode != 0:
            print("Error al capturar la pantalla.")
            return None
            
        return screenshot_result.stdout
    except FileNotFoundError:
        print("El comando 'adb' no está instalado o no está en el PATH.")
        return None

def analyze_with_ai(image_bytes, api_key):
    try:
        # Save temporarily for the SDK (or pass bytes if supported)
        with open("/tmp/current_screen.png", "wb") as f:
            f.write(image_bytes)
            
        client = genai.Client(api_key=api_key)
        
        prompt = """
        Eres un asistente de depuración para React Native / Expo.
        Esta es una captura de pantalla del emulador en tiempo real.
        Tu tarea es:
        1. Analizar si hay una pantalla de error rojo de Expo (LogBox / Redbox).
        2. Si hay un error, extrae el mensaje de error y el archivo/línea donde ocurrió.
        3. Propón una solución breve para el error.
        4. Si no hay error visible, simplemente responde "No hay errores visibles en esta pantalla."
        """
        
        # Upload using the new genai File API
        screen_file = client.files.upload(file="/tmp/current_screen.png")
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[screen_file, prompt]
        )
        
        return response.text
    except Exception as e:
        return f"Error al contactar con la IA: {str(e)}"

def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Por favor configura la variable de entorno GEMINI_API_KEY")
        print("Ejemplo: export GEMINI_API_KEY='tu_api_key'")
        return

    print("Iniciando CivicCore DevKit Watcher (ADB + AI)...")
    print("Presiona Ctrl+C para detener.")
    
    try:
        while True:
            image_bytes = get_emulator_screenshot()
            if image_bytes:
                print("Analizando pantalla con IA...")
                analysis = analyze_with_ai(image_bytes, api_key)
                print("\n--- REPORTE DE LA IA ---")
                print(analysis)
                print("------------------------\n")
            
            # Wait 10 seconds before next capture to avoid rate limits
            time.sleep(10)
    except KeyboardInterrupt:
        print("\nWatcher detenido.")

if __name__ == "__main__":
    main()
