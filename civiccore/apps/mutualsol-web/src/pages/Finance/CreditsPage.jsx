import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { creditosApi, useConfigStore, useAuthStore } from '@civiccore/sdk';
import { Check, X, AlertCircle } from 'lucide-react';

export default function CreditsPage() {
  const location = useLocation();
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(location.state?.openForm || false);
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('3');
  const [purpose, setPurpose] = useState('');
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      setLoading(true);
      const data = await creditosApi.listarTodas();
      setCredits(data);
    } catch (err) {
      setError('Error al cargar solicitudes de crédito.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCredit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    try {
      await creditosApi.solicitar(user.id, {
        amount_requested: parseFloat(amount),
        currency: 'USD',
        term_months: parseInt(term),
        purpose: purpose || 'Crédito estándar',
        evaluation_data: {}
      });
      setShowForm(false);
      setAmount('');
      setPurpose('');
      fetchCredits();
      alert('Solicitud enviada correctamente');
    } catch (err) {
      alert('Error al enviar la solicitud');
    }
  };

  const handleApprove = async (id) => {
    try {
      await creditosApi.cambiarEstado(id, 'approved');
      fetchCredits();
    } catch (e) {
      alert('Error al aprobar');
    }
  };

  const handleReject = async (id) => {
    try {
      await creditosApi.cambiarEstado(id, 'rejected');
      fetchCredits();
    } catch (e) {
      alert('Error al rechazar');
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">Cargando créditos...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const pending = credits.filter(c => c.status === 'pending');
  const active = credits.filter(c => c.status === 'active' || c.status === 'approved');

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gradient mb-2">Administración de Créditos</h1>
          <p className="text-muted">Revisa, gestiona y solicita créditos.</p>
        </div>
        <button 
          className="btn btn-primary bg-accent"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Solicitar Nuevo Crédito'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel p-6 md:p-8 mb-8 border-t-4 border-accent">
          <h2 className="text-xl font-bold mb-6">Nueva Solicitud de Crédito</h2>
          <form onSubmit={handleRequestCredit} className="space-y-6">
            <div>
              <label className="form-label">Monto (USD)</label>
              <input 
                type="number" 
                className="form-input" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Ej. 500"
                required
              />
            </div>
            <div>
              <label className="form-label">Plazo (Meses)</label>
              <select className="form-input" value={term} onChange={e => setTerm(e.target.value)}>
                <option value="1">1 mes</option>
                <option value="3">3 meses</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
              </select>
            </div>
            <div>
              <label className="form-label">Propósito</label>
              <textarea 
                className="form-input min-h-[100px]" 
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="¿Para qué necesitas este crédito?"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full mt-4">Enviar Solicitud</button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <AlertCircle className="text-accent" /> Solicitudes Pendientes ({pending.length})
        </h2>
        
        {pending.length === 0 ? (
          <div className="glass-panel p-6 text-center text-muted">No hay solicitudes pendientes.</div>
        ) : (
          <div className="grid gap-4">
            {pending.map(c => (
              <div key={c.id} className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-accent">
                <div>
                  <h3 className="font-bold text-lg">Solicitud #${c.id} - Socio ID: {c.member_id}</h3>
                  <p className="text-2xl font-bold text-gradient my-1">${c.amount_requested} USD</p>
                  <p className="text-muted">Plazo: {c.term_months} meses • Propósito: {c.purpose}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleReject(c.id)}
                    className="btn btn-outline border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-4"
                  >
                    <X size={18} /> Rechazar
                  </button>
                  <button 
                    onClick={() => handleApprove(c.id)}
                    className="btn btn-primary px-4 bg-green-500 hover:bg-green-600"
                  >
                    <Check size={18} /> Aprobar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-bold">Créditos Activos/Aprobados</h2>
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 font-semibold text-muted">ID</th>
                <th className="p-4 font-semibold text-muted">Socio</th>
                <th className="p-4 font-semibold text-muted">Monto</th>
                <th className="p-4 font-semibold text-muted">Plazo</th>
                <th className="p-4 font-semibold text-muted">Estado</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-muted">No hay créditos activos.</td>
                </tr>
              )}
              {active.map(c => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">#{c.id}</td>
                  <td className="p-4">Socio {c.member_id}</td>
                  <td className="p-4 font-bold text-accent">${c.amount_requested}</td>
                  <td className="p-4">{c.term_months} meses</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold uppercase">
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
