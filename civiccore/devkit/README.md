# CivicCore DevKit 🛠️

El CivicCore DevKit proporciona herramientas de desarrollo impulsadas por IA y automatización de QA para aplicaciones construidas sobre el framework CivicCore.

## 1. Watcher IA (`scripts/watch.py`)

El **Watcher** es un script en Python que monitorea el emulador de Android en tiempo real, captura la pantalla usando `adb` y utiliza IA (Gemini Vision) para detectar errores (ej. *Redbox* de Expo, *LogBox*) y proponer soluciones automáticamente.

### Uso
1. Asegúrate de tener instalado `google-genai` y `pillow`:
   ```bash
   pip install google-genai pillow
   ```
2. Configura tu API Key de Gemini:
   ```bash
   export GEMINI_API_KEY="tu_api_key_aqui"
   ```
3. Ejecuta el watcher mientras el emulador Android está corriendo:
   ```bash
   python scripts/watch.py
   ```

## 2. Automatización Maestro (`flows/`)

Utilizamos [Maestro](https://maestro.mobile.dev/) para flujos de prueba e2e (End-to-End) declarativos y comprensibles.

### Instalación
Si no tienes Maestro instalado, ejecuta:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Ejecutar Pruebas
Levanta el emulador, asegúrate de que la app esté instalada/corriendo (ej. Expo Go) y ejecuta:
```bash
maestro test flows/auth_flow.yaml
maestro test flows/credit_flow.yaml
```

*Nota: Para Expo Go en desarrollo, es posible que debas adaptar el `appId` en los YAML o apuntar Maestro al id `host.exp.exponent`.*
