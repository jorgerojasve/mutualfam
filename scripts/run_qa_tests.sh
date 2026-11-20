#!/usr/bin/env bash
# ==============================================================================
# Script de Ejecución Segura de Pruebas Automatizadas QA - MutualFam
# ==============================================================================
# Uso:
#   ./scripts/run_qa_tests.sh
#   ./scripts/run_qa_tests.sh --verbose
#   ./scripts/run_qa_tests.sh --target=https://mutualfam-qa-backend.fly.dev/api/v1
#   ./scripts/run_qa_tests.sh --keep-state  # Omite la restauración automática final
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

KEEP_STATE=false
TARGET_URL=""

for arg in "$@"; do
  case $arg in
    --keep-state|--no-restore)
      KEEP_STATE=true
      ;;
    --target=*)
      TARGET_URL="${arg#*=}"
      ;;
  esac
done

echo "===================================================================="
echo " 🧪 MUTUALFAM - EJECUCIÓN SEGURA DE PRUEBAS AUTOMATIZADAS"
echo "===================================================================="

# 1. Respaldo local preventivo si el objetivo es QA remoto (o por defecto)
if [ "$KEEP_STATE" != "true" ] && { [ -z "$TARGET_URL" ] || [[ "$TARGET_URL" == *"mutualfam-qa-backend"* ]]; }; then
  echo "🛡️  Generando respaldo local preventivo de QA previo a las pruebas..."
  "$SCRIPT_DIR/backup_prod_db.sh" --env=qa || echo "⚠️ Aviso: No se pudo generar respaldo local previo; continuando con snapshot en servidor..."
fi

# 2. Ejecutar la suite de pruebas (qa_test_suite.mjs captura snapshot y restituye al finalizar)
node "$SCRIPT_DIR/qa_test_suite.mjs" "$@"
