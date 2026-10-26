import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fundsApi, useAuthStore } from '@civiccore/sdk';
import { Plus, X } from 'lucide-react';

const FundsDashboard = () => {
  const { activeOrg } = useAuthStore();
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newFundName, setNewFundName] = useState('');
  const [newFundType, setNewFundType] = useState('emergency');
  const [newFundTarget, setNewFundTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchFunds = async () => {
    if (!activeOrg?.id) {
      setFunds([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await fundsApi.getFunds();
      setFunds(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setFunds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunds();
  }, [activeOrg?.id]);

  const handleCreateFund = async (e) => {
    e.preventDefault();
    if (!newFundName.trim()) {
      alert('El nombre del fondo es requerido');
      return;
    }
    setSubmitting(true);
    try {
      await fundsApi.createFund({
        name: newFundName.trim(),
        fund_type: newFundType,
        target_monthly_contribution_usd: newFundTarget ? parseFloat(newFundTarget) : null
      });
      setShowModal(false);
      setNewFundName('');
      setNewFundTarget('');
      fetchFunds();
    } catch (err) {
      alert(err.message || 'Error al crear el fondo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-panel page-panel animate-fade-in" style={{ padding: '1.25rem 1rem' }}>
      {/* Header homologado con Android */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '1.5rem',
      }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          color: '#f8fafc',
          margin: 0,
        }}>
          Fondos Comunes
        </h1>
        <button
          type="button"
          onClick={() => setShowModal(true)}
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
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
          }}
        >
          <Plus size={16} />
          Crear Fondo
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '12rem' }}>
          <div className="loader" />
        </div>
      ) : (
        <div>
          {funds.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              color: '#94a3b8',
              fontSize: '1rem',
            }}>
              No hay fondos creados
            </div>
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
                      {fund.fund_type === 'emergency' ? '🚨 Fondo de Emergencia' : '💰 Ahorro'}
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
                      onClick={() => alert("Próximamente: Hacer aporte mensual")}
                    >
                      Aportar al Fondo
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.85rem' }}
                      onClick={() => alert("Próximamente: Historial")}
                    >
                      Historial
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Crear Fondo */}
      {showModal && createPortal(
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '24rem',
              width: '100%',
              color: '#f8fafc',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Crear Fondo</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFund} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Nombre del Fondo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Fondo de Emergencia"
                  value={newFundName}
                  onChange={(e) => setNewFundName(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Tipo de Fondo
                </label>
                <select
                  value={newFundType}
                  onChange={(e) => setNewFundType(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                >
                  <option value="emergency">🚨 Fondo de Emergencia</option>
                  <option value="savings">💰 Ahorro</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Aporte Mensual Sugerido (USD) - Opcional
                </label>
                <input
                  type="number"
                  placeholder="Ej: 10"
                  value={newFundTarget}
                  onChange={(e) => setNewFundTarget(e.target.value)}
                  step="any"
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  disabled={submitting}
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
                  {submitting ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FundsDashboard;
