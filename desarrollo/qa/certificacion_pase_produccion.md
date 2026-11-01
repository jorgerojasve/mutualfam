# Certificación y Automatización de Pruebas en QA (Previa a Producción)

**Fecha de Certificación:** 30 de Octubre de 2026  
**Entorno Evaluado:** QA (`https://mutualfam-qa-backend.fly.dev/api/v1`)  
**Versión de Software QA:** `1.0.32` (`v1.0.32-qa`)  
**Tasa de Éxito Automatizada:** **100.0% (38/38 Pruebas Superadas)**

---

## 1. Resumen Ejecutivo

Como requisito previo obligatorio para la promoción a Producción, se implementó y ejecutó una **suite integral de pruebas automatizadas End-to-End (E2E)** que valida de punta a punta todas las funcionalidades críticas, reglas de negocio, límites de capacidad y mecanismos de seguridad de MutualFam.

La suite automatizada resolvió y certificó los hallazgos recientes del equipo de QA, incluyendo:
1. **Blindaje de Invitaciones Únicas (Incidente QA):** Rechazo estricto con `HTTP 400` ante cualquier intento de reutilización de códigos de invitación.
2. **Cumplimiento de la Regla 1 de Mutuales:** Control de creación bootstrap y límite estricto de máximo 1 mutual adicional para miembros de la primera mutual (`HTTP 403`).
3. **Cumplimiento de la Regla 2 de Capacidad:** Bloqueo automático con `HTTP 409` (`LIMIT_MEMBERS`) cuando una mutual alcanza su cupo máximo.
4. **Ciclo Completo de Préstamos en Dos Monedas (USD / VES):** Solicitud, validación de métodos venezolanos (Pago Móvil / Transferencia), aporte, verificación de recepción, devolución y verificación de saldo total (`status: repaid`).
5. **Motor de Recordatorios Preventivos:** Disparo y cálculo de alertas push para fechas de devolución.

---

## 2. Herramientas y Ejecución de la Suite

La automatización fue desarrollada en JavaScript estándar (Node.js nativo sin dependencias externas pesadas) utilizando `assert/strict` y la API nativa `fetch`.

### Formas de Ejecución:

1. **Vía script bash directo:**
   ```bash
   ./scripts/run_qa_tests.sh
   ```

2. **Vía npm monorepo (carpeta `civiccore`):**
   ```bash
   npm run test:qa
   ```

3. **Con parámetros personalizados o modo detallado:**
   ```bash
   ./scripts/run_qa_tests.sh --verbose --target=https://mutualfam-qa-backend.fly.dev/api/v1
   ```

---

## 3. Matriz Detallada de Pruebas y Resultados

| # | Módulo Funcional | Pruebas Ejecutadas | Resultado | Descripción de la Validación |
|---|---|:---:|:---:|---|
| **0** | **Sandbox Isolation** | 1 | ✔ Aprobado | Reinicio seguro de base de datos sandbox para pruebas reproducibles desde cero (`POST /sandbox/reset-all`). |
| **1** | **Configuración Global y Entorno** | 4 | ✔ Aprobado | Verificación de endpoint `/config/`, tasas BCV activas, bancos venezolanos autorizados, límites globales y fase Beta en QA. |
| **2** | **Autenticación, JWT y Sesión** | 7 | ✔ Aprobado | Registro de usuarios, rechazo de emails duplicados (`HTTP 400`), login con credenciales válidas/inválidas (`HTTP 401`), rotación con refresh token (`POST /auth/refresh`), perfiles y registro de push tokens. |
| **3** | **Creación de Mutuales (Regla 1)** | 4 | ✔ Aprobado | Creación bootstrap de la primera mutual, creación de la 2da mutual autorizada, y bloqueo con `HTTP 403` a usuarios que intentan exceder el límite o crear sin pertenecer a la primera mutual. |
| **4** | **Invitaciones Únicas y Anti-Duplicados** | 8 | ✔ Aprobado | Generación de token alfanumérico único (8 caracteres), consulta pública, unión del primer invitado, idempotencia si ya es miembro, y **rechazo con `HTTP 400` ante invitaciones ya utilizadas**. |
| **5** | **Métodos de Pago Venezolanos** | 3 | ✔ Aprobado | Rechazo de solicitud de préstamo si el usuario no tiene métodos configurados (`HTTP 400`). Configuración exitosa de Pago Móvil y Transferencia Bancaria (Banesco 0134, Banco de Venezuela 0102, Mercantil 0105). |
| **6** | **Ciclo Completo de Préstamos** | 8 | ✔ Aprobado | Creación de solicitud con fecha estimada y métodos de pago; fondeo del 100% por aportante; notificación de transferencia; verificación de recepción por prestatario; notificación de devolución; verificación de devolución por aportante; transición automática a `repaid`; y ejecución del motor de recordatorios (`POST /loans/check-reminders`). |
| **7** | **Límite de Capacidad (Regla 2)** | 2 | ✔ Aprobado | Adición de miembros hasta alcanzar el límite máximo de la mutual (5 en QA) y bloqueo con `HTTP 409` (`LIMIT_MEMBERS`) ante cualquier nuevo intento de invitación. |
| **8** | **Guardrails de Seguridad** | 1 | ✔ Aprobado | Bloqueo controlado de endpoints en desarrollo (`POST /funds/`) con `HTTP 400` y respuesta estructurada. |
| **TOTAL** | **8 Módulos Funcionales** | **38** | **100% OK** | **Aprobación unánime de todas las aserciones.** |

---

## 4. Evidencia de Ejecución Exitosa

```text
====================================================================
   🧪 MUTUALFAM - SUITE DE PRUEBAS AUTOMATIZADAS QA (PRE-PRODUCCIÓN)  
====================================================================
Objetivo:  https://mutualfam-qa-backend.fly.dev/api/v1
Modo:      E2E End-to-End Suite & Pre-Production Certification

⚙️  FASE 0: Preparación y Limpieza del Entorno Sandbox QA...
   ✔ Base de datos de QA reiniciada a estado limpio (0 organizaciones, 0 usuarios).

▶ MÓDULO 1: Configuración Global, Límites y Entorno QA
  ✔ PASS GET /config/ debe retornar parámetros válidos de QA y tasa BCV activa (478ms)
  ✔ PASS GET /config/limits debe retornar límites y contacto de soporte (299ms)
  ✔ PASS GET /config/phase debe certificar fase Beta en QA (294ms)
  ✔ PASS GET /config/firebase-tester-url debe responder con enlaces de distribución (289ms)

▶ MÓDULO 2: Autenticación, JWT y Manejo de Sesión
  ✔ PASS POST /membership/register registra al Fundador Oficial (Jorge Rojas) (597ms)
  ✔ PASS POST /membership/register rechaza registro duplicado con mismo email (HTTP 400) (299ms)
  ✔ PASS POST /auth/login con credenciales del fundador emite tokens JWT válidos (588ms)
  ✔ PASS POST /auth/login rechaza credenciales incorrectas con HTTP 401 (589ms)
  ✔ PASS POST /auth/refresh emite nuevo access_token con refresh_token válido (882ms)
  ✔ PASS GET /membership/me retorna datos de perfil y organizaciones (290ms)
  ✔ PASS Registrar usuarios adicionales de prueba (Maira, Martín, Nora y Nilso) (5881ms)
  ✔ PASS POST /membership/push-token permite registrar token de notificaciones (299ms)

▶ MÓDULO 3: Creación de Mutuales y Reglas de Límites (Regla 1)
  ✔ PASS Bootstrap: El primer usuario crea la primera mutual (Org 1) (305ms)
  ✔ PASS Regla 1: Miembro de la primera mutual puede crear 1 mutual adicional (Org 2) (306ms)
  ✔ PASS Regla 1: Intentar crear una tercera mutual excede el límite y es bloqueado con HTTP 403 (388ms)
  ✔ PASS Regla 1: Usuario ajeno a la primera mutual es bloqueado con HTTP 403 (298ms)

▶ MÓDULO 4: Invitaciones de Un Solo Uso y Blindaje Anti-Duplicados
  ✔ PASS POST /membership/organizations/{id}/invites genera código alfanumérico único (302ms)
  ✔ PASS GET /membership/invites/{token} retorna información pública de la mutual activa (300ms)
  ✔ PASS Primer usuario (Martín Vieira) se une exitosamente con el código de invitación (304ms)
  ✔ PASS Idempotencia: El mismo usuario que ya pertenece recibe respuesta amigable (293ms)
  ✔ PASS GET /membership/invites/{token} RECHAZA con 400 código ya utilizado (295ms)
  ✔ PASS POST /organizations/join RECHAZA segundo usuario con código duplicado (HTTP 400) (301ms)
  ✔ PASS Unir a Maira Salazar a Org 1 mediante nueva invitación única (601ms)
  ✔ PASS GET /membership/members lista los 3 miembros actuales de Org 1 (300ms)

▶ MÓDULO 5: Métodos de Pago Venezolanos y Validaciones Previas
  ✔ PASS Solicitar préstamo sin métodos de pago debe ser rechazado con HTTP 400 (295ms)
  ✔ PASS Configurar Pago Móvil y Cuenta Bancaria del prestatario (Martín) (660ms)
  ✔ PASS Configurar Pago Móvil de la aportante (Maira) (300ms)

▶ MÓDULO 6: Ciclo Completo de Préstamos (USD/VES, Fondeo y Devolución)
  ✔ PASS POST /loans/ crea solicitud de préstamo en USD con fecha de devolución estimada (796ms)
  ✔ PASS GET /loans/ lista los préstamos de la mutual con métodos de pago adjuntos (299ms)
  ✔ PASS POST /loans/{id}/contribute compromete aporte completo ($25) por Maira (741ms)
  ✔ PASS POST /loans/contributions/{id}/notify_payment aportante notifica transferencia (774ms)
  ✔ PASS POST /loans/contributions/{id}/verify_payment prestatario confirma recepción (1041ms)
  ✔ PASS POST /loans/contributions/{id}/repay prestatario realiza devolución del préstamo (755ms)
  ✔ PASS POST /loans/repayments/{id}/verify aportante verifica devolución y salda préstamo (4483ms)
  ✔ PASS POST /loans/check-reminders ejecuta motor de recordatorios de vencimiento (297ms)

▶ MÓDULO 7: Regla de Capacidad Máxima de Miembros (Regla 2)
  ✔ PASS Llenar la mutual Org 1 hasta el cupo máximo de 5 miembros en QA (1496ms)
  ✔ PASS Intentar emitir invitación cuando la mutual está llena debe ser bloqueado con HTTP 409 (299ms)

▶ MÓDULO 8: Guardrails de Seguridad y Módulos en Desarrollo
  ✔ PASS POST /funds/ responde con control seguro de funcionalidad en desarrollo (438ms)

====================================================================
               📊 REPORTE DE RESULTADOS DE PRUEBAS QA               
====================================================================

Total Pruebas Ejecutadas: 38
Pruebas Superadas:        38
Pruebas Fallidas:         0
Tasa de Éxito:            100.0%

🎉 ¡TODAS LAS FUNCIONALIDADES EN QA FUERON CERTIFICADAS EXITOSAMENTE (100%)!
✔ El entorno de QA cumple con todos los criterios de aceptación para el pase a Producción.
```

---

## 5. Checklist de Pre-Vuelo para el Pase a Producción

- [x] **Suite Automatizada:** Ejecutada con 100% de éxito contra el backend en la nube.
- [x] **Control de Duplicados:** Validado rechazo con `HTTP 400` y mensaje explicativo al usuario.
- [x] **Agradecimientos de Beta:** Incluidos Nora Salazar y Nilso Rafael Salazar en web y mobile.
- [x] **Límites de Creación:** Regla 1 operativa (1 mutual extra solo para fundadores de la primera mutual).
- [x] **Límites de Capacidad:** Regla 2 operativa (`HTTP 409` cuando se llena la mutual).
- [x] **Manejo Bimoneda:** Selector interactivo USD / Bs. VES, tasa BCV y memoria de preferencia.
- [x] **Identidad Visual QA vs Prod:** Indicadores visuales claros para evitar confusión operativa.
- [ ] **Paso Final:** Promoción de variables y despliegue del release de producción.
