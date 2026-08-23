import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';

const COLORS = {
  background: '#1A3C40',
  card: '#2A5155',
  accent: '#F5A623',
  text: '#FFFFFF',
  textMuted: '#9DB3B5',
  success: '#4ADE80'
};

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🤝 MutualSol</Text>
          <TouchableOpacity style={styles.notificationBtn}>
            <Text style={styles.notificationText}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Saldo Principal */}
        <View style={styles.balanceContainer}>
          <Text style={styles.greeting}>¡Hola, Carlos!</Text>
          <Text style={styles.balance}>$ 47.50 <Text style={styles.currency}>USD</Text></Text>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Fondo de Aportes</Text>
              <Text style={styles.progressText}>75%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '75%' }]} />
            </View>
          </View>
        </View>

        {/* Acciones Rápidas */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>↗️</Text>
            <Text style={styles.actionText}>Solicitar{'\n'}Crédito</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionText}>Aportar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>⇄</Text>
            <Text style={styles.actionText}>Mercado</Text>
          </TouchableOpacity>
        </View>

        {/* Transacciones Recientes */}
        <Text style={styles.sectionTitle}>Transacciones Recientes</Text>
        <View style={styles.transactionsList}>
          <View style={styles.transactionItem}>
            <View style={styles.txIconContainer}><Text>💰</Text></View>
            <View style={styles.txDetails}>
              <Text style={styles.txTitle}>Aporte Mensual</Text>
              <Text style={styles.txDate}>Ayer, 14:30</Text>
            </View>
            <Text style={styles.txAmountPos}>+$10.00 USD</Text>
          </View>
          
          <View style={styles.transactionItem}>
            <View style={styles.txIconContainer}><Text>💳</Text></View>
            <View style={styles.txDetails}>
              <Text style={styles.txTitle}>Pago de Cuota</Text>
              <Text style={styles.txDate}>12 Ago, 09:15</Text>
            </View>
            <Text style={styles.txAmountNeg}>-$5.00 USD</Text>
          </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: 'bold',
  },
  notificationBtn: {
    backgroundColor: COLORS.card,
    padding: 10,
    borderRadius: 20,
  },
  notificationText: {
    fontSize: 18,
  },
  balanceContainer: {
    marginBottom: 30,
  },
  greeting: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginBottom: 8,
  },
  balance: {
    color: COLORS.text,
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  currency: {
    fontSize: 24,
    color: COLORS.textMuted,
  },
  progressContainer: {
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  actionButton: {
    backgroundColor: COLORS.card,
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  actionIcon: {
    fontSize: 28,
    color: COLORS.accent,
    marginBottom: 10,
  },
  actionText: {
    color: COLORS.text,
    textAlign: 'center',
    fontSize: 13,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  transactionsList: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
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
    fontSize: 16,
    marginBottom: 4,
  },
  txDate: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  txAmountPos: {
    color: COLORS.success,
    fontWeight: 'bold',
  },
  txAmountNeg: {
    color: COLORS.text,
    fontWeight: 'bold',
  }
});
