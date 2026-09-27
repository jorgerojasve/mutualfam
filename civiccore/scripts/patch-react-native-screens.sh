#!/bin/bash
# patch-react-native-screens.sh
# Fixes CodegenTypes namespace usage in react-native-screens@4.26.0 fabric components
# that's incompatible with @react-native/codegen@0.86.3 parser
#
# Run before Android build (eas-build-pre-install hook)

set -e

# Find react-native-screens in node_modules (works in both monorepo and standalone)
SCREENS_DIR=""
if [ -d "node_modules/react-native-screens" ]; then
  SCREENS_DIR="node_modules/react-native-screens"
elif [ -d "../node_modules/react-native-screens" ]; then
  SCREENS_DIR="../node_modules/react-native-screens"
elif [ -d "../../node_modules/react-native-screens" ]; then
  SCREENS_DIR="../../node_modules/react-native-screens"
fi

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

FILES=(
  "FullWindowOverlayNativeComponent.ts"
  "ModalScreenNativeComponent.ts"
  "ScreenNativeComponent.ts"
  "ScreenStackHeaderConfigNativeComponent.ts"
  "ScreenStackHeaderSubviewNativeComponent.ts"
  "ScreenStackNativeComponent.ts"
  "SearchBarNativeComponent.ts"
)

for f in "${FILES[@]}"; do
  FILE_PATH="$FABRIC_DIR/$f"
  if [ ! -f "$FILE_PATH" ]; then
    echo "[patch-screens]   Skipping $f (not found)"
    continue
  fi

  # Replace CT.WithDefault<Type, Default> with Type | null | undefined
  perl -i -0pe 's/CT\.WithDefault<\s*\n?\s*([^,>\n]+),\s*\n?\s*[^>\n]*\n?\s*>/\1 | null | undefined/g' "$FILE_PATH"
  
  # Replace other CT.* types with plain types
  sed -i 's/CT\.Int32/Int32/g' "$FILE_PATH"
  sed -i 's/CT\.Float/Float/g' "$FILE_PATH"
  sed -i 's/CT\.Double/Double/g' "$FILE_PATH"
  sed -i 's/CT\.UnsafeMixed/UnsafeMixed/g' "$FILE_PATH"
  sed -i 's/CT\.BubblingEventHandler/BubblingEventHandler/g' "$FILE_PATH"
  sed -i 's/CT\.DirectEventHandler/DirectEventHandler/g' "$FILE_PATH"
  
  # Fix the import line: replace 'CodegenTypes as CT, ' with ''
  # and add Int32, Float, Double, UnsafeMixed if not already present
  sed -i 's/import type { CodegenTypes as CT, \(.*\) } from '"'"'react-native'"'"';/import type { \1, Int32, Float, Double, UnsafeMixed } from '"'"'react-native'"'"';/' "$FILE_PATH"
  
  echo "[patch-screens]   Patched $f"
done

echo "[patch-screens] Done."
