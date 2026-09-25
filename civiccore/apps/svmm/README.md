# Scientific Society - CivicCore Template

This is a template demonstrating how to use the CivicCore framework to build a backend for a Scientific Society.

## Features Mapped to CivicCore

- **Members**: Represent Researchers, Fellows, and Students.
- **Governance**: Used for electing the board of directors and approving resolutions.
- **Authorship** (Planned): To record official minutes and publications.

## Project Structure

- `app.py`: The main FastAPI application factory.
- `.env`: Configuration file.

## Ejecución de Servidores

Para levantar los diferentes entornos de esta aplicación (Backend, Web y Móvil), puedes ejecutar los siguientes comandos desde sus respectivos directorios:

### Backend
Ubícate en el directorio del backend (`svmm`), activa el entorno virtual de `civiccore/backend` y asegúrate de tener instalado el paquete `civiccore`.
El comando de ejecución depende de dónde pruebes la app móvil:

**Opción A: Emulador en tu PC**
```bash
# 1. Activar el entorno virtual
source ../../backend/venv/bin/activate

# 2. Copiar variables de entorno (si es primera vez)
cp .env.example .env

# 3. Ejecutar la aplicación
uvicorn app:app --reload
```

**Opción B: Teléfono Físico (vía WiFi)**
```bash
# 1. Activar el entorno virtual
source ../../backend/venv/bin/activate

# 2. Copiar variables de entorno (si es primera vez)
cp .env.example .env

# 3. Ejecutar la aplicación permitiendo conexiones externas
uvicorn app:app --host 0.0.0.0 --reload
```
*(Recuerda poner tu IP WiFi local en el archivo `.env` de la app móvil).*

### Frontend (Sitio Web)
Ubícate en el directorio de la web (`svmm-web`), instala las dependencias y ejecuta:
```bash
npm install
npm run dev
```

### Frontend (App Móvil)
Ubícate en la **raíz del monorepo** (`civiccore/`) e instala las dependencias:
```bash
npm install --legacy-peer-deps
```
Luego arranca la app desde su directorio:
```bash
cd apps/svmm-app
npx expo@57 start --clear
```

> ⚠️ **No uses `npm start` ni `npx expo start`** — en este monorepo siempre
> se debe especificar la versión del CLI: `npx expo@57 start --clear`.
> Ver [`civiccore/EXPO_MONOREPO.md`](../../EXPO_MONOREPO.md) para la guía
> completa de troubleshooting (errores de PlatformConstants, SDK, etc.).
