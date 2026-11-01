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
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { fundsApi, colectasApi, loansApi, authApi } from '../api/client';
import ScreenTitle from '../components/ScreenTitle';
import { OrgContext } from '../context/OrgContext';
import { subscribeRealtime } from '../utils/realtime';
import { getErrorMessage, isNetworkError } from '../utils/errors';
import theme from '../utils/theme';
import { OfflineEmptyState, OfflineNotice } from '../components/OfflineNotice';
import { VENEZUELAN_BANKS } from '../utils/banks';

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
  const [tipoTasa, setTipoTasa] = useState('bcv');
  const [tasaFijaValor, setTasaFijaValor] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [beneficiarioNombre, setBeneficiarioNombre] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Formulario Prometer Aporte
  const [pledgeAmount, setPledgeAmount] = useState('');

  // Formulario Confirmar Pago
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [receiptUri, setReceiptUri] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

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
    // Default fecha de pago: dentro de 7 días
    const d = new Date();
    d.setDate(d.getDate() + 7);
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

  // Crear Colecta
  const handleCreateColecta = async () => {
    if (!titulo.trim() || !proposito.trim() || !montoMeta) {
      Alert.alert('Campos requeridos', 'Por favor ingresa título, propósito y monto meta.');
      return;
    }
    const metaNum = parseFloat(montoMeta);
    if (isNaN(metaNum) || metaNum <= 0) {
      Alert.alert('Monto inválido', 'El monto meta debe ser un número mayor a 0 USD.');
      return;
    }
    if (tipoTasa === 'fija' && (!tasaFijaValor || parseFloat(tasaFijaValor) <= 0)) {
      Alert.alert('Tasa fija requerida', 'Ingresa el valor numérico para la tasa fija.');
      return;
    }

    setSubmitting(true);
    try {
      await colectasApi.createColecta({
        titulo: titulo.trim(),
        proposito: proposito.trim(),
        monto_meta_usd: metaNum,
        tipo_tasa: tipoTasa,
        tasa_fija_valor: tipoTasa === 'fija' ? parseFloat(tasaFijaValor) : null,
        fecha_pago: fechaPago,
        beneficiario_nombre: beneficiarioNombre.trim() || undefined,
      });

      setShowCreateModal(false);
      setTitulo('');
      setProposito('');
      setMontoMeta('');
      setTipoTasa('bcv');
      setTasaFijaValor('');
      Alert.alert('¡Colecta Creada!', 'La propuesta de colecta está activa y lista para recibir compromisos.');
      fetchColectas();
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'No se pudo crear la colecta'));
    } finally {
      setSubmitting(false);
    }
  };

  // Prometer Aporte
  const handlePledge = async () => {
    if (!pledgeAmount || parseFloat(pledgeAmount) <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto en USD mayor a 0.');
      return;
    }
    setSubmitting(true);
    try {
      await colectasApi.pledgeCommitment(targetColecta.id, parseFloat(pledgeAmount));
      setShowPledgeModal(false);
      setPledgeAmount('');
      setTargetColecta(null);
      Alert.alert('¡Compromiso Registrado!', 'Tu aporte voluntario ha sido registrado exitosamente.');
      fetchColectas();
    } catch (e) {
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
              Alert.alert('Cancelado', 'Tu compromiso ha sido cancelado.');
              fetchColectas();
            } catch (e) {
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
              Alert.alert('Notificaciones Enviadas', 'Se notificó a los aportantes su monto en Bolívares.');
              fetchColectas();
            } catch (e) {
              Alert.alert('Error', getErrorMessage(e, 'No se pudieron enviar las notificaciones'));
            }
          },
        },
      ]
    );
  };

  // Confirmar Pago de Aporte
  const handleConfirmPayment = async () => {
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
      Alert.alert('¡Pago Confirmado!', 'Tu aporte ha sido registrado como pagado.');
      fetchColectas();
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'Error al confirmar el pago'));
    } finally {
      setSubmitting(false);
      setUploadingReceipt(false);
    }
  };

  // Validar Gasto (Beneficiario)
  const handleValidateExpense = async () => {
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
      Alert.alert('¡Colecta Completada!', 'El gasto fue validado y se notificó a todos los miembros de la mutual.');
      fetchColectas();
    } catch (e) {
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
      fetchFunds();
    } catch (e) {
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
            📊 Tasa: <Text style={{ fontWeight: 'bold' }}>{item.tasa_label}</Text> • Ref: Bs {item.tasa_actual.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <Text style={styles.progressLabel}>
              Prometido: <Text style={styles.progressAmount}>${item.monto_prometido_usd.toFixed(2)} USD</Text>
            </Text>
            <Text style={styles.progressMeta}>
              Meta: ${item.monto_meta_usd.toFixed(2)} USD (~Bs {item.monto_meta_bs.toLocaleString('es-VE')})
            </Text>
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
                : `Faltan $${Math.max(0, item.monto_meta_usd - item.monto_prometido_usd).toFixed(2)} USD`}
            </Text>
          </View>
        </View>

        {/* Estado de mi compromiso si existe */}
        {myPledge && (
          <View style={styles.myPledgeBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myPledgeTitle}>Mi compromiso voluntario:</Text>
              <Text style={styles.myPledgeAmount}>
                ${myPledge.monto_usd.toFixed(2)} USD
                {myPledge.monto_bs ? ` (~Bs ${myPledge.monto_bs.toLocaleString('es-VE')})` : ''}
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
              <Text style={{ fontWeight: 'bold' }}>USDT:</Text> Bs {rates.usdt?.rate?.toFixed(2)} •{' '}
              <Text style={{ fontWeight: 'bold' }}>Paralelo:</Text> Bs {rates.paralelo?.rate?.toFixed(2)}
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

              <Text style={styles.inputLabel}>Monto Meta (USD) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={montoMeta}
                onChangeText={setMontoMeta}
                placeholder="Ej: 50"
                placeholderTextColor="#64748b"
              />

              {/* Selector de Tipo de Tasa de Cambio */}
              <Text style={styles.inputLabel}>Tasa de Cambio para liquidar en Bs *</Text>
              <View style={styles.rateTypeSelector}>
                {[
                  { key: 'bcv', label: 'BCV' },
                  { key: 'usdt', label: 'USDT' },
                  { key: 'euro', label: 'Euro' },
                  { key: 'paralelo', label: 'Paralelo' },
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

              <Text style={styles.inputLabel}>Fecha de Pago / Liquidación (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={fechaPago}
                onChangeText={setFechaPago}
                placeholder="2026-10-30"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Nombre del Beneficiario que recibirá los fondos</Text>
              <TextInput
                style={styles.input}
                value={beneficiarioNombre}
                onChangeText={setBeneficiarioNombre}
                placeholder="Nombre de quien pagará el servicio/bien"
                placeholderTextColor="#64748b"
              />

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
                    💵 <Text style={{ fontWeight: 'bold' }}>Meta:</Text> ${selectedColecta.monto_meta_usd.toFixed(2)} USD (~Bs {selectedColecta.monto_meta_bs.toLocaleString('es-VE')})
                  </Text>
                  <Text style={styles.detailInfoItem}>
                    📊 <Text style={{ fontWeight: 'bold' }}>Tasa:</Text> {selectedColecta.tasa_label} (Bs {selectedColecta.tasa_actual?.toFixed(2)})
                  </Text>
                  <Text style={styles.detailInfoItem}>
                    👤 <Text style={{ fontWeight: 'bold' }}>Beneficiario:</Text> {selectedColecta.beneficiario_nombre}
                  </Text>
                  <Text style={styles.detailInfoItem}>
                    📅 <Text style={{ fontWeight: 'bold' }}>Fecha de pago:</Text> {selectedColecta.fecha_pago}
                  </Text>
                </View>

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
                            ${comp.monto_usd.toFixed(2)} USD
                            {comp.monto_bs ? ` (~Bs ${comp.monto_bs.toLocaleString('es-VE')})` : ''}
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
                <Text style={styles.inputLabel}>Monto de tu aporte voluntario (USD)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={pledgeAmount}
                  onChangeText={setPledgeAmount}
                  placeholder="Ej: 15"
                  placeholderTextColor="#64748b"
                />

                {pledgeAmount && parseFloat(pledgeAmount) > 0 ? (
                  <Text style={styles.rateExplanation}>
                    Equivale aproximadamente a:{' '}
                    <Text style={{ fontWeight: 'bold', color: '#10b981' }}>
                      Bs {(parseFloat(pledgeAmount) * targetColecta.tasa_actual).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                    </Text>{' '}
                    (Tasa {targetColecta.tasa_label})
                  </Text>
                ) : null}

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
                        Monto acordado: <Text style={{ fontWeight: 'bold' }}>${targetColecta.mi_compromiso.monto_usd} USD</Text>
                      </Text>
                      <Text style={styles.paymentSummaryBs}>
                        Total a transferir: Bs {(targetColecta.mi_compromiso.monto_bs || targetColecta.mi_compromiso.monto_usd * targetColecta.tasa_actual).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={styles.paymentSummaryRate}>
                        Tasa aplicada: {targetColecta.tasa_label}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Método de Pago</Text>
                  <View style={styles.rateTypeSelector}>
                    {['pago_movil', 'transferencia', 'efectivo', 'zelle', 'binance'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.rateTypeBtn, paymentMethod === m && styles.rateTypeBtnActive]}
                        onPress={() => setPaymentMethod(m)}
                      >
                        <Text style={[styles.rateTypeBtnText, paymentMethod === m && styles.rateTypeBtnTextActive]}>
                          {m.replace('_', ' ').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {(paymentMethod === 'pago_movil' || paymentMethod === 'transferencia') && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.inputLabel}>Banco Emisor (Venezuela)</Text>
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
});
