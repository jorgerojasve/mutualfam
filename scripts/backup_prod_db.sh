#!/usr/bin/env bash
# ==============================================================================
# MutualFam - Script Automatizado de Respaldo de Base de Datos (Fly.io)
# ==============================================================================
# Uso:
#   ./scripts/backup_prod_db.sh [--env=prod|qa] [--app=nombre-app]
#
# Descripción:
#   1. Valida autenticación en Fly.io vía flyctl.
#   2. Conecta por SFTP seguro y descarga /app/data/mutualfam.db.
#   3. Ejecuta SQLite PRAGMA integrity_check para certificar consistencia.
#   4. Almacena en ./backups/ con marca de tiempo y enlace latest.db.
# ==============================================================================

set -eo pipefail

APP_NAME="mutualfam-backend"
ENV_LABEL="PRODUCCIÓN"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Procesar argumentos opcionales
for arg in "$@"; do
  case $arg in
    --env=qa)
      APP_NAME="mutualfam-qa-backend"
      ENV_LABEL="QA"
      shift
      ;;
    --env=prod)
      APP_NAME="mutualfam-backend"
      ENV_LABEL="PRODUCCIÓN"
      shift
      ;;
    --app=*)
      APP_NAME="${arg#*=}"
      shift
      ;;
  esac
done

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TARGET_FILE="$BACKUP_DIR/${APP_NAME}_${TIMESTAMP}.db"
LATEST_LINK="$BACKUP_DIR/${APP_NAME}_latest.db"

echo "===================================================================="
echo " 🛡️  MUTUALFAM - RESPALDO AUTOMATIZADO DE BASE DE DATOS"
echo "===================================================================="
echo " Entorno objetivo:   $ENV_LABEL"
echo " Aplicación Fly.io:  $APP_NAME"
echo " Destino local:      $TARGET_FILE"
echo "===================================================================="

# 1. Validar comando flyctl y sesión activa
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

# 2. Asegurar directorio de respaldos
mkdir -p "$BACKUP_DIR"

# 3. Descarga vía SFTP seguro de Fly.io
echo "⬇️  Descargando /app/data/mutualfam.db desde $APP_NAME..."
flyctl ssh sftp get /app/data/mutualfam.db "$TARGET_FILE" -a "$APP_NAME"

if [ ! -f "$TARGET_FILE" ]; then
  echo "❌ Error: No se pudo generar el archivo de respaldo."
  exit 1
fi

FILE_SIZE=$(du -h "$TARGET_FILE" | cut -f1)
echo "✔ Archivo descargado exitosamente ($FILE_SIZE)."

# 4. Verificación de integridad SQLite
echo "🧪 Validando integridad de base de datos..."
if command -v sqlite3 &> /dev/null; then
  CHECK_RESULT=$(sqlite3 "$TARGET_FILE" "PRAGMA integrity_check;" 2>&1 || true)
  if [ "$CHECK_RESULT" = "ok" ]; then
    echo "✔ Integridad certificada: $CHECK_RESULT"
  else
    echo "⚠️  ADVERTENCIA: La verificación de integridad retornó: $CHECK_RESULT"
    exit 2
  fi
else
  echo "⚠️  Aviso: sqlite3 CLI no instalado localmente, no se pudo ejecutar PRAGMA integrity_check."
fi

# 5. Actualizar copia/enlace latest
cp -f "$TARGET_FILE" "$LATEST_LINK"
echo "✔ Copia más reciente actualizada en: $LATEST_LINK"

echo "===================================================================="
echo " 🎉 ¡RESPALDO COMPLETADO SATISFACTORIAMENTE!"
echo " Archivo: $TARGET_FILE ($FILE_SIZE)"
echo "===================================================================="
