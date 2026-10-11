#!/bin/bash

# Este script encuentra todas las aplicaciones backend disponibles
# y te permite seleccionar cuál quieres levantar con Docker Compose.

# Buscar directorios en civiccore/apps que contengan un archivo app.py
APPS=()
for dir in civiccore/apps/*/; do
    if [ -f "${dir}app.py" ]; then
        # Extraer el nombre del directorio
        app_name=$(basename "$dir")
        APPS+=("$app_name")
    fi
done

if [ ${#APPS[@]} -eq 0 ]; then
    echo "No se encontraron aplicaciones con app.py en civiccore/apps/"
    exit 1
fi

echo "=========================================="
echo "    Selector de Aplicación Backend"
echo "=========================================="
echo ""
echo "Aplicaciones disponibles:"
for i in "${!APPS[@]}"; do
    echo "  $((i+1)). ${APPS[$i]}"
done
echo ""

read -p "Selecciona el número de la aplicación a levantar (1-${#APPS[@]}): " choice

# Validar entrada
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#APPS[@]}" ]; then
    echo "Selección inválida. Abortando."
    exit 1
fi

export APP_NAME="${APPS[$((choice-1))]}"

echo ""
echo "=========================================="
echo "    Modo de Ejecución"
echo "=========================================="
echo "  1. Operación Normal (Token 24h, Refresh 7 días)"
echo "  2. Prueba: Expiración de Sesión (Token 1 min, Refresh 0 días)"
echo ""
read -p "Selecciona el modo (1-2) [default: 1]: " mode_choice

ENV_FILE="civiccore/apps/${APP_NAME}/.env"

set_env_var() {
    local file=$1
    local key=$2
    local val=$3
    if grep -q "^${key}=" "$file"; then
        sed -i "s/^${key}=.*/${key}=${val}/" "$file"
    else
        echo "${key}=${val}" >> "$file"
    fi
}

echo ""
if [ "$mode_choice" == "2" ]; then
    echo "=> Configurando entorno para: PRUEBA DE EXPIRACIÓN..."
    set_env_var "$ENV_FILE" "ACCESS_TOKEN_EXPIRE_MINUTES" "1"
    set_env_var "$ENV_FILE" "REFRESH_TOKEN_EXPIRE_DAYS" "0"
else
    echo "=> Configurando entorno para: OPERACIÓN NORMAL..."
    set_env_var "$ENV_FILE" "ACCESS_TOKEN_EXPIRE_MINUTES" "1440"
    set_env_var "$ENV_FILE" "REFRESH_TOKEN_EXPIRE_DAYS" "7"
fi

echo ""
echo "=> Levantando la aplicación: $APP_NAME"
echo ""

# Detener los contenedores anteriores por si acaso
docker compose down

# Levantar la aplicación seleccionada
docker compose up -d

echo ""
echo "¡Listo! La API de $APP_NAME estará disponible en http://localhost:8000"
echo "Para ver los logs, ejecuta: docker compose logs -f"
