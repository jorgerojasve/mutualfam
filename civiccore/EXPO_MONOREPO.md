# Guía de Expo en el Monorepo CivicCore

Este documento es parte del **framework CivicCore** y aplica a todas las apps
Expo del monorepo (`mutualfam-mobile`, `mutualsol-app`, `svmm-app`, etc.).
Léelo antes de iniciar cualquier desarrollo o depurar errores en apps móviles.

---

## 1. Arranque correcto

### NUNCA:
```bash
npx expo start   # Usa el CLI de la raíz del monorepo (versión incorrecta)
npm start        # Mismo problema
```

### SIEMPRE:
```bash
cd civiccore/apps/<nombre-app>
npx expo@57 start --clear
```

El flag `@57` fuerza el CLI correcto y `--clear` limpia la caché de Metro.

---

## 2. Instalación de dependencias

El monorepo tiene conflictos de `peerDependencies` entre apps (React 18 en web
vs React 19 en móvil). Por eso **siempre** usar:

```bash
# Desde la raíz del monorepo (civiccore/)
npm install --legacy-peer-deps
```

---

## 3. Configuración mínima de cada app Expo

### `package.json`
```json
{
  "main": "index.js",
  "scripts": {
    "start": "expo start"
  }
}
```
- `main` DEBE apuntar a un `index.js` local, **nunca** a `expo/AppEntry.js`.

### `index.js`
```js
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```

### `app.json`
```json
{
  "expo": {
    "sdkVersion": "57.0.0"
  }
}
```
- **Siempre** declarar `sdkVersion` explícito.
- **No** incluir `icon`, `splash` ni `adaptiveIcon` si los archivos no existen.

### `babel.config.js`
```js
module.exports = function(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```

---

## 4. Overrides obligatorios en `civiccore/package.json`

Para evitar que npm eleve versiones incompatibles a la raíz del monorepo,
el `package.json` raíz **debe** tener estos `overrides`:

```json
{
  "overrides": {
    "react-native": "0.86.3",
    "@react-native/codegen": "0.86.3",
    "expo": "~57.0.21",
    "react-native-safe-area-context": "5.7.0",
    "react-native-screens": "4.26.0"
  }
}
```

> **Por qué `safe-area-context` y `screens`:** Versiones más nuevas de estos
> paquetes (≥5.10 y ≥4.28 respectivamente) tienen `react-native@0.79.x` como
> peer dependency. Si npm los instala localmente en el workspace, provocan el
> error `PlatformConstants could not be found` aunque el `package.json` de la
> app declare `react-native@0.86.3`.

---

## 5. Árbol de decisiones para errores comunes

### 🔴 "Project incompatible — SDK 51 vs 57"
```
→ Estás usando npx expo start (versión vieja de la raíz)
→ Solución: npx expo@57 start --clear
```

### 🔴 "PlatformConstants could not be found" (pantalla roja)
```
→ Hay una copia local de react-native@0.79.x en node_modules de la app
   que prevalece sobre la versión 0.86.3 de la raíz.
→ Causas frecuentes: react-native-safe-area-context o react-native-screens
   instalados en versiones incompatibles localmente.
→ Solución paso a paso:
```
```bash
# 1. Eliminar las copias locales conflictivas (desde civiccore/)
rm -rf apps/<nombre-app>/node_modules/react-native
rm -rf apps/<nombre-app>/node_modules/react-native-safe-area-context
rm -rf apps/<nombre-app>/node_modules/react-native-screens

# 2. Verificar que los overrides del package.json raíz estén presentes

# 3. Reinstalar desde la raíz del monorepo
npm install --legacy-peer-deps

# 4. Arrancar limpio
npx expo@57 start --clear
```

### 🔴 "SyntaxError: ';' expected / match statement"
```
→ babel-preset-expo desactualizado en el package.json de la app
→ Solución: "babel-preset-expo": "~57.0.0"
```

### 🔴 "Got unexpected undefined" (Metro nullthrows)
```
→ El main del package.json apunta a expo/AppEntry en lugar de index.js local
→ Solución: "main": "index.js" + crear index.js con registerRootComponent
```

### 🔴 "Unable to resolve asset icon.png"
```
→ app.json declara icon/splash pero los archivos no existen
→ Solución: eliminar esos campos del app.json
```

---

## 6. Variables de entorno (IP LAN)

El archivo `.env` en la raíz de cada app controla la URL de la API.
La IP de la máquina de desarrollo en la red local es:

```
EXPO_PUBLIC_API_URL=http://172.16.0.12:8002/api/v1
```

Si cambias de red, actualiza este valor con la nueva IP:
```bash
ip a  # Linux
```

---

## 7. Tabla de compatibilidad (SDK 57)

| Paquete                        | Versión correcta |
|-------------------------------|-----------------|
| `expo`                         | `~57.0.25`      |
| `react-native`                 | `0.86.3`        |
| `react`                        | `19.2.3`        |
| `babel-preset-expo`            | `~57.0.0`       |
| `react-native-safe-area-context` | `5.7.0`       |
| `react-native-screens`         | `4.26.0`        |
| `react-native-gesture-handler` | `~2.32.0`       |

---

## 8. Checklist antes de abrir un issue

- [ ] `npx expo@57 start --clear` (no `npm start`)
- [ ] `civiccore/package.json` tiene los 6 `overrides` de la sección 4
- [ ] `npm ls react-native 2>&1 | grep invalid` no muestra resultados
- [ ] `app.json` tiene `sdkVersion: "57.0.0"` y sin assets inexistentes
- [ ] `index.js` usa `registerRootComponent`, no `expo/AppEntry`
- [ ] `.env` tiene la IP LAN correcta
