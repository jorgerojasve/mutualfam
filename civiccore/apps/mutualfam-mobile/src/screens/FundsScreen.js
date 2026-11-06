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
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fundsApi, colectasApi, loansApi, authApi } from '../api/client';
import ScreenTitle from '../components/ScreenTitle';
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


  // Estados de Colectas
  const [colectas, setColectas] = useState([]);
  const [rates, setRates] = useState({});
  const [loadingColectas, setLoadingColectas] = useState(true);

  // Estados de Fondos Comunes (Periódicos)
  const [funds, setFunds] = useState([]);
  const [loadingFunds, setLoadingFunds] = useState(true);

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedColecta, setSelectedColecta] = useState(null);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [targetColecta, setTargetColecta] = useState(null);

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

  const copyAllPagoMovil = async (pmData, montoBs) => {
    if (!pmData) return;
    try {
      const getPrefix = (tipo) => {
        if (!tipo || tipo === 'Persona') return 'V';
        if (tipo === 'Comercio') return 'J';
        if (tipo === 'Comuna') return 'G';
        return tipo[0] || 'V';
      };
      const docPrefix = getPrefix(pmData.tipo_doc);
      const safeDoc = `${docPrefix}-${pmData.cedula || ''}`;
      const safeBanco = pmData.banco || '';
      const safeTelefono = pmData.telefono || '';
      const montoText = montoBs ? ` | Monto: ${montoBs} Bs` : '';
      const text = `Banco: ${safeBanco} | ${safeDoc} | ${safeTelefono}${montoText}`;
      await Clipboard.setStringAsync(text);
      setCopiedField('all');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.warn('Error copying all to clipboard', e);
    }
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

  // Manejar selector de imágenes
  const pickImage = async (onSelected) => {
    Alert.alert('Comprobante', 'Selecciona el origen del comprobante:', [
      {
        text: '🖼️ Galería',
        onPress: async () => {
          try {
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
        text: '📷 Cámara',
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

  // Notificar Cobro en Bs
  const handleNotifyPayment = async (colecta) => {
    Alert.alert(
      'Notificar Cobro',
      `¿Deseas calcular el monto en Bs según la tasa ${colecta.tasa_label} (${colecta.tasa_actual?.toFixed(2)}) y notificar a los aportantes?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Notificar a Todos',
          onPress: async () => {
            try {
              await colectasApi.triggerPaymentNotifications(colecta.id);
              setConnectionError(false);
              if (setIsOffline) setIsOffline(false);
              Alert.alert('Notificaciones Enviadas', 'Se notificó a los aportantes su monto en Bolívares.');
              fetchColectas();
            } catch (e) {
              if (isNetworkError(e)) {
                setConnectionError(true);
                if (setIsOffline) setIsOffline(true);
              }
              Alert.alert('Error', getErrorMessage(e, 'No se pudieron enviar las notificaciones'));
            }
          },
        },
      ]
    );
  };

  // Confirmar Pago de Aporte
  const handleConfirmPayment = async () => {
    if (!targetColecta || !targetColecta.id || !targetColecta.mi_compromiso?.id) {
      Alert.alert('Error', 'No se ha seleccionado un compromiso válido.');
      return;
    }
    setSubmitting(true);
    try {
      let finalComprobanteUrl = null;
      if (receiptUri) {
        setUploadingReceipt(true);
        const resUpload = await loansApi.uploadFile(receiptUri);
        finalComprobanteUrl = resUpload.file_url;
        setUploadingReceipt(false);
      }

      const compromisoId = targetColecta.mi_compromiso.id;
      await colectasApi.confirmPayment(targetColecta.id, compromisoId, {
        payment_method: paymentMethod,
        codigo_banco: paymentBankCode,
        referencia_pago: paymentRef.trim() || undefined,
        comprobante_url: finalComprobanteUrl,
        nota_pago: paymentNote.trim() || undefined,
      });

      setShowPaymentModal(false);
      setPaymentRef('');
      setPaymentNote('');
      setReceiptUri(null);
      setTargetColecta(null);
      setConnectionError(false);
      if (setIsOffline) setIsOffline(false);
      Alert.alert('¡Pago Confirmado!', 'Tu aporte ha sido registrado como pagado.');
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
        finalComprobanteUrl = resUpload.file_url;
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
      Alert.alert('¡Colecta Completada!', 'El gasto fue validado y se notificó a todos los miembros de la mutual.');
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
  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'propuesta':
        return { label: '⏳ PROPUESTA', bg: '#fef3c7', text: '#d97706', border: '#fcd34d' };
      case 'activa':
        return { label: '🚀 ACTIVA', bg: '#d1fae5', text: '#059669', border: '#6ee7b7' };
      case 'cerrada':
        return { label: '📥 RECAUDADA', bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' };
      case 'completada':
        return { label: '✅ COMPLETADA', bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' };
      case 'cancelada':
        return { label: '✖️ CANCELADA', bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
      default:
        return { label: estado?.toUpperCase(), bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
    }
  };

  // Render Card de Colecta
  const renderColectaCard = ({ item }) => {
    const badge = getStatusBadge(item.estado);
    const isOwner = currentUser && item.proponente_id === currentUser.id;
    const isBeneficiary = currentUser && item.beneficiario_id === currentUser.id;
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

        {/* Beneficiario y Fecha */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            👤 Beneficiario: <Text style={styles.infoHighlight}>{item.beneficiario_nombre}</Text>
          </Text>
          <Text style={styles.infoText}>
            📅 Pago: <Text style={styles.infoHighlight}>{item.fecha_pago}</Text>
          </Text>
        </View>

        {/* Barra de Progreso Financiero */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>
                Prometido: <Text style={styles.progressAmount}>${formatVE(item.monto_prometido_usd)} USD</Text>
              </Text>
              <Text style={{ fontSize: 11, color: '#38bdf8', fontWeight: '600', marginTop: 1 }}>
                • Bs {formatVE(item.monto_prometido_bs || (item.monto_prometido_usd * item.tasa_actual))}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.progressMeta}>
                Meta: ${formatVE(item.monto_meta_usd)} USD
              </Text>
              <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                ~Bs {formatVE(item.monto_meta_bs || (item.monto_meta_usd * item.tasa_actual))}
              </Text>
            </View>
          </View>

          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(item.porcentaje_prometido, 100)}%`,
                  backgroundColor: item.porcentaje_prometido >= 100 ? '#10b981' : '#3b82f6',
                },
              ]}
            />
          </View>

          <View style={styles.progressFooter}>
            <Text style={styles.progressPercent}>{item.porcentaje_prometido}% alcanzado</Text>
            <Text style={[styles.progressStatusHint, { color: item.is_active ? '#10b981' : '#f59e0b' }]}>
              {item.is_active
                ? '🎉 ¡Quorum alcanzado!'
                : `Faltan $${formatVE(Math.max(0, item.monto_meta_usd - item.monto_prometido_usd))} USD`}
            </Text>
          </View>
        </View>

        {/* Estado de mi compromiso si existe */}
        {myPledge && (
          <View style={styles.myPledgeBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myPledgeTitle}>Mi compromiso voluntario:</Text>
              <Text style={styles.myPledgeAmount}>
                ${formatVE(myPledge.monto_usd)} USD
                <Text style={{ color: '#38bdf8', fontWeight: 'normal' }}>
                  {` (~Bs ${formatVE(myPledge.monto_bs || (myPledge.monto_usd * item.tasa_actual))})`}
                </Text>
              </Text>
            </View>
            <View style={[styles.pledgeStatePill, { backgroundColor: myPledge.estado === 'pagado' ? '#065f46' : '#1e3a8a' }]}>
              <Text style={styles.pledgeStateText}>
                {myPledge.estado === 'pagado' ? '✅ Pagado' : myPledge.estado === 'notificado' ? '💵 Cobro Listo' : '⏳ Prometido'}
              </Text>
            </View>
          </View>
        )}

        {/* Validación de gasto si está completada */}
        {item.gasto_validado && (
          <View style={styles.expenseValidatedBox}>
            <Text style={styles.expenseValidatedTitle}>✅ Gasto Validado por el Beneficiario:</Text>
            <Text style={styles.expenseValidatedDesc}>{item.descripcion_gasto}</Text>
            {item.comprobante_gasto_url ? (
              <Text style={styles.expenseValidatedReceipt}>📎 Comprobante adjunto disponible</Text>
            ) : null}
          </View>
        )}

        {/* Botones de acción */}
        <View style={styles.cardActions}>
          {/* Botón Ver Detalle */}
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => setSelectedColecta(item)}
          >
            <Text style={styles.btnSecondaryText}>👁️ Detalle ({item.total_aportantes})</Text>
          </TouchableOpacity>

          {/* Botón Prometer Aporte */}
          {(item.estado === 'propuesta' || item.estado === 'activa') && !myPledge && (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                setTargetColecta(item);
                setShowPledgeModal(true);
              }}
            >
              <Text style={styles.btnPrimaryText}>🤝 Aportar</Text>
            </TouchableOpacity>
          )}

          {/* Botón Pagar Mi Aporte si está prometido o notificado */}
          {myPledge && (myPledge.estado === 'prometido' || myPledge.estado === 'notificado') && (
            <TouchableOpacity
              style={styles.btnSuccess}
              onPress={() => {
                setTargetColecta(item);
                const avail = getAvailablePaymentMethods(item.beneficiario_datos_pago);
                setPaymentMethod(avail.length > 0 ? avail[0] : 'Pago Móvil');
                setShowPaymentModal(true);
              }}
            >
              <Text style={styles.btnPrimaryText}>💵 Pagar</Text>
            </TouchableOpacity>
          )}

          {/* Botón Cancelar Mi Aporte (permitido antes de pagado) */}
          {myPledge && myPledge.estado !== 'pagado' && (
            <TouchableOpacity
              style={styles.btnDangerOutline}
              onPress={() => handleCancelCommitment(item, myPledge)}
            >
              <Text style={styles.btnDangerOutlineText}>Cancelar</Text>
            </TouchableOpacity>
          )}

          {/* Botón Notificar Cobro (solo proponente si está activa) */}
          {isOwner && item.estado === 'activa' && (
            <TouchableOpacity
              style={styles.btnWarning}
              onPress={() => handleNotifyPayment(item)}
            >
              <Text style={styles.btnPrimaryText}>🔔 Notificar Bs</Text>
            </TouchableOpacity>
          )}

          {/* Botón Validar Gasto (beneficiario si está cerrada o completó recaudación) */}
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
                <Text style={styles.btnPrimaryText}>✅ Validar Gasto</Text>
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
            activeTab === 'colectas' ? (
              <TouchableOpacity
                style={styles.headerAddButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.headerAddButtonText}>+ Colecta</Text>
              </TouchableOpacity>
            ) : (
              activeOrg?.role === 'founder' && (
                <TouchableOpacity
                  style={styles.headerAddButton}
                  onPress={() => setShowFundModal(true)}
                >
                  <Text style={styles.headerAddButtonText}>+ Crear Fondo</Text>
                </TouchableOpacity>
              )
            )
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
              🐮 Colectas (Vacas) {colectas.length > 0 ? `(${colectas.length})` : ''}
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
      </View>

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
            data={colectas}
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
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>🐮</Text>
                  <Text style={styles.emptyTitle}>No hay colectas activas</Text>
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
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

              <Text style={styles.inputLabel}>Nombre del Beneficiario que recibirá los fondos</Text>
              <TextInput
                style={styles.input}
                value={beneficiarioNombre}
                onChangeText={setBeneficiarioNombre}
                placeholder="Nombre de quien pagará el servicio/bien"
                placeholderTextColor="#64748b"
              />

              {/* Información sobre Métodos de Pago del Creador/Beneficiario */}
              {userPaymentConfig && hasConfiguredPaymentMethods(userPaymentConfig) ? (
                <View style={styles.pmConfiguredInfoCard}>
                  <Text style={styles.pmConfiguredInfoTitle}>
                    💳 Métodos de Pago asociados automáticamente:
                  </Text>
                  <Text style={styles.pmConfiguredInfoList}>
                    {getAvailablePaymentMethods(userPaymentConfig).join(' • ')}
                  </Text>
                  <Text style={styles.pmConfiguredInfoSub}>
                    Los miembros que aporten verán estos datos para transferir directamente a tu cuenta o Pago Móvil.
                  </Text>
                </View>
              ) : (
                <View style={styles.pmWarningInfoCard}>
                  <Text style={styles.pmWarningInfoTitle}>
                    ⚠️ Datos de Pago Móvil no configurados
                  </Text>
                  <Text style={styles.pmWarningInfoSub}>
                    Aún no has configurado tus datos de pago en tu perfil. Puedes registrarlos en Préstamos > ⚙️ Datos para que los aportantes reciban tus datos bancarios automáticamente.
                  </Text>
                </View>
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
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 2: DETALLE DE COLECTA Y APORTANTES             */}
      {/* ==================================================== */}
      <Modal visible={!!selectedColecta} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            {selectedColecta && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>🐮 {selectedColecta.titulo}</Text>
                <Text style={styles.detailProposito}>{selectedColecta.proposito}</Text>

                <View style={styles.detailInfoBox}>
                  <Text style={styles.detailInfoItem}>
                    💵 <Text style={{ fontWeight: 'bold' }}>Meta:</Text> ${formatVE(selectedColecta.monto_meta_usd)} USD (~Bs {formatVE(selectedColecta.monto_meta_bs || (selectedColecta.monto_meta_usd * selectedColecta.tasa_actual))})
                  </Text>
                  <Text style={styles.detailInfoItem}>
                    📊 <Text style={{ fontWeight: 'bold' }}>Tasa:</Text> {selectedColecta.tasa_label} (Bs {formatVE(selectedColecta.tasa_actual)})
                  </Text>
                  <Text style={styles.detailInfoItem}>
                    👤 <Text style={{ fontWeight: 'bold' }}>Beneficiario:</Text> {selectedColecta.beneficiario_nombre}
                  </Text>
                  <Text style={styles.detailInfoItem}>
                    📅 <Text style={{ fontWeight: 'bold' }}>Fecha de pago:</Text> {selectedColecta.fecha_pago}
                  </Text>
                </View>

                {/* Datos de Pago del Beneficiario */}
                <Text style={styles.sectionHeader}>💳 Datos de Pago del Beneficiario</Text>
                {(() => {
                  const methods = getAvailablePaymentMethods(selectedColecta.beneficiario_datos_pago);
                  if (methods.length === 0) {
                    return (
                      <View style={styles.noPmBox}>
                        <Text style={styles.noPmText}>
                          ℹ️ El beneficiario no tiene datos de pago registrados. Deberás coordinar el aporte directamente con {selectedColecta.beneficiario_nombre}.
                        </Text>
                      </View>
                    );
                  }
                  const pmData = getBeneficiaryMethodData(selectedColecta.beneficiario_datos_pago, 'Pago Móvil');
                  return (
                    <View style={styles.beneficiaryPmContainer}>
                      {pmData && (
                        <View style={styles.pmCard}>
                          <View style={styles.pmCardHeader}>
                            <Text style={styles.pmCardTitle}>📲 Pago Móvil</Text>
                            <Text style={styles.pmCardSubtitle}>Beneficiario: {selectedColecta.beneficiario_nombre}</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.copyDataRow}
                            onPress={() => copyField('banco', pmData.banco)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={styles.copyDataLabel}>Banco</Text>
                              <Text style={styles.copyDataValue}>{getBankLabel(pmData.banco)}</Text>
                            </View>
                            <Text style={styles.copyIcon}>{copiedField === 'banco' ? '✓' : '📋'}</Text>
                          </TouchableOpacity>

                          {(() => {
                            const getPrefix = (tipo) => {
                              if (!tipo || tipo === 'Persona') return 'V';
                              if (tipo === 'Comercio') return 'J';
                              if (tipo === 'Comuna') return 'G';
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
                                  <Text style={styles.copyDataLabel}>Cédula / RIF</Text>
                                  <Text style={styles.copyDataValue}>{safeDoc}</Text>
                                </View>
                                <Text style={styles.copyIcon}>{copiedField === 'doc' ? '✓' : '📋'}</Text>
                              </TouchableOpacity>
                            );
                          })()}

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

                          <TouchableOpacity
                            style={styles.copyAllButton}
                            onPress={() => copyAllPagoMovil(pmData, null)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.copyAllButtonText}>
                              {copiedField === 'all' ? '✅ ¡Copiado!' : '📋 Copiar todo para el banco'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {methods.filter(m => m !== 'Pago Móvil').map(m => {
                        const val = getBeneficiaryMethodData(selectedColecta.beneficiario_datos_pago, m);
                        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val || '');
                        return (
                          <View key={m} style={[styles.pmCard, { marginTop: 10 }]}>
                            <Text style={styles.pmCardTitle}>💳 {m}</Text>
                            <TouchableOpacity
                              style={[styles.copyDataRow, { marginTop: 6 }]}
                              onPress={() => copyField(m, strVal)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.copyDataLabel}>Datos</Text>
                                <Text style={[styles.copyDataValue, { fontSize: 15 }]}>{strVal}</Text>
                              </View>
                              <Text style={styles.copyIcon}>{copiedField === m ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}

                {/* Lista de Aportantes */}
                <Text style={styles.sectionHeader}>
                  🤝 Aportantes ({selectedColecta.compromisos.filter((c) => c.estado !== 'cancelado').length})
                </Text>
                {selectedColecta.compromisos.filter((c) => c.estado !== 'cancelado').length === 0 ? (
                  <Text style={styles.emptySubText}>Aún no hay compromisos registrados.</Text>
                ) : (
                  selectedColecta.compromisos
                    .filter((c) => c.estado !== 'cancelado')
                    .map((comp) => (
                      <View key={comp.id} style={styles.contributorRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.contributorName}>{comp.socio_name}</Text>
                          <Text style={styles.contributorAmount}>
                            ${formatVE(comp.monto_usd)} USD
                            {` (~Bs ${formatVE(comp.monto_bs || (comp.monto_usd * selectedColecta.tasa_actual))})`}
                          </Text>
                          {comp.referencia_pago ? (
                            <Text style={styles.contributorRef}>Ref: {comp.referencia_pago}</Text>
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.pledgeStatePill,
                            { backgroundColor: comp.estado === 'pagado' ? '#065f46' : '#1e3a8a' },
                          ]}
                        >
                          <Text style={styles.pledgeStateText}>
                            {comp.estado === 'pagado' ? '✅ Pagado' : comp.estado === 'notificado' ? '💵 Notificado' : '⏳ Prometido'}
                          </Text>
                        </View>
                      </View>
                    ))
                )}

                {/* Comprobante de Gasto si fue validado */}
                {selectedColecta.gasto_validado && (
                  <View style={[styles.expenseValidatedBox, { marginTop: 16 }]}>
                    <Text style={styles.expenseValidatedTitle}>✅ Gasto Validado por el Beneficiario:</Text>
                    <Text style={styles.expenseValidatedDesc}>{selectedColecta.descripcion_gasto}</Text>
                    {selectedColecta.comprobante_gasto_url ? (
                      <Image
                        source={{ uri: selectedColecta.comprobante_gasto_url }}
                        style={styles.receiptPreviewImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.emptySubText}>Sin comprobante físico adjunto.</Text>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btnPrimary, { marginTop: 20 }]}
                  onPress={() => setSelectedColecta(null)}
                >
                  <Text style={styles.btnPrimaryText}>Cerrar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 3: PROMETER APORTE VOLUNTARIO                  */}
      {/* ==================================================== */}
      <Modal visible={showPledgeModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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

                <Text style={styles.noteBox}>
                  ℹ️ Tu compromiso es voluntario. Al llegar la fecha de cobro recibirás la notificación con el monto exacto en Bolívares.
                </Text>

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
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 4: CONFIRMAR PAGO DE APORTE                    */}
      {/* ==================================================== */}
      <Modal visible={showPaymentModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>💵 Confirmar Pago de Aporte</Text>
              {targetColecta && (
                <>
                  <Text style={styles.modalSubtitle}>
                    Colecta: "{targetColecta.titulo}" • Beneficiario: {targetColecta.beneficiario_nombre}
                  </Text>

                  {targetColecta.mi_compromiso && (
                    <View style={styles.paymentSummaryBox}>
                      <Text style={styles.paymentSummaryText}>
                        Monto acordado: <Text style={{ fontWeight: 'bold' }}>${formatVE(targetColecta.mi_compromiso.monto_usd)} USD</Text>
                      </Text>
                      <Text style={styles.paymentSummaryBs}>
                        Total a transferir: Bs {formatVE(targetColecta.mi_compromiso.monto_bs || (targetColecta.mi_compromiso.monto_usd * targetColecta.tasa_actual))}
                      </Text>
                      <Text style={styles.paymentSummaryRate}>
                        Tasa aplicada ({targetColecta.tasa_label}): Bs. {formatVE(targetColecta.tasa_actual)}
                      </Text>
                    </View>
                  )}

                  {(() => {
                    const availableMethods = getAvailablePaymentMethods(targetColecta.beneficiario_datos_pago);

                    if (availableMethods.length === 0) {
                      return (
                        <View style={styles.noPmWarningBox}>
                          <Text style={styles.noPmWarningTitle}>⚠️ Sin métodos registrados</Text>
                          <Text style={styles.noPmWarningText}>
                            El beneficiario ({targetColecta.beneficiario_nombre}) no tiene métodos de pago registrados en el sistema.
                            Por favor coordina directamente con él para realizar la entrega o transferencia de tu aporte.
                          </Text>
                        </View>
                      );
                    }

                    const selectedNormalized = normalizePaymentMethodName(paymentMethod);
                    const isPagoMovil = selectedNormalized === 'Pago Móvil';
                    const pmData = isPagoMovil ? getBeneficiaryMethodData(targetColecta.beneficiario_datos_pago, 'Pago Móvil') : null;
                    const rawMontoBs = targetColecta.mi_compromiso?.monto_bs || ((targetColecta.mi_compromiso?.monto_usd || 0) * (targetColecta.tasa_actual || 1));
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
                              <Text style={styles.pmCardTitle}>📲 Datos de Pago Móvil del Beneficiario</Text>
                              <Text style={styles.pmCardSubtitle}>Beneficiario: {targetColecta.beneficiario_nombre}</Text>
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
                                if (!tipo || tipo === 'Persona') return 'V';
                                if (tipo === 'Comercio') return 'J';
                                if (tipo === 'Comuna') return 'G';
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

                        {/* Otros métodos registrados (Transferencia, Binance, etc.) */}
                        {!isPagoMovil && (
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

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalCancel}
                      onPress={() => setShowPaymentModal(false)}
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
                        <Text style={styles.modalSubmitText}>Registrar Pago</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 5: VALIDAR GASTO REALIZADO (BENEFICIARIO)      */}
      {/* ==================================================== */}
      <Modal visible={showExpenseModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>✅ Validar Gasto Realizado</Text>
              <Text style={styles.modalSubtitle}>
                Como beneficiario, confirma a la mutual cómo se utilizaron los fondos recaudados.
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
                    <Text style={styles.modalSubmitText}>Validar y Completar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#1e293b',
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
    backgroundColor: '#1e293b',
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
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  rateBadgeText: {
    color: '#60a5fa',
    fontSize: 12,
  },
  propositoText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
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
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myPledgeTitle: {
    fontSize: 11,
    color: '#93c5fd',
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
});
