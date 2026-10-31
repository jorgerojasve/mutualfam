import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import { checkForAppUpdate } from './src/services/appUpdates';
import UpdateModal from './src/components/UpdateModal';
import BetaWelcomeModal from './src/components/BetaWelcomeModal';
import { initializeBetaState } from './src/utils/beta';
import { authApi } from './src/api/client';


// Screens
import LoginScreen from './src/screens/LoginScreen';
import LoansScreen from './src/screens/LoansScreen';
import FundsScreen from './src/screens/FundsScreen';
import SelectMutualScreen from './src/screens/SelectMutualScreen';
import CreateMutualScreen from './src/screens/CreateMutualScreen';
import JoinMutualScreen from './src/screens/JoinMutualScreen';
import InviteMembersScreen from './src/screens/InviteMembersScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MutualSwitcherBar from './src/components/MutualSwitcherBar';
import { OrgProvider } from './src/context/OrgContext';
import theme from './src/utils/theme';
import { DarkTheme } from '@react-navigation/native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
export const navigationRef = createNavigationContainerRef();

const appNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.screenBg,
    card: theme.cardBg,
    primary: theme.accent,
    border: theme.cardBorder,
  }
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        // Barra global: el selector de mutual afecta a toda la app, no a una pestaña
        headerShown: true,
        header: () => <MutualSwitcherBar />,
        tabBarStyle: {
          backgroundColor: theme.tabBarBg,
          borderTopColor: theme.cardBorder,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: '#94a3b8',
      }}
    >
      <Tab.Screen 
        name="Préstamos" 
        component={LoansScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size/2, opacity: 0.5 }} />
          )
        }}
      />
      <Tab.Screen 
        name="Fondos" 
        component={FundsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size/2, opacity: 0.5 }} />
          )
        }}
      />
      <Tab.Screen 
        name="Familia" 
        component={InviteMembersScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size/2, opacity: 0.5 }} />
          )
        }}
      />
      <Tab.Screen 
        name="Perfil" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size/2, opacity: 0.5 }} />
          )
        }}
      />
    </Tab.Navigator>
  );
}

const prefix = Linking.createURL('/');

export default function App() {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');
  const [updateInfo, setUpdateInfo] = useState(null);

  const linking = {
    prefixes: [prefix, 'mutualfam://'],
    config: {
      screens: {
        JoinMutual: 'join/:token',
        Login: 'login',
        MainTabs: 'main',
      },
    },
  };

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          try {
            // Validar sesión contra el backend antes de navegar optimísticamente
            await authApi.me();
            const orgId = await AsyncStorage.getItem('active_org_id');
            setInitialRoute(orgId ? 'MainTabs' : 'SelectMutual');
            await registerForPushNotificationsAsync();
          } catch (authError) {
            // Si el servidor confirma que el usuario o sesión no es válida (401 o 404)
            if (authError?.response?.status === 401 || authError?.response?.status === 404) {
              await AsyncStorage.multiRemove(['jwt_token', 'refresh_token', 'active_org_id', 'org_id']);
              setInitialRoute('Login');
            } else {
              // Si fue fallo de red/conexión temporal, permitimos navegación tentativa según lo guardado
              const orgId = await AsyncStorage.getItem('active_org_id');
              setInitialRoute(orgId ? 'MainTabs' : 'SelectMutual');
            }
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    };
    
    checkToken();
    initializeBetaState().catch(() => {});

    // Verificación en segundo plano de nuevas versiones (obligatorias u opcionales)
    checkForAppUpdate().then((info) => {
      if (info?.hasUpdate) {
        setUpdateInfo(info);
      }
    });
  }, []);


  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.screenBg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <OrgProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer ref={navigationRef} linking={linking} theme={appNavTheme}>
          <StatusBar style="light" backgroundColor={theme.headerBg} />
          <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="CreateMutual" component={CreateMutualScreen} />
            <Stack.Screen name="JoinMutual" component={JoinMutualScreen} />
            <Stack.Screen name="SelectMutual" component={SelectMutualScreen} />
            <Stack.Screen name="MainTabs" component={MainTabs} />
          </Stack.Navigator>
        </NavigationContainer>
        <UpdateModal
          updateInfo={updateInfo}
          onDismiss={() => setUpdateInfo(null)}
        />
        <BetaWelcomeModal />
      </GestureHandlerRootView>
    </OrgProvider>
  );
}
