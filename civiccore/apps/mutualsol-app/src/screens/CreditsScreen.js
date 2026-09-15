import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, Plus, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useAuthStore, creditosApi } from '@civiccore/sdk';
import { useIsFocused } from '@react-navigation/native';

export default function CreditsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused && user?.id) {
      loadCredits();
    }
  }, [isFocused, user]);

  const loadCredits = async () => {
    try {
      setLoading(true);
      const data = await creditosApi.mios(user.id);
      setCredits(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock color={COLORS.accent} size={24} />;
      case 'active':
      case 'approved': return <CheckCircle color={COLORS.success} size={24} />;
      case 'rejected': return <XCircle color="#ef4444" size={24} />;
      default: return <Wallet color={COLORS.textMuted} size={24} />;
    }
  };

  const activeCredit = credits.find(c => c.status === 'active' || c.status === 'pending');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Créditos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Active Credit Banner */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Crédito Actual</Text>
          {loading ? (
             <ActivityIndicator color={COLORS.accent} style={{marginVertical: 20}} />
          ) : activeCredit ? (
            <View style={styles.activeCreditContainer}>
               <View style={styles.activeCreditHeader}>
                 {getStatusIcon(activeCredit.status)}
                 <Text style={styles.activeCreditStatus}>
                   {activeCredit.status === 'pending' ? 'EN REVISIÓN' : 'ACTIVO'}
                 </Text>
               </View>
               <Text style={styles.activeCreditAmount}>${activeCredit.amount_requested} USD</Text>
               <Text style={styles.activeCreditTerm}>Plazo: {activeCredit.term_months} meses</Text>
            </View>
          ) : (
            <View style={styles.noActiveCredit}>
               <Wallet color={COLORS.textMuted} size={40} style={{marginBottom: 10}} />
               <Text style={styles.noActiveText}>No tienes créditos activos.</Text>
               <TouchableOpacity 
                 style={styles.requestBtn}
                 onPress={() => navigation.navigate('CreditRequest')}
               >
                 <Plus color={COLORS.background} size={20} />
                 <Text style={styles.requestBtnText}>Solicitar Crédito</Text>
               </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Historial</Text>
        
        {credits.length === 0 && !loading && (
          <Text style={styles.emptyText}>Aún no has solicitado créditos.</Text>
        )}

        {credits.map(credit => (
          <View key={credit.id} style={styles.historyCard}>
            <View style={styles.historyLeft}>
              {getStatusIcon(credit.status)}
              <View style={styles.historyInfo}>
                <Text style={styles.historyAmount}>${credit.amount_requested} USD</Text>
                <Text style={styles.historyDate}>
                  {new Date(credit.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, 
              credit.status === 'approved' || credit.status === 'active' ? styles.statusSuccess :
              credit.status === 'rejected' ? styles.statusError : styles.statusPending
            ]}>
              <Text style={styles.statusText}>{credit.status}</Text>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.card },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  content: { padding: 20, paddingBottom: 40 },
  summaryCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 30 },
  summaryTitle: { color: COLORS.textMuted, fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  activeCreditContainer: { alignItems: 'center', paddingVertical: 10 },
  activeCreditHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  activeCreditStatus: { color: COLORS.text, fontWeight: 'bold', letterSpacing: 1 },
  activeCreditAmount: { color: COLORS.accent, fontSize: 36, fontWeight: 'bold', marginVertical: 5 },
  activeCreditTerm: { color: COLORS.textMuted, fontSize: 16 },
  noActiveCredit: { alignItems: 'center', paddingVertical: 20 },
  noActiveText: { color: COLORS.textMuted, fontSize: 16, marginBottom: 20 },
  requestBtn: { flexDirection: 'row', backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', gap: 10 },
  requestBtnText: { color: COLORS.background, fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 20 },
  historyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, padding: 15, borderRadius: 12, marginBottom: 10 },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  historyInfo: { gap: 4 },
  historyAmount: { color: COLORS.text, fontWeight: 'bold', fontSize: 16 },
  historyDate: { color: COLORS.textMuted, fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusSuccess: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  statusPending: { backgroundColor: 'rgba(245, 166, 35, 0.15)' },
  statusError: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  statusText: { fontSize: 12, fontWeight: 'bold', color: COLORS.text, textTransform: 'uppercase' }
});
