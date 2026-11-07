import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { loansApi } from '../api/client';
import { VENEZUELAN_BANKS, getBankLabel } from '../utils/banks';
import theme from '../utils/theme';

const AVAILABLE_PAYMENT_METHODS = [
  'Pago Móvil',
  'Efectivo USD',
  'Efectivo Bolívares',
  'Transferencia Bancaria',
  'Binance',
];

export default function PaymentConfigModal({
  visible,
  onClose,
  onSuccess,
  initialConfig = null,
}) {
  const [paymentConfig, setPaymentConfig] = useState(initialConfig || {});
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [selectedConfigMethod, setSelectedConfigMethod] = useState(null);
  const [banks, setBanks] = useState(VENEZUELAN_BANKS);
  const [isPickingBank, setIsPickingBank] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [pmErrors, setPmErrors] = useState({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const configScrollRef = useRef(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      loadData();
    } else {
      setSelectedConfigMethod(null);
      setIsPickingBank(false);
      setBankSearch('');
      setPmErrors({});
    }
  }, [visible]);

  const loadData = async () => {
    setLoadingInitial(true);
    try {
      const [pmRes, banksRes] = await Promise.all([
        loansApi.getPaymentMethods().catch(() => ({})),
        loansApi.getBanks().catch(() => null),
      ]);

      if (pmRes?.payment_methods_json) {
        try {
          setPaymentConfig(JSON.parse(pmRes.payment_methods_json));
        } catch (_) {
          setPaymentConfig({});
        }
      } else if (initialConfig) {
        setPaymentConfig(initialConfig);
      }

      if (Array.isArray(banksRes) && banksRes.length > 0) {
        setBanks(banksRes);
      } else {
        setBanks(VENEZUELAN_BANKS);
      }
    } catch (e) {
      console.warn('Error loading payment config or banks', e);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleConfirmConfigMethod = () => {
    if (selectedConfigMethod === 'Pago Móvil') {
      const pm = paymentConfig['Pago Móvil'] || {};
      const banco = (pm.banco || '').trim();
      const cedula = (pm.cedula || '').trim();
      const telefono = (pm.telefono || '').trim().replace(/[-\s]/g, '');

      const isEmpty = !banco && !cedula && !telefono;
      if (isEmpty) {
        setPmErrors({});
        const updatedConfig = { ...paymentConfig };
        delete updatedConfig['Pago Móvil'];
        setPaymentConfig(updatedConfig);
        setSelectedConfigMethod(null);
        return;
      }

      const errors = {};
      if (!banco) {
        errors.banco = 'Debes seleccionar un banco.';
      }
      if (!cedula) {
        errors.cedula = 'Ingresa el número de documento.';
      } else if (!/^\d{5,10}$/.test(cedula)) {
        errors.cedula = 'El documento debe tener entre 5 y 10 dígitos numéricos.';
      }
      if (!telefono) {
        errors.telefono = 'Ingresa el número de teléfono.';
      } else if (!/^04\d{9}$/.test(telefono)) {
        errors.telefono = 'El teléfono debe comenzar con 04 y tener 11 dígitos (ej. 04141234567).';
      }

      if (Object.keys(errors).length > 0) {
        setPmErrors(errors);
        return;
      }

      setPmErrors({});
      setPaymentConfig({
        ...paymentConfig,
        'Pago Móvil': { ...(pm || {}), banco, cedula, telefono },
      });
      setSelectedConfigMethod(null);
      return;
    }

    setSelectedConfigMethod(null);
  };

  const handleSaveConfig = async () => {
    const configToSave = { ...paymentConfig };

    for (const method of Object.keys(configToSave)) {
      if (method === 'Pago Móvil') {
        const pm = configToSave['Pago Móvil'];
        if (typeof pm === 'object') {
          const isEmpty = !pm.banco && !pm.telefono && !pm.cedula;
          if (isEmpty) {
            delete configToSave['Pago Móvil'];
          } else if (!pm.banco || !pm.telefono || !pm.cedula) {
            Alert.alert(
              'Incompleto',
              'Por favor completa todos los campos de Pago Móvil (banco, documento y teléfono) o déjalos todos en blanco para eliminar el método.'
            );
            return;
          }
        }
      } else {
        if (!configToSave[method] || configToSave[method].trim() === '') {
          delete configToSave[method];
        }
      }
    }

    setSavingConfig(true);
    try {
      await loansApi.updatePaymentMethods(JSON.stringify(configToSave));
      setPaymentConfig(configToSave);
      Alert.alert('Guardado', 'Tus datos de pago han sido guardados exitosamente.');
      if (onSuccess) onSuccess(configToSave);
      if (onClose) onClose();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la configuración de pagos.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRequestClose = () => {
    if (isPickingBank) {
      setIsPickingBank(false);
    } else if (selectedConfigMethod) {
      setSelectedConfigMethod(null);
      setPmErrors({});
    } else {
      if (onClose) onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleRequestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
      >
        <View
          style={[
            styles.modalContent,
            { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' },
          ]}
        >
          <ScrollView
            ref={configScrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            contentContainerStyle={{
              flexGrow: 1,
              paddingRight: 12,
              paddingBottom: keyboardVisible ? 40 : 15,
            }}
          >
            {loadingInitial ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 14 }}>
                  Cargando datos de pago...
                </Text>
              </View>
            ) : !selectedConfigMethod ? (
              <>
                <Text style={styles.modalTitle}>Mis Datos de Pago</Text>
                <Text style={{ color: '#94a3b8', marginBottom: 15 }}>
                  Selecciona un método para configurarlo.
                </Text>

                {AVAILABLE_PAYMENT_METHODS.map((method) => {
                  const isConfigured = !!paymentConfig[method];
                  const isDisabled = method !== 'Pago Móvil';
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.input,
                        {
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        },
                        isDisabled && { opacity: 0.5 },
                      ]}
                      onPress={() => {
                        if (isDisabled) {
                          Alert.alert('En desarrollo', 'Esta opción de pago aún no está implementada.');
                          return;
                        }
                        setSelectedConfigMethod(method);
                      }}
                      activeOpacity={isDisabled ? 1 : 0.7}
                    >
                      <Text style={[{ color: '#fff' }, isDisabled && { color: '#94a3b8' }]}>
                        {method}
                      </Text>
                      {isConfigured && (
                        <Text style={{ color: '#10b981', fontSize: 12 }}>✓ Configurado</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
                    <Text style={styles.modalCancelText}>Cerrar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSubmit}
                    onPress={handleSaveConfig}
                    disabled={savingConfig}
                  >
                    {savingConfig ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Guardar Todo</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : isPickingBank ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                  <TouchableOpacity onPress={() => setIsPickingBank(false)} style={{ marginRight: 15 }}>
                    <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Volver</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Seleccionar Banco</Text>
                </View>

                <TextInput
                  style={[styles.input, { marginBottom: 10 }]}
                  value={bankSearch}
                  onChangeText={setBankSearch}
                  placeholder="Buscar por nombre o código (ej. 0102)..."
                  placeholderTextColor="#475569"
                  autoFocus={true}
                />

                <View
                  style={{
                    maxHeight: keyboardVisible ? 180 : 280,
                    borderWidth: 1,
                    borderColor: '#334155',
                    borderRadius: 8,
                    overflow: 'hidden',
                    marginBottom: 15,
                  }}
                >
                  <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                    {banks
                      .filter((b) => {
                        if (!bankSearch.trim()) return true;
                        const q = bankSearch.toLowerCase().trim();
                        return b.code.includes(q) || b.name.toLowerCase().includes(q);
                      })
                      .map((b) => {
                        const isSelected = paymentConfig['Pago Móvil']?.banco === b.code;
                        return (
                          <TouchableOpacity
                            key={b.code}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              paddingHorizontal: 12,
                              backgroundColor: isSelected ? '#1e293b' : '#0f172a',
                              borderBottomWidth: 1,
                              borderBottomColor: '#1e293b',
                            }}
                            onPress={() => {
                              setPaymentConfig({
                                ...paymentConfig,
                                'Pago Móvil': {
                                  ...(paymentConfig['Pago Móvil'] || {}),
                                  banco: b.code,
                                },
                              });
                              setPmErrors((prev) => ({ ...prev, banco: null }));
                              setIsPickingBank(false);
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: '#1e3a8a',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                marginRight: 10,
                              }}
                            >
                              <Text style={{ color: '#93c5fd', fontWeight: '700', fontSize: 13 }}>
                                {b.code}
                              </Text>
                            </View>
                            <Text style={{ color: '#fff', fontSize: 14, flex: 1 }}>{b.name}</Text>
                            {isSelected && (
                              <Text
                                style={{
                                  color: '#10b981',
                                  fontWeight: 'bold',
                                  fontSize: 16,
                                  marginLeft: 8,
                                }}
                              >
                                ✓
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalCancel, { width: '100%' }]}
                    onPress={() => setIsPickingBank(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setPmErrors({});
                      setSelectedConfigMethod(null);
                    }}
                    style={{ marginRight: 15 }}
                  >
                    <Text style={{ color: '#3b82f6', fontSize: 16 }}>← Volver</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { marginBottom: 0 }]}>
                    {selectedConfigMethod}
                  </Text>
                </View>

                {selectedConfigMethod === 'Pago Móvil' ? (
                  <View>
                    <Text style={styles.label}>Banco</Text>
                    <TouchableOpacity
                      style={[
                        styles.input,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 12,
                        },
                        pmErrors.banco && {
                          borderColor: '#ef4444',
                          borderWidth: 1.5,
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        },
                      ]}
                      onPress={() => {
                        setBankSearch('');
                        setIsPickingBank(true);
                      }}
                    >
                      <Text
                        style={{
                          color: paymentConfig['Pago Móvil']?.banco ? '#fff' : '#64748b',
                          fontSize: 15,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {paymentConfig['Pago Móvil']?.banco
                          ? getBankLabel(paymentConfig['Pago Móvil']?.banco, banks)
                          : 'Selecciona tu banco...'}
                      </Text>
                      <Text
                        style={{
                          color: '#60a5fa',
                          fontSize: 13,
                          fontWeight: '600',
                          marginLeft: 8,
                        }}
                      >
                        Elegir ▼
                      </Text>
                    </TouchableOpacity>
                    {pmErrors.banco && (
                      <Text
                        style={{
                          color: '#ef4444',
                          fontSize: 12,
                          marginTop: -8,
                          marginBottom: 12,
                        }}
                      >
                        {pmErrors.banco}
                      </Text>
                    )}

                    <Text style={styles.label}>Tipo de documento</Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 15,
                      }}
                    >
                      {['Persona', 'Comercio', 'Comuna'].map((tipo) => (
                        <TouchableOpacity
                          key={tipo}
                          style={[
                            styles.methodPill,
                            (paymentConfig['Pago Móvil']?.tipo_doc || 'Persona') === tipo
                              ? styles.methodPillActive
                              : null,
                            { flex: 1, marginHorizontal: 2 },
                          ]}
                          onPress={() =>
                            setPaymentConfig({
                              ...paymentConfig,
                              'Pago Móvil': {
                                ...(paymentConfig['Pago Móvil'] || {}),
                                tipo_doc: tipo,
                              },
                            })
                          }
                        >
                          <Text
                            style={
                              (paymentConfig['Pago Móvil']?.tipo_doc || 'Persona') === tipo
                                ? styles.methodPillTextActive
                                : styles.methodPillText
                            }
                          >
                            {tipo}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>Número de documento</Text>
                    <TextInput
                      style={[
                        styles.input,
                        pmErrors.cedula && {
                          borderColor: '#ef4444',
                          borderWidth: 1.5,
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        },
                      ]}
                      keyboardType="numeric"
                      value={paymentConfig['Pago Móvil']?.cedula || ''}
                      onChangeText={(text) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Pago Móvil': {
                            ...(paymentConfig['Pago Móvil'] || {}),
                            cedula: text,
                          },
                        });
                        if (pmErrors.cedula) setPmErrors((prev) => ({ ...prev, cedula: null }));
                      }}
                      onFocus={() => {
                        setTimeout(() => {
                          configScrollRef.current?.scrollTo({ y: 120, animated: true });
                        }, 150);
                      }}
                      placeholder="12345678"
                      placeholderTextColor="#475569"
                    />
                    {pmErrors.cedula && (
                      <Text
                        style={{
                          color: '#ef4444',
                          fontSize: 12,
                          marginTop: -8,
                          marginBottom: 12,
                        }}
                      >
                        {pmErrors.cedula}
                      </Text>
                    )}

                    <Text style={styles.label}>Teléfono</Text>
                    <TextInput
                      style={[
                        styles.input,
                        pmErrors.telefono && {
                          borderColor: '#ef4444',
                          borderWidth: 1.5,
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        },
                      ]}
                      keyboardType="phone-pad"
                      value={paymentConfig['Pago Móvil']?.telefono || ''}
                      onChangeText={(text) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Pago Móvil': {
                            ...(paymentConfig['Pago Móvil'] || {}),
                            telefono: text,
                          },
                        });
                        if (pmErrors.telefono)
                          setPmErrors((prev) => ({ ...prev, telefono: null }));
                      }}
                      onFocus={() => {
                        setTimeout(() => {
                          configScrollRef.current?.scrollToEnd({ animated: true });
                        }, 150);
                      }}
                      placeholder="04141234567"
                      placeholderTextColor="#475569"
                    />
                    {pmErrors.telefono && (
                      <Text
                        style={{
                          color: '#ef4444',
                          fontSize: 12,
                          marginTop: -8,
                          marginBottom: 12,
                        }}
                      >
                        {pmErrors.telefono}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={styles.label}>Detalles de {selectedConfigMethod}</Text>
                    <TextInput
                      style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                      multiline
                      value={
                        typeof paymentConfig[selectedConfigMethod] === 'string'
                          ? paymentConfig[selectedConfigMethod]
                          : ''
                      }
                      onChangeText={(text) =>
                        setPaymentConfig({ ...paymentConfig, [selectedConfigMethod]: text })
                      }
                      onFocus={() => {
                        setTimeout(() => {
                          configScrollRef.current?.scrollToEnd({ animated: true });
                        }, 150);
                      }}
                      placeholder={`Ingresa los datos para ${selectedConfigMethod}...`}
                      placeholderTextColor="#475569"
                    />
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalSubmit, { width: '100%' }]}
                    onPress={handleConfirmConfigMethod}
                  >
                    <Text style={styles.modalSubmitText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalOverlayShifted: {
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'android' ? 35 : 55,
  },
  modalContent: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 22,
    paddingRight: 14,
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
  methodPill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  methodPillActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  methodPillText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  methodPillTextActive: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
    paddingRight: 4,
  },
  modalCancel: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  modalSubmit: {
    backgroundColor: theme.accent,
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
