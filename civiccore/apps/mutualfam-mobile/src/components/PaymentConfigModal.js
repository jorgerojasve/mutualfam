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
import {
  VENEZUELAN_BANKS,
  getBankLabel,
  cleanAccountNumber,
  formatAccountNumber,
  findBankByAccount,
} from '../utils/banks';
import theme from '../utils/theme';

const AVAILABLE_PAYMENT_METHODS = [
  'Pago Móvil',
  'Transferencia Bancaria',
  'Efectivo USD',
  'Efectivo Bolívares',
  'Binance',
];

export const DOCUMENT_TYPES = [
  {
    key: 'Persona',
    prefix: 'V',
    title: 'V - Venezolano (Persona Natural)',
    subtitle: 'Cédula de identidad venezolana',
  },
  {
    key: 'Extranjero',
    prefix: 'E',
    title: 'E - Extranjero',
    subtitle: 'Cédula de extranjería',
  },
  {
    key: 'Comercio',
    prefix: 'J',
    title: 'J - Jurídico / Comercio (RIF)',
    subtitle: 'Empresas, comercios y firmas personales',
  },
  {
    key: 'Comuna',
    prefix: 'G',
    title: 'G - Gubernamental / Comuna (RIF)',
    subtitle: 'Instituciones públicas, comunas y consejos comunales',
  },
];

export const getDocTypeInfo = (tipo) => {
  const t = (tipo || 'Persona').toString().trim();
  if (t === 'Persona' || t === 'V') return DOCUMENT_TYPES[0];
  if (t === 'Extranjero' || t === 'E') return DOCUMENT_TYPES[1];
  if (t === 'Comercio' || t === 'J') return DOCUMENT_TYPES[2];
  if (t === 'Comuna' || t === 'G') return DOCUMENT_TYPES[3];
  return DOCUMENT_TYPES[0];
};

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
  const [tbErrors, setTbErrors] = useState({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isPmDocPickerOpen, setIsPmDocPickerOpen] = useState(false);
  const [isTbDocPickerOpen, setIsTbDocPickerOpen] = useState(false);
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
      setTbErrors({});
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

    if (selectedConfigMethod === 'Transferencia Bancaria') {
      const tb = paymentConfig['Transferencia Bancaria'] || {};
      const banco = (tb.banco || '').trim();
      const tipo_cuenta = tb.tipo_cuenta || 'Corriente';
      const numero_cuenta = cleanAccountNumber(tb.numero_cuenta);
      const titular = (tb.titular || '').trim();
      const tipo_doc = tb.tipo_doc || 'Persona';
      const cedula = (tb.cedula || '').trim().replace(/\D/g, '');
      const email = (tb.email || '').trim().toLowerCase();
      const telefono = (tb.telefono || '').trim().replace(/[-\s]/g, '');

      const isEmpty = !banco && !numero_cuenta && !titular && !cedula;
      if (isEmpty) {
        setTbErrors({});
        const updatedConfig = { ...paymentConfig };
        delete updatedConfig['Transferencia Bancaria'];
        setPaymentConfig(updatedConfig);
        setSelectedConfigMethod(null);
        return;
      }

      const errors = {};
      if (!banco) {
        errors.banco = 'Debes seleccionar un banco.';
      }
      if (!numero_cuenta) {
        errors.numero_cuenta = 'Ingresa el número de cuenta de 20 dígitos.';
      } else if (numero_cuenta.length !== 20) {
        errors.numero_cuenta = `El número de cuenta debe tener exactamente 20 dígitos (actualmente ${numero_cuenta.length}).`;
      } else if (banco && numero_cuenta.slice(0, 4) !== banco) {
        errors.numero_cuenta = `Los primeros 4 dígitos deben coincidir con el código del banco seleccionado (${banco}).`;
      }

      if (!titular) {
        errors.titular = 'Ingresa el nombre del titular de la cuenta.';
      } else if (titular.length < 3) {
        errors.titular = 'El nombre del titular debe tener al menos 3 caracteres.';
      }

      if (!cedula) {
        errors.cedula = 'Ingresa el número de documento / RIF.';
      } else if (!/^\d{5,10}$/.test(cedula)) {
        errors.cedula = 'El documento debe tener entre 5 y 10 dígitos numéricos.';
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Ingresa un correo electrónico válido o déjalo en blanco.';
      }

      if (Object.keys(errors).length > 0) {
        setTbErrors(errors);
        return;
      }

      setTbErrors({});
      setPaymentConfig({
        ...paymentConfig,
        'Transferencia Bancaria': {
          ...(tb || {}),
          banco,
          tipo_cuenta,
          numero_cuenta,
          titular,
          tipo_doc,
          cedula,
          email: email || undefined,
          telefono: telefono || undefined,
        },
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
      } else if (method === 'Transferencia Bancaria') {
        const tb = configToSave['Transferencia Bancaria'];
        if (typeof tb === 'object') {
          const isEmpty = !tb.banco && !tb.numero_cuenta && !tb.titular && !tb.cedula;
          if (isEmpty) {
            delete configToSave['Transferencia Bancaria'];
          } else if (
            !tb.banco ||
            !tb.numero_cuenta ||
            cleanAccountNumber(tb.numero_cuenta).length !== 20 ||
            !tb.titular ||
            !tb.cedula
          ) {
            Alert.alert(
              'Incompleto',
              'Por favor completa todos los campos requeridos de Transferencia Bancaria (banco, cuenta de 20 dígitos, titular y documento) o déjalos todos en blanco para eliminar el método.'
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
    } else if (isTbDocPickerOpen || isPmDocPickerOpen) {
      setIsTbDocPickerOpen(false);
      setIsPmDocPickerOpen(false);
    } else if (selectedConfigMethod) {
      setSelectedConfigMethod(null);
      setPmErrors({});
      setTbErrors({});
      setIsTbDocPickerOpen(false);
      setIsPmDocPickerOpen(false);
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
                  Configura tus métodos para recibir pagos de préstamos y aportes de colectas.
                </Text>

                {AVAILABLE_PAYMENT_METHODS.map((method) => {
                  const isConfigured = !!paymentConfig[method];
                  const isDisabled =
                    method !== 'Pago Móvil' && method !== 'Transferencia Bancaria';
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 16 }}>
                          {method === 'Pago Móvil'
                            ? '📲'
                            : method === 'Transferencia Bancaria'
                            ? '🏛️'
                            : '💳'}
                        </Text>
                        <Text style={[{ color: '#fff' }, isDisabled && { color: '#94a3b8' }]}>
                          {method}
                        </Text>
                      </View>
                      {isConfigured && (
                        <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '700' }}>
                          ✓ Configurado
                        </Text>
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
                        const currentBankCode =
                          selectedConfigMethod === 'Pago Móvil'
                            ? paymentConfig['Pago Móvil']?.banco
                            : paymentConfig['Transferencia Bancaria']?.banco;
                        const isSelected = currentBankCode === b.code;

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
                              if (selectedConfigMethod === 'Pago Móvil') {
                                setPaymentConfig({
                                  ...paymentConfig,
                                  'Pago Móvil': {
                                    ...(paymentConfig['Pago Móvil'] || {}),
                                    banco: b.code,
                                  },
                                });
                                setPmErrors((prev) => ({ ...prev, banco: null }));
                              } else if (selectedConfigMethod === 'Transferencia Bancaria') {
                                const currentAcc = cleanAccountNumber(
                                  paymentConfig['Transferencia Bancaria']?.numero_cuenta || ''
                                );
                                let newAcc = currentAcc;
                                if (!currentAcc) {
                                  newAcc = b.code;
                                } else if (currentAcc.length >= 4 && currentAcc.slice(0, 4) !== b.code) {
                                  newAcc = b.code + currentAcc.slice(4);
                                }
                                setPaymentConfig({
                                  ...paymentConfig,
                                  'Transferencia Bancaria': {
                                    ...(paymentConfig['Transferencia Bancaria'] || {}),
                                    banco: b.code,
                                    numero_cuenta: newAcc,
                                  },
                                });
                                setTbErrors((prev) => ({ ...prev, banco: null, numero_cuenta: null }));
                              }
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
                      setTbErrors({});
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
                      <Text style={styles.errorText}>{pmErrors.banco}</Text>
                    )}

                    <Text style={styles.label}>Tipo de Documento</Text>
                    <TouchableOpacity
                      style={[
                        styles.input,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 12,
                          borderColor: isPmDocPickerOpen ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                          marginBottom: isPmDocPickerOpen ? 6 : 15,
                        },
                      ]}
                      onPress={() => setIsPmDocPickerOpen(!isPmDocPickerOpen)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <View style={styles.docBadge}>
                          <Text style={styles.docBadgeText}>
                            {getDocTypeInfo(paymentConfig['Pago Móvil']?.tipo_doc).prefix}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: '500',
                            marginLeft: 10,
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {getDocTypeInfo(paymentConfig['Pago Móvil']?.tipo_doc).title}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: '#60a5fa',
                          fontSize: 13,
                          fontWeight: '600',
                          marginLeft: 8,
                        }}
                      >
                        {isPmDocPickerOpen ? 'Cerrar ▲' : 'Elegir ▼'}
                      </Text>
                    </TouchableOpacity>

                    {isPmDocPickerOpen && (
                      <View style={styles.dropdownContainer}>
                        {DOCUMENT_TYPES.map((doc, idx) => {
                          const currentPmKey = getDocTypeInfo(paymentConfig['Pago Móvil']?.tipo_doc).key;
                          const isSelected = currentPmKey === doc.key;
                          return (
                            <TouchableOpacity
                              key={doc.key}
                              style={[
                                styles.dropdownItem,
                                isSelected && styles.dropdownItemSelected,
                                idx === DOCUMENT_TYPES.length - 1 && { borderBottomWidth: 0 },
                              ]}
                              onPress={() => {
                                setPaymentConfig({
                                  ...paymentConfig,
                                  'Pago Móvil': {
                                    ...(paymentConfig['Pago Móvil'] || {}),
                                    tipo_doc: doc.key,
                                  },
                                });
                                setIsPmDocPickerOpen(false);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.docBadge, isSelected && styles.docBadgeActive]}>
                                <Text
                                  style={[
                                    styles.docBadgeText,
                                    isSelected && styles.docBadgeTextActive,
                                  ]}
                                >
                                  {doc.prefix}
                                </Text>
                              </View>
                              <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                                <Text
                                  style={[
                                    styles.dropdownItemTitle,
                                    isSelected && styles.dropdownItemTitleActive,
                                  ]}
                                >
                                  {doc.title}
                                </Text>
                                <Text style={styles.dropdownItemSubtitle}>
                                  {doc.subtitle}
                                </Text>
                              </View>
                              {isSelected && <Text style={styles.dropdownCheckmark}>✓</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

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
                            cedula: text.replace(/\D/g, ''),
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
                      <Text style={styles.errorText}>{pmErrors.cedula}</Text>
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
                      <Text style={styles.errorText}>{pmErrors.telefono}</Text>
                    )}
                  </View>
                ) : selectedConfigMethod === 'Transferencia Bancaria' ? (
                  <View>
                    <Text style={styles.label}>Banco Destino</Text>
                    <TouchableOpacity
                      style={[
                        styles.input,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 12,
                        },
                        tbErrors.banco && {
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
                          color: paymentConfig['Transferencia Bancaria']?.banco ? '#fff' : '#64748b',
                          fontSize: 15,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {paymentConfig['Transferencia Bancaria']?.banco
                          ? getBankLabel(paymentConfig['Transferencia Bancaria']?.banco, banks)
                          : 'Selecciona el banco de tu cuenta...'}
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
                    {tbErrors.banco && (
                      <Text style={styles.errorText}>{tbErrors.banco}</Text>
                    )}

                    <Text style={styles.label}>Tipo de Cuenta</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                      {['Corriente', 'Ahorro'].map((tipo) => (
                        <TouchableOpacity
                          key={tipo}
                          style={[
                            styles.methodPill,
                            (paymentConfig['Transferencia Bancaria']?.tipo_cuenta || 'Corriente') === tipo
                              ? styles.methodPillActive
                              : null,
                            { flex: 1 },
                          ]}
                          onPress={() =>
                            setPaymentConfig({
                              ...paymentConfig,
                              'Transferencia Bancaria': {
                                ...(paymentConfig['Transferencia Bancaria'] || {}),
                                tipo_cuenta: tipo,
                              },
                            })
                          }
                        >
                          <Text
                            style={
                              (paymentConfig['Transferencia Bancaria']?.tipo_cuenta || 'Corriente') === tipo
                                ? styles.methodPillTextActive
                                : styles.methodPillText
                            }
                          >
                            {tipo}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.label}>Número de Cuenta (20 dígitos)</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
                        {cleanAccountNumber(paymentConfig['Transferencia Bancaria']?.numero_cuenta || '').length}/20 dígitos
                      </Text>
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        { letterSpacing: 1, fontSize: 15 },
                        tbErrors.numero_cuenta && {
                          borderColor: '#ef4444',
                          borderWidth: 1.5,
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        },
                      ]}
                      keyboardType="numeric"
                      maxLength={24}
                      value={formatAccountNumber(paymentConfig['Transferencia Bancaria']?.numero_cuenta || '')}
                      onChangeText={(text) => {
                        const cleaned = cleanAccountNumber(text);
                        const autoBank = findBankByAccount(cleaned, banks);
                        const currentBanco = paymentConfig['Transferencia Bancaria']?.banco;
                        const newBanco = !currentBanco && autoBank ? autoBank.code : currentBanco;

                        setPaymentConfig({
                          ...paymentConfig,
                          'Transferencia Bancaria': {
                            ...(paymentConfig['Transferencia Bancaria'] || {}),
                            numero_cuenta: cleaned,
                            ...(newBanco ? { banco: newBanco } : {}),
                          },
                        });
                        if (tbErrors.numero_cuenta) setTbErrors((prev) => ({ ...prev, numero_cuenta: null }));
                        if (autoBank && tbErrors.banco) setTbErrors((prev) => ({ ...prev, banco: null }));
                      }}
                      onFocus={() => {
                        setTimeout(() => {
                          configScrollRef.current?.scrollTo({ y: 150, animated: true });
                        }, 150);
                      }}
                      placeholder="0102 0000 00 0000000000"
                      placeholderTextColor="#475569"
                    />
                    {tbErrors.numero_cuenta && (
                      <Text style={styles.errorText}>{tbErrors.numero_cuenta}</Text>
                    )}

                    <Text style={styles.label}>Nombre del Titular</Text>
                    <TextInput
                      style={[
                        styles.input,
                        tbErrors.titular && {
                          borderColor: '#ef4444',
                          borderWidth: 1.5,
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        },
                      ]}
                      value={paymentConfig['Transferencia Bancaria']?.titular || ''}
                      onChangeText={(text) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Transferencia Bancaria': {
                            ...(paymentConfig['Transferencia Bancaria'] || {}),
                            titular: text,
                          },
                        });
                        if (tbErrors.titular) setTbErrors((prev) => ({ ...prev, titular: null }));
                      }}
                      onFocus={() => {
                        setTimeout(() => {
                          configScrollRef.current?.scrollTo({ y: 220, animated: true });
                        }, 150);
                      }}
                      placeholder="Nombre y Apellido o Razón Social"
                      placeholderTextColor="#475569"
                    />
                    {tbErrors.titular && (
                      <Text style={styles.errorText}>{tbErrors.titular}</Text>
                    )}

                    <Text style={styles.label}>Tipo de Documento</Text>
                    <TouchableOpacity
                      style={[
                        styles.input,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 12,
                          borderColor: isTbDocPickerOpen ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                          marginBottom: isTbDocPickerOpen ? 6 : 15,
                        },
                      ]}
                      onPress={() => setIsTbDocPickerOpen(!isTbDocPickerOpen)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <View style={styles.docBadge}>
                          <Text style={styles.docBadgeText}>
                            {getDocTypeInfo(paymentConfig['Transferencia Bancaria']?.tipo_doc).prefix}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: '500',
                            marginLeft: 10,
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {getDocTypeInfo(paymentConfig['Transferencia Bancaria']?.tipo_doc).title}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: '#60a5fa',
                          fontSize: 13,
                          fontWeight: '600',
                          marginLeft: 8,
                        }}
                      >
                        {isTbDocPickerOpen ? 'Cerrar ▲' : 'Elegir ▼'}
                      </Text>
                    </TouchableOpacity>

                    {isTbDocPickerOpen && (
                      <View style={styles.dropdownContainer}>
                        {DOCUMENT_TYPES.map((doc, idx) => {
                          const currentTbKey = getDocTypeInfo(paymentConfig['Transferencia Bancaria']?.tipo_doc).key;
                          const isSelected = currentTbKey === doc.key;
                          return (
                            <TouchableOpacity
                              key={doc.key}
                              style={[
                                styles.dropdownItem,
                                isSelected && styles.dropdownItemSelected,
                                idx === DOCUMENT_TYPES.length - 1 && { borderBottomWidth: 0 },
                              ]}
                              onPress={() => {
                                setPaymentConfig({
                                  ...paymentConfig,
                                  'Transferencia Bancaria': {
                                    ...(paymentConfig['Transferencia Bancaria'] || {}),
                                    tipo_doc: doc.key,
                                  },
                                });
                                setIsTbDocPickerOpen(false);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.docBadge, isSelected && styles.docBadgeActive]}>
                                <Text
                                  style={[
                                    styles.docBadgeText,
                                    isSelected && styles.docBadgeTextActive,
                                  ]}
                                >
                                  {doc.prefix}
                                </Text>
                              </View>
                              <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                                <Text
                                  style={[
                                    styles.dropdownItemTitle,
                                    isSelected && styles.dropdownItemTitleActive,
                                  ]}
                                >
                                  {doc.title}
                                </Text>
                                <Text style={styles.dropdownItemSubtitle}>
                                  {doc.subtitle}
                                </Text>
                              </View>
                              {isSelected && <Text style={styles.dropdownCheckmark}>✓</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    <Text style={styles.label}>Número de Documento (Cédula / RIF)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        tbErrors.cedula && {
                          borderColor: '#ef4444',
                          borderWidth: 1.5,
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        },
                      ]}
                      keyboardType="numeric"
                      value={paymentConfig['Transferencia Bancaria']?.cedula || ''}
                      onChangeText={(text) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Transferencia Bancaria': {
                            ...(paymentConfig['Transferencia Bancaria'] || {}),
                            cedula: text.replace(/\D/g, ''),
                          },
                        });
                        if (tbErrors.cedula) setTbErrors((prev) => ({ ...prev, cedula: null }));
                      }}
                      onFocus={() => {
                        setTimeout(() => {
                          configScrollRef.current?.scrollTo({ y: 300, animated: true });
                        }, 150);
                      }}
                      placeholder="12345678"
                      placeholderTextColor="#475569"
                    />
                    {tbErrors.cedula && (
                      <Text style={styles.errorText}>{tbErrors.cedula}</Text>
                    )}

                    <Text style={styles.label}>Correo Electrónico (Opcional para comprobante)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        tbErrors.email && {
                          borderColor: '#ef4444',
                          borderWidth: 1.5,
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        },
                      ]}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={paymentConfig['Transferencia Bancaria']?.email || ''}
                      onChangeText={(text) => {
                        setPaymentConfig({
                          ...paymentConfig,
                          'Transferencia Bancaria': {
                            ...(paymentConfig['Transferencia Bancaria'] || {}),
                            email: text.trim(),
                          },
                        });
                        if (tbErrors.email) setTbErrors((prev) => ({ ...prev, email: null }));
                      }}
                      onFocus={() => {
                        setTimeout(() => {
                          configScrollRef.current?.scrollToEnd({ animated: true });
                        }, 150);
                      }}
                      placeholder="correo@ejemplo.com"
                      placeholderTextColor="#475569"
                    />
                    {tbErrors.email && (
                      <Text style={styles.errorText}>{tbErrors.email}</Text>
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
    fontSize: 13,
  },
  methodPillTextActive: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
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
  docBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10b981',
  },
  docBadgeText: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: 'bold',
  },
  docBadgeTextActive: {
    color: '#34d399',
  },
  dropdownContainer: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    marginTop: -8,
    marginBottom: 15,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0f172a',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  dropdownItemTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownItemTitleActive: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  dropdownItemSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  dropdownCheckmark: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
