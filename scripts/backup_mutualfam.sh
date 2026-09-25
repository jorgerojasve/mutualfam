#!/bin/bash
# Descarga la BD SQLite del volumen de Fly.io a la máquina local

set -e

BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

DATE_STR=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mutualfam_$DATE_STR.db"

echo "Iniciando respaldo desde Fly.io..."
# Asume que la app de fly.io se llamará mutualfam-api
flyctl ssh sftp get /data/mutualfam.db "$BACKUP_FILE" -a mutualfam-api

echo "Respaldo completado exitosamente en: $BACKUP_FILE"
