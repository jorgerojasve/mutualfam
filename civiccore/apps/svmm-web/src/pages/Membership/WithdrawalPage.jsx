import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { membershipApi, useAuthStore } from '@civiccore/sdk';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

const WithdrawalPage = () => {
  const { user } = useAuthStore();
  const [statusRecord, setStatusRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const data = await membershipApi.estadoBaja();
      setStatusRecord(data);
    } catch (err) {
      if (!err.message.includes("404") && !err.message.includes("No withdrawal request found")) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequest = async () => {
    try {
      await membershipApi.solicitarBaja();
      fetchStatus();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    try {
      await membershipApi.cancelarBaja();
      setStatusRecord(null);
    } catch (err) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center"><div className="loader">Cargando...</div></div>;
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto mt-8">
      <div className="page-header mb-8">
        <h1 className="page-title text-2xl font-bold">Salida de la Sociedad (SVMM)</h1>
        <p className="text-secondary">Gestión de baja voluntaria y liquidación de haberes.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {statusRecord && statusRecord.status === 'pending' ? (
        <div className="glass-card p-6 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="text-yellow-500" size={24} />
            <h2 className="text-xl font-bold">Solicitud en proceso</h2>
          </div>
          <p className="mb-4 text-secondary">
            Has solicitado tu baja de la SVMM. Tu solicitud de retiro y cálculo de liquidación se hará efectiva el:
            <br />
            <strong className="text-primary">{new Date(statusRecord.effective_at).toLocaleString()}</strong>
          </p>
          <p className="mb-6 text-sm text-secondary bg-black/20 p-3 rounded">
            Durante el período de espera, no podrás participar en asambleas ni votar. 
            Cualquier voto activo ha sido suspendido.
          </p>
          <button onClick={handleCancel} className="btn btn-outline border-red-500 text-red-500 hover:bg-red-500/10">
            Cancelar solicitud de baja
          </button>
        </div>
      ) : (
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4 text-red-500">
            <AlertTriangle size={24} />
            <h2 className="text-xl font-bold">Solicitar Baja Voluntaria</h2>
          </div>
          <p className="mb-4 text-secondary">
            Al solicitar tu baja, iniciarás un período de cierre contable (máximo 6 meses según estatutos). Durante este tiempo, tus derechos políticos en la sociedad científica serán suspendidos y se calculará tu haber a liquidar.
          </p>
          
          <ul className="mb-6 space-y-2 text-sm text-secondary">
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              Debes tener al menos 15 días de antigüedad (Tienes {user?.created_at ? Math.floor((new Date() - new Date(user.created_at))/(1000*60*60*24)) : 0} días).
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              No debes tener créditos activos ni estar en estado de mora.
            </li>
          </ul>

          <div className="flex justify-end gap-4">
            <button onClick={() => navigate(-1)} className="btn btn-outline">Volver</button>
            <button onClick={handleRequest} className="btn bg-red-600 hover:bg-red-700 text-white border-none">
              Iniciar proceso de baja
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WithdrawalPage;
