import React, { useEffect, useState } from 'react';
import { useAuthStore, paymentsApi } from '@civiccore/sdk';
import { DollarSign, Plus, ArrowUpRight, ArrowDownRight, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PaymentsPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Aporte mensual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await paymentsApi.misTransacciones(user.id);
      // Sort by newest first
      setTransactions(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (error) {
      console.error(error);
      alert("Error al cargar transacciones");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Monto inválido");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        member_id: user.id,
        amount: parseFloat(amount),
        transaction_type: 'deposit',
        payment_method: 'transfer',
        description: description,
        // The API defaults status to 'pending' based on the backend schema logic
      };
      
      await paymentsApi.registrarTransaccion(payload);
      
      setIsModalOpen(false);
      setAmount('');
      setDescription('Aporte mensual');
      await fetchTransactions();
    } catch (error) {
      console.error(error);
      alert("Error al registrar aporte: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <CheckCircle className="text-green-500" size={16} />;
      case 'pending': return <Clock className="text-yellow-500" size={16} />;
      case 'failed': return <XCircle className="text-red-500" size={16} />;
      default: return <Clock className="text-secondary" size={16} />;
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completed': return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold border border-green-500/30">Completado</span>;
      case 'pending': return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold border border-yellow-500/30">Pendiente</span>;
      case 'failed': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold border border-red-500/30">Fallido</span>;
      default: return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-bold border border-gray-500/30">{status}</span>;
    }
  };

  return (
    <div className="animate-fade-in pb-12">
      <div className="page-header flex justify-between items-center flex-wrap gap-4 mb-8">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <DollarSign className="text-green-500" size={28} />
            Pagos y Aportes
          </h1>
          <p className="text-secondary mt-2">Gestiona tus cuotas y aportes voluntarios a la mutual.</p>
        </div>
        <button 
          className="btn btn-primary bg-green-600 hover:bg-green-500 flex items-center gap-2"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} /> Registrar Aporte
        </button>
      </div>

      {isLoading ? (
        <div className="text-center p-12"><div className="loader mx-auto"></div></div>
      ) : (
        <div className="glass-card p-0 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-secondary">
              <DollarSign className="mx-auto text-white/10 mb-4" size={48} />
              <p>No tienes transacciones registradas aún.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-secondary text-sm font-medium">Fecha</th>
                  <th className="p-4 text-secondary text-sm font-medium">Descripción</th>
                  <th className="p-4 text-secondary text-sm font-medium">Tipo</th>
                  <th className="p-4 text-secondary text-sm font-medium">Monto</th>
                  <th className="p-4 text-secondary text-sm font-medium text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-white text-sm">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-white font-medium">
                      {tx.description}
                    </td>
                    <td className="p-4">
                      {tx.transaction_type === 'deposit' ? (
                        <span className="flex items-center gap-1 text-green-400 text-sm font-bold">
                          <ArrowDownRight size={14} /> Ingreso
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-sm font-bold">
                          <ArrowUpRight size={14} /> Egreso
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-white font-mono">
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      {getStatusIcon(tx.status)}
                      {getStatusBadge(tx.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODAL DE APORTES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 animate-slide-up border border-green-500/20 relative">
            <button 
              className="absolute top-4 right-4 text-secondary hover:text-white"
              onClick={() => setIsModalOpen(false)}
            >
              <XCircle size={24} />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Plus className="text-green-500" /> Nuevo Aporte
            </h2>
            <p className="text-secondary text-sm mb-6">
              Registra un pago manual. Un tesorero verificará la transferencia y aprobará el aporte.
            </p>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-sm text-secondary mb-1">Monto (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    min="1"
                    required 
                    className="form-input pl-8 bg-black/40 border-white/10 w-full font-mono"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-secondary mb-1">Concepto</label>
                <select 
                  className="form-input bg-black/40 border-white/10 w-full"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                >
                  <option value="Aporte mensual">Aporte mensual regular</option>
                  <option value="Fondo de emergencia">Aporte a fondo de emergencia</option>
                  <option value="Donación extraordinaria">Donación extraordinaria</option>
                  <option value="Otro">Otro concepto...</option>
                </select>
              </div>

              <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20 text-sm text-green-200 mt-4">
                Por favor, realiza tu transferencia a la cuenta de la Mutual (XXXX-1234) antes de enviar este registro. El estado inicial será <strong>Pendiente</strong>.
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  className="btn btn-secondary flex-1 border-white/10"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary bg-green-600 hover:bg-green-500 flex-1 border-none"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Registrando...' : 'Registrar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PaymentsPage;
