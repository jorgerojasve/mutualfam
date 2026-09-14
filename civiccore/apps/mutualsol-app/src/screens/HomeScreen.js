import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Bell, Users } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useAuthStore, membershipApi } from '@civiccore/sdk';

export default function HomeScreen({ navigation }) {
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  const displayName = user ? `${user.nombre} ${user.apellido}` : 'Socio';
  const saldo = user?.saldo_usd ?? 0;
  const creditoMax = user?.credito_maximo_usd ?? 0;
  const creditoPct = creditoMax > 0 ? Math.min((saldo / creditoMax) * 100, 100) : 0;

  const [totalMembers, setTotalMembers] = React.useState(null);

  React.useEffect(() => {
    membershipApi.stats()
      .then(res => setTotalMembers(res.total_members))
      .catch(err => console.error("Error fetching stats:", err));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🤝 MutualSol</Text>
          <View style={styles.headerActions}>
            {totalMembers !== null && (
              <View style={styles.statsBadge}>
                <Users color={COLORS.accent} size={14} />
                <Text style={styles.statsText}>{totalMembers} M</Text>
              </View>
            )}
            <TouchableOpacity style={styles.notificationBtn}>
              <Bell color={COLORS.text} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <LogOut color={COLORS.accent} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Saldo Principal */}
        <View style={styles.balanceContainer}>
          <Text style={styles.greeting}>¡Hola, {displayName}!</Text>
          <Text style={styles.balance}>
            $ {saldo.toFixed(2)} <Text style={styles.currency}>USD</Text>
          </Text>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Fondo de Aportes</Text>
              <Text style={styles.progressText}>{creditoPct.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${creditoPct}%` }]} />
            </View>
          </View>

          {user?.status === 'pending' && (
            <View style={styles.pendingBanner}>
              <Text style={styles.pendingText}>⏳ Tu membresía está pendiente de aprobación por la asamblea.</Text>
            </View>
          )}

          {user?.status === 'suspended' && (
            <View style={[styles.pendingBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Text style={[styles.pendingText, { color: '#ef4444' }]}>⛔ Tu cuenta está suspendida por mora.</Text>
            </View>
          )}

          {user?.status === 'on_appeal' && (
            <View style={[styles.pendingBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Text style={[styles.pendingText, { color: '#ef4444' }]}>⚖️ Tienes un proceso de expulsión en apelación.</Text>
            </View>
          )}

          {user?.status === 'withdrawal_requested' && (
            <View style={styles.pendingBanner}>
              <Text style={styles.pendingText}>🚪 Has solicitado tu baja voluntaria. Estás en período de espera.</Text>
            </View>
          )}
        </View>

        {/* Acciones Rápidas */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('CreditRequest')}
          >
            <Text style={styles.actionIcon}>↗️</Text>
            <Text style={styles.actionText}>Solicitar{'\n'}Crédito</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionText}>Aportar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Mercado')}
          >
            <Text style={styles.actionIcon}>⇄</Text>
            <Text style={styles.actionText}>Mercado</Text>
          </TouchableOpacity>
        </View>

        {/* Información del Perfil */}
        <Text style={styles.sectionTitle}>Mi Perfil</Text>
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Cédula</Text>
            <Text style={styles.profileValue}>{user?.cedula ?? '—'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Estado</Text>
            <View style={[styles.statusBadge, user?.estado === 'activo' ? styles.statusActivo : styles.statusPendiente]}>
              <Text style={styles.statusText}>{user?.estado ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Reputación</Text>
            <Text style={styles.profileValue}>{'⭐'.repeat(Math.round(user?.reputacion ?? 0))} {user?.reputacion?.toFixed(1) ?? '0.0'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Crédito Máximo</Text>
            <Text style={styles.profileValue}>$ {creditoMax.toFixed(2)} USD</Text>
          </View>
          <TouchableOpacity 
            style={[styles.profileRow, { borderBottomWidth: 0, marginTop: 10, justifyContent: 'center' }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={{ color: COLORS.accent, fontWeight: 'bold' }}>Configuración de Cuenta</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  logo: { color: COLORS.accent, fontSize: 24, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationBtn: { backgroundColor: COLORS.card, padding: 10, borderRadius: 20 },
  logoutBtn: { backgroundColor: 'rgba(245, 166, 35, 0.1)', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)' },
  balanceContainer: { marginBottom: 30 },
  greeting: { color: COLORS.textMuted, fontSize: 16, marginBottom: 8 },
  balance: { color: COLORS.text, fontSize: 42, fontWeight: 'bold', marginBottom: 20 },
  currency: { fontSize: 24, color: COLORS.textMuted },
  progressContainer: { backgroundColor: COLORS.card, padding: 15, borderRadius: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressText: { color: COLORS.textMuted, fontSize: 14 },
  progressBarBg: { height: 6, backgroundColor: COLORS.background, borderRadius: 3 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },
  pendingBanner: { marginTop: 12, backgroundColor: 'rgba(245, 166, 35, 0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)' },
  pendingText: { color: COLORS.accent, fontSize: 13, lineHeight: 18 },
  actionsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  actionButton: { backgroundColor: COLORS.card, width: '30%', aspectRatio: 1, borderRadius: 16, justifyContent: 'center', alignItems: 'center', padding: 10 },
  actionIcon: { fontSize: 28, color: COLORS.accent, marginBottom: 10 },
  actionText: { color: COLORS.text, textAlign: 'center', fontSize: 13 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginBottom: 15 },
  profileCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 15 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  profileLabel: { color: COLORS.textMuted, fontSize: 14 },
  profileValue: { color: COLORS.text, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusActivo: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  statusPendiente: { backgroundColor: 'rgba(245, 166, 35, 0.15)' },
  statusText: { fontWeight: 'bold', fontSize: 12, color: COLORS.text },
  statsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 166, 35, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)', marginRight: 5 },
  statsText: { color: COLORS.accent, fontSize: 13, fontWeight: 'bold', marginLeft: 5 },
});
