import React, { useState, useEffect } from 'react';
import { loansApi } from '@civiccore/sdk';
import { useAuthStore } from '@civiccore/sdk/src/authStore.js';

export default function LoansDashboard() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [motive, setMotive] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');

  // Estados para prometer aporte (Web / iPhone)
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledging, setPledging] = useState(false);
  
  const { user } = useAuthStore();

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
    fetchLoans();
  }, []);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
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

  return (
    <div className="glass-panel page-panel animate-fade-in">
      <div className="flex justify-between items-center page-header-row" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="page-title text-gradient" style={{ margin: 0 }}>Préstamos Familiares</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
        >
          Pedir Préstamo
        </button>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-md">{error}</div>}

      {loading ? (
        <div className="flex justify-center items-center" style={{ flex: 1 }}><div className="loader"></div></div>
      ) : (
        <div className="dashboard-grid">
          {loans.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p className="text-muted">No hay solicitudes de préstamo en este momento.</p>
            </div>
          ) : (
            loans.filter(l => l.status !== 'cancelled').map(loan => {
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
            })
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
    </div>
  );
}
