# Plan de Desarrollo: Aplicación de Mutual de Crédito

## Visión y Alcance

**Misión a corto plazo**: Crear una plataforma de mutual de crédito para compañeros de trabajo en empresas del Estado venezolano, facilitando el acceso a crédito de forma solidaria, transparente y sin intermediarios bancarios tradicionales.

**Visión estratégica**: Escalar el modelo hacia una red de mutuales interconectadas que potencien iniciativas de socialismo democrático a nivel regional y global, articuladas con economías solidarias y cooperativas.

---

## 1. Marco Legal Venezolano

### Figuras jurídicas aplicables

| Figura | Base Legal | Ventajas | Limitaciones |
|--------|-----------|----------|-------------|
| **Asociación Civil** | Código Civil, Art. 19 | Fácil constitución, no paga ISLR si sin fines de lucro | No puede captar ahorro del público |
| **Cooperativa de Ahorro y Crédito** | Ley Especial de Asociaciones Cooperativas (2001) | Exoneración de ISLR, IGTF preferencial, apoyo SUNACOOP | Requiere 5+ socios fundadores, auditoría anual |
| **Fondo de Ahorro** | Art. 538 LOTTT | Reconocimiento laboral, deducible nómina | Atado a la empresa, menor autonomía |
| **Caja de Ahorro** | Ley de Cajas de Ahorro, Fondos de Ahorro y Similares (2010) | Regulación clara, protección legal de afiliados | Supervisada por SUDECA, mayor carga regulatoria |

> [!IMPORTANT]
> **Recomendación legal para el prototipo**: Constituir como **Cooperativa de Ahorro y Crédito** bajo SUNACOOP. Esto permite:
> - Exoneración del ISLR (Ley de ISLR, Art. 14, numeral 11)
> - Acceso a fondos del Fondo Nacional de Cooperativas (FONCOOP)
> - Marco legal para operaciones de crédito entre socios
> - Descuentos de nómina como mecanismo de cobro (Convenio con RRHH de la empresa)

### Consideraciones fiscales y cambiarias

- **IGTF**: Las cooperativas pagan tasa reducida (0.5% vs 3% general) en transacciones financieras
- **Divisas**: Operar en bolívares para el prototipo. Para criptomonedas, ampararse en el **Decreto Constituyente sobre Criptoactivos y la Criptomoneda Soberana Petro (2018)** — Venezuela es uno de los pocos países con marco legal explícito para cripto
- **SUDEBAN**: Las cooperativas de ahorro y crédito NO son supervisadas por SUDEBAN si no captan del público general, lo que simplifica enormemente la regulación inicial
- **Ley Antimonopolio y Competencia Desleal**: No aplica a cooperativas sin fines de lucro

---

## 2. Análisis de Apps Existentes: Lecciones de Cashea y similares

### Cashea (Venezuela)
| Aspecto | Cashea | Nuestra Mutual |
|---------|--------|---------------|
| **Modelo** | Fintech privada, BNPL (Buy Now Pay Later) | Cooperativa solidaria |
| **Tasa de interés** | Alta (cubre riesgo + ganancia) | Baja/nula (solo costos operativos) |
| **Colateral** | Score crediticio digital | Membresía y garantía solidaria del grupo |
| **Cobertura** | Comercios afiliados | Libre destino del crédito |
| **Transparencia** | Opaca (algoritmo privado) | Abierta (gobernanza democrática) |
| **Disponibilidad offline** | Requiere internet constante | ✅ Modo offline para zonas con baja conectividad |
| **Morosidad** | Consecuencia individual | Gestión colectiva (presión social positiva) |

### Pros de apps como Cashea a replicar:
- UX simple y onboarding rápido
- Descuento automático de cuotas
- Historial crediticio digital

### Contras a evitar:
- Tasas opacas y comisiones ocultas
- Dependencia de un tercero privado
- Sin participación del usuario en la gobernanza
- Datos personales en servidores externos

---

## 3. Arquitectura Técnica

### Principio rector: **Máxima soberanía tecnológica**

```
┌─────────────────────────────────────────────────────┐
│                   CLIENTES                          │
│  Android APK  │  Web PWA  │  SMS fallback           │
└──────────────────────────────────────────────────────┘
                        │
                  [Red Local / VPN]
                        │
┌──────────────────────────────────────────────────────┐
│              SERVIDOR LOCAL (On-premise)             │
│  Raspberry Pi 5 / Mini PC en sede de la empresa      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  API     │  │  Core    │  │  Base de datos     │ │
│  │  FastAPI │  │  Negocio │  │  PostgreSQL        │ │
│  │  REST    │  │  Python  │  │  + SQLite offline  │ │
│  └──────────┘  └──────────┘  └────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Blockchain local (opcional): Hyperledger    │   │
│  │  Fabric o Ganache para trazabilidad          │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
                        │
              [Solo si hay conectividad]
                        │
┌──────────────────────────────────────────────────────┐
│           INTEGRACIONES EXTERNAS (OPCIONALES)        │
│  Binance P2P API  │  Tron/USDT  │  Lightning Network │
└──────────────────────────────────────────────────────┘
```

### Stack tecnológico recomendado

**Backend:**
- **Python + FastAPI** — Ecosistema maduro, fácil de mantener localmente
- **PostgreSQL** — Base de datos principal
- **SQLite** — Sincronización offline en dispositivos
- **Celery + Redis** — Tareas asíncronas (recordatorios de pago, cálculo de intereses)

**Frontend:**
- **React Native (Expo)** — App Android (prioridad) + iOS futura
- **PWA (Next.js)** — Acceso web sin instalación
- **Modo offline-first**: Service Workers + IndexedDB para zonas sin conectividad

**Infraestructura:**
- **Servidor local en sede**: Raspberry Pi 5 (~$80) o mini PC con Ubuntu Server
- **VPN WireGuard**: Para acceso remoto seguro de administradores
- **Backup cifrado**: Exportación semanal a USB + opcionalmente a nube privada (Nextcloud)

---

## 4. Módulos Funcionales del Prototipo (MVP)

### Módulo 1: Gestión de Socios
- [ ] Registro con CI, cargo, empresa, antigüedad
- [ ] Verificación por RRHH (flujo de aprobación)
- [ ] Perfil de socio con historial
- [ ] Sistema de score solidario (basado en historial de pagos + participación)

### Módulo 2: Fondo Común de Ahorro
- [ ] Aporte mensual configurable (% del salario o monto fijo)
- [ ] Visualización en tiempo real del fondo acumulado
- [ ] Cálculo automático de rendimiento (interés sobre ahorros)
- [ ] Protección anti-inflación: conversión referencial a USD o USDT

### Módulo 3: Créditos
- [ ] Solicitud de crédito con monto, plazo y destino
- [ ] Comité de aprobación (votación de 3 socios delegados)
- [ ] Cálculo de cuotas con interés solidario (1-3% mensual, solo cubre gastos)
- [ ] Descuento automático de nómina (integración con sistema de RRHH)
- [ ] Alerta de mora y gestión de reestructuración

### Módulo 4: Gobernanza Democrática
- [ ] Asamblea virtual (votaciones en app)
- [ ] Propuestas de modificación de estatutos
- [ ] Elección de directiva
- [ ] Libro de actas digital

### Módulo 5: Reportes y Transparencia
- [ ] Dashboard financiero en tiempo real
- [ ] Reporte de estados financieros (balance, flujo de caja)
- [ ] Exportación a PDF para SUNACOOP/SUDECA
- [ ] Auditoría de operaciones (inmutable)

---

## 5. Servicios Financieros Adicionales

Más allá del crédito, estos servicios aumentan el valor y la retención:

### 5.1 Microseguros Mutuales
- **Seguro de vida mínimo**: Fondo de contingencia financiado por aportaciones
- **Seguro de desempleo**: Si un socio es despedido, el fondo le subsidia cuotas por 3 meses
- **Seguro médico colectivo**: Negociación grupal con clínicas locales

### 5.2 Remesas y Pagos
- Envío de remesas a familiares en el exterior usando USDT/USDC como puente (legal bajo decreto cripto venezolano)
- Pago de servicios públicos (Corpoelec, CANTV, Hidroven) desde la app
- Integración con Pago Móvil interbancario venezolano

### 5.3 Marketplace Solidario
- Los socios pueden publicar bienes y servicios
- Pagos con créditos de la mutual o criptomonedas
- Fomenta economía circular dentro de la comunidad

### 5.4 Inversión Colectiva
- **Proyectos productivos**: Socios votan invertir el excedente del fondo en proyectos cooperativos (huerto urbano, transporte colectivo, etc.)
- **Bonos de ahorro a plazo**: El socio bloquea ahorro por 6-12 meses a mayor rendimiento

### 5.5 Educación Financiera
- Módulo de cursos cortos (finanzas personales, cooperativismo, cripto básico)
- Gamificación: insignias y beneficios por completar cursos
- Incentiva el uso responsable del crédito

---

## 6. Integración con Criptomonedas

> [!NOTE]
> Venezuela cuenta con el **Decreto Constituyente sobre Criptoactivos (2018)** que legaliza explícitamente el uso de criptomonedas en transacciones comerciales, incluyendo USDT como moneda de cuenta.

### Estrategia cripto de 3 capas:

**Capa 1 — Reserva de valor (Inmediato)**
- Mantener un porcentaje del fondo en **USDT (Tron TRC-20)** como cobertura anti-inflación
- Sin envío a Binance: uso de wallets custodiales locales (opciones: BTCPay Server auto-alojado, o custodio de confianza)

**Capa 2 — Pagos P2P (3-6 meses)**
- Integración con **Binance Pay API** para:
  - Recibir aportes en cripto de socios en el exterior
  - Disbursement de créditos en USDT si el socio lo prefiere
- Uso de **Lightning Network (Bitcoin)** para micropagos instantáneos sin comisión

**Capa 3 — DeFi Cooperativo (12+ meses)**
- Explorar **Celo blockchain** (diseñada para cooperativas y pagos móviles)
- Smart contracts para gobernanza de votaciones (transparencia criptográfica)
- Posible tokenización de la membresía (token no especulativo, solo funcional)

### Exchanges a considerar:
| Exchange | Pro | Contra |
|----------|-----|--------|
| **Binance P2P** | Alta liquidez VES/USDT | KYC puede ser barrera |
| **LocalBitcoins/Hodl Hodl** | P2P sin KYC | Menor volumen |
| **Reserve (RSV)** | Diseñado para Venezuela | Menor integración |
| **Celo/MiniPay** | Cooperativas, África y LatAm | Menor adopción en VE |

---

## 7. Modelos de Negocio

La cooperativa debe ser autosustentable. Estas son las fuentes de ingreso:

### Modelo A — Spread de Tasa (Principal)
- Los ahorros rinden 1% mensual a socios
- Los créditos cobran 3% mensual
- El diferencial (2%) cubre gastos operativos

**Proyección (50 socios, $500 promedio en fondo):**
- Fondo total: $25,000
- Cartera de créditos: $20,000
- Ingreso mensual por spread: $400
- Gastos operativos estimados: $200-300/mes ✅ Sostenible

### Modelo B — Membresía Escalonada
- **Básico** (gratis): Acceso a créditos pequeños (hasta 1x ahorro)
- **Solidario** ($2/mes): Créditos hasta 3x ahorro + microseguro básico
- **Fundador** ($5/mes): Acceso total + voto en gobernanza + dividendos del excedente

### Modelo C — Servicios para Empresas
- Ofrecer el software como servicio a otras cooperativas o fondos de ahorro empresariales
- Precio: $0.50/socio/mes para grupos de 50+ personas
- Esto escala el impacto sin comprometer la misión

### Modelo D — Comisiones por Servicios Cripto
- 0.5% de comisión en conversiones VES↔USDT facilitadas por la plataforma
- Fondo recauda y redistribuye como excedente

> [!TIP]
> **Combinación recomendada para el prototipo**: Modelo A + Membresía Básica gratuita. Esto maximiza la adopción inicial. Introducir membresías pagadas en la fase 2 cuando haya masa crítica.

---

## 8. Roadmap de Desarrollo

### Fase 0 — Fundación Legal (Mes 1-2)
- [ ] Constitución de la cooperativa ante SUNACOOP
- [ ] Apertura de cuenta bancaria cooperativa
- [ ] Redacción de estatutos y reglamento de crédito
- [ ] Acuerdo de descuento de nómina con RRHH de empresa piloto

### Fase 1 — MVP (Mes 2-5)
- [ ] Servidor local configurado (Raspberry Pi 5 + Ubuntu Server)
- [ ] Backend: Módulos de Socios, Ahorro y Crédito básico
- [ ] App Android (APK distribuida por WhatsApp/QR)
- [ ] Piloto con 10-20 socios fundadores
- [ ] Dashboard de administración web

### Fase 2 — Consolidación (Mes 6-10)
- [ ] Módulo de Gobernanza y Asamblea Virtual
- [ ] Integración con Pago Móvil venezolano
- [ ] Microseguros mutuales básicos
- [ ] Integración cripto (USDT TRC-20 para reserva)
- [ ] Expansión a 50-200 socios

### Fase 3 — Escalado (Mes 11-18)
- [ ] Multi-tenant: soporte para múltiples mutuales
- [ ] Marketplace Solidario
- [ ] Integración Binance Pay
- [ ] App iOS
- [ ] Federación con otras cooperativas

### Fase 4 — Visión Global (18+ meses)
- [ ] Internacionalización (es, en, fr, pt)
- [ ] Smart contracts en Celo para gobernanza
- [ ] Red de mutuales interconectadas
- [ ] Open source y modelo de franquicia social

---

## 9. Gestión de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Alta inflación erosiona el fondo | Alta | Alto | Reserva en USDT, indexación a tasa BCV |
| Mora de socios | Media | Alto | Descuento nómina automático, garantías solidarias |
| Falla del servidor local | Media | Alto | Backup cifrado, segundo servidor espejo |
| Cambio regulatorio | Baja | Alto | Estructura cooperativa es la más resiliente legalmente |
| Baja adopción inicial | Media | Medio | Campaña interna, beneficio tangible desde el día 1 |
| Ataques a seguridad | Baja | Alto | Cifrado end-to-end, servidor en intranet |

---

## 10. Comparativa de Decisiones de Diseño

### ¿Por qué servidor local vs nube?
- **Soberanía de datos**: Los datos de los socios no salen de la organización
- **Costo**: Un Raspberry Pi 5 (~$80) vs $50-200/mes en AWS/GCP
- **Conectividad venezolana**: La app funciona en intranet aunque no haya internet
- **Confianza**: Los socios saben que sus datos están en su propio servidor

### ¿Por qué cooperativa vs app fintech?
- Las fintechs necesitan licencia bancaria (SUDEBAN) — proceso costoso y lento
- La cooperativa opera bajo SUNACOOP — más simple y con incentivos fiscales
- El modelo cooperativo alinea incentivos: los usuarios son dueños

---

## Preguntas Abiertas para Definir

> [!IMPORTANT]
> Antes de iniciar el desarrollo, responder:
> 1. ¿Cuál es la empresa estatal objetivo para el piloto? (Esto define las integraciones de RRHH necesarias)
> 2. ¿Cuántos socios fundadores están disponibles para el lanzamiento?
> 3. ¿Existe ya algún fondo de ahorro o caja de ahorro en la empresa que se deba integrar o reemplazar?
> 4. ¿Hay preferencia por Android específicamente, o también se necesita iOS/web?
> 5. ¿Se desea código abierto desde el inicio o primero privado y luego abierto?
> 6. ¿Cuál es el presupuesto estimado para el hardware del servidor local?
