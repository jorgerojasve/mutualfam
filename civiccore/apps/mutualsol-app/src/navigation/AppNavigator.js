import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import TransparencyScreen from '../screens/TransparencyScreen';
import CreditRequestScreen from '../screens/CreditRequestScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import GovernanceScreen from '../screens/GovernanceScreen';
import CreateProposalScreen from '../screens/CreateProposalScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import CreateOfferScreen from '../screens/CreateOfferScreen';
import { COLORS } from '../theme/colors';
import { Home, Shield, Users, Store } from 'lucide-react-native';
import { useAuthStore } from '@civiccore/sdk';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 60 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 10,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tab.Screen 
        name="Mercado" 
        component={MarketplaceScreen} 
        options={{
          tabBarIcon: ({ color }) => <Store color={color} size={24} />,
        }}
      />
      <Tab.Screen 
        name="Asamblea" 
        component={GovernanceScreen} 
        options={{
          tabBarIcon: ({ color }) => <Users color={color} size={24} />,
        }}
      />
      <Tab.Screen 
        name="Auditoría" 
        component={TransparencyScreen} 
        options={{
          tabBarIcon: ({ color }) => <Shield color={color} size={24} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen 
            name="CreditRequest" 
            component={CreditRequestScreen} 
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen 
            name="CreateProposal" 
            component={CreateProposalScreen} 
          />
          <Stack.Screen 
            name="CreateOffer" 
            component={CreateOfferScreen} 
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
