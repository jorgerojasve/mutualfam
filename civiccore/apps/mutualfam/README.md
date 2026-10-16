# MutualFam App

## Ejecución de Servidores

Para levantar los diferentes entornos de esta aplicación (Backend, Web y Móvil), puedes ejecutar los siguientes comandos desde sus respectivos directorios:

### Backend (API + Base de Datos)
La forma recomendada de levantar el backend en desarrollo local es utilizando Docker, ya que encapsula todas las dependencias automáticamente.

Ubícate en la **raíz del repositorio** (donde se encuentra `start.sh`) y ejecuta el script:

```bash
cd ../../../
./start.sh
```

El script interactivo te preguntará qué aplicación levantar. Selecciona `1` para `mutualfam`. 
Esto levantará el contenedor Docker exponiendo la API en la red local en el puerto `8000`.

*(Nota sobre la app móvil: al ejecutar Expo Go, la app detecta automáticamente la IP local de tu PC a través del bundler de Metro y se conecta al backend local en el puerto `8000`. Si deseas forzar una IP específica o estás usando un emulador Android, puedes definir `EXPO_PUBLIC_API_URL` en `civiccore/apps/mutualfam-mobile/.env`, ej: `EXPO_PUBLIC_API_URL=http://<TU_IP>:8000/api/v1` o `http://10.0.2.2:8000/api/v1`).*

Para detener el servidor cuando termines de desarrollar, ejecuta en la misma raíz:
```bash
./stop.sh
```

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
