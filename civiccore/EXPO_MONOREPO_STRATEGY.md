# Estrategia de Prevención: Apps Expo en el Monorepo CivicCore

## 1. Análisis de Causa Raíz

### Los 6 Errores y Sus Causas

```
ERROR 1 ← "Project incompatible with Expo Go (SDK 51 vs 57)"
 └── CAUSA: `npx expo start` ejecuta el CLI de `civiccore/node_modules/expo@51`
      porque npm workspaces eleva (hoist) la versión vieja que tenía el
      proyecto `mutualsol-app` a la raíz del monorepo.

ERROR 2 ← "Unable to resolve asset ./assets/icon.png"
 └── CAUSA: app.json referenciaba archivos de assets que no existían.
      El metro falló silenciosamente y enviaba un bundle vacío/corrupto.

ERROR 3 ← "SyntaxError: ';' expected (match statement)"
 └── CAUSA: babel-preset-expo@12 (del SDK 51) no entiende la sintaxis
      experimental `match` de React Native 0.86.3 (del SDK 57).

ERROR 4 ← "Error: Got unexpected undefined (Metro nullthrows)"
 └── CAUSA: `import 'expo/AppEntry'` busca App.js desde la posición del
      módulo en disco: `civiccore/node_modules/expo/AppEntry.js`.
      Ese archivo hace `import App from '../../App'`, buscando en
      `civiccore/App.js` y NO en `apps/mutualfam-mobile/App.js`.

ERROR 5 ← "[runtime not ready]: PlatformConstants could not be found"
 └── CAUSA: `react-native@0.79` instalado localmente mientras Expo Go
      en el celular tenía compilado el runtime de `react-native@0.86`.
      El Bridge nativo recibía instrucciones desconocidas y explotaba.

ERROR 6 ← "Unable to resolve expo/build/Expo.fx"
 └── CAUSA: `expo/build/Expo.fx` no existe como archivo exportable en
      la API pública del SDK 57.
```

### Causa Raíz Unificadora

> **El monorepo `npm workspaces` eleva las dependencias a la raíz, creando
> una "sombra" sobre las dependencias locales de la app móvil. Cuando
> distintos workspaces requieren versiones incompatibles del mismo paquete,
> npm usa la versión más vieja de la raíz para todos.**

Esto se manifiesta en tres vectores simultáneos:
1. **CLI ejecutable**: `expo` CLI de la raíz es el viejo → SDK incorrecto.
2. **Runtime JS**: `react-native` de la raíz es el viejo → Bridge incompatible.
3. **Compilador**: `babel-preset-expo` de la raíz es el viejo → SyntaxError.

---

## 2. La Configuración que Funciona (Estado Final Verificado)

### `apps/<nombre>/package.json`
```json
{
  "name": "mi-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  },
  "dependencies": {
    "expo": "~57.0.24",
    "expo-status-bar": "~57.0.1",
    "react": "19.2.3",
    "react-native": "0.86.3",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-navigation/native": "^7.4.1",
    "@react-navigation/bottom-tabs": "^7.19.2",
    "@react-navigation/stack": "^7.11.2",
    "react-native-gesture-handler": "~2.32.0",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "~4.26.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "babel-preset-expo": "~57.0.0"
  },
  "private": true
}
```

**Reglas críticas:**
- Usar `~` (patch) o versión exacta, NUNCA `^` en librerías nativas de RN.
- `babel-preset-expo` DEBE coincidir con la major del SDK de Expo.
- `react-native` DEBE ser exactamente la versión que lista `npx expo@<SDK> install --check`.

### `apps/<nombre>/app.json`
```json
{
  "expo": {
    "name": "Mi App",
    "slug": "mi-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "sdkVersion": "57.0.0",
    "ios": { "supportsTablet": true }
  }
}
```
- **SIEMPRE** declarar `sdkVersion` explícitamente.
- **NUNCA** referenciar assets (`icon`, `splash`) si los archivos no existen.

### `apps/<nombre>/index.js`
```javascript
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```
- SIEMPRE un `index.js` local.
- NUNCA apuntar `main` a `node_modules/expo/AppEntry.js`.
- NUNCA hacer `import 'expo/AppEntry'` en monorepos.

### `apps/<nombre>/babel.config.js`
```javascript
module.exports = function(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```

### `civiccore/package.json` — `overrides` en la raíz
```json
{
  "overrides": {
    "react-native": "0.86.3",
    "@react-native/codegen": "0.86.3",
    "expo": "~57.0.24"
  }
}
```
Los `overrides` fuerzan a TODOS los workspaces a usar la misma versión,
evitando que npm eleve la versión vieja de otro workspace a la raíz.

---

## 3. Procedimiento Paso a Paso (Para el Agente)

### PASO 0 — Verificar versión vigente de Expo Go en el dispositivo
El SDK del proyecto DEBE coincidir con el SDK de Expo Go instalado.

### PASO 1 — Crear los 4 archivos de configuración críticos
En orden: `package.json` → `app.json` → `index.js` → `babel.config.js`

### PASO 2 — Verificar `overrides` en la raíz ANTES de instalar

### PASO 3 — Instalar dependencias
```bash
npm install --legacy-peer-deps

# Verificar ausencia de conflictos
npm ls react-native 2>&1 | grep -i invalid
# Si hay resultados:
rm -rf node_modules/react-native && npm install --legacy-peer-deps
```

### PASO 4 — Iniciar con la versión correcta del CLI
```bash
# NUNCA: npx expo start
# SIEMPRE:
npx expo@57 start --clear
```

---

## 4. Árbol de Decisiones para Depurar Errores

```
¿"incompatible SDK / SDK 51 vs 57"?
  └── Cambia a `npx expo@57 start --clear`

¿"SyntaxError: ';' expected / match statement"?
  └── babel-preset-expo desactualizado
      └── package.json: "babel-preset-expo": "~57.0.0"

¿"nullthrows / Got unexpected undefined" en Metro?
  └── Verificar index.js local con registerRootComponent
      └── NUNCA `import 'expo/AppEntry'` en monorepos

¿Pantalla roja "PlatformConstants not found"?
  └── rm -rf node_modules/react-native && npm install --legacy-peer-deps

¿"Unable to resolve asset icon.png"?
  └── Eliminar campos icon/splash/adaptiveIcon del app.json
```

---

## 5. Tabla de Compatibilidad

| Expo SDK | React Native | React  | babel-preset-expo | Node mín. |
|----------|-------------|--------|-------------------|-----------|
| **57**   | **0.86.3**  | **19.2.3** | **~57.0.0**   | 22 LTS    |
| 53       | 0.79.x      | 18.3.x | ~11.x             | 20 LTS    |
| 52       | 0.76.x      | 18.3.x | ~10.x             | 18 LTS    |

---

## 6. Política de Librerías Nativas

| Criterio | Regla |
|----------|-------|
| Semver | `~` para librerías nativas; `^` solo para utilidades JS puras |
| Antigüedad | Sin actualizaciones > 6 meses → buscar alternativa |
| Fuente | Preferir `expo/*`, `@react-navigation/*`, `@react-native-community/*` |
| New Architecture | A partir de SDK 52, todas las libs DEBEN soportar New Arch |

---

## 7. Checklist de Entrega Final

- [ ] `npm ls react-native` no muestra líneas con `invalid`
- [ ] `npx expo@<SDK> start --clear` arranca sin warnings de versión
- [ ] La pantalla inicial carga en < 30 segundos en Expo Go
- [ ] `.env` tiene la IP LAN correcta del servidor de desarrollo
- [ ] `app.json` tiene `sdkVersion` explícito y sin assets inexistentes
- [ ] `index.js` usa `registerRootComponent` local, no `expo/AppEntry`
- [ ] `babel.config.js` existe con `babel-preset-expo`
