import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fundsApi } from '../api/client';

export default function FundsScreen() {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFunds = async () => {
    setLoading(true);
    try {
      const data = await fundsApi.getFunds();
      setFunds(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los fondos');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFunds();
    }, [])
  );

  const renderFundCard = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.fundName}>{item.name}</Text>
      <Text style={styles.fundType}>
        {item.fund_type === 'emergency' ? '🚨 Fondo de Emergencia' : '💰 Ahorro'}
      </Text>
      
      {item.target_monthly_contribution_usd && (
        <View style={styles.contributionBox}>
          <Text style={styles.contributionLabel}>Aporte mensual sugerido</Text>
          <Text style={styles.contributionAmount}>
            ${item.target_monthly_contribution_usd} <Text style={styles.currencyText}>USD</Text>
          </Text>
        </View>
      )}
      
      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Próximamente', 'Hacer aporte mensual')}>
          <Text style={styles.actionButtonText}>Aportar al Fondo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fondos Comunes</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={funds}
          keyExtractor={item => item.id.toString()}
          renderItem={renderFundCard}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay fondos creados</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 50,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  fundName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 5,
  },
  fundType: {
    color: '#94a3b8',
    fontSize: 14,
    textTransform: 'capitalize',
    marginBottom: 15,
  },
  contributionBox: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 15,
  },
  contributionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 5,
  },
  contributionAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  currencyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 15,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
