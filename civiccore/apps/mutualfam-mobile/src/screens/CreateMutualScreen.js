import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

export default function CreateMutualScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para la mutual');
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await apiClient.post('/membership/organizations/create', { 
        name: name.trim(), 
        description: description.trim() 
      });
      Alert.alert('¡Éxito!', 'Mutual creada. Tienes 24 horas para invitar a tus familiares libremente.');
      
      // Auto-select the newly created org
      if (data.organization_id) {
        await AsyncStorage.setItem('org_id', data.organization_id.toString());
        navigation.replace('MainTabs');
      } else {
        navigation.replace('SelectMutual');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'No se pudo crear la mutual');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear mi Mutual</Text>
      <Text style={styles.subtitle}>Inicia tu propia familia y administra sus préstamos y fondos.</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Nombre de la familia (ej. Familia Pérez)"
        placeholderTextColor="#94a3b8"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        placeholder="Descripción (Opcional)"
        placeholderTextColor="#94a3b8"
        multiline
        value={description}
        onChangeText={setDescription}
      />

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Crear Mutual</Text>}
      </TouchableOpacity>

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
  }
});
