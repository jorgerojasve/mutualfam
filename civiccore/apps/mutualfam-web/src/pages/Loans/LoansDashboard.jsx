import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { loansApi, useAuthStore } from '@civiccore/sdk';
import { X, Check } from 'lucide-react';

export default function LoansDashboard() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
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

  useEffect(() => {
    if (activeOrg?.id) {
      fetchLoans();
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

  const handleOpenConfig = async () => {
    try {
      const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://mutualfam-backend.fly.dev/api/v1')
        .toString().trim().replace(/[\r\n\t]/g, '').replace(/\/+$/, '');
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${rawApiUrl}/config/payment_methods`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.payment_methods_json || '{}');
        setPaymentConfig(parsed);
        if (parsed['Pago Móvil']) {
          setPagoMovilBanco(parsed['Pago Móvil'].banco || '');
          setPagoMovilCedula(parsed['Pago Móvil'].cedula || '');
          setPagoMovilTelefono(parsed['Pago Móvil'].telefono || '');
        }
        if (parsed['Zelle']) {
          setZelleEmail(parsed['Zelle'].email || '');
        }
      }
    } catch (_) {}
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
      const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://mutualfam-backend.fly.dev/api/v1')
        .toString().trim().replace(/[\r\n\t]/g, '').replace(/\/+$/, '');
      const token = localStorage.getItem('jwt_token');
      await fetch(`${rawApiUrl}/config/payment_methods`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payment_methods_json: JSON.stringify(newConfig) })
      });
      setPaymentConfig(newConfig);
      setShowConfigModal(false);
      alert('Datos de pago guardados exitosamente.');
    } catch (err) {
      alert('Error al guardar datos de pago');
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
    try {
      await loansApi.createLoan({
        amount_usd: parseFloat(amount),
        motive: motive,
        estimated_repayment_date: estimatedDate || null
      });
      setShowModal(false);
      setAmount('');
      setMotive('');
      setEstimatedDate('');
      fetchLoans();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleCancelLoan = async (loanId) => {
    if (!window.confirm("¿Seguro que deseas cancelar esta solicitud?")) return;
    try {
      await loansApi.cancelLoan(loanId);
      fetchLoans();
    } catch (err) {
      alert("Error al cancelar: " + err.message);
    }
  };

  const handlePledgeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLoan) return;
    const parsed = parseFloat(pledgeAmount);
    if (isNaN(parsed) || parsed <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }
    const currentContributed = (selectedLoan.amount_pledged || 0) + (selectedLoan.amount_paid || 0) + (selectedLoan.amount_verified || 0);
    const remaining = Math.max(0, selectedLoan.amount_usd - currentContributed);
    if (parsed > remaining + 0.01) {
      alert(`El monto máximo restante para fondear este préstamo es de $${remaining.toFixed(2)}.`);
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
              const isMine = user && user.id === loan.requester_id;

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
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Monto (USD)</label>
                <input 
                  type="number" 
                  className="form-input"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required 
                  min="1"
                />
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
              maxWidth: '26rem',
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
                  <input
                    type="text"
                    placeholder="Banco (ej. Banesco, Venezuela)"
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
                  />
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
    </div>
  );
}
