import React, { useEffect, useState } from 'react';
import { useAuthStore, paymentsApi, boardApi, membershipApi } from '@civiccore/sdk';
import { DollarSign, CheckCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BoardPanel = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isBoardMember, setIsBoardMember] = useState(false);
  const [boardRole, setBoardRole] = useState(null);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(null); // id of tx being processed
  const [members, setMembers] = useState({});

  useEffect(() => {
    if (user) {
      checkBoardStatus();
    }
  }, [user]);

  const checkBoardStatus = async () => {
    try {
      setIsLoading(true);
      const board = await boardApi.getCurrentBoard();
      const myPosition = board.find(b => b.member_id === user.id && b.active);
      
      if (myPosition) {
        setIsBoardMember(true);
        setBoardRole(myPosition.position);
        fetchPendingTransactions();
        fetchMembersMap();
      } else {
        setIsBoardMember(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingTransactions = async () => {
    try {
      const data = await paymentsApi.listarTodas('pending');
      setPendingTransactions(data);
    } catch (error) {
      console.error(error);
    }
  };
  
  const fetchMembersMap = async () => {
    try {
      const users = await membershipApi.getMembers();
      const map = {};
      users.forEach(u => map[u.id] = u);
      setMembers(map);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcessTransaction = async (txId, newStatus) => {
    if (!window.confirm(`¿Estás seguro de marcar esta transacción como ${newStatus}?`)) return;
    
    try {
      setIsProcessing(txId);
      await paymentsApi.cambiarEstadoTransaccion(txId, newStatus);
      // Remove from list
      setPendingTransactions(prev => prev.filter(t => t.id !== txId));
    } catch (error) {
      alert("Error procesando transacción: " + error.message);
    } finally {
      setIsProcessing(null);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center"><div className="loader mx-auto"></div></div>;
  }

  if (!isBoardMember) {
    return (
      <div className="p-12 text-center">
        <ShieldCheck className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-red-400">Acceso Denegado</h2>
        <p className="text-secondary mt-2">Esta sección es exclusiva para miembros activos de la Junta Directiva.</p>
        <button className="btn btn-secondary mt-6" onClick={() => navigate('/')}>Volver al Inicio</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-12">
      <div className="page-header mb-8">
        <h1 className="page-title flex items-center gap-3">
          <ShieldCheck className="text-accent" size={28} />
          Panel de la Junta Directiva
        </h1>
        <p className="text-secondary mt-2">
          Bienvenido, <strong className="text-white">{user.nombre}</strong>. Tu cargo actual es <strong className="text-accent">{boardRole}</strong>.
        </p>
      </div>

      <div className="glass-card p-6 mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
          <DollarSign className="text-green-500" /> Aportes Pendientes de Verificación
        </h2>
        
        {pendingTransactions.length === 0 ? (
          <div className="text-center p-8 text-secondary">
            <Clock className="mx-auto text-white/10 mb-4" size={48} />
            <p>No hay aportes pendientes de verificación.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-secondary text-sm">
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Miembro</th>
                  <th className="p-4">Concepto</th>
                  <th className="p-4 text-right">Monto</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pendingTransactions.map(tx => {
                  const txUser = members[tx.member_id] || { nombre: 'Miembro', apellido: `#${tx.member_id}` };
                  return (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-white text-sm">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-medium text-white">
                        {txUser.nombre} {txUser.apellido}
                      </td>
                      <td className="p-4 text-secondary text-sm">
                        {tx.description}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-green-400">
                        ${tx.amount.toFixed(2)}
                      </td>
                      <td className="p-4 flex justify-center gap-2">
                        <button 
                          className="btn btn-sm bg-green-500/20 text-green-400 hover:bg-green-500/40 border-none"
                          onClick={() => handleProcessTransaction(tx.id, 'completed')}
                          disabled={isProcessing === tx.id}
                        >
                          <CheckCircle size={16} className="mr-1" /> Aprobar
                        </button>
                        <button 
                          className="btn btn-sm bg-red-500/20 text-red-400 hover:bg-red-500/40 border-none"
                          onClick={() => handleProcessTransaction(tx.id, 'failed')}
                          disabled={isProcessing === tx.id}
                        >
                          <XCircle size={16} className="mr-1" /> Rechazar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default BoardPanel;
