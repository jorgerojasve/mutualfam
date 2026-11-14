import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { authApi } from '../api/client';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import AssemblyScreen from './AssemblyScreen';
import { OrgContext } from '../context/OrgContext';
import { getErrorMessage, handleLimitError } from '../utils/errors';
import theme from '../utils/theme';

export default function InviteMembersScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('miembros'); // 'miembros' | 'asamblea'
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [canInvite, setCanInvite] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [debugOrgId, setDebugOrgId] = useState('');
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showSecurityZone, setShowSecurityZone] = useState(false);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const { activeOrg, loading: orgLoading, isOffline } = React.useContext(OrgContext);

  const handleRequestWithdrawal = () => {
    if (!safetyConfirmed) {
      Alert.alert('Acción Protegida', 'Para activar el retiro voluntario, debes marcar primero la casilla de confirmación en la Zona de Seguridad.');
      return;
    }
    Alert.alert(
      '¿Confirmar Retiro Voluntario?',
      `¿Estás completamente seguro de que deseas tramitar tu retiro de la mutual "${activeOrg?.name}"?\n\nEsta acción finalizará tu condición de miembro activo. Se verificará tu solvencia inmediata para autorizar la salida.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Confirmar Retiro',
          style: 'destructive',
          onPress: async () => {
            setWithdrawing(true);
            try {
              const res = await authApi.solicitarRetiro(activeOrg.id);
              Alert.alert('Retiro Procesado', res.message || 'Tu retiro voluntario ha sido registrado.');
              setShowSecurityZone(false);
              setSafetyConfirmed(false);
              fetchOrgInfo();
            } catch (e) {
              const msg = getErrorMessage(e, 'No se pudo procesar el retiro voluntario.');
              Alert.alert('Solvencia Requerida', msg);
            } finally {
              setWithdrawing(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (activeOrg?.id) {
      fetchOrgInfo();
    } else if (!orgLoading) {
      setLoading(false);
    }
  }, [activeOrg?.id, orgLoading]);

  useFocusEffect(
    useCallback(() => {
      if (activeOrg?.id) {
        fetchOrgInfo();
      } else if (!orgLoading) {
        setLoading(false);
      }
    }, [activeOrg?.id, orgLoading])
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
    setLoading(true);
    try {
      if (!activeOrg?.id) {
        setErrorMsg('Tu ID de mutual no coincide con ninguna mutual de tu cuenta.');
        setOrgData(null);
        return;
      }
      setOrgData(activeOrg);
      try {
        const [membersData, meData] = await Promise.all([
          authApi.getMembers(activeOrg.id).catch(() => []),
          authApi.me().catch(() => null)
        ]);
        setMembers(membersData);
        if (meData) setCurrentUser(meData);
      } catch (memErr) {
        console.warn("Could not fetch members", memErr);
      }
    } catch (e) {
      console.warn(e);
      setErrorMsg(getErrorMessage(e, 'Error de API'));
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async () => {
    setGenerating(true);
    try {
      const orgId = activeOrg?.id || (await AsyncStorage.getItem('active_org_id')) || (await AsyncStorage.getItem('org_id'));
      if (!orgId) {
        Alert.alert('Atención', 'No se encontró la mutual activa. Por favor selecciona tu mutual nuevamente.');
        return;
      }
      const { data } = await apiClient.post(`/membership/organizations/${orgId}/invites`, null, {
        headers: { 'X-Organization-ID': orgId.toString() }
      });
      
      let inviteUrl = '';
      if (!__DEV__ && process.env.EXPO_PUBLIC_INVITE_URL_BASE) {
        inviteUrl = `${process.env.EXPO_PUBLIC_INVITE_URL_BASE}${data.token}`;
      } else {
        // Fallback nativo para desarrollo (Expo Go)
        inviteUrl = Linking.createURL(`join/${data.token}`);
      }
      
      const code = data.code || data.token;
      const shareMessage = (!__DEV__ && process.env.EXPO_PUBLIC_INVITE_URL_BASE)
        ? `¡Únete a nuestra Mutual Familiar! 🤝\n\n1️⃣ Abre este enlace y sigue los pasos para instalar la app:\n${inviteUrl}\n\n2️⃣ Si la app te pide un código de invitación, usa:\n*${code}*\n\n🔒 Nota: Este enlace y código es personal y de un solo uso para una persona.`
        : `¡Únete a nuestra Mutual Familiar! 🤝\n${inviteUrl}\nCódigo: *${code}*\n\n🔒 Nota: Este enlace y código es personal y de un solo uso para una persona.`;
      
      await Share.share({
        message: shareMessage,
      });
    } catch (e) {
      console.error('Error generating invite:', e);
      if (!handleLimitError(e, 'Límite de Miembros', { mutualName: activeOrg?.name })) {
        Alert.alert('Error', getErrorMessage(e, 'No se pudo generar la invitación'));
      }
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
        <Text style={{color: '#94a3b8', fontSize: 16, textAlign: 'center', paddingHorizontal: 20}}>
          Selecciona una mutual en la barra superior para ver y gestionar sus miembros.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenTitle title="Familia Mutual" />
      
      {/* Selector de sub-pestañas */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'miembros' && styles.tabButtonActive]}
          onPress={() => setActiveTab('miembros')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'miembros' && styles.tabButtonTextActive]}>
            {isOffline && members.length === 0 ? '👥 Miembros (Sin conexión)' : `👥 Miembros (${members.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'asamblea' && styles.tabButtonActive]}
          onPress={() => setActiveTab('asamblea')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'asamblea' && styles.tabButtonTextActive]}>
            🏛️ Asamblea
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'asamblea' ? (
        <View style={{ flex: 1, marginTop: 4 }}>
          <AssemblyScreen embedded={true} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { marginBottom: 20 }]}>
            <Text style={styles.cardTitle}>
              {isOffline && members.length === 0 ? 'Miembros Actuales (Sin conexión)' : `Miembros Actuales (${members.length})`}
            </Text>
            {members.length === 0 ? (
              <Text style={styles.cardText}>No hay miembros que mostrar.</Text>
            ) : (
              members.map(member => {
                const isMe = (currentUser?.id && member.id === currentUser.id) ||
                             (currentUser?.email && member.email?.toLowerCase() === currentUser.email?.toLowerCase());
                return (
                  <View
                    key={member.id}
                    style={[styles.memberRow, isMe && styles.memberRowHighlight]}
                  >
                    <View style={[styles.memberAvatar, isMe && styles.memberAvatarHighlight]}>
                      <Text style={styles.memberAvatarText}>{(member.first_name || 'U')[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.memberName, isMe && styles.memberNameHighlight]}>
                          {member.first_name} {member.last_name}
                        </Text>
                        {isMe && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>Tú</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberRole}>{member.role === 'founder' ? 'Fundador' : 'Miembro'}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {orgData.role === 'founder' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Invitar (Período de Gracia)</Text>
              <Text style={styles.cardText}>
                Como fundador de la mutual, puedes invitar miembros directamente sin pasar por asamblea durante los primeros 15 días.
              </Text>

              <View style={styles.singleUseNotice}>
                <Ionicons name="information-circle-outline" size={18} color="#38bdf8" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.singleUseNoticeText}>
                  <Text style={{ fontWeight: 'bold', color: '#38bdf8' }}>Enlace único y personal: </Text>
                  Cada invitación es de un solo uso para una persona. Si deseas invitar a varios familiares, genera un enlace para cada uno.
                </Text>
              </View>
              
              <View style={styles.timerContainer}>
                <Text style={styles.timerLabel}>Tiempo restante:</Text>
                <Text style={[styles.timerValue, !canInvite && styles.timerValueExpired]}>
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
                  <View style={styles.expiredWarningHeader}>
                    <Ionicons name="information-circle-outline" size={18} color="#94a3b8" style={{ marginRight: 6 }} />
                    <Text style={styles.expiredWarningTitle}>Período de gracia concluido</Text>
                  </View>
                  <Text style={styles.expiredText}>
                    El período de gracia ha finalizado. Los nuevos miembros deberán ser propuestos mediante la Asamblea Familiar.
                  </Text>
                  <TouchableOpacity
                    style={styles.btnGoAssembly}
                    onPress={() => setActiveTab('asamblea')}
                  >
                    <Text style={styles.btnGoAssemblyText}>🏛️ Ir a Asamblea</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Zona de Seguridad (Retiro Voluntario) */}
          <View style={styles.securityZoneWrapper}>
            <TouchableOpacity
              style={styles.securityZoneHeader}
              onPress={() => {
                const next = !showSecurityZone;
                setShowSecurityZone(next);
                if (!next) setSafetyConfirmed(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.securityZoneHeaderLeft}>
                <View style={styles.securityShieldBadge}>
                  <Ionicons name="shield-outline" size={18} color="#94a3b8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityZoneTitle}>Zona de Seguridad</Text>
                  <Text style={styles.securityZoneSubtitle}>Opciones sensibles • Retiro de membresía</Text>
                </View>
              </View>
              <View style={styles.securityZoneToggle}>
                <Text style={styles.securityZoneToggleText}>{showSecurityZone ? 'Ocultar' : 'Acceder'}</Text>
                <Ionicons name={showSecurityZone ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
              </View>
            </TouchableOpacity>

            {showSecurityZone && (
              <View style={styles.securityZoneBody}>
                <View style={styles.securityNoticeBox}>
                  <Ionicons name="warning-outline" size={18} color="#f59e0b" style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={styles.securityNoticeText}>
                    Esta es una acción definitiva. Al tramitar tu retiro voluntario, finalizará tu condición de miembro activo en la mutual familiar.
                  </Text>
                </View>

                <Text style={styles.securityCardTitle}>Solicitud de Retiro Voluntario</Text>
                <Text style={styles.securityCardDesc}>
                  Puedes solicitar tu retiro en cualquier momento, siempre y cuando no tengas deudas activas o préstamos pendientes por liquidar en esta mutual.
                </Text>

                <TouchableOpacity
                  style={styles.securityCheckboxRow}
                  onPress={() => setSafetyConfirmed(!safetyConfirmed)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={safetyConfirmed ? "checkbox" : "square-outline"}
                    size={22}
                    color={safetyConfirmed ? "#ef4444" : "#64748b"}
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.securityCheckboxLabel}>
                    He verificado mi solvencia y confirmo que deseo habilitar la opción de retiro voluntario.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnWithdrawal,
                    !safetyConfirmed && styles.btnWithdrawalDisabled
                  ]}
                  onPress={handleRequestWithdrawal}
                  disabled={!safetyConfirmed || withdrawing}
                  activeOpacity={0.8}
                >
                  {withdrawing ? (
                    <ActivityIndicator color={safetyConfirmed ? "#ef4444" : "#64748b"} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons
                        name={safetyConfirmed ? "exit-outline" : "lock-closed-outline"}
                        size={16}
                        color={safetyConfirmed ? "#ef4444" : "#64748b"}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[
                        styles.btnWithdrawalText,
                        !safetyConfirmed && styles.btnWithdrawalTextDisabled
                      ]}>
                        {safetyConfirmed ? "Solicitar Retiro Voluntario" : "Retiro Bloqueado (Marca la casilla)"}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{height: 40}} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.screenBg,
    padding: 16,
    paddingTop: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)'
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: '#334155'
  },
  tabButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  tabButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.screenBg,
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
    backgroundColor: theme.cardBg,
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
  timerValueExpired: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '600',
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
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    padding: 14,
    borderRadius: 10,
    marginTop: 6,
  },
  expiredWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  expiredWarningTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  expiredText: {
    color: '#94a3b8',
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  btnGoAssembly: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  btnGoAssemblyText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberRole: {
    color: '#94a3b8',
    fontSize: 14,
  },
  memberRowHighlight: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  memberAvatarHighlight: {
    backgroundColor: '#2563eb',
  },
  memberNameHighlight: {
    color: '#60a5fa',
  },
  youBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  youBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  singleUseNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  singleUseNoticeText: {
    flex: 1,
    color: '#bae6fd',
    fontSize: 13,
    lineHeight: 18,
  },
  securityZoneWrapper: {
    backgroundColor: theme.cardBg,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  securityZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  securityZoneHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  securityShieldBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  securityZoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  securityZoneSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  securityZoneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  securityZoneToggleText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  securityZoneBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  securityNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    marginBottom: 14,
  },
  securityNoticeText: {
    flex: 1,
    color: '#fde68a',
    fontSize: 12.5,
    lineHeight: 18,
  },
  securityCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  securityCardDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
    marginBottom: 16,
  },
  securityCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  securityCheckboxLabel: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  btnWithdrawal: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnWithdrawalDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnWithdrawalText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 14,
  },
  btnWithdrawalTextDisabled: {
    color: '#64748b',
  },
});
