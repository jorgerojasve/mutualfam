# Arquitectura del Sistema: MutualSol & CivicCore

Este documento ilustra la arquitectura de alto nivel de MutualSol, destacando cómo la aplicación cliente se construye sobre el framework subyacente de CivicCore.

## Diagrama de Interacciones

```mermaid
graph TD
    %% Definición de Usuarios
    Socio[👥 Socio / Miembro]
    Admin[👔 Junta Directiva / Comité]

    %% Frontend: Aplicaciones Cliente
    subgraph Frontend ["Capa de Presentación (MutualSol)"]
        AppMobile["📱 App Móvil (React Native / Expo)"]
        AppWeb["💻 Dashboard Web (React / Vite)"]
    end

    %% SDK de Conexión
    SDK["🔌 CivicCore SDK (JavaScript)"]

    %% Backend: Aplicación Específica
    subgraph BackendApp ["Capa de Aplicación (FastAPI)"]
        MutualSolAPI["⚙️ mutualsol-api (app.py)"]
        SystemConfig["⚙️ Configuración & Terminología"]
    end

    %% Backend: Framework Base
    subgraph CivicCore ["Framework Base (CivicCore)"]
        AuthMod["🔒 Módulo: Auth"]
        MembershipMod["👤 Módulo: Membership"]
        GovMod["⚖️ Módulo: Governance"]
        PayMod["💰 Módulo: Payments"]
        MarketMod["🛒 Módulo: Marketplace"]
    end

    %% Base de Datos
    DB[("🗄️ Base de Datos SQLite")]

    %% Relaciones y Flujos de Datos
    Socio -->|Usa| AppMobile
    Admin -->|Administra| AppWeb
    Socio -->|Usa| AppWeb

    AppMobile <-->|Llamadas API| SDK
    AppWeb <-->|Llamadas API| SDK

    SDK <-->|HTTP / REST| MutualSolAPI

    MutualSolAPI -->|Carga| SystemConfig
    
    %% Forzar que CivicCore esté debajo de BackendApp enlazando componentes directamente
    MutualSolAPI -->|Instancia| AuthMod
    MutualSolAPI -->|Instancia| MembershipMod
    MutualSolAPI -->|Instancia| GovMod
    MutualSolAPI -->|Instancia| PayMod
    MutualSolAPI -->|Instancia| MarketMod

    AuthMod <--> DB
    MembershipMod <--> DB
    GovMod <--> DB
    PayMod <--> DB
    MarketMod <--> DB

    classDef user fill:#3b82f6,stroke:#1e3a8a,stroke-width:2px,color:#fff;
    classDef frontend fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff;
    classDef sdk fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff;
    classDef app fill:#8b5cf6,stroke:#4c1d95,stroke-width:2px,color:#fff;
    classDef core fill:#6366f1,stroke:#3730a3,stroke-width:2px,color:#fff;
    classDef db fill:#ef4444,stroke:#991b1b,stroke-width:2px,color:#fff;

    class Socio,Admin user;
    class AppMobile,AppWeb frontend;
    class SDK sdk;
    class MutualSolAPI,SystemConfig app;
    class AuthMod,MembershipMod,GovMod,PayMod,MarketMod core;
    class DB db;
```

## Componentes Principales

1. **Capa de Presentación (Frontend):**
   - **App Móvil (React Native):** Orientada a la experiencia del socio individual (solicitar créditos, votar en asambleas, realizar aportes, ver su mercado).
   - **Dashboard Web (React):** Orientada a la administración y comités (aprobar créditos, revisar configuración de salida/fusión, ver estadísticas globales).

2. **Capa de Comunicación:**
   - **CivicCore SDK:** Un paquete centralizado de JavaScript (`api.js`) que contiene todas las funciones de red (`fetch`). Garantiza que tanto la App como la Web se comuniquen con el backend usando las mismas reglas y endpoints.

3. **Capa de Aplicación (Backend de Instancia):**
   - **mutualsol-api (`app.py`):** Es la implementación específica para MutualSol. Aquí se define la personalización de la organización (ej. terminología de UI) y se importan los módulos genéricos que se requieran.

4. **Framework Base (CivicCore):**
   - **Módulos Independientes:** El corazón del sistema. Cada módulo (`auth`, `membership`, `governance`, `payments`, etc.) es agnóstico y contiene su propia lógica de negocios, modelos de base de datos (`models.py`), esquemas Pydantic y rutas (`router.py`). MutualSol solo "enciende" los que necesita.

5. **Capa de Persistencia:**
   - **Base de Datos (SQLite):** Almacena todo el estado de la aplicación. Utiliza SQLAlchemy como ORM.
