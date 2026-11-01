# Estrategia para iPhone (iOS) a Costo Cero ($0 USD)

> **Premisa obligatoria:** No se pagará la cuenta de Apple Developer Program ($99 USD/año). Toda la solución debe operar al **100% sin costos adicionales**, sin tarjetas ni suscripciones.

---

## 1. La realidad técnica de Apple sin cuenta de desarrollador

En el ecosistema Apple, a diferencia de Android (donde cualquier persona puede descargar e instalar un archivo `.apk` libremente), **Apple no permite instalar archivos de aplicaciones nativas compiladas (`.ipa`) directamente desde la web ni por WhatsApp sin una firma criptográfica autorizada**.

Existen únicamente dos formas de ejecutar código en un iPhone **sin pagar a Apple**:
1. **A través de la Web (PWA / Web App en Safari):** Totalmente libre, sin censura ni aprobaciones de Apple.
2. **A través de un contenedor ya aprobado en la App Store (Expo Go):** Permite correr proyectos de React Native/Expo instalando una app gratuita de la App Store.
3. *(Descartado) Sideloading con Apple ID gratuito (AltStore):* Exige conectar el iPhone por cable a una computadora cada 7 días para renovar la firma, lo que resulta inviable y frustrante para un familiar.

---

## 2. Comparativa de Alternativas a Costo $0

| Criterio | Opción 1: Web App / PWA (Safari) ⭐ *(Recomendada)* | Opción 2: Expo Go (Nativo gratuito) | Opción 3: Sideloading (AltStore) |
|---|---|---|---|
| **Costo** | **$0 USD** | **$0 USD** | **$0 USD** |
| **Cuenta Apple** | No requiere nada | Solo cuenta normal para descargar de App Store | Cuenta iCloud + PC obligatoria |
| **Experiencia en iPhone** | Se añade a la pantalla de inicio con su ícono oficial. Abre a pantalla completa sin barras de navegador. | Corre dentro de la app oficial "Expo Go" de la App Store. | App nativa instalada en el escritorio. |
| **Caducidad** | **Nunca caduca.** Actualizaciones instantáneas en Vercel. | No caduca mientras el SDK de Expo sea compatible. | **Caduca cada 7 días.** Requiere PC semanalmente. |
| **Comprobantes y Fotos** | Funciona (sube fotos y capturas desde la fototeca o cámara). | Funciona nativo. | Funciona nativo. |
| **Facilidad para el familiar** | **Muy alta:** Solo abrir Safari y tocar "Agregar a inicio". | **Media:** Debe instalar primero Expo Go y escanear QR / abrir enlace. | **Muy baja:** Exige pasos técnicos avanzados. |

---

## 3. La Solución Recomendada: PWA Adaptada para iPhone

La plataforma ya cuenta con [`mutualfam-web`](file:///home/caracas2025/Documentos/mutual-qa/civiccore/apps/mutualfam-web) desplegada y operativa en producción (`https://mutualfam.vercel.app`), que ya incluye los módulos de préstamos, autenticación, invitaciones y fondos.

Al aprovechar la tecnología **PWA (Progressive Web App)** de Safari en iOS:
1. El usuario de iPhone no descarga un APK (que no le serviría).
2. Abre la landing de invitación en Safari.
3. Con 2 toques pulsa: **Compartir (⎋) → "Agregar a pantalla de inicio"**.
4. En el escritorio de su iPhone se crea el ícono oficial de **Mutual Familiar** con fondo oscuro.
5. Al abrirlo, se comporta visualmente como una aplicación independiente (sin la barra de direcciones de Safari).
6. Puede iniciar sesión, unirse con su código, solicitar préstamos, confirmar transferencias y subir comprobantes.

---

## 4. Adaptación de la Página de Descarga ([InviteLanding.jsx](file:///home/caracas2025/Documentos/mutual-qa/civiccore/apps/mutualfam-web/src/pages/Auth/InviteLanding.jsx))

Actualmente la página asume que todos los visitantes son Android y les ofrece el APK. La propuesta es incorporar **detección automática del dispositivo**:

### A. Si el visitante entra desde un iPhone o iPad (iOS):
* **Ocultar el botón del APK:** Evita la frustración de descargar un archivo inservible.
* **Mostrar botón principal de acceso:**  
  `📲 Abrir Mutual Familiar en iPhone` (lleva directamente a registrarse o unirse con el token).
* **Guía visual interactiva de 2 pasos para instalarla en la pantalla de inicio:**
  1. *"Toca el botón Compartir de Safari (el ícono de la cajita con la flecha ⎋ en la barra inferior)."*
  2. *"Desliza hacia abajo y selecciona **Agregar a pantalla de inicio**."*
  3. *"¡Listo! Ya tienes Mutual Familiar como una app en tu iPhone."*

### B. Si el visitante entra desde Android:
* Mantiene exactamente el flujo actual optimizado: **"Descargar MutualFam (APK)"** con sus 4 pasos.

### C. Si entra desde una computadora:
* Muestra dos botones claros:
  - `📱 Descargar para Android (APK)`
  - `🌐 Usar Versión Web (iPhone / PC)`

---

## 5. Adaptación para la Presentación y Asamblea ([presentacion](file:///home/caracas2025/Documentos/mutual-qa/desarrollo/beta/presentacion))

En la **Lámina 11 (Pasos para Instalar y Comenzar)** y en el guión del orador:
* Explicar de forma natural y transparente:
  > *"Si tienes Android, te enviamos el instalador APK directo por WhatsApp.  
  > Si tienes iPhone, abres el mismo enlace en Safari y tocas **'Agregar a pantalla de inicio'** para tenerla instalada al instante en tu teléfono sin pasar por la App Store."*

---

## 6. Próximos pasos a ejecutar
1. Ajustar los metadatos PWA en [`mutualfam-web`](file:///home/caracas2025/Documentos/mutual-qa/civiccore/apps/mutualfam-web) (`apple-touch-icon`, `apple-mobile-web-app-capable`, `manifest.json`) para que al guardarla en el iPhone luzca impecable.
2. Implementar la detección de iPhone en [`InviteLanding.jsx`](file:///home/caracas2025/Documentos/mutual-qa/civiccore/apps/mutualfam-web/src/pages/Auth/InviteLanding.jsx) con el flujo diferenciado.
3. Actualizar la lámina 11 en [`laminas_presentacion.html`](file:///home/caracas2025/Documentos/mutual-qa/desarrollo/beta/laminas_presentacion.html) y el dossier [`presentacion`](file:///home/caracas2025/Documentos/mutual-qa/desarrollo/beta/presentacion).
