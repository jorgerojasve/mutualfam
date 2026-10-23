import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { OrgContext } from '../context/OrgContext';
import { getErrorMessage, handleLimitError } from '../utils/errors';
import { getMobileEnvironmentConfig } from '../utils/env';

export default function CreateMutualScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { loadActiveOrg } = React.useContext(OrgContext);
  const envConfig = getMobileEnvironmentConfig();

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
        await AsyncStorage.setItem('active_org_id', data.organization_id.toString());
        await AsyncStorage.setItem('org_id', data.organization_id.toString());
        await loadActiveOrg(); // This will fetch organizations and set activeOrg
        navigation.replace('MainTabs');
      } else {
        navigation.replace('SelectMutual');
      }
    } catch (e) {
      if (!handleLimitError(e, 'Límite de Creación')) {
        Alert.alert('Error', getErrorMessage(e, 'No se pudo crear la mutual'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Crear mi Mutual</Text>
        {!envConfig.isProd && envConfig.badgeText ? (
          <View style={[styles.envBadge, { backgroundColor: envConfig.bgColor, borderColor: envConfig.borderColor }]}>
            <View style={[styles.envDot, { backgroundColor: envConfig.color }]} />
            <Text style={[styles.envBadgeText, { color: envConfig.color }]}>
              {envConfig.badgeText}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.subtitle}>Inicia tu propia familia y administra sus préstamos y fondos.</Text>
      
      <View style={styles.policyNotice}>
        <Text style={styles.policyNoticeText}>
          📌 Cada miembro de la mutual inicial puede crear hasta 1 mutual adicional. Si deseas desplegar tu propia instancia o bot, contáctanos por soporte.
        </Text>
      </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  envBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  envDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  envBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 16,
  },
  policyNotice: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  policyNoticeText: {
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 18,
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
