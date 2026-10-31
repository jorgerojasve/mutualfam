#!/usr/bin/env bash
# ==============================================================================
# Script de Ejecución de Pruebas Automatizadas QA - MutualFam
# ==============================================================================
# Uso:
#   ./scripts/run_qa_tests.sh
#   ./scripts/run_qa_tests.sh --verbose
#   ./scripts/run_qa_tests.sh --target=https://mutualfam-qa-backend.fly.dev/api/v1
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Iniciando Suite Automatizada de Pruebas en QA (MutualFam)..."
node "$SCRIPT_DIR/qa_test_suite.mjs" "$@"
