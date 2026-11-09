import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Platform,
  Keyboard,
  KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { fundsApi, colectasApi, loansApi, authApi, baseURL } from '../api/client';
import ScreenTitle from '../components/ScreenTitle';
import PaymentConfigModal from '../components/PaymentConfigModal';
import BankTransferCard from '../components/BankTransferCard';
import { OrgContext } from '../context/OrgContext';
import { subscribeRealtime } from '../utils/realtime';
import { getErrorMessage, isNetworkError } from '../utils/errors';
import theme from '../utils/theme';
import { OfflineEmptyState, OfflineNotice } from '../components/OfflineNotice';
import { VENEZUELAN_BANKS, getBankLabel } from '../utils/banks';
import { parseVEAmount, formatVE, formatCurrencyVE } from '../utils/currency';

const normalizePaymentMethodName = (method) => {
  if (!method) return '';
  const m = String(method).toLowerCase().trim();
  if (m === 'pago_movil' || m === 'pago movil' || m === 'pagomovil') return 'Pago Móvil';
  if (m === 'transferencia' || m === 'transferencia bancaria' || m === 'transferencia_bancaria') return 'Transferencia Bancaria';
  if (m === 'binance' || m === 'binance_pay' || m === 'usdt') return 'Binance';
  if (m === 'zelle') return 'Zelle';
  if (m === 'efectivo' || m === 'efectivo usd' || m === 'efectivo_usd') return 'Efectivo USD';
  if (m === 'efectivo bolívares' || m === 'efectivo_bolivares' || m === 'efectivo ves') return 'Efectivo Bolívares';
  return method;
};

const getBeneficiaryMethodData = (datosPago, method) => {
  if (!datosPago) return null;
  let obj = datosPago;
  if (typeof datosPago === 'string') {
    try {
      obj = JSON.parse(datosPago);
    } catch (_) {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;

  if (obj[method] !== undefined) return obj[method];

  const targetNorm = normalizePaymentMethodName(method).toLowerCase();
  for (const [k, v] of Object.entries(obj)) {
    if (normalizePaymentMethodName(k).toLowerCase() === targetNorm) {
      return v;
    }
  }
  return null;
};

const getAvailablePaymentMethods = (datosPago) => {
  if (!datosPago) return [];
  let obj = datosPago;
  if (typeof datosPago === 'string') {
    try {
      obj = JSON.parse(datosPago);
    } catch (_) {
      return [];
    }
  }
  if (!obj || typeof obj !== 'object') return [];

  const methods = [];
  for (const [key, val] of Object.entries(obj)) {
    const normKey = normalizePaymentMethodName(key);
    if (normKey === 'Pago Móvil') {
      if (val && typeof val === 'object' && val.banco && val.cedula && val.telefono) {
        if (!methods.includes(normKey)) methods.push(normKey);
      }
    } else if (normKey === 'Transferencia Bancaria') {
      if (
        val &&
        typeof val === 'object' &&
        val.banco &&
        val.numero_cuenta &&
        String(val.numero_cuenta).replace(/\D/g, '').length === 20 &&
        val.cedula &&
        val.titular
      ) {
        if (!methods.includes(normKey)) methods.push(normKey);
      }
    } else if (typeof val === 'string' && val.trim().length > 0) {
      if (!methods.includes(normKey)) methods.push(normKey);
    } else if (val && typeof val === 'object' && Object.keys(val).length > 0) {
      if (!methods.includes(normKey)) methods.push(normKey);
    }
  }
  return methods;
};

const hasConfiguredPaymentMethods = (config) => {
  if (!config || typeof config !== 'object') return false;
  return getAvailablePaymentMethods(config).length > 0;
};

export default function FundsScreen() {
  const { activeOrg, loading: orgLoading, isOffline, setIsOffline, retryConnection } = React.useContext(OrgContext);
  const [activeTab, setActiveTab] = useState('colectas'); // 'colectas' | 'periodicos'
  const [currentUser, setCurrentUser] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [retryingFunds, setRetryingFunds] = useState(false);
  const [paymentBankCode, setPaymentBankCode] = useState('0102');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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


  // Estados de Colectas
  const [colectas, setColectas] = useState([]);
  const [rates, setRates] = useState({});
  const [loadingColectas, setLoadingColectas] = useState(true);
  const [colectasFilter, setColectasFilter] = useState('active'); // 'active' | 'history'

  const activeColectas = colectas.filter((c) => !c.gasto_validado && !['completada', 'cancelada'].includes(c.estado));
  const historyColectas = colectas.filter((c) => c.gasto_validado || ['completada', 'cancelada'].includes(c.estado));
  const displayedColectas = colectasFilter === 'active' ? activeColectas : historyColectas;

  // Visor de Comprobantes de Pago / Gastos
  const [receiptViewerVisible, setReceiptViewerVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const serverUrl = (baseURL || '').replace('/api/v1', '');

  const getFullUrl = (receiptUrl) => {
    if (!receiptUrl) return '';
    if (receiptUrl.startsWith('http://') || receiptUrl.startsWith('https://')) {
      return receiptUrl;
    }
    const cleanPath = receiptUrl.startsWith('/') ? receiptUrl : `/${receiptUrl}`;
    return `${serverUrl}${cleanPath}`;
  };

  const openReceiptViewer = (receiptUrl, title = 'Comprobante', extraInfo = {}) => {
    if (!receiptUrl) return;
    const fullUrl = getFullUrl(receiptUrl);
    setSelectedReceipt({
      url: fullUrl,
      title: title,
      method: extraInfo.method,
      reference: extraInfo.reference,
      amount: extraInfo.amount,
    });
    setImageLoading(true);
    setImageError(false);
    setReceiptViewerVisible(true);
  };

  // Estados de Fondos Comunes (Periódicos)
  const [funds, setFunds] = useState([]);
  const [loadingFunds, setLoadingFunds] = useState(true);

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [targetColecta, setTargetColecta] = useState(null);
  const [targetCompromiso, setTargetCompromiso] = useState(null);
  const [expandedContribs, setExpandedContribs] = useState({});
  const [expandedSocioContribs, setExpandedSocioContribs] = useState({});

  const toggleExpandedContribs = (colectaId) => {
    setExpandedContribs(prev => ({
      ...prev,
      [colectaId]: !prev[colectaId],
    }));
  };

  const toggleExpandedSocioContribs = (key) => {
    setExpandedSocioContribs(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Cancelar Colecta por Fuerza Mayor
  const [cancelMotive, setCancelMotive] = useState('');
  const [canceling, setCanceling] = useState(false);

  // Devolver Aporte
  const [refundCompromiso, setRefundCompromiso] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundCurrency, setRefundCurrency] = useState('VES');
  const [refundMethod, setRefundMethod] = useState('Pago Móvil');
  const [refundRef, setRefundRef] = useState('');
  const [refundCommission, setRefundCommission] = useState('0');
  const [refundReceiptUri, setRefundReceiptUri] = useState(null);
  const [refunding, setRefunding] = useState(false);

  // Formulario Crear Colecta
  const [titulo, setTitulo] = useState('');
  const [proposito, setProposito] = useState('');
  const [montoMeta, setMontoMeta] = useState('');
  const [colectaCurrency, setColectaCurrency] = useState('USD'); // 'USD' | 'VES'
  const [tipoTasa, setTipoTasa] = useState('bcv');
  const [tasaFijaValor, setTasaFijaValor] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [dateObj, setDateObj] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [horaPago, setHoraPago] = useState('12:00');
  const [timeObj, setTimeObj] = useState(() => {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    return t;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      setTimeObj(selectedTime);
      const hours = String(selectedTime.getHours()).padStart(2, '0');
      const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
      setHoraPago(`${hours}:${minutes}`);
    }
  };

  // Rechazar Pago por parte del Gestor
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectCompromiso, setRejectCompromiso] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [beneficiarioNombre, setBeneficiarioNombre] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDateObj(selectedDate);
      setFechaPago(selectedDate.toISOString().split('T')[0]);
    }
  };

  // Formulario Prometer Aporte
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeCurrency, setPledgeCurrency] = useState('USD'); // 'USD' | 'VES'

  // Formulario Confirmar Pago
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [receiptUri, setReceiptUri] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [userPaymentConfig, setUserPaymentConfig] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const copyField = async (fieldKey, value) => {
    if (!value) return;
    try {
      await Clipboard.setStringAsync(String(value));
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.warn('Error copying to clipboard', e);
    }
  };

  const copyAllPagoMovil = async (pmData, montoBs, fieldKey = 'all') => {
    if (!pmData) return;
    try {
      const getPrefix = (tipo) => {
        if (!tipo || tipo === 'Persona' || tipo === 'V') return 'V';
        if (tipo === 'Extranjero' || tipo === 'E') return 'E';
        if (tipo === 'Comercio' || tipo === 'J') return 'J';
        if (tipo === 'Gubernamental' || tipo === 'G') return 'G';
        if (tipo === 'Comuna' || tipo === 'C') return 'C';
        return tipo[0] || 'V';
      };
      const docPrefix = getPrefix(pmData.tipo_doc);
      const safeDoc = `${docPrefix}-${pmData.cedula || ''}`;
      const safeBanco = pmData.banco || '';
      const safeTelefono = pmData.telefono || '';
      const montoText = montoBs ? ` | Monto: ${montoBs} Bs` : '';
      const text = `Banco: ${safeBanco} | ${safeDoc} | ${safeTelefono}${montoText}`;
      await Clipboard.setStringAsync(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.warn('Error copying all to clipboard', e);
    }
  };

  const renderPaymentMethodBadge = (method) => {
    if (!method) return null;
    const m = String(method).trim();
    let iconName = 'card-outline';
    let label = m;
    let bg = 'rgba(148, 163, 184, 0.12)';
    let border = 'rgba(148, 163, 184, 0.3)';
    let textColor = '#cbd5e1';
    let iconColor = '#cbd5e1';
    let iconSize = 13;

    const lower = m.toLowerCase();
    if (lower.includes('pago móvil') || lower.includes('pago movil')) {
      iconName = 'phone-portrait-outline';
      label = 'Pago Móvil';
      bg = 'rgba(2, 132, 199, 0.14)';
      border = 'rgba(56, 189, 248, 0.35)';
      textColor = '#38bdf8';
      iconColor = '#38bdf8';
      iconSize = 13;
    } else if (lower.includes('transferencia')) {
      iconName = 'swap-horizontal';
      label = 'Transferencia';
      bg = 'rgba(99, 102, 241, 0.14)';
      border = 'rgba(129, 140, 248, 0.35)';
      textColor = '#a5b4fc';
      iconColor = '#a5b4fc';
      iconSize = 15;
    } else if (lower.includes('efectivo')) {
      iconName = 'cash-outline';
      label = 'Efectivo';
      bg = 'rgba(16, 185, 129, 0.14)';
      border = 'rgba(52, 211, 153, 0.35)';
      textColor = '#34d399';
      iconColor = '#34d399';
      iconSize = 13;
    } else if (lower.includes('propio') || lower.includes('gestor') || lower.includes('beneficiario')) {
      iconName = 'person-outline';
      label = 'Aporte Propio';
      bg = 'rgba(245, 158, 11, 0.14)';
      border = 'rgba(251, 191, 36, 0.35)';
      textColor = '#fbbf24';
      iconColor = '#fbbf24';
      iconSize = 13;
    }

    return (
      <View key={m} style={[styles.methodBadge, { backgroundColor: bg, borderColor: border }]}>
        <Ionicons name={iconName} size={iconSize} color={iconColor} style={styles.methodBadgeIcon} />
        <Text style={[styles.methodBadgeText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  const fetchUserPaymentConfig = async () => {
    try {
      const res = await loansApi.getPaymentMethods();
      const parsed = JSON.parse(res?.payment_methods_json || '{}');
      setUserPaymentConfig(parsed);
      return parsed;
    } catch (e) {
      console.warn('Error loading user payment config in FundsScreen', e);
      return {};
    }
  };

  // Formulario Validar Gasto
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseReceiptUri, setExpenseReceiptUri] = useState(null);

  // Formulario Crear Fondo Común
  const [newFundName, setNewFundName] = useState('');
  const [newFundType, setNewFundType] = useState('emergency');
  const [newFundTarget, setNewFundTarget] = useState('');

  // Cargar usuario actual
  const fetchUser = async () => {
    try {
      const u = await authApi.me();
      setCurrentUser(u);
      if (u?.first_name) {
        setBeneficiarioNombre(`${u.first_name} ${u.last_name || ''}`.trim());
      }
    } catch (e) {
      console.warn('Error fetching user in FundsScreen', e);
    }
  };

  // Cargar Colectas y Tasas
  const fetchColectas = async () => {
    try {
      setLoadingColectas(true);
      setConnectionError(false);
      const [data, ratesData] = await Promise.all([
        colectasApi.getColectas(),
        colectasApi.getRates().catch(() => ({}))
      ]);
      setColectas(data);
      setRates(ratesData);
      if (setIsOffline) setIsOffline(false);
      if (activeOrg?.id) {
        AsyncStorage.setItem(`cached_colectas_${activeOrg.id}`, JSON.stringify(data)).catch(() => {});
      }
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
        if (activeOrg?.id) {
          try {
            const cached = await AsyncStorage.getItem(`cached_colectas_${activeOrg.id}`);
            if (cached) setColectas(JSON.parse(cached));
          } catch (_) {}
        }
      } else {
        console.warn('Error loading colectas', e);
      }
    } finally {
      setLoadingColectas(false);
    }
  };

  // Cargar Fondos Comunes
  const fetchFunds = async () => {
    try {
      setLoadingFunds(true);
      setConnectionError(false);
      const data = await fundsApi.getFunds();
      setFunds(data);
      if (setIsOffline) setIsOffline(false);
      if (activeOrg?.id) {
        AsyncStorage.setItem(`cached_funds_${activeOrg.id}`, JSON.stringify(data)).catch(() => {});
      }
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
        if (activeOrg?.id) {
          try {
            const cached = await AsyncStorage.getItem(`cached_funds_${activeOrg.id}`);
            if (cached) setFunds(JSON.parse(cached));
          } catch (_) {}
        }
      } else {
        console.warn('Error loading funds', e);
      }
    } finally {
      setLoadingFunds(false);
    }
  };

  const handleRetryFunds = async () => {
    setRetryingFunds(true);
    try {
      await Promise.all([fetchColectas(), fetchFunds()]);
      if (retryConnection) await retryConnection();
    } finally {
      setRetryingFunds(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchUserPaymentConfig();
    // Default fecha de pago: dentro de 7 días
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDateObj(d);
    setFechaPago(d.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (activeOrg?.id) {
      fetchColectas();
      fetchFunds();
    } else if (!orgLoading) {
      setLoadingColectas(false);
      setLoadingFunds(false);
    }
  }, [activeOrg?.id, orgLoading]);

  useFocusEffect(
    useCallback(() => {
      if (activeOrg?.id) {
        fetchColectas();
        fetchFunds();
        fetchUserPaymentConfig();
      }
    }, [activeOrg?.id])
  );

  // Suscripción Realtime (WebSockets)
  useEffect(() => {
    if (!activeOrg?.id) return;
    const unsubs = [
      subscribeRealtime('COLECTAS_CHANGED', fetchColectas),
      subscribeRealtime('FUNDS_CHANGED', fetchFunds),
      subscribeRealtime('RECONNECTED', () => {
        fetchColectas();
        fetchFunds();
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [activeOrg?.id]);

  // Manejar selector de imágenes con opción previa de recortar
  const pickImage = async (onSelected) => {
    Alert.alert('Adjuntar Comprobante', '¿Cómo deseas agregar el comprobante?', [
      {
        text: '✂️ Galería (Recortar)',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso requerido', 'Se requiere acceso a la galería.');
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.8,
            });
            if (!res.canceled && res.assets?.[0]?.uri) {
              onSelected(res.assets[0].uri);
            }
          } catch (err) {
            console.warn('Error picker:', err);
          }
        },
      },
      {
        text: '🖼️ Galería (Original)',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso requerido', 'Se requiere acceso a la galería.');
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 0.8,
            });
            if (!res.canceled && res.assets?.[0]?.uri) {
              onSelected(res.assets[0].uri);
            }
          } catch (err) {
            console.warn('Error picker:', err);
          }
        },
      },
      {
        text: '📷 Tomar Foto',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara.');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.8,
            });
            if (!res.canceled && res.assets?.[0]?.uri) {
              onSelected(res.assets[0].uri);
            }
          } catch (err) {
            console.warn('Error camera:', err);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const getEffectiveRate = (rateType, fixedVal) => {
    if (rateType === 'fija') return parseFloat(fixedVal) || 1;
    return rates[rateType]?.rate || rates?.bcv?.rate || 1;
  };

  const handleToggleColectaCurrency = (newCurr) => {
    if (newCurr === colectaCurrency) return;
    const parsed = parseVEAmount(montoMeta);
    const effRate = getEffectiveRate(tipoTasa, tasaFijaValor);
    if (parsed !== null && !isNaN(parsed) && parsed > 0 && effRate > 0) {
      if (newCurr === 'VES') {
        setMontoMeta(formatVE(parsed * effRate));
      } else {
        setMontoMeta(formatVE(parsed / effRate));
      }
    }
    setColectaCurrency(newCurr);
  };

  const handleTogglePledgeCurrency = (newCurr) => {
    if (newCurr === pledgeCurrency || !targetColecta) return;
    const parsed = parseVEAmount(pledgeAmount);
    const effRate = targetColecta.tasa_actual || rates[targetColecta.tipo_tasa]?.rate || rates?.bcv?.rate || 1;
    if (parsed !== null && !isNaN(parsed) && parsed > 0 && effRate > 0) {
      if (newCurr === 'VES') {
        setPledgeAmount(formatVE(parsed * effRate));
      } else {
        setPledgeAmount(formatVE(parsed / effRate));
      }
    }
    setPledgeCurrency(newCurr);
  };

  const parsedMeta = parseVEAmount(montoMeta);
  const effCreateRate = getEffectiveRate(tipoTasa, tasaFijaValor);
  const metaCountervalueBs = (colectaCurrency === 'USD' && parsedMeta !== null && effCreateRate > 0)
    ? parsedMeta * effCreateRate
    : null;
  const metaCountervalueUsd = (colectaCurrency === 'VES' && parsedMeta !== null && effCreateRate > 0)
    ? parsedMeta / effCreateRate
    : null;

  const parsedPledge = parseVEAmount(pledgeAmount);
  const effPledgeRate = targetColecta ? (targetColecta.tasa_actual || rates[targetColecta.tipo_tasa]?.rate || rates?.bcv?.rate || 1) : 1;
  const pledgeCountervalueBs = (pledgeCurrency === 'USD' && parsedPledge !== null && effPledgeRate > 0)
    ? parsedPledge * effPledgeRate
    : null;
  const pledgeCountervalueUsd = (pledgeCurrency === 'VES' && parsedPledge !== null && effPledgeRate > 0)
    ? parsedPledge / effPledgeRate
    : null;

  const handleOpenConfig = () => {
    setShowConfigModal(true);
  };

  const handlePressCreateColecta = async () => {
    const latestConfig = await fetchUserPaymentConfig();
    if (!hasConfiguredPaymentMethods(latestConfig)) {
      Alert.alert(
        'Datos de Pago Requeridos',
        'Debes registrar al menos un método de pago antes de proponer una colecta para que los miembros de la mutual puedan transferir los aportes a quien gestionará la compra.',
        [
          { text: 'Cargar Datos de Pago', onPress: handleOpenConfig },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
      return;
    }
    setShowCreateModal(true);
  };

  // Crear Colecta
  const handleCreateColecta = async () => {
    if (!titulo.trim() || !proposito.trim() || !montoMeta) {
      Alert.alert('Campos requeridos', 'Por favor ingresa título, propósito y monto meta.');
      return;
    }
    const parsed = parseVEAmount(montoMeta);
    if (parsed === null || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Monto inválido', 'El monto meta debe ser mayor a 0.');
      return;
    }
    if (tipoTasa === 'fija' && (!tasaFijaValor || parseFloat(tasaFijaValor) <= 0)) {
      Alert.alert('Tasa fija requerida', 'Ingresa el valor numérico para la tasa fija.');
      return;
    }

    const latestConfig = await fetchUserPaymentConfig();
    if (!hasConfiguredPaymentMethods(latestConfig)) {
      Alert.alert(
        'Datos de Pago Requeridos',
        'Debes registrar al menos un método de pago antes de proponer una colecta para que los miembros de la mutual puedan transferir los aportes a quien gestionará la compra.',
        [
          { text: 'Cargar Datos de Pago', onPress: handleOpenConfig },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
      return;
    }

    setSubmitting(true);
    try {
      const effRate = getEffectiveRate(tipoTasa, tasaFijaValor);
      const metaUsd = colectaCurrency === 'VES' ? Number((parsed / effRate).toFixed(2)) : parsed;
      const metaVes = colectaCurrency === 'VES' ? parsed : Number((parsed * effRate).toFixed(2));

      await colectasApi.createColecta({
        titulo: titulo.trim(),
        proposito: proposito.trim(),
        monto_meta_usd: metaUsd,
        monto_meta_ves: metaVes,
        currency: colectaCurrency,
        tipo_tasa: tipoTasa,
        tasa_fija_valor: tipoTasa === 'fija' ? parseFloat(tasaFijaValor) : null,
        fecha_pago: fechaPago,
        hora_pago: horaPago || '12:00',
        beneficiario_nombre: beneficiarioNombre.trim() || undefined,
        beneficiario_datos_pago: (userPaymentConfig && Object.keys(userPaymentConfig).length > 0) ? userPaymentConfig : undefined,
      });

      setShowCreateModal(false);
      setTitulo('');
      setProposito('');
      setMontoMeta('');
      setColectaCurrency('USD');
      setTipoTasa('bcv');
      setTasaFijaValor('');
      const defaultD = new Date();
      defaultD.setDate(defaultD.getDate() + 7);
      setDateObj(defaultD);
      setFechaPago(defaultD.toISOString().split('T')[0]);
      setHoraPago('12:00');
      Alert.alert('¡Colecta Creada!', 'La propuesta de colecta está activa y lista para recibir compromisos.');
      setConnectionError(false);
      if (setIsOffline) setIsOffline(false);
      fetchColectas();
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
      }
      Alert.alert('Error', getErrorMessage(e, 'No se pudo crear la colecta'));
    } finally {
      setSubmitting(false);
    }
  };

  // Prometer Aporte
  const handlePledge = async () => {
    if (!targetColecta || !targetColecta.id) {
      Alert.alert('Error', 'No se ha seleccionado una colecta válida.');
      return;
    }
    const parsed = parseVEAmount(pledgeAmount);
    if (parsed === null || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
      return;
    }
    setSubmitting(true);
    try {
      const effRate = targetColecta.tasa_actual || rates[targetColecta.tipo_tasa]?.rate || rates?.bcv?.rate || 1;
      const pledgeUsd = pledgeCurrency === 'VES' ? Number((parsed / effRate).toFixed(2)) : parsed;
      const pledgeVes = pledgeCurrency === 'VES' ? parsed : Number((parsed * effRate).toFixed(2));

      await colectasApi.pledgeCommitment(targetColecta.id, {
        monto_usd: pledgeUsd,
        monto_ves: pledgeVes,
        currency: pledgeCurrency
      });
      setShowPledgeModal(false);
      setPledgeAmount('');
      setPledgeCurrency('USD');
      setTargetColecta(null);
      setConnectionError(false);
      if (setIsOffline) setIsOffline(false);
      Alert.alert('¡Compromiso Registrado!', 'Tu aporte voluntario ha sido registrado exitosamente.');
      fetchColectas();
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
      }
      Alert.alert('Error', getErrorMessage(e, 'No se pudo registrar el compromiso'));
    } finally {
      setSubmitting(false);
    }
  };

  // Cancelar Compromiso
  const handleCancelCommitment = (colecta, compromiso) => {
    Alert.alert(
      '¿Cancelar Aporte?',
      `¿Deseas cancelar tu compromiso de $${compromiso.monto_usd} USD? Si la colecta baja del 100% volverá a estado propuesta.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await colectasApi.cancelCommitment(colecta.id, compromiso.id);
              setConnectionError(false);
              if (setIsOffline) setIsOffline(false);
              Alert.alert('Cancelado', 'Tu compromiso ha sido cancelado.');
              fetchColectas();
            } catch (e) {
              if (isNetworkError(e)) {
                setConnectionError(true);
                if (setIsOffline) setIsOffline(true);
              }
              Alert.alert('Error', getErrorMessage(e, 'No se pudo cancelar el compromiso'));
            }
          },
        },
      ]
    );
  };

  // Recordatorio de Cobro para Aportes Pendientes (Gestor)
  const handleRemindPending = async (colecta) => {
    Alert.alert(
      'Recordar Pago',
      `¿Deseas enviar un recordatorio con el monto actualizado en Bs (tasa ${colecta.tasa_label}: ${colecta.tasa_actual?.toFixed(2)}) a los aportantes que aún no han notificado su pago?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar Recordatorio',
          onPress: async () => {
            try {
              await colectasApi.recordarPendientes(colecta.id);
              setConnectionError(false);
              if (setIsOffline) setIsOffline(false);
              Alert.alert('¡Recordatorio Enviado!', 'Se notificó a los aportantes con compromisos pendientes.');
              fetchColectas();
            } catch (e) {
              if (isNetworkError(e)) {
                setConnectionError(true);
                if (setIsOffline) setIsOffline(true);
              }
              Alert.alert('Error', getErrorMessage(e, 'No se pudo enviar el recordatorio'));
            }
          },
        },
      ]
    );
  };

  // Alias para retrocompatibilidad
  const handleNotifyPayment = handleRemindPending;

  // Confirmar Pago de Aporte
  const handleConfirmPayment = async () => {
    const activeComp = targetCompromiso || targetColecta?.mi_compromiso;
    if (!targetColecta || !targetColecta.id || !activeComp?.id) {
      Alert.alert('Error', 'No se ha seleccionado un compromiso válido.');
      return;
    }
    setSubmitting(true);
    try {
      const isBeneficiarySelf = Boolean(currentUser && targetColecta.beneficiario_id === currentUser.id);
      let finalComprobanteUrl = null;
      if (!isBeneficiarySelf && receiptUri) {
        setUploadingReceipt(true);
        const resUpload = await loansApi.uploadFile(receiptUri);
        finalComprobanteUrl = resUpload.url || resUpload.file_url;
        setUploadingReceipt(false);
      }

      const compromisoId = activeComp.id;
      await colectasApi.confirmPayment(targetColecta.id, compromisoId, {
        payment_method: isBeneficiarySelf ? 'Aporte Propio' : paymentMethod,
        codigo_banco: undefined,
        referencia_pago: isBeneficiarySelf ? 'Aporte directo de quien gestiona' : (paymentRef.trim() || undefined),
        comprobante_url: isBeneficiarySelf ? undefined : finalComprobanteUrl,
        nota_pago: isBeneficiarySelf ? 'Aporte propio directo' : (paymentNote.trim() || undefined),
      });

      setShowPaymentModal(false);
      setPaymentRef('');
      setPaymentNote('');
      setReceiptUri(null);
      setTargetColecta(null);
      setTargetCompromiso(null);
      setConnectionError(false);
      if (setIsOffline) setIsOffline(false);
      Alert.alert(
        isBeneficiarySelf ? '¡Aporte Propio Confirmado!' : '¡Pago Confirmado!',
        isBeneficiarySelf
          ? 'Tu aporte voluntario ha sido registrado y acreditado directamente a la colecta.'
          : 'Tu aporte ha sido registrado como pagado.'
      );
      fetchColectas();
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
      }
      Alert.alert('Error', getErrorMessage(e, 'Error al confirmar el pago'));
    } finally {
      setSubmitting(false);
      setUploadingReceipt(false);
    }
  };

  // Cancelar Colecta por Fuerza Mayor
  const handleCancelColecta = (colecta) => {
    setTargetColecta(colecta);
    setCancelMotive('');
    setShowCancelModal(true);
  };

  const handleConfirmCancelColecta = async () => {
    if (!targetColecta || !targetColecta.id) return;
    if (!cancelMotive.trim()) {
      Alert.alert('Motivo requerido', 'Por favor ingresa la causa de fuerza mayor para cancelar la colecta.');
      return;
    }
    setCanceling(true);
    try {
      await colectasApi.cancelColecta(targetColecta.id, { motivo: cancelMotive.trim() });
      setShowCancelModal(false);
      setCancelMotive('');
      setTargetColecta(null);
      Alert.alert(
        'Colecta Cancelada por Fuerza Mayor',
        'La colecta ha sido cancelada. Si existen aportes recaudados, procede a reintegrarlos a cada socio según su método original.'
      );
      fetchColectas();
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'No se pudo cancelar la colecta'));
    } finally {
      setCanceling(false);
    }
  };

  // Abrir Modal de Devolución de Aporte
  const handleOpenRefund = (colecta, comp) => {
    setTargetColecta(colecta);
    setRefundCompromiso(comp);
    const isBs = comp.payment_method === 'Pago Móvil' || comp.payment_method === 'Transferencia Bancaria';
    const initialAmount = isBs
      ? (comp.monto_bs || (comp.monto_usd * (colecta.tasa_actual || 1)))
      : comp.monto_usd;
    setRefundAmount(String(initialAmount ? Math.round(initialAmount * 100) / 100 : ''));
    setRefundCurrency(isBs ? 'VES' : 'USD');
    setRefundMethod(comp.payment_method || 'Pago Móvil');
    setRefundRef('');
    setRefundCommission('0');
    setRefundReceiptUri(null);
    setShowRefundModal(true);
  };

  // Confirmar Devolución de Aporte
  const handleConfirmRefund = async () => {
    if (!targetColecta || !refundCompromiso) return;
    const parsedAmount = parseFloat(refundAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Monto inválido', 'El monto a devolver debe ser mayor a 0.');
      return;
    }
    const parsedCommission = parseFloat(refundCommission) || 0;
    setRefunding(true);
    try {
      let finalReceiptUrl = null;
      if (refundReceiptUri) {
        setUploadingReceipt(true);
        const resUpload = await loansApi.uploadFile(refundReceiptUri);
        finalReceiptUrl = resUpload.url || resUpload.file_url;
        setUploadingReceipt(false);
      }

      await colectasApi.refundCommitment(targetColecta.id, refundCompromiso.id, {
        monto_devuelto: parsedAmount,
        moneda_devolucion: refundCurrency,
        metodo_devolucion: refundMethod,
        referencia_devolucion: refundRef.trim() || undefined,
        comprobante_devolucion_url: finalReceiptUrl || undefined,
        comision_descontada: parsedCommission,
      });

      setShowRefundModal(false);
      setRefundCompromiso(null);
      setTargetColecta(null);
      Alert.alert(
        'Devolución Exitosa',
        `El aporte de ${refundCompromiso.socio_name} ha sido registrado como devuelto exitosamente.`
      );
      fetchColectas();
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'No se pudo registrar la devolución del aporte'));
    } finally {
      setRefunding(false);
      setUploadingReceipt(false);
    }
  };

  // Validar Gasto (Beneficiario)
  const handleValidateExpense = async () => {
    if (!targetColecta || !targetColecta.id) {
      Alert.alert('Error', 'No se ha seleccionado una colecta válida.');
      return;
    }
    if (!expenseDesc.trim()) {
      Alert.alert('Descripción requerida', 'Por favor describe cómo se realizó el gasto.');
      return;
    }
    setSubmitting(true);
    try {
      let finalComprobanteUrl = null;
      if (expenseReceiptUri) {
        setUploadingReceipt(true);
        const resUpload = await loansApi.uploadFile(expenseReceiptUri);
        finalComprobanteUrl = resUpload.url || resUpload.file_url;
        setUploadingReceipt(false);
      }

      await colectasApi.validateExpense(targetColecta.id, {
        descripcion_gasto: expenseDesc.trim(),
        comprobante_gasto_url: finalComprobanteUrl,
      });

      setShowExpenseModal(false);
      setExpenseDesc('');
      setExpenseReceiptUri(null);
      setTargetColecta(null);
      setConnectionError(false);
      if (setIsOffline) setIsOffline(false);
      Alert.alert('¡Colecta Culminada!', 'La rendición de cuentas fue registrada y se notificó a todos los miembros de la mutual.');
      fetchColectas();
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
      }
      Alert.alert('Error', getErrorMessage(e, 'No se pudo validar el gasto'));
    } finally {
      setSubmitting(false);
      setUploadingReceipt(false);
    }
  };

  // Validar Pago de Aporte por el Gestor (Homologado a Préstamos)
  const handleVerifyCompromiso = (colectaId, compId, socioName, montoUsd) => {
    Alert.alert(
      "Validar Pago",
      `¿Confirmas que recibiste el aporte de $${formatVE(montoUsd)} USD de ${socioName || 'este socio'}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, Validar",
          onPress: async () => {
            try {
              await colectasApi.verifyPayment(colectaId, compId);
              Alert.alert('¡Éxito!', 'Pago de aporte validado correctamente.');
              fetchColectas();
            } catch (e) {
              if (isNetworkError(e)) {
                setConnectionError(true);
                if (setIsOffline) setIsOffline(true);
              }
              Alert.alert('Error', getErrorMessage(e, 'No se pudo validar el pago'));
            }
          }
        }
      ]
    );
  };

  // Rechazar Pago de Aporte por el Gestor
  const handleOpenRejectCompromiso = (colecta, comp) => {
    setTargetColecta(colecta);
    setRejectCompromiso(comp);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleConfirmRejectCompromiso = async () => {
    if (!targetColecta || !rejectCompromiso) return;
    if (!rejectReason.trim()) {
      Alert.alert('Motivo requerido', 'Por favor ingresa la razón por la cual rechazas la notificación de pago.');
      return;
    }
    setRejecting(true);
    try {
      await colectasApi.rejectPayment(targetColecta.id, rejectCompromiso.id, {
        motivo: rejectReason.trim(),
      });
      setShowRejectModal(false);
      setRejectCompromiso(null);
      setRejectReason('');
      Alert.alert(
        'Pago Rechazado',
        'El aporte ha regresado a estado prometido y se notificó al socio con el motivo para que pueda revisar o transferir nuevamente.'
      );
      fetchColectas();
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
      }
      Alert.alert('Error', getErrorMessage(e, 'No se pudo rechazar la notificación de pago'));
    } finally {
      setRejecting(false);
    }
  };

  // Crear Fondo Común
  const handleCreateFund = async () => {
    if (!newFundName.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    setSubmitting(true);
    try {
      await fundsApi.createFund({
        name: newFundName.trim(),
        fund_type: newFundType,
        target_monthly_contribution_usd: newFundTarget ? parseFloat(newFundTarget) : null,
      });
      setShowFundModal(false);
      setNewFundName('');
      setNewFundTarget('');
      setConnectionError(false);
      if (setIsOffline) setIsOffline(false);
      fetchFunds();
    } catch (e) {
      if (isNetworkError(e)) {
        setConnectionError(true);
        if (setIsOffline) setIsOffline(true);
      }
      Alert.alert('Error', getErrorMessage(e, 'Error al crear fondo'));
    } finally {
      setSubmitting(false);
    }
  };

  // Obtener estilo de badge de estado
  const getStatusBadge = (estado, item = null) => {
    if (item?.gasto_validado || estado === 'completada') {
      return { label: '✅ CULMINADA', bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' };
    }
    switch (estado) {
      case 'propuesta':
        return { label: '⏳ PROPUESTA', bg: '#fef3c7', text: '#d97706', border: '#fcd34d' };
      case 'activa':
        return { label: '🚀 ACTIVA', bg: '#d1fae5', text: '#059669', border: '#6ee7b7' };
      case 'cerrada':
        return { label: '📥 RECAUDADA', bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' };
      case 'completada':
        return { label: '✅ CULMINADA', bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' };
      case 'cancelada':
        if (item?.tiene_devoluciones_pendientes) {
          return { label: '⚠️ CANCELADA (DEVOLVIENDO)', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: '#ef4444' };
        }
        return { label: '✖️ CANCELADA', bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
      default:
        return { label: estado?.toUpperCase(), bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
    }
  };

  // Helper para formatear fecha y hora en formato legible venezolano
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('es-VE', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const contribStatusMap = {
    prometido:     { bg: 'rgba(251, 146, 60, 0.10)', border: '#f97316', badgeBg: '#f97316', badgeText: '#fff', icon: '⏳', label: 'Pendiente de pago' },
    notificado:    { bg: 'rgba(251, 146, 60, 0.10)', border: '#f97316', badgeBg: '#f97316', badgeText: '#fff', icon: '⏳', label: 'Pendiente de pago' },
    pagado:        { bg: 'rgba(250, 204, 21, 0.10)', border: '#facc15', badgeBg: '#ca8a04', badgeText: '#fef08a', icon: '🕐', label: 'En validación' },
    paid:          { bg: 'rgba(250, 204, 21, 0.10)', border: '#facc15', badgeBg: '#ca8a04', badgeText: '#fef08a', icon: '🕐', label: 'En validación' },
    validado:      { bg: 'rgba(59, 130, 246, 0.10)', border: '#3b82f6', badgeBg: '#1d4ed8', badgeText: '#bfdbfe', icon: '✅', label: 'Validado' },
    verified:      { bg: 'rgba(59, 130, 246, 0.10)', border: '#3b82f6', badgeBg: '#1d4ed8', badgeText: '#bfdbfe', icon: '✅', label: 'Validado' },
    devuelto:      { bg: 'rgba(16, 185, 129, 0.10)', border: '#10b981', badgeBg: '#047857', badgeText: '#a7f3d0', icon: '🎉', label: 'Devuelto' },
  };

  const renderGroupStatusBadges = (compromisos) => {
    const counts = {};
    for (const c of compromisos) {
      const key = (c.estado === 'paid' ? 'pagado' : c.estado === 'verified' ? 'validado' : c.estado === 'notificado' ? 'prometido' : c.estado);
      counts[key] = (counts[key] || 0) + 1;
    }
    const keys = Object.keys(counts);
    if (keys.length === 1) {
      const st = keys[0];
      const n = counts[st];
      const cfg = contribStatusMap[st] || contribStatusMap.prometido;
      const label = n > 1 ? (st === 'prometido' ? `Pendientes (${n})` : st === 'pagado' ? `Por validar (${n})` : st === 'validado' ? `Validados (${n})` : `${cfg.label}s (${n})`) : cfg.label;
      return (
        <View style={[styles.contribStatusBadge, { backgroundColor: cfg.badgeBg }]}>
          <Text style={{ fontSize: 11 }}>{cfg.icon} </Text>
          <Text style={[styles.contribStatusBadgeText, { color: cfg.badgeText }]}>{label}</Text>
        </View>
      );
    }
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: 170 }}>
        {counts.pagado ? (
          <View style={[styles.contribStatusBadge, { backgroundColor: contribStatusMap.pagado.badgeBg }]}>
            <Text style={{ fontSize: 11 }}>{contribStatusMap.pagado.icon} </Text>
            <Text style={[styles.contribStatusBadgeText, { color: contribStatusMap.pagado.badgeText }]}>
              {counts.pagado} por validar
            </Text>
          </View>
        ) : null}
        {counts.prometido ? (
          <View style={[styles.contribStatusBadge, { backgroundColor: contribStatusMap.prometido.badgeBg }]}>
            <Text style={{ fontSize: 11 }}>{contribStatusMap.prometido.icon} </Text>
            <Text style={[styles.contribStatusBadgeText, { color: contribStatusMap.prometido.badgeText }]}>
              {counts.prometido} pendiente{counts.prometido > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
        {counts.validado ? (
          <View style={[styles.contribStatusBadge, { backgroundColor: contribStatusMap.validado.badgeBg }]}>
            <Text style={{ fontSize: 11 }}>{contribStatusMap.validado.icon} </Text>
            <Text style={[styles.contribStatusBadgeText, { color: contribStatusMap.validado.badgeText }]}>
              {counts.validado} validado{counts.validado > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
        {counts.devuelto ? (
          <View style={[styles.contribStatusBadge, { backgroundColor: contribStatusMap.devuelto.badgeBg }]}>
            <Text style={{ fontSize: 11 }}>{contribStatusMap.devuelto.icon} </Text>
            <Text style={[styles.contribStatusBadgeText, { color: contribStatusMap.devuelto.badgeText }]}>
              {counts.devuelto} devuelto{counts.devuelto > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderCompromisoDetails = (comp, colectaItem, isSub = false, index = null) => {
    const cs = contribStatusMap[comp.estado] || { bg: 'rgba(100,116,139,0.08)', border: '#475569', badgeBg: '#334155', badgeText: '#94a3b8', icon: '📋', label: comp.estado };
    const initial = comp.socio_name ? comp.socio_name.trim()[0].toUpperCase() : '?';
    const isGestor = currentUser && (currentUser.id === (colectaItem.beneficiario_id || colectaItem.proponente_id));

    return (
      <View
        key={comp.id}
        style={isSub ? [styles.socioSubCard, { borderLeftColor: cs.border }] : [styles.contribCard, { backgroundColor: cs.bg, borderLeftColor: cs.border }]}
      >
        {/* Cabecera */}
        <View style={styles.contribCardHeader}>
          {isSub ? (
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#f8fafc' }}>
                Aporte #{index}
              </Text>
              {comp.fecha_compromiso ? (
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                  📅 Prometido: {formatDateTime(comp.fecha_compromiso)}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.contribAvatarWrap}>
              <View style={[styles.contribAvatar, { backgroundColor: cs.border + '33', borderColor: cs.border }]}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: cs.border }}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contribName}>{comp.socio_name}</Text>
                <Text style={styles.contribAmountLine}>
                  ${formatVE(comp.monto_usd)} USD
                  <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'normal' }}>
                    {` (~Bs ${formatVE(comp.monto_bs || (comp.monto_usd * colectaItem.tasa_actual))})`}
                  </Text>
                </Text>
                {comp.fecha_compromiso ? (
                  <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                    📅 Prometido: {formatDateTime(comp.fecha_compromiso)}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          <View style={[styles.contribStatusBadge, { backgroundColor: cs.badgeBg }]}>
            <Text style={{ fontSize: 11 }}>{cs.icon} </Text>
            <Text style={[styles.contribStatusBadgeText, { color: cs.badgeText }]}>{cs.label}</Text>
          </View>
        </View>

        {isSub && (
          <View style={{ marginBottom: 4 }}>
            <Text style={[styles.contribAmountLine, { fontSize: 13, fontWeight: '700', color: '#f1f5f9' }]}>
              ${formatVE(comp.monto_usd)} USD
              <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'normal' }}>
                {` (~Bs ${formatVE(comp.monto_bs || (comp.monto_usd * colectaItem.tasa_actual))})`}
              </Text>
            </Text>
          </View>
        )}

        {/* Trazabilidad de estampa de tiempo y cambios de estado */}
        {comp.fecha_validacion ? (
          <Text style={[styles.contribTimestampInfo, { color: '#60a5fa' }]}>
            ✅ Validado el {formatDateTime(comp.fecha_validacion)}
          </Text>
        ) : comp.fecha_notificacion ? (
          <Text style={[styles.contribTimestampInfo, { color: '#facc15' }]}>
            🕐 Notificado el {formatDateTime(comp.fecha_notificacion)}
          </Text>
        ) : null}

        {/* Detalles de método o referencia */}
        {(comp.payment_method || comp.referencia_pago) ? (
          <View style={styles.contribMeta}>
            {comp.payment_method ? renderPaymentMethodBadge(comp.payment_method) : null}
            {comp.referencia_pago ? (
              <View style={styles.contribMetaRow}>
                <Text style={styles.contribMetaIcon}>#</Text>
                <Text style={styles.contribMetaText}>
                  {comp.referencia_pago.replace(/beneficiario/gi, 'quien gestiona')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Comprobante de aporte directo */}
        {comp.comprobante_url ? (
          <TouchableOpacity
            style={[styles.receiptLinkBtn, { marginTop: 8 }]}
            onPress={() => openReceiptViewer(
              comp.comprobante_url,
              `Comprobante de Aporte - ${comp.socio_name}${isSub ? ` (#${index})` : ''}`,
              {
                method: comp.payment_method,
                reference: comp.referencia_pago ? comp.referencia_pago.replace(/beneficiario/gi, 'quien gestiona') : undefined,
                amount: `$${formatVE(comp.monto_usd)} USD (~Bs ${formatVE(comp.monto_bs || (comp.monto_usd * colectaItem.tasa_actual))})`
              }
            )}
          >
            <Text style={styles.receiptLinkText}>🧾 Ver comprobante de aporte</Text>
          </TouchableOpacity>
        ) : null}

        {/* Información si fue devuelto */}
        {comp.estado === 'devuelto' && (
          <View style={styles.refundedInfoBox}>
            <Text style={styles.refundedInfoTitle}>🔄 Aporte Reintegrado al Socio:</Text>
            <Text style={styles.refundedInfoText}>
              Monto devuelto: <Text style={{ fontWeight: 'bold', color: '#10b981' }}>
                {comp.moneda_devolucion === 'VES' ? 'Bs ' : '$ '}
                {formatVE(comp.monto_devuelto)}
              </Text>
              {comp.metodo_devolucion ? ` mediante ${comp.metodo_devolucion}` : ''}
            </Text>
            {comp.fecha_devolucion ? (
              <Text style={styles.refundedInfoSub}>📅 Fecha: {formatDateTime(comp.fecha_devolucion)}</Text>
            ) : null}
            {comp.comision_descontada > 0 ? (
              <Text style={styles.refundedInfoSub}>
                Comisión bancaria deducida: Bs {formatVE(comp.comision_descontada)}
              </Text>
            ) : null}
            {comp.referencia_devolucion ? (
              <Text style={styles.refundedInfoSub}># Ref: {comp.referencia_devolucion}</Text>
            ) : null}
            {comp.comprobante_devolucion_url ? (
              <TouchableOpacity
                style={[styles.receiptLinkBtn, { marginTop: 6 }]}
                onPress={() => openReceiptViewer(
                  comp.comprobante_devolucion_url,
                  `Comprobante de Devolución - ${comp.socio_name}`,
                  {
                    method: comp.metodo_devolucion,
                    reference: comp.referencia_devolucion,
                    amount: `${comp.moneda_devolucion === 'VES' ? 'Bs ' : '$ '}${formatVE(comp.monto_devuelto)}`
                  }
                )}
              >
                <Text style={styles.receiptLinkText}>🧾 Ver comprobante de devolución</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Aviso si el pago fue rechazado por el gestor */}
        {comp.motivo_rechazo && comp.estado === 'prometido' && (
          <View style={styles.rejectNoticeBox}>
            <Text style={styles.rejectNoticeTitle}>⚠️ Notificación de pago rechazada por quien gestiona:</Text>
            <Text style={styles.rejectNoticeMotive}>"{comp.motivo_rechazo}"</Text>
            {comp.fecha_rechazo ? (
              <Text style={styles.refundedInfoSub}>📅 Fecha: {formatDateTime(comp.fecha_rechazo)}</Text>
            ) : null}
            <Text style={styles.rejectNoticeHelp}>Por favor verifica tu pago o transfiere nuevamente y notifícalo con el comprobante correspondiente.</Text>
          </View>
        )}

        {/* Acciones de aporte para el gestor */}
        {isGestor && comp.estado === 'pagado' && (
          <View style={styles.contribActions}>
            <TouchableOpacity
              style={[styles.contribActionPrimary, { backgroundColor: '#059669' }]}
              onPress={() => handleVerifyCompromiso(colectaItem.id, comp.id, comp.socio_name, comp.monto_usd)}
            >
              <Text style={styles.contribActionPrimaryText}>✔ Validar Pago</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnReject}
              onPress={() => handleOpenRejectCompromiso(colectaItem, comp)}
            >
              <Text style={styles.btnRejectText}>✕ Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Botón Devolver Aporte (Gestor en colecta cancelada con aportes pagados o validados) */}
        {colectaItem.estado === 'cancelada' && isGestor && (comp.estado === 'pagado' || comp.estado === 'validado') && comp.payment_method !== 'Aporte Propio' && (
          <View style={styles.contribActions}>
            <TouchableOpacity
              style={[styles.contribActionPrimary, { backgroundColor: '#e11d48' }]}
              onPress={() => handleOpenRefund(colectaItem, comp)}
            >
              <Text style={styles.contribActionPrimaryText}>🔄 Devolver Aporte</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Botón Pagar aporte individual si el socio tiene compromisos pendientes */}
        {comp.socio_id === currentUser?.id && (comp.estado === 'prometido' || comp.estado === 'notificado') && (colectaItem.estado === 'propuesta' || colectaItem.estado === 'activa') && (
          <View style={styles.contribActions}>
            <TouchableOpacity
              style={[styles.contribActionPrimary, { backgroundColor: '#10b981' }]}
              onPress={() => {
                setTargetColecta(colectaItem);
                setTargetCompromiso(comp);
                const avail = getAvailablePaymentMethods(colectaItem.beneficiario_datos_pago);
                setPaymentMethod(avail.length > 0 ? avail[0] : 'Pago Móvil');
                setShowPaymentModal(true);
              }}
            >
              <Text style={styles.contribActionPrimaryText}>💵 Pagar este aporte</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contribActionPrimary, { backgroundColor: '#334155' }]}
              onPress={() => handleCancelCommitment(colectaItem, comp)}
            >
              <Text style={[styles.contribActionPrimaryText, { color: '#f87171' }]}>✕ Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Render Card de Colecta
  const renderColectaCard = ({ item }) => {
    const badge = getStatusBadge(item.estado, item);
    const isOwner = currentUser && item.proponente_id === currentUser.id;
    const isBeneficiary = currentUser && item.beneficiario_id === currentUser.id;
    const isGestor = currentUser && (currentUser.id === (item.beneficiario_id || item.proponente_id));
    const myPledge = item.mi_compromiso;

    return (
      <View style={styles.card}>
        {/* Cabecera de la tarjeta */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.cardTitle}>🐮 {item.titulo}</Text>
            <Text style={styles.proponenteText}>
              Propuesto por <Text style={{ fontWeight: '700', color: '#cbd5e1' }}>{item.proponente_name}</Text>
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Badge de Tasa de Cambio Prominente */}
        <View style={styles.rateBadgeStrip}>
          <Text style={styles.rateBadgeText}>
            📊 Tasa: <Text style={{ fontWeight: 'bold' }}>{item.tasa_label}</Text> • Ref: Bs {formatVE(item.tasa_actual)}
          </Text>
        </View>

        {/* Propósito */}
        <Text style={styles.propositoText} numberOfLines={3}>
          {item.proposito}
        </Text>

        {/* Responsable de gestión y Fecha */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            👤 Gestionado por: <Text style={styles.infoHighlight}>{item.beneficiario_nombre}</Text>
          </Text>
          <Text style={styles.infoText}>
            📅 Fecha de pago: <Text style={styles.infoHighlight}>{item.fecha_pago}{item.hora_pago ? ` (${item.hora_pago})` : ''}</Text>
          </Text>
        </View>

        {/* Barra de Progreso Financiero (Homologada a Préstamos) */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressHeaderMeta}>
              🎯 Meta: ${formatVE(item.monto_meta_usd)} USD{' '}
              <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'normal' }}>
                (~Bs {formatVE(item.monto_meta_bs || (item.monto_meta_usd * item.tasa_actual))})
              </Text>
            </Text>
            <Text style={[styles.progressStatusHint, { color: item.is_active ? '#4ade80' : '#f59e0b' }]}>
              {item.is_active
                ? '🎉 ¡Meta alcanzada!'
                : `Faltan $${formatVE(Math.max(0, item.monto_meta_usd - ((item.monto_prometido_usd || 0) + (item.monto_pagado_usd || 0) + (item.monto_validado_usd || 0))))} USD`}
            </Text>
          </View>

          <Text style={styles.progressText}>📢 Prometido: ${formatVE(item.monto_prometido_usd || 0)} USD</Text>
          <Text style={styles.progressText}>💸 Pagado: ${formatVE(item.monto_pagado_usd || 0)} USD</Text>
          <Text style={styles.progressText}>✅ Validado: ${formatVE(item.monto_validado_usd || 0)} USD</Text>

          <View style={[styles.progressBarBackground, { marginTop: 6 }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(item.porcentaje_prometido || 0, 100)}%`,
                  backgroundColor: item.porcentaje_prometido >= 100 ? '#10b981' : '#3b82f6',
                },
              ]}
            />
          </View>
        </View>

        {/* Estado de mi compromiso si existe (Homologado a Préstamos) */}
        {(() => {
          if (!myPledge) return null;
          const myPledgeStateConfig = {
            prometido:  { bg: 'rgba(251, 146, 60, 0.10)', border: '#f97316', badgeBg: '#f97316', badgeText: '#fff', icon: '⏳', label: 'Pendiente de pago' },
            notificado: { bg: 'rgba(251, 146, 60, 0.10)', border: '#f97316', badgeBg: '#f97316', badgeText: '#fff', icon: '⏳', label: 'Pendiente de pago' },
            pagado:     { bg: 'rgba(250, 204, 21, 0.10)', border: '#facc15', badgeBg: '#ca8a04', badgeText: '#fef08a', icon: '🕐', label: 'En validación' },
            paid:       { bg: 'rgba(250, 204, 21, 0.10)', border: '#facc15', badgeBg: '#ca8a04', badgeText: '#fef08a', icon: '🕐', label: 'En validación' },
            validado:   { bg: 'rgba(59, 130, 246, 0.10)', border: '#3b82f6', badgeBg: '#1d4ed8', badgeText: '#bfdbfe', icon: '✅', label: 'Validado' },
            verified:   { bg: 'rgba(59, 130, 246, 0.10)', border: '#3b82f6', badgeBg: '#1d4ed8', badgeText: '#bfdbfe', icon: '✅', label: 'Validado' },
          };
          const myCfg = myPledgeStateConfig[myPledge.estado] || myPledgeStateConfig.prometido;

          return (
            <View style={[styles.myPledgeBox, { backgroundColor: myCfg.bg, borderColor: myCfg.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.myPledgeTitle, { color: myCfg.border }]}>Mi compromiso voluntario:</Text>
                <Text style={styles.myPledgeAmount}>
                  ${formatVE(myPledge.monto_usd)} USD
                  <Text style={{ color: '#cbd5e1', fontWeight: 'normal' }}>
                    {` (~Bs ${formatVE(myPledge.monto_bs || (myPledge.monto_usd * item.tasa_actual))})`}
                  </Text>
                </Text>
              </View>
              <View style={[styles.pledgeStatePill, { backgroundColor: myCfg.badgeBg }]}>
                <Text style={[styles.pledgeStateText, { color: myCfg.badgeText }]}>
                  {myCfg.icon} {myCfg.label}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Rendición de cuentas si está completada */}
        {item.gasto_validado && (
          <View style={styles.expenseValidatedBox}>
            <Text style={styles.expenseValidatedTitle}>✅ Rendición de cuentas:</Text>
            <Text style={styles.expenseValidatedDesc}>{item.descripcion_gasto}</Text>
            {item.comprobante_gasto_url ? (
              <TouchableOpacity
                style={[styles.receiptLinkBtn, { marginTop: 8 }]}
                onPress={() => openReceiptViewer(
                  item.comprobante_gasto_url,
                  `Factura / Gasto - ${item.titulo}`,
                  {
                    amount: `$${formatVE(item.monto_meta_usd)} USD`,
                    reference: item.descripcion_gasto
                  }
                )}
              >
                <Text style={styles.receiptLinkText}>🧾 Ver factura / comprobante de gasto</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Lista de Aportes en curso (Agrupados por persona con desglose desplegable para múltiples aportes) */}
        {(() => {
          const activeCompromisos = (item.compromisos || []).filter(c => c.estado !== 'cancelado');
          if (activeCompromisos.length === 0) return null;
          const isExpanded = !!expandedContribs[item.id];
          const pendingVerifCount = activeCompromisos.filter(c => c.estado === 'pagado').length;
          const devueltosCount = activeCompromisos.filter(c => c.estado === 'devuelto').length;

          // Agrupar aportes por persona
          const groupedBySocio = [];
          const socioMap = new Map();

          for (const comp of activeCompromisos) {
            const sKey = String(comp.socio_id ?? comp.socio_name ?? comp.id);
            if (!socioMap.has(sKey)) {
              const group = {
                key: sKey,
                socio_id: comp.socio_id,
                socio_name: comp.socio_name || 'Socio',
                compromisos: [],
                total_usd: 0,
                total_bs: 0,
              };
              socioMap.set(sKey, group);
              groupedBySocio.push(group);
            }
            const group = socioMap.get(sKey);
            group.compromisos.push(comp);
            group.total_usd += (Number(comp.monto_usd) || 0);
            group.total_bs += (Number(comp.monto_bs) || ((Number(comp.monto_usd) || 0) * (item.tasa_actual || 1)));
          }

          const hasMultipleContributions = activeCompromisos.length > groupedBySocio.length;

          return (
            <View style={styles.contribsSection}>
              <TouchableOpacity
                style={styles.contribsHeaderToggle}
                onPress={() => toggleExpandedContribs(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.contribsHeaderLeft}>
                  <Text style={styles.contribsTitleText}>
                    Aportes en curso ({groupedBySocio.length} persona{groupedBySocio.length !== 1 ? 's' : ''}{hasMultipleContributions ? ` · ${activeCompromisos.length} aportes` : ''})
                  </Text>
                  {isGestor && pendingVerifCount > 0 && (
                    <View style={styles.pendingVerifBadge}>
                      <Text style={styles.pendingVerifBadgeText}>
                        ⏳ {pendingVerifCount} por validar
                      </Text>
                    </View>
                  )}
                  {devueltosCount > 0 && (
                    <View style={styles.devueltoBadge}>
                      <Text style={styles.devueltoBadgeText}>
                        🎉 {devueltosCount} devuelto{devueltosCount > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.contribsToggleBtn}>
                  <Text style={styles.contribsToggleBtnText}>
                    {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                  </Text>
                  <Text style={styles.contribsToggleIcon}>
                    {isExpanded ? ' ▲' : ' ▼'}
                  </Text>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.contribsList}>
                  {groupedBySocio.map(group => {
                    // Si el socio tiene solo 1 aporte, se muestra directo sin desplegable anidado
                    if (group.compromisos.length === 1) {
                      return renderCompromisoDetails(group.compromisos[0], item, false);
                    }

                    // Múltiples aportes de la misma persona: tarjeta combinada con acordeón interno
                    const isSocioExpanded = !!expandedSocioContribs[`${item.id}_${group.key}`];
                    
                    const hasPagado = group.compromisos.some(c => c.estado === 'pagado' || c.estado === 'paid');
                    const hasPrometido = group.compromisos.some(c => c.estado === 'prometido' || c.estado === 'notificado');
                    const allValidados = group.compromisos.every(c => c.estado === 'validado' || c.estado === 'verified');
                    const allDevueltos = group.compromisos.every(c => c.estado === 'devuelto');

                    let cardBorder = '#475569';
                    let cardBg = 'rgba(100, 116, 139, 0.08)';
                    if (hasPagado) {
                      cardBorder = '#facc15';
                      cardBg = 'rgba(250, 204, 21, 0.10)';
                    } else if (hasPrometido) {
                      cardBorder = '#f97316';
                      cardBg = 'rgba(251, 146, 60, 0.10)';
                    } else if (allValidados) {
                      cardBorder = '#3b82f6';
                      cardBg = 'rgba(59, 130, 246, 0.10)';
                    } else if (allDevueltos) {
                      cardBorder = '#10b981';
                      cardBg = 'rgba(16, 185, 129, 0.10)';
                    }

                    const initial = group.socio_name ? group.socio_name.trim()[0].toUpperCase() : '?';

                    return (
                      <View key={group.key} style={[styles.contribCard, { backgroundColor: cardBg, borderLeftColor: cardBorder }]}>
                        {/* Cabecera Agrupada: Avatar + Nombre + Conteo + Total acumulado */}
                        <View style={styles.contribCardHeader}>
                          <View style={styles.contribAvatarWrap}>
                            <View style={[styles.contribAvatar, { backgroundColor: cardBorder + '33', borderColor: cardBorder }]}>
                              <Text style={{ fontSize: 16, fontWeight: '700', color: cardBorder }}>{initial}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={styles.contribName}>{group.socio_name}</Text>
                                <View style={styles.contribCountPill}>
                                  <Text style={styles.contribCountPillText}>
                                    {group.compromisos.length} aportes
                                  </Text>
                                </View>
                              </View>
                              <Text style={[styles.contribAmountLine, { fontSize: 13, fontWeight: '700', color: '#f8fafc', marginTop: 2 }]}>
                                Total: ${formatVE(group.total_usd)} USD
                                <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'normal' }}>
                                  {` (~Bs ${formatVE(group.total_bs)})`}
                                </Text>
                              </Text>
                            </View>
                          </View>

                          {/* Resumen de estados */}
                          {renderGroupStatusBadges(group.compromisos)}
                        </View>

                        {/* Botón para expandir/colapsar desglose */}
                        <TouchableOpacity
                          style={styles.socioBreakdownToggle}
                          onPress={() => toggleExpandedSocioContribs(`${item.id}_${group.key}`)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.socioBreakdownToggleText}>
                            {isSocioExpanded ? '▲ Ocultar desglose de aportes' : `▼ Ver desglose (${group.compromisos.length} aportes)`}
                          </Text>
                        </TouchableOpacity>

                        {/* Lista Desplegable de Sub-aportes con estampa de tiempo y trazabilidad */}
                        {isSocioExpanded && (
                          <View style={styles.socioSubList}>
                            {group.compromisos.map((comp, idx) =>
                              renderCompromisoDetails(comp, item, true, idx + 1)
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        {/* Banner de Cancelación por Fuerza Mayor */}
        {item.estado === 'cancelada' && (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledBannerTitle}>⚠️ Colecta Cancelada por Fuerza Mayor</Text>
            {item.motivo_cancelacion ? (
              <Text style={styles.cancelledBannerDesc}>Motivo: {item.motivo_cancelacion}</Text>
            ) : null}
            <Text style={styles.cancelledBannerSub}>
              {item.tiene_devoluciones_pendientes
                ? '⏳ Quien gestiona debe reintegrar los aportes recaudados a cada socio según su método original.'
                : '✅ Todos los aportes recaudados han sido devueltos a los miembros.'}
            </Text>
          </View>
        )}

        {/* Botones de acción */}
        <View style={styles.cardActions}>

          {/* Botón Aportar / Aportar más */}
          {(item.estado === 'propuesta' || item.estado === 'activa') && (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                setTargetColecta(item);
                setShowPledgeModal(true);
              }}
            >
              <Text style={styles.btnPrimaryText}>
                {(item.mis_compromisos && item.mis_compromisos.length > 0) || myPledge ? '➕ Aportar más' : '🤝 Aportar'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Botón Pagar Mi Aporte si está prometido o notificado */}
          {myPledge && (myPledge.estado === 'prometido' || myPledge.estado === 'notificado') && (
            <TouchableOpacity
              style={styles.btnSuccess}
              onPress={() => {
                setTargetColecta(item);
                setTargetCompromiso(myPledge);
                const avail = getAvailablePaymentMethods(item.beneficiario_datos_pago);
                setPaymentMethod(avail.length > 0 ? avail[0] : 'Pago Móvil');
                setShowPaymentModal(true);
              }}
            >
              <Text style={styles.btnPrimaryText}>💵 Pagar (${formatVE(myPledge.monto_usd)} USD)</Text>
            </TouchableOpacity>
          )}

          {/* Botón Cancelar Mi Aporte (permitido antes de pagado) */}
          {myPledge && (myPledge.estado === 'prometido' || myPledge.estado === 'notificado') && (
            <TouchableOpacity
              style={styles.btnDangerOutline}
              onPress={() => handleCancelCommitment(item, myPledge)}
            >
              <Text style={styles.btnDangerOutlineText}>Cancelar</Text>
            </TouchableOpacity>
          )}

          {/* Botón Cancelar Colecta por Fuerza Mayor (Gestor o Proponente) */}
          {isGestor && (item.estado === 'propuesta' || item.estado === 'activa' || item.estado === 'cerrada') && !item.gasto_validado && (
            <TouchableOpacity
              style={[styles.btnDangerOutline, { borderColor: '#ef4444' }]}
              onPress={() => handleCancelColecta(item)}
            >
              <Text style={[styles.btnDangerOutlineText, { color: '#f87171' }]}>⚠️ Cancelar Colecta</Text>
            </TouchableOpacity>
          )}

          {/* Botón Recordatorio de Pago para el Gestor */}
          {isGestor && (item.estado === 'activa' || item.estado === 'propuesta') && item.compromisos?.some(c => c.estado === 'prometido' || c.estado === 'notificado') && (
            <TouchableOpacity
              style={styles.btnReminder}
              onPress={() => handleRemindPending(item)}
            >
              <Text style={styles.btnReminderText}>🔔 Recordar Pago a Pendientes</Text>
            </TouchableOpacity>
          )}

          {/* Botón Rendir Cuentas (beneficiario si está cerrada o completó recaudación) */}
          {(isOwner || isBeneficiary) &&
            (item.estado === 'cerrada' || item.monto_recaudado_usd >= item.monto_meta_usd) &&
            !item.gasto_validado && (
              <TouchableOpacity
                style={styles.btnPurple}
                onPress={() => {
                  setTargetColecta(item);
                  setShowExpenseModal(true);
                }}
              >
                <Text style={styles.btnPrimaryText}>✅ Rendir Cuentas</Text>
              </TouchableOpacity>
            )}
        </View>
      </View>
    );
  };

  // Render Fondo Común (Periódico)
  const renderFundCard = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.fundName}>{item.name}</Text>
      <Text style={styles.fundType}>
        {item.fund_type === 'emergency' ? '🚨 Fondo de Emergencia' : '💰 Ahorro Familiar'}
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
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert('Próximamente', 'Los fondos con aportes periódicos obligatorios se activarán en la siguiente fase.')}
        >
          <Text style={styles.actionButtonText}>Aportar al Fondo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleCreateFundPress = () => {
    Alert.alert(
      'En Construcción',
      'La creación y propuesta de fondos comunes se encuentra actualmente en desarrollo y estará disponible en una próxima versión.'
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabecera principal */}
      <View style={styles.header}>
        <ScreenTitle
          title="Fondos"
          right={
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                style={[
                  styles.headerAddButton,
                  {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: '#3b82f6',
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                  },
                ]}
                onPress={handleOpenConfig}
              >
                <Text style={[styles.headerAddButtonText, { color: '#3b82f6', fontSize: 13 }]}>
                  ⚙️ Datos
                </Text>
              </TouchableOpacity>
              {activeTab === 'colectas' && (
                <TouchableOpacity
                  style={styles.headerAddButton}
                  onPress={handlePressCreateColecta}
                >
                  <Text style={styles.headerAddButtonText}>+ Colecta</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />

        {/* Ticker de Tasas de Cambio en vivo */}
        {rates.bcv && (
          <View style={styles.ratesTicker}>
            <Text style={styles.ratesTickerText}>
              🇻🇪 <Text style={{ fontWeight: 'bold' }}>BCV:</Text> Bs {rates.bcv?.rate?.toFixed(2)} •{' '}
              <Text style={{ fontWeight: 'bold' }}>USDT:</Text> Bs {rates.usdt?.rate?.toFixed(2)}
              {rates.euro?.rate ? ` • Euro: Bs ${rates.euro?.rate?.toFixed(2)}` : ''}
            </Text>
          </View>
        )}

        {/* Selector Segmentado de Pestañas */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'colectas' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('colectas')}
          >
            <Text style={[styles.segmentBtnText, activeTab === 'colectas' && styles.segmentBtnTextActive]}>
              {(isOffline || connectionError) && activeColectas.length === 0
                ? '🐮 Colectas (Sin conexión)'
                : `🐮 Colectas (Vacas)${activeColectas.length > 0 ? ` (${activeColectas.length})` : ''}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'periodicos' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('periodicos')}
          >
            <Text style={[styles.segmentBtnText, activeTab === 'periodicos' && styles.segmentBtnTextActive]}>
              🏛️ Fondos Comunes
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sub-pestañas homologadas a Préstamos: Vigentes / Historial */}
        {activeTab === 'colectas' && (
          <View style={styles.colectasSubTabs}>
            <TouchableOpacity
              style={[styles.colectasSubTab, colectasFilter === 'active' && styles.colectasSubTabActive]}
              onPress={() => setColectasFilter('active')}
            >
              <Text style={[styles.colectasSubTabText, colectasFilter === 'active' && styles.colectasSubTabTextActive]}>
                Vigentes{activeColectas.length > 0 ? ` (${activeColectas.length})` : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.colectasSubTab, colectasFilter === 'history' && styles.colectasSubTabActive]}
              onPress={() => setColectasFilter('history')}
            >
              <Text style={[styles.colectasSubTabText, colectasFilter === 'history' && styles.colectasSubTabTextActive]}>
                Historial{historyColectas.length > 0 ? ` (${historyColectas.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!hasConfiguredPaymentMethods(userPaymentConfig) && (
        <TouchableOpacity
          style={styles.missingPmBanner}
          onPress={handleOpenConfig}
          activeOpacity={0.8}
        >
          <View style={styles.missingPmBannerIconBox}>
            <Text style={styles.missingPmBannerIcon}>💳</Text>
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.missingPmBannerTitle}>Datos de pago pendientes</Text>
            <Text style={styles.missingPmBannerSubtitle}>
              Debes registrar al menos un método de pago antes de proponer una colecta o aportar. Toca aquí para configurarlo.
            </Text>
          </View>
          <Text style={styles.missingPmBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {(isOffline || connectionError) ? (
        <OfflineNotice
          message="Sin conexión de red · Mostrando datos guardados"
          onRetry={handleRetryFunds}
          loading={retryingFunds}
        />
      ) : null}

      {/* Contenido según pestaña */}
      {activeTab === 'colectas' ? (
        loadingColectas ? (
          <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={displayedColectas}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderColectaCard}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              (isOffline || connectionError) ? (
                <OfflineEmptyState
                  title="Sin conexión de red"
                  message="No se pudieron cargar las colectas. Tus datos están seguros y no se han eliminado."
                  onRetry={handleRetryFunds}
                  loading={retryingFunds}
                />
              ) : colectasFilter === 'history' ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>📜</Text>
                  <Text style={styles.emptyTitle}>Sin colectas en el historial</Text>
                  <Text style={styles.emptyText}>
                    Aquí se archivarán automáticamente las colectas familiares que hayan sido completadas (con gasto validado) o canceladas.
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>🐮</Text>
                  <Text style={styles.emptyTitle}>No hay colectas vigentes</Text>
                  <Text style={styles.emptyText}>
                    Las colectas ("hacer una vaca") permiten financiar gastos familiares específicos con aportes voluntarios.
                  </Text>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 16 }]}
                    onPress={() => setShowCreateModal(true)}
                  >
                    <Text style={styles.btnPrimaryText}>+ Proponer una Colecta</Text>
                  </TouchableOpacity>
                </View>
              )
            }
          />
        )
      ) : loadingFunds ? (
        <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={funds}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderFundCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            (isOffline || connectionError) ? (
              <OfflineEmptyState
                title="Sin conexión de red"
                message="No se pudieron cargar los fondos comunes. Tus datos están seguros y no se han eliminado. Por favor, intenta de nuevo cuando tengas conexión."
                onRetry={handleRetryFunds}
                loading={retryingFunds}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🏛️</Text>
                <Text style={styles.emptyTitle}>Fondos Comunes Familiares</Text>
                <Text style={styles.emptyText}>
                  Fondo de emergencia y aportes periódicos continuos con participación de todos los miembros.
                </Text>
              </View>
            )
          }
        />
      )}

      {/* ==================================================== */}
      {/* MODAL 1: CREAR COLECTA                               */}
      {/* ==================================================== */}
      <Modal visible={showCreateModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardVisible ? 35 : 15 }}
            >
              <Text style={styles.modalTitle}>🐮 Nueva Colecta ("Vaca")</Text>
              <Text style={styles.modalSubtitle}>
                Propón un fin común con meta en USD. Quienes deseen colaborar prometerán sus aportes.
              </Text>

              <Text style={styles.inputLabel}>Título de la Colecta *</Text>
              <TextInput
                style={styles.input}
                value={titulo}
                onChangeText={setTitulo}
                placeholder="Ej: Medicinas abuela, Reparación bomba"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Propósito y Detalle *</Text>
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                value={proposito}
                onChangeText={setProposito}
                placeholder="Explica para qué es el dinero y cómo beneficiará a la familia..."
                placeholderTextColor="#64748b"
                multiline
              />

              {/* Selector Bimoneda */}
              <View style={styles.currencySelectorContainer}>
                <Text style={styles.inputLabel}>Moneda y Monto Meta *</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, colectaCurrency === 'USD' && [styles.toggleBtnActive, { backgroundColor: theme.accent }]]}
                    onPress={() => handleToggleColectaCurrency('USD')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.toggleBtnText, colectaCurrency === 'USD' && styles.toggleBtnTextActive]}>
                      $ USD (Dólares)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.toggleBtn, colectaCurrency === 'VES' && [styles.toggleBtnActive, { backgroundColor: theme.accent }]]}
                    onPress={() => handleToggleColectaCurrency('VES')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.toggleBtnText, colectaCurrency === 'VES' && styles.toggleBtnTextActive]}>
                      Bs. VES (Bolívares)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Campo de Entrada de Monto Meta */}
                <View style={styles.currencyInputRow}>
                  <Text style={styles.currencyPrefixText}>{colectaCurrency === 'USD' ? '$' : 'Bs.'}</Text>
                  <TextInput 
                    style={[styles.input, styles.currencyInnerInput, colectaCurrency === 'VES' && { paddingLeft: 48 }]} 
                    keyboardType="decimal-pad" 
                    value={montoMeta} 
                    onChangeText={setMontoMeta}
                    onBlur={() => {
                      const p = parseVEAmount(montoMeta);
                      if (p !== null && p > 0) setMontoMeta(formatVE(p));
                    }}
                    placeholder={colectaCurrency === 'USD' ? "Ej: 50,00" : "Ej: 2.750,00"}
                    placeholderTextColor="#64748b"
                  />
                </View>

                {/* Tarjeta de Contravalor Dinámico */}
                {(metaCountervalueBs !== null || metaCountervalueUsd !== null) && (
                  <View style={styles.countervalueCard}>
                    <View style={styles.countervalueHeader}>
                      <Text style={styles.countervalueLabel}>
                        {colectaCurrency === 'USD' ? 'Equivalente estimado en Bolívares:' : 'Equivalente en Dólares:'}
                      </Text>
                      <Text style={styles.countervalueRateTag}>
                        Tasa: {effCreateRate ? `Bs. ${formatVE(effCreateRate)}` : 'Calculando...'}
                      </Text>
                    </View>
                    <Text style={styles.countervalueMainAmount}>
                      {colectaCurrency === 'USD'
                        ? `≈ Bs. ${formatVE(metaCountervalueBs)}`
                        : `≈ $ ${formatVE(metaCountervalueUsd)} USD`
                      }
                    </Text>
                  </View>
                )}
              </View>

              {/* Selector de Tipo de Tasa de Cambio */}
              <Text style={styles.inputLabel}>Tasa de Cambio para liquidar en Bs *</Text>
              <View style={styles.rateTypeSelector}>
                {[
                  { key: 'bcv', label: 'BCV' },
                  { key: 'usdt', label: 'USDT' },
                  { key: 'euro', label: 'Euro' },
                  { key: 'fija', label: 'Fija' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.rateTypeBtn, tipoTasa === t.key && styles.rateTypeBtnActive]}
                    onPress={() => setTipoTasa(t.key)}
                  >
                    <Text style={[styles.rateTypeBtnText, tipoTasa === t.key && styles.rateTypeBtnTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tipoTasa === 'fija' ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.inputLabel}>Valor de la Tasa Fija (Bs por USD)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tasaFijaValor}
                    onChangeText={setTasaFijaValor}
                    placeholder="Ej: 45.50"
                    placeholderTextColor="#64748b"
                  />
                </View>
              ) : (
                <Text style={styles.rateExplanation}>
                  Tasa de referencia actual:{' '}
                  <Text style={{ fontWeight: 'bold', color: '#38bdf8' }}>
                    Bs {rates[tipoTasa]?.rate?.toFixed(2) || 'Cargando...'}
                  </Text>
                  . El monto exacto en Bs se calculará el día del pago.
                </Text>
              )}

              <Text style={styles.inputLabel}>Fecha de Pago / Liquidación</Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: fechaPago ? '#f8fafc' : '#64748b', fontSize: 15 }}>
                  📅 {fechaPago || 'Tocar para seleccionar fecha'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <View style={Platform.OS === 'ios' ? styles.iosDatePickerWrapper : null}>
                  <DateTimePicker
                    value={dateObj}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date()}
                    onChange={onDateChange}
                    themeVariant="dark"
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={styles.iosDateDoneButton}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.iosDateDoneButtonText}>✓ Listo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.inputLabel}>Hora de Pago / Liquidación *</Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: horaPago ? '#f8fafc' : '#64748b', fontSize: 15 }}>
                  ⏰ {horaPago || '12:00'} (Tocar para cambiar hora)
                </Text>
              </TouchableOpacity>
              {showTimePicker && (
                <View style={Platform.OS === 'ios' ? styles.iosDatePickerWrapper : null}>
                  <DateTimePicker
                    value={timeObj}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={onTimeChange}
                    themeVariant="dark"
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={styles.iosDateDoneButton}
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text style={styles.iosDateDoneButtonText}>✓ Listo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Caja Explicativa de Regla de Monedas */}
              <View style={styles.paymentRuleCard}>
                <Text style={styles.paymentRuleTitle}>ℹ️ Regla de Aportes y Liquidación</Text>
                <Text style={styles.paymentRuleText}>
                  • <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>Aportes en Bolívares (Bs):</Text> Se realizan exactamente el día de pago/liquidación a la tasa de ese día.
                </Text>
                <Text style={styles.paymentRuleText}>
                  • <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>Aportes en Monedas Duras (USD en efectivo / USDT):</Text> Pueden pagarse o entregarse con anticipación.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Responsable de gestionar la compra o pago</Text>
              <TextInput
                style={styles.input}
                value={beneficiarioNombre}
                onChangeText={setBeneficiarioNombre}
                placeholder="Nombre de quien gestionará la compra o servicio"
                placeholderTextColor="#64748b"
              />

              {/* Información sobre Métodos de Pago de quien gestiona */}
              {userPaymentConfig && hasConfiguredPaymentMethods(userPaymentConfig) ? (
                <View style={styles.pmConfiguredInfoCard}>
                  <Text style={styles.pmConfiguredInfoTitle}>
                    💳 Métodos de Pago asociados automáticamente:
                  </Text>
                  <Text style={styles.pmConfiguredInfoList}>
                    {getAvailablePaymentMethods(userPaymentConfig).join(' • ')}
                  </Text>
                  <Text style={styles.pmConfiguredInfoSub}>
                    Los miembros que aporten verán estos datos para transferir directamente a tu cuenta o Pago Móvil para que gestiones la compra o servicio.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.pmWarningInfoCard, { borderColor: '#ef4444' }]}
                  onPress={handleOpenConfig}
                >
                  <Text style={[styles.pmWarningInfoTitle, { color: '#ef4444' }]}>
                    ⚠️ Datos de Pago requeridos
                  </Text>
                  <Text style={styles.pmWarningInfoSub}>
                    Debes configurar tus datos de pago para proponer la colecta. Toca aquí para configurarlos ahora mismo.
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmit}
                  onPress={handleCreateColecta}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Publicar Colecta</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 2: PROMETER APORTE VOLUNTARIO                  */}
      {/* ==================================================== */}
      <Modal visible={showPledgeModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardVisible ? 35 : 15 }}
            >
              <Text style={styles.modalTitle}>🤝 Prometer Aporte</Text>
            {targetColecta && (
              <>
                <Text style={styles.modalSubtitle}>Colecta: "{targetColecta.titulo}"</Text>
                {/* Selector Bimoneda para Aporte */}
                <View style={styles.currencySelectorContainer}>
                  <Text style={styles.inputLabel}>Moneda y Monto a Aportar *</Text>
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity 
                      style={[styles.toggleBtn, pledgeCurrency === 'USD' && [styles.toggleBtnActive, { backgroundColor: theme.accent }]]}
                      onPress={() => handleTogglePledgeCurrency('USD')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.toggleBtnText, pledgeCurrency === 'USD' && styles.toggleBtnTextActive]}>
                        $ USD
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.toggleBtn, pledgeCurrency === 'VES' && [styles.toggleBtnActive, { backgroundColor: theme.accent }]]}
                      onPress={() => handleTogglePledgeCurrency('VES')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.toggleBtnText, pledgeCurrency === 'VES' && styles.toggleBtnTextActive]}>
                        Bs. VES
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.currencyInputRow}>
                    <Text style={styles.currencyPrefixText}>{pledgeCurrency === 'USD' ? '$' : 'Bs.'}</Text>
                    <TextInput 
                      style={[styles.input, styles.currencyInnerInput, pledgeCurrency === 'VES' && { paddingLeft: 48 }]} 
                      keyboardType="decimal-pad" 
                      value={pledgeAmount} 
                      onChangeText={setPledgeAmount}
                      onBlur={() => {
                        const p = parseVEAmount(pledgeAmount);
                        if (p !== null && p > 0) setPledgeAmount(formatVE(p));
                      }}
                      placeholder={pledgeCurrency === 'USD' ? "Ej: 10,00" : "Ej: 550,00"}
                      placeholderTextColor="#64748b"
                    />
                  </View>

                  {(pledgeCountervalueBs !== null || pledgeCountervalueUsd !== null) && (
                    <View style={styles.countervalueCard}>
                      <View style={styles.countervalueHeader}>
                        <Text style={styles.countervalueLabel}>
                          {pledgeCurrency === 'USD' ? 'Equivalente estimado en Bolívares:' : 'Equivalente en Dólares:'}
                        </Text>
                        <Text style={styles.countervalueRateTag}>
                          Tasa: Bs. {formatVE(effPledgeRate)}
                        </Text>
                      </View>
                      <Text style={[styles.countervalueMainAmount, { color: '#10b981' }]}>
                        {pledgeCurrency === 'USD'
                          ? `≈ Bs. ${formatVE(pledgeCountervalueBs)}`
                          : `≈ $ ${formatVE(pledgeCountervalueUsd)} USD`
                        }
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.paymentRuleCard}>
                  <Text style={styles.paymentRuleTitle}>ℹ️ ¿Cuándo se realiza el pago?</Text>
                  <Text style={styles.paymentRuleText}>
                    • <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>Aportes en Bolívares (Bs):</Text> Se realizan el día de pago/liquidación ({targetColecta?.fecha_pago}{targetColecta?.hora_pago ? ` a las ${targetColecta.hora_pago}` : ''}) calculados a la tasa de ese día.
                  </Text>
                  <Text style={styles.paymentRuleText}>
                    • <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>Aportes en Monedas Duras (USD en efectivo / USDT):</Text> Pueden transferirse o entregarse antes.
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => {
                      setShowPledgeModal(false);
                      setPledgeAmount('');
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSubmit}
                    onPress={handlePledge}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Confirmar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 4: CONFIRMAR PAGO DE APORTE                    */}
      {/* ==================================================== */}
      <Modal visible={showPaymentModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardVisible ? 35 : 15 }}
            >
              <Text style={styles.modalTitle}>💵 Confirmar Pago de Aporte</Text>
              {targetColecta && (() => {
                const activeComp = targetCompromiso || targetColecta.mi_compromiso;
                return (
                <>
                  <Text style={styles.modalSubtitle}>
                    Colecta: "{targetColecta.titulo}" • Gestionado por: {targetColecta.beneficiario_nombre}
                  </Text>

                  {activeComp && (
                    <View style={styles.paymentSummaryBox}>
                      <Text style={styles.paymentSummaryText}>
                        Monto acordado: <Text style={{ fontWeight: 'bold' }}>${formatVE(activeComp.monto_usd)} USD</Text>
                      </Text>
                      <Text style={styles.paymentSummaryBs}>
                        Total a transferir: Bs {formatVE(activeComp.monto_bs || (activeComp.monto_usd * targetColecta.tasa_actual))}
                      </Text>
                      <Text style={styles.paymentSummaryRate}>
                        Tasa aplicada ({targetColecta.tasa_label}): Bs. {formatVE(targetColecta.tasa_actual)}
                      </Text>
                    </View>
                  )}

                  {currentUser && targetColecta.beneficiario_id === currentUser.id ? (
                    <View style={styles.selfPledgeBox}>
                      <Text style={styles.selfPledgeTitle}>🤝 Aporte Propio (Responsable de Gestión)</Text>
                      <Text style={styles.selfPledgeText}>
                        Eres quien gestiona esta colecta. Tu compromiso de aporte se sumará directamente a la recaudación total sin necesidad de realizarte un pago móvil ni adjuntar comprobante bancario a tu propia cuenta.
                      </Text>
                      <View style={{ marginTop: 12, backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                        <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 15, textAlign: 'center' }}>
                          Monto a Acreditar: ${formatVE(activeComp?.monto_usd)} USD
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                          Equivalente: Bs {formatVE(activeComp?.monto_bs || ((activeComp?.monto_usd || 0) * (targetColecta.tasa_actual || 1)))}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <>
                  {(() => {
                    const availableMethods = getAvailablePaymentMethods(targetColecta.beneficiario_datos_pago);

                    if (availableMethods.length === 0) {
                      return (
                        <View style={styles.noPmWarningBox}>
                          <Text style={styles.noPmWarningTitle}>⚠️ Sin métodos registrados</Text>
                          <Text style={styles.noPmWarningText}>
                            Quien gestiona ({targetColecta.beneficiario_nombre}) no tiene métodos de pago registrados en el sistema.
                            Por favor coordina directamente para realizar la entrega o transferencia de tu aporte.
                          </Text>
                        </View>
                      );
                    }

                    const selectedNormalized = normalizePaymentMethodName(paymentMethod);
                    const isPagoMovil = selectedNormalized === 'Pago Móvil';
                    const isTransferencia = selectedNormalized === 'Transferencia Bancaria';
                    const pmData = isPagoMovil ? getBeneficiaryMethodData(targetColecta.beneficiario_datos_pago, 'Pago Móvil') : null;
                    const tbData = isTransferencia ? getBeneficiaryMethodData(targetColecta.beneficiario_datos_pago, 'Transferencia Bancaria') : null;
                    const rawMontoBs = activeComp?.monto_bs || ((activeComp?.monto_usd || 0) * (targetColecta.tasa_actual || 1));
                    const montoBsStr = formatVE(rawMontoBs);

                    return (
                      <View style={{ marginBottom: 14 }}>
                        <Text style={styles.inputLabel}>Selecciona el Método de Pago Registrado *</Text>
                        <View style={styles.rateTypeSelector}>
                          {availableMethods.map((m) => {
                            const isSelected = selectedNormalized.toLowerCase() === m.toLowerCase();
                            return (
                              <TouchableOpacity
                                key={m}
                                style={[styles.rateTypeBtn, isSelected && styles.rateTypeBtnActive]}
                                onPress={() => setPaymentMethod(m)}
                              >
                                <Text style={[styles.rateTypeBtnText, isSelected && styles.rateTypeBtnTextActive]}>
                                  {m}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Tarjeta de Datos de Pago Móvil con Copiado */}
                        {isPagoMovil && pmData && (
                          <View style={styles.pmCard}>
                            <View style={styles.pmCardHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="phone-portrait-outline" size={16} color="#38bdf8" />
                                <Text style={styles.pmCardTitle}>Datos de Pago Móvil de quien gestiona</Text>
                              </View>
                              <Text style={styles.pmCardSubtitle}>Gestionado por: {targetColecta.beneficiario_nombre}</Text>
                            </View>

                            {/* Monto a pagar en Bs */}
                            <TouchableOpacity
                              style={styles.copyDataRow}
                              onPress={() => copyField('monto', montoBsStr)}
                              activeOpacity={0.7}
                            >
                              <View>
                                <Text style={styles.copyDataLabel}>Monto a transferir ({targetColecta.tasa_label}: Bs {formatVE(targetColecta.tasa_actual)})</Text>
                                <Text style={[styles.copyDataValue, { color: '#10b981' }]}>Bs {montoBsStr}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'monto' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>

                            {/* Banco Destino */}
                            <TouchableOpacity
                              style={styles.copyDataRow}
                              onPress={() => copyField('banco', pmData.banco)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.copyDataLabel}>Banco Destino</Text>
                                <Text style={styles.copyDataValue}>{getBankLabel(pmData.banco)}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'banco' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>

                            {/* Documento / Cédula */}
                            {(() => {
                              const getPrefix = (tipo) => {
                                if (!tipo || tipo === 'Persona' || tipo === 'V') return 'V';
                                if (tipo === 'Extranjero' || tipo === 'E') return 'E';
                                if (tipo === 'Comercio' || tipo === 'J') return 'J';
                                if (tipo === 'Gubernamental' || tipo === 'G') return 'G';
                                if (tipo === 'Comuna' || tipo === 'C') return 'C';
                                return tipo[0] || 'V';
                              };
                              const docPrefix = getPrefix(pmData.tipo_doc);
                              const safeDoc = `${docPrefix}-${pmData.cedula || ''}`;
                              return (
                                <TouchableOpacity
                                  style={styles.copyDataRow}
                                  onPress={() => copyField('doc', safeDoc)}
                                  activeOpacity={0.7}
                                >
                                  <View>
                                    <Text style={styles.copyDataLabel}>Cédula / Documento</Text>
                                    <Text style={styles.copyDataValue}>{safeDoc}</Text>
                                  </View>
                                  <Text style={styles.copyIcon}>{copiedField === 'doc' ? '✓' : '📋'}</Text>
                                </TouchableOpacity>
                              );
                            })()}

                            {/* Teléfono */}
                            <TouchableOpacity
                              style={styles.copyDataRow}
                              onPress={() => copyField('tel', pmData.telefono)}
                              activeOpacity={0.7}
                            >
                              <View>
                                <Text style={styles.copyDataLabel}>Teléfono</Text>
                                <Text style={styles.copyDataValue}>{pmData.telefono}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'tel' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>

                            {/* Botón Copiar Todo para el Banco */}
                            <TouchableOpacity
                              style={styles.copyAllButton}
                              onPress={() => copyAllPagoMovil(pmData, montoBsStr)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.copyAllButtonText}>
                                {copiedField === 'all' ? '✅ ¡Copiado!' : '📋  Copiar todo para el banco'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Tarjeta de Datos de Transferencia Bancaria con Copiado */}
                        {isTransferencia && (
                          <BankTransferCard
                            data={tbData}
                            montoBs={montoBsStr}
                            recipientName={targetColecta.beneficiario_nombre}
                            tasaLabel={`${targetColecta.tasa_label}: Bs ${formatVE(targetColecta.tasa_actual)}`}
                            banks={VENEZUELAN_BANKS}
                          />
                        )}

                        {/* Otros métodos registrados (Binance, Efectivo, etc.) */}
                        {!isPagoMovil && !isTransferencia && (
                          <View style={styles.pmCard}>
                            <Text style={styles.pmCardTitle}>💳 Datos de {selectedNormalized}</Text>
                            {(() => {
                              const otherVal = getBeneficiaryMethodData(targetColecta.beneficiario_datos_pago, selectedNormalized);
                              const strVal = typeof otherVal === 'object' ? JSON.stringify(otherVal) : String(otherVal || '');
                              return (
                                <TouchableOpacity
                                  style={[styles.copyDataRow, { marginTop: 6 }]}
                                  onPress={() => copyField('other', strVal)}
                                  activeOpacity={0.7}
                                >
                                  <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={styles.copyDataLabel}>Información de Cobro</Text>
                                    <Text style={[styles.copyDataValue, { fontSize: 15 }]}>{strVal || 'No especificado'}</Text>
                                  </View>
                                  <Text style={styles.copyIcon}>{copiedField === 'other' ? '✓' : '📋'}</Text>
                                </TouchableOpacity>
                              );
                            })()}
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  {/* Comentado: No se solicita banco emisor para agilizar el pago de aportes
                  {(normalizePaymentMethodName(paymentMethod) === 'Pago Móvil' || normalizePaymentMethodName(paymentMethod) === 'Transferencia Bancaria') && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.inputLabel}>Tu Banco Emisor (Venezuela)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginVertical: 4 }}>
                        {VENEZUELAN_BANKS.slice(0, 8).map((b) => (
                          <TouchableOpacity
                            key={b.code}
                            style={[styles.rateTypeBtn, paymentBankCode === b.code && styles.rateTypeBtnActive, { marginRight: 6 }]}
                            onPress={() => setPaymentBankCode(b.code)}
                          >
                            <Text style={[styles.rateTypeBtnText, paymentBankCode === b.code && styles.rateTypeBtnTextActive]}>
                              {b.name.replace('Banco ', '')} ({b.code})
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  */}

                  <Text style={styles.inputLabel}>Número de Referencia Bancaria</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentRef}
                    onChangeText={setPaymentRef}
                    placeholder="Ej: 987654"
                    placeholderTextColor="#64748b"
                  />

                  <Text style={styles.inputLabel}>Comprobante (Captura o Foto)</Text>
                  <TouchableOpacity
                    style={styles.btnUpload}
                    onPress={() => pickImage((uri) => setReceiptUri(uri))}
                  >
                    <Text style={styles.btnUploadText}>
                      {receiptUri ? '📷 Cambiar Comprobante' : '📎 Adjuntar Comprobante'}
                    </Text>
                  </TouchableOpacity>

                  {receiptUri && (
                    <Image source={{ uri: receiptUri }} style={styles.receiptPreviewImage} />
                  )}
                    </>
                  )}

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalCancel}
                      onPress={() => {
                        setShowPaymentModal(false);
                        setTargetCompromiso(null);
                      }}
                    >
                      <Text style={styles.modalCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalSubmit}
                      onPress={handleConfirmPayment}
                      disabled={submitting || uploadingReceipt}
                    >
                      {submitting || uploadingReceipt ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.modalSubmitText}>
                          {currentUser && targetColecta.beneficiario_id === currentUser.id
                            ? 'Confirmar Aporte Propio'
                            : 'Registrar Pago'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
                );
              })()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 5: VALIDAR GASTO REALIZADO (BENEFICIARIO)      */}
      {/* ==================================================== */}
      <Modal visible={showExpenseModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardVisible ? 35 : 15 }}
            >
              <Text style={styles.modalTitle}>📋 Rendición de Cuentas del Gasto</Text>
              <Text style={styles.modalSubtitle}>
                Como responsable de la gestión, confirma a la mutual cómo se utilizaron los fondos recaudados.
              </Text>

              <Text style={styles.inputLabel}>Detalle del Gasto Realizado *</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                value={expenseDesc}
                onChangeText={setExpenseDesc}
                placeholder="Ej: Se adquirió el tensiómetro digital en Farmatodo para el tratamiento de la abuela."
                placeholderTextColor="#64748b"
                multiline
              />

              <Text style={styles.inputLabel}>Comprobante o Factura (Opcional)</Text>
              <TouchableOpacity
                style={styles.btnUpload}
                onPress={() => pickImage((uri) => setExpenseReceiptUri(uri))}
              >
                <Text style={styles.btnUploadText}>
                  {expenseReceiptUri ? '📷 Cambiar Foto' : '📎 Adjuntar Factura / Foto (Opcional)'}
                </Text>
              </TouchableOpacity>

              {expenseReceiptUri && (
                <Image source={{ uri: expenseReceiptUri }} style={styles.receiptPreviewImage} />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowExpenseModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmit, { backgroundColor: '#10b981' }]}
                  onPress={handleValidateExpense}
                  disabled={submitting || uploadingReceipt}
                >
                  {submitting || uploadingReceipt ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Rendir Cuentas y Completar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 6: CREAR FONDO COMÚN (PERIÓDICO)               */}
      {/* ==================================================== */}
      <Modal visible={showFundModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Fondo Común</Text>
            <Text style={styles.inputLabel}>Nombre del Fondo</Text>
            <TextInput
              style={styles.input}
              value={newFundName}
              onChangeText={setNewFundName}
              placeholder="Ej: Fondo de Emergencia"
              placeholderTextColor="#64748b"
            />
            <Text style={styles.inputLabel}>Aporte Mensual Sugerido (USD)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={newFundTarget}
              onChangeText={setNewFundTarget}
              placeholder="Ej: 10"
              placeholderTextColor="#64748b"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowFundModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleCreateFund} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Crear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 7: CANCELAR COLECTA POR FUERZA MAYOR           */}
      {/* ==================================================== */}
      <Modal visible={showCancelModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>⚠️ Cancelar por Fuerza Mayor</Text>
              {targetColecta && (
                <>
                  <Text style={styles.modalSubtitle}>
                    Colecta: "{targetColecta.titulo}"
                  </Text>

                  <View style={[styles.cancelledBanner, { marginTop: 4, marginBottom: 14 }]}>
                    <Text style={styles.cancelledBannerTitle}>Importante sobre cancelaciones:</Text>
                    <Text style={styles.cancelledBannerSub}>
                      Si ya se han recaudado o validado aportes de los miembros, deberás reintegrar el dinero a cada socio según el método original que utilizó (Pago Móvil en Bs, o Efectivo).
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>Causa o Motivo de Fuerza Mayor *</Text>
                  <TextInput
                    style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                    value={cancelMotive}
                    onChangeText={setCancelMotive}
                    placeholder="Ej: El medicamento o equipo necesario no se encuentra disponible en ningún proveedor y se cancela la compra."
                    placeholderTextColor="#64748b"
                    multiline
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalCancel}
                      onPress={() => {
                        setShowCancelModal(false);
                        setCancelMotive('');
                      }}
                    >
                      <Text style={styles.modalCancelText}>Volver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSubmit, { backgroundColor: '#ef4444' }]}
                      onPress={handleConfirmCancelColecta}
                      disabled={canceling}
                    >
                      {canceling ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.modalSubmitText}>Confirmar Cancelación</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 8: DEVOLVER APORTE POR FUERZA MAYOR            */}
      {/* ==================================================== */}
      <Modal visible={showRefundModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, keyboardVisible && styles.modalOverlayShifted]}
        >
          <View style={[styles.modalContent, { maxHeight: keyboardVisible ? (Platform.OS === 'android' ? '70%' : '80%') : '90%' }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>🔄 Devolver Aporte a Socio</Text>
              {targetColecta && refundCompromiso && (() => {
                const isBs = refundCompromiso.payment_method === 'Pago Móvil' || refundCompromiso.payment_method === 'Transferencia Bancaria';
                let socioPmData = null;
                let socioTbData = null;
                try {
                  if (refundCompromiso.socio_payment_methods_json) {
                    socioPmData = getBeneficiaryMethodData(refundCompromiso.socio_payment_methods_json, 'Pago Móvil');
                    socioTbData = getBeneficiaryMethodData(refundCompromiso.socio_payment_methods_json, 'Transferencia Bancaria');
                    if (!socioPmData && !socioTbData) {
                      const parsed = JSON.parse(refundCompromiso.socio_payment_methods_json);
                      socioPmData = parsed['Pago Móvil'] || parsed['pago_movil'] || parsed['Transferencia Bancaria'] || null;
                    }
                  }
                } catch (e) {}

                const rawOriginalBs = refundCompromiso.monto_bs || (refundCompromiso.monto_usd * (targetColecta.tasa_actual || 1));
                const estComision03 = isBs ? Math.round(rawOriginalBs * 0.003 * 100) / 100 : 0;
                const montoDevolverStr = refundAmount || (isBs ? formatVE(rawOriginalBs) : formatVE(refundCompromiso.monto_usd));

                return (
                  <>
                    <Text style={styles.modalSubtitle}>
                      Colecta: "{targetColecta.titulo}" • Aportante: {refundCompromiso.socio_name}
                    </Text>

                    {/* Resumen del Aporte Original */}
                    <View style={styles.paymentSummaryBox}>
                      <Text style={styles.paymentSummaryText}>
                        Método original: <Text style={{ fontWeight: 'bold' }}>{refundCompromiso.payment_method || 'Aporte'}</Text>
                      </Text>
                      <Text style={styles.paymentSummaryBs}>
                        {isBs
                          ? `Monto original aportado: Bs ${formatVE(rawOriginalBs)}`
                          : `Monto original aportado: $${formatVE(refundCompromiso.monto_usd)} USD en Efectivo`}
                      </Text>
                      <Text style={styles.paymentSummaryRate}>
                        {isBs
                          ? 'En cancelaciones por fuerza mayor, se reintegra el mismo monto en Bolívares.'
                          : 'En cancelaciones por fuerza mayor, se reintegra el mismo efectivo recibido.'}
                      </Text>
                    </View>

                    {/* Datos de Pago del Socio Homologados al Modal de Aporte */}
                    {(() => {
                      const isTransferencia = normalizePaymentMethodName(refundCompromiso.payment_method) === 'Transferencia Bancaria';
                      if (isTransferencia && socioTbData && (socioTbData.numero_cuenta || socioTbData.cuenta)) {
                        return (
                          <BankTransferCard
                            data={socioTbData}
                            montoBs={isBs ? montoDevolverStr : null}
                            recipientName={refundCompromiso.socio_name}
                            tasaLabel="Devolución de aporte"
                            banks={VENEZUELAN_BANKS}
                          />
                        );
                      }

                      if (!socioPmData && !socioTbData) {
                        return (
                          <View style={styles.noPmBanner}>
                            <Text style={styles.noPmText}>
                              El aportante ({refundCompromiso.socio_name}) no tiene datos de pago registrados en el sistema.
                              Por favor coordina directamente para acordar la vía de reintegro.
                            </Text>
                          </View>
                        );
                      }

                      const activeData = socioPmData || socioTbData;
                      const getPrefix = (tipo) => {
                        if (!tipo || tipo === 'Persona' || tipo === 'V') return 'V';
                        if (tipo === 'Extranjero' || tipo === 'E') return 'E';
                        if (tipo === 'Comercio' || tipo === 'J') return 'J';
                        if (tipo === 'Gubernamental' || tipo === 'G') return 'G';
                        if (tipo === 'Comuna' || tipo === 'C') return 'C';
                        return tipo[0] || 'V';
                      };
                      const docPrefix = getPrefix(activeData.tipo_doc);
                      const safeDoc = activeData.cedula ? `${docPrefix}-${activeData.cedula}` : '';

                      return (
                        <View style={styles.pmCard}>
                          <Text style={styles.pmCardTitle}>📲 Datos para Pago Móvil / Reintegro</Text>

                          {/* Monto sugerido a devolver */}
                          {isBs && (
                            <TouchableOpacity
                              style={styles.copyDataRow}
                              onPress={() => copyField('f_monto', montoDevolverStr)}
                              activeOpacity={0.7}
                            >
                              <View>
                                <Text style={styles.copyDataLabel}>Monto a transferir / devolver</Text>
                                <Text style={[styles.copyDataValue, { color: '#10b981' }]}>Bs {montoDevolverStr}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'f_monto' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                          )}

                          {/* Banco Destino */}
                          {activeData.banco ? (
                            <TouchableOpacity
                              style={styles.copyDataRow}
                              onPress={() => copyField('f_banco', activeData.banco)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.copyDataLabel}>Banco Destino</Text>
                                <Text style={styles.copyDataValue}>{getBankLabel(activeData.banco)}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'f_banco' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                          ) : null}

                          {/* Documento / Cédula */}
                          {safeDoc ? (
                            <TouchableOpacity
                              style={styles.copyDataRow}
                              onPress={() => copyField('f_doc', safeDoc)}
                              activeOpacity={0.7}
                            >
                              <View>
                                <Text style={styles.copyDataLabel}>Cédula / Documento</Text>
                                <Text style={styles.copyDataValue}>{safeDoc}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'f_doc' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                          ) : null}

                          {/* Teléfono */}
                          {activeData.telefono ? (
                            <TouchableOpacity
                              style={styles.copyDataRow}
                              onPress={() => copyField('f_tel', activeData.telefono)}
                              activeOpacity={0.7}
                            >
                              <View>
                                <Text style={styles.copyDataLabel}>Teléfono</Text>
                                <Text style={styles.copyDataValue}>{activeData.telefono}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'f_tel' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                          ) : null}

                          {/* Nro. de Cuenta si aplica */}
                          {(activeData.cuenta || activeData.numero_cuenta) ? (
                            <TouchableOpacity
                              style={styles.copyDataRow}
                              onPress={() => copyField('f_cta', activeData.cuenta || activeData.numero_cuenta)}
                              activeOpacity={0.7}
                            >
                              <View>
                                <Text style={styles.copyDataLabel}>Nro. de Cuenta</Text>
                                <Text style={styles.copyDataValue}>{activeData.cuenta || activeData.numero_cuenta}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === 'f_cta' ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                          ) : null}

                          {/* Botón Copiar Todo para el Banco */}
                          <TouchableOpacity
                            style={styles.copyAllButton}
                            onPress={() => copyAllPagoMovil(activeData, isBs ? montoDevolverStr : null, 'f_all')}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.copyAllButtonText}>
                              {copiedField === 'f_all' ? '✅ ¡Copiado!' : '📋  Copiar todo para el banco'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}

                    {/* Monto a Devolver */}
                    <Text style={styles.inputLabel}>
                      Monto a Devolver ({refundCurrency === 'VES' ? 'Bs' : 'USD'}) *
                    </Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={refundAmount}
                      onChangeText={setRefundAmount}
                      placeholder="0.00"
                      placeholderTextColor="#64748b"
                    />

                    {/* Descuento sugerido de comisión bancaria para Pago Móvil */}
                    {isBs && estComision03 > 0 && (
                      <TouchableOpacity
                        style={styles.quickDeductBtn}
                        onPress={() => {
                          const net = Math.max(0, Math.round((rawOriginalBs - estComision03) * 100) / 100);
                          setRefundAmount(String(net));
                          setRefundCommission(String(estComision03));
                        }}
                      >
                        <Text style={styles.quickDeductText}>
                          ⚡ Descontar comisión bancaria estimada (~0.3%: Bs {formatVE(estComision03)})
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Referencia de Pago Móvil o Devolución */}
                    <Text style={styles.inputLabel}>
                      {isBs ? 'Nro. de Referencia de la Transferencia / Pago Móvil *' : 'Referencia o Nota de Entrega en Efectivo *'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={refundRef}
                      onChangeText={setRefundRef}
                      placeholder={isBs ? "Ej: 987654 (últimos dígitos)" : "Ej: Billete de $20 entregado en mano"}
                      placeholderTextColor="#64748b"
                    />

                    {/* Comprobante Opcional */}
                    <Text style={styles.inputLabel}>Comprobante de Devolución (Opcional)</Text>
                    <TouchableOpacity
                      style={styles.btnUpload}
                      onPress={() => pickImage((uri) => setRefundReceiptUri(uri))}
                    >
                      <Text style={styles.btnUploadText}>
                        {refundReceiptUri ? '📷 Cambiar Comprobante' : '📎 Adjuntar Captura de Devolución (Opcional)'}
                      </Text>
                    </TouchableOpacity>
                    {refundReceiptUri && (
                      <Image source={{ uri: refundReceiptUri }} style={styles.receiptPreviewImage} />
                    )}

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.modalCancel}
                        onPress={() => {
                          setShowRefundModal(false);
                          setRefundCompromiso(null);
                        }}
                      >
                        <Text style={styles.modalCancelText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalSubmit, { backgroundColor: '#10b981' }]}
                        onPress={handleConfirmRefund}
                        disabled={refunding || uploadingReceipt}
                      >
                        {refunding || uploadingReceipt ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.modalSubmitText}>Registrar Devolución</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 9: RECHAZAR PAGO (GESTOR)                      */}
      {/* ==================================================== */}
      <Modal visible={showRejectModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            >
              <Text style={[styles.modalTitle, { color: '#f87171' }]}>✕ Rechazar Notificación de Pago</Text>
              <Text style={styles.modalSubtitle}>
                Indica a {rejectCompromiso?.socio_name} el motivo por el cual no se acredita su aporte de ${formatVE(rejectCompromiso?.monto_usd)} USD. El aporte volverá al estado prometido para que el socio pueda verificar o pagar nuevamente.
              </Text>

              <Text style={styles.inputLabel}>Motivo del Rechazo *</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Ej: No aparece en cuenta bancaria, comprobante ilegible, referencia errónea..."
                placeholderTextColor="#64748b"
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => {
                    setShowRejectModal(false);
                    setRejectCompromiso(null);
                    setRejectReason('');
                  }}
                  disabled={rejecting}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmit, { backgroundColor: '#ef4444' }]}
                  onPress={handleConfirmRejectCompromiso}
                  disabled={rejecting}
                >
                  {rejecting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Rechazar Pago</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Visor de Comprobantes */}
      <Modal 
        visible={receiptViewerVisible} 
        animationType="fade" 
        transparent={true}
        onRequestClose={() => setReceiptViewerVisible(false)}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalCard}>
            <View style={styles.receiptModalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.receiptModalTitle} numberOfLines={1}>
                  {selectedReceipt?.title || 'Comprobante'}
                </Text>
                {selectedReceipt?.amount && (
                  <Text style={styles.receiptModalSubtitle}>
                    Monto: <Text style={{ color: '#10b981', fontWeight: 'bold' }}>{selectedReceipt.amount}</Text>
                    {selectedReceipt?.method ? ` • Vía ${selectedReceipt.method}` : ''}
                  </Text>
                )}
                {selectedReceipt?.reference && (
                  <Text style={styles.receiptModalRef}>Ref: {selectedReceipt.reference}</Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.receiptCloseBtn}
                onPress={() => setReceiptViewerVisible(false)}
              >
                <Text style={styles.receiptCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.receiptImageContainer}>
              {imageLoading && (
                <View style={styles.receiptImageLoader}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={{ color: '#94a3b8', marginTop: 10, fontSize: 13 }}>Cargando comprobante...</Text>
                </View>
              )}
              {imageError ? (
                <View style={styles.receiptErrorContainer}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>⚠️</Text>
                  <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 14 }}>No se pudo cargar la imagen previa</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                    Puedes abrir el comprobante directamente en tu navegador o visor externo.
                  </Text>
                </View>
              ) : (
                selectedReceipt?.url && (
                  <Image
                    source={{ uri: selectedReceipt.url }}
                    style={styles.receiptImage}
                    resizeMode="contain"
                    onLoadStart={() => setImageLoading(true)}
                    onLoadEnd={() => setImageLoading(false)}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                    }}
                  />
                )
              )}
            </View>

            <View style={styles.receiptModalFooter}>
              {selectedReceipt?.url && (
                <TouchableOpacity 
                  style={styles.receiptExternalBtn}
                  onPress={() => {
                    if (selectedReceipt?.url) {
                      Linking.openURL(selectedReceipt.url);
                    }
                  }}
                >
                  <Text style={styles.receiptExternalBtnText}>🔗 Abrir completo en navegador</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.receiptDismissBtn}
                onPress={() => setReceiptViewerVisible(false)}
              >
                <Text style={styles.receiptDismissBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Configurar Datos de Pago */}
      <PaymentConfigModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSuccess={(savedConfig) => setUserPaymentConfig(savedConfig)}
        initialConfig={userPaymentConfig}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  missingPmBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  missingPmBannerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  missingPmBannerIcon: {
    fontSize: 20,
  },
  missingPmBannerTitle: {
    color: '#fef08a',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  missingPmBannerSubtitle: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
  },
  missingPmBannerArrow: {
    color: '#fef08a',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  container: {
    flex: 1,
    backgroundColor: theme.screenBg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerAddButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerAddButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  ratesTicker: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ratesTickerText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 4,
    marginTop: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#3b82f6',
  },
  segmentBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  colectasSubTabs: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 2,
    gap: 16,
  },
  colectasSubTab: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  colectasSubTabActive: {
    borderBottomColor: '#3b82f6',
  },
  colectasSubTabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  colectasSubTabTextActive: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  card: {
    backgroundColor: theme.cardBg,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 2,
  },
  proponenteText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rateBadgeStrip: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rateBadgeText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  propositoText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  infoRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  infoHighlight: {
    color: '#f1f5f9',
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 10,
    borderRadius: 8,
  },
  progressText: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  progressHeaderMeta: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  progressLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  progressAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  progressMeta: {
    fontSize: 11,
    color: '#94a3b8',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressPercent: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  progressStatusHint: {
    fontSize: 11,
    fontWeight: '700',
  },
  myPledgeBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myPledgeTitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  myPledgeAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  pledgeStatePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pledgeStateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  expenseValidatedBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  expenseValidatedTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#34d399',
    marginBottom: 2,
  },
  expenseValidatedDesc: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  expenseValidatedReceipt: {
    fontSize: 11,
    color: '#6ee7b7',
    marginTop: 4,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  btnSecondary: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnSecondaryText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 12,
  },
  btnSuccess: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnWarning: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnPurple: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnDangerOutline: {
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnDangerOutlineText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 6,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalOverlayShifted: {
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'android' ? 35 : 55,
  },
  selfPledgeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  selfPledgeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 6,
  },
  selfPledgeText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 19,
  },
  modalContent: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: theme.screenBg,
    color: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  rateTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  rateTypeBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rateTypeBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
  },
  rateTypeBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  rateTypeBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  rateExplanation: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  modalSubmit: {
    backgroundColor: theme.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  detailProposito: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 12,
  },
  detailInfoBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  detailInfoItem: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
    marginTop: 4,
  },
  emptySubText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  contributorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  contributorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  contributorAmount: {
    fontSize: 12,
    color: '#38bdf8',
    marginTop: 1,
  },
  contributorRef: {
    fontSize: 10,
    color: '#94a3b8',
  },
  noteBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    color: '#93c5fd',
    fontSize: 11,
    lineHeight: 16,
  },
  paymentSummaryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  paymentSummaryText: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  paymentSummaryBs: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 4,
  },
  paymentSummaryRate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  btnUpload: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  btnUploadText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },
  receiptPreviewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: '#0f172a',
  },
  fundName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  fundType: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  contributionBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  contributionLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  contributionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  currencyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 'normal',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 12,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  currencySelectorContainer: {
    marginBottom: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: theme.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  currencyPrefixText: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 15,
    top: 11,
  },
  currencyInnerInput: {
    flex: 1,
    paddingLeft: 36,
    marginBottom: 4,
    fontSize: 15,
    fontWeight: '600',
  },
  countervalueCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  countervalueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  countervalueLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  countervalueRateTag: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
  countervalueMainAmount: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  iosDatePickerWrapper: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 6,
    alignItems: 'center',
  },
  iosDateDoneButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  iosDateDoneButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Estilos de Datos de Pago y Copiado
  pmConfiguredInfoCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  pmConfiguredInfoTitle: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pmConfiguredInfoList: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  pmConfiguredInfoSub: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  pmWarningInfoCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  pmWarningInfoTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pmWarningInfoSub: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 15,
  },
  noPmBox: {
    backgroundColor: 'rgba(51, 65, 85, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noPmText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  beneficiaryPmContainer: {
    marginVertical: 8,
  },
  pmCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginBottom: 10,
  },
  pmCardHeader: {
    marginBottom: 10,
  },
  pmCardTitle: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pmCardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  copyDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  copyDataLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2,
  },
  copyDataValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  copyIcon: {
    fontSize: 18,
    opacity: 0.85,
    color: '#38bdf8',
  },
  copyAllButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  copyAllButtonText: {
    color: '#93c5fd',
    fontWeight: 'bold',
    fontSize: 13,
  },
  noPmWarningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  noPmWarningTitle: {
    color: '#f87171',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  noPmWarningText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 17,
  },
  receiptLinkBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  receiptLinkText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 15,
  },
  receiptModalCard: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  receiptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  receiptModalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiptModalSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
  },
  receiptModalRef: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  receiptCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptCloseText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiptImageContainer: {
    height: 380,
    backgroundColor: '#0a0f1d',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  receiptImageLoader: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptErrorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptModalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  receiptExternalBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  receiptExternalBtnText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: 'bold',
  },
  receiptDismissBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  receiptDismissBtnText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  contribsSection: {
    marginTop: 10,
  },
  contribsHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  contribsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  contribsTitleText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pendingVerifBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pendingVerifBadgeText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '700',
  },
  devueltoBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  devueltoBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  contribsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contribsToggleBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  contribsToggleIcon: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '700',
  },
  contribsList: { marginTop: 8, gap: 8 },
  contribsTitle: { color: '#94a3b8', fontWeight: '700', marginBottom: 6, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  contribCard: {
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 0,
  },
  contribCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  contribAvatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  contribAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contribName: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  contribAmountLine: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  contribStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  contribStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  contribMeta: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 6,
    padding: 7,
    marginTop: 4,
    gap: 3,
  },
  contribMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  contribMetaIcon: { fontSize: 12, width: 16 },
  contribMetaText: { color: '#94a3b8', fontSize: 12 },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginVertical: 2,
  },
  methodBadgeIcon: {
    fontSize: 13,
  },
  methodBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  contribActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  contribActionPrimary: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    minWidth: 120,
  },
  contribActionPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cancelledBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  cancelledBannerTitle: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  cancelledBannerDesc: {
    color: '#e2e8f0',
    fontSize: 12,
    marginBottom: 2,
  },
  cancelledBannerSub: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  refundedInfoBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    gap: 2,
  },
  refundedInfoTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
  refundedInfoText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  refundedInfoSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
  funderCardBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  funderCardTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  funderDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  funderDataLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  funderDataVal: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  quickDeductBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
  },
  quickDeductText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '600',
  },
  btnReminder: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  btnReminderText: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 13,
  },
  btnReject: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
  },
  btnRejectText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentRuleCard: {
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    gap: 4,
  },
  paymentRuleTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  paymentRuleText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 17,
  },
  rejectNoticeBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    gap: 3,
  },
  rejectNoticeTitle: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  rejectNoticeMotive: {
    color: '#fca5a5',
    fontSize: 12,
    fontStyle: 'italic',
  },
  rejectNoticeHelp: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  socioSubList: {
    marginTop: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
  },
  socioSubCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 8,
    borderLeftWidth: 3,
    padding: 10,
  },
  socioBreakdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    marginTop: 8,
  },
  socioBreakdownToggleText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  contribTimestampInfo: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 2,
  },
  contribCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  contribCountPillText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
  },
});
