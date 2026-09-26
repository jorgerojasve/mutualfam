import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Image, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { loansApi, authApi } from '../api/client';

const AVAILABLE_PAYMENT_METHODS = ["Pago Móvil", "Zelle", "Efectivo USD", "Efectivo Bolívares", "Transferencia Bancaria", "Binance"];

export default function LoansScreen() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Crear préstamo
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [motive, setMotive] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());
  const [acceptedMethods, setAcceptedMethods] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('active');

  // Prometer aporte
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledging, setPledging] = useState(false);

  // Notificar pago
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [selectedContrib, setSelectedContrib] = useState(null);
  const [notifyMethod, setNotifyMethod] = useState('');
  const [receiptUri, setReceiptUri] = useState(null);
  const [notifying, setNotifying] = useState(false);

  // Configurar Métodos de Pago
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);

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

  const handleOpenConfig = async () => {
    try {
      const res = await loansApi.getPaymentMethods();
      setPaymentConfig(JSON.parse(res.payment_methods_json || "{}"));
      setShowConfigModal(true);
    } catch (e) {
      Alert.alert("Error", "No se pudo cargar la configuración de pagos.");
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await loansApi.updatePaymentMethods(JSON.stringify(paymentConfig));
      Alert.alert("Guardado", "Tus datos de pago han sido guardados exitosamente.");
      setShowConfigModal(false);
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar la configuración.");
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleMethod = (method) => {
    setAcceptedMethods(prev => 
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  const handleCreateRequest = async () => {
    if (!amount || !motive || !estimatedDate) {
      Alert.alert('Error', 'Por favor llena todos los campos');
      return;
    }
    if (acceptedMethods.length === 0) {
      Alert.alert('Error', 'Debes aceptar al menos un método de pago');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'El monto debe ser un número válido mayor a cero');
      return;
    }
    setSubmitting(true);
    try {
      await loansApi.createLoan({
        amount_usd: parsedAmount,
        motive: motive,
        estimated_repayment_date: estimatedDate || null,
        accepted_payment_methods: acceptedMethods
      });
      setShowModal(false);
      setAmount('');
      setMotive('');
      setEstimatedDate('');
      setAcceptedMethods([]);
      fetchLoans();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLoan = (loanId) => {
    Alert.alert("Cancelar Solicitud", "¿Seguro que deseas cancelar esta solicitud?", [
      { text: "No", style: "cancel" },
      { text: "Sí, Cancelar", style: "destructive", onPress: async () => {
          try { await loansApi.cancelLoan(loanId); fetchLoans(); }
          catch (e) { Alert.alert('Error', 'No se pudo cancelar'); }
      }}
    ]);
  };

  const handlePledge = async () => {
    if (!pledgeAmount) {
      Alert.alert('Error', 'Por favor ingresa un monto'); return;
    }
    const parsedAmount = parseFloat(pledgeAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'El monto debe ser válido'); return;
    }
    setPledging(true);
    try {
      await loansApi.contributeToLoan(selectedLoan.id, parsedAmount);
      setShowPledgeModal(false);
      setPledgeAmount('');
      setSelectedLoan(null);
      Alert.alert('¡Gracias!', 'Has prometido un aporte.');
      fetchLoans();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || error.message);
    } finally {
      setPledging(false);
    }
  };

  const handleNotify = async () => {
    if (!notifyMethod) {
      Alert.alert('Error', 'Debes elegir el método de pago que usaste'); return;
    }
    setNotifying(true);
    try {
      let finalReceiptUrl = null;
      if (receiptUri) {
         const uploadRes = await loansApi.uploadFile(receiptUri);
         finalReceiptUrl = uploadRes.url;
      }
      await loansApi.notifyPayment(selectedContrib.id, {
        payment_method: notifyMethod,
        receipt_url: finalReceiptUrl
      });
      setShowNotifyModal(false);
      setNotifyMethod('');
      setReceiptUri(null);
      setSelectedContrib(null);
      setSelectedLoan(null);
      Alert.alert('¡Notificado!', 'El pago ha sido notificado al receptor.');
      fetchLoans();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || error.message);
    } finally {
      setNotifying(false);
    }
  };

  const handleVerify = (contribId) => {
    Alert.alert("Validar Pago", "¿Confirmas que recibiste este pago?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sí, Validar", onPress: async () => {
          try {
            await loansApi.verifyPayment(contribId);
            Alert.alert('Exito', 'Pago verificado correctamente.');
            fetchLoans();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'No se pudo verificar el pago');
          }
      }}
    ]);
  };

  const handleRepay = (loanId) => {
    Alert.alert("Saldar Préstamo", "¿Ya devolviste el dinero y deseas marcar el préstamo como saldado?", [
      { text: "No", style: "cancel" },
      { text: "Sí, Saldar", onPress: async () => {
          try {
            await loansApi.repayLoan(loanId);
            Alert.alert('¡Excelente!', 'El préstamo ha sido marcado como pagado.');
            fetchLoans();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'No se pudo saldar el préstamo');
          }
      }}
    ]);
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
    if (item.status === 'cancelled') statusLabel = 'Cancelado';
    
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

        {item.accepted_payment_methods && item.accepted_payment_methods.length > 0 && (
          <Text style={styles.methodsText}>
            💳 Acepta: {item.accepted_payment_methods.join(", ")}
          </Text>
        )}

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>📢 Prometido: ${item.amount_pledged}</Text>
          <Text style={styles.progressText}>💸 Pagado: ${item.amount_paid}</Text>
          <Text style={styles.progressText}>✅ Validado: ${item.amount_verified}</Text>
        </View>

        {item.contributions && item.contributions.length > 0 && (
          <View style={styles.contribsList}>
            <Text style={styles.contribsTitle}>Aportes en curso:</Text>
            {item.contributions.map(c => (
              <View key={c.id} style={styles.contribRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.contribName}>{c.funder_name} - ${c.amount_usd}</Text>
                  <Text style={styles.contribStatus}>
                    {c.status === 'pledged' ? '⏳ Prometido (Por pagar)' : 
                     c.status === 'paid' ? '🟡 Pagado (Por validar)' : '✅ Validado'}
                  </Text>
                  {c.status === 'paid' && c.payment_method && (
                    <Text style={{color: '#94a3b8', fontSize: 12}}>Vía {c.payment_method}</Text>
                  )}
                  {c.status === 'paid' && c.receipt_url && (
                    <Text style={{color: '#3b82f6', fontSize: 12}}>Tiene comprobante adjunto</Text>
                  )}
                </View>
                
                <View style={{flexDirection: 'row', gap: 5}}>
                  {c.funder_id === user?.id && c.status === 'pledged' && (
                    <TouchableOpacity style={styles.smallActionBtn} onPress={() => {
                      setSelectedContrib(c);
                      setSelectedLoan(item); // to know accepted methods & info
                      setNotifyMethod('');
                      setShowNotifyModal(true);
                    }}>
                      <Text style={styles.smallActionText}>Notificar Pago</Text>
                    </TouchableOpacity>
                  )}
                  {isMine && c.status === 'paid' && (
                    <TouchableOpacity style={[styles.smallActionBtn, {backgroundColor: '#10b981'}]} onPress={() => handleVerify(c.id)}>
                      <Text style={styles.smallActionText}>Validar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
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
            (item.status === 'pending' || item.status === 'partial') && (
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => {
                  setSelectedLoan(item);
                  setShowPledgeModal(true);
                }}
              >
                <Text style={styles.actionButtonText}>Prometer Aporte</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Préstamos</Text>
        <View style={{flexDirection: 'row', gap: 10}}>
          <TouchableOpacity style={[styles.addButton, {backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3b82f6'}]} onPress={handleOpenConfig}>
            <Text style={[styles.addButtonText, {color: '#3b82f6'}]}>⚙️ Datos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
            <Text style={styles.addButtonText}>Pedir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, filter === 'active' && styles.activeTab]} onPress={() => setFilter('active')}>
          <Text style={[styles.tabText, filter === 'active' && styles.activeTabText]}>Vigentes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, filter === 'history' && styles.activeTab]} onPress={() => setFilter('history')}>
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
          ListEmptyComponent={<Text style={styles.emptyText}>No hay préstamos para esta vista</Text>}
        />
      )}

      {/* Modal para crear préstamo */}
      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {maxHeight: '90%'}]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Solicitar Préstamo</Text>
              
              <Text style={styles.label}>Monto (USD)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} />
              
              <Text style={styles.label}>Fecha Límite Sugerida</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                <Text style={{color: estimatedDate ? '#fff' : '#94a3b8'}}>{estimatedDate || "Tocar para seleccionar fecha"}</Text>
              </TouchableOpacity>
              {showDatePicker && <DateTimePicker value={dateObj} mode="date" display="default" onChange={onDateChange} />}
              
              <Text style={styles.label}>Motivo</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={motive} onChangeText={setMotive} />
              
              <Text style={styles.label}>Métodos de Pago que Aceptas</Text>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20}}>
                {AVAILABLE_PAYMENT_METHODS.map(method => {
                  const isSelected = acceptedMethods.includes(method);
                  return (
                    <TouchableOpacity 
                      key={method} 
                      style={[styles.methodChip, isSelected && styles.methodChipSelected]}
                      onPress={() => toggleMethod(method)}
                    >
                      <Text style={[styles.methodChipText, isSelected && {color: '#fff'}]}>{method}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowModal(false)}><Text style={styles.modalCancelText}>Cerrar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmit} onPress={handleCreateRequest} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Enviar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Configurar Datos de Pago */}
      <Modal visible={showConfigModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {maxHeight: '90%'}]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Mis Datos de Pago</Text>
              <Text style={{color: '#94a3b8', marginBottom: 15}}>Configura cómo deseas recibir el dinero para que los aportantes puedan pagarte.</Text>
              
              {AVAILABLE_PAYMENT_METHODS.map(method => (
                <View key={method}>
                  <Text style={styles.label}>{method}</Text>
                  <TextInput 
                    style={styles.input} 
                    value={paymentConfig[method] || ''} 
                    onChangeText={text => setPaymentConfig({...paymentConfig, [method]: text})}
                    placeholder={`Datos para ${method}`}
                    placeholderTextColor="#475569"
                  />
                </View>
              ))}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowConfigModal(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmit} onPress={handleSaveConfig} disabled={savingConfig}>
                  {savingConfig ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Prometer Aporte */}
      <Modal visible={showPledgeModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Prometer Aporte 🤝</Text>
            <Text style={{color: '#94a3b8', marginBottom: 15}}>Vas a prometer un aporte para: {selectedLoan?.requester_name}</Text>
            
            <Text style={styles.label}>Monto a prometer (USD)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={pledgeAmount} onChangeText={setPledgeAmount} placeholder="Ej: 50" placeholderTextColor="#475569" />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPledgeModal(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handlePledge} disabled={pledging}>
                {pledging ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Prometer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Notificar Pago */}
      <Modal visible={showNotifyModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {maxHeight: '90%'}]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Notificar Pago 💸</Text>
              <Text style={{color: '#94a3b8', marginBottom: 15}}>Notificando pago de ${selectedContrib?.amount_usd}</Text>
              
              <Text style={styles.label}>Método que usaste</Text>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20}}>
                {selectedLoan?.accepted_payment_methods?.map(method => {
                  const isSelected = notifyMethod === method;
                  return (
                    <TouchableOpacity 
                      key={method} 
                      style={[styles.methodChip, isSelected && styles.methodChipSelected]}
                      onPress={() => setNotifyMethod(method)}
                    >
                      <Text style={[styles.methodChipText, isSelected && {color: '#fff'}]}>{method}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {notifyMethod ? (
                <View style={{backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 15, borderRadius: 8, marginBottom: 15}}>
                  <Text style={{color: '#60a5fa', fontWeight: 'bold', marginBottom: 5}}>Instrucciones de Pago ({notifyMethod}):</Text>
                  {selectedLoan?.requester_payment_methods_json && JSON.parse(selectedLoan.requester_payment_methods_json)[notifyMethod] ? (
                    <Text style={{color: '#f8fafc', fontSize: 16}}>{JSON.parse(selectedLoan.requester_payment_methods_json)[notifyMethod]}</Text>
                  ) : (
                    <Text style={{color: '#94a3b8'}}>El solicitante no configuró datos para este método. Deberás coordinar por otro medio.</Text>
                  )}
                </View>
              ) : null}

              <Text style={styles.label}>Comprobante (Opcional)</Text>
              <TouchableOpacity style={[styles.input, {alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)'}]} onPress={pickImage}>
                <Text style={{color: '#60a5fa', fontWeight: 'bold'}}>{receiptUri ? "✅ Imagen Seleccionada (Cambiar)" : "📸 Subir Captura / Foto"}</Text>
              </TouchableOpacity>
              {receiptUri && <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 100, borderRadius: 8, marginBottom: 15 }} resizeMode="cover" />}
              
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNotifyModal(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmit} onPress={handleNotify} disabled={notifying}>
                  {notifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Confirmar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#f8fafc' },
  addButton: { backgroundColor: '#3b82f6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 15, gap: 15 },
  tab: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#3b82f6' },
  tabText: { color: '#94a3b8', fontSize: 16, fontWeight: 'bold' },
  activeTabText: { color: '#3b82f6' },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 50 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { backgroundColor: 'rgba(59, 130, 246, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold' },
  amountText: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
  requesterName: { fontSize: 16, fontWeight: 'bold', color: '#f8fafc', marginBottom: 4 },
  motiveText: { color: '#94a3b8', fontSize: 14, marginBottom: 10 },
  dateText: { color: '#8b5cf6', fontSize: 13, fontWeight: 'bold', marginBottom: 5 },
  methodsText: { color: '#cbd5e1', fontSize: 12, marginBottom: 10, fontStyle: 'italic' },
  progressContainer: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, marginBottom: 10 },
  progressText: { color: '#cbd5e1', fontSize: 13, marginBottom: 2 },
  contribsList: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8 },
  contribsTitle: { color: '#f8fafc', fontWeight: 'bold', marginBottom: 8, fontSize: 13 },
  contribRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  contribName: { color: '#e2e8f0', fontSize: 14, fontWeight: 'bold' },
  contribStatus: { color: '#94a3b8', fontSize: 12 },
  smallActionBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  smallActionText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  cardFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 15, marginTop: 5 },
  actionButton: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: 'bold' },
  cancelButton: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  cancelButtonText: { color: '#ef4444', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', borderRadius: 16, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  label: { color: '#94a3b8', marginBottom: 5, fontSize: 14 },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: 12, marginBottom: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 },
  modalCancel: { padding: 12, borderRadius: 8 },
  modalCancelText: { color: '#94a3b8', fontWeight: 'bold' },
  modalSubmit: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  modalSubmitText: { color: '#fff', fontWeight: 'bold' },
  methodChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#3b82f6', backgroundColor: 'transparent' },
  methodChipSelected: { backgroundColor: '#3b82f6' },
  methodChipText: { color: '#3b82f6', fontSize: 13, fontWeight: 'bold' }
});
