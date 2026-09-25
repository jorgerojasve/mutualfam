# MutualFam App

## Ejecución de Servidores

Para levantar los diferentes entornos de esta aplicación (Backend, Web y Móvil), puedes ejecutar los siguientes comandos desde sus respectivos directorios:

### Backend
Ubícate en el directorio del backend (`mutualfam`) y activa el entorno virtual de `civiccore/backend`.
El comando de ejecución depende de dónde pruebes la app móvil:

**Opción A: Emulador en tu PC**
```bash
source ../../backend/venv/bin/activate
uvicorn app:app --reload
```

**Opción B: Teléfono Físico (vía WiFi)**
```bash
source ../../backend/venv/bin/activate
uvicorn app:app --host 0.0.0.0 --reload
```
*(Recuerda poner tu IP WiFi local en el archivo `.env` de la app móvil).*

### Frontend (Sitio Web)
Ubícate en el directorio de la web (`mutualfam-web`), instala las dependencias y ejecuta:
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
cd apps/mutualfam-mobile
npx expo@57 start --clear
```

> ⚠️ **No uses `npm start` ni `npx expo start`** — en este monorepo siempre
> se debe especificar la versión del CLI: `npx expo@57 start --clear`.
> Ver [`civiccore/EXPO_MONOREPO.md`](../../EXPO_MONOREPO.md) para la guía
> completa de troubleshooting (errores de PlatformConstants, SDK, etc.).
