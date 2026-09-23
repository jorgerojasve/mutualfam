import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardApi } from '@civiccore/sdk';
import { Users, UserPlus, Clock, ShieldCheck } from 'lucide-react';

const BoardPage = () => {
  const [boardPositions, setBoardPositions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBoard();
  }, []);

  const fetchBoard = async () => {
    try {
      setIsLoading(true);
      const data = await boardApi.getCurrentBoard();
      setBoardPositions(data);
    } catch (error) {
      console.error("Error fetching board", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Junta Directiva Actual</h2>
          <p className="text-secondary text-sm">Miembros electos para la coordinación de la mutual.</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/governance/create?type=board')}>
          <UserPlus size={16} />
          Convocar Elecciones
        </button>
      </div>

      {isLoading ? (
        <div className="loader">Cargando...</div>
      ) : boardPositions.length === 0 ? (
        <div className="glass-card p-8 text-center border border-dashed border-gray-600/30">
          <ShieldCheck size={48} className="mx-auto text-gray-500/50 mb-4" />
          <p className="text-secondary">No hay una junta directiva activa.</p>
          <p className="text-xs text-gray-500 mt-2">La asamblea debe convocar elecciones para elegir a los representantes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boardPositions.map(pos => (
            <div key={pos.id} className="glass-card p-6 border-t-2 border-t-accent">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-accent/10 rounded-lg text-accent">
                  <Users size={20} />
                </div>
                {pos.active && <span className="badge badge-green text-xs">Activo</span>}
              </div>
              <h3 className="font-bold text-lg">{pos.position}</h3>
              <p className="text-secondary mt-1">
                ID Miembro: <span className="text-white font-medium">#{pos.member_id}</span>
              </p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-muted">
                <Clock size={14} />
                <span>Elegido: {new Date(pos.elected_at).toLocaleDateString()}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                <Clock size={14} className="opacity-0" />
                <span>Expira: {pos.expires_at ? new Date(pos.expires_at).toLocaleDateString() : 'Indefinido'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note: In a real app we would also list active elections here */}
    </div>
  );
};

export default BoardPage;
