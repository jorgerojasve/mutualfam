import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fundsApi } from '../api/client';
import ScreenTitle from '../components/ScreenTitle';
import { OrgContext } from '../context/OrgContext';

export default function FundsScreen() {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeOrg } = React.useContext(OrgContext);
  const [showModal, setShowModal] = useState(false);
  const [newFundName, setNewFundName] = useState('');
  const [newFundType, setNewFundType] = useState('emergency');
  const [newFundTarget, setNewFundTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreateFund = async () => {
    if (!newFundName) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    setSubmitting(true);
    try {
      await fundsApi.createFund({
        name: newFundName,
        fund_type: newFundType,
        target_monthly_contribution_usd: newFundTarget ? parseFloat(newFundTarget) : null
      });
      setShowModal(false);
      setNewFundName('');
      setNewFundTarget('');
      fetchFunds();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Error al crear fondo');
    } finally {
      setSubmitting(false);
    }
  };

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
      if (activeOrg?.id) fetchFunds();
    }, [activeOrg?.id])
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
        <ScreenTitle
          title="Fondos Comunes"
          right={activeOrg?.role === 'founder' && (
            <TouchableOpacity style={styles.headerAddButton} onPress={() => setShowModal(true)}>
              <Text style={styles.headerAddButtonText}>Crear Fondo</Text>
            </TouchableOpacity>
          )}
        />
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

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Fondo</Text>
            
            <Text style={styles.label}>Nombre del Fondo</Text>
            <TextInput style={styles.input} value={newFundName} onChangeText={setNewFundName} placeholder="Ej: Fondo de Emergencia" placeholderTextColor="#475569" />
            
            <Text style={styles.label}>Aporte Mensual Sugerido (USD) - Opcional</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={newFundTarget} onChangeText={setNewFundTarget} placeholder="Ej: 10" placeholderTextColor="#475569" />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowModal(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleCreateFund} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Crear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 20,
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
  },
  headerAddButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  headerAddButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 20,
  },
  label: {
    color: '#94a3b8',
    marginBottom: 5,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalCancel: {
    padding: 12,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  modalSubmit: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
