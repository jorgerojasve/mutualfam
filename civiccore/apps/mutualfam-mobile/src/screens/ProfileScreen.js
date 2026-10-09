import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MutualHeader from '../components/MutualHeader';
import { OrgContext } from '../context/OrgContext';

export default function ProfileScreen({ navigation }) {
  const { activeOrg, clearOrg } = useContext(OrgContext);

  const handleLogout = async () => {
    await clearOrg();
    await AsyncStorage.removeItem('jwt_token');
    // Navegamos al stack principal a la pantalla de Login
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.container}>
      <MutualHeader title="Perfil y Ajustes" />
      
      <View style={styles.card}>
        <Text style={{color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 10}}>Mi Mutual Activa</Text>
        <Text style={styles.cardText}>Nombre: {activeOrg?.name}</Text>
        <Text style={[styles.cardText, {marginBottom: 10}]}>Rol: {activeOrg?.role === 'founder' ? 'Fundador' : 'Miembro'}</Text>
        
        <Text style={styles.cardText}>
          Si no puedes ver tus datos, es probable que tu sesión haya expirado o la base de datos del servidor se haya reiniciado. Cierra sesión y vuelve a entrar.
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 30,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  cardText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
