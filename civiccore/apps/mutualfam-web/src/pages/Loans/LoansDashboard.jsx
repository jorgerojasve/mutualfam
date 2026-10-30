import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { loansApi, useAuthStore } from '@civiccore/sdk';
import { X, Check, Copy } from 'lucide-react';
import { VENEZUELAN_BANKS, getBankLabel } from '../../utils/banks.js';
import { formatVE, parseVEAmount } from '../../utils/currency.js';

export default function LoansDashboard() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountBs, setAmountBs] = useState('');
  const [motive, setMotive] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');

  // Estados homologados con Android (Tasa BCV, Filtro Vigentes/Historial, Datos de Pago)
  const [bcvRate, setBcvRate] = useState(null);
  const [filter, setFilter] = useState('active'); // 'active' | 'history'
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({});
  const [savingPayment, setSavingPayment] = useState(false);
  const [pagoMovilBanco, setPagoMovilBanco] = useState('');
  const [pagoMovilCedula, setPagoMovilCedula] = useState('');
  const [pagoMovilTelefono, setPagoMovilTelefono] = useState('');
  const [zelleEmail, setZelleEmail] = useState('');

  // Estados para prometer aporte (Web / iPhone)
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledging, setPledging] = useState(false);

  // Estados para Notificar Pago (Homologado con Android)
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [selectedContrib, setSelectedContrib] = useState(null);
  const [notifyMethod, setNotifyMethod] = useState('Pago Móvil');
  const [referenceText, setReferenceText] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);

  // Estados para Devolver Préstamo (Repay)
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedRepayContrib, setSelectedRepayContrib] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('Pago Móvil');
  const [repayReference, setRepayReference] = useState('');
  const [repayReceiptFile, setRepayReceiptFile] = useState(null);
  const [repayReceiptPreview, setRepayReceiptPreview] = useState(null);
  const [repaying, setRepaying] = useState(false);

  // Estados para Visor de Comprobantes
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const { user, activeOrg } = useAuthStore();

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await loansApi.getLoans();
      setLoans(data);
    } catch (err) {
      setError(err.message || 'Error al cargar los préstamos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentConfig = async () => {
    try {
      const res = await loansApi.getPaymentMethods();
      const parsed = JSON.parse(res.payment_methods_json || '{}');
      setPaymentConfig(parsed);
      if (parsed['Pago Móvil']) {
        setPagoMovilBanco(parsed['Pago Móvil'].banco || '');
        setPagoMovilCedula(parsed['Pago Móvil'].cedula || '');
        setPagoMovilTelefono(parsed['Pago Móvil'].telefono || '');
      }
      if (parsed['Zelle']) {
        setZelleEmail(parsed['Zelle'].email || '');
      }
      return parsed;
    } catch (_) {
      return {};
    }
  };

  const hasConfiguredPaymentMethods = (config = paymentConfig) => {
    if (!config || typeof config !== 'object') return false;
    return Object.entries(config).some(([method, val]) => {
      if (method === 'Pago Móvil') {
        return val && typeof val === 'object' && Boolean(val.banco) && Boolean(val.cedula) && Boolean(val.telefono);
      }
      return typeof val === 'string' && val.trim().length > 0;
    });
  };

  useEffect(() => {
    if (activeOrg?.id) {
      fetchLoans();
      fetchPaymentConfig();
    } else {
      setLoans([]);
      setLoading(false);
    }
  }, [activeOrg?.id]);

  useEffect(() => {
    const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://mutualfam-backend.fly.dev/api/v1')
      .toString().trim().replace(/[\r\n\t]/g, '').replace(/\/+$/, '');
    fetch(`${rawApiUrl}/config/`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.bcv_rate) setBcvRate(data.bcv_rate);
      })
      .catch(() => {});
  }, []);

  const handleAmountUsdChange = (val) => {
    setAmount(val);
    if (!val || val.trim() === '') {
      setAmountBs('');
      return;
    }
    const parsed = parseVEAmount(val);
    if (parsed !== null && !isNaN(parsed) && bcvRate && bcvRate > 0) {
      const calculatedBs = parsed * bcvRate;
      setAmountBs(formatVE(calculatedBs));
    } else {
      setAmountBs('');
    }
  };

  const handleAmountBsChange = (val) => {
    setAmountBs(val);
    if (!val || val.trim() === '') {
      setAmount('');
      return;
    }
    const parsed = parseVEAmount(val);
    if (parsed !== null && !isNaN(parsed) && bcvRate && bcvRate > 0) {
      const calculatedUsd = parsed / bcvRate;
      setAmount(formatVE(calculatedUsd));
    } else {
      setAmount('');
    }
  };

  const handleAmountUsdBlur = () => {
    const parsed = parseVEAmount(amount);
    if (parsed !== null && !isNaN(parsed) && parsed > 0) {
      setAmount(formatVE(parsed));
    }
  };

  const handleAmountBsBlur = () => {
    const parsed = parseVEAmount(amountBs);
    if (parsed !== null && !isNaN(parsed) && parsed > 0) {
      setAmountBs(formatVE(parsed));
    }
  };

  const handleCopy = (field, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getFullReceiptUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://mutualfam-backend.fly.dev/api/v1')
      .toString().trim().replace(/[\r\n\t]/g, '').replace(/\/+$/, '');
    const baseUrl = rawApiUrl.replace(/\/api\/v1\/?$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${cleanPath}`;
  };

  const openReceiptViewer = (receiptUrl, title = 'Comprobante de Pago', extraInfo = {}) => {
    if (!receiptUrl) return;
    setSelectedReceipt({
      url: getFullReceiptUrl(receiptUrl),
      title,
      ...extraInfo
    });
    setShowReceiptViewer(true);
  };

  const handleOpenConfig = async () => {
    await fetchPaymentConfig();
    setShowConfigModal(true);
  };

  const handleSavePaymentConfig = async (e) => {
    e.preventDefault();
    setSavingPayment(true);
    try {
      const newConfig = { ...paymentConfig };
      if (pagoMovilBanco || pagoMovilCedula || pagoMovilTelefono) {
        newConfig['Pago Móvil'] = {
          banco: pagoMovilBanco,
          cedula: pagoMovilCedula,
          telefono: pagoMovilTelefono
        };
      }
      if (zelleEmail) {
        newConfig['Zelle'] = { email: zelleEmail };
      }
      await loansApi.savePaymentMethods({ payment_methods_json: JSON.stringify(newConfig) });
      setPaymentConfig(newConfig);
      setShowConfigModal(false);
      alert('Datos de pago guardados exitosamente.');
    } catch (err) {
      alert('Error al guardar datos de pago: ' + (err.message || 'Error desconocido'));
    } finally {
      setSavingPayment(false);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!activeOrg) {
      alert("Debes pertenecer a una mutual activa para solicitar préstamos.");
      return;
    }
    const parsedAmount = parseVEAmount(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }
    const roundedUsd = Math.round(parsedAmount * 100) / 100;
    try {
      await loansApi.createLoan({
        amount_usd: roundedUsd,
        motive,
        estimated_repayment_date: estimatedDate || null
      });
      setShowModal(false);
      setAmount('');
      setAmountBs('');
      setMotive('');
      setEstimatedDate('');
      fetchLoans();
    } catch (err) {
      alert("Error: " + (err.message || 'No se pudo crear la solicitud'));
    }
  };

  const handleCancelLoan = async (id) => {
    if (!window.confirm("¿Estás seguro de que deseas cancelar esta solicitud?")) return;
    try {
      await loansApi.cancelLoan(id);
      fetchLoans();
    } catch (err) {
      alert("Error: " + (err.message || 'No se pudo cancelar'));
    }
  };

  const handlePledgeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLoan) return;
    const parsed = parseFloat(pledgeAmount);
    if (!parsed || parsed <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    const currentTotal = (selectedLoan.amount_pledged || 0) + (selectedLoan.amount_paid || 0) + (selectedLoan.amount_verified || 0);
    const maxAllowed = Math.max(0, selectedLoan.amount_usd - currentTotal);
    if (parsed > maxAllowed) {
      alert(`El monto máximo que falta por fondear es $${maxAllowed.toFixed(2)}.`);
      return;
    }

    setPledging(true);
    try {
      await loansApi.contribute(selectedLoan.id, { amount_usd: parsed });
      setShowPledgeModal(false);
      setSelectedLoan(null);
      setPledgeAmount('');
      alert("¡Gracias! Tu promesa de aporte ha sido registrada con éxito.");
      fetchLoans();
    } catch (err) {
      alert("Error: " + (err.message || 'No se pudo registrar el aporte'));
    } finally {
      setPledging(false);
    }
  };

  const handleOpenNotify = (c, loan) => {
    if (!hasConfiguredPaymentMethods()) {
      if (window.confirm("Debes cargar por lo menos un dato de pago antes de notificar pagos.\n\n¿Deseas configurarlos ahora?")) {
        handleOpenConfig();
      }
      return;
    }
    setSelectedContrib(c);
    setSelectedLoan(loan);
    setNotifyMethod('Pago Móvil');
    setReferenceText('');
    setReceiptFile(null);
    setReceiptPreview(null);
    setShowNotifyModal(true);
  };

  const handleSubmitNotify = async (e) => {
    e.preventDefault();
    if (!selectedContrib) return;
    if (!notifyMethod) {
      alert("Debes seleccionar el método de pago.");
      return;
    }
    if (!referenceText.trim() && !receiptFile) {
      alert("Por favor ingresa el número de referencia del pago.");
      return;
    }

    setNotifying(true);
    try {
      let finalReceiptUrl = null;
      if (receiptFile) {
        const uploadRes = await loansApi.uploadFile(receiptFile);
        finalReceiptUrl = uploadRes.url;
      }

      await loansApi.notifyPayment(selectedContrib.id, {
        payment_method: notifyMethod,
        reference_text: referenceText.trim() || undefined,
        receipt_url: finalReceiptUrl || undefined
      });
      setShowNotifyModal(false);
      setSelectedContrib(null);
      setSelectedLoan(null);
      setReferenceText('');
      setReceiptFile(null);
      setReceiptPreview(null);
      alert("¡Pago notificado exitosamente! El solicitante verificará la recepción del dinero.");
      fetchLoans();
    } catch (err) {
      alert("Error al notificar pago: " + (err.message || 'Error desconocido'));
    } finally {
      setNotifying(false);
    }
  };

  const handleCancelContrib = async (contribId) => {
    if (!window.confirm("¿Seguro que deseas cancelar esta promesa de aporte?")) return;
    try {
      await loansApi.cancelContribution(contribId);
      alert("Promesa de aporte cancelada.");
      fetchLoans();
    } catch (err) {
      alert("Error al cancelar aporte: " + (err.message || 'Error desconocido'));
    }
  };

  const handleVerifyPayment = async (contribId) => {
    if (!window.confirm("¿Confirmas que recibiste el dinero de este pago?")) return;
    try {
      await loansApi.verifyPayment(contribId);
      alert("¡Pago validado exitosamente!");
      fetchLoans();
    } catch (err) {
      alert("Error al validar pago: " + (err.message || 'Error desconocido'));
    }
  };

  const handleOpenRepay = (c, loan) => {
    if (!hasConfiguredPaymentMethods()) {
      if (window.confirm("Debes cargar por lo menos un dato de pago antes de devolver un préstamo.\n\n¿Deseas configurarlos ahora?")) {
        handleOpenConfig();
      }
      return;
    }
    setSelectedRepayContrib(c);
    setSelectedLoan(loan);
    setRepayAmount(String(c.amount_usd || ''));
    let defaultMethod = 'Pago Móvil';
    if (c.funder_payment_methods_json) {
      try {
        const methods = Object.keys(JSON.parse(c.funder_payment_methods_json));
        if (methods.length > 0) {
          defaultMethod = methods.includes('Pago Móvil') ? 'Pago Móvil' : methods[0];
        }
      } catch (_) {}
    }
    setRepayMethod(defaultMethod);
    setRepayReference('');
    setRepayReceiptFile(null);
    setRepayReceiptPreview(null);
    setShowRepayModal(true);
  };

  const handleSubmitRepay = async (e) => {
    e.preventDefault();
    if (!selectedRepayContrib) return;
    if (!repayMethod || !repayAmount) {
      alert("Debes elegir el método de pago y el monto a devolver.");
      return;
    }
    const parsedAmount = parseFloat(repayAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Por favor ingresa un monto válido a devolver.");
      return;
    }

    setRepaying(true);
    try {
      let finalReceiptUrl = null;
      if (repayReceiptFile) {
        const uploadRes = await loansApi.uploadFile(repayReceiptFile);
        finalReceiptUrl = uploadRes.url;
      }

      await loansApi.notifyRepayment(selectedRepayContrib.id, {
        amount_usd: parsedAmount,
        payment_method: repayMethod,
        reference_text: repayReference.trim() || undefined,
        receipt_url: finalReceiptUrl || undefined
      });
      setShowRepayModal(false);
      setSelectedRepayContrib(null);
      setSelectedLoan(null);
      setRepayAmount('');
      setRepayReference('');
      setRepayReceiptFile(null);
      setRepayReceiptPreview(null);
      alert("¡Devolución notificada! El aportante validará la recepción.");
      fetchLoans();
    } catch (err) {
      alert("Error al reportar devolución: " + (err.message || 'Error desconocido'));
    } finally {
      setRepaying(false);
    }
  };

  const handleVerifyRepayment = async (repayId) => {
    if (!window.confirm("¿Confirmas que recibiste la devolución del dinero?")) return;
    try {
      await loansApi.verifyRepayment(repayId);
      alert("¡Devolución validada con éxito!");
      fetchLoans();
    } catch (err) {
      alert("Error al validar devolución: " + (err.message || 'Error desconocido'));
    }
  };

  const userFullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim().toLowerCase();

  const displayedLoans = loans.filter((loan) => {
    if (filter === 'active') {
      return loan.status !== 'repaid' && loan.status !== 'cancelled';
    } else {
      return loan.status === 'repaid' || loan.status === 'cancelled';
    }
  });

  return (
    <div className="glass-panel page-panel animate-fade-in" style={{ padding: '1.25rem 1rem' }}>
      {/* Header homologado con Android */}
      <div style={{
        paddingBottom: '0.875rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1rem',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '0.5rem',
        }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: '#f8fafc',
            margin: 0,
          }}>
            Préstamos
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                await fetchLoans();
                await fetchPaymentConfig();
              }}
              title="Refrescar préstamos"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              🔄
            </button>
            <button
              type="button"
              onClick={handleOpenConfig}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #3b82f6',
                color: '#3b82f6',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              ⚙️ Datos
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{
                backgroundColor: '#2563eb',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.4)',
              }}
            >
              Pedir
            </button>
          </div>
        </div>

        {bcvRate && (
          <div style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🏦</span>
            <span>Tasa BCV: {bcvRate} Bs/USD</span>
          </div>
        )}
      </div>

      {/* Subtabs Vigentes / Historial homologadas con Android */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1.25rem',
      }}>
        <button
          type="button"
          onClick={() => setFilter('active')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: filter === 'active' ? '2px solid #3b82f6' : '2px solid transparent',
            color: filter === 'active' ? '#3b82f6' : '#94a3b8',
            fontWeight: '700',
            fontSize: '1rem',
            padding: '0.5rem 0.25rem',
            cursor: 'pointer',
          }}
        >
          Vigentes
        </button>
        <button
          type="button"
          onClick={() => setFilter('history')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: filter === 'history' ? '2px solid #3b82f6' : '2px solid transparent',
            color: filter === 'history' ? '#3b82f6' : '#94a3b8',
            fontWeight: '700',
            fontSize: '1rem',
            padding: '0.5rem 0.25rem',
            cursor: 'pointer',
          }}
        >
          Historial
        </button>
      </div>

      {/* Alerta si no tiene métodos de pago configurados */}
      {!hasConfiguredPaymentMethods() && (
        <div
          onClick={handleOpenConfig}
          style={{
            backgroundColor: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            color: '#fde047',
            fontSize: '0.85rem',
            fontWeight: '500',
          }}
        >
          <span>⚠️ Configura tus datos de pago para poder recibir y notificar pagos.</span>
          <span style={{ textDecoration: 'underline', fontWeight: '700' }}>Configurar</span>
        </div>
      )}

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-md mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center items-center" style={{ minHeight: '12rem' }}><div className="loader" /></div>
      ) : (
        <div>
          {displayedLoans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8', fontSize: '1rem' }}>
              No hay préstamos para esta vista
            </div>
          ) : (
            <div className="dashboard-grid">
              {displayedLoans.map(loan => {
                const totalContributed = (loan.amount_pledged || 0) + (loan.amount_paid || 0) + (loan.amount_verified || 0);
                const percentage = loan.amount_usd > 0 ? Math.min(100, Math.round((totalContributed / loan.amount_usd) * 100)) : 0;
                const isFullyFunded = loan.status === 'funded' || percentage >= 100;
                const isMine = user && (
                  String(user.id) === String(loan.requester_id) ||
                  (userFullName && (loan.requester_name || '').trim().toLowerCase() === userFullName)
                );

                let statusLabel = loan.status;
                if (loan.status === 'pending') statusLabel = 'Buscando fondeo';
                if (loan.status === 'partial') statusLabel = `${percentage}% Fondeado`;
                if (loan.status === 'funded') statusLabel = percentage < 100 ? `${percentage}% Fondeado` : '100% Fondeado';
                if (loan.status === 'repaid') statusLabel = 'Saldado ✅';
                if (loan.status === 'cancelled') statusLabel = 'Cancelado';

                return (
                  <div key={loan.id} className="glass-card flex flex-col justify-between" style={{ padding: '1.5rem', gap: '1.25rem' }}>
                    <div>
                      <div className="flex justify-between items-start" style={{ marginBottom: '1rem' }}>
                        <span className={`badge ${isFullyFunded ? 'badge-green' : percentage > 0 ? 'badge-blue' : 'badge-blue'}`}>
                          {statusLabel}
                        </span>
                        <span className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>${loan.amount_usd}</span>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>{loan.requester_name}</h3>
                      <p className="text-secondary" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{loan.motive}</p>
                      
                      {loan.estimated_repayment_date && (
                        <p style={{ color: 'var(--accent-secondary)', marginTop: '0.75rem', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>🗓</span> Lo paga el: {new Date(loan.estimated_repayment_date).toLocaleDateString()}
                        </p>
                      )}

                      {/* Resumen de aportes */}
                      <div style={{ marginTop: '0.85rem', padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-secondary">📢 Prometido:</span>
                          <span style={{ fontWeight: '600' }}>${loan.amount_pledged || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-secondary">💸 Pagado:</span>
                          <span style={{ fontWeight: '600' }}>${loan.amount_paid || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-secondary">✅ Validado:</span>
                          <span style={{ fontWeight: '600' }}>${loan.amount_verified || 0}</span>
                        </div>
                      </div>

                      {/* Lista de aportes en curso (Homologado con Android) */}
                      {loan.contributions && loan.contributions.length > 0 && (
                        <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Aportes en curso ({loan.contributions.length}):
                          </span>
                          {loan.contributions.map((c) => {
                            const funderFullName = (c.funder_name || '').trim().toLowerCase();
                            const isMyContrib = user && (
                              String(user.id) === String(c.funder_id) ||
                              (userFullName && funderFullName && userFullName === funderFullName) ||
                              (user.email && c.funder_email && user.email.toLowerCase() === c.funder_email.toLowerCase())
                            );

                            return (
                              <div
                                key={c.id}
                                style={{
                                  background: 'rgba(15, 23, 42, 0.7)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '8px',
                                  padding: '0.75rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.4rem',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong style={{ fontSize: '0.875rem', color: '#f8fafc' }}>
                                    {c.funder_name} — ${c.amount_usd}
                                  </strong>
                                  <span
                                    style={{
                                      fontSize: '0.725rem',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontWeight: '600',
                                      backgroundColor:
                                        c.status === 'verified' ? 'rgba(16, 185, 129, 0.2)' :
                                        c.status === 'paid' ? 'rgba(234, 179, 8, 0.2)' :
                                        c.status === 'repaid' ? 'rgba(16, 185, 129, 0.2)' :
                                        'rgba(59, 130, 246, 0.2)',
                                      color:
                                        c.status === 'verified' ? '#34d399' :
                                        c.status === 'paid' ? '#fde047' :
                                        c.status === 'repaid' ? '#34d399' :
                                        '#93c5fd',
                                    }}
                                  >
                                    {c.status === 'pledged' ? '⏳ Prometido (Por pagar)' :
                                     c.status === 'paid' ? '🟡 Pagado (Por validar)' :
                                     c.status === 'verified' ? '✅ Validado' :
                                     c.status === 'repay_notified' ? '🔄 Devolución en validación' :
                                     c.status === 'repaid' ? '🎉 Devuelto' : c.status}
                                  </span>
                                </div>

                                {c.payment_method && (
                                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                    Vía {c.payment_method} {c.reference_text ? `• Ref: ${c.reference_text}` : ''}
                                  </span>
                                )}

                                {c.receipt_url && (
                                  <button
                                    type="button"
                                    onClick={() => openReceiptViewer(c.receipt_url, `Comprobante de Aporte - ${c.funder_name}`, {
                                      method: c.payment_method,
                                      reference: c.reference_text,
                                      amount: `$${c.amount_usd}`
                                    })}
                                    style={{
                                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                      border: '1px solid rgba(59, 130, 246, 0.3)',
                                      color: '#60a5fa',
                                      borderRadius: '6px',
                                      padding: '4px 10px',
                                      fontSize: '0.75rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      alignSelf: 'flex-start',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      marginTop: '2px'
                                    }}
                                  >
                                    🧾 Ver comprobante de aporte
                                  </button>
                                )}

                                {/* Devoluciones registradas */}
                                {c.repayments && c.repayments.length > 0 && (
                                  <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.35rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {c.repayments.map((r) => (
                                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', flexWrap: 'wrap', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ color: '#cbd5e1' }}>↪ Devolución de ${r.amount_usd} ({r.payment_method || 'Pago Móvil'})</span>
                                          {r.receipt_url && (
                                            <button
                                              type="button"
                                              onClick={() => openReceiptViewer(r.receipt_url, 'Comprobante de Devolución', {
                                                method: r.payment_method,
                                                reference: r.reference_text,
                                                amount: `$${r.amount_usd}`
                                              })}
                                              style={{
                                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                                color: '#60a5fa',
                                                borderRadius: '4px',
                                                padding: '2px 8px',
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                              }}
                                            >
                                              🧾 Ver
                                            </button>
                                          )}
                                        </div>
                                        {isMyContrib && r.status === 'paid' && (
                                          <button
                                            type="button"
                                            onClick={() => handleVerifyRepayment(r.id)}
                                            style={{
                                              backgroundColor: '#10b981',
                                              border: 'none',
                                              color: '#fff',
                                              borderRadius: '4px',
                                              padding: '3px 8px',
                                              fontSize: '0.7rem',
                                              fontWeight: '600',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            Validar Devolución
                                          </button>
                                        )}
                                        {r.status === 'verified' && (
                                          <span style={{ color: '#34d399', fontWeight: '600' }}>✓ Validada</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Acciones del aporte */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                  {isMyContrib && c.status === 'pledged' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleCancelContrib(c.id)}
                                        title="Cancelar promesa"
                                        style={{
                                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                          border: '1px solid rgba(239, 68, 68, 0.4)',
                                          color: '#f87171',
                                          borderRadius: '6px',
                                          padding: '6px 10px',
                                          fontSize: '0.75rem',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        ❌
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenNotify(c, loan)}
                                        style={{
                                          backgroundColor: '#2563eb',
                                          border: 'none',
                                          color: '#ffffff',
                                          borderRadius: '6px',
                                          padding: '6px 14px',
                                          fontSize: '0.8rem',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                      >
                                        💸 Notificar Pago
                                      </button>
                                    </>
                                  )}

                                  {isMine && c.status === 'paid' && (
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyPayment(c.id)}
                                      style={{
                                        backgroundColor: '#10b981',
                                        border: 'none',
                                        color: '#ffffff',
                                        borderRadius: '6px',
                                        padding: '6px 14px',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
                                      }}
                                    >
                                      ✅ Validar Pago
                                    </button>
                                  )}

                                  {isMine && c.status === 'verified' && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRepay(c, loan)}
                                      style={{
                                        backgroundColor: '#f59e0b',
                                        border: 'none',
                                        color: '#ffffff',
                                        borderRadius: '6px',
                                        padding: '6px 14px',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                                      }}
                                    >
                                      🔄 Devolver Dinero
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', marginTop: 'auto' }}>
                      {isMine ? (
                         loan.status === 'pending' ? (
                           <button className="w-full btn btn-danger" onClick={() => handleCancelLoan(loan.id)}>
                             Cancelar Solicitud
                           </button>
                         ) : (
                           <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                             Tu solicitud {loan.status === 'repaid' ? 'está saldada' : isFullyFunded ? 'está 100% fondeada' : 'recibiendo aportes'}
                           </div>
                         )
                      ) : (
                        !isFullyFunded && loan.status !== 'repaid' && loan.status !== 'cancelled' ? (
                          <button 
                            className="w-full btn btn-primary" 
                            onClick={() => {
                              setSelectedLoan(loan);
                              setPledgeAmount('');
                              setShowPledgeModal(true);
                            }}
                          >
                            Aportar a este préstamo
                          </button>
                        ) : (
                          <div style={{ textAlign: 'center', color: '#4ade80', fontSize: '0.9rem', fontWeight: '600' }}>
                            {loan.status === 'repaid' ? 'Préstamo Saldado ✅' : 'Fondeo Completado (100%)'}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal para Solicitar Préstamo */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>Solicitar Préstamo</h2>
            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {/* Monto en Dólares */}
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Monto en Dólares</label>
                    <span style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34d399',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>USD ($)</span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', fontWeight: 700, fontSize: '0.95rem' }}>$</span>
                    <input 
                      type="text" 
                      className="form-input"
                      style={{ paddingLeft: '2rem' }}
                      value={amount}
                      onChange={e => handleAmountUsdChange(e.target.value)}
                      onBlur={handleAmountUsdBlur}
                      placeholder="Ej: 50,00"
                      required 
                    />
                  </div>
                </div>

                {/* Banner Tasa del Día */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(30, 41, 59, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  fontWeight: 600
                }}>
                  🏦 Tasa del día: {bcvRate ? `${formatVE(bcvRate)} Bs/USD` : 'Consultando...'}
                </div>

                {/* Monto en Bolívares */}
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Monto en Bolívares</label>
                    <span style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      color: '#60a5fa',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>Bs. VES</span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', fontWeight: 700, fontSize: '0.95rem' }}>Bs.</span>
                    <input 
                      type="text" 
                      className="form-input"
                      style={{ paddingLeft: '2.5rem' }}
                      value={amountBs}
                      onChange={e => handleAmountBsChange(e.target.value)}
                      onBlur={handleAmountBsBlur}
                      placeholder="Ej: 2.710,00"
                    />
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                  💡 Puedes ingresar el monto en cualquiera de los dos campos; el otro se calcula automáticamente con la tasa del día.
                </span>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Fecha estimada de pago</label>
                <input 
                  type="date" 
                  className="form-input"
                  value={estimatedDate}
                  onChange={e => setEstimatedDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Motivo</label>
                <textarea 
                  className="form-input"
                  value={motive}
                  onChange={e => setMotive(e.target.value)}
                  required
                  rows="3"
                  placeholder="Ej: Para completar las medicinas del mes"
                  style={{ resize: 'none' }}
                ></textarea>
              </div>
              
              <div className="flex justify-between items-center mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Prometer Aporte (Web / iPhone) */}
      {showPledgeModal && selectedLoan && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '460px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.35rem', marginBottom: '0.65rem' }}>Prometer Aporte 🤝</h2>
            <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Vas a aportar al préstamo de: <strong>{selectedLoan.requester_name}</strong>
            </p>
            <p style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1.25rem' }}>
              Faltan por fondear: ${Math.max(0, selectedLoan.amount_usd - ((selectedLoan.amount_pledged || 0) + (selectedLoan.amount_paid || 0) + (selectedLoan.amount_verified || 0))).toFixed(2)} (de ${selectedLoan.amount_usd} solicitados)
            </p>

            <form onSubmit={handlePledgeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Monto a aportar (USD)</label>
                <input 
                  type="number" 
                  className="form-input"
                  value={pledgeAmount}
                  onChange={e => setPledgeAmount(e.target.value)}
                  placeholder="Ej: 25"
                  required 
                  min="1"
                  step="any"
                />
              </div>

              <div className="flex justify-between items-center mt-6">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowPledgeModal(false);
                    setSelectedLoan(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={pledging}>
                  {pledging ? 'Guardando...' : 'Prometer Aporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Configurar Datos de Pago */}
      {showConfigModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '1rem',
          }}
          onClick={() => setShowConfigModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '28rem',
              width: '100%',
              color: '#f8fafc',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Datos de Pago</h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePaymentConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: 0 }}>
                Registra tus métodos de pago para poder recibir y transferir aportes en la mutual.
              </p>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <strong style={{ fontSize: '0.9rem', color: '#38bdf8', display: 'block', marginBottom: '0.5rem' }}>
                  📲 Pago Móvil (Venezuela)
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <select
                    value={pagoMovilBanco}
                    onChange={(e) => setPagoMovilBanco(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="">Selecciona tu banco...</option>
                    {VENEZUELAN_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Cédula / Documento (ej. 12345678)"
                    value={pagoMovilCedula}
                    onChange={(e) => setPagoMovilCedula(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Teléfono (ej. 04121234567)"
                    value={pagoMovilTelefono}
                    onChange={(e) => setPagoMovilTelefono(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <strong style={{ fontSize: '0.9rem', color: '#a78bfa', display: 'block', marginBottom: '0.5rem' }}>
                  💵 Zelle / Correo
                </strong>
                <input
                  type="email"
                  placeholder="Correo Zelle (ej. correo@ejemplo.com)"
                  value={zelleEmail}
                  onChange={(e) => setZelleEmail(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '0.65rem',
                    color: '#f8fafc',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  style={{
                    flex: 1,
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem',
                    color: '#ffffff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                  }}
                >
                  {savingPayment ? 'Guardando...' : 'Guardar Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Notificar Pago (Homologado con Android) */}
      {showNotifyModal && selectedContrib && selectedLoan && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '1rem',
          }}
          onClick={() => setShowNotifyModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '30rem',
              width: '100%',
              color: '#f8fafc',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Notificar Pago 💸</h3>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Aporte de ${selectedContrib.amount_usd} a {selectedLoan.requester_name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifyModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Monto en Bolívares */}
            {bcvRate && (
              <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#93c5fd' }}>Monto en Bolívares (Tasa BCV {bcvRate})</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#38bdf8' }}>
                    {(selectedContrib.amount_usd * parseFloat(bcvRate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
                  </span>
                </div>
              </div>
            )}

            {/* Selección de Método */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>
                ¿Cómo transfieres?
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['Pago Móvil', 'Zelle', 'Efectivo USD', 'Transferencia'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNotifyMethod(m)}
                    style={{
                      backgroundColor: notifyMethod === m ? '#2563eb' : 'rgba(15, 23, 42, 0.6)',
                      border: notifyMethod === m ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: notifyMethod === m ? '#ffffff' : '#94a3b8',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrucciones de pago del solicitante */}
            <div style={{ marginBottom: '1rem' }}>
              {(() => {
                let reqConfig = {};
                try {
                  reqConfig = JSON.parse(selectedLoan.requester_payment_methods_json || '{}');
                } catch (_) {}

                if (notifyMethod === 'Pago Móvil') {
                  const pm = reqConfig['Pago Móvil'];
                  if (!pm || !pm.cedula) {
                    return (
                      <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#fde047' }}>
                        ⚠️ El solicitante no configuró datos de Pago Móvil. Por favor coordina directamente con {selectedLoan.requester_name}.
                      </div>
                    );
                  }
                  const safeBanco = getBankLabel(pm.banco);
                  const docPrefix = pm.tipo_doc || (pm.cedula?.startsWith('V-') || pm.cedula?.startsWith('J-') ? '' : 'V-');
                  const safeDoc = `${docPrefix}${pm.cedula}`;
                  const safeTel = pm.telefono || '';
                  const montoBsStr = bcvRate ? (selectedContrib.amount_usd * parseFloat(bcvRate)).toFixed(2) : '';

                  const copyAllText = `Banco: ${safeBanco} | Documento: ${safeDoc} | Teléfono: ${safeTel}${montoBsStr ? ` | Monto: ${montoBsStr} Bs` : ''}`;

                  return (
                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                        Datos de Pago Móvil de {selectedLoan.requester_name}:
                      </span>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Banco</div>
                          <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>{safeBanco}</div>
                        </div>
                        <button type="button" onClick={() => handleCopy('banco', pm.banco || safeBanco)} style={{ background: 'none', border: 'none', color: copiedField === 'banco' ? '#34d399' : '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                          {copiedField === 'banco' ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Cédula / Documento</div>
                          <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>{safeDoc}</div>
                        </div>
                        <button type="button" onClick={() => handleCopy('doc', pm.cedula)} style={{ background: 'none', border: 'none', color: copiedField === 'doc' ? '#34d399' : '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                          {copiedField === 'doc' ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Teléfono</div>
                          <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>{safeTel}</div>
                        </div>
                        <button type="button" onClick={() => handleCopy('tel', safeTel)} style={{ background: 'none', border: 'none', color: copiedField === 'tel' ? '#34d399' : '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                          {copiedField === 'tel' ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>

                      {montoBsStr && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Monto exacto</div>
                            <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: '600' }}>{montoBsStr} Bs</div>
                          </div>
                          <button type="button" onClick={() => handleCopy('monto', montoBsStr)} style={{ background: 'none', border: 'none', color: copiedField === 'monto' ? '#34d399' : '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                            {copiedField === 'monto' ? '✓ Copiado' : 'Copiar'}
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopy('all', copyAllText)}
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: copiedField === 'all' ? '#34d399' : '#60a5fa',
                          borderRadius: '6px',
                          padding: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginTop: '0.25rem',
                          textAlign: 'center'
                        }}
                      >
                        {copiedField === 'all' ? '✅ ¡Copiado al portapapeles!' : '📋 Copiar todo para el banco'}
                      </button>
                    </div>
                  );
                }

                if (notifyMethod === 'Zelle') {
                  const zelle = reqConfig['Zelle'];
                  const email = typeof zelle === 'object' ? zelle?.email : zelle;
                  if (!email) {
                    return (
                      <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: '#fde047' }}>
                        ⚠️ El solicitante no configuró cuenta Zelle.
                      </div>
                    );
                  }
                  return (
                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                        Cuenta Zelle de {selectedLoan.requester_name}:
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Correo / Destinatario</div>
                          <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600' }}>{email}</div>
                        </div>
                        <button type="button" onClick={() => handleCopy('zelle', email)} style={{ background: 'none', border: 'none', color: copiedField === 'zelle' ? '#34d399' : '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                          {copiedField === 'zelle' ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                    ℹ️ Realiza el pago o entrega acordada y escribe el número de referencia a continuación.
                  </div>
                );
              })()}
            </div>

            {/* Formulario de Notificación */}
            <form onSubmit={handleSubmitNotify} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>
                  Número de Referencia
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 12345678 (últimos dígitos del comprobante)"
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Comprobante de pago (Opcional) */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>
                  Comprobante / Captura (Opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setReceiptFile(file);
                      setReceiptPreview(URL.createObjectURL(file));
                    }
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.45rem',
                    color: '#94a3b8',
                    fontSize: '0.8rem',
                  }}
                />
                {receiptPreview && (
                  <div style={{ marginTop: '0.5rem', position: 'relative' }}>
                    <img src={receiptPreview} alt="Comprobante" style={{ maxHeight: '120px', borderRadius: '6px', objectFit: 'contain' }} />
                    <button
                      type="button"
                      onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                      style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                    >
                      🗑️ Quitar
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowNotifyModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '0.65rem',
                    color: '#f8fafc',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={notifying}
                  style={{
                    flex: 1,
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem',
                    color: '#ffffff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                  }}
                >
                  {notifying ? 'Notificando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Devolver Dinero (Repay) */}
      {showRepayModal && selectedRepayContrib && selectedLoan && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '1rem',
          }}
          onClick={() => setShowRepayModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '30rem',
              width: '100%',
              color: '#f8fafc',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Devolver Dinero</h3>
              <button
                type="button"
                onClick={() => setShowRepayModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Acreedor y Monto Original */}
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ color: '#f8fafc', fontSize: '0.95rem' }}>
                Acreedor: <strong style={{ color: '#ffffff' }}>{selectedRepayContrib.funder_name}</strong>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '3px' }}>
                Monto original: ${selectedRepayContrib.amount_usd}
              </div>
            </div>

            <form onSubmit={handleSubmitRepay} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Monto a devolver (USD) */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>
                  Monto a devolver (USD)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="Ej. 10"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    color: '#f8fafc',
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              {/* ¿Cómo transfieres? */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>
                  ¿Cómo transfieres?
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(() => {
                    let availableMethods = [];
                    if (selectedRepayContrib.funder_payment_methods_json) {
                      try {
                        const parsed = JSON.parse(selectedRepayContrib.funder_payment_methods_json);
                        availableMethods = Object.keys(parsed);
                      } catch (_) {}
                    }
                    if (availableMethods.length === 0) {
                      availableMethods = ['Pago Móvil', 'Zelle', 'Efectivo USD', 'Transferencia'];
                    }
                    return availableMethods.map((m) => {
                      const isSelected = repayMethod === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setRepayMethod(m)}
                          style={{
                            backgroundColor: isSelected ? '#2563eb' : 'rgba(15, 23, 42, 0.6)',
                            border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                            color: isSelected ? '#ffffff' : '#94a3b8',
                            borderRadius: '20px',
                            padding: '6px 16px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {m}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Instrucciones de pago del acreedor */}
              {repayMethod && (
                <div>
                  {(() => {
                    let funderConfig = {};
                    try {
                      funderConfig = JSON.parse(selectedRepayContrib.funder_payment_methods_json || '{}');
                    } catch (_) {}

                    const config = funderConfig[repayMethod];

                    if (!config) {
                      return (
                        <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.85rem', color: '#fde047' }}>
                          ⚠️ El acreedor no configuró datos para {repayMethod}. Por favor coordina directamente con {selectedRepayContrib.funder_name}.
                        </div>
                      );
                    }

                    if (repayMethod === 'Pago Móvil' && typeof config === 'object') {
                      const getPrefix = (tipo) => {
                        if (!tipo) return 'V';
                        if (tipo === 'Persona') return 'V';
                        if (tipo === 'Comercio') return 'J';
                        if (tipo === 'Comuna') return 'G';
                        return tipo.replace('-', '') || 'V';
                      };
                      const docPrefix = config.tipo_doc ? getPrefix(config.tipo_doc) : (config.cedula?.startsWith('V-') || config.cedula?.startsWith('J-') ? '' : 'V');
                      const cleanCedula = config.cedula?.replace(/^[VJEG]-?/i, '') || '';
                      const safeDoc = `${docPrefix}-${cleanCedula}`;
                      const safeBanco = getBankLabel(config.banco);
                      const safeTelefono = config.telefono || '';
                      const parsedMonto = parseFloat(repayAmount);
                      const montoBs = bcvRate && !isNaN(parsedMonto) && parsedMonto > 0 
                        ? (parsedMonto * parseFloat(bcvRate)).toFixed(2) 
                        : null;
                      const montoBsFormatted = montoBs 
                        ? parseFloat(montoBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : null;
                      const copyAllText = `Banco: ${safeBanco} | ${safeDoc} | ${safeTelefono}${montoBs ? ` | Monto: ${montoBs} Bs` : ''}`;

                      return (
                        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          <span style={{ fontSize: '0.82rem', color: '#60a5fa', fontWeight: '700' }}>
                            Instrucciones de Pago de {selectedRepayContrib.funder_name} (Pago Móvil):
                          </span>

                          {montoBsFormatted && (
                            <div 
                              onClick={() => handleCopy('monto', montoBs)}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              <div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Monto a pagar (Tasa BCV: {bcvRate})</div>
                                <div style={{ fontSize: '0.95rem', color: '#10b981', fontWeight: '700' }}>{montoBsFormatted} Bs</div>
                              </div>
                              <span style={{ color: copiedField === 'monto' ? '#34d399' : '#94a3b8', fontSize: '0.9rem' }}>
                                {copiedField === 'monto' ? '✓' : '📋'}
                              </span>
                            </div>
                          )}

                          <div 
                            onClick={() => handleCopy('banco', config.banco || safeBanco)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Banco</div>
                              <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: '600' }}>{safeBanco}</div>
                            </div>
                            <span style={{ color: copiedField === 'banco' ? '#34d399' : '#94a3b8', fontSize: '0.9rem' }}>
                              {copiedField === 'banco' ? '✓' : '📋'}
                            </span>
                          </div>

                          <div 
                            onClick={() => handleCopy('doc', safeDoc)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Documento</div>
                              <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: '600' }}>{safeDoc}</div>
                            </div>
                            <span style={{ color: copiedField === 'doc' ? '#34d399' : '#94a3b8', fontSize: '0.9rem' }}>
                              {copiedField === 'doc' ? '✓' : '📋'}
                            </span>
                          </div>

                          <div 
                            onClick={() => handleCopy('tel', safeTelefono)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Teléfono</div>
                              <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: '600' }}>{safeTelefono}</div>
                            </div>
                            <span style={{ color: copiedField === 'tel' ? '#34d399' : '#94a3b8', fontSize: '0.9rem' }}>
                              {copiedField === 'tel' ? '✓' : '📋'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopy('all', copyAllText)}
                            style={{
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: copiedField === 'all' ? '#34d399' : '#60a5fa',
                              borderRadius: '8px',
                              padding: '9px',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              marginTop: '0.2rem',
                              textAlign: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            {copiedField === 'all' ? '✅ ¡Copiado al portapapeles!' : '📋  Copiar todo para el banco'}
                          </button>
                        </div>
                      );
                    }

                    if (repayMethod === 'Zelle') {
                      const email = typeof config === 'object' ? config?.email : config;
                      if (!email) {
                        return (
                          <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.85rem', color: '#fde047' }}>
                            ⚠️ El acreedor no configuró cuenta Zelle.
                          </div>
                        );
                      }
                      return (
                        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          <span style={{ fontSize: '0.82rem', color: '#60a5fa', fontWeight: '700' }}>
                            Cuenta Zelle de {selectedRepayContrib.funder_name}:
                          </span>
                          <div 
                            onClick={() => handleCopy('zelle', email)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Correo / Destinatario</div>
                              <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: '600' }}>{email}</div>
                            </div>
                            <span style={{ color: copiedField === 'zelle' ? '#34d399' : '#94a3b8', fontSize: '0.9rem' }}>
                              {copiedField === 'zelle' ? '✓' : '📋'}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                        {typeof config === 'string' ? config : 'Coordina la devolución directamente con el acreedor.'}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Referencia (Opcional) */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>
                  Referencia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Número de referencia o nota"
                  value={repayReference}
                  onChange={(e) => setRepayReference(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Comprobante (Opcional) */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>
                  Comprobante (Opcional)
                </label>
                <input
                  type="file"
                  id="repay-receipt-file-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRepayReceiptFile(file);
                      setRepayReceiptPreview(URL.createObjectURL(file));
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('repay-receipt-file-input')?.click()}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px dashed rgba(59, 130, 246, 0.4)',
                    borderRadius: '8px',
                    padding: '0.65rem',
                    color: '#60a5fa',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  📎 {repayReceiptFile ? 'Cambiar Comprobante' : 'Adjuntar Comprobante'}
                </button>
                {repayReceiptPreview && (
                  <div style={{ marginTop: '0.65rem', textAlign: 'center' }}>
                    <img
                      src={repayReceiptPreview}
                      alt="Comprobante"
                      style={{
                        maxHeight: '140px',
                        maxWidth: '100%',
                        borderRadius: '8px',
                        objectFit: 'contain',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      }}
                    />
                    <div style={{ marginTop: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRepayReceiptFile(null);
                          setRepayReceiptPreview(null);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        🗑️ Quitar comprobante
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRepayModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#f8fafc',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={repaying}
                  style={{
                    flex: 1,
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#ffffff',
                    fontWeight: '600',
                    cursor: repaying ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                  }}
                >
                  {repaying ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Visor de Comprobantes */}
      {showReceiptViewer && selectedReceipt && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100000,
            padding: '1rem',
          }}
          onClick={() => setShowReceiptViewer(false)}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '1.25rem',
              maxWidth: '32rem',
              width: '100%',
              color: '#f8fafc',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>
                  {selectedReceipt.title || 'Comprobante de Pago'}
                </h3>
                <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: '2px' }}>
                  {selectedReceipt.amount && (
                    <span style={{ color: '#34d399', fontWeight: '700', marginRight: '6px' }}>
                      {selectedReceipt.amount}
                    </span>
                  )}
                  {selectedReceipt.method && <span>• Vía {selectedReceipt.method} </span>}
                  {selectedReceipt.reference && <span>• Ref: {selectedReceipt.reference}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptViewer(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              maxHeight: '60vh',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <img
                src={selectedReceipt.url}
                alt="Comprobante"
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                <p>⚠️ No se pudo cargar la imagen directamente.</p>
                <a
                  href={selectedReceipt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#60a5fa', textDecoration: 'underline', fontWeight: '600' }}
                >
                  Abrir comprobante en nueva pestaña ↗
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={selectedReceipt.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: '#60a5fa', textDecoration: 'underline' }}
              >
                Ver en tamaño completo ↗
              </a>
              <button
                type="button"
                onClick={() => setShowReceiptViewer(false)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
