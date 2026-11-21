import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fundsApi, colectasApi, loansApi, useAuthStore, eventBus } from '@civiccore/sdk';
import { Plus, X, AlertCircle, CheckCircle, Clock, ChevronRight, DollarSign, Wallet, ShieldCheck, FileText, Check, AlertTriangle } from 'lucide-react';
import { OfflineEmptyState, OfflineNoticeBanner } from '../../components/Common/OfflineEmptyState.jsx';
import { VENEZUELAN_BANKS, getBankLabel } from '../../utils/banks.js';
import { parseVEAmount, formatVE, formatCurrencyVE } from '../../utils/currency.js';
import { formatLocalDate, formatTimeAMPM, getDefaultHoraPago, formatDateTime } from '../../utils/dates.js';
import {
  normalizePaymentMethodKey,
  hasConfiguredPaymentMethods,
  getAvailablePaymentMethods,
  loadUserPaymentConfig,
  formatCashPaymentSummary,
} from '../../utils/paymentConfig.js';
import CashDeliveryCard from '../../components/Common/CashDeliveryCard.jsx';
import BankTransferCard from '../../components/Common/BankTransferCard.jsx';
import CashPayrollInput from '../../components/Common/CashPayrollInput.jsx';
import PaymentConfigModal from '../../components/Common/PaymentConfigModal.jsx';

/** Calcula meta, comprometido total, restante y promedio real de aportes vigentes. */
const getColectaFinancialStats = (colecta) => {
  if (!colecta) {
    return { metaUsd: 0, comprometidoUsd: 0, restanteUsd: 0, promedioUsd: 0, aportesCount: 0 };
  }
  const metaUsd = Number(colecta.monto_meta_usd) || 0;
  const comprometidoUsd =
    (Number(colecta.monto_prometido_usd) || 0) +
    (Number(colecta.monto_pagado_usd) || 0) +
    (Number(colecta.monto_validado_usd) || 0);
  const restanteUsd = Math.max(0, metaUsd - comprometidoUsd);
  const activeComps = (colecta.compromisos || []).filter(
    (c) => c.estado !== 'cancelado' && c.estado !== 'devuelto'
  );
  const aportesCount = activeComps.length > 0
    ? activeComps.length
    : (Number(colecta.total_aportantes) || 0);
  const promedioUsd = aportesCount > 0 ? (comprometidoUsd / aportesCount) : 0;

  return {
    metaUsd,
    comprometidoUsd,
    restanteUsd,
    promedioUsd,
    aportesCount,
  };
};

const getStatusBadge = (estado, item = null) => {
  if (item?.gasto_validado || estado === 'completada') {
    return { label: '✅ CULMINADA', bg: 'rgba(168, 85, 247, 0.2)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.4)' };
  }
  switch (estado) {
    case 'propuesta':
      return { label: '⏳ PROPUESTA', bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' };
    case 'activa':
      return { label: '🚀 ACTIVA', bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399', border: 'rgba(16, 185, 129, 0.4)' };
    case 'cerrada':
      return { label: '📥 RECAUDADA', bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.4)' };
    case 'cancelada':
      return { label: '⚠️ CANCELADA', bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)' };
    default:
      return { label: estado ? estado.toUpperCase() : 'ACTIVA', bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.4)' };
  }
};

const contribStatusMap = {
  prometido:  { bg: 'rgba(251, 146, 60, 0.10)', border: '#f97316', badgeBg: '#f97316', badgeText: '#fff', icon: '⏳', label: 'Pendiente de pago' },
  notificado: { bg: 'rgba(251, 146, 60, 0.10)', border: '#f97316', badgeBg: '#f97316', badgeText: '#fff', icon: '⏳', label: 'Pendiente de pago' },
  pagado:     { bg: 'rgba(250, 204, 21, 0.10)', border: '#facc15', badgeBg: '#ca8a04', badgeText: '#fef08a', icon: '🕐', label: 'Por validar' },
  paid:       { bg: 'rgba(250, 204, 21, 0.10)', border: '#facc15', badgeBg: '#ca8a04', badgeText: '#fef08a', icon: '🕐', label: 'Por validar' },
  validado:   { bg: 'rgba(59, 130, 246, 0.10)', border: '#3b82f6', badgeBg: '#1d4ed8', badgeText: '#bfdbfe', icon: '✅', label: 'Validado' },
  verified:   { bg: 'rgba(59, 130, 246, 0.10)', border: '#3b82f6', badgeBg: '#1d4ed8', badgeText: '#bfdbfe', icon: '✅', label: 'Validado' },
  devuelto:   { bg: 'rgba(16, 185, 129, 0.10)', border: '#10b981', badgeBg: '#047857', badgeText: '#a7f3d0', icon: '🎉', label: 'Devuelto' },
};

const getContribStatusConfig = (estado, isGestor = false) => {
  const base = contribStatusMap[estado] || {
    bg: 'rgba(100, 116, 139, 0.08)',
    border: '#475569',
    badgeBg: '#334155',
    badgeText: '#94a3b8',
    icon: '📋',
    label: estado || 'Compromiso',
  };
  if (estado === 'pagado' || estado === 'paid') {
    return {
      ...base,
      label: isGestor ? 'Por validar' : 'En revisión por el gestor',
    };
  }
  return base;
};

const isPlannedDateReached = (fechaPago) => {
  if (!fechaPago) return false;
  try {
    const cleanDateStr = String(fechaPago).split('T')[0].replace(/\//g, '-').trim();
    if (!cleanDateStr) return false;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}` >= cleanDateStr;
  } catch {
    return false;
  }
};

/** Helper para determinar si una colecta está estancada y requiere rescate/impulso (Watchdog) */
const isColectaStalled = (colectaItem, activeOrg) => {
  if (!colectaItem) return false;
  if (colectaItem.estado !== 'propuesta' && colectaItem.estado !== 'activa') return false;
  const stats = getColectaFinancialStats(colectaItem);
  if (stats.restanteUsd <= 0) return false;

  // Trigger 1: La fecha planificada de pago ya llegó o pasó
  if (isPlannedDateReached(colectaItem.fecha_pago)) return true;

  // Trigger 2: Watchdog de tiempo (más de 48 horas creada sin alcanzar la meta)
  if (colectaItem.created_at) {
    try {
      let iso = String(colectaItem.created_at).trim();
      if (!iso.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(iso)) {
        iso = iso.replace(' ', 'T') + 'Z';
      }
      const createdMs = new Date(iso).getTime();
      if (!isNaN(createdMs) && (Date.now() - createdMs) >= 48 * 3600 * 1000) {
        return true;
      }
    } catch (_) {}
  }

  // Trigger 3: Quórum de aportantes alcanzado (todos los miembros aportaron pero no se llegó a la meta)
  const activeMembersCount = activeOrg?.members_count;
  const totalAportantes = colectaItem.total_aportantes || (colectaItem.compromisos ? new Set(colectaItem.compromisos.map(c => c.socio_id)).size : 0);
  if (activeMembersCount && activeMembersCount > 1 && totalAportantes >= activeMembersCount) {
    return true;
  }

  return false;
};

const isHardCurrencyMethod = (method) => {
  if (!method) return false;
  const m = String(method).toLowerCase().trim();
  if (!m) return false;
  if (
    m.includes('bolívar') ||
    m.includes('bolivar') ||
    m.includes('pago móvil') ||
    m.includes('pago movil') ||
    m.includes('pago_movil') ||
    m.includes('transferencia') ||
    m.includes('ves') ||
    m.includes('(bs)') ||
    m.includes(' bs') ||
    m.includes('_bs') ||
    m === 'bs'
  ) {
    return false;
  }
  return (
    m.includes('efectivo usd') ||
    m.includes('efectivo_usd') ||
    m.includes('usd') ||
    m.includes('usdt') ||
    m.includes('binance') ||
    m.includes('zelle') ||
    m.includes('divisa') ||
    m === 'efectivo'
  );
};

const getEarlyBsPaymentMessage = (fechaPago, mode = 'pay') => {
  const action = mode === 'verify' ? 'validar pagos' : 'registrar ni validar aportes';
  return (
    `No es posible ${action} en Bolívares (Bs) antes de la fecha de pago/liquidación (${fechaPago || 'planificada'}). ` +
    `Esto solo puede hacerse con monedas "duras" como USD en efectivo o USDT.`
  );
};

export default function FundsDashboard() {
  const { activeOrg, user, isOffline } = useAuthStore();
  const [activeTab, setActiveTab] = useState('colectas'); // 'colectas' | 'periodicos'
  const [connectionError, setConnectionError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Helper para leer caché inicial
  const getInitialCached = (prefix) => {
    try {
      const orgId = activeOrg?.id || localStorage.getItem('active_org_id') || localStorage.getItem('organizationId');
      if (orgId) {
        const cached = localStorage.getItem(`${prefix}_${orgId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (_) {}
    return null;
  };

  // Colectas state
  const initialCachedColectas = getInitialCached('cached_colectas');
  const [colectas, setColectas] = useState(initialCachedColectas || []);
  const [hasLoadedColectas, setHasLoadedColectas] = useState(Boolean(initialCachedColectas));
  const [rates, setRates] = useState({});
  const [loadingColectas, setLoadingColectas] = useState(!initialCachedColectas);
  const [colectasFilter, setColectasFilter] = useState('active'); // 'active' | 'history'

  const activeColectas = colectas.filter((c) => !c.gasto_validado && !['completada', 'cancelada'].includes(c.estado));
  const historyColectas = colectas.filter((c) => c.gasto_validado || ['completada', 'cancelada'].includes(c.estado));
  const displayedColectas = colectasFilter === 'active' ? activeColectas : historyColectas;

  // Fondos comunes state
  const initialCachedFunds = getInitialCached('cached_funds');
  const [funds, setFunds] = useState(initialCachedFunds || []);
  const [hasLoadedFunds, setHasLoadedFunds] = useState(Boolean(initialCachedFunds));
  const [loadingFunds, setLoadingFunds] = useState(!initialCachedFunds);

  // Modales
  const [showCreateColectaModal, setShowCreateColectaModal] = useState(false);
  const [showCreateFundModal, setShowCreateFundModal] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [userPaymentConfig, setUserPaymentConfig] = useState({});
  const [targetColecta, setTargetColecta] = useState(null);
  const [selectedCompromiso, setSelectedCompromiso] = useState(null);
  const [receiptModalUrl, setReceiptModalUrl] = useState(null);
  const [receiptModalTitle, setReceiptModalTitle] = useState('');

  // Form: Proponer Colecta
  const [titulo, setTitulo] = useState('');
  const [proposito, setProposito] = useState('');
  const [montoMeta, setMontoMeta] = useState('');
  const [colectaCurrency, setColectaCurrency] = useState('USD'); // 'USD' | 'VES'
  const [tipoTasa, setTipoTasa] = useState('bcv');
  const [tasaFijaValor, setTasaFijaValor] = useState('');
  const [fechaPago, setFechaPago] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatLocalDate(d);
  });
  const [horaPago, setHoraPago] = useState('14:00');
  const [colectaAcceptedMethods, setColectaAcceptedMethods] = useState([]);
  const [beneficiarioNombre, setBeneficiarioNombre] = useState('');
  const [submittingColecta, setSubmittingColecta] = useState(false);

  // Desglose de aportes expandidos
  const [expandedBreakdown, setExpandedBreakdown] = useState({});
  const [expandedStalled, setExpandedStalled] = useState({});

  const toggleExpandedStalled = (colectaId) => {
    setExpandedStalled(prev => ({
      ...prev,
      [colectaId]: !prev[colectaId],
    }));
  };

  // Form: Comprometer Aporte
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeCurrency, setPledgeCurrency] = useState('USD'); // 'USD' | 'VES'
  const [submittingPledge, setSubmittingPledge] = useState(false);

  // Form: Notificar Pago
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [paymentBankCode, setPaymentBankCode] = useState('0102');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('');
  const [cashPayroll, setCashPayroll] = useState({});
  const [cashSerials, setCashSerials] = useState('');
  const [cashDeliveryNote, setCashDeliveryNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showEarlyBsNotice, setShowEarlyBsNotice] = useState(false);

  // Form: Validar Gasto
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseReceiptUrl, setExpenseReceiptUrl] = useState('');
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Form: Crear Fondo Común
  const [newFundName, setNewFundName] = useState('');
  const [newFundType, setNewFundType] = useState('emergency');
  const [newFundTarget, setNewFundTarget] = useState('');
  const [submittingFund, setSubmittingFund] = useState(false);

  // Cargar Colectas y Tasas
  const fetchColectas = async (silent = false) => {
    if (!activeOrg?.id) {
      setColectas([]);
      setLoadingColectas(false);
      setHasLoadedColectas(true);
      return;
    }
    try {
      if (!silent) setLoadingColectas(true);
      setConnectionError(false);
      const [data, ratesData] = await Promise.all([
        colectasApi.getColectas(),
        colectasApi.getRates().catch(() => ({}))
      ]);
      const list = Array.isArray(data) ? data : [];
      setColectas(list);
      setRates(ratesData || {});
      setHasLoadedColectas(true);
      try {
        localStorage.setItem(`cached_colectas_${activeOrg.id}`, JSON.stringify(list));
      } catch (_) {}
    } catch (err) {
      console.warn('Error fetching colectas:', err);
      const isNet = !err?.response && (
        Boolean(err?.request) ||
        Boolean(err?.message && (
          err.message.includes('Network Error') ||
          err.message.includes('Failed to fetch') ||
          err.message.includes('Network request failed')
        ))
      );
      if (isNet) {
        setConnectionError(true);
        try {
          const cached = localStorage.getItem(`cached_colectas_${activeOrg.id}`);
          if (cached) setColectas(JSON.parse(cached));
        } catch (_) {}
      }
    } finally {
      if (!silent) setLoadingColectas(false);
      setHasLoadedColectas(true);
    }
  };

  // Cargar Fondos Comunes
  const fetchFunds = async (silent = false) => {
    if (!activeOrg?.id) {
      setFunds([]);
      setLoadingFunds(false);
      setHasLoadedFunds(true);
      return;
    }
    try {
      if (!silent) setLoadingFunds(true);
      setConnectionError(false);
      const data = await fundsApi.getFunds();
      const list = Array.isArray(data) ? data : [];
      setFunds(list);
      setHasLoadedFunds(true);
      try {
        localStorage.setItem(`cached_funds_${activeOrg.id}`, JSON.stringify(list));
      } catch (_) {}
    } catch (err) {
      console.warn('Error fetching funds:', err);
      const isNet = !err?.response && (
        Boolean(err?.request) ||
        Boolean(err?.message && (
          err.message.includes('Network Error') ||
          err.message.includes('Failed to fetch') ||
          err.message.includes('Network request failed')
        ))
      );
      if (isNet) {
        setConnectionError(true);
        try {
          const cached = localStorage.getItem(`cached_funds_${activeOrg.id}`);
          if (cached) setFunds(JSON.parse(cached));
        } catch (_) {}
      }
    } finally {
      if (!silent) setLoadingFunds(false);
      setHasLoadedFunds(true);
    }
  };

  useEffect(() => {
    if (activeOrg?.id) {
      try {
        const cachedC = localStorage.getItem(`cached_colectas_${activeOrg.id}`);
        if (cachedC) {
          const parsed = JSON.parse(cachedC);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setColectas(parsed);
            setHasLoadedColectas(true);
          }
        }
        const cachedF = localStorage.getItem(`cached_funds_${activeOrg.id}`);
        if (cachedF) {
          const parsed = JSON.parse(cachedF);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFunds(parsed);
            setHasLoadedFunds(true);
          }
        }
      } catch (_) {}
    }
    fetchColectas();
    fetchFunds();
  }, [activeOrg?.id]);

  // Suscripción WebSocket a eventos de fondos y colectas en vivo
  useEffect(() => {
    if (!activeOrg?.id) return;
    const handleFundsUpdate = () => {
      fetchColectas(true);
      fetchFunds(true);
    };

    const unsubs = [
      eventBus.subscribe('COLECTAS_CHANGED', handleFundsUpdate),
      eventBus.subscribe('FUNDS_CHANGED', handleFundsUpdate),
      eventBus.subscribe('RECONNECTED', handleFundsUpdate),
    ];

    return () => {
      unsubs.forEach(unsub => unsub && unsub());
    };
  }, [activeOrg?.id]);

  const handleRetryAll = async () => {
    setRetrying(true);
    try {
      await Promise.all([fetchColectas(), fetchFunds()]);
    } finally {
      setRetrying(false);
    }
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

  // Cargar configuración de métodos de pago en memoria
  const fetchPaymentConfig = async () => {
    try {
      const cfg = await loadUserPaymentConfig();
      setUserPaymentConfig(cfg || {});
      return cfg;
    } catch (_) {
      return {};
    }
  };

  useEffect(() => {
    fetchPaymentConfig();
  }, [activeOrg?.id]);

  // Abrir Modal de Creación de Colecta con validación obligatoria de métodos de pago
  const handleOpenCreateColectaModal = async () => {
    try {
      const latestConfig = await loadUserPaymentConfig(userPaymentConfig);
      setUserPaymentConfig(latestConfig || {});
      if (!hasConfiguredPaymentMethods(latestConfig)) {
        if (window.confirm('Debes registrar al menos un método de pago antes de proponer una colecta para que los miembros de la mutual puedan transferir los aportes a quien gestionará la compra.\n\n¿Deseas configurar tus datos de pago ahora?')) {
          setShowConfigModal(true);
        }
        return;
      }
      const userAvail = getAvailablePaymentMethods(latestConfig);
      if (userAvail.length === 0) {
        if (window.confirm('No tienes ningún método de pago configurado con datos completos.\n\n¿Deseas configurar tus datos de pago ahora?')) {
          setShowConfigModal(true);
        }
        return;
      }
      setColectaAcceptedMethods(userAvail);
      setShowCreateColectaModal(true);
    } catch (err) {
      console.warn('Error al verificar configuración de pagos para colecta:', err);
      setShowCreateColectaModal(true);
    }
  };

  // Alternar selección de método de pago asegurando que esté debidamente cargado
  const toggleColectaMethod = (m) => {
    const available = getAvailablePaymentMethods(userPaymentConfig);
    const isConfigured = available.includes(m);
    if (!isConfigured) {
      if (window.confirm(`Aún no has configurado tus datos para ${m}.\n\n¿Deseas ir a "⚙️ Mis Datos de Pago" para cargarlos ahora?`)) {
        setShowConfigModal(true);
      }
      return;
    }
    setColectaAcceptedMethods((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  // Crear Colecta
  const handleCreateColecta = async (e) => {
    e.preventDefault();
    if (!titulo.trim() || !proposito.trim() || !montoMeta) {
      alert('Por favor completa el título, propósito y monto meta');
      return;
    }
    const parsed = parseVEAmount(montoMeta);
    if (parsed === null || isNaN(parsed) || parsed <= 0) {
      alert('El monto meta debe ser mayor a 0');
      return;
    }
    if (!colectaAcceptedMethods || colectaAcceptedMethods.length === 0) {
      alert('Debes seleccionar al menos un método de pago que aceptas para la colecta.');
      return;
    }

    const latestConfig = await loadUserPaymentConfig(userPaymentConfig);
    setUserPaymentConfig(latestConfig || {});
    if (!hasConfiguredPaymentMethods(latestConfig)) {
      if (window.confirm('Debes registrar al menos un método de pago antes de proponer una colecta para que los miembros de la mutual puedan transferir los aportes a quien gestionará la compra.\n\n¿Deseas configurarlos ahora?')) {
        setShowConfigModal(true);
      }
      return;
    }

    const available = getAvailablePaymentMethods(latestConfig);
    const validAccepted = (colectaAcceptedMethods || []).filter((m) => available.includes(m));
    if (validAccepted.length === 0) {
      alert('Debes seleccionar al menos un método de pago debidamente configurado.');
      return;
    }

    const filteredDatosPago = {};
    for (const m of validAccepted) {
      if (latestConfig && latestConfig[m]) {
        filteredDatosPago[m] = latestConfig[m];
      }
    }

    setSubmittingColecta(true);
    try {
      const effRate = getEffectiveRate(tipoTasa, tasaFijaValor);
      const metaUsd = colectaCurrency === 'VES' ? Number((parsed / effRate).toFixed(2)) : parsed;
      const metaVes = colectaCurrency === 'VES' ? parsed : Number((parsed * effRate).toFixed(2));

      const payload = {
        titulo: titulo.trim(),
        proposito: proposito.trim(),
        monto_meta_usd: metaUsd,
        monto_meta_ves: metaVes,
        currency: colectaCurrency,
        tipo_tasa: tipoTasa,
        tasa_fija_valor: tipoTasa === 'fija' ? parseFloat(tasaFijaValor) || null : null,
        fecha_pago: fechaPago || formatLocalDate(new Date()),
        hora_pago: horaPago || getDefaultHoraPago(fechaPago),
        fecha_limite_aportes: fechaPago || null,
        beneficiario_nombre: beneficiarioNombre.trim() || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Familia',
        beneficiario_datos_pago: Object.keys(filteredDatosPago).length > 0 ? filteredDatosPago : undefined,
      };
      await colectasApi.createColecta(payload);
      setShowCreateColectaModal(false);
      setTitulo('');
      setProposito('');
      setMontoMeta('');
      setColectaCurrency('USD');
      setBeneficiarioNombre('');
      await fetchColectas();
    } catch (err) {
      alert(err.message || 'Error al proponer la colecta');
    } finally {
      setSubmittingColecta(false);
    }
  };

  // Abrir modal de pago para un compromiso específico
  const openPaymentModalForComp = (colecta, comp) => {
    setTargetColecta(colecta);
    setSelectedCompromiso(comp);
    setPaymentMethod('pago_movil');
    setShowPaymentModal(true);
  };

  // Cancelar Compromiso de Aporte (Socio)
  const handleCancelCommitment = async (colecta, comp) => {
    if (!window.confirm(`¿Seguro que deseas cancelar tu aporte de $${formatVE(comp.monto_usd)} USD?`)) return;
    try {
      await colectasApi.cancelCommitment(colecta.id, comp.id);
      await fetchColectas();
    } catch (err) {
      alert(err.message || 'Error al cancelar aporte');
    }
  };

  // Rechazar Pago (Gestor)
  const handleRejectPayment = async (colectaId, compromisoId) => {
    const motivo = window.prompt('Indica el motivo por el cual no se reconoce este pago (ej: referencia no encontrada, monto incorrecto):');
    if (!motivo) return;
    try {
      await colectasApi.rejectPayment(colectaId, compromisoId, { motivo_rechazo: motivo });
      await fetchColectas();
    } catch (err) {
      alert(err.message || 'Error al rechazar pago');
    }
  };

  // Recordar Pago a Pendientes (Gestor)
  const handleRemindPending = async (colecta) => {
    try {
      await colectasApi.recordarPendientes(colecta.id);
      alert('Se envió un recordatorio de pago a los miembros con aportes pendientes.');
    } catch (err) {
      alert(err.message || 'Error al enviar recordatorio');
    }
  };

  // Validar Aporte Recibido (Gestor)
  const handleValidatePayment = async (colectaId, compromisoId) => {
    if (!window.confirm('¿Confirmas que recibiste el dinero correspondiente a este aporte?')) return;
    try {
      await colectasApi.validatePayment(colectaId, compromisoId);
      alert('¡Aporte validado exitosamente!');
      await fetchColectas();
    } catch (err) {
      alert('Error al validar aporte: ' + (err.message || 'Error desconocido'));
    }
  };

  // Comprometer Aporte
  const handlePledge = async (e) => {
    e.preventDefault();
    if (!targetColecta || !pledgeAmount) return;
    const parsed = parseVEAmount(pledgeAmount);
    if (parsed === null || isNaN(parsed) || parsed <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    setSubmittingPledge(true);
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
      await fetchColectas();
    } catch (err) {
      alert(err.message || 'Error al prometer aporte');
    } finally {
      setSubmittingPledge(false);
    }
  };

  // Notificar Pago
  const handleNotifyPayment = async (e) => {
    e.preventDefault();
    if (!targetColecta) return;
    if (!isPlannedDateReached(targetColecta.fecha_pago) && !isHardCurrencyMethod(paymentMethod)) {
      alert(getEarlyBsPaymentMessage(targetColecta.fecha_pago, 'pay'));
      return;
    }

    const isEfectivoUsd = paymentMethod === 'efectivo' || normalizePaymentMethodKey(paymentMethod) === 'Efectivo USD';
    let refToSave = paymentRef.trim();
    let noteToSave = undefined;

    if (isEfectivoUsd) {
      const cashSummary = formatCashPaymentSummary(cashPayroll, cashSerials, cashDeliveryNote);
      refToSave = refToSave || cashSummary.shortRef;
      noteToSave = cashSummary.fullNote;
    }

    if (!refToSave) {
      alert('Por favor ingresa el número de referencia del pago o desglose en efectivo');
      return;
    }

    setSubmittingPayment(true);
    try {
      const compToPay = selectedCompromiso || targetColecta.mi_compromiso;
      const compromisoId = compToPay?.id;
      if (!compromisoId) {
        throw new Error('No tienes un compromiso registrado en esta colecta.');
      }
      const payload = {
        payment_method: paymentMethod,
        referencia_pago: refToSave,
        comprobante_url: paymentReceiptUrl.trim() || null,
        nota_pago: noteToSave || ((paymentMethod === 'pago_movil' || paymentMethod === 'transferencia') && paymentBankCode
          ? `Banco emisor: ${paymentBankCode}`
          : undefined),
      };
      await colectasApi.confirmPayment(targetColecta.id, compromisoId, payload);
      setShowPaymentModal(false);
      setSelectedCompromiso(null);
      setPaymentRef('');
      setPaymentReceiptUrl('');
      setCashPayroll({});
      setCashSerials('');
      setCashDeliveryNote('');
      setTargetColecta(null);
      await fetchColectas();
      alert('¡Pago notificado exitosamente a la familia!');
    } catch (err) {
      alert(err.message || 'Error al notificar el pago');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Validar Gasto
  const handleValidateExpense = async (e) => {
    e.preventDefault();
    if (!targetColecta || !expenseDesc.trim()) {
      alert('Por favor describe en qué se utilizó el fondo recaudado');
      return;
    }

    setSubmittingExpense(true);
    try {
      await colectasApi.validateExpense(targetColecta.id, {
        descripcion_gasto: expenseDesc.trim(),
        comprobante_gasto_url: expenseReceiptUrl.trim() || null
      });
      setShowExpenseModal(false);
      setExpenseDesc('');
      setExpenseReceiptUrl('');
      setTargetColecta(null);
      await fetchColectas();
      alert('¡Gasto familiar validado y transparentado ante la asamblea!');
    } catch (err) {
      alert(err.message || 'Error al validar el gasto');
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Confirmar Pago Directo (por proponente o beneficiario)
  const handleConfirmDirectPayment = async (colectaId, compromisoId) => {
    if (!window.confirm('¿Confirmas que recibiste el aporte en bolívares para la colecta?')) return;
    try {
      await colectasApi.confirmPayment(colectaId, compromisoId, { estado: 'confirmado' });
      await fetchColectas();
    } catch (err) {
      alert(err.message || 'Error al confirmar el aporte');
    }
  };

  // Cancelar Colecta
  const handleCancelColecta = async (colectaId) => {
    if (!window.confirm('¿Estás seguro de cancelar esta colecta familiar?')) return;
    try {
      await colectasApi.cancelColecta(colectaId);
      await fetchColectas();
    } catch (err) {
      alert(err.message || 'Error al cancelar la colecta');
    }
  };

  // Crear Fondo Común
  const handleCreateFund = async (e) => {
    e.preventDefault();
    if (!newFundName.trim()) {
      alert('El nombre del fondo es requerido');
      return;
    }
    setSubmittingFund(true);
    try {
      await fundsApi.createFund({
        name: newFundName.trim(),
        fund_type: newFundType,
        target_monthly_contribution_usd: newFundTarget ? parseFloat(newFundTarget) : null
      });
      setShowCreateFundModal(false);
      setNewFundName('');
      setNewFundTarget('');
      await fetchFunds();
    } catch (err) {
      alert(err.message || 'Error al crear el fondo');
    } finally {
      setSubmittingFund(false);
    }
  };

  return (
    <div className="glass-panel page-panel animate-fade-in" style={{ padding: '1.25rem 1rem' }}>
      {/* Ticker de Tasas de Cambio en Vivo (homologado con móvil) */}
      {rates?.bcv?.rate && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '10px',
          padding: '8px 14px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.85rem',
          color: '#e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>🇻🇪 <strong>Tasas en Vivo:</strong></span>
            <span><strong>BCV:</strong> Bs {Number(rates.bcv.rate).toFixed(2)}</span>
            {rates?.usdt?.rate && <span style={{ opacity: 0.8 }}>• <strong>USDT:</strong> Bs {Number(rates.usdt.rate).toFixed(2)}</span>}
            {rates?.euro?.rate && <span style={{ opacity: 0.8 }}>• <strong>Euro:</strong> Bs {Number(rates.euro.rate).toFixed(2)}</span>}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>Actualizado hoy</span>
        </div>
      )}

      {/* Cabecera Principal y Segmented Control */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1.25rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
            Fondos Familiares
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Financiamiento solidario y colectas colectivas familiares ("hacer una vaca")
          </p>
        </div>

        {/* Acciones principales */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ⚙️ Datos
          </button>
          <button
            type="button"
            onClick={handleOpenCreateColectaModal}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
            }}
          >
            <Plus size={16} />
            + Colecta
          </button>
        </div>
      </div>

      {/* Control Segmentado de Pestañas: Vigentes / Historial */}
      <div style={{
        display: 'flex',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1.5rem',
      }}>
        <button
          type="button"
          onClick={() => setColectasFilter('active')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: colectasFilter === 'active' ? '#10b981' : 'transparent',
            color: colectasFilter === 'active' ? '#ffffff' : '#94a3b8',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🐮 Vigentes {hasLoadedColectas && activeColectas.length > 0 ? `(${activeColectas.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setColectasFilter('history')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: colectasFilter === 'history' ? '#10b981' : 'transparent',
            color: colectasFilter === 'history' ? '#ffffff' : '#94a3b8',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📜 Historial {hasLoadedColectas && historyColectas.length > 0 ? `(${historyColectas.length})` : ''}
        </button>
      </div>

      {/* Banner de Conexión Offline si aplica */}
      {(isOffline || connectionError) && (
        <OfflineNoticeBanner
          message="Sin conexión de red · Mostrando datos locales de fondos guardados"
          onRetry={handleRetryAll}
        />
      )}

      {/* ========================================================= */}
      {/* PESTAÑA: COLECTAS ("VACAS")                              */}
      {/* ========================================================= */}
      {activeTab === 'colectas' && (
        <div>
          {loadingColectas ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '14rem' }}>
              <div className="loader" />
            </div>
          ) : displayedColectas.length === 0 ? (
            (isOffline || connectionError) ? (
              <OfflineEmptyState
                title="Sin conexión de red"
                message="No se pudieron cargar las colectas familiares. Tus datos están seguros. Por favor reintenta al conectar."
                onRetry={handleRetryAll}
              />
            ) : colectasFilter === 'history' ? (
              <div style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
                background: 'rgba(30, 41, 59, 0.4)',
                borderRadius: '16px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
              }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📜</span>
                <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
                  Sin colectas en el historial
                </h3>
                <p style={{ color: '#94a3b8', maxWidth: '440px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Aquí se archivarán automáticamente las colectas familiares que hayan sido completadas (con gasto validado) o canceladas.
                </p>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
                background: 'rgba(30, 41, 59, 0.4)',
                borderRadius: '16px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
              }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🐮</span>
                <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
                  No hay colectas familiares vigentes
                </h3>
                <p style={{ color: '#94a3b8', maxWidth: '440px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Las colectas ("hacer una vaca") permiten financiar gastos médicos, reparaciones, eventos o emergencias de cualquier familiar mediante aportes solidarios directos.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateColectaModal}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  + Proponer la Primera Colecta
                </button>
              </div>
            )
          ) : (
            <div className="dashboard-grid">
              {displayedColectas.map((item) => {
                const isOwner = user && item.proponente_id === user.id;
                const isBeneficiary = user && (item.beneficiario_id === user.id || item.beneficiario_nombre === `${user.first_name || ''} ${user.last_name || ''}`.trim());
                const isGestor = Boolean(user && (user.id === (item.beneficiario_id || item.proponente_id)));
                const myPledge = item.mi_compromiso;
                const stats = getColectaFinancialStats(item);
                const hasAnyCommitment = Boolean((item.mis_compromisos && item.mis_compromisos.length > 0) || myPledge);
                const hasPendingPayment = Boolean(
                  (myPledge && (myPledge.estado === 'prometido' || myPledge.estado === 'notificado')) ||
                  (item.mis_compromisos && item.mis_compromisos.some(c => c.estado === 'prometido' || c.estado === 'notificado'))
                );
                const canPledgeMore = (item.estado === 'propuesta' || item.estado === 'activa') && stats.restanteUsd > 0;
                const isStalled = isColectaStalled(item, activeOrg);
                const badge = getStatusBadge(item.estado, item);
                const progressPct = Math.min(100, Math.round(item.porcentaje_prometido || item.porcentaje_recaudado || 0));

                return (
                  <div
                    key={item.id}
                    className="glass-card"
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                    }}
                  >
                    {/* Encabezado de la Colecta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', margin: '0 0 0.25rem 0' }}>
                          🐮 {item.titulo}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>
                          Propuesto por <strong style={{ color: '#cbd5e1' }}>{item.proponente_name || item.proponente_nombre || 'Familiar'}</strong>
                        </p>
                      </div>

                      {/* Badge de Estado Homologado */}
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        backgroundColor: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Badge de Tasa de Cambio Prominente */}
                    <div style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      alignSelf: 'flex-start',
                      fontSize: '0.8rem',
                      color: '#cbd5e1',
                    }}>
                      📊 Tasa: <strong style={{ color: '#38bdf8' }}>{item.tasa_label || item.tipo_tasa?.toUpperCase() || 'BCV'}</strong> • Ref: Bs {formatVE(item.tasa_actual || rates?.bcv?.rate || 1)}
                    </div>

                    {/* Propósito */}
                    <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: 0, lineHeight: '1.45' }}>
                      {item.proposito}
                    </p>

                    {/* Responsable de gestión y Fecha de pago */}
                    <div style={{
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      fontSize: '0.82rem',
                      color: '#94a3b8',
                    }}>
                      <div>
                        👤 Gestionado por: <strong style={{ color: '#f1f5f9' }}>{item.beneficiario_nombre || 'Familiar'}</strong>
                      </div>
                      {item.fecha_pago && (
                        <div>
                          📅 Fecha de pago: <strong style={{ color: '#f1f5f9' }}>{item.fecha_pago}{item.hora_pago ? ` (${formatTimeAMPM(item.hora_pago)})` : ''}</strong>
                        </div>
                      )}
                    </div>

                    {/* Barra de Progreso Financiero (Homologada con Android) */}
                    <div style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                      {/* Cabecera del Progreso: Meta y Badge Faltan / Meta alcanzada */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#f8fafc' }}>
                            🎯 Meta: ${formatVE(item.monto_meta_usd)} USD
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                            ~Bs {formatVE(item.monto_meta_bs || (item.monto_meta_usd * (item.tasa_actual || 1)))}
                          </div>
                        </div>

                        <div style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${item.is_active || stats.restanteUsd <= 0 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                          backgroundColor: item.is_active || stats.restanteUsd <= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: item.is_active || stats.restanteUsd <= 0 ? '#4ade80' : '#fbbf24',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.is_active || stats.restanteUsd <= 0
                            ? '🎉 ¡Meta alcanzada!'
                            : `Faltan $${formatVE(stats.restanteUsd)} USD`}
                        </div>
                      </div>

                      {/* Detalle de montos */}
                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
                        <div>📢 Prometido: <strong style={{ color: '#38bdf8' }}>${formatVE(item.monto_prometido_usd || 0)} USD</strong></div>
                        <div>💸 Pagado: <strong style={{ color: '#facc15' }}>${formatVE(item.monto_pagado_usd || 0)} USD</strong></div>
                        <div>✅ Validado: <strong style={{ color: '#4ade80' }}>${formatVE(item.monto_validado_usd || 0)} USD</strong></div>
                      </div>

                      {/* Barra visual de progreso */}
                      <div style={{
                        height: '8px',
                        backgroundColor: '#334155',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '6px',
                      }}>
                        <div style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          backgroundColor: progressPct >= 100 ? '#10b981' : '#3b82f6',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <span>Progreso: {progressPct}%</span>
                        <span>Tasa {item.tipo_tasa?.toUpperCase() || 'BCV'}: Bs. {formatVE(item.tasa_actual || 1)}</span>
                      </div>
                    </div>

                    {/* Resumen de Mi Compromiso si existe (Homologado a Android) */}
                    {myPledge && (() => {
                      const myCfg = getContribStatusConfig(myPledge.estado, isGestor);
                      return (
                        <div style={{
                          borderRadius: '8px',
                          border: `1px solid ${myCfg.border}`,
                          backgroundColor: myCfg.bg,
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: myCfg.border }}>
                              Mi compromiso voluntario:
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                              ${formatVE(myPledge.monto_usd)} USD
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                              ~Bs {formatVE(myPledge.monto_bs || (myPledge.monto_usd * (item.tasa_actual || 1)))}
                            </div>
                          </div>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            backgroundColor: myCfg.badgeBg,
                            color: myCfg.badgeText,
                            whiteSpace: 'nowrap',
                          }}>
                            {myCfg.icon} {myCfg.label}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Rendición de cuentas si aplica */}
                    {item.gasto_validado && (
                      <div style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: '#34d399',
                        fontSize: '0.82rem',
                      }}>
                        <div style={{ fontWeight: '700', marginBottom: '2px' }}>✅ Rendición de cuentas:</div>
                        <div>{item.descripcion_gasto || item.gasto_descripcion || 'Comprobante y soporte presentados ante la familia'}</div>
                        {(item.comprobante_gasto_url || item.gasto_comprobante_url) && (
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptModalUrl(item.comprobante_gasto_url || item.gasto_comprobante_url);
                              setReceiptModalTitle(`Factura / Gasto - ${item.titulo}`);
                            }}
                            style={{
                              marginTop: '8px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#ffffff',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                            }}
                          >
                            🧾 Ver factura / comprobante de gasto
                          </button>
                        )}
                      </div>
                    )}

                    {/* Lista de Aportes en curso (Agrupados por persona con desglose desplegable) */}
                    {(() => {
                      const activeCompromisos = (item.compromisos || []).filter(c => c.estado !== 'cancelado');
                      if (activeCompromisos.length === 0) return null;
                      const isExpanded = !!expandedBreakdown[item.id];
                      const pendingVerifCount = activeCompromisos.filter(c => c.estado === 'pagado').length;
                      const devueltosCount = activeCompromisos.filter(c => c.estado === 'devuelto').length;

                      // Agrupar por persona
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

                      return (
                        <div style={{ marginTop: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedBreakdown(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              color: '#38bdf8',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>Aportes en curso ({groupedBySocio.length} persona{groupedBySocio.length !== 1 ? 's' : ''} · {activeCompromisos.length} aporte{activeCompromisos.length !== 1 ? 's' : ''})</span>
                              {isGestor && pendingVerifCount > 0 && (
                                <span style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#facc15', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                  ⏳ {pendingVerifCount} por validar
                                </span>
                              )}
                              {devueltosCount > 0 && (
                                <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                                  🎉 {devueltosCount} devuelto{devueltosCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </span>
                            <span>{isExpanded ? '▲ Ocultar detalle' : '▼ Ver detalle'}</span>
                          </button>

                          {isExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                              {groupedBySocio.map(group => {
                                const initial = group.socio_name ? group.socio_name.trim()[0].toUpperCase() : '?';
                                return (
                                  <div
                                    key={group.key}
                                    style={{
                                      backgroundColor: 'rgba(15, 23, 42, 0.7)',
                                      borderRadius: '8px',
                                      padding: '10px 12px',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                    }}
                                  >
                                    {/* Cabecera del socio */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                          width: '32px',
                                          height: '32px',
                                          borderRadius: '50%',
                                          backgroundColor: '#3b82f633',
                                          border: '1px solid #3b82f6',
                                          color: '#60a5fa',
                                          display: 'grid',
                                          placeItems: 'center',
                                          fontSize: '0.9rem',
                                          fontWeight: '700',
                                        }}>
                                          {initial}
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#f8fafc' }}>
                                            {group.socio_name}
                                          </div>
                                          <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '600' }}>
                                            ${formatVE(group.total_usd)} USD <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>(~Bs {formatVE(group.total_bs)})</span>
                                          </div>
                                        </div>
                                      </div>

                                      <span style={{
                                        fontSize: '0.72rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                        color: '#94a3b8',
                                      }}>
                                        {group.compromisos.length} {group.compromisos.length === 1 ? 'aporte' : 'aportes'}
                                      </span>
                                    </div>

                                    {/* Sub-aportes del socio */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
                                      {group.compromisos.map((comp, idx) => {
                                        const cs = getContribStatusConfig(comp.estado, isGestor);
                                        const isMyComp = user && comp.socio_id === user.id;

                                        return (
                                          <div
                                            key={comp.id || idx}
                                            style={{
                                              backgroundColor: 'rgba(30, 41, 59, 0.6)',
                                              borderRadius: '6px',
                                              padding: '8px 10px',
                                              borderLeft: `3px solid ${cs.border}`,
                                            }}
                                          >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#f8fafc' }}>
                                                Aporte #{idx + 1}: ${formatVE(comp.monto_usd)} USD
                                              </span>
                                              <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '700',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                backgroundColor: cs.badgeBg,
                                                color: cs.badgeText,
                                              }}>
                                                {cs.icon} {cs.label}
                                              </span>
                                            </div>

                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px' }}>
                                              ~Bs {formatVE(comp.monto_bs || (comp.monto_usd * (item.tasa_actual || 1)))}
                                              {comp.payment_method && ` • ${comp.payment_method}`}
                                              {comp.referencia_pago && ` (Ref: ${comp.referencia_pago})`}
                                            </div>

                                            {comp.comprobante_url && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setReceiptModalUrl(comp.comprobante_url);
                                                  setReceiptModalTitle(`Comprobante de Pago - ${group.socio_name}`);
                                                }}
                                                style={{
                                                  marginTop: '4px',
                                                  background: 'rgba(255, 255, 255, 0.08)',
                                                  border: '1px solid rgba(255, 255, 255, 0.15)',
                                                  borderRadius: '4px',
                                                  padding: '3px 8px',
                                                  color: '#38bdf8',
                                                  fontSize: '0.72rem',
                                                  cursor: 'pointer',
                                                }}
                                              >
                                                🧾 Ver comprobante de pago
                                              </button>
                                            )}

                                            {/* Acciones para el Gestor sobre el aporte */}
                                            {isGestor && comp.estado === 'pagado' && (
                                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleValidatePayment(item.id, comp.id)}
                                                  style={{
                                                    flex: 1,
                                                    padding: '6px',
                                                    backgroundColor: '#10b981',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    color: '#fff',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  ✓ Validar Aporte Recibido
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleRejectPayment(item.id, comp.id)}
                                                  style={{
                                                    padding: '6px 10px',
                                                    backgroundColor: 'transparent',
                                                    border: '1px solid rgba(239, 68, 68, 0.5)',
                                                    borderRadius: '6px',
                                                    color: '#f87171',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  ✕ Rechazar
                                                </button>
                                              </div>
                                            )}

                                            {/* Acciones para el socio sobre su propio aporte pendiente */}
                                            {isMyComp && (comp.estado === 'prometido' || comp.estado === 'notificado') && (item.estado === 'propuesta' || item.estado === 'activa') && (
                                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => openPaymentModalForComp(item, comp)}
                                                  style={{
                                                    flex: 1,
                                                    padding: '6px',
                                                    backgroundColor: '#10b981',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    color: '#fff',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  💵 Pagar este aporte
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleCancelCommitment(item, comp)}
                                                  style={{
                                                    padding: '6px 10px',
                                                    backgroundColor: 'transparent',
                                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                                    borderRadius: '6px',
                                                    color: '#f87171',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  ✕ Cancelar
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Banner de Rescate / Colecta Estancada (Watchdog) - Homologado con Android */}
                    {isStalled && canPledgeMore && (
                      <div style={{
                        backgroundColor: 'rgba(234, 179, 8, 0.10)',
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        borderRadius: '8px',
                        padding: '10px',
                        marginTop: '10px',
                        marginBottom: '4px',
                      }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                          onClick={() => toggleExpandedStalled(item.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1rem' }}>⏳</span>
                            <span style={{ color: '#facc15', fontSize: '0.82rem', fontWeight: '700' }}>
                              Meta aún no alcanzada
                            </span>
                          </div>
                          <div style={{
                            backgroundColor: 'rgba(250, 204, 21, 0.15)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            color: '#facc15',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                          }}>
                            {expandedStalled[item.id] ? 'Ocultar ▲' : 'Ver explicación ▼'}
                          </div>
                        </div>

                        {expandedStalled[item.id] && (
                          <div style={{
                            marginTop: '8px',
                            paddingTop: '6px',
                            borderTop: '1px solid rgba(250, 204, 21, 0.2)',
                            color: '#cbd5e1',
                            fontSize: '0.78rem',
                            lineHeight: '1.4',
                          }}>
                            Faltan ${formatVE(stats.restanteUsd)} USD para completar esta colecta. Cualquier miembro puede colaborar con un monto extra para alcanzar la meta y desbloquear el fondo.
                          </div>
                        )}

                        {!hasPendingPayment && (
                          <button
                            type="button"
                            style={{
                              width: '100%',
                              backgroundColor: '#ca8a04',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              marginTop: '8px',
                            }}
                            onClick={() => {
                              setTargetColecta(item);
                              setShowPledgeModal(true);
                            }}
                          >
                            🤝 Aportar para completar meta
                          </button>
                        )}
                      </div>
                    )}

                    {/* Botonera de Acciones de la Colecta (Homologada con Android) */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      paddingTop: '0.85rem',
                      marginTop: 'auto',
                    }}>
                      {/* PRIORIDAD 1: Si el usuario tiene pago pendiente, la acción principal es Pagar */}
                      {hasPendingPayment && myPledge && (
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            minWidth: '140px',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                          }}
                          onClick={() => openPaymentModalForComp(item, myPledge)}
                        >
                          💵 Pagar (${formatVE(myPledge.monto_usd)} USD)
                        </button>
                      )}

                      {/* Cancelar Mi Aporte (permitido antes de pagado) */}
                      {hasPendingPayment && myPledge && (
                        <button
                          type="button"
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            backgroundColor: 'transparent',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleCancelCommitment(item, myPledge)}
                        >
                          Cancelar aporte
                        </button>
                      )}

                      {/* PRIORIDAD 2: Si el usuario NO tiene compromisos y la colecta está abierta/propuesta */}
                      {!hasAnyCommitment && (item.estado === 'propuesta' || item.estado === 'activa') && (
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            minWidth: '150px',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                          }}
                          onClick={() => {
                            setTargetColecta(item);
                            setShowPledgeModal(true);
                          }}
                        >
                          🤝 Aportar a la Colecta
                        </button>
                      )}

                      {/* PRIORIDAD 3: Si el usuario ya aportó, no tiene pagos pendientes, y la colecta sigue abierta */}
                      {hasAnyCommitment && !hasPendingPayment && canPledgeMore && (
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            minWidth: '150px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            borderRadius: '8px',
                            padding: '9px 12px',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setTargetColecta(item);
                            setShowPledgeModal(true);
                          }}
                        >
                          ➕ Aportar monto adicional
                        </button>
                      )}

                      {/* PRIORIDAD 4: Rendir Cuentas (Beneficiario / Gestor si alcanzó meta o cerrada y no ha rendido) */}
                      {isGestor && (item.estado === 'cerrada' || item.monto_recaudado_usd >= item.monto_meta_usd || stats.restanteUsd <= 0) && !item.gasto_validado && (
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            minWidth: '140px',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            backgroundColor: '#8b5cf6',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '9px 12px',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setTargetColecta(item);
                            setShowExpenseModal(true);
                          }}
                        >
                          ✅ Rendir Cuentas
                        </button>
                      )}

                      {/* PRIORIDAD 5: Cancelar Colecta por Fuerza Mayor (Gestor) */}
                      {isGestor && (item.estado === 'propuesta' || item.estado === 'activa' || item.estado === 'cerrada') && !item.gasto_validado && (
                        <button
                          type="button"
                          style={{
                            fontSize: '0.82rem',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleCancelColecta(item.id)}
                        >
                          ⚠️ Cancelar Colecta
                        </button>
                      )}

                      {/* PRIORIDAD 6: Recordar Pago a Pendientes (Gestor) */}
                      {isGestor && (item.estado === 'activa' || item.estado === 'propuesta') && isPlannedDateReached(item.fecha_pago) && item.compromisos?.some(c => c.estado === 'prometido' || c.estado === 'notificado') && (
                        <button
                          type="button"
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            backgroundColor: 'rgba(234, 179, 8, 0.15)',
                            color: '#facc15',
                            border: '1px solid rgba(234, 179, 8, 0.35)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleRemindPending(item)}
                        >
                          🔔 Recordar Pago
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: PROPONER COLECTA ("VACA")                       */}
      {/* ========================================================= */}
      {showCreateColectaModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
        }} onClick={() => setShowCreateColectaModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '28rem',
            width: '100%',
            color: '#f8fafc',
            maxHeight: '90vh',
            overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>🐮 Proponer Nueva Colecta ("Vaca")</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowCreateColectaModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateColecta} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Título de la Colecta *
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Ej: Medicinas para la abuela / Reparación de bomba de agua"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Propósito / Justificación familiar *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Explica a los familiares el motivo del gasto y cómo se usará el dinero"
                  value={proposito}
                  onChange={(e) => setProposito(e.target.value)}
                  required
                />
              </div>

              {/* Selector Bimoneda */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>
                  Moneda y Monto Meta *
                </label>
                <div style={{
                  display: 'inline-flex',
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  padding: '3px',
                  border: '1px solid #334155',
                  gap: '4px',
                  marginBottom: '10px'
                }}>
                  <button
                    type="button"
                    onClick={() => handleToggleColectaCurrency('USD')}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: colectaCurrency === 'USD' ? 700 : 500,
                      backgroundColor: colectaCurrency === 'USD' ? '#2563eb' : 'transparent',
                      color: colectaCurrency === 'USD' ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    $ USD
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleColectaCurrency('VES')}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: colectaCurrency === 'VES' ? 700 : 500,
                      backgroundColor: colectaCurrency === 'VES' ? '#2563eb' : 'transparent',
                      color: colectaCurrency === 'VES' ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Bs. VES
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      pointerEvents: 'none'
                    }}>
                      {colectaCurrency === 'USD' ? '$' : 'Bs.'}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '10px 10px 10px 2.5rem',
                        borderRadius: '8px',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        color: '#fff',
                        fontWeight: '600'
                      }}
                      placeholder={colectaCurrency === 'USD' ? "Ej: 100,00" : "Ej: 5.500,00"}
                      value={montoMeta}
                      onChange={(e) => setMontoMeta(e.target.value)}
                      onBlur={() => {
                        const p = parseVEAmount(montoMeta);
                        if (p !== null && p > 0) setMontoMeta(formatVE(p));
                      }}
                      required
                    />
                  </div>
                  <div>
                    <select
                      className="form-input"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                      value={tipoTasa}
                      onChange={(e) => setTipoTasa(e.target.value)}
                    >
                      <option value="bcv">Oficial BCV</option>
                      <option value="usdt">USDT Cripto (Binance)</option>
                      <option value="euro">Euro Oficial BCV</option>
                      <option value="fija">Tasa Fija</option>
                    </select>
                  </div>
                </div>

                {/* Live Countervalue Box */}
                {(metaCountervalueBs !== null || metaCountervalueUsd !== null) && (
                  <div style={{
                    marginTop: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      Contravalor estimado:
                    </span>
                    <span style={{ color: '#38bdf8', fontWeight: '700', fontSize: '0.9rem' }}>
                      {colectaCurrency === 'USD'
                        ? formatCurrencyVE(metaCountervalueBs, 'VES')
                        : formatCurrencyVE(metaCountervalueUsd, 'USD')
                      }
                      <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '6px' }}>
                        (Tasa: Bs. {formatVE(effCreateRate)})
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {tipoTasa === 'fija' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                    Valor de Tasa Fija Acordada (Bs/USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    placeholder="Ej: 50.00"
                    value={tasaFijaValor}
                    onChange={(e) => setTasaFijaValor(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Responsable de gestionar la compra o pago
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Nombre de quien gestionará la compra o servicio"
                  value={beneficiarioNombre}
                  onChange={(e) => setBeneficiarioNombre(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                    Fecha de Pago / Liquidación *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    value={fechaPago}
                    onChange={(e) => {
                      setFechaPago(e.target.value);
                      setHoraPago(getDefaultHoraPago(e.target.value));
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                    Hora de Pago ({formatTimeAMPM(horaPago)}) *
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    value={horaPago}
                    onChange={(e) => setHoraPago(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: '600' }}>
                  Métodos de Pago que Aceptas para esta Colecta *
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Pago Móvil', 'Transferencia Bancaria', 'Efectivo USD'].map((m) => {
                    const isConfigured = getAvailablePaymentMethods(userPaymentConfig).includes(m);
                    const isSelected = colectaAcceptedMethods.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleColectaMethod(m)}
                        title={!isConfigured ? `Debes configurar tus datos de ${m} primero` : ''}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: isSelected
                            ? '1.5px solid #10b981'
                            : isConfigured
                              ? '1px solid #145347'
                              : '1px dashed #64748b',
                          backgroundColor: isSelected
                            ? 'rgba(16, 185, 129, 0.22)'
                            : isConfigured
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.35)',
                          color: isSelected
                            ? '#34d399'
                            : isConfigured
                              ? '#e2e8f0'
                              : '#94a3b8',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: isConfigured ? 1 : 0.65,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected ? '✓ ' : isConfigured ? '+ ' : '⚙️ '}
                        {m}
                        {!isConfigured && (
                          <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: '500' }}>
                            (Sin datos)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {colectaAcceptedMethods.length === 0 ? (
                  <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: '6px 0 0 0', fontWeight: '500' }}>
                    ⚠️ Debes seleccionar al menos un método de pago configurado.
                  </p>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '4px' }}>
                    Los aportantes verán tus datos guardados correspondientes a estos métodos para transferirte o coordinar entrega.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateColectaModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    backgroundColor: colectaAcceptedMethods.length === 0 ? '#475569' : '#10b981',
                    border: 'none',
                    cursor: colectaAcceptedMethods.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  disabled={submittingColecta || colectaAcceptedMethods.length === 0}
                >
                  {submittingColecta ? 'Publicando...' : 'Publicar Colecta'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 2: COMPROMETER APORTE                              */}
      {/* ========================================================= */}
      {showPledgeModal && targetColecta && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
        }} onClick={() => setShowPledgeModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '24rem',
            width: '100%',
            color: '#f8fafc',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>🤝 Comprometer Aporte</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowPledgeModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Colecta: <strong>{targetColecta.titulo}</strong>
            </p>

            {/* Resumen financiero de la colecta (Meta, Prometido, Restante y Promedio de aportes) */}
            {(() => {
              const stats = getColectaFinancialStats(targetColecta);
              const statCards = [
                {
                  key: 'meta',
                  label: '🎯 Meta',
                  value: `$${formatVE(stats.metaUsd)} USD`,
                  color: '#f8fafc',
                  sub: `~Bs ${formatVE(targetColecta.monto_meta_bs || (stats.metaUsd * effPledgeRate))}`,
                },
                {
                  key: 'prometido',
                  label: '📢 Monto prometido',
                  value: `$${formatVE(stats.comprometidoUsd)} USD`,
                  color: '#38bdf8',
                  sub: `~Bs ${formatVE(stats.comprometidoUsd * effPledgeRate)}`,
                },
                {
                  key: 'restante',
                  label: '⏳ Restante',
                  value: `$${formatVE(stats.restanteUsd)} USD`,
                  color: stats.restanteUsd > 0 ? '#fbbf24' : '#10b981',
                  sub: stats.restanteUsd > 0
                    ? `~Bs ${formatVE(stats.restanteUsd * effPledgeRate)}`
                    : '¡Meta alcanzada!',
                },
                {
                  key: 'promedio',
                  label: '📊 Promedio de aportes',
                  value: `$${formatVE(stats.promedioUsd)} USD`,
                  color: '#34d399',
                  sub: stats.aportesCount > 0
                    ? `~Bs ${formatVE(stats.promedioUsd * effPledgeRate)} (${stats.aportesCount} aporte${stats.aportesCount !== 1 ? 's' : ''})`
                    : 'Sin aportes aún',
                },
              ];
              return (
                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  borderRadius: '10px',
                  padding: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  marginBottom: '1rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '8px',
                }}>
                  {statCards.map((cell) => (
                    <div key={cell.key} style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.55)',
                      borderRadius: '8px',
                      padding: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600', marginBottom: '2px' }}>
                        {cell.label}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: cell.color }}>
                        {cell.value}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                        {cell.sub}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <form onSubmit={handlePledge} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>
                  Moneda y Monto a Aportar *
                </label>
                <div style={{
                  display: 'inline-flex',
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  padding: '3px',
                  border: '1px solid #334155',
                  gap: '4px',
                  marginBottom: '10px'
                }}>
                  <button
                    type="button"
                    onClick={() => handleTogglePledgeCurrency('USD')}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: pledgeCurrency === 'USD' ? 700 : 500,
                      backgroundColor: pledgeCurrency === 'USD' ? '#2563eb' : 'transparent',
                      color: pledgeCurrency === 'USD' ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    $ USD
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePledgeCurrency('VES')}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: pledgeCurrency === 'VES' ? 700 : 500,
                      backgroundColor: pledgeCurrency === 'VES' ? '#2563eb' : 'transparent',
                      color: pledgeCurrency === 'VES' ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Bs. VES
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    fontWeight: '700',
                    fontSize: '1rem',
                    pointerEvents: 'none'
                  }}>
                    {pledgeCurrency === 'USD' ? '$' : 'Bs.'}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '10px 10px 10px 2.6rem',
                      borderRadius: '8px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '1.25rem',
                      fontWeight: 'bold'
                    }}
                    placeholder={pledgeCurrency === 'USD' ? "Ej: 10,00" : "Ej: 550,00"}
                    value={pledgeAmount}
                    onChange={(e) => setPledgeAmount(e.target.value)}
                    onBlur={() => {
                      const p = parseVEAmount(pledgeAmount);
                      if (p !== null && p > 0) setPledgeAmount(formatVE(p));
                    }}
                    required
                    autoFocus
                  />
                </div>

                {(pledgeCountervalueBs !== null || pledgeCountervalueUsd !== null) && (
                  <div style={{
                    marginTop: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      Contravalor:
                    </span>
                    <span style={{ color: '#10b981', fontWeight: '700', fontSize: '0.9rem' }}>
                      {pledgeCurrency === 'USD'
                        ? formatCurrencyVE(pledgeCountervalueBs, 'VES')
                        : formatCurrencyVE(pledgeCountervalueUsd, 'USD')
                      }
                      <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '6px' }}>
                        (Tasa: Bs. {formatVE(effPledgeRate)})
                      </span>
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPledgeModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#10b981', border: 'none' }}
                  disabled={submittingPledge}
                >
                  {submittingPledge ? 'Guardando...' : 'Confirmar Compromiso'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 3: NOTIFICAR PAGO EN BOLÍVARES                     */}
      {/* ========================================================= */}
      {showPaymentModal && targetColecta && (() => {
        const compToPay = selectedCompromiso || targetColecta.mi_compromiso;
        const compMontoUsd = compToPay?.monto_usd || 0;
        const compMontoBs = compToPay?.monto_bs || (compMontoUsd * (targetColecta.tasa_actual || 1));
        const formattedBs = formatVE(compMontoBs);

        return createPortal(
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '1rem',
          }} onClick={() => {
            setSelectedCompromiso(null);
            setShowPaymentModal(false);
          }}>
            <div style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '26rem',
              width: '100%',
              color: '#f8fafc',
              maxHeight: '90vh',
              overflowY: 'auto',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>🔔 Notificar Pago de Colecta</h3>
                <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => {
                  setSelectedCompromiso(null);
                  setShowPaymentModal(false);
                }}>
                  <X size={20} />
                </button>
              </div>

              {/* Resumen del compromiso */}
              <div style={{
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '1rem',
                border: '1px solid #334155'
              }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Monto a Transferir / Pagar:</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: 'bold', color: '#10b981' }}>
                  Bs. {formattedBs}
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginLeft: '8px' }}>
                    (${formatVE(compMontoUsd)} USD)
                  </span>
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Tasa aplicada ({targetColecta.tipo_tasa?.toUpperCase() || 'BCV'}): Bs. {formatVE(targetColecta.tasa_actual || 1)}
                </p>
              </div>

            <form onSubmit={handleNotifyPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Método de Pago
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="pago_movil">Pago Móvil (Bs)</option>
                  <option value="transferencia">Transferencia Bancaria (Bs)</option>
                  <option value="efectivo">Efectivo USD (Divisas)</option>
                  <option value="binance">Binance Pay (USDT)</option>
                  <option value="zelle">Zelle (USD)</option>
                </select>
              </div>

              {!isPlannedDateReached(targetColecta.fecha_pago) && (
                isHardCurrencyMethod(paymentMethod) ? (
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.8rem',
                    color: '#34d399',
                    lineHeight: '1.4',
                  }}>
                    ✅ Moneda dura habilitada: Puedes registrar y validar aportes en USD en efectivo, USDT o Zelle antes de la fecha de liquidación ({targetColecta.fecha_pago}).
                  </div>
                ) : (
                  <div style={{ margin: '8px 0' }}>
                    <button
                      type="button"
                      onClick={() => setShowEarlyBsNotice(!showEarlyBsNotice)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontSize: '0.8rem',
                        color: '#fbbf24',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⏳ Pago en Bs: disponible desde el {targetColecta.fecha_pago}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                        {showEarlyBsNotice ? 'Ocultar ▲' : 'Ver info ▼'}
                      </span>
                    </button>
                    {showEarlyBsNotice && (
                      <div style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.06)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        marginTop: '4px',
                        fontSize: '0.75rem',
                        color: '#fde68a',
                        lineHeight: '1.4',
                      }}>
                        {getEarlyBsPaymentMessage(targetColecta.fecha_pago, 'pay')}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Tarjeta de Coordinación de Efectivo USD */}
              {(paymentMethod === 'efectivo' || normalizePaymentMethodKey(paymentMethod) === 'Efectivo USD') && (
                <div>
                  <CashDeliveryCard
                    data={targetColecta.beneficiario_datos_pago?.['Efectivo USD'] || targetColecta.beneficiario_datos_pago?.efectivo}
                    montoUsd={compMontoUsd}
                    recipientName={targetColecta.beneficiario_nombre}
                  />

                  <CashPayrollInput
                    targetAmount={compMontoUsd || 0}
                    payroll={cashPayroll}
                    onPayrollChange={setCashPayroll}
                    serials={cashSerials}
                    onSerialsChange={setCashSerials}
                    deliveryNote={cashDeliveryNote}
                    onDeliveryNoteChange={setCashDeliveryNote}
                  />
                </div>
              )}

              {/* Tarjeta de Datos de Transferencia Bancaria */}
              {(paymentMethod === 'transferencia' || normalizePaymentMethodKey(paymentMethod) === 'Transferencia Bancaria') && (
                <BankTransferCard
                  data={targetColecta.beneficiario_datos_pago?.['Transferencia Bancaria'] || targetColecta.beneficiario_datos_pago?.transferencia}
                  montoBs={formattedBs}
                  recipientName={targetColecta.beneficiario_nombre}
                  tasaLabel={`${targetColecta.tipo_tasa?.toUpperCase() || 'BCV'}: Bs. ${formatVE(targetColecta.tasa_actual || 1)}`}
                />
              )}

              {/* Tarjeta de Datos de Pago Móvil */}
              {(paymentMethod === 'pago_movil' || normalizePaymentMethodKey(paymentMethod) === 'Pago Móvil') && (() => {
                const pmData = targetColecta.beneficiario_datos_pago?.['Pago Móvil'] || targetColecta.beneficiario_datos_pago?.pago_movil;
                if (!pmData || (!pmData.cedula && !pmData.telefono)) return null;
                const safeBanco = getBankLabel(pmData.banco);
                const docPrefix = pmData.tipo_doc ? (pmData.tipo_doc === 'Persona' ? 'V' : pmData.tipo_doc[0]) : 'V';
                const cleanCedula = pmData.cedula ? String(pmData.cedula).replace(/^[VJEGC]-?/i, '') : '';
                const safeDoc = cleanCedula ? `${docPrefix}-${cleanCedula}` : '';
                const montoBs = formattedBs;
                const copyAllText = `Banco: ${safeBanco} | Documento: ${safeDoc} | Teléfono: ${pmData.telefono || ''} | Monto: ${montoBs} Bs`;

                return (
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: '700' }}>
                      Datos de Pago Móvil de {targetColecta.beneficiario_nombre}:
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Banco</div>
                        <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>{safeBanco}</div>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(pmData.banco || safeBanco)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                        Copiar
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Cédula / Documento</div>
                        <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>{safeDoc}</div>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(safeDoc)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                        Copiar
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Teléfono</div>
                        <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>{pmData.telefono}</div>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(pmData.telefono || '')} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                        Copiar
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(copyAllText)}
                      style={{
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        marginTop: '0.25rem',
                        textAlign: 'center'
                      }}
                    >
                      📋 Copiar todo para el banco
                    </button>
                  </div>
                );
              })()}

              {(paymentMethod === 'pago_movil' || paymentMethod === 'transferencia') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                    Banco Emisor (Venezuela)
                  </label>
                  <select
                    className="form-input"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    value={paymentBankCode}
                    onChange={(e) => setPaymentBankCode(e.target.value)}
                  >
                    {VENEZUELAN_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentMethod !== 'efectivo' && normalizePaymentMethodKey(paymentMethod) !== 'Efectivo USD' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                    Número de Referencia Bancaria *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                    placeholder="Ej: 987654 (últimos 6 dígitos)"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Enlace o URL del Comprobante (Opcional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="https://... o referencia de captura"
                  value={paymentReceiptUrl}
                  onChange={(e) => setPaymentReceiptUrl(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedCompromiso(null);
                    setShowPaymentModal(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    backgroundColor: !isPlannedDateReached(targetColecta.fecha_pago) && !isHardCurrencyMethod(paymentMethod) ? '#b45309' : '#2563eb',
                    border: 'none',
                  }}
                  disabled={submittingPayment}
                >
                  {submittingPayment ? 'Enviando...' : 'Notificar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      );
    })()}

      {/* ========================================================= */}
      {/* MODAL 4: VALIDAR GASTO FAMILIAR                          */}
      {/* ========================================================= */}
      {showExpenseModal && targetColecta && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
        }} onClick={() => setShowExpenseModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '26rem',
            width: '100%',
            color: '#f8fafc',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>📋 Rendición de Cuentas del Gasto</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowExpenseModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Para cerrar el ciclo de transparencia, registra los detalles y soporte de la compra realizada para: <strong>{targetColecta.titulo}</strong>.
            </p>

            <form onSubmit={handleValidateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Detalle del Gasto Realizado *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Ej: Se adquirieron 3 cajas de medicamentos según récipe médico y factura N° 1245."
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  URL o Enlace de la Factura/Comprobante
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="https://... o número de factura fiscal"
                  value={expenseReceiptUrl}
                  onChange={(e) => setExpenseReceiptUrl(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowExpenseModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#8b5cf6', border: 'none' }}
                  disabled={submittingExpense}
                >
                  {submittingExpense ? 'Rindiendo cuentas...' : 'Rendir Cuentas y Completar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 5: VISOR DE COMPROBANTES DE PAGO / FACTURAS        */}
      {/* ========================================================= */}
      {receiptModalUrl && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 999999,
          padding: '1rem',
        }} onClick={() => setReceiptModalUrl(null)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '1.25rem',
            maxWidth: '32rem',
            width: '100%',
            color: '#f8fafc',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                {receiptModalTitle || 'Comprobante'}
              </h3>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setReceiptModalUrl(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              borderRadius: '8px',
              backgroundColor: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              maxHeight: '65vh',
            }}>
              <img
                src={receiptModalUrl}
                alt="Comprobante"
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                <p>No se pudo previsualizar la imagen.</p>
                <a href={receiptModalUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>
                  Abrir enlace en nueva pestaña
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Configuración de Datos de Pago */}
      <PaymentConfigModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSuccess={(cfg) => {
          setUserPaymentConfig(cfg);
          const avail = getAvailablePaymentMethods(cfg);
          setColectaAcceptedMethods(avail);
        }}
        initialConfig={userPaymentConfig}
      />
    </div>
  );
}
