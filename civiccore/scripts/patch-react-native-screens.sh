#!/bin/bash
# patch-react-native-screens.sh
# Fixes CodegenTypes namespace usage in react-native-screens@4.26.0 fabric components
# that's incompatible with @react-native/codegen@0.86.3 parser
#
# Run before Android build (eas-build-pre-install hook)

set -e

# Find react-native-screens in node_modules (works in both monorepo and standalone)
SCREENS_DIR=$(find . -type d -path "*/node_modules/react-native-screens" -prune | head -n 1)

if [ -z "$SCREENS_DIR" ]; then
  echo "[patch-screens] WARNING: react-native-screens not found, skipping patch"
  exit 0
fi

FABRIC_DIR="$SCREENS_DIR/src/fabric"

if [ ! -d "$FABRIC_DIR" ]; then
  echo "[patch-screens] WARNING: fabric directory not found at $FABRIC_DIR, skipping"
  exit 0
fi

echo "[patch-screens] Patching $FABRIC_DIR to fix CodegenTypes namespace..."

# Find all .ts files in FABRIC_DIR recursively
while IFS= read -r FILE_PATH; do
  if [ -z "$FILE_PATH" ]; then continue; fi
  f=$(basename "$FILE_PATH")

  # Remove CT. prefix from WithDefault so Codegen 0.86 recognizes them
  # and string enums can maintain their default values
  sed -i 's/CT\.WithDefault/WithDefault/g' "$FILE_PATH"
  
  # Replace React.ComponentRef with React.ElementRef because older RN codegen (like 0.79.2) 
  # strictly expects React.ElementRef and throws if it sees React.ComponentRef
  sed -i 's/React\.ComponentRef/React.ElementRef/g' "$FILE_PATH"
  
  # Replace other CT.* types with plain types
  sed -i 's/CT\.Int32/Int32/g' "$FILE_PATH"
  sed -i 's/CT\.Float/Float/g' "$FILE_PATH"
  sed -i 's/CT\.Double/Double/g' "$FILE_PATH"
  sed -i 's/CT\.UnsafeMixed/UnsafeMixed/g' "$FILE_PATH"
  sed -i 's/CT\.BubblingEventHandler/BubblingEventHandler/g' "$FILE_PATH"
  sed -i 's/CT\.DirectEventHandler/DirectEventHandler/g' "$FILE_PATH"
  
  # Fix the import line: replace 'CodegenTypes as CT, ' with ''
  # and add WithDefault, Int32, Float, Double, UnsafeMixed if not already present
  sed -i 's/import type { CodegenTypes as CT, \(.*\) } from '"'"'react-native'"'"';/import type { \1, WithDefault, Int32, Float, Double, UnsafeMixed } from '"'"'react-native'"'"';/' "$FILE_PATH"
  
  echo "[patch-screens]   Patched $f"
done <<< "$(find "$FABRIC_DIR" -type f \( -name "*.ts" -o -name "*.tsx" \))"

echo "[patch-screens] Done with react-native-screens."


echo "[patch] Done."

