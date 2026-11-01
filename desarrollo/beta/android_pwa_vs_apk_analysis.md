# Android: ¿APK nativa o Web App (PWA) como en iPhone?

> **Contexto:** Hoy Android usa una APK (Expo SDK 57 / React Native 0.86) distribuida por GitHub Releases + Firebase App Distribution, e iPhone usa la versión web ([`mutualfam-web`](file:///home/caracas2025/Documentos/mutual-qa/civiccore/apps/mutualfam-web)) agregada a la pantalla de inicio. Cada cambio en Android exige compilar (~15 min en CI), publicar, y que cada familiar descargue, pase la verificación de Play Protect e instale.

---

## 1. Hallazgos en el código actual (punto de partida)

| Aspecto | Estado actual | Implicación |
|---|---|---|
| Manifest PWA (`manifest.webmanifest`) | ❌ No existe (solo metas `apple-*` en [index.html](file:///home/caracas2025/Documentos/mutual-qa/civiccore/apps/mutualfam-web/index.html)) | Hoy la web es un “acceso directo”, no una PWA instalable en Android. |
| Service Worker | ❌ No existe | Sin caché offline ni notificaciones web. |
| Push del backend | Solo **Expo Push** ([notifications.py](file:///home/caracas2025/Documentos/mutual-qa/civiccore/apps/mutualfam/services/notifications.py)) | ⚠️ **Los usuarios de iPhone hoy no reciben ningún push**, incluidos los recordatorios de devolución recién implementados. |
| Funciones nativas usadas en la APK | Notificaciones, cámara/galería (comprobantes), portapapeles, compartir, enlaces de invitación | Todas tienen equivalente web (ver §4), con matices. |
| Paridad visual web vs. móvil | Pendiente ([homologar](file:///home/caracas2025/Documentos/mutual-qa/desarrollo/iOS/homologar): falta el botón “Datos” en Préstamos) | Prerrequisito para cualquier migración. |

---

## 2. Tendencias 2026–2027 que cambian la ecuación

1. **Verificación obligatoria de desarrolladores para sideloading (Google).** Desde el 30-sep-2026 aplica en Brasil, Indonesia, Singapur y Tailandia; **en 2027 se extiende globalmente** a toda APK instalada en dispositivos Android certificados, incluso la descargada por WhatsApp/web. Habrá que registrar identidad y nombre de paquete en el *Android Developer Console* (o el usuario deberá pasar por un “flujo avanzado” de advertencias). **Una PWA no está sujeta a esto.**
2. **Chrome deja atrás los equipos viejos, pero no los rompe.** Chrome 139+ requiere Android 10; en Android 8/9 queda congelado en Chrome 138 (y en Android 7 en Chrome 119). Esas versiones **ya soportan** todo lo que necesitamos: instalación PWA (WebAPK), Service Workers, Web Push, Web Share y selección de imágenes.
3. **La APK también excluye equipos legacy.** Las versiones recientes de Expo/React Native exigen Android 7.0 (API 24) como mínimo, y cada actualización de SDK tiende a subir ese piso. Una PWA ligera puede llegar incluso a equipos que la APK ya no soporta.
4. **Web Push ya es universal:** Android/Chrome desde hace años e iPhone desde iOS 16.4 (cuando la web está agregada a la pantalla de inicio). Una sola implementación cubre a ambos.
5. **Las actualizaciones “over-the-air” (OTA) son ahora estándar** en apps Expo (`expo-updates`): permiten cambiar el JavaScript sin reinstalar la APK. Es la alternativa si se decide conservar la app nativa.

---

## 3. Pros y contras de una PWA en Android

### ✅ Ventajas
- **Actualización instantánea:** cada `git push` se refleja en todos los teléfonos al reabrir la app. Cero compilaciones de APK, cero reinstalaciones, cero “versión vieja” en manos de un familiar.
- **Instalación en 2 toques:** el usuario abre el enlace de invitación → Chrome ofrece **“Instalar app”** → aparece el ícono en el escritorio y en el cajón de apps (WebAPK), sin “orígenes desconocidos” ni alertas de Play Protect.
- **Inmune a la verificación de desarrolladores de 2027** y a bloqueos de antivirus/Play Protect sobre APKs no firmadas por tiendas.
- **Liviana para equipos legacy:** pocos MB de almacenamiento (vs. ~50–80 MB de una APK de React Native) y menos datos móviles por actualización (importante con planes de datos limitados).
- **Un solo código para iPhone, Android y PC:** se elimina el trabajo de homologar dos interfaces (el problema actual del botón “Datos”).
- **Push para iPhone “de regalo”:** al implementar Web Push, los recordatorios de devolución llegan también a iOS.

### ❌ Desventajas y riesgos
- **Requiere trabajo previo:** manifest, Service Worker, **Web Push en el backend** (claves VAPID, nueva tabla/tipo de suscripción) y la paridad visual completa con la app móvil.
- **Push algo menos predecible en algunos fabricantes:** Xiaomi, Huawei/Honor, Tecno/Infinix aplican ahorro de batería agresivo que puede retrasar notificaciones de Chrome (también afecta a la APK, pero un poco menos).
- **Equipos sin Google Play Services** (Huawei recientes): sin Web Push vía Chrome. Ya hoy tampoco reciben el push de Expo, así que no es una pérdida nueva.
- **Portapapeles automático limitado:** la web no puede leer el portapapeles sin un toque del usuario; la detección automática del código de invitación pasaría a ser un botón “Pegar código”.
- **Dependencia de la conexión al abrir por primera vez** y caché que debe gestionarse bien para no mostrar versiones obsoletas (lo resuelve un Service Worker con estrategia *network-first*).
- **Equipos congelados en Chrome viejo** no reciben parches de seguridad del navegador; para una app financiera conviene mostrar un aviso suave si el navegador es muy antiguo.
- **Percepción:** algunos usuarios asocian “app de verdad” con APK/Play Store. Se mitiga con el ícono propio, pantalla completa y splash.

---

## 4. Paridad funcional (APK → Web)

| Función | APK hoy | Equivalente web en Android | Riesgo |
|---|---|---|---|
| Notificaciones push / recordatorios | Expo Push (FCM) | Web Push + Service Worker | Medio (requiere backend) |
| Foto del comprobante | `expo-image-picker` | `<input type="file" accept="image/*" capture>` | Bajo |
| Compartir invitación por WhatsApp | `Share` nativo | Web Share API (`navigator.share`) | Bajo |
| Copiar datos de pago | `expo-clipboard` | `navigator.clipboard.writeText` | Bajo |
| Detectar código desde portapapeles | Automático | Botón “Pegar” (gesto del usuario) | Bajo (cambio de UX) |
| Abrir enlaces de invitación en la app | Deep link `mutualfam://` | Captura de enlaces en el *scope* de la PWA instalada | Bajo |
| Aviso de nueva versión | Comparación con GitHub Releases | Innecesario (siempre actualizada) | — |
| Uso sin conexión | Parcial | Service Worker (lectura de datos en caché) | Medio |

---

## 5. Alternativas evaluadas

| Opción | Qué es | Elimina recompilar | Elimina reinstalar | Afectada por verificación 2027 | Esfuerzo |
|---|---|:---:|:---:|:---:|:---:|
| **A. APK + OTA** (`expo-updates`, servidor propio o EAS Update) | Se conserva la app nativa; los cambios de JS llegan solos | Parcial (solo cambios nativos) | ✅ (salvo cambios nativos) | ❌ Sí | Bajo |
| **B. PWA pura** ⭐ | La misma web de iPhone, instalable en Android | ✅ | ✅ | ✅ No | Medio |
| **C. TWA** (Trusted Web Activity / Bubblewrap) | APK “envoltorio” que muestra la PWA | ✅ (contenido) | ✅ (contenido) | ❌ Sí | Medio |
| **D. Transición gradual** ⭐ | PWA como opción principal, APK en mantenimiento y luego retirada | ✅ | ✅ | ✅ No (al retirar APK) | Medio |

---

## 6. Recomendación

**Opción D: transición gradual hacia PWA como plataforma única**, porque:
1. Resuelve de raíz el ciclo compilar → descargar → verificar → instalar.
2. Evita el problema regulatorio de 2027 con las APK sideloaded.
3. Llega a **más** equipos legacy que la APK actual.
4. Unifica iPhone y Android y, de paso, lleva los recordatorios push a iPhone.

> [!IMPORTANT]
> La condición crítica es **Web Push funcionando y probado** antes de pedirle a nadie que deje la APK, ya que los recordatorios de devolución dependen 100% del push del celular.

### Hoja de ruta propuesta
1. **Fase 1 – PWA real:** `manifest.webmanifest` (íconos 192/512, `display: standalone`, colores por entorno QA/Prod), Service Worker con `vite-plugin-pwa` (*network-first* para la API), y botón “Instalar app” en [InviteLanding.jsx](file:///home/caracas2025/Documentos/mutual-qa/civiccore/apps/mutualfam-web/src/pages/Auth/InviteLanding.jsx) usando `beforeinstallprompt`.
2. **Fase 2 – Web Push:** claves VAPID, endpoint de suscripción, y `notify_users` enviando tanto a Expo (APK) como a Web Push (Android/iPhone) en paralelo.
3. **Fase 3 – Paridad:** cerrar las diferencias de interfaz (botón “Datos”, etc.) y agregar casos de la PWA a la [suite QA](file:///home/caracas2025/Documentos/mutual-qa/scripts/qa_test_suite.mjs).
4. **Fase 4 – Piloto en QA:** usuarios beta con equipos variados (incluyendo Android 8/9 y un Xiaomi/Tecno) validan instalación, push y subida de comprobantes.
5. **Fase 5 – Convivencia:** la landing ofrece PWA como opción principal y APK como alternativa; la APK solo recibe correcciones críticas.
6. **Fase 6 – Retiro de la APK** antes de que la verificación de desarrolladores llegue a Venezuela.

### Decisiones pendientes
- ¿Se acepta perder la detección automática del código desde el portapapeles (pasa a botón “Pegar”)?
- ¿Se mantiene la APK indefinidamente como respaldo, o se fija una fecha de retiro?
- Si se prefiere no migrar, ¿se implementa al menos la **Opción A (OTA)** para dejar de reinstalar en cada cambio?
