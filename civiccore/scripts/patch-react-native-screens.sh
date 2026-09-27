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

  # Remove CT. prefix from WithDefault so Codegen 0.86 recognizes them
  # and string enums can maintain their default values
  sed -i 's/CT\.WithDefault/WithDefault/g' "$FILE_PATH"
  
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
done

echo "[patch-screens] Done with react-native-screens."

echo "[patch-expo] Patching expo-modules-core for React Native 0.86 Promise compatibility..."
EXPO_CORE_DIR=$(find . -type d -path "*/node_modules/expo-modules-core" -prune | head -n 1)

# Fallback: check inside expo module if not hoisted
if [ -z "$EXPO_CORE_DIR" ]; then
  EXPO_CORE_DIR=$(find . -type d -path "*/node_modules/expo/node_modules/expo-modules-core" -prune | head -n 1)
fi

if [ -n "$EXPO_CORE_DIR" ]; then
  PROMISE_FILE="$EXPO_CORE_DIR/android/src/main/java/expo/modules/kotlin/Promise.kt"
  KWRAPPER_FILE="$EXPO_CORE_DIR/android/src/main/java/expo/modules/kotlin/KPromiseWrapper.kt"

  if [ -f "$PROMISE_FILE" ]; then
    # React Native 0.86 removed the nullable `code: String?` from Promise.reject and made it `code: String`
    sed -i 's/override fun reject(code: String?, message: String?)/override fun reject(code: String, message: String?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, throwable: Throwable?)/override fun reject(code: String, throwable: Throwable?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, message: String?, throwable: Throwable?)/override fun reject(code: String, message: String?, throwable: Throwable?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, userInfo: WritableMap)/override fun reject(code: String, userInfo: WritableMap)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap)/override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, message: String?, userInfo: WritableMap)/override fun reject(code: String, message: String?, userInfo: WritableMap)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, message: String?, throwable: Throwable?, userInfo: WritableMap?)/override fun reject(code: String, message: String?, throwable: Throwable?, userInfo: WritableMap?)/g' "$PROMISE_FILE"
    
    # We also need to fix the calls to `expoPromise.reject` where `code` is passed, but it's okay because inside they handle String?.
    # Wait, in the body of `reject(code: String...)`, `code` is no longer nullable, which is fine since `expoPromise.reject` takes `String?`.
    echo "[patch-expo] Patched Promise.kt"
  fi

  if [ -f "$KWRAPPER_FILE" ]; then
    # In KPromiseWrapper, `bridgePromise.reject(code, message, cause)` is called with `code` which is `String?`.
    # Change `bridgePromise.reject(code, message, cause)` to `bridgePromise.reject(code ?: "E_UNKNOWN_ERROR", message, cause)`
    sed -i 's/bridgePromise.reject(code, message, cause)/bridgePromise.reject(code ?: "E_UNKNOWN_ERROR", message, cause)/g' "$KWRAPPER_FILE"
    echo "[patch-expo] Patched KPromiseWrapper.kt"
  fi
else
  echo "[patch-expo] WARNING: expo-modules-core not found, skipping patch"
fi

echo "[patch] Done."

