FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema requeridas
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements y entorno
COPY civiccore/backend/requirements.txt /app/requirements.txt

# Como civiccore se instala en modo editable (-e) en requirements, necesitamos quitar el "-e" para producción 
# o copiar el código de civiccore también.
# Vamos a instalar las dependencias normalmente:
RUN grep -v "\-e " /app/requirements.txt > /app/req_prod.txt && pip install --no-cache-dir -r /app/req_prod.txt

# Copiar el código del framework civiccore
COPY civiccore/backend /civiccore_backend
RUN pip install --no-cache-dir /civiccore_backend

# Copiar la aplicación
COPY civiccore/apps/mutualfam /app

# Crear el directorio para la base de datos (volumen)
RUN mkdir -p /app/data

ENV DATABASE_URL="sqlite:////app/data/mutualfam.db"
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
