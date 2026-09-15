import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from '../screens/DashboardScreen';
import DirectoryScreen from '../screens/DirectoryScreen';
import FinanceScreen from '../screens/FinanceScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import GovernanceScreen from '../screens/GovernanceScreen';
import CreateProposalScreen from '../screens/CreateProposalScreen';
import PublicationsScreen from '../screens/PublicationsScreen';
import BoardScreen from '../screens/BoardScreen';
import CommitteesScreen from '../screens/CommitteesScreen';
import WithdrawalScreen from '../screens/WithdrawalScreen';
import CreditsScreen from '../screens/CreditsScreen';
import CreditRequestScreen from '../screens/CreditRequestScreen';
import { COLORS } from '../theme/colors';
import { Home, Users, BookOpen, Banknote, Shield } from 'lucide-react-native';
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
        component={DashboardScreen} 
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tab.Screen 
        name="Membresía" 
        component={DirectoryScreen} 
        options={{
          tabBarIcon: ({ color }) => <Users color={color} size={24} />,
        }}
      />
      <Tab.Screen 
        name="Asamblea" 
        component={GovernanceScreen} 
        options={{
          tabBarIcon: ({ color }) => <Shield color={color} size={24} />,
        }}
      />
      <Tab.Screen 
        name="Publicaciones" 
        component={PublicationsScreen} 
        options={{
          tabBarIcon: ({ color }) => <BookOpen color={color} size={24} />,
        }}
      />
      <Tab.Screen 
        name="Finanzas" 
        component={FinanceScreen} 
        options={{
          tabBarIcon: ({ color }) => <Banknote color={color} size={24} />,
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
          <Stack.Screen name="CreateProposal" component={CreateProposalScreen} />
          <Stack.Screen name="Board" component={BoardScreen} />
          <Stack.Screen name="Committees" component={CommitteesScreen} />
          <Stack.Screen name="Withdrawal" component={WithdrawalScreen} />
          <Stack.Screen name="Credits" component={CreditsScreen} />
          <Stack.Screen name="CreditRequest" component={CreditRequestScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
