import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { authApi } from '../api/client';
import { extractInviteCode, getInviteFromClipboard } from '../utils/invite';
import { OrgContext } from '../context/OrgContext';

export default function SelectMutualScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [detectedInvite, setDetectedInvite] = useState(null); // { token, organization_name }
  const { selectOrg, loadActiveOrg } = React.useContext(OrgContext);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await authApi.me();
      const orgs = data.organizations || [];
      setOrganizations(orgs);
      if (orgs.length === 0) detectInvite();
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar la información del usuario');
    } finally {
      setLoading(false);
    }
  };

  const detectInvite = async () => {
    let code = extractInviteCode(await AsyncStorage.getItem('pending_join_token'));
    if (!code) code = await getInviteFromClipboard();
    if (!code) return;
    try {
      const { data } = await apiClient.get(`/membership/invites/${encodeURIComponent(code)}`);
      setDetectedInvite({ token: data.token || code, organization_name: data.organization_name });
    } catch (e) {
      // Invitación inválida: no mostramos nada
    }
  };

  const handleSelectOrg = async (org) => {
    await selectOrg(org);
    navigation.replace('MainTabs');
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('jwt_token');
    await AsyncStorage.removeItem('active_org_id');
    navigation.replace('Login');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Mutuales</Text>

      {organizations.length > 0 ? (
        <FlatList
          data={organizations}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.orgCard}
              onPress={() => handleSelectOrg(item)}
            >
              <Text style={styles.orgName}>{item.name}</Text>
              <Text style={styles.orgRole}>Rol: {item.role === 'founder' ? 'Fundador' : 'Miembro'}</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          {detectedInvite ? (
            <View style={styles.inviteCard}>
              <Text style={styles.inviteCardLabel}>✨ Tienes una invitación</Text>
              <Text style={styles.inviteCardOrg}>{detectedInvite.organization_name}</Text>
              <TouchableOpacity
                style={[styles.primaryButton, { alignSelf: 'stretch', marginTop: 16, marginBottom: 0 }]}
                onPress={() => navigation.navigate('JoinMutual', { token: detectedInvite.token })}
              >
                <Text style={styles.primaryButtonText}>Ver invitación y unirme</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.emptyText}>Aún no perteneces a ninguna familia/mutual.</Text>
              <Text style={styles.emptyHint}>
                Si alguien te invitó, toca "Tengo un código de invitación" y escribe el código que aparece en tu mensaje.
              </Text>
            </>
          )}
        </View>
      )}

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('JoinMutual')}
        >
          <Text style={styles.primaryButtonText}>Tengo un código de invitación</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('CreateMutual')}
        >
          <Text style={styles.secondaryButtonText}>Crear una nueva mutual</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
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
  orgCard: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  orgName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 5,
  },
  orgRole: {
    fontSize: 14,
    color: '#94a3b8',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyHint: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  inviteCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  inviteCardLabel: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  inviteCardOrg: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 20,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#3b82f6',
    borderWidth: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  secondaryButtonText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    padding: 15,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
