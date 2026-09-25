import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/client';
import apiClient from '../api/client';

export default function JoinMutualScreen({ route, navigation }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [mutualInfo, setMutualInfo] = useState(null);

  useEffect(() => {
    // Si viene desde un deep link (mutualfam://join/TOKEN)
    if (route.params?.token) {
      setToken(route.params.token);
      checkToken(route.params.token);
    }
  }, [route.params?.token]);

  const checkToken = async (tokenToCheck) => {
    if (!tokenToCheck) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/membership/invites/${tokenToCheck}`);
      setMutualInfo(data);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Token inválido o expirado');
      setMutualInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!token) {
      Alert.alert('Error', 'Por favor ingresa un token de invitación');
      return;
    }
    
    setLoading(true);
    try {
      const jwtToken = await AsyncStorage.getItem('jwt_token');
      if (!jwtToken) {
        // Not logged in
        await AsyncStorage.setItem('pending_join_token', token);
        Alert.alert('Atención', 'Debes crear una cuenta o iniciar sesión primero para unirte.');
        navigation.replace('Login');
        return;
      }

      const { data } = await apiClient.post('/membership/organizations/join', { token });
      await AsyncStorage.removeItem('pending_join_token');
      Alert.alert('¡Bienvenido!', data.message || 'Te has unido exitosamente.');
      
      // Save org_id and go to main tabs
      await AsyncStorage.setItem('org_id', data.organization_id.toString());
      navigation.replace('MainTabs');
    } catch (e) {
      if (e.response?.status === 401) {
        await AsyncStorage.setItem('pending_join_token', token);
        Alert.alert('Sesión expirada', 'Debes iniciar sesión nuevamente para unirte.');
        navigation.replace('Login');
      } else {
        Alert.alert('Error', e.response?.data?.detail || 'No se pudo procesar la invitación');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unirse a Mutual</Text>
      
      {!mutualInfo ? (
        <>
          <Text style={styles.subtitle}>Ingresa el código que te compartió el administrador de la familia.</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. AbCdEfGh..."
            placeholderTextColor="#94a3b8"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
          />
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => checkToken(token)}
            disabled={loading || !token}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verificar Código</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Has sido invitado a:</Text>
          <Text style={styles.orgName}>{mutualInfo.organization_name}</Text>
          
          <TouchableOpacity 
            style={[styles.button, { marginTop: 20 }]} 
            onPress={handleJoin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirmar y Unirme</Text>}
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        style={styles.cancelButton} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelText}>Cancelar</Text>
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoTitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 10,
  },
  orgName: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold',
  }
});
