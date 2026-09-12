// Polyfill: DOMException no existe en React Native pero algunas librerías lo necesitan
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'DOMException';
    }
  };
}

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { initCivicCore, useAuthStore, useConfigStore } from '@civiccore/sdk';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from './src/theme/colors';

// Inicializar el SDK de CivicCore con el adaptador de almacenamiento móvil
initCivicCore({
  storage: {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, val) => SecureStore.setItemAsync(key, val),
    removeItem: (key) => SecureStore.deleteItemAsync(key)
  }
});

function AppLoader() {
  const { loadUser, isLoading: authLoading } = useAuthStore();
  const { loadConfigs, isLoading: configLoading } = useConfigStore();

  useEffect(() => {
    loadUser();
    loadConfigs();
  }, []);

  if (authLoading || configLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppLoader />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
