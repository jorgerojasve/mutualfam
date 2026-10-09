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
echo "=> Levantando la aplicación: $APP_NAME"
echo ""

# Detener los contenedores anteriores por si acaso
docker compose down

# Levantar la aplicación seleccionada
docker compose up -d

echo ""
echo "¡Listo! La API de $APP_NAME estará disponible en http://localhost:8000"
echo "Para ver los logs, ejecuta: docker compose logs -f"
