import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banknote, FileText, ChevronRight, CheckCircle, Clock } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

import { usePayments } from '../hooks/usePayments';

export default function FinanceScreen() {
  const { transactions, loading, error } = usePayments(1); // using member 1 for prototype

  // Map backend format to UI format
  const mappedPayments = transactions.map(t => ({
    id: t.id.toString(),
    title: t.extra_fields?.title || (t.transaction_type === 'charge' ? 'Cargo' : 'Pago'),
    amount: `$${t.amount.toFixed(2)}`,
    status: t.status === 'completed' ? 'paid' : t.status,
    dueDate: new Date(t.created_at).toLocaleDateString()
  }));

  // For the UI, we could calculate the balance, but we'll mock it for the demo
  const pendingBalance = 150.00;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Banknote color={COLORS.accent} size={28} />
        <Text style={styles.headerTitle}>Finanzas y Pagos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Estado de Cuenta</Text>
          <Text style={styles.balanceAmount}>$150.00 <Text style={styles.balanceCurrency}>USD</Text></Text>
          <Text style={styles.balanceSubtitle}>Saldo Pendiente</Text>
          
          <TouchableOpacity style={styles.payButton}>
            <Text style={styles.payButtonText}>Pagar Saldo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Historial de Pagos</Text>

        <View style={styles.listContainer}>
          {loading ? (
            <Text style={{color: COLORS.text, textAlign: 'center', padding: 20}}>Cargando pagos...</Text>
          ) : error ? (
            <Text style={{color: 'red', textAlign: 'center', padding: 20}}>Error: {error}</Text>
          ) : mappedPayments.length === 0 ? (
            <Text style={{color: COLORS.textMuted, textAlign: 'center', padding: 20}}>No hay historial de pagos.</Text>
          ) : mappedPayments.map(payment => (
            <TouchableOpacity key={payment.id} style={styles.paymentItem}>
              <View style={styles.paymentIconContainer}>
                {payment.status === 'paid' ? (
                  <CheckCircle color={COLORS.success} size={24} />
                ) : (
                  <Clock color={COLORS.accent} size={24} />
                )}
              </View>
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentTitle}>{payment.title}</Text>
                <Text style={styles.paymentDate}>Vence: {payment.dueDate}</Text>
              </View>
              <View style={styles.paymentAmountContainer}>
                <Text style={styles.paymentAmount}>{payment.amount}</Text>
                <View style={[
                  styles.statusBadge, 
                  { backgroundColor: payment.status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(245,166,35,0.1)' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: payment.status === 'paid' ? COLORS.success : COLORS.accent }
                  ]}>
                    {payment.status === 'paid' ? 'Pagado' : 'Pendiente'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  scrollContent: {
    padding: 20,
  },
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceLabel: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginBottom: 10,
  },
  balanceAmount: {
    color: COLORS.text,
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  balanceCurrency: {
    fontSize: 24,
    color: COLORS.textMuted,
  },
  balanceSubtitle: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
  },
  payButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
  },
  payButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  listContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  paymentIconContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentDetails: {
    flex: 1,
    marginLeft: 10,
  },
  paymentTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentDate: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  paymentAmountContainer: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  }
});
