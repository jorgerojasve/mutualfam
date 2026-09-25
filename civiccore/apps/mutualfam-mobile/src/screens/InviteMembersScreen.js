import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';

export default function InviteMembersScreen() {
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [canInvite, setCanInvite] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [debugOrgId, setDebugOrgId] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchOrgInfo();
    }, [])
  );

  useEffect(() => {
    if (!orgData?.grace_period_ends_at) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      // El backend devuelve UTC, nos aseguramos de parsearlo bien
      const endsAt = new Date(orgData.grace_period_ends_at + 'Z'); 
      const diff = endsAt - now;
      
      if (diff <= 0) {
        setCanInvite(false);
        setTimeLeft('Expirado');
        clearInterval(interval);
      } else {
        setCanInvite(true);
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [orgData]);

  const fetchOrgInfo = async () => {
    try {
      const orgId = await AsyncStorage.getItem('org_id');
      setDebugOrgId(orgId || 'nulo');
      if (!orgId) return;

      const { data } = await apiClient.get('/membership/me');
      const myOrg = data.organizations?.find(o => o.id.toString() === orgId);
      
      if (myOrg) {
        setOrgData(myOrg);
      } else {
        setErrorMsg('Tu ID de mutual no coincide con ninguna mutual de tu cuenta.');
      }
    } catch (e) {
      console.warn(e);
      setErrorMsg(e.message || 'Error de API');
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async () => {
    setGenerating(true);
    try {
      const orgId = await AsyncStorage.getItem('org_id');
      const { data } = await apiClient.post(`/membership/organizations/${orgId}/invites`, null, {
        headers: { 'X-Organization-ID': orgId }
      });
      
      const inviteUrl = Linking.createURL(`join/${data.token}`);
      
      await Share.share({
        message: inviteUrl,
      });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'No se pudo generar la invitación');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!orgData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{color: '#fff'}}>No se encontró la información de la mutual.</Text>
      </View>
    );
  }

  if (orgData.role !== 'founder') {
    return (
      <View style={styles.centerContainer}>
        <Text style={{color: '#fff', fontSize: 18, textAlign: 'center', padding: 20}}>
          Solo el fundador puede ver esta pantalla y generar invitaciones.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invitar Familiares</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Período de Gracia de 24 Horas</Text>
        <Text style={styles.cardText}>
          Como fundador de la mutual, puedes invitar miembros directamente sin pasar por asamblea durante las primeras 24 horas.
        </Text>
        
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Tiempo restante:</Text>
          <Text style={[styles.timerValue, !canInvite && {color: '#ef4444'}]}>
            {timeLeft || 'Calculando...'}
          </Text>
        </View>
        
        {canInvite ? (
          <TouchableOpacity 
            style={styles.button} 
            onPress={generateInvite}
            disabled={generating}
          >
            {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Compartir Enlace de Invitación</Text>}
          </TouchableOpacity>
        ) : (
          <View style={styles.expiredWarning}>
            <Text style={styles.expiredText}>
              El período de gracia ha finalizado. Los nuevos miembros deberán ser propuestos mediante el módulo de Gobernanza.
            </Text>
          </View>
        )}
      </View>
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
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 20,
  },
  timerContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  timerLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 5,
  },
  timerValue: {
    color: '#10b981', // emerald-500
    fontSize: 24,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#25D366', // WhatsApp green
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  expiredWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 15,
    borderRadius: 8,
  },
  expiredText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  }
});
