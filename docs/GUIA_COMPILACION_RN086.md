# Guía de Compilación y Troubleshooting: React Native 0.86.3 / Expo SDK 57 (New Architecture)

Esta guía documenta las lecciones clave aprendidas durante la estabilización y compilación nativa de las aplicaciones móviles del framework CivicCore (específicamente durante la migración de `mutualfam-mobile`). Sirve como manual de prevención para cualquier otra app móvil que se cree en este ecosistema.

## El Contexto: La "Nueva Arquitectura"
React Native 0.86+ activa por defecto la **Nueva Arquitectura** (incluyendo Fabric para la UI y Bridgeless Mode para la comunicación JS-Nativa). Este salto generacional cambia radicalmente cómo se vinculan las librerías nativas (C++ y JNI), lo que invalida muchas de las soluciones clásicas que solían funcionar en versiones 0.74 e inferiores.

---

## 1. El Peligro del Override de Versiones (Kotlin/Gradle)
**El Error:** `Kotlin 2.0.21 is not supported by Expo modules` o fallos en resolución de Gradle.
**La Causa:** Tradicionalmente se usaba `expo-build-properties` en `app.json` para forzar versiones más nuevas de Kotlin (`kotlinVersion: "2.0.21"`). En SDK 57, los plugins internos (como KSP) están acoplados fuertemente a versiones específicas de Kotlin.
**La Solución:** 
- NUNCA sobrescribir la versión global de Kotlin en `app.json`. 
- Permitir que Expo gestione las versiones nativas en el `prebuild`. Si una librería externa pide una versión más nueva, la librería debe ser actualizada (no el entorno global).

## 2. El Peligro de `./gradlew clean` (El Codegen de C++)
**El Error:** Fallo catastrófico de CMake durante la compilación en release: `add_subdirectory given source .../codegen/jni/ which is not an existing directory.`
**La Causa:** Ejecutar `./gradlew clean` borra implícitamente los archivos C++ autogenerados (Codegen) de librerías de terceros (ej. `async-storage`, `datetimepicker`). Al intentar compilar, CMake no encuentra los enlaces C++ de la Nueva Arquitectura y aborta.
**La Solución:**
- Evitar usar `./gradlew clean` de forma independiente.
- La forma correcta y segura de limpiar el caché nativo es borrar y regenerar la carpeta `android` completa utilizando el empaquetador de Expo:
  ```bash
  npx expo prebuild --platform android --clean
  cd android
  ./gradlew assembleRelease --no-daemon
  ```

## 3. Crash Silencioso Post-Splash (Inicialización Bridgeless)
**El Error:** La app instala bien, muestra el Splash Screen y crashea (se cierra intempestivamente) sin mostrar pantalla roja de error.
**La Causa:** En *Bridgeless mode*, el motor JS (Hermes) es sumamente estricto con el orden de inicialización de los módulos nativos. Librerías complejas como `react-native-gesture-handler` y `react-native-screens` fallan si son invocadas asíncronamente dentro de la jerarquía de componentes antes de ser declaradas.
**La Solución:**
- En el archivo raíz inamovible (usualmente `index.js`), inyectar estas dos instrucciones **en la línea 1 y 2**:
  ```javascript
  import 'react-native-gesture-handler';
  import { enableScreens } from 'react-native-screens';
  enableScreens();
  ```

## 4. Crash por Deep Linking No Declarado
**El Error:** Crash inmediato en tiempo de ejecución: `AssertionError: Cannot start a new ReactInstance on an invalidated ReactHost` o `Cannot make a deep link into a standalone app with no custom scheme defined`.
**La Causa:** Invocaciones asíncronas a `Linking.createURL('/')` en JavaScript fallarán a nivel de C++ si el sistema operativo Android no tiene un "Intent Filter" registrado para la app.
**La Solución:**
- Nunca olvidar incluir la propiedad `"scheme": "nombredetuapp"` en el `app.json`.
- Si se agrega la propiedad, obligatoriamente se debe ejecutar un `prebuild --clean` para que Expo inyecte el Intent correspondiente en el `AndroidManifest.xml`.

## 5. Librerías Incompatibles con Fabric
**El Error:** `cannot initialize a parameter of type 'facebook::react::UIManager *' with an rvalue of type 'facebook::react::FabricUIManager *'` (Falta método `getFabricUIManagerNotNull`).
**La Causa:** Librerías nativas de Interfaz de Usuario (UI) diseñadas para la vieja arquitectura (Paper) intentan buscar el UIManager tradicional, el cual ya no existe.
**La Solución:**
- Actualizar agresivamente la dependencia a una versión compatible con Fabric.
- Ejemplo: Se tuvo que actualizar `react-native-screens` específicamente a la versión `@5.0.0-alpha.3` la cual incluye los adaptadores de C++ modernos para SDK 57.

## Estrategia de Diagnóstico Recomendada ("Divide y Vencerás")
Si una app del framework colapsa irremediablemente durante el `prebuild`:
1. Crea un proyecto puro de Expo con la misma versión (`npx create-expo-app hello-world`).
2. Instala solo las librerías core nativas.
3. Compila el APK vacío (`assembleRelease`).
4. Si compila, ve migrando la carpeta `src/` por partes. Si falla, el problema no era tu código JavaScript, sino el entorno de compilación de la carpeta original. Renombrar la carpeta limpia y hacerla la oficial es mucho más rápido que debuggear scripts de Gradle rotos.
