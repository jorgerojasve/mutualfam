import React, { useState, useEffect } from 'react';
import { fundsApi } from '@civiccore/sdk';

const FundsDashboard = () => {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFunds = async () => {
      try {
        const data = await fundsApi.getFunds();
        setFunds(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFunds();
  }, []);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '2rem', margin: '2rem', minHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem' }}>
        <h1 className="page-title text-gradient" style={{ margin: 0 }}>Fondos Comunes y Ahorro</h1>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center" style={{ flex: 1 }}><div className="loader"></div></div>
      ) : (
        <div className="dashboard-grid">
          {funds.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p className="text-muted">No hay fondos comunes creados.</p>
            </div>
          ) : (
            funds.map(fund => (
              <div key={fund.id} className="glass-card flex flex-col justify-between" style={{ padding: '1.5rem', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.25rem' }}>{fund.name}</h3>
                  <p className="text-secondary" style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>
                    {fund.fund_type === 'emergency' ? '🚨 Fondo de Emergencia' : '💰 Ahorro'}
                  </p>
                  
                  {fund.target_monthly_contribution_usd && (
                    <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)' }}>
                      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Aporte mensual sugerido</p>
                      <p className="text-gradient" style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1 }}>
                        ${fund.target_monthly_contribution_usd} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>USD</span>
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-4" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', marginTop: 'auto' }}>
                  <button className="flex-1 btn btn-primary text-sm" onClick={() => alert("Próximamente: Hacer aporte mensual")}>
                    Aportar al Fondo
                  </button>
                  <button className="flex-1 btn btn-secondary text-sm" onClick={() => alert("Próximamente: Historial")}>
                    Historial
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default FundsDashboard;
