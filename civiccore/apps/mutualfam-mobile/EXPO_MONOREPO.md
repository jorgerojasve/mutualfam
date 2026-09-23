# Guía de configuración de Expo en el Monorepo CivicCore

Este documento explica los problemas conocidos al iniciar una app Expo dentro
de este monorepo y cómo resolverlos. Lee esto antes de iniciar cualquier
desarrollo en `apps/mutualfam-mobile` (o cualquier futura app Expo).

---

## Problema principal: conflicto de SDK en monorepos

### Síntoma
Al ejecutar `npx expo start` desde dentro de la app móvil, Expo Go reporta:

```
ERROR  Project is incompatible with this version of Expo Go
• The installed version of Expo Go is for SDK 57.
• The project you opened uses SDK 51.
```

### Causa raíz
El monorepo tiene instalado `expo@51` en su `node_modules` raíz
(`civiccore/node_modules/expo`). Cuando ejecutas `npx expo`, Node.js
resuelve el binario desde esa versión antigua en lugar de la que está
en `apps/mutualfam-mobile/node_modules/expo`.

### Solución definitiva
**Siempre usar `npx expo@<VERSIÓN> start` en lugar de `npx expo start`.**
Esto fuerza a descargar y usar la CLI correcta, ignorando la del monorepo:

```bash
npx expo@57 start --clear
```

---

## Configuración correcta del proyecto Expo

### 1. `package.json` — Entry point
El campo `main` DEBE apuntar a un archivo local `index.js`, NO a
`node_modules/expo/AppEntry.js` (que falla en monorepos porque npm puede
mover la dependencia hacia arriba en la jerarquía):

```json
{
  "main": "index.js"
}
```

### 2. `index.js` — Archivo de arranque
Debe existir un `index.js` en la raíz del proyecto móvil:

```js
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

### 3. `app.json` — Versión del SDK
Siempre declarar `sdkVersion` explícitamente para evitar que Expo lo
infiera desde el CLI equivocado:

```json
{
  "expo": {
    "sdkVersion": "57.0.0"
  }
}
```

**No incluir referencias a assets (icon, splash) si no existen físicamente
en la carpeta `assets/`. Expo fallará silenciosamente si los declara y no
los encuentra.**

### 4. `app.json` — Assets opcionales
Si no tienes iconos todavía, omite estos campos hasta tenerlos:
```json
"icon": "./assets/icon.png",
"splash": { ... },
"android": { "adaptiveIcon": { ... } }
```

---

## Instalación de dependencias

### Regla de oro
**NUNCA usar `npm install` para dependencias de React Native.**
Usar siempre `npx expo install` para que Expo fije las versiones correctas:

```bash
# ✅ Correcto
npx expo install @react-navigation/native react-native-screens ...

# ❌ Incorrecto — instala versiones incompatibles
npm install react-native-screens
```

### En este monorepo (excepción)
Dado que hay conflictos de `peerDependencies` entre las apps web (React 18)
y la app móvil (React 19), es necesario usar el flag `--legacy-peer-deps`:

```bash
npm install --legacy-peer-deps @react-navigation/native @react-navigation/bottom-tabs ...
```

---

## Variables de entorno (IP LAN para Expo Go)

El archivo `.env` en la raíz de `apps/mutualfam-mobile` controla la URL
de la API. La IP de la máquina de desarrollo en la red local es:

```
EXPO_PUBLIC_API_URL=http://172.16.0.12:8002/api/v1
```

Si cambias de red, actualiza este archivo con la nueva IP (verificable con
`ip a` en Linux o `ipconfig` en Windows).

---

## Comando de inicio (resumen rápido)

```bash
cd civiccore/apps/mutualfam-mobile
npx expo@57 start --clear
```
