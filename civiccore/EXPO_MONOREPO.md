# Guía y Estrategia de Expo en el Monorepo CivicCore

Este documento unifica el framework y las estrategias de mitigación de errores para todas las apps Expo del monorepo (`mutualfam-mobile`, `mutualsol-app`, `svmm-app`, etc.). Léelo **antes** de iniciar cualquier desarrollo, agregar librerías o depurar errores en apps móviles.

---

## 1. La Configuración que Funciona (Estado Final Verificado)

### `apps/<nombre>/package.json`
- **Librerías Nativas:** Usar `~` (patch) o versión exacta, NUNCA `^`.
- **Babel:** `babel-preset-expo` DEBE coincidir con la major del SDK de Expo.
- **React Native:** DEBE ser la versión exigida por el SDK (0.86.3 para SDK 57).
- **Scripts:** `"start": "expo start"`
- **Main:** `"main": "index.js"` (NUNCA apuntar a `expo/AppEntry.js`)

### `civiccore/package.json` — `overrides` en la raíz
Estado **real** actual del repo:
```json
{
  "overrides": {
    "tar": "^7.5.21"
  }
}
```
> [!IMPORTANT]
> Esta guía documentó antes overrides para `react-native`, `expo`, `react-native-screens`, etc. que **nunca estuvieron en el `package.json`**. No los agregues: la versión de `react-native-screens` se controla **por app** (ver §5 y la nota de APK).

### Nota crítica: `react-native-screens` en `mutualfam-mobile` (APK)
`mutualfam-mobile` fija `react-native-screens: 5.0.0-alpha.3` como **copia anidada** en `apps/mutualfam-mobile/node_modules/`. Es la única versión verificada que compila en release con RN 0.86.3 / Fabric (ver `docs/GUIA_COMPILACION_RN086.md` §5). Con `4.26.x` falla `:react-native-screens:compileReleaseKotlin` (`getFabricUIManagerNotNull ... receiver type mismatch`).
- **NO** borres `apps/mutualfam-mobile/node_modules/react-native-screens` (sí borra `react-native` y `react-native-safe-area-context` anidados, ver §3).
- **NO** cambies esa versión a `4.26.0` para "alinear" con la raíz.
- La copia de la raíz (`4.26.x`) la usan las demás apps.

---

## 2. Instalación y Arranque Correcto

### SIEMPRE:
```bash
# Instalación siempre desde la raíz del monorepo
cd civiccore/
npm install --legacy-peer-deps

# Arranque siempre forzando la versión del SDK y limpiando caché
cd apps/<nombre-app>
npx expo@57 start --clear
```

### NUNCA:
- `npx expo start` (Usa el CLI de la raíz que puede ser de otro SDK).
- `npm start` (Mismo problema).

---

## 3. Lecciones Aprendidas: Depuración de Errores Críticos (Frontend)

El monorepo `npm workspaces` eleva las dependencias a la raíz ("hoisting"), pero cuando hay conflictos locales, NPM instala copias ocultas ("nested node_modules") dentro de tu app. Esto causa choques catastróficos.

### 🔴 "[runtime not ready]: TypeError: undefined is not a function" o "PlatformConstants not found"
**Causa:**
Al instalar librerías como `react-native-safe-area-context` o `datetimepicker`, NPM determinó que requerían una versión vieja de React Native (ej. `0.79.2`). Como la raíz ya tiene `0.86.3`, NPM creó la carpeta secreta `apps/<tu-app>/node_modules/react-native` con la versión 0.79.2. Metro Bundler cargó esa versión corrupta y el Bridge nativo colapsó.
**Solución (El Borrado Post-Instalación):**
```bash
# 1. Instala normalmente en la raíz
npm install --legacy-peer-deps

# 2. DESPUÉS de instalar, borra manualmente las carpetas conflictivas locales
rm -rf apps/<tu-app>/node_modules/react-native
rm -rf apps/<tu-app>/node_modules/react-native-safe-area-context
# (react-native-screens: borrar la copia anidada SOLO si la app no la fija
#  explícitamente. mutualfam-mobile NO: necesita 5.0.0-alpha.3 anidada)

# 3. Arranca limpio
npx expo@57 start --clear
```

### 🔴 "Project incompatible — SDK 51 vs 57"
**Causa:** Estás usando `npx expo start` y ejecutando un CLI viejo.
**Solución:** Usa `npx expo@57 start --clear`.

### 🔴 "Got unexpected undefined" (Metro nullthrows)
**Causa:** `main` en `package.json` apunta a `expo/AppEntry`. Al hacer imports relativos desde allí, busca en la raíz del monorepo y no en tu app.
**Solución:** Cambia `"main": "index.js"` y crea un `index.js` local con `registerRootComponent(App)`.

### 🔴 "Unable to resolve asset icon.png"
**Causa:** El `app.json` declara iconos o splash screens que no existen en el disco duro.
**Solución:** Elimina esos campos de `app.json`.

---

## 4. Variables de Entorno y Conexión de Red

El archivo `.env` controla la URL de la API (`EXPO_PUBLIC_API_URL`).
- **Emulador en PC:** `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1`
- **Teléfono Físico (WiFi):** `EXPO_PUBLIC_API_URL=http://<TU_IP_LOCAL>:8000/api/v1`
*(Cualquier cambio en el `.env` requiere reiniciar Expo con `--clear`)*.

---

## 5. Tabla de Compatibilidad (SDK 57)

| Paquete                        | Versión correcta |
|-------------------------------|-----------------|
| `expo`                         | `~57.0.25`      |
| `react-native`                 | `0.86.3`        |
| `react`                        | `19.2.3`        |
| `babel-preset-expo`            | `~57.0.0`       |
| `react-native-safe-area-context` | `5.7.0`       |
| `react-native-screens`         | `4.26.0` (dev/Metro y apps sin pin) · `5.0.0-alpha.3` (`mutualfam-mobile`, APK release) |
| `react-native-gesture-handler` | `~2.32.0`       |

---

## 6. Checklist de Entrega Final
- [ ] `npm ls react-native` no muestra líneas con `invalid` (o borraste las locales).
- [ ] `npx expo@57 start --clear` arranca sin warnings de versión.
- [ ] `.env` tiene la IP LAN correcta.
- [ ] `app.json` tiene `sdkVersion: "57.0.0"` explícito.
- [ ] `index.js` usa `registerRootComponent` local.
