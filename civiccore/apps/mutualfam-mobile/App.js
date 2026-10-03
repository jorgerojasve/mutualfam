import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import LoansScreen from './src/screens/LoansScreen';
import FundsScreen from './src/screens/FundsScreen';
import SelectMutualScreen from './src/screens/SelectMutualScreen';
import CreateMutualScreen from './src/screens/CreateMutualScreen';
import JoinMutualScreen from './src/screens/JoinMutualScreen';
import InviteMembersScreen from './src/screens/InviteMembersScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
export const navigationRef = createNavigationContainerRef();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: 'rgba(255,255,255,0.1)',
        },
        tabBarActiveTintColor: '#3b82f6',
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
          setInitialRoute('MainTabs');
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    };
    
    checkToken();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <StatusBar style="light" />
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="CreateMutual" component={CreateMutualScreen} />
          <Stack.Screen name="JoinMutual" component={JoinMutualScreen} />
          <Stack.Screen name="SelectMutual" component={SelectMutualScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
