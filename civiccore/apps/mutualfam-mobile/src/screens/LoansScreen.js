import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Image, ScrollView, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { loansApi, authApi } from '../api/client';
import MutualHeader from '../components/MutualHeader';
import { OrgContext } from '../context/OrgContext';

const AVAILABLE_PAYMENT_METHODS = ["Pago Móvil", "Zelle", "Efectivo USD", "Efectivo Bolívares", "Transferencia Bancaria", "Binance"];

export default function LoansScreen() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const { activeOrg } = React.useContext(OrgContext);
  
  const serverUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8002/api/v1').replace('/api/v1', '');
  
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
  const [referenceText, setReferenceText] = useState('');
  const [notifying, setNotifying] = useState(false);

  // Devolver dinero
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repaying, setRepaying] = useState(false);

  // Configurar Métodos de Pago
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [selectedConfigMethod, setSelectedConfigMethod] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [bcvRate, setBcvRate] = useState(null);
  const [bcvDate, setBcvDate] = useState(null);
  const [isBcvOutdated, setIsBcvOutdated] = useState(false);
  const [manualBcvRate, setManualBcvRate] = useState('');

  const fetchConfig = async () => {
    try {
      const data = await loansApi.getAppConfig();
      setBcvRate(data.bcv_rate);
      setBcvDate(data.bcv_date);
      setIsBcvOutdated(data.is_bcv_outdated);
    } catch (e) {
      console.warn("Could not fetch config", e);
    }
  };

  const fetchUser = async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
    } catch (e) {
      console.warn("Could not fetch user", e);
    }
  };

  const effectiveBcvRate = manualBcvRate ? parseFloat(manualBcvRate.replace(',', '.')) : bcvRate;

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
      fetchConfig();
      fetchUser();
      if (activeOrg?.id) fetchLoans();
    }, [activeOrg?.id])
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
    const configToSave = { ...paymentConfig };
    
    // Check all methods, remove empty ones
    for (const method of Object.keys(configToSave)) {
      if (method === 'Pago Móvil') {
        const pm = configToSave['Pago Móvil'];
        if (typeof pm === 'object') {
          const isEmpty = !pm.banco && !pm.telefono && !pm.cedula;
          if (isEmpty) {
            delete configToSave['Pago Móvil'];
          } else if (!pm.banco || !pm.telefono || !pm.cedula) {
            Alert.alert('Incompleto', 'Por favor completa todos los campos de Pago Móvil (banco, documento y teléfono) o déjalos todos en blanco para eliminar el método.');
            return;
          }
        }
      } else {
        // Other methods (string)
        if (!configToSave[method] || configToSave[method].trim() === '') {
          delete configToSave[method];
        }
      }
    }
    
    setSavingConfig(true);
    try {
      await loansApi.updatePaymentMethods(JSON.stringify(configToSave));
      setPaymentConfig(configToSave);
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
    
    setSubmitting(true);
    try {
      // Validar que los métodos aceptados estén configurados
      const res = await loansApi.getPaymentMethods();
      const userConfig = JSON.parse(res.payment_methods_json || "{}");
      
      const missingMethods = acceptedMethods.filter(m => {
         if (m === 'Pago Móvil') {
            const pm = userConfig[m];
            return !pm || !pm.banco || !pm.telefono || !pm.cedula;
         }
         return !userConfig[m] || userConfig[m].trim() === '';
      });
      
      if (missingMethods.length > 0) {
         Alert.alert(
           'Faltan Datos de Pago', 
           `Has seleccionado métodos de pago que no has configurado: ${missingMethods.join(', ')}.\nPor favor, ve a "⚙️ Datos" y complétalos primero.`
         );
         setSubmitting(false);
         return;
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Error', 'El monto debe ser un número válido mayor a cero');
        setSubmitting(false);
        return;
      }

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
        receipt_url: finalReceiptUrl,
        reference_text: referenceText
      });
      setShowNotifyModal(false);
      setNotifyMethod('');
      setReceiptUri(null);
      setReferenceText('');
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

  const handleCancelContribution = (contribId) => {
    Alert.alert("Cancelar Aporte", "¿Estás seguro de que deseas cancelar tu promesa de aporte?", [
      { text: "No", style: "cancel" },
      { text: "Sí, cancelar", style: "destructive", onPress: async () => {
          try {
            await loansApi.cancelContribution(contribId);
            Alert.alert("Cancelado", "Tu aporte ha sido cancelado exitosamente.");
            fetchLoans();
          } catch (error) {
            Alert.alert('Error', error.response?.data?.detail || error.message);
          }
      }}
    ]);
  };

  const handleNotifyRepayment = async () => {
    if (!notifyMethod || !repayAmount) {
      Alert.alert('Error', 'Debes elegir el método de pago y el monto'); return;
    }
    const parsedAmount = parseFloat(repayAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Monto inválido'); return;
    }
    setRepaying(true);
    try {
      let finalReceiptUrl = null;
      if (receiptUri) {
         const uploadRes = await loansApi.uploadFile(receiptUri);
         finalReceiptUrl = uploadRes.url;
      }
      await loansApi.notifyRepayment(selectedContrib.id, {
        amount_usd: parsedAmount,
        payment_method: notifyMethod,
        receipt_url: finalReceiptUrl,
        reference_text: referenceText
      });
      setShowRepayModal(false);
      setNotifyMethod('');
      setRepayAmount('');
      setReceiptUri(null);
      setReferenceText('');
      setSelectedContrib(null);
      setSelectedLoan(null);
      Alert.alert('¡Notificado!', 'Tu devolución ha sido notificada al aportante.');
      fetchLoans();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || error.message);
    } finally {
      setRepaying(false);
    }
  };

  const handleVerifyRepayment = (repayId) => {
    Alert.alert("Validar Devolución", "¿Confirmas que recibiste tu dinero de vuelta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sí, Validar", onPress: async () => {
          try {
            await loansApi.verifyRepayment(repayId);
            Alert.alert('Exito', 'Devolución verificada correctamente.');
            fetchLoans();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'No se pudo verificar la devolución');
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
                  {c.reference_text && (
                    <Text style={{color: '#94a3b8', fontSize: 12}}>Referencia: {c.reference_text}</Text>
                  )}
                  {c.status === 'paid' && c.receipt_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(serverUrl + c.receipt_url)}>
                      <Text style={{color: '#3b82f6', fontSize: 12, textDecorationLine: 'underline'}}>Ver comprobante adjunto</Text>
                    </TouchableOpacity>
                  )}
                  {c.repayments && c.repayments.map(r => (
                     <View key={r.id} style={{marginTop: 5, padding: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 5}}>
                        <Text style={{color: '#f8fafc', fontSize: 12}}>↪ Devolución de ${r.amount_usd}</Text>
                        <Text style={{color: r.status === 'paid' ? '#eab308' : '#10b981', fontSize: 11}}>
                           Estatus: {r.status === 'paid' ? 'Por validar' : 'Validada'}
                        </Text>
                        {r.reference_text && (
                          <Text style={{color: '#94a3b8', fontSize: 11}}>Ref: {r.reference_text}</Text>
                        )}
                        {r.receipt_url && (
                          <TouchableOpacity onPress={() => Linking.openURL(serverUrl + r.receipt_url)}>
                            <Text style={{color: '#3b82f6', fontSize: 11, textDecorationLine: 'underline'}}>Ver comprobante</Text>
                          </TouchableOpacity>
                        )}
                        {c.funder_id === user?.id && r.status === 'paid' && (
                          <TouchableOpacity style={[styles.smallActionBtn, {backgroundColor: '#10b981', marginTop: 5, alignSelf: 'flex-start'}]} onPress={() => handleVerifyRepayment(r.id)}>
                            <Text style={styles.smallActionText}>Validar Devolución</Text>
                          </TouchableOpacity>
                        )}
                     </View>
                  ))}
                </View>
                
                <View style={{flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 5}}>
                  {c.funder_id === user?.id && c.status === 'pledged' && (
                    <>
                      <TouchableOpacity style={[styles.smallActionBtn, {backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: '#ef4444'}]} onPress={() => handleCancelContribution(c.id)}>
                        <Text style={{color: '#ef4444', fontSize: 12, fontWeight: 'bold'}}>❌</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallActionBtn} onPress={() => {
                        setSelectedContrib(c);
                        setSelectedLoan(item); // to know accepted methods & info
                        setNotifyMethod('');
                        setShowNotifyModal(true);
                      }}>
                        <Text style={styles.smallActionText}>Notificar Pago</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {isMine && c.status === 'paid' && (
                    <TouchableOpacity style={[styles.smallActionBtn, {backgroundColor: '#10b981'}]} onPress={() => handleVerify(c.id)}>
                      <Text style={styles.smallActionText}>Validar</Text>
                    </TouchableOpacity>
                  )}
                  {isMine && (c.status === 'verified' || c.status === 'repay_notified') && (
                    <TouchableOpacity style={[styles.smallActionBtn, {backgroundColor: '#f59e0b'}]} onPress={() => {
                        setSelectedContrib(c);
                        setSelectedLoan(item);
                        setNotifyMethod('');
                        setRepayAmount(c.amount_usd.toString());
                        setShowRepayModal(true);
                    }}>
                      <Text style={styles.smallActionText}>Devolver</Text>
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
        <MutualHeader title="Préstamos" />
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          {bcvRate ? (
            <Text style={{color: isBcvOutdated ? '#ef4444' : '#94a3b8', fontSize: 13}}>
              🏦 Tasa BCV: {bcvRate} Bs/USD {isBcvOutdated ? '(⚠️ Desactualizada)' : ''}
            </Text>
          ) : <View />}
          <View style={{flexDirection: 'row', gap: 10}}>
            <TouchableOpacity style={[styles.addButton, {backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 8, paddingHorizontal: 12}]} onPress={handleOpenConfig}>
              <Text style={[styles.addButtonText, {color: '#3b82f6', fontSize: 14}]}>⚙️ Datos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addButton, {paddingVertical: 8, paddingHorizontal: 12}]} onPress={() => setShowModal(true)}>
              <Text style={[styles.addButtonText, {fontSize: 14}]}>Pedir</Text>
            </TouchableOpacity>
          </View>
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
              {!selectedConfigMethod ? (
                <>
                  <Text style={styles.modalTitle}>Mis Datos de Pago</Text>
                  <Text style={{color: '#94a3b8', marginBottom: 15}}>Selecciona un método para configurarlo.</Text>
                  
                  {AVAILABLE_PAYMENT_METHODS.map(method => {
                    const isConfigured = !!paymentConfig[method];
                    return (
                      <TouchableOpacity 
                        key={method} 
                        style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                        onPress={() => setSelectedConfigMethod(method)}
                      >
                        <Text style={{color: '#fff'}}>{method}</Text>
                        {isConfigured && <Text style={{color: '#10b981', fontSize: 12}}>✓ Configurado</Text>}
                      </TouchableOpacity>
                    );
                  })}
    
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => setShowConfigModal(false)}><Text style={styles.modalCancelText}>Cerrar</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.modalSubmit} onPress={handleSaveConfig} disabled={savingConfig}>
                      {savingConfig ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Guardar Todo</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                    <TouchableOpacity onPress={() => setSelectedConfigMethod(null)} style={{ marginRight: 15 }}>
                      <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Volver</Text>
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { marginBottom: 0 }]}>{selectedConfigMethod}</Text>
                  </View>
                  
                  {selectedConfigMethod === 'Pago Móvil' ? (
                    <View>
                      <Text style={styles.label}>Código del banco (ej. 0102)</Text>
                      <TextInput 
                        style={styles.input} 
                        keyboardType="numeric"
                        maxLength={4}
                        value={paymentConfig['Pago Móvil']?.banco || ''} 
                        onChangeText={text => setPaymentConfig({
                          ...paymentConfig, 
                          'Pago Móvil': { ...(paymentConfig['Pago Móvil'] || {}), banco: text }
                        })}
                        placeholder="0102"
                        placeholderTextColor="#475569"
                      />
                      
                      <Text style={styles.label}>Tipo de documento</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                        {['Persona', 'Comercio', 'Comuna'].map(tipo => (
                          <TouchableOpacity 
                            key={tipo}
                            style={[
                              styles.methodPill, 
                              (paymentConfig['Pago Móvil']?.tipo_doc || 'Persona') === tipo ? styles.methodPillActive : null,
                              { flex: 1, marginHorizontal: 2 }
                            ]}
                            onPress={() => setPaymentConfig({
                              ...paymentConfig, 
                              'Pago Móvil': { ...(paymentConfig['Pago Móvil'] || {}), tipo_doc: tipo }
                            })}
                          >
                            <Text style={
                              (paymentConfig['Pago Móvil']?.tipo_doc || 'Persona') === tipo ? styles.methodPillTextActive : styles.methodPillText
                            }>{tipo}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      
                      <Text style={styles.label}>Número de documento</Text>
                      <TextInput 
                        style={styles.input} 
                        keyboardType="numeric"
                        value={paymentConfig['Pago Móvil']?.cedula || ''} 
                        onChangeText={text => setPaymentConfig({
                          ...paymentConfig, 
                          'Pago Móvil': { ...(paymentConfig['Pago Móvil'] || {}), cedula: text }
                        })}
                        placeholder="12345678"
                        placeholderTextColor="#475569"
                      />
                      
                      <Text style={styles.label}>Teléfono</Text>
                      <TextInput 
                        style={styles.input} 
                        keyboardType="phone-pad"
                        value={paymentConfig['Pago Móvil']?.telefono || ''} 
                        onChangeText={text => setPaymentConfig({
                          ...paymentConfig, 
                          'Pago Móvil': { ...(paymentConfig['Pago Móvil'] || {}), telefono: text }
                        })}
                        placeholder="04141234567"
                        placeholderTextColor="#475569"
                      />
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.label}>Detalles de {selectedConfigMethod}</Text>
                      <TextInput 
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                        multiline
                        value={typeof paymentConfig[selectedConfigMethod] === 'string' ? paymentConfig[selectedConfigMethod] : ''} 
                        onChangeText={text => setPaymentConfig({...paymentConfig, [selectedConfigMethod]: text})}
                        placeholder={`Ingresa los datos para ${selectedConfigMethod}...`}
                        placeholderTextColor="#475569"
                      />
                    </View>
                  )}
                  
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalSubmit, { width: '100%' }]} onPress={() => setSelectedConfigMethod(null)}>
                      <Text style={styles.modalSubmitText}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
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

              {isBcvOutdated && (
                <View style={{backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: 10, borderRadius: 8, marginBottom: 15}}>
                  <Text style={{color: '#ef4444', fontSize: 13, fontWeight: 'bold'}}>⚠️ La tasa BCV ({bcvDate}) podría estar desactualizada.</Text>
                  <Text style={{color: '#f8fafc', fontSize: 13, marginTop: 5}}>Puedes ingresar la tasa actual a continuación si deseas ajustar el cálculo en Bolívares:</Text>
                  <TextInput 
                    style={[styles.input, {marginTop: 10, marginBottom: 0, height: 40}]} 
                    placeholder="Ej. 45.50" 
                    placeholderTextColor="#94a3b8" 
                    keyboardType="numeric" 
                    value={manualBcvRate} 
                    onChangeText={setManualBcvRate} 
                  />
                </View>
              )}
              
              <Text style={styles.label}>Método que usaste</Text>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20}}>
                {(selectedLoan?.accepted_payment_methods?.length > 0 ? selectedLoan.accepted_payment_methods : AVAILABLE_PAYMENT_METHODS).map(method => {
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
                  <Text style={{color: '#60a5fa', fontWeight: 'bold', marginBottom: 10}}>Instrucciones de Pago ({notifyMethod}):</Text>
                  {(() => {
                    if (!selectedLoan?.requester_payment_methods_json) return <Text style={{color: '#94a3b8'}}>El solicitante no configuró datos para este método. Deberás coordinar por otro medio.</Text>;
                    try {
                      const config = JSON.parse(selectedLoan.requester_payment_methods_json)[notifyMethod];
                      if (!config) return <Text style={{color: '#94a3b8'}}>El solicitante no configuró datos para este método. Deberás coordinar por otro medio.</Text>;
                      if (notifyMethod === 'Pago Móvil' && typeof config === 'object') {
                        const getPrefix = (tipo) => {
                          if (!tipo) return 'V';
                          if (tipo === 'Persona') return 'V';
                          if (tipo === 'Comercio') return 'J';
                          if (tipo === 'Comuna') return 'G';
                          return tipo[0] || 'V';
                        };
                        const docPrefix = getPrefix(config.tipo_doc);
                        const safeDoc = `${docPrefix}-${config.cedula || ''}`;
                        const safeBanco = config.banco || '';
                        const safeTelefono = config.telefono || '';
                        
                        const montoBs = effectiveBcvRate ? (selectedContrib?.amount_usd * effectiveBcvRate).toFixed(2) : null;
                        const montoText = montoBs ? ` | Monto: ${montoBs} Bs` : '';
                        
                        const copyField = async (label, value) => {
                          await Clipboard.setStringAsync(value);
                          setCopiedField(label);
                          setTimeout(() => setCopiedField(null), 2000);
                        };
                        const copyAll = async () => {
                          const text = `Banco: ${safeBanco} | ${safeDoc} | ${safeTelefono}${montoText}`;
                          await Clipboard.setStringAsync(text);
                          setCopiedField('all');
                          setTimeout(() => setCopiedField(null), 2000);
                        };
                        return (
                          <View>
                            {montoBs && (
                              <TouchableOpacity style={styles.copyDataRow} onPress={() => copyField('monto', montoBs)}>
                                <View>
                                  <Text style={styles.copyDataLabel}>Monto a pagar (Tasa BCV: {effectiveBcvRate})</Text>
                                  <Text style={[styles.copyDataValue, {color: '#10b981'}]}>{montoBs} Bs</Text>
                                </View>
                                <Text style={styles.copyIcon}>{copiedField === 'monto' ? '✓' : '📋'}</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.copyDataRow} onPress={() => copyField('banco', safeBanco)}>
                              <View>
                                <Text style={styles.copyDataLabel}>Banco</Text>
                                <Text style={styles.copyDataValue}>{safeBanco}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'banco' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.copyDataRow} onPress={() => copyField('doc', safeDoc)}>
                              <View>
                                <Text style={styles.copyDataLabel}>Documento</Text>
                                <Text style={styles.copyDataValue}>{safeDoc}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'doc' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.copyDataRow} onPress={() => copyField('tel', safeTelefono)}>
                              <View>
                                <Text style={styles.copyDataLabel}>Teléfono</Text>
                                <Text style={styles.copyDataValue}>{safeTelefono}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'tel' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.copyAllButton} onPress={copyAll}>
                              <Text style={styles.copyAllButtonText}>
                                {copiedField === 'all' ? '✅ ¡Copiado!' : '📋  Copiar todo para el banco'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      return <Text style={{color: '#f8fafc', fontSize: 16}}>{config}</Text>;
                    } catch(e) {
                      return <Text style={{color: '#94a3b8'}}>Error al leer configuración.</Text>;
                    }
                  })()}
                </View>
              ) : null}

              <Text style={styles.label}>Referencia (Opcional)</Text>
              <TextInput style={[styles.input, {marginBottom: 10}]} value={referenceText} onChangeText={setReferenceText} placeholder="Ej. Número de referencia o nota" placeholderTextColor="#475569" />

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

      {/* Modal para Notificar Devolución */}
      <Modal visible={showRepayModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {maxHeight: '90%'}]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Devolver Dinero</Text>
              
              {selectedContrib && selectedLoan && (
                <View style={{marginBottom: 15, padding: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8}}>
                  <Text style={{color: '#f8fafc'}}>Acreedor: <Text style={{fontWeight: 'bold'}}>{selectedContrib.funder_name}</Text></Text>
                  <Text style={{color: '#94a3b8'}}>Monto original: ${selectedContrib.amount_usd}</Text>
                </View>
              )}

              {isBcvOutdated && (
                <View style={{backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: 10, borderRadius: 8, marginBottom: 15}}>
                  <Text style={{color: '#ef4444', fontSize: 13, fontWeight: 'bold'}}>⚠️ La tasa BCV ({bcvDate}) podría estar desactualizada.</Text>
                  <Text style={{color: '#f8fafc', fontSize: 13, marginTop: 5}}>Ingresa la tasa actual a continuación si deseas ajustar el cálculo en Bolívares:</Text>
                  <TextInput 
                    style={[styles.input, {marginTop: 10, marginBottom: 0, height: 40}]} 
                    placeholder="Ej. 45.50" 
                    placeholderTextColor="#94a3b8" 
                    keyboardType="numeric" 
                    value={manualBcvRate} 
                    onChangeText={setManualBcvRate} 
                  />
                </View>
              )}

              <Text style={styles.label}>Monto a devolver (USD)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={repayAmount} onChangeText={setRepayAmount} placeholder="Ej. 10" placeholderTextColor="#475569" />

              <Text style={styles.label}>¿Cómo le transferiste?</Text>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15}}>
                {selectedContrib?.funder_payment_methods_json && Object.keys(JSON.parse(selectedContrib.funder_payment_methods_json)).map(method => {
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

              {notifyMethod && selectedContrib?.funder_payment_methods_json ? (
                <View style={{backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 15, borderRadius: 8, marginBottom: 15}}>
                  <Text style={{color: '#60a5fa', fontWeight: 'bold', marginBottom: 10}}>Instrucciones de Pago de {selectedContrib?.funder_name} ({notifyMethod}):</Text>
                  {(() => {
                    try {
                      const config = JSON.parse(selectedContrib.funder_payment_methods_json)[notifyMethod];
                      if (!config) return <Text style={{color: '#94a3b8'}}>No tiene este método bien configurado.</Text>;
                      if (notifyMethod === 'Pago Móvil' && typeof config === 'object') {
                        const getPrefix = (tipo) => {
                          if (!tipo) return 'V';
                          if (tipo === 'Persona') return 'V';
                          if (tipo === 'Comercio') return 'J';
                          if (tipo === 'Comuna') return 'G';
                          return tipo[0] || 'V';
                        };
                        const docPrefix = getPrefix(config.tipo_doc);
                        const safeDoc = `${docPrefix}-${config.cedula || ''}`;
                        const safeBanco = config.banco || '';
                        const safeTelefono = config.telefono || '';
                        
                        const montoBs = effectiveBcvRate && repayAmount ? (parseFloat(repayAmount) * effectiveBcvRate).toFixed(2) : null;
                        const montoText = montoBs ? ` | Monto: ${montoBs} Bs` : '';
                        
                        const copyField = async (label, value) => {
                          await Clipboard.setStringAsync(value);
                          setCopiedField(label);
                          setTimeout(() => setCopiedField(null), 2000);
                        };
                        const copyAll = async () => {
                          const text = `Banco: ${safeBanco} | ${safeDoc} | ${safeTelefono}${montoText}`;
                          await Clipboard.setStringAsync(text);
                          setCopiedField('all');
                          setTimeout(() => setCopiedField(null), 2000);
                        };
                        return (
                          <View>
                            {montoBs && (
                              <TouchableOpacity style={styles.copyDataRow} onPress={() => copyField('monto', montoBs)}>
                                <View>
                                  <Text style={styles.copyDataLabel}>Monto a pagar (Tasa BCV: {effectiveBcvRate})</Text>
                                  <Text style={[styles.copyDataValue, {color: '#10b981'}]}>{montoBs} Bs</Text>
                                </View>
                                <Text style={styles.copyIcon}>{copiedField === 'monto' ? '✓' : '📋'}</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.copyDataRow} onPress={() => copyField('banco', safeBanco)}>
                              <View>
                                <Text style={styles.copyDataLabel}>Banco</Text>
                                <Text style={styles.copyDataValue}>{safeBanco}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'banco' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.copyDataRow} onPress={() => copyField('doc', safeDoc)}>
                              <View>
                                <Text style={styles.copyDataLabel}>Documento</Text>
                                <Text style={styles.copyDataValue}>{safeDoc}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'doc' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.copyDataRow} onPress={() => copyField('tel', safeTelefono)}>
                              <View>
                                <Text style={styles.copyDataLabel}>Teléfono</Text>
                                <Text style={styles.copyDataValue}>{safeTelefono}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'tel' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.copyAllButton} onPress={copyAll}>
                              <Text style={styles.copyAllButtonText}>
                                {copiedField === 'all' ? '✅ ¡Copiado!' : '📋  Copiar todo para el banco'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      return <Text style={{color: '#f8fafc', fontSize: 16}}>{config}</Text>;
                    } catch(e) {
                      return <Text style={{color: '#94a3b8'}}>Error al leer configuración.</Text>;
                    }
                  })()}
                </View>
              ) : null}

              <Text style={styles.label}>Referencia (Opcional)</Text>
              <TextInput style={[styles.input, {marginBottom: 10}]} value={referenceText} onChangeText={setReferenceText} placeholder="Ej. Número de referencia o nota" placeholderTextColor="#475569" />

              <Text style={styles.label}>Comprobante (Opcional)</Text>
              <TouchableOpacity style={[styles.input, {alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)'}]} onPress={pickImage}>
                <Text style={{color: '#60a5fa', fontWeight: 'bold'}}>{receiptUri ? "✅ Imagen Seleccionada (Cambiar)" : "📸 Subir Captura / Foto"}</Text>
              </TouchableOpacity>
              {receiptUri && <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 100, borderRadius: 8, marginBottom: 15 }} resizeMode="cover" />}
              
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowRepayModal(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmit} onPress={handleNotifyRepayment} disabled={repaying}>
                  {repaying ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Confirmar</Text>}
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
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
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
  methodChipText: { color: '#3b82f6', fontSize: 13, fontWeight: 'bold' },
  methodPill: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent', alignItems: 'center' },
  methodPillActive: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  methodPillText: { color: '#94a3b8', fontSize: 14 },
  methodPillTextActive: { color: '#10b981', fontSize: 14, fontWeight: 'bold' },
  copyDataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 12, marginBottom: 8 },
  copyDataLabel: { color: '#94a3b8', fontSize: 11, marginBottom: 2 },
  copyDataValue: { color: '#f1f5f9', fontSize: 17, fontWeight: 'bold', letterSpacing: 1 },
  copyIcon: { fontSize: 18, opacity: 0.8 },
  copyAllButton: { backgroundColor: 'rgba(59, 130, 246, 0.25)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 6 },
  copyAllButtonText: { color: '#93c5fd', fontWeight: 'bold', fontSize: 14 }
});
