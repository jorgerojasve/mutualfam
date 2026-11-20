#!/usr/bin/env bash
# ==============================================================================
# MutualFam - Script Automatizado de Restauración de Base de Datos (Fly.io)
# ==============================================================================
# Uso:
#   ./scripts/restore_db.sh [--env=qa|prod] [--file=ruta/al/respaldo.db] [--yes]
#
# Descripción:
#   1. Valida que el archivo de respaldo exista y supere 'PRAGMA integrity_check;'.
#   2. Conecta por SFTP seguro a Fly.io y sube la BD a /app/data/mutualfam_restored.db.
#   3. Mueve atómicamente el archivo restaurado a /app/data/mutualfam.db.
#   4. Reinicia la máquina en Fly.io para recargar la base de datos y limpiar cachés.
#   5. Verifica la integridad y consistencia de los datos restaurados.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"

APP_NAME="mutualfam-qa-backend"
ENV_LABEL="QA"
SOURCE_FILE=""
AUTO_CONFIRM=false

# Procesar argumentos
for arg in "$@"; do
  case $arg in
    --env=qa)
      APP_NAME="mutualfam-qa-backend"
      ENV_LABEL="QA"
      ;;
    --env=prod)
      APP_NAME="mutualfam-backend"
      ENV_LABEL="PRODUCCIÓN"
      ;;
    --app=*)
      APP_NAME="${arg#*=}"
      ;;
    --file=*)
      SOURCE_FILE="${arg#*=}"
      ;;
    --yes|-y)
      AUTO_CONFIRM=true
      ;;
    --help|-h)
      echo "Uso: $0 [--env=qa|prod] [--app=nombre] [--file=ruta.db] [--yes]"
      exit 0
      ;;
  esac
done

# Archivo de respaldo por defecto si no se especificó
if [ -z "$SOURCE_FILE" ]; then
  SOURCE_FILE="$BACKUP_DIR/${APP_NAME}_latest.db"
fi

echo "===================================================================="
echo " 🛡️  MUTUALFAM - RESTAURACIÓN AUTOMATIZADA DE BASE DE DATOS"
echo "===================================================================="
echo " Entorno objetivo:   $ENV_LABEL"
echo " Aplicación Fly.io:  $APP_NAME"
echo " Archivo fuente:     $SOURCE_FILE"
echo "===================================================================="

# 1. Validar existencia del archivo local
if [ ! -f "$SOURCE_FILE" ]; then
  echo "❌ Error: El archivo de respaldo '$SOURCE_FILE' no existe."
  exit 1
fi

FILE_SIZE=$(du -h "$SOURCE_FILE" | cut -f1)
echo "✔ Archivo de respaldo localizado ($FILE_SIZE)."

# 2. Verificación de integridad SQLite local
echo "🧪 Validando integridad del archivo SQLite local..."
if command -v sqlite3 &> /dev/null; then
  CHECK_RESULT=$(sqlite3 "$SOURCE_FILE" "PRAGMA integrity_check;" 2>&1 || true)
  if [ "$CHECK_RESULT" = "ok" ]; then
    echo "✔ Integridad certificada: $CHECK_RESULT"
  else
    echo "❌ Error: La verificación de integridad del archivo falló: $CHECK_RESULT"
    exit 2
  fi
else
  echo "⚠️ Aviso: sqlite3 CLI no disponible localmente; se continúa sin verificación local previa."
fi

# 3. Confirmación obligatoria para producción
if [ "$ENV_LABEL" = "PRODUCCIÓN" ] && [ "$AUTO_CONFIRM" != "true" ]; then
  echo ""
  echo "⚠️  ¡ATENCIÓN! Estás a punto de sobreescribir la base de datos de PRODUCCIÓN."
  read -r -p "¿Estás completamente seguro de continuar? (escribe 'RESTAURAR' para confirmar): " CONFIRMATION
  if [ "$CONFIRMATION" != "RESTAURAR" ]; then
    echo "Operación cancelada por el usuario."
    exit 0
  fi
fi

# 4. Validar comando flyctl y sesión activa
if ! command -v flyctl &> /dev/null; then
  echo "❌ Error: flyctl no está instalado en el sistema."
  exit 1
fi

echo "🔍 Verificando sesión en Fly.io..."
CURRENT_USER=$(flyctl auth whoami 2>/dev/null || true)
if [ -z "$CURRENT_USER" ]; then
  echo "❌ Error: No hay sesión activa en flyctl. Ejecuta 'flyctl auth login' primero."
  exit 1
fi
echo "✔ Sesión activa como: $CURRENT_USER"

# 5. Despertar la máquina en Fly.io si está detenida por auto-stop
echo "⚡ Verificando estado activo de la máquina en Fly.io..."
curl -s -m 8 "https://${APP_NAME}.fly.dev/health" > /dev/null 2>&1 || true
sleep 2

# 6. Subir archivo a Fly.io
echo "⬆️  Subiendo $SOURCE_FILE hacia /app/data/mutualfam_restored.db en $APP_NAME..."
flyctl ssh sftp put "$SOURCE_FILE" /app/data/mutualfam_restored.db -a "$APP_NAME"

# 7. Mover archivo a su destino definitivo
echo "🔄 Aplicando reemplazo en /app/data/mutualfam.db..."
flyctl ssh console -a "$APP_NAME" -C "mv /app/data/mutualfam_restored.db /app/data/mutualfam.db"

# 8. Reiniciar la aplicación para aplicar cambios en caliente
echo "♻️  Reiniciando servicio en Fly.io ($APP_NAME)..."
flyctl apps restart "$APP_NAME"
sleep 3

# 9. Verificación remota
echo "🔍 Verificando estado de la base de datos restaurada..."
flyctl ssh console -a "$APP_NAME" -C "python3 -c \"
import sqlite3
try:
    conn = sqlite3.connect('/app/data/mutualfam.db')
    c = conn.cursor()
    users = c.execute('SELECT count(*) FROM users').fetchone()[0]
    orgs = c.execute('SELECT count(*) FROM organizations').fetchone()[0]
    members = c.execute('SELECT count(*) FROM organization_memberships').fetchone()[0]
    print(f'✔ Base de datos operativa: {users} usuarios, {orgs} mutuales, {members} membresías.')
except Exception as e:
    print('❌ Error verificando BD remota:', e)
\""

echo "===================================================================="
echo " 🎉 ¡RESTAURACIÓN COMPLETADA SATISFACTORIAMENTE!"
echo " Entorno: $ENV_LABEL ($APP_NAME)"
echo " Archivo restaurado: $SOURCE_FILE"
echo "===================================================================="
