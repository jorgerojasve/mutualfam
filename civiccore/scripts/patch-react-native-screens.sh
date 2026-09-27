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

# ===========================================================================
# Patch expo-modules-core (nested inside expo/node_modules/) for RN 0.79.2.
#
# Problem: React Native 0.79.2 changed the `Promise` interface signatures from
#   reject(code: String?, ...) -> reject(code: String, ...)  (non-nullable code)
# expo-modules-core's `Promise.kt` (inside expo/node_modules/) still uses the
# old nullable `code: String?` signatures which fail to compile against RN 0.79.2.
#
# We fix this by patching only the `object : com.facebook.react.bridge.Promise {}`
# implementation block inside `Promise.kt` (lines that say `override fun reject`).
# We must NOT touch the `expo.modules.kotlin.Promise` interface itself which uses String?.
# ===========================================================================
echo "[patch-expo] Patching expo-modules-core for React Native 0.79.2 Promise compatibility..."

# Find all expo-modules-core nested inside expo/node_modules/
for EXPO_CORE_DIR in $(find . -type d -name "expo-modules-core" -path "*/expo/node_modules/*" 2>/dev/null); do
  PROMISE_FILE="$EXPO_CORE_DIR/android/src/main/java/expo/modules/kotlin/Promise.kt"
  KWRAPPER_FILE="$EXPO_CORE_DIR/android/src/main/java/expo/modules/kotlin/KPromiseWrapper.kt"

  if [ -f "$PROMISE_FILE" ]; then
    # Fix the bridge Promise implementation: nullable -> non-nullable for the
    # `override fun reject` methods that implement com.facebook.react.bridge.Promise
    # (these are the ones inside the `object : com.facebook.react.bridge.Promise` block)
    # RN 0.79.2 signature: reject(code: String, message: String?)  (no ? on code)
    sed -i 's/override fun reject(code: String?, message: String?)/override fun reject(code: String, message: String?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, throwable: Throwable?)/override fun reject(code: String, throwable: Throwable?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, message: String?, throwable: Throwable?)/override fun reject(code: String, message: String?, throwable: Throwable?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, userInfo: WritableMap)/override fun reject(code: String, userInfo: WritableMap)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap)/override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, message: String?, userInfo: WritableMap)/override fun reject(code: String, message: String?, userInfo: WritableMap)/g' "$PROMISE_FILE"
    # The last overload still accepts String? per RN 0.79.2 spec, keep as is.
    echo "[patch-expo] Patched Promise.kt in $EXPO_CORE_DIR"
  fi

  if [ -f "$KWRAPPER_FILE" ]; then
    # KPromiseWrapper.reject(code: String?, message: String?, cause: Throwable?) calls
    # bridgePromise.reject(code, message, cause) but bridge expects code: String.
    # Fix: pass `code ?: "E_UNKNOWN"` to bridge.
    sed -i 's/bridgePromise\.reject(code, message, cause)/bridgePromise.reject(code ?: "E_UNKNOWN", message, cause)/g' "$KWRAPPER_FILE"
    echo "[patch-expo] Patched KPromiseWrapper.kt in $EXPO_CORE_DIR"
  fi
done

echo "[patch] Done."
