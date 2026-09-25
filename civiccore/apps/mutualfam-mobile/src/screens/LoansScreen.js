import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { loansApi, authApi } from '../api/client';

export default function LoansScreen() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [motive, setMotive] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('active'); // 'active' o 'history'

  // Estados para aportar (Hacer la vaca)
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribMethod, setContribMethod] = useState('');
  const [receiptUri, setReceiptUri] = useState(null);
  const [contributing, setContributing] = useState(false);

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

  const handleContribute = async () => {
    if (!contribAmount || !contribMethod) {
      Alert.alert('Error', 'Por favor llena todos los campos');
      return;
    }
    
    const parsedAmount = parseFloat(contribAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'El monto debe ser un número válido mayor a cero');
      return;
    }
    
    setContributing(true);
    try {
      let finalReceiptUrl = null;
      if (receiptUri) {
         const uploadRes = await loansApi.uploadFile(receiptUri);
         finalReceiptUrl = uploadRes.url;
      }

      await loansApi.contributeToLoan(selectedLoan.id, {
        amount_usd: parsedAmount,
        payment_method: contribMethod,
        receipt_url: finalReceiptUrl
      });
      setShowContributeModal(false);
      setContribAmount('');
      setContribMethod('');
      setReceiptUri(null);
      setSelectedLoan(null);
      Alert.alert('¡Gracias!', 'Tu aporte ha sido registrado.');
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
      setContributing(false);
    }
  };

  const handleRepay = (loanId) => {
    Alert.alert(
      "Saldar Préstamo",
      "¿Ya devolviste el dinero y deseas marcar el préstamo como saldado?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Sí, Saldar", 
          onPress: async () => {
            try {
              await loansApi.repayLoan(loanId);
              Alert.alert('¡Excelente!', 'El préstamo ha sido marcado como pagado.');
              fetchLoans();
            } catch (e) {
              Alert.alert('Error', e.response?.data?.detail || 'No se pudo saldar el préstamo');
            }
          }
        }
      ]
    );
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      setEstimatedDate(selectedDate.toISOString().split('T')[0]);
    }
  };

  const renderLoanCard = ({ item }) => {
    const isMine = user && user.id === item.requester_id;
    const canRepay = isMine && (item.status === 'funded' || item.status === 'partial');
    
    let statusLabel = item.status;
    if (item.status === 'pending') statusLabel = 'Buscando fondeo';
    if (item.status === 'partial') statusLabel = 'Fondeo parcial';
    if (item.status === 'funded') statusLabel = '100% Fondeado';
    if (item.status === 'repaid') statusLabel = 'Saldado ✅';
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, item.status === 'funded' && {backgroundColor: 'rgba(34, 197, 94, 0.2)'}]}>
            <Text style={[styles.badgeText, item.status === 'funded' && {color: '#4ade80'}]}>
              {statusLabel}
            </Text>
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
            <View style={{ gap: 10 }}>
              {item.status === 'pending' && (
                <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => handleCancelLoan(item.id)}>
                  <Text style={styles.cancelButtonText}>Cancelar Solicitud</Text>
                </TouchableOpacity>
              )}
              {canRepay && (
                <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#10b981'}]} onPress={() => handleRepay(item.id)}>
                  <Text style={styles.actionButtonText}>Marcar como Saldado</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            (item.status === 'pending' || item.status === 'partial') ? (
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => {
                  setSelectedLoan(item);
                  setShowContributeModal(true);
                }}
              >
                <Text style={styles.actionButtonText}>Aportar a este préstamo</Text>
              </TouchableOpacity>
            ) : null
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

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, filter === 'active' && styles.activeTab]} 
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.tabText, filter === 'active' && styles.activeTabText]}>Vigentes</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, filter === 'history' && styles.activeTab]} 
          onPress={() => setFilter('history')}
        >
          <Text style={[styles.tabText, filter === 'history' && styles.activeTabText]}>Historial</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={loans.filter(l => {
            if (filter === 'active') return ['pending', 'partial', 'funded'].includes(l.status);
            return ['repaid', 'cancelled'].includes(l.status);
          })}
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
            
            <Text style={styles.label}>Fecha Límite Sugerida</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
              <Text style={{color: estimatedDate ? '#fff' : '#94a3b8'}}>
                {estimatedDate || "Tocar para seleccionar fecha"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
            
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

      {/* Modal para aportar a un préstamo */}
      <Modal visible={showContributeModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hacer la Vaca 🐄</Text>
            <Text style={{color: '#94a3b8', marginBottom: 15}}>
              Aportando al préstamo de {selectedLoan?.requester_name}
            </Text>
            
            <Text style={styles.label}>Monto a aportar (USD)</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              value={contribAmount}
              onChangeText={setContribAmount}
              placeholder="Ej: 50"
              placeholderTextColor="#475569"
            />
            
            <Text style={styles.label}>Método de Pago</Text>
            <TextInput 
              style={styles.input}
              value={contribMethod}
              onChangeText={setContribMethod}
              placeholder="Ej: Zelle, Binance, Efectivo"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Comprobante (Opcional)</Text>
            <TouchableOpacity style={[styles.input, {alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)'}]} onPress={pickImage}>
              <Text style={{color: '#60a5fa', fontWeight: 'bold'}}>
                {receiptUri ? "✅ Imagen Seleccionada (Cambiar)" : "📸 Subir Captura / Foto"}
              </Text>
            </TouchableOpacity>
            {receiptUri && (
              <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 100, borderRadius: 8, marginBottom: 15 }} resizeMode="cover" />
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowContributeModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleContribute} disabled={contributing}>
                {contributing ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Confirmar</Text>}
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 15,
    gap: 15,
  },
  tab: {
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#3b82f6',
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
