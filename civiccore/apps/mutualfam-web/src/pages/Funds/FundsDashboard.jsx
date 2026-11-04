import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fundsApi, colectasApi, loansApi, useAuthStore } from '@civiccore/sdk';
import { Plus, X, AlertCircle, CheckCircle, Clock, ChevronRight, DollarSign, Wallet, ShieldCheck, FileText, Check, AlertTriangle } from 'lucide-react';
import { OfflineEmptyState, OfflineNoticeBanner } from '../../components/Common/OfflineEmptyState.jsx';
import { VENEZUELAN_BANKS, getBankLabel } from '../../utils/banks.js';
import { parseVEAmount, formatVE, formatCurrencyVE } from '../../utils/currency.js';

export default function FundsDashboard() {
  const { activeOrg, user, isOffline } = useAuthStore();
  const [activeTab, setActiveTab] = useState('colectas'); // 'colectas' | 'periodicos'
  const [connectionError, setConnectionError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Colectas state
  const [colectas, setColectas] = useState([]);
  const [rates, setRates] = useState({});
  const [loadingColectas, setLoadingColectas] = useState(true);

  // Fondos comunes state
  const [funds, setFunds] = useState([]);
  const [loadingFunds, setLoadingFunds] = useState(true);

  // Modales
  const [showCreateColectaModal, setShowCreateColectaModal] = useState(false);
  const [showCreateFundModal, setShowCreateFundModal] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [targetColecta, setTargetColecta] = useState(null);

  // Form: Proponer Colecta
  const [titulo, setTitulo] = useState('');
  const [proposito, setProposito] = useState('');
  const [montoMeta, setMontoMeta] = useState('');
  const [colectaCurrency, setColectaCurrency] = useState('USD'); // 'USD' | 'VES'
  const [tipoTasa, setTipoTasa] = useState('bcv');
  const [tasaFijaValor, setTasaFijaValor] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [beneficiarioNombre, setBeneficiarioNombre] = useState('');
  const [submittingColecta, setSubmittingColecta] = useState(false);

  // Form: Comprometer Aporte
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeCurrency, setPledgeCurrency] = useState('USD'); // 'USD' | 'VES'
  const [submittingPledge, setSubmittingPledge] = useState(false);

  // Form: Notificar Pago
  const [paymentMethod, setPaymentMethod] = useState('pago_movil');
  const [paymentBankCode, setPaymentBankCode] = useState('0102');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

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
  const fetchColectas = async () => {
    if (!activeOrg?.id) {
      setColectas([]);
      setLoadingColectas(false);
      return;
    }
    try {
      setLoadingColectas(true);
      setConnectionError(false);
      const [data, ratesData] = await Promise.all([
        colectasApi.getColectas(),
        colectasApi.getRates().catch(() => ({}))
      ]);
      const list = Array.isArray(data) ? data : [];
      setColectas(list);
      setRates(ratesData || {});
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
      setLoadingColectas(false);
    }
  };

  // Cargar Fondos Comunes
  const fetchFunds = async () => {
    if (!activeOrg?.id) {
      setFunds([]);
      setLoadingFunds(false);
      return;
    }
    try {
      setLoadingFunds(true);
      setConnectionError(false);
      const data = await fundsApi.getFunds();
      const list = Array.isArray(data) ? data : [];
      setFunds(list);
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
      setLoadingFunds(false);
    }
  };

  useEffect(() => {
    fetchColectas();
    fetchFunds();
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
        fecha_pago: fechaPago || new Date().toISOString().split('T')[0],
        fecha_limite_aportes: fechaPago || null,
        beneficiario_nombre: beneficiarioNombre.trim() || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Familia'
      };
      await colectasApi.createColecta(payload);
      setShowCreateColectaModal(false);
      setTitulo('');
      setProposito('');
      setMontoMeta('');
      setColectaCurrency('USD');
      setFechaPago('');
      setBeneficiarioNombre('');
      await fetchColectas();
    } catch (err) {
      alert(err.message || 'Error al proponer la colecta');
    } finally {
      setSubmittingColecta(false);
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
    if (!paymentRef.trim()) {
      alert('Por favor ingresa el número de referencia bancaria');
      return;
    }

    setSubmittingPayment(true);
    try {
      const compromisoId = targetColecta.mi_compromiso?.id;
      if (!compromisoId) {
        throw new Error('No tienes un compromiso registrado en esta colecta.');
      }
      const payload = {
        metodo_pago: paymentMethod,
        codigo_banco: paymentBankCode,
        referencia: paymentRef.trim(),
        comprobante_url: paymentReceiptUrl.trim() || null
      };
      await colectasApi.confirmPayment(targetColecta.id, compromisoId, payload);
      setShowPaymentModal(false);
      setPaymentRef('');
      setPaymentReceiptUrl('');
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
            Financiamiento solidario, colectas colectivas y fondos de reserva
          </p>
        </div>

        {/* Acciones principales */}
        <div>
          {activeTab === 'colectas' ? (
            <button
              type="button"
              onClick={() => setShowCreateColectaModal(true)}
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
              + Proponer Colecta
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateFundModal(true)}
              style={{
                backgroundColor: '#2563eb',
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
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              }}
            >
              <Plus size={16} />
              + Crear Fondo
            </button>
          )}
        </div>
      </div>

      {/* Control Segmentado de Pestañas (Homologado con Móvil) */}
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
          onClick={() => setActiveTab('colectas')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'colectas' ? '#10b981' : 'transparent',
            color: activeTab === 'colectas' ? '#ffffff' : '#94a3b8',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🐮 Colectas (Vacas) {colectas.length > 0 ? `(${colectas.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('periodicos')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'periodicos' ? '#2563eb' : 'transparent',
            color: activeTab === 'periodicos' ? '#ffffff' : '#94a3b8',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🏛️ Fondos Comunes ({funds.length})
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
      {/* PESTAÑA 1: COLECTAS ("VACAS")                            */}
      {/* ========================================================= */}
      {activeTab === 'colectas' && (
        <div>
          {loadingColectas ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '14rem' }}>
              <div className="loader" />
            </div>
          ) : colectas.length === 0 ? (
            (isOffline || connectionError) ? (
              <OfflineEmptyState
                title="Sin conexión de red"
                message="No se pudieron cargar las colectas familiares. Tus datos están seguros. Por favor reintenta al conectar."
                onRetry={handleRetryAll}
              />
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
                  No hay colectas familiares activas
                </h3>
                <p style={{ color: '#94a3b8', maxWidth: '440px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Las colectas ("hacer una vaca") permiten financiar gastos médicos, reparaciones, eventos o emergencias de cualquier familiar mediante aportes solidarios directos.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateColectaModal(true)}
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
              {colectas.map((item) => {
                const isOwner = user && item.proponente_id === user.id;
                const isBeneficiary = user && (item.beneficiario_id === user.id || item.beneficiario_nombre === `${user.first_name || ''} ${user.last_name || ''}`.trim());
                const myPledge = item.mi_compromiso;
                const progressPct = Math.min(100, Math.round(item.porcentaje_recaudado || 0));

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
                      gap: '1rem',
                    }}
                  >
                    {/* Encabezado de la Colecta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', margin: '0 0 0.25rem 0' }}>
                          🐮 {item.titulo}
                        </h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                          Para: <strong style={{ color: '#f1f5f9' }}>{item.beneficiario_nombre || 'Familiar'}</strong> • Propuesto por: {item.proponente_nombre || 'Familiar'}
                        </p>
                      </div>

                      {/* Pill de Estado */}
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        backgroundColor: item.estado === 'abierta' ? 'rgba(16, 185, 129, 0.2)' : item.estado === 'cerrada' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: item.estado === 'abierta' ? '#34d399' : item.estado === 'cerrada' ? '#60a5fa' : '#f87171',
                        border: `1px solid ${item.estado === 'abierta' ? 'rgba(16, 185, 129, 0.3)' : item.estado === 'cerrada' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      }}>
                        {item.estado}
                      </span>
                    </div>

                    <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: 0, lineHeight: '1.4' }}>
                      {item.proposito}
                    </p>

                    {/* Barra de Progreso y Montos Duales */}
                    <div style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Recaudación Familiar</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: '800' }}>
                            ${formatVE(item.monto_recaudado_usd || 0)} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/ ${formatVE(item.monto_meta_usd)} USD</span>
                          </span>
                          <span style={{ display: 'block', fontSize: '0.78rem', color: '#38bdf8', fontWeight: '600' }}>
                            Bs. {formatVE(item.monto_recaudado_bs || ((item.monto_recaudado_usd || 0) * (item.tasa_actual || 1)))} / Bs. {formatVE(item.monto_meta_bs || (item.monto_meta_usd * (item.tasa_actual || 1)))}
                          </span>
                        </div>
                      </div>

                      {/* Barra visual */}
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#334155',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '8px',
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
                        <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '6px', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                          Tasa {item.tipo_tasa?.toUpperCase()}: Bs. {formatVE(item.tasa_actual || rates?.bcv?.rate || 1)}
                        </span>
                      </div>
                    </div>

                    {/* Badge de Gasto Validado si aplica */}
                    {item.gasto_validado ? (
                      <div style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.8rem',
                        color: '#34d399',
                      }}>
                        <ShieldCheck size={16} />
                        <span><strong>Gasto Familiar Validado:</strong> {item.gasto_descripcion || 'Comprobante y factura presentados ante la familia'}</span>
                      </div>
                    ) : item.estado === 'cerrada' || progressPct >= 100 ? (
                      <div style={{
                        backgroundColor: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.8rem',
                        color: '#facc15',
                      }}>
                        <Clock size={16} />
                        <span>Meta alcanzada · Pendiente de validación de compra/factura</span>
                      </div>
                    ) : null}

                    {/* Resumen de Mi Compromiso si existe */}
                    {myPledge && (
                      <div style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                      }}>
                        <div>
                          <span style={{ color: '#93c5fd', fontWeight: '600' }}>Tu Aporte: </span>
                          <span style={{ color: '#ffffff', fontWeight: '700' }}>${formatVE(myPledge.monto_usd)} USD</span>
                          <span style={{ color: '#38bdf8', fontSize: '0.8rem', display: 'block', fontWeight: '600' }}>
                            • Bs. {formatVE(myPledge.monto_bs || (myPledge.monto_usd * (item.tasa_actual || 1)))}
                          </span>
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          backgroundColor: myPledge.estado === 'confirmado' ? '#10b981' : myPledge.estado === 'pagado' ? '#eab308' : '#64748b',
                          color: '#ffffff',
                        }}>
                          {myPledge.estado === 'confirmado' ? 'Confirmado' : myPledge.estado === 'pagado' ? 'En Revisión' : 'Por Pagar'}
                        </span>
                      </div>
                    )}

                    {/* Botonera de Acciones de la Colecta */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      paddingTop: '0.75rem',
                      marginTop: 'auto',
                    }}>
                      {/* Comprometer Aporte */}
                      {!myPledge && item.estado === 'abierta' && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ flex: 1, minWidth: '130px', fontSize: '0.85rem', backgroundColor: '#10b981', border: 'none' }}
                          onClick={() => {
                            setTargetColecta(item);
                            setShowPledgeModal(true);
                          }}
                        >
                          🤝 Aportar a la Vaca
                        </button>
                      )}

                      {/* Notificar Pago */}
                      {myPledge && myPledge.estado === 'prometido' && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ flex: 1, minWidth: '130px', fontSize: '0.85rem', backgroundColor: '#2563eb', color: '#fff', border: 'none' }}
                          onClick={() => {
                            setTargetColecta(item);
                            setShowPaymentModal(true);
                          }}
                        >
                          🔔 Notificar Pago Bs
                        </button>
                      )}

                      {/* Validar Gasto (Beneficiario / Proponente) */}
                      {(isOwner || isBeneficiary) && (item.estado === 'cerrada' || progressPct >= 100) && !item.gasto_validado && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ flex: 1, minWidth: '130px', fontSize: '0.85rem', backgroundColor: '#8b5cf6', color: '#fff', border: 'none' }}
                          onClick={() => {
                            setTargetColecta(item);
                            setShowExpenseModal(true);
                          }}
                        >
                          🧾 Validar Factura/Gasto
                        </button>
                      )}

                      {/* Cancelar (solo si nadie ha pagado y es el creador) */}
                      {isOwner && item.monto_recaudado_usd === 0 && item.estado === 'abierta' && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.85rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          onClick={() => handleCancelColecta(item.id)}
                        >
                          Cancelar
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
      {/* PESTAÑA 2: FONDOS COMUNES PERIÓDICOS                     */}
      {/* ========================================================= */}
      {activeTab === 'periodicos' && (
        <div>
          {loadingFunds ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '14rem' }}>
              <div className="loader" />
            </div>
          ) : funds.length === 0 ? (
            (isOffline || connectionError) ? (
              <OfflineEmptyState
                title="Sin conexión de red"
                message="No se pudieron cargar los fondos comunes. Tus datos están seguros."
                onRetry={handleRetryAll}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
                No hay fondos comunes creados
              </div>
            )
          ) : (
            <div className="dashboard-grid">
              {funds.map((fund) => (
                <div
                  key={fund.id}
                  className="glass-card"
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', margin: '0 0 0.35rem 0' }}>
                      {fund.name}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                      {fund.fund_type === 'emergency' ? '🚨 Fondo de Emergencia' : '💰 Ahorro Familiar'}
                    </p>

                    {fund.target_monthly_contribution_usd && (
                      <div style={{
                        marginTop: '1rem',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>
                          Aporte mensual sugerido
                        </p>
                        <p style={{ color: '#38bdf8', fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>
                          ${fund.target_monthly_contribution_usd} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>USD</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, fontSize: '0.85rem' }}
                      onClick={() => alert("Próximamente: Aportes periódicos continuos")}
                    >
                      Aportar al Fondo
                    </button>
                  </div>
                </div>
              ))}
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
                  Familiar Beneficiario (quien recibe los aportes)
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Nombre de la persona beneficiaria"
                  value={beneficiarioNombre}
                  onChange={(e) => setBeneficiarioNombre(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Fecha Límite Opcional
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                />
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
                  style={{ backgroundColor: '#10b981', border: 'none' }}
                  disabled={submittingColecta}
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

            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Colecta: <strong>{targetColecta.titulo}</strong>
            </p>

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
      {showPaymentModal && targetColecta && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
        }} onClick={() => setShowPaymentModal(false)}>
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
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowPaymentModal(false)}>
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
                Bs. {formatVE(targetColecta.mi_compromiso?.monto_bs || ((targetColecta.mi_compromiso?.monto_usd || 0) * (targetColecta.tasa_actual || 1)))}
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginLeft: '8px' }}>
                  (${formatVE(targetColecta.mi_compromiso?.monto_usd)} USD)
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
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo">Efectivo Divisas</option>
                  <option value="zelle">Zelle</option>
                  <option value="binance">Binance Pay</option>
                </select>
              </div>

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
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#2563eb', border: 'none' }}
                  disabled={submittingPayment}
                >
                  {submittingPayment ? 'Enviando...' : 'Notificar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

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
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>🧾 Validar Gasto Familiar</h3>
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
                  {submittingExpense ? 'Validando...' : 'Certificar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 5: CREAR FONDO COMÚN PERIÓDICO                     */}
      {/* ========================================================= */}
      {showCreateFundModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '1rem',
        }} onClick={() => setShowCreateFundModal(false)}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '24rem',
            width: '100%',
            color: '#f8fafc',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>🏛️ Crear Fondo Común</h3>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowCreateFundModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFund} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Nombre del Fondo *
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="Ej: Fondo de Salud Familiar"
                  value={newFundName}
                  onChange={(e) => setNewFundName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Tipo de Fondo
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  value={newFundType}
                  onChange={(e) => setNewFundType(e.target.value)}
                >
                  <option value="emergency">🚨 Fondo de Emergencia</option>
                  <option value="savings">💰 Ahorro Familiar</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Aporte Mensual Sugerido (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                  placeholder="10.00"
                  value={newFundTarget}
                  onChange={(e) => setNewFundTarget(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateFundModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#2563eb', border: 'none' }}
                  disabled={submittingFund}
                >
                  {submittingFund ? 'Creando...' : 'Crear Fondo'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
