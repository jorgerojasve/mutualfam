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

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '2rem', margin: '2rem', minHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem' }}>
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
            loans.filter(l => l.status !== 'cancelled').map(loan => (
              <div key={loan.id} className="glass-card flex flex-col justify-between" style={{ padding: '1.5rem', gap: '1.5rem' }}>
                <div>
                  <div className="flex justify-between items-start" style={{ marginBottom: '1rem' }}>
                    <span className="badge badge-blue">
                      {loan.status === 'pending' ? 'Buscando fondeo' : loan.status}
                    </span>
                    <span className="text-gradient" style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>${loan.amount_usd}</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>{loan.requester_name}</h3>
                  <p className="text-secondary" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{loan.motive}</p>
                  {loan.estimated_repayment_date && (
                    <p style={{ color: 'var(--accent-secondary)', marginTop: '1rem', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>🗓</span> Lo paga el: {new Date(loan.estimated_repayment_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', marginTop: 'auto' }}>
                  {user && user.id === loan.requester_id ? (
                     <button className="w-full btn btn-danger" onClick={() => handleCancelLoan(loan.id)}>
                       Cancelar Solicitud
                     </button>
                  ) : (
                    <button className="w-full btn btn-primary" onClick={() => alert("Próximamente: Hacer la vaca")}>
                      Aportar a este préstamo
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem' }}>
            <h2 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Solicitar Préstamo</h2>
            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
              
              <div className="flex justify-between items-center mt-8">
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
    </div>
  );
}
