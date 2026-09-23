import React, { useState, useEffect } from 'react';
import { useAuthStore, useConfigStore, fundApi } from '@civiccore/sdk';
import { PiggyBank, RefreshCw, PlusCircle, CheckCircle, Clock, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

const FundPage = () => {
  const { user } = useAuthStore();
  const [rate, setRate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amountBs, setAmountBs] = useState('');
  
  // En un sistema real, determinaríamos si el usuario es de la Junta.
  // Para este demo, asumimos que si el id es 1 o 2 es de la junta, o un flag
  const isBoardMember = user?.id === 1 || user?.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rateData, summaryData, cyclesData] = await Promise.all([
        fundApi.getRate(),
        fundApi.getSummary(),
        fundApi.getCycles()
      ]);
      setRate(rateData.rate);
      setSummary(summaryData);
      setCycles(cyclesData);
    } catch (error) {
      console.error("Error fetching fund data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCycle = async () => {
    try {
      await fundApi.openCycle({
        title: `Ciclo ${cycles.length + 1} - ${new Date().toLocaleString('es-VE', { month: 'long', year: 'numeric' })}`,
        contribution_amount_usd: 20,
        reserve_percentage: 15
      });
      fetchData();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handleCloseCycle = async (id) => {
    try {
      await fundApi.closeCycle(id);
      fetchData();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handleContribute = async (e) => {
    e.preventDefault();
    if (!summary?.active_cycle_id) return alert("No hay ciclo activo");
    
    try {
      await fundApi.registerContribution(summary.active_cycle_id, user.id, {
        amount_bs: parseFloat(amountBs)
      });
      setAmountBs('');
      fetchData();
      alert("Aporte registrado exitosamente");
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando módulo de fondo mutuo...</div>;

  const activeCycle = cycles.find(c => c.status === 'open');

  return (
    <div className="animate-fade-in" style={{ padding: '1rem' }}>
      
      {/* HEADER */}
      <div className="page-header flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-4">
            <div className="stat-icon-wrapper bg-green">
              <PiggyBank size={24} className="text-green" />
            </div>
            Fondo Mutuo
          </h1>
          <p className="text-secondary" style={{ marginTop: '0.5rem' }}>Aportes en bolívares con protección automática en USDT.</p>
        </div>
        
        <div className="glass-card flex items-center gap-4" style={{ padding: '1rem 1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Tasa BCV Oficial</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              <span className="text-green" style={{ fontSize: '1rem', marginRight: '4px' }}>Bs.</span>
              {rate?.toFixed(2)}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={fetchData} style={{ padding: '0.5rem' }} title="Actualizar datos">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        
        {/* COLUMNA PRINCIPAL - MIEMBRO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', gridColumn: '1 / -1' }}>
          
          {/* CICLO ACTIVO */}
          <div className="glass-panel" style={{ padding: '2rem', position: 'relative' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Estado del Ciclo</h2>
              {activeCycle ? (
                <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399', boxShadow: '0 0 10px #34d399' }}></span>
                  ACTIVO
                </span>
              ) : (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>CERRADO</span>
              )}
            </div>
            
            {activeCycle ? (
              <div className="flex flex-col gap-4">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="glass-card stat-card">
                    <p className="stat-title" style={{ marginBottom: '0.5rem' }}>Cuota Quincenal</p>
                    <p className="stat-value">${activeCycle.contribution_amount_usd.toFixed(2)}</p>
                    <p className="stat-footer text-green">~ Bs. {(activeCycle.contribution_amount_usd * rate).toFixed(2)}</p>
                  </div>
                  <div className="glass-card stat-card">
                    <p className="stat-title" style={{ marginBottom: '0.5rem' }}>Tu Aporte</p>
                    <p className="stat-value text-muted">Pendiente</p>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Registrar Transferencia</h3>
                  <form onSubmit={handleContribute} className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: '1', minWidth: '200px', margin: 0, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 'bold' }}>Bs.</span>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={amountBs}
                        onChange={(e) => setAmountBs(e.target.value)}
                        placeholder="Monto exacto transferido" 
                        className="form-input"
                        style={{ paddingLeft: '3rem' }}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>
                      <PlusCircle size={18} /> Aportar
                    </button>
                  </form>
                  <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} className="text-orange" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                    Asegúrate de transferir a la cuenta bancaria de la Mutual antes de registrar. El monto en dólares se fijará con la tasa BCV del momento exacto del registro.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <Clock size={48} className="text-muted" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Período de Gracia</h3>
                <p className="text-secondary" style={{ maxWidth: '400px', margin: '0 auto' }}>No hay un ciclo de aportes activo en este momento. La Junta Directiva o el Contrato Inteligente iniciará el próximo pronto.</p>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA LATERAL (WIDGETS) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', gridColumn: '1 / -1' }}>
          
          {/* RESERVA INSTITUCIONAL */}
          <div className="glass-panel stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-2rem', right: '-2rem', width: '100px', height: '100px', background: 'rgba(59, 130, 246, 0.2)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
            <div className="stat-header">
              <h3 className="stat-title text-gradient">Reserva Institucional</h3>
              <span className="badge badge-blue">Multisig USDT</span>
            </div>
            <div className="stat-value" style={{ fontSize: '3rem' }}>
              ${summary?.total_reserve_usd?.toFixed(2) || '0.00'}
            </div>
          </div>

          {/* HISTORIAL */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Historial de Ciclos</h3>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {cycles.filter(c => c.status !== 'open').map(cycle => (
                <div key={cycle.id} className="flex justify-between items-center" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s ease' }}>
                  <div className="flex items-center gap-4">
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <CheckCircle size={18} className="text-muted" />
                    </div>
                    <div>
                      <p style={{ fontWeight: '600' }}>{cycle.title}</p>
                      <p className="text-secondary" style={{ fontSize: '0.8rem' }}>{new Date(cycle.start_date).toLocaleDateString()} &rarr; {cycle.end_date ? new Date(cycle.end_date).toLocaleDateString() : 'Pendiente'}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="text-green" style={{ fontWeight: 'bold' }}>+${(cycle.total_surplus_usd / 10).toFixed(2)}</p>
                    <p className="text-muted" style={{ fontSize: '0.75rem' }}>Bs. {cycle.bcv_rate_open.toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {cycles.filter(c => c.status !== 'open').length === 0 && (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Aún no hay ciclos cerrados en el historial.
                </div>
              )}
            </div>
          </div>

          {/* PANEL ADMINISTRATIVO */}
          {isBoardMember && (
            <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'linear-gradient(to bottom right, rgba(30, 41, 59, 0.8), rgba(139, 92, 246, 0.1))' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
                <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.2)' }}>
                  <ShieldCheck size={18} style={{ color: '#a78bfa' }} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Administración</h3>
              </div>
              
              <div className="flex flex-col gap-4">
                {!activeCycle ? (
                  <button onClick={handleOpenCycle} className="btn" style={{ background: 'var(--accent-secondary)', color: 'white', padding: '0.75rem' }}>
                    Abrir Nuevo Ciclo
                  </button>
                ) : (
                  <button onClick={() => handleCloseCycle(activeCycle.id)} className="btn btn-danger" style={{ padding: '0.75rem' }}>
                    Cerrar Ciclo Actual
                  </button>
                )}
                
                <div className="glass-card" style={{ padding: '1rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Parámetros del Smart Contract</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div className="flex justify-between"><span className="text-muted">Cuota Asignada</span><strong>$20</strong></div>
                    <div className="flex justify-between"><span className="text-muted">Tasa de Reserva</span><strong>15%</strong></div>
                    <div className="flex justify-between"><span className="text-muted">Límite Crédito</span><strong>1 Activo</strong></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FundPage;
