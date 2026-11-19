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

export default function InviteMembersScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState('miembros'); // 'miembros' | 'asamblea'
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [canInvite, setCanInvite] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [debugOrgId, setDebugOrgId] = useState('');
  const [members, setMembers] = useState([]);
  const [hasLoadedMembers, setHasLoadedMembers] = useState(false);
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

  const loadCachedMembers = async (orgId) => {
    if (!orgId) return;
    try {
      const cached = await AsyncStorage.getItem(`cached_members_${orgId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMembers(parsed);
          setHasLoadedMembers(true);
          if (activeOrg && !activeOrg.members_count) {
            activeOrg.members_count = parsed.length;
          }
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (activeOrg?.id) {
      loadCachedMembers(activeOrg.id);
      fetchOrgInfo();
    } else if (!orgLoading) {
      setLoading(false);
      setHasLoadedMembers(true);
    }
  }, [activeOrg?.id, orgLoading]);

  useFocusEffect(
    useCallback(() => {
      if (activeOrg?.id) {
        loadCachedMembers(activeOrg.id);
        fetchOrgInfo();
      } else if (!orgLoading) {
        setLoading(false);
        setHasLoadedMembers(true);
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
    try {
      if (!activeOrg?.id) {
        setErrorMsg('Tu ID de mutual no coincide con ninguna mutual de tu cuenta.');
        setOrgData(null);
        setLoading(false);
        return;
      }
      setOrgData(activeOrg);

      // Si aún no tenemos miembros en memoria, cargar caché de inmediato
      if (members.length === 0) {
        await loadCachedMembers(activeOrg.id);
      }

      try {
        const [membersData, meData] = await Promise.all([
          authApi.getMembers(activeOrg.id),
          authApi.me().catch(() => null)
        ]);
        if (Array.isArray(membersData) && membersData.length > 0) {
          setMembers(membersData);
          setHasLoadedMembers(true);
          if (activeOrg) {
            activeOrg.members_count = membersData.length;
          }
          await AsyncStorage.setItem(`cached_members_${activeOrg.id}`, JSON.stringify(membersData)).catch(() => {});
        }
        if (meData) setCurrentUser(meData);
      } catch (memErr) {
        console.warn("Could not fetch members online, preserving cached data", memErr);
        // En caso de fallo de red, asegurar que la caché local esté activa
        await loadCachedMembers(activeOrg.id);
      }
    } catch (e) {
      console.warn(e);
      setErrorMsg(getErrorMessage(e, 'Error de API'));
    } finally {
      setLoading(false);
      setHasLoadedMembers(true);
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

  const effectiveMemberCount = members.length > 0
    ? members.length
    : (activeOrg?.members_count || 0);

  // Solo considerar miembro único si NO estamos offline y efectivamente hay exactamente 1 miembro verificado
  const isSoleMember = !loading && !isOffline && orgData?.role === 'founder' && effectiveMemberCount === 1;

  const renderInviteCard = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Invitar (Período de Gracia)</Text>
      <Text style={styles.cardText}>
        Como fundador de la mutual, puedes invitar miembros directamente sin pasar por asamblea durante las primeras 24 horas (período de gracia).
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
  );

  const handleTabPress = (tab) => {
    if (tab === 'asamblea' && canInvite) {
      Alert.alert(
        'Asamblea Inhabilitada',
        `La Asamblea Familiar se encuentra inhabilitada durante el período de gracia de la mutual (${timeLeft || '24 horas'}).\n\nDurante este período, el fundador puede invitar directamente a sus familiares sin necesidad de someterlos a asamblea.`,
        [
          { text: 'Entendido', style: 'cancel' },
          { text: 'Invitar Familiares', onPress: generateInvite }
        ]
      );
      return;
    }
    setActiveTab(tab);
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
            {hasLoadedMembers && effectiveMemberCount > 0 ? `👥 Miembros (${effectiveMemberCount})` : '👥 Miembros'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'asamblea' && styles.tabButtonActive,
            canInvite && styles.tabButtonDisabled
          ]}
          onPress={() => handleTabPress('asamblea')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[
              styles.tabButtonText,
              activeTab === 'asamblea' && styles.tabButtonTextActive,
              canInvite && styles.tabButtonTextDisabled
            ]}>
              🏛️ Asamblea
            </Text>
            {canInvite && (
              <Ionicons name="lock-closed" size={12} color="#fbbf24" style={{ marginLeft: 4 }} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Banner de Invitaciones Pendientes (homologado con el banner de Datos de Pago) */}
      {isSoleMember && (
        <TouchableOpacity 
          style={styles.missingInvitesBanner} 
          onPress={canInvite ? generateInvite : () => setActiveTab('asamblea')}
          activeOpacity={0.8}
        >
          <View style={styles.missingInvitesBannerIconBox}>
            <Text style={styles.missingInvitesBannerIcon}>👥</Text>
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.missingInvitesBannerTitle}>Invitaciones pendientes</Text>
            <Text style={styles.missingInvitesBannerSubtitle}>
              {canInvite
                ? 'Tu mutual está recién creada. Tienes 24 horas para invitar a tus familiares directamente sin pasar por asamblea. Toca aquí para compartir el enlace de invitación.'
                : 'Tu mutual solo cuenta con 1 miembro. El período de gracia concluyó; propón nuevos ingresos en la Asamblea.'}
            </Text>
          </View>
          <Text style={styles.missingInvitesBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {activeTab === 'asamblea' ? (
        canInvite ? (
          <ScrollView style={{ flex: 1, marginTop: 8 }} showsVerticalScrollIndicator={false}>
            <View style={styles.graceLockedCard}>
              <View style={styles.graceLockedIconBox}>
                <Text style={styles.graceLockedIcon}>🏛️</Text>
                <View style={styles.graceLockedBadge}>
                  <Ionicons name="lock-closed" size={14} color="#0f172a" />
                </View>
              </View>
              <Text style={styles.graceLockedTitle}>Asamblea Inhabilitada</Text>
              <Text style={styles.graceLockedSubtitle}>
                La Asamblea Familiar se encuentra inhabilitada durante el período de gracia de 24 horas de la mutual.
              </Text>

              <View style={styles.graceLockedNotice}>
                <Ionicons name="information-circle-outline" size={20} color="#38bdf8" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.graceLockedNoticeText}>
                  Durante este período, el fundador puede invitar directamente a sus familiares desde la sección Miembros sin necesidad de someterlos a asamblea.
                </Text>
              </View>

              {timeLeft ? (
                <View style={styles.graceLockedTimerContainer}>
                  <Ionicons name="time-outline" size={18} color="#fbbf24" style={{ marginRight: 6 }} />
                  <Text style={styles.graceLockedTimerLabel}>Fin del período de gracia en:</Text>
                  <Text style={styles.graceLockedTimerValue}>{timeLeft}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setActiveTab('miembros')}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>👥 Ir a Miembros e Invitar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, marginTop: 4 }}>
            <AssemblyScreen embedded={true} />
          </View>
        )
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Si solo hay 1 miembro (recién creada), priorizar la sección de invitar familiares */}
          {isSoleMember && canInvite && renderInviteCard()}

          <View style={[styles.card, { marginBottom: 20 }]}>
            <Text style={styles.cardTitle}>
              {hasLoadedMembers && effectiveMemberCount > 0 ? `Miembros Actuales (${effectiveMemberCount})` : 'Miembros Actuales'}
            </Text>
            {members.length === 0 ? (
              <Text style={styles.cardText}>
                {isOffline ? 'Sin conexión de red. Conéctate para actualizar la lista de miembros.' : 'No hay miembros que mostrar.'}
              </Text>
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

          {/* Si ya hay más de 1 miembro (o si el período ya expiró), la tarjeta de invitar se muestra después de la lista */}
          {(!isSoleMember || !canInvite) && orgData.role === 'founder' && renderInviteCard()}

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
  missingInvitesBanner: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  missingInvitesBannerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  missingInvitesBannerIcon: {
    fontSize: 20,
  },
  missingInvitesBannerTitle: {
    color: '#fef08a',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  missingInvitesBannerSubtitle: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
  },
  missingInvitesBannerArrow: {
    color: '#facc15',
    fontSize: 22,
    fontWeight: 'bold',
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
  tabButtonDisabled: {
    opacity: 0.65,
  },
  tabButtonTextDisabled: {
    color: '#94a3b8',
  },
  graceLockedCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  graceLockedIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  graceLockedIcon: {
    fontSize: 28,
  },
  graceLockedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fbbf24',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  graceLockedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  graceLockedSubtitle: {
    fontSize: 13.5,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  graceLockedNotice: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  graceLockedNoticeText: {
    flex: 1,
    color: '#bae6fd',
    fontSize: 12.5,
    lineHeight: 18,
  },
  graceLockedTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  graceLockedTimerLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    marginRight: 6,
  },
  graceLockedTimerValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },
});
