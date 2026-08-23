# MutualSol

> Aplicación de mutual solidaria de crédito para trabajadores. **Open Source, operada 100% por los socios.**

## 🌟 Filosofía

- Todas las operaciones se expresan y almacenan en **USD** (usando la tasa BCV oficial).
- Créditos solidarios con tasas mínimas (solo para sostenimiento operativo).
- **Mercado Solidario**: Los socios pueden intercambiar bienes y servicios en especie.
- Gobernanza democrática: los socios votan las decisiones clave.

## 📁 Estructura del Proyecto

```
mutual/
├── backend/          # API FastAPI + PostgreSQL
│   ├── app/
│   │   ├── api/          # Endpoints REST
│   │   ├── core/         # Base de datos, seguridad
│   │   ├── models/       # Modelos SQLAlchemy
│   │   ├── schemas/      # Modelos Pydantic (validación)
│   │   └── services/     # Lógica de negocio
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/         # App Android (React Native/Expo)
│   └── src/
│       ├── screens/
│       ├── components/
│       ├── services/     # Llamadas a la API
│       └── store/        # Estado global
├── docs/             # Documentación y actas
├── docker-compose.yml
└── README.md
```

## 🚀 Inicio Rápido (Desarrollo)

### Prerrequisitos
- Docker y Docker Compose
- Node.js 20+ (para el frontend)
- Expo CLI: `npm install -g expo-cli`

### Backend (API + Base de datos)
```bash
# Copiar variables de entorno
cp backend/.env.example backend/.env
# Editar .env con tus valores

# Levantar todo con Docker
docker-compose up -d

# La API estará disponible en:
# http://localhost:8000
# Documentación: http://localhost:8000/docs
```

### Frontend (App Android)
```bash
cd frontend
npm install
npx expo start
# Escanear el QR con la app Expo Go en el teléfono Android
```

## 🔑 Variables de Entorno Importantes

Ver `backend/.env.example` para la lista completa.

## 📜 Licencia

Este software es **libre y de código abierto** bajo la licencia **GPL-3.0**.
Propiedad colectiva de los socios de MutualSol.
