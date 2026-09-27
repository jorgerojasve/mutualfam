#!/bin/bash
# patch-react-native-screens.sh
# Fixes CodegenTypes namespace usage in react-native-screens@4.26.0 fabric components
# that's incompatible with @react-native/codegen@0.86.3 parser
#
# Run before Android build (postinstall / eas-build-post-install hook)

set -e

# Find ALL instances of react-native-screens in node_modules
SCREENS_DIRS=$(find . -type d -name "react-native-screens" -path "*/node_modules/react-native-screens" 2>/dev/null)

if [ -z "$SCREENS_DIRS" ]; then
  echo "[patch-screens] WARNING: react-native-screens not found, skipping patch"
  exit 0
fi

# Process each instance
while IFS= read -r SCREENS_DIR; do
  if [ -z "$SCREENS_DIR" ]; then continue; fi
  echo "[patch-screens] Processing: $SCREENS_DIR"

  FABRIC_DIR="$SCREENS_DIR/src/fabric"
  GAMMA_DIR="$SCREENS_DIR/android/src/main/java/com/swmansion/rnscreens/gamma"

  # -------------------------------------------------------------------
  # Patch TypeScript/Codegen fabric files (CodegenTypes namespace)
  # -------------------------------------------------------------------
  if [ -d "$FABRIC_DIR" ]; then
    echo "[patch-screens] Patching $FABRIC_DIR to fix CodegenTypes namespace..."
    while IFS= read -r FILE_PATH; do
      if [ -z "$FILE_PATH" ]; then continue; fi
      f=$(basename "$FILE_PATH")
      sed -i 's/CT\.WithDefault/WithDefault/g' "$FILE_PATH"
      sed -i 's/React\.ComponentRef/React.ElementRef/g' "$FILE_PATH"
      sed -i 's/CT\.Int32/Int32/g' "$FILE_PATH"
      sed -i 's/CT\.Float/Float/g' "$FILE_PATH"
      sed -i 's/CT\.Double/Double/g' "$FILE_PATH"
      sed -i 's/CT\.UnsafeMixed/UnsafeMixed/g' "$FILE_PATH"
      sed -i 's/CT\.BubblingEventHandler/BubblingEventHandler/g' "$FILE_PATH"
      sed -i 's/CT\.DirectEventHandler/DirectEventHandler/g' "$FILE_PATH"
      sed -i 's/import type { CodegenTypes as CT, \(.*\) } from '"'"'react-native'"'"';/import type { \1, WithDefault, Int32, Float, Double, UnsafeMixed } from '"'"'react-native'"'"';/' "$FILE_PATH"
      echo "[patch-screens]   Patched $f"
    done <<< "$(find "$FABRIC_DIR" -type f \( -name "*.ts" -o -name "*.tsx" \))"
  fi

  # -------------------------------------------------------------------
  # Patch Kotlin gamma files (RN 0.80+ APIs -> RN 0.79.2 compatible stubs)
  # -------------------------------------------------------------------
  if [ -d "$GAMMA_DIR" ]; then
    echo "[patch-gamma] Patching gamma Kotlin files in $SCREENS_DIR..."

    # 1. Replace UIManagerHelperExt.kt with a compile-compatible stub.
    #    The original uses UIManagerHelper.getUIManager(ctx, UIManagerType.FABRIC)
    #    which was introduced in RN 0.80. Since rnsGammaEnabled=false, this
    #    function is never called at runtime.
    UIMANAGER_EXT="$GAMMA_DIR/helpers/UIManagerHelperExt.kt"
    if [ -f "$UIMANAGER_EXT" ]; then
      cat > "$UIMANAGER_EXT" << 'KOTLIN_STUB'
package com.swmansion.rnscreens.gamma.helpers

import com.facebook.react.bridge.UIManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper

/**
 * Stub for React Native 0.79.2 compatibility.
 * The gamma feature requires UIManagerHelper.getUIManager(ReactContext, UIManagerType)
 * which was introduced in React Native 0.80+. Since rnsGammaEnabled=false,
 * this function is never invoked at runtime.
 */
internal fun UIManagerHelper.getFabricUIManagerNotNull(reactContext: ThemedReactContext): UIManager {
    throw UnsupportedOperationException(
        "[RNScreens] Gamma requires React Native 0.80+. This build uses RN 0.79.2."
    )
}
KOTLIN_STUB
      echo "[patch-gamma]   Replaced UIManagerHelperExt.kt with RN 0.79.2 stub"
    fi

    # 2. Fix FormSheetContentView.kt: onChildStartedNativeGesture
    #    RN 0.80+: onChildStartedNativeGesture(ev, dispatcher, context)  [3 args]
    #    RN 0.79.2: onChildStartedNativeGesture(ev, dispatcher)           [2 args]
    FORM_SHEET="$GAMMA_DIR/modals/formsheet/FormSheetContentView.kt"
    if [ -f "$FORM_SHEET" ]; then
      sed -i 's/jsTouchDispatcher\.onChildStartedNativeGesture(ev, eventDispatcher, themedReactContext)/jsTouchDispatcher.onChildStartedNativeGesture(ev, eventDispatcher)/g' "$FORM_SHEET"
      echo "[patch-gamma]   Fixed onChildStartedNativeGesture in FormSheetContentView.kt"
    fi

    echo "[patch-gamma] Done patching gamma files in $SCREENS_DIR"
  fi

done <<< "$SCREENS_DIRS"

echo "[patch-screens] Done with react-native-screens."

# ===========================================================================
# Patch expo-modules-core (nested inside expo/node_modules/) for RN 0.79.2.
#
# Problem: React Native 0.79.2 changed the `Promise` interface signatures from
#   reject(code: String?, ...) -> reject(code: String, ...)  (non-nullable code)
# expo-modules-core's `Promise.kt` (inside expo/node_modules/) still uses the
# old nullable `code: String?` signatures which fail to compile against RN 0.79.2.
# ===========================================================================
echo "[patch-expo] Patching expo-modules-core for React Native 0.79.2 Promise compatibility..."

for EXPO_CORE_DIR in $(find . -type d -name "expo-modules-core" -path "*/expo/node_modules/*" 2>/dev/null); do
  PROMISE_FILE="$EXPO_CORE_DIR/android/src/main/java/expo/modules/kotlin/Promise.kt"
  KWRAPPER_FILE="$EXPO_CORE_DIR/android/src/main/java/expo/modules/kotlin/KPromiseWrapper.kt"

  if [ -f "$PROMISE_FILE" ]; then
    sed -i 's/override fun reject(code: String?, message: String?)/override fun reject(code: String, message: String?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, throwable: Throwable?)/override fun reject(code: String, throwable: Throwable?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, message: String?, throwable: Throwable?)/override fun reject(code: String, message: String?, throwable: Throwable?)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, userInfo: WritableMap)/override fun reject(code: String, userInfo: WritableMap)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap)/override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap)/g' "$PROMISE_FILE"
    sed -i 's/override fun reject(code: String?, message: String?, userInfo: WritableMap)/override fun reject(code: String, message: String?, userInfo: WritableMap)/g' "$PROMISE_FILE"
    echo "[patch-expo] Patched Promise.kt in $EXPO_CORE_DIR"
  fi

  if [ -f "$KWRAPPER_FILE" ]; then
    sed -i 's/bridgePromise\.reject(code, message, cause)/bridgePromise.reject(code ?: "E_UNKNOWN", message, cause)/g' "$KWRAPPER_FILE"
    echo "[patch-expo] Patched KPromiseWrapper.kt in $EXPO_CORE_DIR"
  fi
done

echo "[patch] Done."
