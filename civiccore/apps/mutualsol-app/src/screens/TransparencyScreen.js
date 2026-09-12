import React from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { Shield, Eye, Users, Landmark, Banknote, History } from 'lucide-react-native';
import { useConfigStore } from '@civiccore/sdk';

const MOCK_GLOBAL_TRANSACTIONS = [
  { id: 'tx-1', type: 'aporte', amount: 10.00, user: 'Miembro #402', date: 'Hace 2h', description: 'Aporte Mensual' },
  { id: 'tx-2', type: 'credito', amount: 150.00, user: 'Miembro #189', date: 'Hace 5h', description: 'Crédito Asignado' },
  { id: 'tx-3', type: 'pago', amount: 35.00, user: 'Miembro #045', date: 'Ayer', description: 'Pago de Cuota' },
  { id: 'tx-4', type: 'aporte', amount: 10.00, user: 'Miembro #812', date: 'Ayer', description: 'Aporte Mensual' },
  { id: 'tx-5', type: 'aporte', amount: 20.00, user: 'Miembro #233', date: '12 Ago', description: 'Aporte Extraordinario' },
];

export default function TransparencyScreen() {
  const { terminology } = useConfigStore();

  const renderTransaction = ({ item }) => {
    const isPositive = item.type === 'aporte' || item.type === 'pago';
    const IconComponent = item.type === 'aporte' ? Users : (item.type === 'pago' ? Banknote : Landmark);
    
    return (
      <View key={item.id} style={styles.transactionItem}>
        <View style={styles.txIconContainer}>
          <IconComponent color={COLORS.accent} size={20} />
        </View>
        <View style={styles.txDetails}>
          <Text style={styles.txTitle}>{item.description}</Text>
          <Text style={styles.txUser}>{item.user} • {item.date}</Text>
        </View>
        <Text style={[styles.txAmount, isPositive ? styles.amountPositive : styles.amountNegative]}>
          {isPositive ? '+' : '-'}${item.amount.toFixed(2)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Shield color={COLORS.success} size={28} />
          <Text style={styles.headerTitle}>{terminology.transparency} Pública</Text>
        </View>

        <Text style={styles.subtitle}>
          MutualSol opera con total transparencia. Todos los movimientos del fondo común son auditables.
        </Text>

        {/* Global Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Landmark color={COLORS.textMuted} size={24} style={styles.metricIcon} />
            <Text style={styles.metricLabel}>Fondo Total</Text>
            <Text style={styles.metricValue}>$ 12,450</Text>
          </View>
          <View style={styles.metricCard}>
            <Banknote color={COLORS.textMuted} size={24} style={styles.metricIcon} />
            <Text style={styles.metricLabel}>Créditos Activos</Text>
            <Text style={styles.metricValue}>$ 8,100</Text>
          </View>
          <View style={styles.metricCardFull}>
            <View style={styles.liquidityHeader}>
              <Text style={styles.metricLabel}>Liquidez Disponible</Text>
              <Text style={styles.liquidityValue}>$ 4,350</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '35%' }]} />
            </View>
            <Text style={styles.liquidityPercent}>35% del fondo total</Text>
          </View>
        </View>

        {/* Public Ledger */}
        <View style={styles.ledgerHeader}>
          <History color={COLORS.text} size={20} />
          <Text style={styles.sectionTitle}>Libro Mayor Comunitario</Text>
        </View>
        
        <View style={styles.ledgerContainer}>
          {MOCK_GLOBAL_TRANSACTIONS.map(item => renderTransaction({ item }))}
        </View>
        
        <View style={styles.footerNote}>
          <Eye color={COLORS.textMuted} size={16} />
          <Text style={styles.footerText}>Los identificadores de usuario protegen la privacidad mientras garantizan la trazabilidad matemática.</Text>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 25,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  metricCard: {
    backgroundColor: COLORS.card,
    width: '48%',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricCardFull: {
    backgroundColor: COLORS.card,
    width: '100%',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricIcon: {
    marginBottom: 10,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 5,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  liquidityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  liquidityValue: {
    color: COLORS.success,
    fontSize: 22,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 4,
  },
  liquidityPercent: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  ledgerContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  txDetails: {
    flex: 1,
  },
  txTitle: {
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 4,
  },
  txUser: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  txAmount: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  amountPositive: {
    color: COLORS.text,
  },
  amountNegative: {
    color: COLORS.accent,
  },
  footerNote: {
    flexDirection: 'row',
    marginTop: 20,
    padding: 15,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  }
});
