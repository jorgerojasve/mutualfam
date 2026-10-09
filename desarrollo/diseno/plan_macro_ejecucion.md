# Plan Macro de Ejecución (MutualSol / CivicCore)

Este documento centraliza todos los frentes de trabajo, sub-planes y estrategias técnicas para el desarrollo de MutualSol sobre el framework CivicCore.

---

## 1. Plan Base de Desarrollo (MVP)
*Basado en `plan_mutual_credito.md`*

**Objetivo:** Desplegar el núcleo de la cooperativa de ahorro y crédito.
- **Fase 1.1:** Migración de la arquitectura monolítica original al framework modular CivicCore. *(Completado ✅)*
- **Fase 1.2:** Implementación del Módulo de Autenticación y Perfil de Socio. *(Completado ✅)*
- **Fase 1.3:** Adaptación del Módulo Nativo `Payments` para soportar Solicitudes de Crédito. *(Completado ✅)*
- **Fase 1.4:** Creación de los módulos locales de `Tasas` y `Mercado`. *(Completado ✅)*

---

## 2. Plan de Ciberseguridad y Red Teaming
*Estrategia de Defensa en Profundidad*

**Objetivo:** Proteger el capital de los socios y los datos sensibles ante vectores de ataque financieros.
- **2.1 Prevención de Condiciones de Carrera (Race Conditions):** Bloqueos de fila de base de datos (`SELECT FOR UPDATE`) implementados en la aprobación de créditos y transacciones. *(Completado ✅)*
- **2.2 Rate Limiting y Anti-Fuerza Bruta:** Middleware en memoria configurado a 20 peticiones/minuto por IP para mitigar ataques DDoS y fuerza bruta en el Login. *(Completado ✅)*
- **2.3 Cabeceras de Seguridad (Helmet):** CSP, XSS-Protection, HSTS implementados. *(Completado ✅)*
- **2.4 Pruebas "Abogado del Diablo":** Ejecución constante de pruebas para romper la integridad transaccional (Fuzzing, suplantación de token). *(En progreso)*
- **2.5 Programa de Bug Bounty (Futuro):** Recompensas comunitarias por descubrimiento de vulnerabilidades en entornos controlados (Staging).

---

## 3. Plan de Herramientas de Desarrollo (DevKit Asistido por IA)
*Integración de automatización y QA en el ciclo de vida*

**Objetivo:** Dotar al framework de herramientas de IA para depuración visual y pruebas automáticas.
- **3.1 Watcher IA (`scripts/watch.py`):** Script pasivo que observa el emulador vía ADB y detecta pantallas rojas de Expo (Redbox), enviándolas a Gemini Vision para proponer correcciones de código en tiempo real. *(Completado ✅)*
- **3.2 Automatización E2E con Maestro (`flows/`):** Pruebas de integración escritas en YAML que simulan el comportamiento humano en la UI (Registro, Login, Solicitud de Crédito). *(Completado ✅)*
- **3.3 Integración CI/CD (Futuro):** Ejecución automática de los flujos YAML en cada commit importante.

---

## 4. Gobernanza Dinámica (Meta-Gobernanza)
*Sistema de dos fases, coalescencia y configuración en tiempo real*

**Objetivo:** Permitir que la asamblea pueda modificar las reglas del sistema mediante propuestas y votaciones.
- **4.1 Módulo de Configuración (`config`):** Variables del sistema modificables mediante votaciones (Smart Contracts). *(Completado ✅)*
- **4.2 Sistema de Dos Fases (Debate + Referendo):** Las propuestas nacen en el foro de debate y pueden ser elevadas a referendo oficial con quórum del 50% de miembros. *(Completado ✅)*
- **4.3 Coalescencia de Propuestas:** Detección de propuestas similares, fusión y citación para evitar fragmentación del voto. *(Completado ✅)*
- **4.4 Foro de Comentarios:** Hilo de discusión por propuesta, habilitado por defecto en fase de debate. *(Completado ✅)*
- **4.5 Selector dinámico de valores:** En propuestas automáticas, variables categóricas (ej. SISTEMA_GOBERNANZA) muestran un selector en lugar de campo de texto libre. *(Completado ✅)*

---

## 5. Sistema de Puntos de Votación (Intensity Voting)
*Mecanismo experimental para medir la intensidad de preferencias en referendos*

**Objetivo:** Ir más allá del voto binario. Cada miembro posee una reserva de *Puntos de Voto* que se renueva periódicamente. Al votar, puede asignar más puntos para señalizar mayor intensidad en su preferencia, con el costo de agotar esa reserva hasta la siguiente renovación. Protege minorías intensas y filtra el voto por inercia.

- **5.1** Modelo `MemberVotingPoints` y columna `points_used` en `Vote`. *(Pendiente)*
- **5.2** `PointsService` con lógica de renovación lazy y configuración de parámetros. *(Pendiente)*
- **5.3** Integración en `cast_vote` y `calculate_proposal_results` soportando fórmula lineal y cuadrática. *(Pendiente)*
- **5.4** UI en `GovernanceScreen`: Saldo visible, slider de puntos en la pantalla de votación. *(Pendiente)*
- **5.5** Welfare Optimization: Multiplicador de impacto de votos (Bonus) para cohortes afectadas directamente. *(Pendiente)*
- **5.6** Nuevas variables de sistema: `PUNTOS_HABILITADOS_REFERENDO`, `PUNTOS_HABILITADOS_DEBATE`, `PUNTOS_POR_MIEMBRO`, `PERIODO_RENOVACION_PUNTOS`, `MAX_PUNTOS_POR_VOTO`, `SISTEMA_PONDERACION_PUNTOS`. *(Pendiente)*
- **5.7** Fase de experimentación con fundadores para ajustar parámetros. *(Futuro)*

---

## 6. Próximos Pasos (Roadmap Inmediato)

1. **Puntos de Votación:** Implementar el plan de la Sección 5.
2. **Panel de Aprobación de Créditos:** Crear la interfaz para el comité revisor (Cambiar estado de `PENDIENTE` a `APROBADO`).
3. **Módulo de Mercado Solidario:** Conectar el frontend a los endpoints del mercado interno.
4. **Despliegue de Prueba (Staging):** Montar la API en un servidor local para que los fundadores instalen el APK.
