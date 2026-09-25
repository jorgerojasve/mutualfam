import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loansApi, authApi } from '../api/client';

export default function LoansScreen() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [motive, setMotive] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUser = async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
    } catch (e) {
      console.warn("Could not fetch user", e);
    }
  };

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await loansApi.getLoans();
      setLoans(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los préstamos');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUser();
      fetchLoans();
    }, [])
  );

  const handleCreateRequest = async () => {
    if (!amount || !motive || !estimatedDate) {
      Alert.alert('Error', 'Por favor llena todos los campos');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'El monto debe ser un número válido mayor a cero');
      return;
    }

    // Validar formato de fecha simple (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (estimatedDate && !dateRegex.test(estimatedDate)) {
      Alert.alert('Error', 'La fecha debe tener el formato YYYY-MM-DD (ej. 2026-10-15)');
      return;
    }
    
    setSubmitting(true);
    try {
      await loansApi.createLoan({
        amount_usd: parseFloat(amount),
        motive: motive,
        estimated_repayment_date: estimatedDate || null
      });
      setShowModal(false);
      setAmount('');
      setMotive('');
      setEstimatedDate('');
      fetchLoans();
    } catch (error) {
      let errorMsg = error.message;
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMsg = error.response.data.detail.map(e => e.msg).join('\n');
        } else {
          errorMsg = typeof error.response.data.detail === 'string' 
            ? error.response.data.detail 
            : JSON.stringify(error.response.data.detail);
        }
      }
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLoan = (loanId) => {
    Alert.alert(
      "Cancelar Solicitud",
      "¿Seguro que deseas cancelar esta solicitud?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Sí, Cancelar", 
          style: "destructive",
          onPress: async () => {
            try {
              await loansApi.cancelLoan(loanId);
              fetchLoans();
            } catch (e) {
              Alert.alert('Error', 'No se pudo cancelar');
            }
          }
        }
      ]
    );
  };

  const renderLoanCard = ({ item }) => {
    const isMine = user && user.id === item.requester_id;
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.status === 'pending' ? 'Buscando fondeo' : item.status}</Text>
          </View>
          <Text style={styles.amountText}>${item.amount_usd}</Text>
        </View>
        
        <Text style={styles.requesterName}>{item.requester_name}</Text>
        <Text style={styles.motiveText}>{item.motive}</Text>
        
        {item.estimated_repayment_date && (
          <Text style={styles.dateText}>
            📅 Lo paga el: {item.estimated_repayment_date}
          </Text>
        )}
        
        <View style={styles.cardFooter}>
          {isMine ? (
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => handleCancelLoan(item.id)}>
              <Text style={styles.cancelButtonText}>Cancelar Solicitud</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Próximamente', 'Hacer la vaca')}>
              <Text style={styles.actionButtonText}>Aportar a este préstamo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Préstamos</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
          <Text style={styles.addButtonText}>Pedir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={loans.filter(l => l.status !== 'cancelled')}
          keyExtractor={item => item.id.toString()}
          renderItem={renderLoanCard}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay préstamos activos</Text>
          }
        />
      )}

      {/* Modal para crear préstamo */}
      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Solicitar Préstamo</Text>
            
            <Text style={styles.label}>Monto (USD)</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            
            <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
            <TextInput 
              style={styles.input}
              value={estimatedDate}
              onChangeText={setEstimatedDate}
              placeholder="Ej: 2026-10-15"
              placeholderTextColor="#94a3b8"
            />
            
            <Text style={styles.label}>Motivo</Text>
            <TextInput 
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              multiline
              value={motive}
              onChangeText={setMotive}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancelText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleCreateRequest} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Enviar</Text>}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  amountText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  requesterName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  motiveText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 10,
  },
  dateText: {
    color: '#8b5cf6',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 15,
    marginTop: 5,
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
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 25,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  label: {
    color: '#94a3b8',
    marginBottom: 5,
    fontSize: 14,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    marginBottom: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  modalCancel: {
    padding: 12,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  modalSubmit: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
